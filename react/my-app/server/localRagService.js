const crypto = require('crypto');
const { getPool } = require('../db');

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434/api';
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'embeddinggemma:300m';
const ANSWER_MODEL = process.env.RAG_ANSWER_MODEL || 'batiai/gemma4-e2b:q4';
const PRIMARY_DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const LEGACY_DATABASE = process.env.DB_NAME_V1 || 'abstract_mind_db';
const RAG_TABLE = 'rag_document_embeddings';
const JOB_TTL_MS = 1000 * 60 * 60 * 6;
const JSON_TEXT_LIMIT = 5000;
const MAX_JSON_FRAGMENTS = 80;
const jobs = new Map();
let embeddingDimensionPromise = null;

function createJobId() {
  return `rag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeDatabaseIdentifier(database) {
  const normalized = String(database || '').trim();
  if (!normalized || normalized === 'default' || normalized === 'abstract-mind-lab') {
    return PRIMARY_DATABASE;
  }
  if (normalized === 'abstract_mind_db') {
    return LEGACY_DATABASE;
  }
  if (normalized === PRIMARY_DATABASE || normalized === LEGACY_DATABASE) {
    return normalized;
  }
  throw new Error(`Unsupported database target: ${database}`);
}

function clampBatchSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 10;
  return Math.max(1, Math.min(20, Math.floor(numeric)));
}

function clampTopK(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(20, Math.floor(numeric)));
}

function clampAnswerTopK(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 5;
  return Math.max(1, Math.min(12, Math.floor(numeric)));
}

function clampQueryBudget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 6;
  return Math.max(1, Math.min(100, Math.floor(numeric)));
}

function clampResponseMaxChars(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 40000;
  return Math.max(500, Math.min(200000, Math.floor(numeric)));
}

function estimateNumPredictForChars(maxChars) {
  const chars = clampResponseMaxChars(maxChars);
  return Math.max(128, Math.ceil(chars / 3.2));
}

function toVectorLiteral(values) {
  return `[${values.map((value) => Number(value).toFixed(12)).join(',')}]`;
}

function truncateText(value, maxLength = 12000) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

function safePreview(value, maxLength = 600) {
  return truncateText(value, maxLength) || '';
}

function stableStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
}

async function listPublicTables(databaseName) {
  const result = await getPool(databaseName).query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);
  return result.rows.map((row) => String(row.table_name || '').trim()).filter(Boolean);
}

async function listTableColumns(databaseName, tableName) {
  const result = await getPool(databaseName).query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
    ORDER BY ordinal_position ASC
  `, [tableName]);
  return result.rows.map((row) => ({
    columnName: String(row.column_name || ''),
    dataType: String(row.data_type || ''),
  }));
}

function collectJsonTextFragments(value, options = {}, state = { count: 0 }) {
  const {
    maxFragments = MAX_JSON_FRAGMENTS,
    maxStringLength = 500,
    maxArrayItems = 8,
    prefix = '',
  } = options;

  if (state.count >= maxFragments || value == null) return [];

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized) return [];
    state.count += 1;
    return [prefix ? `${prefix}: ${normalized.slice(0, maxStringLength)}` : normalized.slice(0, maxStringLength)];
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    state.count += 1;
    return [prefix ? `${prefix}: ${String(value)}` : String(value)];
  }

  if (Array.isArray(value)) {
    return value.slice(0, maxArrayItems).flatMap((item, index) =>
      collectJsonTextFragments(item, {
        ...options,
        prefix: prefix ? `${prefix}[${index}]` : `[${index}]`,
      }, state),
    );
  }

  if (typeof value === 'object') {
    return Object.entries(value).slice(0, maxArrayItems * 4).flatMap(([key, child]) =>
      collectJsonTextFragments(child, {
        ...options,
        prefix: prefix ? `${prefix}.${key}` : key,
      }, state),
    );
  }

  return [];
}

function extractTrackSearchText(row) {
  const raw = row.raw_data || {};
  const operation = raw?.raw_track?.operation || raw?.operation || {};
  const clip = raw?.raw_track?.clip || raw?.clip || {};
  const lyrics = row.lyrics_timestamped || raw?.lyrics_timestamped || {};
  const conditions = row.conditions || raw?.conditions || {};

  const fragments = [
    row.title,
    row.prompt,
    row.negative_prompt,
    row.generation_mode,
    row.transform_type,
    row.model_name,
    row.instrument,
    row.video_prompt,
    operation?.sound_prompt,
    operation?.prompt,
    operation?.negative_prompt,
    clip?.title,
    clip?.description,
    ...collectJsonTextFragments(conditions, { maxFragments: 24, maxStringLength: 280 }),
    ...collectJsonTextFragments(lyrics, { maxFragments: 20, maxStringLength: 220 }),
    ...collectJsonTextFragments(raw, { maxFragments: 32, maxStringLength: 280 }),
  ].filter(Boolean);

  return truncateText(fragments.join('\n\n'), JSON_TEXT_LIMIT);
}

function buildTrackPayloadSummary(row) {
  const raw = row.raw_data || {};
  const operation = raw?.raw_track?.operation || raw?.operation || {};

  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    negative_prompt: row.negative_prompt,
    generation_mode: row.generation_mode,
    transform_type: row.transform_type,
    model_name: row.model_name,
    has_video: row.has_video,
    session_id: row.session_id,
    operation_sound_prompt: operation?.sound_prompt || null,
    raw_excerpt: safePreview(stableStringify(raw), 1600),
    conditions_excerpt: safePreview(stableStringify(row.conditions), 1200),
    lyrics_excerpt: safePreview(stableStringify(row.lyrics_timestamped), 1200),
  };
}

