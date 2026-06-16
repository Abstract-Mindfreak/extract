const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getPool } = require('../db');
const { normalizeDatabaseIdentifier } = require('./localRagService');

const ROOT_DIR = path.join(__dirname, '..', '..', '..');
const BRIDGE_SCRIPT = path.join(__dirname, 'mmss_invariants_bridge.py');
const SEED_PATH = path.join(ROOT_DIR, 'database', 'seeds', 'mmss_ontology_seed.json');
const MMSS_INVARIANTS_TABLE = 'mmss_invariants';
const MMSS_PHASE_PATTERNS_TABLE = 'mmss_phase_patterns';
const MMSS_DOMAIN_PATTERNS_TABLE = 'mmss_domain_patterns';
const JOB_TTL_MS = 1000 * 60 * 60 * 6;
const MAX_TEXT_LENGTH = 24000;
const jobs = new Map();

function createJobId() {
  return `mmss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampBatchSize(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 20;
  return Math.max(1, Math.min(50, Math.floor(numeric)));
}

function stableStringify(value) {
  try {
    return JSON.stringify(sanitizeForJson(value));
  } catch {
    return String(value);
  }
}

function sanitizeString(value) {
  return String(value || '').replace(/[\uD800-\uDFFF]/g, '');
}

function sanitizeForJson(value) {
  if (typeof value === 'string') {
    return sanitizeString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForJson(item));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeForJson(entry)]),
    );
  }
  return value;
}

function truncateText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = sanitizeString(value).trim();
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

function buildHash(text) {
  return crypto.createHash('sha1').update(String(text || '')).digest('hex');
}

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.startedAtMs > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

function readSeedFile() {
  return JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
}

async function ensureSchema(databaseName) {
  const client = await getPool(databaseName).connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_PHASE_PATTERNS_TABLE} (
        pattern_key TEXT PRIMARY KEY,
        operator_id TEXT NOT NULL,
        display_name TEXT,
        group_name TEXT,
        keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
        markers JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        seed_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_DOMAIN_PATTERNS_TABLE} (
        pattern_key TEXT PRIMARY KEY,
        domain_id TEXT NOT NULL,
        display_name TEXT,
        keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
        markers JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes TEXT,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        seed_version TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_INVARIANTS_TABLE} (
        invariant_key TEXT PRIMARY KEY,
        source_database TEXT NOT NULL,
        source_table TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_title TEXT,
        extractor TEXT NOT NULL DEFAULT 'omega_offline_agent',
        domain TEXT NOT NULL DEFAULT 'generic',
        content_hash TEXT NOT NULL,
        source_text TEXT NOT NULL,
        sequence_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,
        phase_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
        palette JSONB NOT NULL DEFAULT '[]'::jsonb,
        coordinates JSONB NOT NULL DEFAULT '[]'::jsonb,
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        validation JSONB NOT NULL DEFAULT '{}'::jsonb,
        corrections_applied JSONB NOT NULL DEFAULT '[]'::jsonb,
        raw_result JSONB NOT NULL DEFAULT '{}'::jsonb,
        source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        vectorized BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (source_database, source_table, source_id, extractor)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_INVARIANTS_TABLE}_source
      ON ${MMSS_INVARIANTS_TABLE} (source_database, source_table, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_INVARIANTS_TABLE}_vectorized
      ON ${MMSS_INVARIANTS_TABLE} (vectorized, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_INVARIANTS_TABLE}_metadata
      ON ${MMSS_INVARIANTS_TABLE}
      USING GIN (metadata);
    `);
  } finally {
    client.release();
  }
}

function buildTrackText(row) {
  return truncateText([
    row.title,
    row.prompt,
    row.negative_prompt,
    row.generation_mode,
    row.transform_type,
    row.model_name,
    row.video_prompt,
    stableStringify(row.raw_data),
    stableStringify(row.conditions),
    stableStringify(row.lyrics_timestamped),
  ].filter(Boolean).join('\n\n'));
}

function buildSessionText(row) {
  return truncateText([
    row.title,
    stableStringify(row.config),
    stableStringify(row.ai_snapshot),
  ].filter(Boolean).join('\n\n'));
}

