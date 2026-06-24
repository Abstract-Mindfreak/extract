const crypto = require('crypto');
const { getPool } = require('../db');
const { logGenerationResult } = require('./mmssRuntimePersistenceService');

const OLLAMA_API_BASE = process.env.OLLAMA_API_BASE || 'http://127.0.0.1:11434/api';
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'embeddinggemma:300m';
const ANSWER_MODEL = process.env.RAG_ANSWER_MODEL || 'batiai/gemma4-e2b:q4';
const OLLAMA_EMBED_TIMEOUT_MS = Number(process.env.OLLAMA_EMBED_TIMEOUT_MS || 300000);
const OLLAMA_GENERATE_TIMEOUT_MS = Number(process.env.OLLAMA_GENERATE_TIMEOUT_MS || 600000);
const PRIMARY_DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const LEGACY_DATABASE = process.env.DB_NAME_V1 || 'abstract_mind_db';
const RAG_CHUNKS_DATABASE = process.env.RAG_CHUNKS_DB_NAME || 'rag_chunks_db';
const RAG_TABLE = 'rag_document_embeddings';
const JOB_TTL_MS = 1000 * 60 * 60 * 6;
const JSON_TEXT_LIMIT = 5000;
const MAX_JSON_FRAGMENTS = 80;
const jobs = new Map();
let embeddingDimensionPromise = null;

const SOURCE_DATABASE_TABLES = {
  [PRIMARY_DATABASE]: new Set([
    'tracks',
    'mmss_collection',
    'mmss_albums',
    'mmss_domain_patterns',
    'mmss_custom_instructions',
  ]),
  [LEGACY_DATABASE]: new Set([
    'music_blocks',
  ]),
};

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
  if (normalized === 'rag_chunks_db') {
    return RAG_CHUNKS_DATABASE;
  }
  if (normalized === PRIMARY_DATABASE || normalized === LEGACY_DATABASE || normalized === RAG_CHUNKS_DATABASE) {
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

function shouldEnforceResponseMaxChars(options = {}) {
  return options.enforceResponseMaxChars === true;
}

function isAlbumMode(mode) {
  return ['album_synthesis', 'album_concept', 'deep_worldbuilding'].includes(String(mode || '').trim());
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

function getAllowedSourceTables(databaseName) {
  return SOURCE_DATABASE_TABLES[databaseName] || new Set();
}

function filterRequestedTables(databaseName, requestedTables = []) {
  const allowed = getAllowedSourceTables(databaseName);
  if (!allowed.size) return [];
  return (Array.isArray(requestedTables) ? requestedTables : [])
    .map((tableName) => String(tableName || '').trim())
    .filter((tableName) => allowed.has(tableName));
}

function quoteIdentifier(identifier) {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  };
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

function extractPromptText(part) {
  const content = part?.content;
  if (typeof content === 'string') return content.trim();
  if (content && typeof content === 'object') {
    if (typeof content.prompt === 'string' && content.prompt.trim()) return content.prompt.trim();
    if (typeof content.sound_prompt === 'string' && content.sound_prompt.trim()) return content.sound_prompt.trim();
    if (typeof content.text === 'string' && content.text.trim()) return content.text.trim();
    return truncateText(stableStringify(content), 2000);
  }
  return '';
}

function matchesTrackGenerationMessage(message, trackId, trackTitle) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return parts.some((part) => {
    const args = part?.args || {};
    const content = part?.content || {};
    return args?.title === trackTitle
      || args?.output_title === trackTitle
      || args?.track_id === trackId
      || args?.result_clip_id === trackId
      || content?.track_id === trackId
      || content?.result_clip_id === trackId;
  });
}

function extractGenerationTail(rawData, trackId, trackTitle) {
  const messages = Array.isArray(rawData?.session_snapshot?.messages)
    ? rawData.session_snapshot.messages
    : [];
  if (!messages.length) {
    return {
      operation: rawData?.raw_track?.operation || rawData?.operation || null,
      userPrompt: null,
      toolCall: null,
      toolResult: null,
    };
  }

  let matchIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (matchesTrackGenerationMessage(messages[index], trackId, trackTitle)) {
      matchIndex = index;
      break;
    }
  }

  const tail = {
    operation: rawData?.raw_track?.operation || rawData?.operation || null,
    userPrompt: null,
    toolCall: null,
    toolResult: null,
  };

  if (matchIndex === -1) {
    return tail;
  }

  for (let index = matchIndex; index >= 0; index -= 1) {
    const message = messages[index];
    const parts = Array.isArray(message?.parts) ? message.parts : [];
    for (const part of parts) {
      if (!tail.toolResult && message?.kind === 'request' && part?.part_kind === 'tool-return') {
        const resultClipId = part?.content?.result_clip_id || part?.content?.track_id || null;
        if (!resultClipId || String(resultClipId) === String(trackId)) {
          tail.toolResult = part.content;
        }
      }

      if (!tail.toolCall && message?.kind === 'response' && part?.part_kind === 'tool-call') {
        const args = part?.args || {};
        if (
          args?.title === trackTitle
          || args?.output_title === trackTitle
          || args?.track_id === trackId
          || part?.tool_name === 'audio__create_song'
          || part?.tool_name === 'audio__apply_effect'
        ) {
          tail.toolCall = {
            tool_name: part.tool_name,
            args,
          };
        }
      }

      if (!tail.userPrompt && message?.kind === 'request' && part?.part_kind === 'user-prompt') {
        const promptText = extractPromptText(part);
        if (promptText && promptText !== '<ui-hidden>Conversation started</ui-hidden>') {
          tail.userPrompt = promptText;
        }
      }
    }

    if (tail.userPrompt && tail.toolCall && tail.toolResult) {
      break;
    }
  }

  return tail;
}