function buildHash(text) {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.startedAtMs > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

async function embedTexts(texts) {
  const response = await fetch(`${OLLAMA_API_BASE.replace(/\/+$/, '')}/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Ollama embed failed: HTTP ${response.status}`);
  }

  const embeddings = Array.isArray(payload?.embeddings) ? payload.embeddings : [];
  if (!embeddings.length) {
    throw new Error('Ollama returned no embeddings');
  }
  return embeddings;
}

async function generateWithLocalModel({
  model,
  prompt,
  systemPrompt,
  temperature = 0,
  numCtx = 8192,
  numPredict,
}) {
  const numericPredict = Number(numPredict);
  const options = {
    temperature,
    num_ctx: numCtx,
  };
  if (Number.isFinite(numericPredict) && numericPredict > 0) {
    options.num_predict = Math.max(64, Math.floor(numericPredict));
  }

  const response = await fetch(`${OLLAMA_API_BASE.replace(/\/+$/, '')}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model: model || ANSWER_MODEL,
      prompt,
      system: systemPrompt,
      stream: false,
      options,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Ollama generate failed: HTTP ${response.status}`);
  }

  return {
    model: payload?.model || model || ANSWER_MODEL,
    response: String(payload?.response || '').trim(),
    promptEvalCount: payload?.prompt_eval_count ?? null,
    evalCount: payload?.eval_count ?? null,
    totalDuration: payload?.total_duration ?? null,
    loadDuration: payload?.load_duration ?? null,
    evalDuration: payload?.eval_duration ?? null,
  };
}

async function getEmbeddingDimension() {
  if (!embeddingDimensionPromise) {
    embeddingDimensionPromise = (async () => {
      const embeddings = await embedTexts(['dimension probe']);
      const dimension = Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
      if (!dimension) {
        throw new Error('Failed to detect embedding dimension');
      }
      return dimension;
    })();
  }

  return embeddingDimensionPromise;
}