function buildMusicBlockText(row) {
  return truncateText([
    row.name,
    row.slug,
    row.block_type,
    row.layer,
    stableStringify(row.content),
  ].filter(Boolean).join('\n\n'));
}

function mapTrackRow(databaseName, row) {
  return {
    sourceDatabase: databaseName,
    sourceTable: 'tracks',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    sourcePayload: {
      id: row.id,
      title: row.title,
      session_id: row.session_id,
      has_video: row.has_video,
      created_at: row.created_at,
    },
    domain: 'process',
    sourceText: buildTrackText(row),
    metadata: {
      generation_mode: row.generation_mode,
      transform_type: row.transform_type,
      model_name: row.model_name,
      has_video: row.has_video,
      session_id: row.session_id,
      source_kind: 'track',
    },
  };
}

function mapSessionRow(databaseName, row) {
  return {
    sourceDatabase: databaseName,
    sourceTable: 'sessions',
    sourceId: String(row.id),
    sourceTitle: row.title || row.id,
    sourcePayload: {
      id: row.id,
      title: row.title,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
    domain: 'process',
    sourceText: buildSessionText(row),
    metadata: {
      source_kind: 'session',
      updated_at: row.updated_at,
    },
  };
}

function mapMusicBlockRow(databaseName, row) {
  return {
    sourceDatabase: databaseName,
    sourceTable: 'music_blocks',
    sourceId: String(row.id),
    sourceTitle: row.name || row.slug || row.id,
    sourcePayload: {
      id: row.id,
      block_type: row.block_type,
      layer: row.layer,
      slug: row.slug,
      name: row.name,
    },
    domain: 'code',
    sourceText: buildMusicBlockText(row),
    metadata: {
      source_kind: 'music_block',
      block_type: row.block_type,
      layer: row.layer,
      slug: row.slug,
    },
  };
}

async function tableExists(databaseName, tableName) {
  const result = await getPool(databaseName).query(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    [`public.${tableName}`],
  );
  return Boolean(result.rows[0]?.exists);
}

async function loadSourceRecords(databaseName, requestedTables = []) {
  const selected = new Set((Array.isArray(requestedTables) ? requestedTables : []).filter(Boolean));
  const canUse = (tableName) => selected.size === 0 || selected.has(tableName);
  const records = [];

  if (canUse('tracks') && await tableExists(databaseName, 'tracks')) {
    const result = await getPool(databaseName).query(`
      SELECT id, title, prompt, negative_prompt, generation_mode, transform_type, model_name,
             video_prompt, session_id, has_video, created_at, raw_data, conditions, lyrics_timestamped
      FROM tracks
      WHERE COALESCE(prompt, '') <> ''
         OR raw_data IS NOT NULL
         OR conditions IS NOT NULL
         OR lyrics_timestamped IS NOT NULL
      ORDER BY created_at DESC NULLS LAST
    `);
    records.push(...result.rows.map((row) => mapTrackRow(databaseName, row)).filter((row) => row.sourceText));
  }

  if (canUse('sessions') && await tableExists(databaseName, 'sessions')) {
    const result = await getPool(databaseName).query(`
      SELECT id, title, ai_snapshot, config, created_at, updated_at
      FROM sessions
      WHERE ai_snapshot IS NOT NULL OR config IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
    `);
    records.push(...result.rows.map((row) => mapSessionRow(databaseName, row)).filter((row) => row.sourceText));
  }

  if (canUse('music_blocks') && await tableExists(databaseName, 'music_blocks')) {
    const result = await getPool(databaseName).query(`
      SELECT id, block_type, layer, slug, name, content
      FROM music_blocks
      WHERE content IS NOT NULL
      ORDER BY layer ASC, slug ASC
    `);
    records.push(...result.rows.map((row) => mapMusicBlockRow(databaseName, row)).filter((row) => row.sourceText));
  }

  return records;
}

function runBridgeBatch(items) {
  return new Promise((resolve, reject) => {
    const child = spawn('python', [BRIDGE_SCRIPT], {
      cwd: ROOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python bridge exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout || '{}'));
      } catch (error) {
        reject(new Error(`Failed to parse Python bridge JSON: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify({ items }));
    child.stdin.end();
  });
}

function normalizeInvariantRow(record, analysis) {
  const rawResult = analysis?.result || {};
  const invariantKey = buildHash([
    record.sourceDatabase,
    record.sourceTable,
    record.sourceId,
    record.sourceText,
    analysis?.domain || record.domain || 'generic',
  ].join('::'));

  return {
    invariantKey,
    sourceDatabase: record.sourceDatabase,
    sourceTable: record.sourceTable,
    sourceId: record.sourceId,
    sourceTitle: sanitizeString(record.sourceTitle),
    extractor: 'omega_offline_agent',
    domain: analysis?.domain || record.domain || 'generic',
    contentHash: buildHash(record.sourceText),
    sourceText: sanitizeString(record.sourceText),
    sequenceSymbols: rawResult.sequence || [],
    phaseMatches: rawResult.phase_matches || [],
    palette: rawResult.palette || [],
    coordinates: rawResult.coordinates || [],
    metrics: {
      D_metric: rawResult.D_metric ?? null,
      rho_values: rawResult.rho_values || [],
      sigma_values: rawResult.sigma_values || [],
      stability_flag: rawResult.stability_flag ?? false,
    },
    validation: rawResult.validation || {},
    correctionsApplied: rawResult.corrections_applied || [],
    rawResult: sanitizeForJson(rawResult),
    sourcePayload: sanitizeForJson(record.sourcePayload || {}),
    metadata: {
      ...sanitizeForJson(record.metadata || {}),
      source_title: sanitizeString(record.sourceTitle || ''),
      phase_operator_ids: Array.isArray(rawResult.phase_matches)
        ? rawResult.phase_matches.map((item) => item?.operator_id).filter(Boolean)
        : [],
      stability_flag: rawResult.stability_flag ?? false,
    },
  };
}

async function upsertInvariantBatch(databaseName, rows) {
  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      await client.query(`
        INSERT INTO ${MMSS_INVARIANTS_TABLE} (
          invariant_key, source_database, source_table, source_id, source_title, extractor, domain,
          content_hash, source_text, sequence_symbols, phase_matches, palette, coordinates, metrics,
          validation, corrections_applied, raw_result, source_payload, metadata, vectorized, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb,
          $15::jsonb, $16::jsonb, $17::jsonb, $18::jsonb, $19::jsonb, FALSE, NOW()
        )
        ON CONFLICT (source_database, source_table, source_id, extractor)
        DO UPDATE SET
          invariant_key = EXCLUDED.invariant_key,
          source_title = EXCLUDED.source_title,
          domain = EXCLUDED.domain,
          content_hash = EXCLUDED.content_hash,
          source_text = EXCLUDED.source_text,
          sequence_symbols = EXCLUDED.sequence_symbols,
          phase_matches = EXCLUDED.phase_matches,
          palette = EXCLUDED.palette,
          coordinates = EXCLUDED.coordinates,
          metrics = EXCLUDED.metrics,
          validation = EXCLUDED.validation,
          corrections_applied = EXCLUDED.corrections_applied,
          raw_result = EXCLUDED.raw_result,
          source_payload = EXCLUDED.source_payload,
          metadata = EXCLUDED.metadata,
          vectorized = FALSE,
          updated_at = NOW()
      `, [
        row.invariantKey,
        row.sourceDatabase,
        row.sourceTable,
        row.sourceId,
        row.sourceTitle,
        row.extractor,
        row.domain,
        row.contentHash,
        row.sourceText,
        JSON.stringify(sanitizeForJson(row.sequenceSymbols || [])),
        JSON.stringify(sanitizeForJson(row.phaseMatches || [])),
        JSON.stringify(sanitizeForJson(row.palette || [])),
        JSON.stringify(sanitizeForJson(row.coordinates || [])),
        JSON.stringify(sanitizeForJson(row.metrics || {})),
        JSON.stringify(sanitizeForJson(row.validation || {})),
        JSON.stringify(sanitizeForJson(row.correctionsApplied || [])),
        JSON.stringify(sanitizeForJson(row.rawResult || {})),
        JSON.stringify(sanitizeForJson(row.sourcePayload || {})),
        JSON.stringify(sanitizeForJson(row.metadata || {})),
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncOntologySeed(databaseName) {
  await ensureSchema(databaseName);
  const seed = readSeedFile();
  const phasePatterns = Array.isArray(seed?.phase_patterns) ? seed.phase_patterns : [];
  const domainPatterns = Array.isArray(seed?.domain_patterns) ? seed.domain_patterns : [];
  const seedVersion = String(seed?.version || 'unknown');
  const client = await getPool(databaseName).connect();

  try {
    await client.query('BEGIN');
    const phaseKeys = phasePatterns.map((pattern) => `phase:${String(pattern.operator_id || 'unknown')}`);
    const domainKeys = domainPatterns.map((pattern) => `domain:${String(pattern.operator_id || pattern.domain_id || pattern.name || 'unknown')}`);

    await client.query(
      `DELETE FROM ${MMSS_PHASE_PATTERNS_TABLE} WHERE seed_version = $1 AND NOT (pattern_key = ANY($2))`,
      [seedVersion, phaseKeys],
    );
    await client.query(
      `DELETE FROM ${MMSS_DOMAIN_PATTERNS_TABLE} WHERE seed_version = $1 AND NOT (pattern_key = ANY($2))`,
      [seedVersion, domainKeys],
    );

    for (const pattern of phasePatterns) {
      const key = `phase:${String(pattern.operator_id || 'unknown')}`;
      await client.query(`
        INSERT INTO ${MMSS_PHASE_PATTERNS_TABLE} (
          pattern_key, operator_id, display_name, group_name, keywords, markers, notes, raw_payload, seed_version, updated_at
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9, NOW())
        ON CONFLICT (pattern_key)
        DO UPDATE SET
          operator_id = EXCLUDED.operator_id,
          display_name = EXCLUDED.display_name,
          group_name = EXCLUDED.group_name,
          keywords = EXCLUDED.keywords,
          markers = EXCLUDED.markers,
          notes = EXCLUDED.notes,
          raw_payload = EXCLUDED.raw_payload,
          seed_version = EXCLUDED.seed_version,
          updated_at = NOW()
      `, [
        key,
        pattern.operator_id,
        pattern.display_name || pattern.operator_id,
        pattern.group || null,
        JSON.stringify(pattern.keywords || []),
        JSON.stringify(pattern.markers || []),
        pattern.notes || null,
        JSON.stringify(sanitizeForJson(pattern)),
        seedVersion,
      ]);
    }

    for (const pattern of domainPatterns) {
      const domainId = pattern.operator_id || pattern.domain_id || pattern.name || 'unknown';
      const key = `domain:${String(domainId)}`;
      await client.query(`
        INSERT INTO ${MMSS_DOMAIN_PATTERNS_TABLE} (
          pattern_key, domain_id, display_name, keywords, markers, notes, raw_payload, seed_version, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb, $8, NOW())
        ON CONFLICT (pattern_key)
        DO UPDATE SET
          domain_id = EXCLUDED.domain_id,
          display_name = EXCLUDED.display_name,
          keywords = EXCLUDED.keywords,
          markers = EXCLUDED.markers,
          notes = EXCLUDED.notes,
          raw_payload = EXCLUDED.raw_payload,
          seed_version = EXCLUDED.seed_version,
          updated_at = NOW()
      `, [
        key,
        domainId,
        pattern.display_name || pattern.name || domainId,
        JSON.stringify(pattern.keywords || []),
        JSON.stringify(pattern.markers || []),
        pattern.notes || null,
        JSON.stringify(sanitizeForJson(pattern)),
        seedVersion,
      ]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    seedVersion,
    phasePatterns: phasePatterns.length,
    domainPatterns: domainPatterns.length,
  };
}

async function gatherStats(databaseName) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT
      (SELECT COUNT(*)::int FROM ${MMSS_PHASE_PATTERNS_TABLE}) AS phase_pattern_count,
      (SELECT COUNT(*)::int FROM ${MMSS_DOMAIN_PATTERNS_TABLE}) AS domain_pattern_count,
      (SELECT COUNT(*)::int FROM ${MMSS_INVARIANTS_TABLE}) AS invariant_count,
      (SELECT COUNT(*)::int FROM ${MMSS_INVARIANTS_TABLE} WHERE vectorized = TRUE) AS vectorized_count,
      (SELECT MAX(updated_at) FROM ${MMSS_INVARIANTS_TABLE}) AS last_invariant_updated_at
  `);
  const row = result.rows[0] || {};
  return {
    database: databaseName,
    phasePatternCount: row.phase_pattern_count || 0,
    domainPatternCount: row.domain_pattern_count || 0,
    invariantCount: row.invariant_count || 0,
    vectorizedCount: row.vectorized_count || 0,
    lastInvariantUpdatedAt: row.last_invariant_updated_at || null,
    activeJob: Array.from(jobs.values()).find((job) => job.database === databaseName && job.status === 'running') || null,
  };
}

async function runExtractionJob(job) {
  await ensureSchema(job.database);
  if (job.syncSeed) {
    job.lastStage = 'syncing_seed';
    job.seedSummary = await syncOntologySeed(job.database);
  }

  job.lastStage = 'loading_sources';
  const records = await loadSourceRecords(job.database, job.sourceTables);
  job.totalDocuments = records.length;

  for (let start = 0; start < records.length; start += job.batchSize) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
      return;
    }

    const batch = records.slice(start, start + job.batchSize);
    job.lastStage = 'analyzing_batch';
    const bridgePayload = await runBridgeBatch(batch.map((record) => ({
      id: `${record.sourceTable}:${record.sourceId}`,
      text: record.sourceText,
      domain: record.domain,
    })));

    const analyses = new Map((bridgePayload?.results || []).map((item) => [item.id, item]));
    const normalized = batch
      .map((record) => {
        const analysis = analyses.get(`${record.sourceTable}:${record.sourceId}`);
        return analysis ? normalizeInvariantRow(record, analysis) : null;
      })
      .filter(Boolean);

    if (normalized.length) {
      job.lastStage = 'writing_batch';
      await upsertInvariantBatch(job.database, normalized);
      job.extracted += normalized.length;
    }

    job.processed = Math.min(records.length, start + batch.length);
    job.progress = records.length ? Math.round((job.processed / records.length) * 100) : 100;
    job.updatedAt = new Date().toISOString();
  }

  job.status = 'completed';
  job.progress = 100;
  job.completedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();
}

async function startExtractionJob(options = {}) {
  cleanupJobs();
  const database = normalizeDatabaseIdentifier(options.database);
  const activeJob = Array.from(jobs.values()).find((job) => job.database === database && job.status === 'running');
  if (activeJob) {
    return activeJob;
  }

  const job = {
    jobId: createJobId(),
    database,
    sourceTables: Array.isArray(options.sourceTables) ? options.sourceTables.filter(Boolean) : ['tracks', 'sessions', 'music_blocks'],
    batchSize: clampBatchSize(options.batchSize),
    syncSeed: options.syncSeed !== false,
    status: 'running',
    progress: 0,
    processed: 0,
    extracted: 0,
    totalDocuments: 0,
    lastStage: 'queued',
    error: null,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    updatedAt: new Date().toISOString(),
    cancelRequested: false,
  };

  jobs.set(job.jobId, job);

  Promise.resolve()
    .then(() => runExtractionJob(job))
    .catch((error) => {
      job.status = 'failed';
      job.error = error?.message || 'MMSS invariant extraction failed';
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
    });

  return job;
}

function getJobStatus(jobId) {
  cleanupJobs();
  return jobs.get(jobId) || null;
}

function cancelJob(jobId) {
  cleanupJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status === 'running') {
    job.cancelRequested = true;
    job.updatedAt = new Date().toISOString();
  }
  return job;
}

module.exports = {
  MMSS_INVARIANTS_TABLE,
  cancelJob,
  ensureSchema,
  gatherStats,
  getJobStatus,
  startExtractionJob,
  syncOntologySeed,
};