function compactFilteredEntry(row) {
  return {
    filtered_id: row.filtered_id,
    source_ref: row.source_ref,
    generation_insights: row.generation_insights,
    operator_trajectory: row.operator_trajectory,
    temporal_phases: row.temporal_phases,
    metric_v: row.metric_v,
    metric_s: row.metric_s,
    metric_d_f: row.metric_d_f,
    metric_r_t: row.metric_r_t,
    creative_choices: row.creative_choices,
    emergence_moments: row.emergence_moments,
    next_vector_suggestions: row.next_vector_suggestions,
    domain: row.domain,
    recursion_depth: row.recursion_depth,
    stability_flag: row.stability_flag,
    raw_payload: row.raw_payload || null,
  };
}

function compactCollectionEntry(row) {
  return {
    entry_id: row.entry_id,
    category: row.category,
    title: row.title,
    content: row.content,
    source_ref: row.source_ref,
    score: row.score,
    payload: row.payload || null,
  };
}

function buildTrackPayloadSummary(row, related = {}) {
  const raw = row.raw_data || {};
  const generationTail = extractGenerationTail(raw, row.id, row.title);

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
    conditions: row.conditions || null,
    lyrics_timestamped: row.lyrics_timestamped || null,
    generation_tail: generationTail,
    filtered: Array.isArray(related.filtered) ? related.filtered.map(compactFilteredEntry) : [],
    collection: Array.isArray(related.collection) ? related.collection.map(compactCollectionEntry) : [],
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
  const timeout = createTimeoutSignal(OLLAMA_EMBED_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_API_BASE.replace(/\/+$/, '')}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: timeout.signal,
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
  } catch (error) {
    const reason = error?.name === 'AbortError'
      ? `Ollama embed timeout after ${OLLAMA_EMBED_TIMEOUT_MS}ms`
      : (error?.message || error);
    throw new Error(`Ollama embed request failed. endpoint=${OLLAMA_API_BASE}/embed. reason=${reason}`);
  } finally {
    timeout.cancel();
  }
}