async function ensureRagSchema(databaseName) {
  const dimension = await getEmbeddingDimension();
  const client = await getPool(databaseName).connect();
  try {
    const extensionResult = await client.query(`
      SELECT EXISTS(
        SELECT 1
        FROM pg_extension
        WHERE extname = 'vector'
      ) AS installed
    `);
    const hasVector = Boolean(extensionResult.rows[0]?.installed);
    if (!hasVector) {
      try {
        await client.query('CREATE EXTENSION vector');
      } catch (error) {
        throw new Error(`pgvector extension is not installed and could not be created with current permissions: ${error?.message || error}`);
      }
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${RAG_TABLE} (
        source_table TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_title TEXT,
        chunk_text TEXT NOT NULL,
        source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        content_hash TEXT NOT NULL,
        embedding vector(${dimension}) NOT NULL,
        vectorized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source_table, source_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${RAG_TABLE}_source_table
      ON ${RAG_TABLE} (source_table, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${RAG_TABLE}_embedding_ivfflat
      ON ${RAG_TABLE}
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 64);
    `);

    const typeResult = await client.query(`
      SELECT format_type(a.atttypid, a.atttypmod) AS column_type
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = $1
        AND a.attname = 'embedding'
        AND a.attnum > 0
        AND NOT a.attisdropped
      LIMIT 1
    `, [RAG_TABLE]);

    const typeName = typeResult.rows[0]?.column_type || '';
    if (typeName !== `vector(${dimension})`) {
      throw new Error(`Unexpected embedding column type ${typeName}; expected vector(${dimension})`);
    }
  } finally {
    client.release();
  }

  return dimension;
}

async function tableExists(databaseName, tableName) {
  const result = await getPool(databaseName).query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

function buildTrackDocument(row) {
  const snapshot = buildTrackPayloadSummary(row);
  const text = extractTrackSearchText(row);

  return {
    sourceTable: 'tracks',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      title: row.title,
      session_id: row.session_id,
      has_video: row.has_video,
      created_at: row.created_at,
      raw_length: String(row.raw_data ? stableStringify(row.raw_data).length : 0),
    },
  };
}

function buildSessionDocument(row) {
  const snapshot = {
    id: row.id,
    title: row.title,
    ai_snapshot: row.ai_snapshot,
    config: row.config,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const text = truncateText([
    row.title,
    stableStringify(row.config),
    stableStringify(row.ai_snapshot),
  ].filter(Boolean).join('\n\n'));

  return {
    sourceTable: 'sessions',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      title: row.title,
      updated_at: row.updated_at,
    },
  };
}

function buildMusicBlockDocument(row) {
  const snapshot = {
    id: row.id,
    block_type: row.block_type,
    layer: row.layer,
    slug: row.slug,
    name: row.name,
    content: row.content,
  };
  const text = truncateText([
    row.name,
    row.slug,
    row.block_type,
    stableStringify(row.content),
  ].filter(Boolean).join('\n\n'));

  return {
    sourceTable: 'music_blocks',
    sourceId: String(row.id),
    sourceTitle: row.name || row.slug || row.id,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      block_type: row.block_type,
      layer: row.layer,
      slug: row.slug,
    },
  };
}

function buildChatSessionDocument(row) {
  const snapshot = {
    id: row.id,
    title: row.title,
    full_payload: row.full_payload,
    created_at: row.created_at,
  };
  const text = truncateText([
    row.title,
    stableStringify(row.full_payload),
  ].filter(Boolean).join('\n\n'));

  return {
    sourceTable: 'chat_sessions',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      title: row.title,
      created_at: row.created_at,
    },
  };
}

function buildSongDocument(row) {
  const snapshot = {
    id: row.id,
    title: row.title,
    sound_prompt: row.sound_prompt,
    phase_transition_logic: row.phase_transition_logic,
    raw_data: row.raw_data,
  };
  const text = truncateText([
    row.title,
    row.sound_prompt,
    row.phase_transition_logic,
    stableStringify(row.raw_data),
  ].filter(Boolean).join('\n\n'));

  return {
    sourceTable: 'songs',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      title: row.title,
    },
  };
}

function buildMmssInvariantDocument(row) {
  const snapshot = {
    invariant_key: row.invariant_key,
    source_database: row.source_database,
    source_table: row.source_table,
    source_id: row.source_id,
    source_title: row.source_title,
    extractor: row.extractor,
    domain: row.domain,
    metrics: row.metrics,
    validation: row.validation,
    metadata: row.metadata,
  };
  const text = truncateText([
    row.source_title,
    row.source_text,
    stableStringify(row.phase_matches),
    stableStringify(row.metrics),
    stableStringify(row.validation),
    stableStringify(row.metadata),
  ].filter(Boolean).join('\n\n'), 5000);

  return {
    sourceTable: 'mmss_invariants',
    sourceId: String(row.invariant_key),
    sourceTitle: row.source_title || row.invariant_key,
    chunkText: text,
    sourcePayload: snapshot,
    metadata: {
      source_database: row.source_database,
      source_table: row.source_table,
      source_id: row.source_id,
      extractor: row.extractor,
      domain: row.domain,
      stability_flag: row.metrics?.stability_flag ?? row.metadata?.stability_flag ?? false,
      phase_operator_ids: row.metadata?.phase_operator_ids || [],
    },
  };
}

function getGenericSourceId(row, tableName) {
  const candidates = [row.id, row.invariant_key, row.uuid, row.key, row.slug, row.name, row.title];
  const found = candidates.find((value) => value != null && String(value).trim());
  if (found != null) {
    return String(found);
  }
  return buildHash(`${tableName}:${stableStringify(row)}`);
}

function getGenericSourceTitle(row, sourceId) {
  return row.title || row.name || row.slug || row.key || sourceId;
}

function buildGenericTableDocument(tableName, row, columns = []) {
  const sourceId = getGenericSourceId(row, tableName);
  const sourceTitle = getGenericSourceTitle(row, sourceId);
  const fragments = [];

  for (const column of columns) {
    const key = column.columnName;
    const value = row[key];
    if (value == null) continue;
    if (typeof value === 'string' && value.trim()) {
      fragments.push(`${key}: ${value.trim()}`);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      fragments.push(`${key}: ${String(value)}`);
    } else if (typeof value === 'object') {
      fragments.push(`${key}: ${stableStringify(value)}`);
    }
  }

  const chunkText = truncateText([
    `Table: ${tableName}`,
    `Source ID: ${sourceId}`,
    ...fragments,
  ].join('\n\n'), JSON_TEXT_LIMIT);

  return {
    sourceTable: tableName,
    sourceId,
    sourceTitle,
    chunkText,
    sourcePayload: row,
    metadata: {
      generic_source: true,
      column_count: columns.length,
    },
  };
}

async function loadGenericTableDocuments(databaseName, tableName) {
  const columns = await listTableColumns(databaseName, tableName);
  if (!columns.length) return [];

  const quotedTable = quoteIdentifier(tableName);
  let rows = [];
  try {
    const result = await getPool(databaseName).query(`SELECT * FROM ${quotedTable}`);
    rows = result.rows;
  } catch {
    return [];
  }

  return rows
    .map((row) => buildGenericTableDocument(tableName, row, columns))
    .filter((doc) => doc.chunkText);
}

async function loadSourceDocuments(databaseName, requestedTables = []) {
  const selected = new Set((Array.isArray(requestedTables) ? requestedTables : []).filter(Boolean));
  const docs = [];
  const handledTables = new Set();

  const canUse = (tableName) => selected.size === 0 || selected.has(tableName);

  if (canUse('tracks') && await tableExists(databaseName, 'tracks')) {
    handledTables.add('tracks');
    const result = await getPool(databaseName).query(`
      SELECT id, title, prompt, negative_prompt, generation_mode, transform_type, model_name, video_prompt,
             session_id, has_video, created_at, raw_data, conditions, lyrics_timestamped
      FROM tracks
      WHERE COALESCE(prompt, '') <> ''
         OR raw_data IS NOT NULL
         OR conditions IS NOT NULL
         OR lyrics_timestamped IS NOT NULL
      ORDER BY created_at DESC NULLS LAST
    `);
    docs.push(...result.rows.map(buildTrackDocument).filter((doc) => doc.chunkText));
  }

  if (canUse('sessions') && await tableExists(databaseName, 'sessions')) {
    handledTables.add('sessions');
    const result = await getPool(databaseName).query(`
      SELECT id, title, ai_snapshot, config, created_at, updated_at
      FROM sessions
      WHERE ai_snapshot IS NOT NULL OR config IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
    `);
    docs.push(...result.rows.map(buildSessionDocument).filter((doc) => doc.chunkText));
  }

  if (canUse('music_blocks') && await tableExists(databaseName, 'music_blocks')) {
    handledTables.add('music_blocks');
    const result = await getPool(databaseName).query(`
      SELECT id, block_type, layer, slug, name, content
      FROM music_blocks
      WHERE content IS NOT NULL
      ORDER BY layer ASC, slug ASC
    `);
    docs.push(...result.rows.map(buildMusicBlockDocument).filter((doc) => doc.chunkText));
  }

  if (canUse('chat_sessions') && await tableExists(databaseName, 'chat_sessions')) {
    handledTables.add('chat_sessions');
    const result = await getPool(databaseName).query(`
      SELECT id, title, full_payload, created_at
      FROM chat_sessions
      WHERE full_payload IS NOT NULL
      ORDER BY created_at DESC
    `);
    docs.push(...result.rows.map(buildChatSessionDocument).filter((doc) => doc.chunkText));
  }

  if (canUse('songs') && await tableExists(databaseName, 'songs')) {
    handledTables.add('songs');
    const result = await getPool(databaseName).query(`
      SELECT id, title, sound_prompt, phase_transition_logic, raw_data
      FROM songs
      WHERE COALESCE(sound_prompt, '') <> ''
         OR COALESCE(phase_transition_logic, '') <> ''
         OR raw_data IS NOT NULL
      ORDER BY created_at DESC
    `);
    docs.push(...result.rows.map(buildSongDocument).filter((doc) => doc.chunkText));
  }

  if (canUse('mmss_invariants') && await tableExists(databaseName, 'mmss_invariants')) {
    handledTables.add('mmss_invariants');
    const result = await getPool(databaseName).query(`
      SELECT invariant_key, source_database, source_table, source_id, source_title, extractor, domain,
             source_text, phase_matches, metrics, validation, metadata, updated_at
      FROM mmss_invariants
      WHERE source_text IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
    `);
    docs.push(...result.rows.map(buildMmssInvariantDocument).filter((doc) => doc.chunkText));
  }

  const genericCandidates = selected.size
    ? Array.from(selected).filter((tableName) => !handledTables.has(tableName))
    : [];

  for (const tableName of genericCandidates) {
    if (!await tableExists(databaseName, tableName)) continue;
    docs.push(...await loadGenericTableDocuments(databaseName, tableName));
  }

  return docs;
}

async function loadExistingHashes(databaseName, sourceTable, sourceIds) {
  if (!sourceIds.length) return new Map();
  const result = await getPool(databaseName).query(`
    SELECT source_id, content_hash
    FROM ${RAG_TABLE}
    WHERE source_table = $1
      AND source_id = ANY($2)
  `, [sourceTable, sourceIds]);

  return new Map(result.rows.map((row) => [String(row.source_id), row.content_hash]));
}

async function upsertEmbeddingBatch(databaseName, docs, embeddings) {
  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');
    for (let index = 0; index < docs.length; index += 1) {
      const doc = docs[index];
      const vector = toVectorLiteral(embeddings[index]);
      await client.query(`
        INSERT INTO ${RAG_TABLE} (
          source_table,
          source_id,
          source_title,
          chunk_text,
          source_payload,
          metadata,
          content_hash,
          embedding,
          vectorized_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::vector, NOW(), NOW())
        ON CONFLICT (source_table, source_id)
        DO UPDATE SET
          source_title = EXCLUDED.source_title,
          chunk_text = EXCLUDED.chunk_text,
          source_payload = EXCLUDED.source_payload,
          metadata = EXCLUDED.metadata,
          content_hash = EXCLUDED.content_hash,
          embedding = EXCLUDED.embedding,
          vectorized_at = NOW(),
          updated_at = NOW()
      `, [
        doc.sourceTable,
        doc.sourceId,
        doc.sourceTitle,
        doc.chunkText,
        JSON.stringify(doc.sourcePayload || {}),
        JSON.stringify(doc.metadata || {}),
        doc.contentHash,
        vector,
      ]);

      if (doc.sourceTable === 'mmss_invariants') {
        await client.query(`
          UPDATE mmss_invariants
          SET vectorized = TRUE, updated_at = NOW()
          WHERE invariant_key = $1
        `, [doc.sourceId]);
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function gatherStats(databaseName) {
  const dimension = await getEmbeddingDimension();
  await ensureRagSchema(databaseName);
  const availableTables = await listPublicTables(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT
      COUNT(*)::int AS total_embeddings,
      COUNT(DISTINCT source_table)::int AS source_table_count,
      COALESCE(JSON_AGG(DISTINCT source_table) FILTER (WHERE source_table IS NOT NULL), '[]'::json) AS source_tables,
      MAX(updated_at) AS last_updated_at
    FROM ${RAG_TABLE}
  `);

  return {
    database: databaseName,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: dimension,
    totalEmbeddings: result.rows[0]?.total_embeddings || 0,
    sourceTableCount: result.rows[0]?.source_table_count || 0,
    sourceTables: result.rows[0]?.source_tables || [],
    availableTables,
    lastUpdatedAt: result.rows[0]?.last_updated_at || null,
    activeJob: Array.from(jobs.values()).find((job) => job.database === databaseName && job.status === 'running') || null,
  };
}

async function runVectorizationJob(job) {
  const dimension = await ensureRagSchema(job.database);
  job.embeddingDimension = dimension;
  job.lastStage = 'loading_documents';
  const documents = await loadSourceDocuments(job.database, job.sourceTables);
  job.totalDocuments = documents.length;

  for (let start = 0; start < documents.length; start += job.batchSize) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      return;
    }

    job.lastStage = 'preparing_batch';
    const batch = documents.slice(start, start + job.batchSize)
      .map((doc) => ({
        ...doc,
        contentHash: buildHash(doc.chunkText),
      }));

    const byTable = new Map();
    for (const doc of batch) {
      if (!byTable.has(doc.sourceTable)) {
        byTable.set(doc.sourceTable, []);
      }
      byTable.get(doc.sourceTable).push(doc);
    }

    const docsToVectorize = [];
    for (const [sourceTable, tableDocs] of byTable.entries()) {
      job.lastStage = `checking_hashes:${sourceTable}`;
      const existingHashes = await loadExistingHashes(job.database, sourceTable, tableDocs.map((doc) => doc.sourceId));
      for (const doc of tableDocs) {
        if (existingHashes.get(doc.sourceId) === doc.contentHash) {
          job.skipped += 1;
        } else {
          docsToVectorize.push(doc);
        }
      }
    }

    if (docsToVectorize.length) {
      job.lastStage = 'embedding_batch';
      const embeddings = await embedTexts(docsToVectorize.map((doc) => doc.chunkText));
      job.lastStage = 'writing_batch';
      await upsertEmbeddingBatch(job.database, docsToVectorize, embeddings);
      job.vectorized += docsToVectorize.length;
    }

    job.processed = Math.min(documents.length, start + batch.length);
    job.progress = documents.length ? Math.round((job.processed / documents.length) * 100) : 100;
    job.updatedAt = new Date().toISOString();
  }

  job.status = 'completed';
  job.completedAt = new Date().toISOString();
  job.progress = 100;
}

async function startVectorizationJob(options = {}) {
  cleanupJobs();
  const database = normalizeDatabaseIdentifier(options.database);
  const activeJob = Array.from(jobs.values()).find((job) => job.database === database && job.status === 'running');
  if (activeJob) {
    return activeJob;
  }

  const job = {
    jobId: createJobId(),
    database,
    batchSize: clampBatchSize(options.batchSize),
    sourceTables: Array.isArray(options.sourceTables) ? options.sourceTables.filter(Boolean) : [],
    status: 'running',
    progress: 0,
    processed: 0,
    totalDocuments: 0,
    vectorized: 0,
    skipped: 0,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    updatedAt: new Date().toISOString(),
    error: null,
    lastStage: 'queued',
    cancelRequested: false,
  };

  jobs.set(job.jobId, job);

  Promise.resolve()
    .then(() => runVectorizationJob(job))
    .catch((error) => {
      job.status = 'failed';
      job.error = error?.message || 'Vectorization failed';
      job.updatedAt = new Date().toISOString();
      job.completedAt = new Date().toISOString();
    });

  return job;
}

function getJobStatus(jobId) {
  cleanupJobs();
  if (!jobId) return null;
  return jobs.get(jobId) || null;
}

function cancelJob(jobId) {
  cleanupJobs();
  if (!jobId) return null;
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status === 'running') {
    job.cancelRequested = true;
    job.updatedAt = new Date().toISOString();
  }
  return job;
}