async function generateWithLocalModel({
  model,
  prompt,
  systemPrompt,
  temperature = 0,
  numCtx = 8192,
  numPredict,
  format,
}) {
  const numericPredict = Number(numPredict);
  const options = {
    temperature,
    num_ctx: numCtx,
  };
  if (Number.isFinite(numericPredict) && numericPredict > 0) {
    options.num_predict = Math.max(64, Math.floor(numericPredict));
  }
  const timeout = createTimeoutSignal(OLLAMA_GENERATE_TIMEOUT_MS);
  const decoder = new TextDecoder();
  let responseText = '';
  let lastPayload = null;

  try {
    const response = await fetch(`${OLLAMA_API_BASE.replace(/\/+$/, '')}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: timeout.signal,
      body: JSON.stringify({
        model: model || ANSWER_MODEL,
        prompt,
        system: systemPrompt,
        stream: true,
        format: format || undefined,
        options,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Ollama generate failed: HTTP ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Ollama generate returned no readable stream');
    }

    const reader = response.body.getReader();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let payload;
        try {
          payload = JSON.parse(trimmed);
        } catch (_error) {
          continue;
        }
        lastPayload = payload;
        if (typeof payload.response === 'string') {
          responseText += payload.response;
        }
      }
    }
    const tail = decoder.decode();
    if (tail) {
      buffer += tail;
    }
    if (buffer.trim()) {
      try {
        const payload = JSON.parse(buffer.trim());
        lastPayload = payload;
        if (typeof payload.response === 'string') {
          responseText += payload.response;
        }
      } catch (_error) {
        // Ignore broken tail; partial text is already captured.
      }
    }

    return {
      model: lastPayload?.model || model || ANSWER_MODEL,
      response: String(responseText || '').trim(),
      partial: false,
      promptEvalCount: lastPayload?.prompt_eval_count ?? null,
      evalCount: lastPayload?.eval_count ?? null,
      totalDuration: lastPayload?.total_duration ?? null,
      loadDuration: lastPayload?.load_duration ?? null,
      evalDuration: lastPayload?.eval_duration ?? null,
    };
  } catch (error) {
    if (responseText.trim()) {
      return {
        model: lastPayload?.model || model || ANSWER_MODEL,
        response: String(responseText || '').trim(),
        partial: true,
        partialError: error?.name === 'AbortError'
          ? `Ollama generate timeout after ${OLLAMA_GENERATE_TIMEOUT_MS}ms`
          : (error?.message || String(error)),
        promptEvalCount: lastPayload?.prompt_eval_count ?? null,
        evalCount: lastPayload?.eval_count ?? null,
        totalDuration: lastPayload?.total_duration ?? null,
        loadDuration: lastPayload?.load_duration ?? null,
        evalDuration: lastPayload?.eval_duration ?? null,
      };
    }
    const reason = error?.name === 'AbortError'
      ? `Ollama generate timeout after ${OLLAMA_GENERATE_TIMEOUT_MS}ms`
      : (error?.message || error);
    throw new Error(`Ollama generate request failed. endpoint=${OLLAMA_API_BASE}/generate. reason=${reason}`);
  } finally {
    timeout.cancel();
  }
}

async function getEmbeddingDimension() {
  if (!embeddingDimensionPromise) {
    embeddingDimensionPromise = (async () => {
      try {
        const embeddings = await embedTexts(['dimension probe']);
        const dimension = Array.isArray(embeddings[0]) ? embeddings[0].length : 0;
        if (!dimension) {
          throw new Error('Failed to detect embedding dimension');
        }
        return dimension;
      } catch (error) {
        // A failed probe must not poison the process forever.
        embeddingDimensionPromise = null;
        throw error;
      }
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

function buildTrackDocument(row, related = {}) {
  const snapshot = buildTrackPayloadSummary(row, related);
  const filteredSummaries = (snapshot.filtered || []).map((entry) => [
    entry.domain,
    entry.generation_insights,
    entry.operator_trajectory,
    entry.temporal_phases,
    entry.creative_choices,
    entry.next_vector_suggestions,
  ].filter(Boolean).join(' | '));
  const collectionSummaries = (snapshot.collection || []).map((entry) => [
    entry.title,
    entry.category,
    entry.content,
  ].filter(Boolean).join(' | '));
  const text = truncateText(stableStringify({
    title: snapshot.title,
    prompt: snapshot.prompt,
    session_id: snapshot.session_id,
    generation_tail: snapshot.generation_tail,
    filtered: snapshot.filtered,
    collection: snapshot.collection.map((entry) => ({
      entry_id: entry.entry_id,
      category: entry.category,
      title: entry.title,
      source_ref: entry.source_ref,
      score: entry.score,
    })),
    filtered_summaries: filteredSummaries,
    collection_summaries: collectionSummaries,
  }), 24000);

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
      filtered_count: String(snapshot.filtered.length),
      collection_count: String(snapshot.collection.length),
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

function buildRagChunkDocument(row) {
  let parsedChunk = null;
  try {
    parsedChunk = typeof row.chunk_text === 'string' ? JSON.parse(row.chunk_text) : row.chunk_text;
  } catch {
    parsedChunk = row.chunk_text;
  }

  const textFragments = [
    row.title,
    row.description,
    row.category,
    row.domain,
    Array.isArray(row.tags) ? row.tags.join(', ') : null,
    typeof parsedChunk === 'string'
      ? parsedChunk
      : stableStringify(parsedChunk),
  ].filter(Boolean);

  return {
    sourceTable: 'rag_chunks',
    sourceId: String(row.id || row.chunk_hash || buildHash(stableStringify(row))),
    sourceTitle: row.title || row.category || row.domain || row.id,
    chunkText: truncateText(textFragments.join('\n\n'), JSON_TEXT_LIMIT),
    sourcePayload: {
      id: row.id,
      source_table: row.source_table,
      source_id: row.source_id,
      source_database: row.source_database,
      tags: row.tags,
      category: row.category,
      domain: row.domain,
      title: row.title,
      description: row.description,
      chunk_hash: row.chunk_hash,
      parsed_chunk: parsedChunk,
    },
    metadata: {
      source_table: row.source_table,
      source_id: row.source_id,
      source_database: row.source_database,
      tags: row.tags || [],
      category: row.category || null,
      domain: row.domain || null,
      chunk_hash: row.chunk_hash || null,
      created_at: row.created_at || null,
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

async function loadTrackRelatedContext(databaseName, trackIds = []) {
  const ids = Array.from(new Set((Array.isArray(trackIds) ? trackIds : []).map((value) => String(value || '').trim()).filter(Boolean)));
  const context = new Map(ids.map((id) => [id, { filtered: [], collection: [] }]));
  if (!ids.length) return context;

  if (await tableExists(databaseName, 'mmss_filtered')) {
    const filtered = await getPool(databaseName).query(`
      SELECT *
      FROM mmss_filtered
      WHERE track_id = ANY($1)
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [ids]);
    for (const row of filtered.rows) {
      const key = String(row.track_id || '').trim();
      if (!context.has(key)) continue;
      context.get(key).filtered.push(row);
    }
  }

  if (await tableExists(databaseName, 'mmss_collection')) {
    const collection = await getPool(databaseName).query(`
      SELECT *
      FROM mmss_collection
      WHERE payload->>'track_id' = ANY($1)
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [ids]);
    for (const row of collection.rows) {
      const key = String(row?.payload?.track_id || '').trim();
      if (!context.has(key)) continue;
      context.get(key).collection.push(row);
    }
  }

  return context;
}

async function loadSourceDocuments(databaseName, requestedTables = []) {
  const allowed = getAllowedSourceTables(databaseName);
  const selected = new Set(filterRequestedTables(databaseName, requestedTables));
  const docs = [];
  const handledTables = new Set();

  const canUse = (tableName) => allowed.has(tableName) && (selected.size === 0 || selected.has(tableName));

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
    const relatedContext = await loadTrackRelatedContext(databaseName, result.rows.map((row) => row.id));
    docs.push(...result.rows.map((row) => buildTrackDocument(row, relatedContext.get(String(row.id)) || {})).filter((doc) => doc.chunkText));
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

function buildCompactAlbumContext(block, mode) {
  const text = String(block?.context_text || '');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const picked = [];
  const sourceTable = String(block?.source_table || '').trim().toLowerCase();
  const allowTrackRefs = mode !== 'album_synthesis' && mode !== 'album_concept';
  const allowTitle = sourceTable !== 'mmss_albums' || (mode !== 'album_synthesis' && mode !== 'album_concept');
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (
      (allowTitle && lower.startsWith('title:')) ||
      lower.startsWith('description:') ||
      lower.startsWith('domain:') ||
      (allowTrackRefs && lower.startsWith('track_refs:')) ||
      lower.startsWith('instruction_text:') ||
      lower.startsWith('instruction_refs:') ||
      lower.startsWith('content:')
    ) {
      picked.push(line);
    }
    if (picked.length >= 6) break;
  }

  if (!picked.length) {
    return truncateText(text, 700);
  }
  return truncateText(picked.join('\n'), 900);
}

function compactBlocksForMode(blocks, mode) {
  if (!isAlbumMode(mode)) {
    return blocks;
  }

  return (blocks || []).map((block) => ({
    ...block,
    context_text: buildCompactAlbumContext(block, mode),
  }));
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
  const compactPrimaryBlocks = compactBlocksForMode(contextBlocks, mode);
  const compactRelationBlocks = compactBlocksForMode(relationBlocks, mode);
  const primarySection = compactPrimaryBlocks.length
    ? compactPrimaryBlocks.map((block) => `${buildContextHeader(block)}\nContext:\n${block.context_text}`).join('\n\n---\n\n')
    : 'No primary context blocks matched.';

  const relationSection = compactRelationBlocks.length
    ? compactRelationBlocks.map((block) => `${buildContextHeader(block)}\nRelation Layer:\n${block.context_text}`).join('\n\n---\n\n')
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
      case 'contextual_summarization':
        return 'Task Mode: contextual_summarization. Produce a smart summary that preserves domain-specific detail, structure, and technical context using only the retrieved evidence.';
      case 'knowledge_synthesis':
        return 'Task Mode: knowledge_synthesis. Synthesize a grounded answer from fragmented sources, combining multiple evidence blocks without inventing unsupported facts.';
      case 'skill_tree_pathfinding':
        return 'Task Mode: skill_tree_pathfinding. Determine the most relevant path through skill tree knowledge and retrieval evidence for the current task.';
      case 'skill_chain_orchestration':
        return 'Task Mode: skill_chain_orchestration. Propose a sequence of reusable skills and execution stages grounded only in the retrieved context.';
      case 'skill_gap_analysis':
        return 'Task Mode: skill_gap_analysis. Identify missing skills, weak branches, or incomplete runtime coverage from the retrieved MMSS context.';
      case 'track_variation':
        return 'Task Mode: track_variation. Create several grounded track or session variations while preserving the core identity and vibe from the retrieved context.';
      case 'style_fusion':
        return 'Task Mode: style_fusion. Combine separate stylistic evidence streams into one hybrid style proposal using only retrieved material.';
      case 'prompt_evolution':
        return 'Task Mode: prompt_evolution. Iteratively analyze, expand, and optimize prompts for audio generation using only retrieved evidence and constraints.';
      case 'parameter_shift':
        return 'Task Mode: parameter_shift. Change BPM, tonality, or technical parameters while preserving the original vibe grounded in retrieved context.';
      case 'session_digest':
        return 'Task Mode: session_digest. Distill a long session or dense metadata set into a compact but information-rich summary using only retrieved evidence.';
      case 'vibe_extraction':
        return 'Task Mode: vibe_extraction. Extract moods, abstractions, visual associations, and latent aesthetic cues from retrieved material.';
      case 'pattern_mining':
        return 'Task Mode: pattern_mining. Detect recurring successful patterns, combinations, and high-value structures in the retrieved data.';
      case 'tag_enrichment':
        return 'Task Mode: tag_enrichment. Generate normalized, taxonomy-aware tags grounded in retrieved prompts, sessions, and domain evidence.';
      case 'similarity_audit':
        return 'Task Mode: similarity_audit. Compare the idea against retrieved references to detect duplicates, loops, overlap, or loss of novelty.';
      case 'concept_ideation':
        return 'Task Mode: concept_ideation. Generate a full creative concept including story, visual aesthetic, and sound palette from retrieved context.';
      case 'album_synthesis':
        return 'Task Mode: album_synthesis. Build a coherent album from retrieved MMSS fragments, prompts, instructions, sessions, and track evidence. Produce reusable album-level direction, track identity, and generation-ready structure.';
      case 'arrangement_blueprint':
        return 'Task Mode: arrangement_blueprint. Build a structural map of the track with sections, timing, and evolving elements using retrieved evidence.';
      case 'soundscape_design':
        return 'Task Mode: soundscape_design. Design the ambient, spatial, and textural environment using only the retrieved source material.';
      case 'album_concept':
        return 'Task Mode: album_concept. Build a coherent album-scale concept, tracklist, and per-track direction using retrieved context only.';
      case 'deep_worldbuilding':
        return 'Task Mode: deep_worldbuilding. Build lore, universe rules, and audio-visual narrative links from retrieved MMSS context.';
      case 'pattern_recognition':
        return 'Task Mode: pattern_recognition. Recognize latent patterns in prompts, sessions, metadata, and generation outcomes using only retrieved evidence.';
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
  const albumMode = isAlbumMode(contextBundle.mode);
  const enforceResponseMaxChars = shouldEnforceResponseMaxChars(options) || albumMode;
  const responseMaxChars = clampResponseMaxChars(options.responseMaxChars);
  const systemPrompt = String(options.systemPrompt || '').trim() || [
    'You are a local RAG assistant inside MMSS ASE Console.',
    'Use only the retrieved context provided to you.',
    'If the context is insufficient, say so explicitly.',
    'Do not invent sources or facts.',
    'When useful, cite source_table and source_id inline.',
    'Do not echo or restate the user request unless strictly necessary.',
    'Start directly with the synthesized answer.',
    'Do not spend output budget on preamble, politeness, or reformulating the request.',
    'Prioritize synthesis, cross-source reconciliation, extracted facts, and actionable structure.',
    ...(albumMode ? [
      'For album-oriented modes, return strict JSON only.',
      'Do not add markdown fences, commentary, or explanatory text outside JSON.',
      'The JSON must be immediately parseable.',
    ] : []),
    ...(enforceResponseMaxChars ? [`Keep the final answer within ${responseMaxChars} characters.`] : []),
  ].join(' ');

  const promptInstructions = albumMode
    ? [
      '- Return strict JSON only.',
      '- Do not repeat the request.',
      '- Do not output markdown fences.',
      '- Create a new album draft instead of copying any retrieved album record.',
      '- Never reuse an existing retrieved album title verbatim unless the user explicitly asked for a remake or continuation.',
      '- Never reuse a retrieved track list verbatim.',
      '- Treat retrieved albums as style references, not as templates to duplicate.',
      '- Use this schema exactly:',
      '{"album":{"title":"string","description":"string","domain":"string","tracks":[{"index":1,"title":"string","prompt":"string","operator_notes":"string","json_prompt":{"prompt":"string","negative_prompt":"string","style_tags":["string"],"tools":["string"],"notes":"string"}}]}}',
      '- Keep each track prompt specific, generation-ready, and distinct.',
      '- Prefer 8-10 tracks unless the context clearly supports a smaller form.',
      '- Use retrieved evidence to ground style, operators, tags, and tools.',
      ...(enforceResponseMaxChars ? [`- Keep the final JSON within ${responseMaxChars} characters.`] : []),
    ]
    : [
      '- Answer only from the retrieved context.',
      '- Prefer concise, structured output.',
      '- Mention uncertainty when context is incomplete.',
      '- Do not repeat the question back to the user.',
      '- Do not copy the request wording into the answer.',
      '- Spend the response budget on synthesis and evidence, not restatement.',
      '- When multiple sources agree, merge them into one conclusion instead of listing duplicates.',
      ...(enforceResponseMaxChars ? [`- Keep the final answer within ${responseMaxChars} characters.`] : []),
    ];

  const prompt = [
    contextBundle.promptContextText,
    '',
    'Instructions:',
    ...promptInstructions,
    '',
    `Final User Request: ${contextBundle.query}`,
  ].join('\n');

  const effectiveNumPredict = Number.isFinite(Number(options.numPredict)) && Number(options.numPredict) > 0
    ? Number(options.numPredict)
    : (enforceResponseMaxChars ? estimateNumPredictForChars(responseMaxChars) : 8192);

  const generation = await generateWithLocalModel({
    model: options.model || ANSWER_MODEL,
    prompt,
    systemPrompt,
    temperature: Number.isFinite(Number(options.temperature)) ? Number(options.temperature) : 0,
    numCtx: Number.isFinite(Number(options.numCtx)) ? Number(options.numCtx) : 8192,
    numPredict: effectiveNumPredict,
    format: albumMode ? 'json' : undefined,
  });
  const answer = enforceResponseMaxChars
    ? truncateText(generation.response, responseMaxChars)
    : String(generation.response || '').trim();

  const payload = {
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
    promptContextText: truncateText(contextBundle.promptContextText, albumMode ? 1800 : 6000),
    debug: {
      promptChars: prompt.length,
      contextChars: contextBundle.promptContextText.length,
      totalRetrieved: contextBundle.retrievalDebug.totalRetrieved,
      sourceScopeCount: contextBundle.retrievalDebug.sourceScopeCount,
      queryVariantCount: contextBundle.retrievalDebug.queryVariantCount,
      acceptedPrimary: contextBundle.retrievalDebug.acceptedPrimary,
      acceptedRelation: contextBundle.retrievalDebug.acceptedRelation,
      requestedAnswerMaxChars: enforceResponseMaxChars ? responseMaxChars : null,
      enforceResponseMaxChars,
      answerChars: answer.length,
      partial: generation.partial === true,
      partialError: generation.partialError || null,
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

  const shouldLogMmssResult = [
    'mmss_operator_assist',
    'mmss_invariants',
    'ase_console_recipe',
    'contextual_summarization',
    'knowledge_synthesis',
    'skill_tree_pathfinding',
    'skill_chain_orchestration',
    'skill_gap_analysis',
    'track_variation',
    'style_fusion',
    'prompt_evolution',
    'parameter_shift',
    'session_digest',
    'vibe_extraction',
    'pattern_mining',
    'tag_enrichment',
    'similarity_audit',
    'concept_ideation',
    'album_synthesis',
    'arrangement_blueprint',
    'soundscape_design',
    'album_concept',
    'deep_worldbuilding',
    'pattern_recognition',
  ].includes(String(contextBundle.mode || ''));

  if (shouldLogMmssResult) {
    try {
      await logGenerationResult(contextBundle.database, {
        mode: contextBundle.mode,
        model: generation.model,
        query: contextBundle.query,
        answer,
        sourceScopes: contextBundle.sourceScopes,
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
          requestedAnswerMaxChars: enforceResponseMaxChars ? responseMaxChars : null,
          enforceResponseMaxChars,
          answerChars: answer.length,
          partial: generation.partial === true,
          partialError: generation.partialError || null,
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
        metadata: {
          operation: 'rag_answer',
          origin: 'answerWithRag',
        },
      });
    } catch (_error) {
      // Logging failures must not break the main RAG answer flow.
    }
  }

  return payload;
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