function normalizeSourceScopes(options = {}) {
  const explicitScopes = Array.isArray(options.sourceScopes) ? options.sourceScopes : [];
  const merged = new Map();

  const pushScope = (database, tables) => {
    const normalizedDatabase = normalizeDatabaseIdentifier(database);
    const existing = merged.get(normalizedDatabase) || new Set();
    for (const table of Array.isArray(tables) ? tables : []) {
      const normalizedTable = String(table || '').trim();
      if (normalizedTable) existing.add(normalizedTable);
    }
    merged.set(normalizedDatabase, existing);
  };

  for (const scope of explicitScopes) {
    if (!scope) continue;
    pushScope(scope.database, scope.tables || scope.sourceTables || []);
  }

  if (!merged.size) {
    pushScope(options.database, options.sourceTables || []);
  }

  return Array.from(merged.entries()).map(([database, tables]) => ({
    database,
    sourceTables: Array.from(tables),
  }));
}

function buildQueryVariants(query, mode, budget) {
  const normalizedQuery = String(query || '').trim();
  const queryBudget = clampQueryBudget(budget);
  if (!normalizedQuery) return [];

  const globalTemplates = [
    '{query}',
    'Extract the most relevant factual evidence for: {query}',
    'Find structured JSON fragments, metadata, and direct source traces for: {query}',
    'Retrieve session-level workflow context, tool traces, and prompts for: {query}',
    'Retrieve track-level semantics, prompt wording, lyrics, and generation descriptors for: {query}',
    'Find cross-database evidence, matching terms, and provenance anchors for: {query}',
    'Surface concise source blocks with the highest semantic overlap for: {query}',
    'Focus on operator, phase, space, rhythm, timbre, logic, and math cues for: {query}',
  ];

  const modeTemplates = {
    qa: [
      'Answer the factual question using only indexed evidence: {query}',
      'Collect the strongest supporting snippets for: {query}',
    ],
    prompt_mutation: [
      'Find prompt patterns, modifiers, and style carriers for: {query}',
      'Retrieve reusable prompt fragments and negative guidance for: {query}',
      'Find JSON prompt structures and mutation-ready constraints for: {query}',
    ],
    session_analysis: [
      'Retrieve chronological session evidence and conversation traces for: {query}',
      'Find tool arguments, responses, and session-level state transitions for: {query}',
      'Surface session diagnostics, generation failures, and corrective context for: {query}',
    ],
    mmss_operator_assist: [
      'Retrieve MMSS operator mappings, ontology terms, and structured blocks for: {query}',
      'Find rhythm, timbre, space, logic, math, and phase relations for: {query}',
      'Collect canonical MMSS evidence and comparable legacy echoes for: {query}',
    ],
    mmss_invariants: [
      'Retrieve MMSS invariants, ontology terms, operator rules, and reusable structures for: {query}',
      'Find rhythm, timbre, space, logic, math, and phase invariant mappings for: {query}',
      'Collect structured MMSS blocks, invariant fragments, and canonical evidence for: {query}',
    ],
    cross_db_reconciliation: [
      'Compare cross-database records, overlaps, and divergences for: {query}',
      'Find matching evidence across abstract-mind-lab and abstract_mind_db for: {query}',
      'Retrieve canonical vs legacy context for reconciliation: {query}',
    ],
    json_prompt_extraction: [
      'Find JSON prompts, schema fragments, and parameter blocks for: {query}',
      'Retrieve machine-readable prompt structures and configuration payloads for: {query}',
    ],
    source_audit: [
      'Audit provenance quality, coverage, and missing links for: {query}',
      'Retrieve the most traceable source records and structured evidence for: {query}',
    ],
    ase_console_recipe: [
      'Find ASE Console style procedures, repeatable steps, and runtime recipes for: {query}',
      'Retrieve actionable operator recipes and generation workflows for: {query}',
    ],
  };

  const templates = [
    ...globalTemplates,
    ...(modeTemplates[String(mode || 'qa')] || []),
  ];

  const variants = [];
  const seen = new Set();
  for (const template of templates) {
    const value = template.replaceAll('{query}', normalizedQuery).trim();
    if (!value || seen.has(value)) continue;
    variants.push(value);
    seen.add(value);
    if (variants.length >= queryBudget) return variants;
  }

  let extraIndex = 1;
  while (variants.length < queryBudget) {
    const value = `${normalizedQuery}\nFocus Variant ${extraIndex}: emphasize source provenance, structured fragments, and semantic overlap.`;
    if (!seen.has(value)) {
      variants.push(value);
      seen.add(value);
    }
    extraIndex += 1;
  }

  return variants;
}

async function searchSingleScope({ database, queryEmbedding, queryText, topK, sourceTables = [] }) {
  await ensureRagSchema(database);
  const vector = toVectorLiteral(queryEmbedding);
  const filterClause = sourceTables.length ? 'WHERE source_table = ANY($3)' : '';
  const params = sourceTables.length ? [vector, topK, sourceTables] : [vector, topK];
  const result = await getPool(database).query(`
    SELECT
      source_table,
      source_id,
      source_title,
      chunk_text,
      source_payload,
      metadata,
      content_hash,
      vectorized_at,
      updated_at,
      embedding <=> $1::vector AS distance
    FROM ${RAG_TABLE}
    ${filterClause}
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $2
  `, params);

  return result.rows.map((row) => ({
    database,
    queryVariant: queryText,
    sourceTable: row.source_table,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    chunkText: row.chunk_text,
    sourcePayload: row.source_payload,
    metadata: row.metadata,
    contentHash: row.content_hash,
    vectorizedAt: row.vectorized_at,
    updatedAt: row.updated_at,
    distance: Number(row.distance),
    similarity: Number((1 - Number(row.distance)).toFixed(6)),
  }));
}

async function searchRag(options = {}) {
  const topK = clampTopK(options.topK);
  const query = String(options.query || '').trim();
  if (!query) {
    throw new Error('Query is required');
  }
  const sourceScopes = normalizeSourceScopes(options);
  const queryBudget = clampQueryBudget(options.queryBudget);
  const queryVariants = buildQueryVariants(query, options.mode, queryBudget);
  const embeddings = await embedTexts(queryVariants);
  const perVariantTopK = Math.max(topK, Math.min(12, topK + 2));
  const merged = new Map();

  for (let index = 0; index < queryVariants.length; index += 1) {
    const queryVariant = queryVariants[index];
    const queryEmbedding = embeddings[index];
    for (const scope of sourceScopes) {
      const scopedResults = await searchSingleScope({
        database: scope.database,
        queryEmbedding,
        queryText: queryVariant,
        topK: perVariantTopK,
        sourceTables: scope.sourceTables,
      });

      for (const row of scopedResults) {
        const mergeKey = [
          row.database,
          row.sourceTable,
          row.sourceId,
          row.contentHash || '',
        ].join('::');
        const existing = merged.get(mergeKey);
        if (!existing || row.distance < existing.distance) {
          merged.set(mergeKey, {
            ...row,
            matchedQueries: [queryVariant],
          });
          continue;
        }

        const matchedQueries = new Set(existing.matchedQueries || []);
        matchedQueries.add(queryVariant);
        existing.matchedQueries = Array.from(matchedQueries);
      }
    }
  }

  const retrievalPoolSize = Math.max(topK, Math.min(60, topK * Math.min(queryBudget, 6)));
  const results = Array.from(merged.values())
    .sort((left, right) => {
      if (left.distance !== right.distance) return left.distance - right.distance;
      return String(left.sourceTitle || '').localeCompare(String(right.sourceTitle || ''));
    })
    .slice(0, retrievalPoolSize);

  return {
    database: sourceScopes.length === 1 ? sourceScopes[0].database : 'multi',
    sourceScopes,
    query,
    topK,
    queryBudget,
    queryVariants,
    embeddingModel: EMBEDDING_MODEL,
    embeddingDimension: embeddings[0]?.length || 0,
    results,
  };
}

function getFilterProfileConfig(profile) {
  switch (String(profile || 'balanced')) {
    case 'strict':
      return {
        minSimilarity: 0.68,
        maxBlocks: 4,
        maxPerTable: 2,
        maxContextChars: 6500,
        excludeRelationHeavy: true,
      };
    case 'exploratory':
      return {
        minSimilarity: 0.42,
        maxBlocks: 7,
        maxPerTable: 3,
        maxContextChars: 10500,
        excludeRelationHeavy: false,
      };
    default:
      return {
        minSimilarity: 0.55,
        maxBlocks: 5,
        maxPerTable: 2,
        maxContextChars: 8500,
        excludeRelationHeavy: true,
      };
  }
}

function isRelationHeavyResult(result) {
  const sourceTable = String(result?.sourceTable || '').toLowerCase();
  const chunkText = String(result?.chunkText || '').toLowerCase();
  if (sourceTable === 'sessions' || sourceTable === 'chat_sessions') {
    return true;
  }

  const relationSignals = [
    'relation',
    'edge',
    'parent',
    'origin',
    'depends',
    'reference',
    'tool_name',
    'tool',
    'message_count',
    'session_id',
  ];
  const hits = relationSignals.filter((token) => chunkText.includes(token)).length;
  return hits >= 3;
}

function buildContextBlock(result, rank) {
  return {
    rank,
    database: result.database,
    source_table: result.sourceTable,
    source_id: result.sourceId,
    source_title: result.sourceTitle,
    similarity: result.similarity,
    distance: result.distance,
    metadata: result.metadata || {},
    matched_queries: Array.isArray(result.matchedQueries) ? result.matchedQueries : [],
    context_text: truncateText(result.chunkText, 1800),
  };
}

function buildContextHeader(block) {
  return [
    `Rank: ${block.rank}`,
    `Database: ${block.database || 'n/a'}`,
    `Source Table: ${block.source_table}`,
    `Source ID: ${block.source_id}`,
    `Source Title: ${block.source_title || 'n/a'}`,
    `Similarity: ${block.similarity}`,
    `Matched Queries: ${(block.matched_queries || []).slice(0, 3).join(' | ') || 'n/a'}`,
  ].join('\n');
}

function applyPreliminaryFilters(results, options = {}) {
  const profileConfig = getFilterProfileConfig(options.filterProfile);
  const includeRelationLayer = options.includeRelationLayer === true;
  const accepted = [];
  const relationLayer = [];
  const perTableCount = new Map();
  let contextChars = 0;

  for (const result of results) {
    if (Number(result.similarity || 0) < profileConfig.minSimilarity) {
      continue;
    }

    const isRelationHeavy = isRelationHeavyResult(result);
    const sourceKey = `${result.database || 'default'}:${result.sourceTable}`;
    const targetCount = perTableCount.get(sourceKey) || 0;
    if (targetCount >= profileConfig.maxPerTable) {
      continue;
    }

    const block = buildContextBlock(result, accepted.length + relationLayer.length + 1);
    const blockChars = block.context_text.length;

    if (isRelationHeavy && profileConfig.excludeRelationHeavy) {
      if (includeRelationLayer && relationLayer.length < 3) {
        relationLayer.push({
          ...block,
          layer_role: 'relation',
        });
      }
      continue;
    }

    if (accepted.length >= profileConfig.maxBlocks) {
      continue;
    }

    if (contextChars + blockChars > profileConfig.maxContextChars) {
      continue;
    }

    accepted.push({
      ...block,
      layer_role: 'primary',
    });
    perTableCount.set(sourceKey, targetCount + 1);
    contextChars += blockChars;
  }

  if (accepted.length === 0 && results.length > 0) {
    for (const result of results.slice(0, Math.min(2, profileConfig.maxBlocks))) {
      const block = buildContextBlock(result, accepted.length + 1);
      accepted.push({
        ...block,
        layer_role: 'fallback',
      });
    }
  }

  return {
    profileConfig,
    primaryBlocks: accepted,
    relationBlocks: relationLayer,
  };
}

function assemblePromptContext({ query, contextBlocks, relationBlocks, mode }) {
  const primarySection = contextBlocks.length
    ? contextBlocks.map((block) => `${buildContextHeader(block)}\nContext:\n${block.context_text}`).join('\n\n---\n\n')
    : 'No primary context blocks matched.';

  const relationSection = relationBlocks.length
    ? relationBlocks.map((block) => `${buildContextHeader(block)}\nRelation Layer:\n${block.context_text}`).join('\n\n---\n\n')
    : '';

  const modePrefix = (() => {
    switch (mode) {
      case 'prompt_mutation':
        return 'Task Mode: prompt_mutation. Mutate and refine prompts using only the retrieved context.';
      case 'session_analysis':
        return 'Task Mode: session_analysis. Analyze sessions and workflow traces using only the retrieved context.';
      case 'mmss_operator_assist':
        return 'Task Mode: mmss_operator_assist. Explain MMSS operators, structures, and likely mappings using only the retrieved context.';
      case 'mmss_invariants':
        return 'Task Mode: mmss_invariants. Work only with MMSS invariants, ontology mappings, operator rules, and structured reusable evidence from the retrieved context.';
      case 'cross_db_reconciliation':
        return 'Task Mode: cross_db_reconciliation. Compare evidence across the active databases, keep provenance explicit, and identify alignment or conflict.';
      case 'json_prompt_extraction':
        return 'Task Mode: json_prompt_extraction. Extract structured JSON prompt fragments, schemas, and parameter blocks using only the retrieved context.';
      case 'source_audit':
        return 'Task Mode: source_audit. Audit provenance coverage, missing links, and evidence quality using only the retrieved context.';
      case 'ase_console_recipe':
        return 'Task Mode: ase_console_recipe. Build ASE Console style procedures and operator recipes using only the retrieved context.';
      default:
        return 'Task Mode: qa. Answer the user query using only the retrieved context.';
    }
  })();

  return [
    modePrefix,
    `User Query: ${query}`,
    '',
    'Primary Retrieved Context:',
    primarySection,
    relationSection ? `\nRelation Layer Context:\n${relationSection}` : '',
  ].filter(Boolean).join('\n');
}

async function buildPromptContext(options = {}) {
  const query = String(options.query || '').trim();
  if (!query) {
    throw new Error('Query is required');
  }

  const retrieval = await searchRag({
    database: options.database,
    query,
    topK: clampAnswerTopK(options.topK),
    sourceTables: options.sourceTables,
    sourceScopes: options.sourceScopes,
    queryBudget: options.queryBudget,
    mode: options.mode,
  });

  const filtered = applyPreliminaryFilters(retrieval.results, {
    filterProfile: options.filterProfile,
    includeRelationLayer: options.includeRelationLayer,
  });

  const promptContextText = assemblePromptContext({
    query,
    contextBlocks: filtered.primaryBlocks,
    relationBlocks: filtered.relationBlocks,
    mode: options.mode,
  });

  return {
    query,
    database: retrieval.database,
    sourceScopes: retrieval.sourceScopes,
    topK: retrieval.topK,
    queryBudget: retrieval.queryBudget,
    queryVariants: retrieval.queryVariants,
    embeddingModel: retrieval.embeddingModel,
    embeddingDimension: retrieval.embeddingDimension,
    filterProfile: String(options.filterProfile || 'balanced'),
    includeRelationLayer: options.includeRelationLayer === true,
    mode: String(options.mode || 'qa'),
    retrievalDebug: {
      totalRetrieved: retrieval.results.length,
      sourceScopeCount: retrieval.sourceScopes.length,
      queryVariantCount: retrieval.queryVariants.length,
      acceptedPrimary: filtered.primaryBlocks.length,
      acceptedRelation: filtered.relationBlocks.length,
      profileConfig: filtered.profileConfig,
    },
    contextBlocks: filtered.primaryBlocks,
    relationBlocks: filtered.relationBlocks,
    promptContextText,
    retrievedSources: [...filtered.primaryBlocks, ...filtered.relationBlocks].map((block) => ({
      database: block.database,
      source_table: block.source_table,
      source_id: block.source_id,
      source_title: block.source_title,
      similarity: block.similarity,
      layer_role: block.layer_role,
    })),
  };
}

async function answerWithRag(options = {}) {
  const contextBundle = await buildPromptContext(options);
  const startedAt = Date.now();
  const responseMaxChars = clampResponseMaxChars(options.responseMaxChars);
  const systemPrompt = String(options.systemPrompt || '').trim() || [
    'You are a local RAG assistant inside MMSS ASE Console.',
    'Use only the retrieved context provided to you.',
    'If the context is insufficient, say so explicitly.',
    'Do not invent sources or facts.',
    'When useful, cite source_table and source_id inline.',
    `Keep the final answer within ${responseMaxChars} characters.`,
  ].join(' ');

  const prompt = [
    contextBundle.promptContextText,
    '',
    'Instructions:',
    '- Answer only from the retrieved context.',
    '- Prefer concise, structured output.',
    '- Mention uncertainty when context is incomplete.',
    `- Keep the final answer within ${responseMaxChars} characters.`,
    '',
    `Final User Request: ${contextBundle.query}`,
  ].join('\n');

  const generation = await generateWithLocalModel({
    model: options.model || ANSWER_MODEL,
    prompt,
    systemPrompt,
    temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0,
    numCtx: Number.isFinite(Number(options.numCtx)) ? Number(options.numCtx) : 8192,
    numPredict: options.numPredict || estimateNumPredictForChars(responseMaxChars),
  });
  const answer = truncateText(generation.response, responseMaxChars);

  return {
    query: contextBundle.query,
    database: contextBundle.database,
    sourceScopes: contextBundle.sourceScopes,
    mode: contextBundle.mode,
    model: generation.model,
    filterProfile: contextBundle.filterProfile,
    includeRelationLayer: contextBundle.includeRelationLayer,
    queryBudget: contextBundle.queryBudget,
    queryVariants: contextBundle.queryVariants,
    answer,
    contextBlocks: contextBundle.contextBlocks,
    relationBlocks: contextBundle.relationBlocks,
    retrievedSources: contextBundle.retrievedSources,
    promptContextText: contextBundle.promptContextText,
    debug: {
      promptChars: prompt.length,
      contextChars: contextBundle.promptContextText.length,
      totalRetrieved: contextBundle.retrievalDebug.totalRetrieved,
      sourceScopeCount: contextBundle.retrievalDebug.sourceScopeCount,
      queryVariantCount: contextBundle.retrievalDebug.queryVariantCount,
      acceptedPrimary: contextBundle.retrievalDebug.acceptedPrimary,
      acceptedRelation: contextBundle.retrievalDebug.acceptedRelation,
      requestedAnswerMaxChars: responseMaxChars,
      answerChars: answer.length,
      generationDurationMs: Date.now() - startedAt,
      promptEvalCount: generation.promptEvalCount,
      evalCount: generation.evalCount,
      totalDuration: generation.totalDuration,
      loadDuration: generation.loadDuration,
      evalDuration: generation.evalDuration,
      embeddingModel: contextBundle.embeddingModel,
      embeddingDimension: contextBundle.embeddingDimension,
      profileConfig: contextBundle.retrievalDebug.profileConfig,
    },
  };
}

module.exports = {
  ANSWER_MODEL,
  EMBEDDING_MODEL,
  RAG_TABLE,
  answerWithRag,
  buildPromptContext,
  cancelJob,
  gatherStats,
  getEmbeddingDimension,
  getJobStatus,
  normalizeDatabaseIdentifier,
  searchRag,
  startVectorizationJob,
};
