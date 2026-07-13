const crypto = require('crypto');
const { getPool } = require('../db');
const {
  answerWithRag,
  generateWithLocalModel,
  normalizeDatabaseIdentifier,
} = require('./localRagService');
const {
  ensureSchema,
  logGenerationResult,
} = require('./mmssRuntimePersistenceService');

const MMSS_THEME_ALBUM_GROUPS_TABLE = 'mmss_theme_album_groups';
const MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE = 'mmss_theme_album_group_tracks';
const MMSS_THEME_ALBUM_GROUP_JOBS_TABLE = 'mmss_theme_album_group_jobs';
const GROUP_JOB_TTL_MS = 1000 * 60 * 60 * 6;
const pipelineJobs = new Map();
const GENERIC_MATCH_TERMS = new Set([
  'album', 'archive', 'track', 'tracks', 'group', 'music', 'audio', 'sound',
  'prompt', 'session', 'flowmusic', 'mmss', 'system', 'style', 'genre',
  'goal', 'direction', 'instruction', 'theme', 'themes', 'candidate',
  'selection', 'design', 'deep', 'quick', 'creative', 'dark', 'brutal',
]);

function createStableId(prefix, payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload || {})).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asText(value, fallback = '') {
  const text = String(value == null ? '' : value).trim();
  return text || fallback;
}

function asNullableText(value) {
  const text = asText(value);
  return text || null;
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function toJson(value, fallback) {
  return JSON.stringify(value == null ? fallback : value);
}

function toTokens(value) {
  return Array.from(new Set(
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9а-яё_\-\s]+/gi, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  ));
}

function mergeTokens(...values) {
  return Array.from(new Set(values.flatMap((value) => toTokens(value))));
}

function extractFirstJson(text) {
  const source = String(text || '').trim();
  if (!source) {
    throw new Error('Expected JSON response but received empty text');
  }
  try {
    return JSON.parse(source);
  } catch (_error) {
    // fallback below
  }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(source.slice(start, end + 1));
  }
  throw new Error('Response did not contain a valid JSON object');
}

function isCancelledJobError(error) {
  return String(error?.message || '').toLowerCase().includes('cancelled');
}

function cleanupPipelineJobs() {
  const now = Date.now();
  for (const [jobId, job] of pipelineJobs.entries()) {
    if (now - job.startedAtMs > GROUP_JOB_TTL_MS) {
      pipelineJobs.delete(jobId);
    }
  }
}

async function tableExists(databaseName, tableName) {
  const result = await getPool(databaseName).query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS present
    `,
    [tableName],
  );
  return Boolean(result.rows[0]?.present);
}

async function ensureThemeAlbumGroupSchema(databaseName) {
  await ensureSchema(databaseName);
  const client = await getPool(databaseName).connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_THEME_ALBUM_GROUPS_TABLE} (
        id SERIAL PRIMARY KEY,
        group_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        goal TEXT,
        direction TEXT,
        mmss_system TEXT,
        genre TEXT,
        keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
        instruction_text TEXT,
        target_track_count INTEGER NOT NULL DEFAULT 10,
        assembly_algorithm TEXT NOT NULL DEFAULT 'thematic_mosaic',
        status TEXT NOT NULL DEFAULT 'draft',
        validation_status TEXT NOT NULL DEFAULT 'unvalidated',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} (
        id SERIAL PRIMARY KEY,
        link_id TEXT UNIQUE NOT NULL,
        group_id TEXT NOT NULL REFERENCES ${MMSS_THEME_ALBUM_GROUPS_TABLE}(group_id) ON DELETE CASCADE,
        track_id TEXT NOT NULL,
        track_source_ref TEXT,
        position_index INTEGER NOT NULL DEFAULT 0,
        assignment_source TEXT NOT NULL DEFAULT 'manual',
        match_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        validation_score DOUBLE PRECISION NOT NULL DEFAULT 0,
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(group_id, track_id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE} (
        id SERIAL PRIMARY KEY,
        job_id TEXT UNIQUE NOT NULL,
        group_id TEXT REFERENCES ${MMSS_THEME_ALBUM_GROUPS_TABLE}(group_id) ON DELETE SET NULL,
        job_type TEXT NOT NULL,
        status TEXT NOT NULL,
        stage TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        error TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_THEME_ALBUM_GROUPS_TABLE}_updated
      ON ${MMSS_THEME_ALBUM_GROUPS_TABLE} (updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_THEME_ALBUM_GROUPS_TABLE}_status
      ON ${MMSS_THEME_ALBUM_GROUPS_TABLE} (status, validation_status, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE}_group
      ON ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} (group_id, position_index ASC, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE}_track
      ON ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} (track_id, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE}_group_status
      ON ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE} (group_id, status, updated_at DESC);
    `);
  } finally {
    client.release();
  }
}

function normalizeGroupRow(row) {
  const metadata = asObject(row?.metadata);
  return {
    group_id: row?.group_id || null,
    title: row?.title || '',
    description: row?.description || '',
    goal: row?.goal || '',
    direction: row?.direction || '',
    mmss_system: row?.mmss_system || '',
    genre: row?.genre || '',
    keywords: asArray(row?.keywords).map(String),
    instruction_text: row?.instruction_text || '',
    target_track_count: Number(row?.target_track_count || 0),
    assembly_algorithm: row?.assembly_algorithm || 'thematic_mosaic',
    status: row?.status || 'draft',
    validation_status: row?.validation_status || 'unvalidated',
    metadata,
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizeGroupTrackRow(row) {
  return {
    link_id: row?.link_id || null,
    group_id: row?.group_id || null,
    track_id: row?.track_id || null,
    track_source_ref: row?.track_source_ref || null,
    position_index: Number(row?.position_index || 0),
    assignment_source: row?.assignment_source || 'manual',
    match_score: Number(row?.match_score || 0),
    validation_score: Number(row?.validation_score || 0),
    is_confirmed: Boolean(row?.is_confirmed),
    metadata: asObject(row?.metadata),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
  };
}

function normalizeJobRow(row) {
  return {
    job_id: row?.job_id || null,
    group_id: row?.group_id || null,
    job_type: row?.job_type || null,
    status: row?.status || 'unknown',
    stage: row?.stage || null,
    progress: Number(row?.progress || 0),
    request_payload: asObject(row?.request_payload),
    result_payload: asObject(row?.result_payload),
    error: row?.error || null,
    metadata: asObject(row?.metadata),
    created_at: row?.created_at || null,
    updated_at: row?.updated_at || null,
    completed_at: row?.completed_at || null,
  };
}

async function listThemeAlbumGroups(databaseName, options = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const limit = clampInteger(options.limit, 200, 1, 500);
  const result = await getPool(databaseName).query(`
    SELECT group_id, title, description, goal, direction, mmss_system, genre, keywords, instruction_text,
           target_track_count, assembly_algorithm, status, validation_status, metadata, created_at, updated_at
    FROM ${MMSS_THEME_ALBUM_GROUPS_TABLE}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeGroupRow);
}

async function getThemeAlbumGroup(databaseName, groupId) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT group_id, title, description, goal, direction, mmss_system, genre, keywords, instruction_text,
           target_track_count, assembly_algorithm, status, validation_status, metadata, created_at, updated_at
    FROM ${MMSS_THEME_ALBUM_GROUPS_TABLE}
    WHERE group_id = $1
    LIMIT 1
  `, [groupId]);
  if (!result.rows.length) {
    throw new Error(`Theme album group not found: ${groupId}`);
  }
  return normalizeGroupRow(result.rows[0]);
}

async function listThemeAlbumGroupTracks(databaseName, groupId) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT link_id, group_id, track_id, track_source_ref, position_index,
           assignment_source, match_score, validation_score, is_confirmed,
           metadata, created_at, updated_at
    FROM ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE}
    WHERE group_id = $1
    ORDER BY position_index ASC, updated_at DESC, created_at DESC
  `, [groupId]);
  return result.rows.map(normalizeGroupTrackRow);
}

async function listThemeAlbumGroupMemberships(databaseName, trackIds = []) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const normalizedTrackIds = asArray(trackIds).map((entry) => asText(entry)).filter(Boolean);
  if (!normalizedTrackIds.length) {
    return {};
  }
  const result = await getPool(databaseName).query(`
    SELECT links.track_id, links.group_id, links.position_index,
           groups.title, groups.genre, groups.assembly_algorithm
    FROM ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} links
    JOIN ${MMSS_THEME_ALBUM_GROUPS_TABLE} groups
      ON groups.group_id = links.group_id
    WHERE links.track_id = ANY($1)
    ORDER BY groups.updated_at DESC, groups.created_at DESC, links.position_index ASC
  `, [normalizedTrackIds]);
  const memberships = {};
  for (const trackId of normalizedTrackIds) {
    memberships[trackId] = [];
  }
  for (const row of result.rows) {
    const trackId = asText(row.track_id);
    if (!memberships[trackId]) {
      memberships[trackId] = [];
    }
    memberships[trackId].push({
      group_id: asText(row.group_id),
      title: asText(row.title) || asText(row.group_id),
      genre: asText(row.genre),
      assembly_algorithm: asText(row.assembly_algorithm),
      position_index: Number(row.position_index || 0),
    });
  }
  return memberships;
}

async function getThemeAlbumGroupDetails(databaseName, groupId) {
  const [group, links] = await Promise.all([
    getThemeAlbumGroup(databaseName, groupId),
    listThemeAlbumGroupTracks(databaseName, groupId),
  ]);
  return {
    group,
    links,
    stats: {
      linked_count: links.length,
      confirmed_count: links.filter((entry) => entry.is_confirmed).length,
      average_match_score: links.length
        ? Number((links.reduce((sum, entry) => sum + Number(entry.match_score || 0), 0) / links.length).toFixed(3))
        : 0,
      average_validation_score: links.length
        ? Number((links.reduce((sum, entry) => sum + Number(entry.validation_score || 0), 0) / links.length).toFixed(3))
        : 0,
    },
  };
}

async function saveThemeAlbumGroup(databaseName, payload = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const groupId = asText(payload.group_id || payload.groupId) || createStableId('theme_album_group', {
    title: payload.title,
    goal: payload.goal,
    ts: Date.now(),
  });
  const normalizedKeywords = asArray(payload.keywords).map((entry) => asText(entry)).filter(Boolean);
  const metadata = {
    ...asObject(payload.metadata),
    source: asText(payload.source || payload.metadata?.source, 'manual'),
    auto_assign: Boolean(payload.auto_assign ?? payload.autoAssign ?? payload.metadata?.auto_assign),
    confirm_with_llm: payload.confirm_with_llm == null
      ? true
      : Boolean(payload.confirm_with_llm),
  };

  await getPool(databaseName).query(`
    INSERT INTO ${MMSS_THEME_ALBUM_GROUPS_TABLE} (
      group_id, title, description, goal, direction, mmss_system, genre, keywords,
      instruction_text, target_track_count, assembly_algorithm, status, validation_status,
      metadata, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
      $9, $10, $11, $12, $13, $14::jsonb, NOW()
    )
    ON CONFLICT (group_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      goal = EXCLUDED.goal,
      direction = EXCLUDED.direction,
      mmss_system = EXCLUDED.mmss_system,
      genre = EXCLUDED.genre,
      keywords = EXCLUDED.keywords,
      instruction_text = EXCLUDED.instruction_text,
      target_track_count = EXCLUDED.target_track_count,
      assembly_algorithm = EXCLUDED.assembly_algorithm,
      status = EXCLUDED.status,
      validation_status = EXCLUDED.validation_status,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `, [
    groupId,
    asText(payload.title, groupId),
    asNullableText(payload.description),
    asNullableText(payload.goal),
    asNullableText(payload.direction),
    asNullableText(payload.mmss_system || payload.mmssSystem),
    asNullableText(payload.genre),
    toJson(normalizedKeywords, []),
    asNullableText(payload.instruction_text || payload.instructionText),
    clampInteger(payload.target_track_count || payload.targetTrackCount, 10, 1, 200),
    asText(payload.assembly_algorithm || payload.assemblyAlgorithm, 'thematic_mosaic'),
    asText(payload.status, 'draft'),
    asText(payload.validation_status || payload.validationStatus, 'unvalidated'),
    toJson(metadata, {}),
  ]);

  return getThemeAlbumGroup(databaseName, groupId);
}

async function deleteThemeAlbumGroup(databaseName, groupId) {
  await ensureThemeAlbumGroupSchema(databaseName);
  await getPool(databaseName).query(`
    DELETE FROM ${MMSS_THEME_ALBUM_GROUPS_TABLE}
    WHERE group_id = $1
  `, [groupId]);
  return { deleted: groupId };
}

async function saveThemeAlbumGroupTrack(databaseName, payload = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const groupId = asText(payload.group_id || payload.groupId);
  const trackId = asText(payload.track_id || payload.trackId);
  if (!groupId) throw new Error('group_id is required');
  if (!trackId) throw new Error('track_id is required');

  const linkId = asText(payload.link_id || payload.linkId) || createStableId('theme_album_group_track', {
    groupId,
    trackId,
  });

  await getPool(databaseName).query(`
    INSERT INTO ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} (
      link_id, group_id, track_id, track_source_ref, position_index,
      assignment_source, match_score, validation_score, is_confirmed, metadata, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
    ON CONFLICT (group_id, track_id)
    DO UPDATE SET
      link_id = EXCLUDED.link_id,
      track_source_ref = EXCLUDED.track_source_ref,
      position_index = EXCLUDED.position_index,
      assignment_source = EXCLUDED.assignment_source,
      match_score = EXCLUDED.match_score,
      validation_score = EXCLUDED.validation_score,
      is_confirmed = EXCLUDED.is_confirmed,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `, [
    linkId,
    groupId,
    trackId,
    asNullableText(payload.track_source_ref || payload.trackSourceRef),
    clampInteger(payload.position_index || payload.positionIndex, 0, 0, 100000),
    asText(payload.assignment_source || payload.assignmentSource, 'manual'),
    Number(payload.match_score || payload.matchScore || 0),
    Number(payload.validation_score || payload.validationScore || 0),
    Boolean(payload.is_confirmed ?? payload.isConfirmed),
    toJson(asObject(payload.metadata), {}),
  ]);

  const links = await listThemeAlbumGroupTracks(databaseName, groupId);
  return links.find((entry) => entry.track_id === trackId) || null;
}

async function replaceThemeAlbumGroupTracks(databaseName, groupId, links = []) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} WHERE group_id = $1`, [groupId]);
    for (let index = 0; index < links.length; index += 1) {
      const entry = asObject(links[index]);
      const trackId = asText(entry.track_id || entry.trackId);
      if (!trackId) continue;
      const linkId = asText(entry.link_id || entry.linkId) || createStableId('theme_album_group_track', {
        groupId,
        trackId,
      });
      await client.query(`
        INSERT INTO ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} (
          link_id, group_id, track_id, track_source_ref, position_index,
          assignment_source, match_score, validation_score, is_confirmed, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())
      `, [
        linkId,
        groupId,
        trackId,
        asNullableText(entry.track_source_ref || entry.trackSourceRef),
        clampInteger(entry.position_index || entry.positionIndex, index, 0, 100000),
        asText(entry.assignment_source || entry.assignmentSource, 'manual'),
        Number(entry.match_score || entry.matchScore || 0),
        Number(entry.validation_score || entry.validationScore || 0),
        Boolean(entry.is_confirmed ?? entry.isConfirmed),
        toJson(asObject(entry.metadata), {}),
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  return listThemeAlbumGroupTracks(databaseName, groupId);
}

async function deleteThemeAlbumGroupTrack(databaseName, groupId, trackId) {
  await ensureThemeAlbumGroupSchema(databaseName);
  await getPool(databaseName).query(`
    DELETE FROM ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE}
    WHERE group_id = $1 AND track_id = $2
  `, [groupId, trackId]);
  return { deleted: { group_id: groupId, track_id: trackId } };
}

async function persistThemeAlbumGroupJob(databaseName, payload = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const jobId = asText(payload.job_id || payload.jobId);
  if (!jobId) throw new Error('job_id is required');
  await getPool(databaseName).query(`
    INSERT INTO ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE} (
      job_id, group_id, job_type, status, stage, progress,
      request_payload, result_payload, error, metadata, updated_at, completed_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7::jsonb, $8::jsonb, $9, $10::jsonb, NOW(), $11
    )
    ON CONFLICT (job_id)
    DO UPDATE SET
      group_id = EXCLUDED.group_id,
      job_type = EXCLUDED.job_type,
      status = EXCLUDED.status,
      stage = EXCLUDED.stage,
      progress = EXCLUDED.progress,
      request_payload = EXCLUDED.request_payload,
      result_payload = EXCLUDED.result_payload,
      error = EXCLUDED.error,
      metadata = EXCLUDED.metadata,
      updated_at = NOW(),
      completed_at = EXCLUDED.completed_at
  `, [
    jobId,
    asNullableText(payload.group_id || payload.groupId),
    asText(payload.job_type || payload.jobType, 'theme_album_group_pipeline'),
    asText(payload.status, 'running'),
    asNullableText(payload.stage),
    clampInteger(payload.progress, 0, 0, 100),
    toJson(asObject(payload.request_payload || payload.requestPayload), {}),
    toJson(asObject(payload.result_payload || payload.resultPayload), {}),
    asNullableText(payload.error),
    toJson(asObject(payload.metadata), {}),
    payload.completed_at || payload.completedAt || null,
  ]);
}

async function listThemeAlbumGroupJobs(databaseName, options = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const limit = clampInteger(options.limit, 50, 1, 200);
  const statuses = asArray(options.statuses)
    .map((entry) => asText(entry).toLowerCase())
    .filter(Boolean);
  const clauses = [];
  const values = [];
  if (statuses.length) {
    values.push(statuses);
    clauses.push(`status = ANY($${values.length})`);
  }
  values.push(limit);
  const result = await getPool(databaseName).query(`
    SELECT job_id, group_id, job_type, status, stage, progress,
           request_payload, result_payload, error, metadata,
           created_at, updated_at, completed_at
    FROM ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE}
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $${values.length}
  `, values);
  return result.rows.map(normalizeJobRow);
}

async function deleteThemeAlbumGroupJob(databaseName, jobId) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const normalizedJobId = asText(jobId);
  if (!normalizedJobId) {
    throw new Error('job_id is required');
  }
  pipelineJobs.delete(normalizedJobId);
  const result = await getPool(databaseName).query(`
    DELETE FROM ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE}
    WHERE job_id = $1
  `, [normalizedJobId]);
  return {
    job_id: normalizedJobId,
    deleted: result.rowCount > 0,
  };
}

async function clearThemeAlbumGroupJobs(databaseName, options = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const statuses = asArray(options.statuses)
    .map((entry) => asText(entry).toLowerCase())
    .filter(Boolean);
  if (!statuses.length) {
    return { deleted_count: 0, statuses: [] };
  }
  for (const [jobId, job] of pipelineJobs.entries()) {
    if (statuses.includes(asText(job.status).toLowerCase())) {
      pipelineJobs.delete(jobId);
    }
  }
  const result = await getPool(databaseName).query(`
    DELETE FROM ${MMSS_THEME_ALBUM_GROUP_JOBS_TABLE}
    WHERE status = ANY($1)
  `, [statuses]);
  return {
    deleted_count: Number(result.rowCount || 0),
    statuses,
  };
}

function buildGroupCriteria(payload = {}) {
  const keywords = asArray(payload.keywords).map((entry) => asText(entry)).filter(Boolean);
  return {
    title: asText(payload.title),
    description: asText(payload.description),
    goal: asText(payload.goal),
    direction: asText(payload.direction),
    mmss_system: asText(payload.mmss_system || payload.mmssSystem),
    genre: asText(payload.genre),
    keywords,
    instruction_text: asText(payload.instruction_text || payload.instructionText),
    target_track_count: clampInteger(payload.target_track_count || payload.targetTrackCount, 10, 1, 200),
    assembly_algorithm: asText(payload.assembly_algorithm || payload.assemblyAlgorithm, 'thematic_mosaic'),
    auto_assign: Boolean(payload.auto_assign ?? payload.autoAssign),
    model: asText(payload.model, 'mmss-qwen2.5-3b:latest'),
  };
}

async function buildThemeAlbumGroupRagProfile(databaseName, criteria, options = {}) {
  const query = [
    criteria.title,
    criteria.goal,
    criteria.direction,
    criteria.genre,
    criteria.mmss_system,
    criteria.keywords.join(' '),
    criteria.instruction_text,
  ].filter(Boolean).join('\n');

  if (!query.trim()) {
    return null;
  }

  try {
    const rag = await answerWithRag({
      database: databaseName,
      query,
      model: criteria.model,
      mode: 'album_concept',
      topK: clampInteger(options.topK, 5, 1, 8),
      queryBudget: clampInteger(options.queryBudget, 2, 1, 4),
      sourceTables: [
        'mmss_collection',
        'mmss_filtered',
        'mmss_tracks_prompts',
        'mmss_custom_instructions',
        'mmss_skills',
        'mmss_skill_sets',
        'mmss_skill_trees',
      ],
      responseMaxChars: 4000,
      forceJsonResponse: true,
      systemPrompt: [
        'You are enriching retrieval for a theme album group over an MMSS archive.',
        'Return strict JSON only.',
        'Schema:',
        '{"focus_terms":["string"],"candidate_signals":["string"],"retrieval_lens":"string","exclusion_terms":["string"]}',
      ].join(' '),
    });
    const parsed = extractFirstJson(rag.answer);
    return {
      focus_terms: asArray(parsed.focus_terms).map((entry) => asText(entry)).filter(Boolean),
      candidate_signals: asArray(parsed.candidate_signals).map((entry) => asText(entry)).filter(Boolean),
      retrieval_lens: asText(parsed.retrieval_lens),
      exclusion_terms: asArray(parsed.exclusion_terms).map((entry) => asText(entry)).filter(Boolean),
      model: rag.model,
      source_scopes: rag.sourceScopes,
    };
  } catch (_error) {
    return null;
  }
}

async function generateThemeAlbumGroupProfile(databaseName, payload = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const criteria = buildGroupCriteria(payload);
  const freeformGoal = asText(payload.freeform_goal || payload.freeformGoal || payload.goal || payload.direction || payload.title);
  if (!freeformGoal) {
    throw new Error('freeform_goal or goal is required to generate a theme album group');
  }

  const generation = await generateWithLocalModel({
    model: criteria.model,
    format: 'json',
    think: false,
    systemPrompt: [
      'You design MMSS theme album groups over an existing archive of tracks.',
      'Return strict JSON only.',
      'Create a compact but usable grouping profile.',
      'Schema:',
      '{"title":"string","description":"string","goal":"string","direction":"string","mmss_system":"string","genre":"string","keywords":["string"],"instruction_text":"string","target_track_count":10,"assembly_algorithm":"string"}',
    ].join(' '),
    prompt: [
      `User request: ${freeformGoal}`,
      criteria.genre ? `Genre hint: ${criteria.genre}` : null,
      criteria.mmss_system ? `MMSS system hint: ${criteria.mmss_system}` : null,
      criteria.keywords.length ? `Keywords: ${criteria.keywords.join(', ')}` : null,
      criteria.instruction_text ? `Instruction: ${criteria.instruction_text}` : null,
      `Target track count: ${criteria.target_track_count}`,
      `Assembly algorithm preference: ${criteria.assembly_algorithm}`,
    ].filter(Boolean).join('\n'),
  });

  const parsed = extractFirstJson(generation.response);
  const normalized = buildGroupCriteria({
    ...criteria,
    ...parsed,
  });

  const group = await saveThemeAlbumGroup(databaseName, {
    ...normalized,
    title: normalized.title || freeformGoal,
    status: 'draft',
    validation_status: 'unvalidated',
    source: 'llm_generated',
    metadata: {
      llm_generated: true,
      generation_model: generation.model,
      generation_partial: Boolean(generation.partial),
    },
  });

  await logGenerationResult(databaseName, {
    mode: 'theme_album_group_profile',
    model: generation.model,
    query: freeformGoal,
    answer: generation.response,
    metadata: {
      operation: 'theme_album_group_profile',
      group_id: group.group_id,
    },
  });

  return {
    group,
    generation: {
      model: generation.model,
      partial: Boolean(generation.partial),
    },
  };
}

function appendCandidate(map, trackId, sourceTable, sourceText, fields = {}) {
  const key = asText(trackId);
  if (!key) return;
  const entry = map.get(key) || {
    track_id: key,
    title: null,
    texts: [],
    source_tables: new Set(),
    metadata: {},
  };
  const text = asText(sourceText);
  if (text) {
    entry.texts.push(text);
  }
  entry.source_tables.add(sourceTable);
  if (!entry.title && fields.title) {
    entry.title = asText(fields.title);
  }
  entry.metadata = {
    ...entry.metadata,
    ...asObject(fields.metadata),
  };
  map.set(key, entry);
}

async function collectThemeAlbumGroupCandidateCorpus(databaseName, options = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const corpus = new Map();
  const promptLimit = clampInteger(options.promptLimit, 800, 50, 3000);
  const filteredLimit = clampInteger(options.filteredLimit, 800, 50, 3000);
  const collectionLimit = clampInteger(options.collectionLimit, 800, 50, 3000);

  if (await tableExists(databaseName, 'mmss_tracks_prompts')) {
    const promptResult = await getPool(databaseName).query(`
      SELECT track_id, prompt_text, metadata
      FROM mmss_tracks_prompts
      WHERE track_id IS NOT NULL AND track_id <> ''
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT $1
    `, [promptLimit]);
    for (const row of promptResult.rows) {
      appendCandidate(
        corpus,
        row.track_id,
        'mmss_tracks_prompts',
        [row.prompt_text, JSON.stringify(asObject(row.metadata))].filter(Boolean).join('\n'),
        { metadata: row.metadata },
      );
    }
  }

  if (await tableExists(databaseName, 'mmss_filtered')) {
    const filteredResult = await getPool(databaseName).query(`
      SELECT track_id, generation_insights, operator_trajectory, temporal_phases,
             creative_choices, emergence_moments, next_vector_suggestions, domain,
             raw_payload, metadata
      FROM mmss_filtered
      WHERE track_id IS NOT NULL AND track_id <> ''
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT $1
    `, [filteredLimit]);
    for (const row of filteredResult.rows) {
      appendCandidate(
        corpus,
        row.track_id,
        'mmss_filtered',
        [
          row.generation_insights,
          row.operator_trajectory,
          row.temporal_phases,
          row.creative_choices,
          row.emergence_moments,
          row.next_vector_suggestions,
          row.domain,
          JSON.stringify(asObject(row.raw_payload)),
          JSON.stringify(asObject(row.metadata)),
        ].filter(Boolean).join('\n'),
        { metadata: row.metadata },
      );
    }
  }

  if (await tableExists(databaseName, 'mmss_collection')) {
    const collectionResult = await getPool(databaseName).query(`
      SELECT title, content, payload, metadata
      FROM mmss_collection
      WHERE payload->>'track_id' IS NOT NULL AND payload->>'track_id' <> ''
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT $1
    `, [collectionLimit]);
    for (const row of collectionResult.rows) {
      const payload = asObject(row.payload);
      appendCandidate(
        corpus,
        payload.track_id,
        'mmss_collection',
        [
          row.title,
          row.content,
          JSON.stringify(payload),
          JSON.stringify(asObject(row.metadata)),
        ].filter(Boolean).join('\n'),
        {
          title: row.title || payload.title || payload.track_title || null,
          metadata: row.metadata,
        },
      );
    }
  }

  return corpus;
}

function scoreCandidateAgainstCriteria(criteria, candidate) {
  const trackText = `${asText(candidate.title)}\n${candidate.texts.join('\n')}`.toLowerCase();
  const tokens = mergeTokens(
    criteria.title,
    criteria.description,
    criteria.goal,
    criteria.direction,
    criteria.mmss_system,
    criteria.genre,
    criteria.keywords.join(' '),
    criteria.instruction_text,
    asArray(criteria.rag_focus_terms).join(' '),
    asArray(criteria.rag_candidate_signals).join(' '),
  );

  let score = 0;
  const matchedTerms = [];

  for (const token of tokens) {
    if (!trackText.includes(token)) continue;
    matchedTerms.push(token);
    score += token.length >= 8 ? 2.5 : 1.5;
  }

  if (criteria.genre && trackText.includes(criteria.genre.toLowerCase())) score += 4;
  if (criteria.mmss_system && trackText.includes(criteria.mmss_system.toLowerCase())) score += 4;
  if (criteria.direction && trackText.includes(criteria.direction.toLowerCase())) score += 3;
  if (criteria.instruction_text && trackText.includes(criteria.instruction_text.toLowerCase().slice(0, 32))) score += 3;
  score += candidate.source_tables.size * 0.75;

  const snippet = candidate.texts.join(' ').slice(0, 420);
  const filteredTerms = Array.from(new Set(matchedTerms))
    .filter((term) => !GENERIC_MATCH_TERMS.has(term))
    .slice(0, 8);

  return {
    track_id: candidate.track_id,
    title: candidate.title || null,
    score: Number(score.toFixed(3)),
    matched_terms: filteredTerms.length
      ? filteredTerms
      : Array.from(new Set(matchedTerms)).slice(0, 6),
    source_tables: Array.from(candidate.source_tables),
    snippet,
    metadata: candidate.metadata,
  };
}

async function enrichCandidatesWithGroupMemberships(databaseName, candidates = []) {
  const trackIds = candidates.map((candidate) => asText(candidate.track_id)).filter(Boolean);
  if (!trackIds.length) {
    return candidates;
  }
  const membershipMap = new Map();
  const result = await getPool(databaseName).query(`
    SELECT links.track_id, links.group_id, groups.title
    FROM ${MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE} links
    JOIN ${MMSS_THEME_ALBUM_GROUPS_TABLE} groups
      ON groups.group_id = links.group_id
    WHERE links.track_id = ANY($1)
    ORDER BY groups.updated_at DESC, groups.created_at DESC
  `, [trackIds]);
  for (const row of result.rows) {
    const trackId = asText(row.track_id);
    const membership = {
      group_id: asText(row.group_id),
      title: asText(row.title) || asText(row.group_id),
    };
    const entries = membershipMap.get(trackId) || [];
    entries.push(membership);
    membershipMap.set(trackId, entries);
  }
  return candidates.map((candidate) => ({
    ...candidate,
    group_memberships: membershipMap.get(asText(candidate.track_id)) || [],
  }));
}

async function searchThemeAlbumGroupCandidates(databaseName, payload = {}) {
  const criteria = buildGroupCriteria(payload);
  const maxCandidates = clampInteger(
    payload.max_candidates || payload.maxCandidates,
    Math.max(criteria.target_track_count * 2, 16),
    5,
    80,
  );
  const ragProfile = payload.use_rag === false
    ? null
    : await buildThemeAlbumGroupRagProfile(databaseName, criteria, payload);
  const scoringCriteria = {
    ...criteria,
    rag_focus_terms: ragProfile?.focus_terms || [],
    rag_candidate_signals: ragProfile?.candidate_signals || [],
  };
  const corpus = await collectThemeAlbumGroupCandidateCorpus(databaseName, payload);
  const scored = Array.from(corpus.values())
    .map((candidate) => scoreCandidateAgainstCriteria(scoringCriteria, candidate))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.track_id.localeCompare(right.track_id))
    .slice(0, maxCandidates);
  const enrichedCandidates = await enrichCandidatesWithGroupMemberships(databaseName, scored);

  return {
    criteria: scoringCriteria,
    rag_profile: ragProfile,
    total_indexed_tracks: corpus.size,
    candidates: enrichedCandidates,
  };
}

async function selectThemeAlbumGroupCandidatesWithLlm(payload = {}) {
  const criteria = buildGroupCriteria(payload.criteria);
  const candidates = asArray(payload.candidates).slice(0, clampInteger(payload.maxCandidatePool, 18, 5, 40));
  const targetCount = clampInteger(
    payload.target_track_count || payload.targetTrackCount || criteria.target_track_count,
    criteria.target_track_count || 10,
    1,
    200,
  );
  if (!candidates.length) {
    return {
      selected_track_ids: [],
      title: criteria.title || '',
      description: criteria.description || '',
      reasoning_summary: 'No candidates available.',
      validation_notes: ['No candidates available for selection.'],
      model: criteria.model,
      partial: false,
    };
  }

  const prompt = [
    'Choose the strongest archive tracks for one theme album group.',
    'Return JSON only with keys:',
    '{"selected_track_ids":["string"],"title":"string","description":"string","reasoning_summary":"string","validation_notes":["string"]}',
    `Target track count: ${targetCount}`,
    `Direction: ${criteria.direction || criteria.goal || criteria.title}`,
    criteria.genre ? `Genre: ${criteria.genre}` : null,
    criteria.mmss_system ? `MMSS system: ${criteria.mmss_system}` : null,
    criteria.instruction_text ? `Instruction: ${criteria.instruction_text}` : null,
    criteria.keywords.length ? `Keywords: ${criteria.keywords.join(', ')}` : null,
    'Candidate pool:',
    JSON.stringify(candidates.map((candidate) => ({
      track_id: candidate.track_id,
      title: candidate.title,
      score: candidate.score,
      matched_terms: candidate.matched_terms,
      source_tables: candidate.source_tables,
      snippet: candidate.snippet,
    })), null, 2),
  ].filter(Boolean).join('\n\n');

  const generation = await generateWithLocalModel({
    model: criteria.model,
    format: 'json',
    think: false,
    systemPrompt: [
      'You are an MMSS archive album-group curator.',
      'Pick the best matching tracks from the candidate list only.',
      'Never invent track ids.',
      'Return strict JSON only.',
    ].join(' '),
    prompt,
    numPredict: 1200,
  });

  const parsed = extractFirstJson(generation.response);
  const selectedIds = asArray(parsed.selected_track_ids).map((entry) => asText(entry)).filter(Boolean);

  return {
    selected_track_ids: selectedIds,
    title: asText(parsed.title, criteria.title),
    description: asText(parsed.description, criteria.description),
    reasoning_summary: asText(parsed.reasoning_summary),
    validation_notes: asArray(parsed.validation_notes).map((entry) => asText(entry)).filter(Boolean),
    model: generation.model,
    partial: Boolean(generation.partial),
  };
}

async function validateThemeAlbumGroupLinks(databaseName, payload = {}) {
  await ensureThemeAlbumGroupSchema(databaseName);
  const groupId = asText(payload.group_id || payload.groupId);
  if (!groupId) {
    throw new Error('group_id is required');
  }

  const details = await getThemeAlbumGroupDetails(databaseName, groupId);
  const linkTrackIds = details.links.map((entry) => entry.track_id).filter(Boolean);
  const promptTracks = new Set();
  const filteredTracks = new Set();
  const collectionTracks = new Set();

  if (linkTrackIds.length && await tableExists(databaseName, 'mmss_tracks_prompts')) {
    const result = await getPool(databaseName).query(`
      SELECT track_id FROM mmss_tracks_prompts WHERE track_id = ANY($1)
    `, [linkTrackIds]);
    for (const row of result.rows) promptTracks.add(asText(row.track_id));
  }
  if (linkTrackIds.length && await tableExists(databaseName, 'mmss_filtered')) {
    const result = await getPool(databaseName).query(`
      SELECT track_id FROM mmss_filtered WHERE track_id = ANY($1)
    `, [linkTrackIds]);
    for (const row of result.rows) filteredTracks.add(asText(row.track_id));
  }
  if (linkTrackIds.length && await tableExists(databaseName, 'mmss_collection')) {
    const result = await getPool(databaseName).query(`
      SELECT payload->>'track_id' AS track_id
      FROM mmss_collection
      WHERE payload->>'track_id' = ANY($1)
    `, [linkTrackIds]);
    for (const row of result.rows) collectionTracks.add(asText(row.track_id));
  }

  const validations = [];
  for (const link of details.links) {
    let score = 0;
    if (promptTracks.has(link.track_id)) score += 0.4;
    if (filteredTracks.has(link.track_id)) score += 0.35;
    if (collectionTracks.has(link.track_id)) score += 0.25;
    validations.push({
      track_id: link.track_id,
      link_id: link.link_id,
      exists_in_prompt_table: promptTracks.has(link.track_id),
      exists_in_filtered_table: filteredTracks.has(link.track_id),
      exists_in_collection_table: collectionTracks.has(link.track_id),
      validation_score: Number(score.toFixed(3)),
      healthy: score >= 0.35,
    });
  }

  const averageScore = validations.length
    ? validations.reduce((sum, entry) => sum + entry.validation_score, 0) / validations.length
    : 0;

  for (const validation of validations) {
    const existingLink = details.links.find((entry) => entry.track_id === validation.track_id) || {};
    await saveThemeAlbumGroupTrack(databaseName, {
      group_id: groupId,
      track_id: validation.track_id,
      track_source_ref: existingLink.track_source_ref,
      position_index: existingLink.position_index,
      assignment_source: existingLink.assignment_source,
      match_score: existingLink.match_score,
      validation_score: validation.validation_score,
      is_confirmed: validation.healthy,
      metadata: {
        ...asObject(existingLink.metadata),
        validation_snapshot: validation,
      },
    });
  }

  const validationStatus = averageScore >= 0.65
    ? 'validated'
    : validations.some((entry) => !entry.healthy)
      ? 'needs_attention'
      : 'partial';

  const updatedGroup = await saveThemeAlbumGroup(databaseName, {
    ...details.group,
    validation_status: validationStatus,
    metadata: {
      ...details.group.metadata,
      last_validation: {
        average_score: Number(averageScore.toFixed(3)),
        checked_at: new Date().toISOString(),
        linked_count: validations.length,
      },
    },
  });

  return {
    group: updatedGroup,
    validations,
    summary: {
      linked_count: validations.length,
      healthy_count: validations.filter((entry) => entry.healthy).length,
      average_score: Number(averageScore.toFixed(3)),
      validation_status: validationStatus,
    },
  };
}

function buildPipelineRequest(options = {}) {
  const database = normalizeDatabaseIdentifier(options.database);
  const criteria = buildGroupCriteria(options);
  return {
    database,
    group_id: asText(options.group_id || options.groupId),
    freeform_goal: asText(options.freeform_goal || options.freeformGoal || options.goal || options.direction || options.title),
    title: criteria.title,
    description: criteria.description,
    goal: criteria.goal || asText(options.goal),
    direction: criteria.direction,
    mmss_system: criteria.mmss_system,
    genre: criteria.genre,
    keywords: criteria.keywords,
    instruction_text: criteria.instruction_text,
    target_track_count: criteria.target_track_count,
    assembly_algorithm: criteria.assembly_algorithm,
    auto_assign: Boolean(options.auto_assign ?? options.autoAssign ?? true),
    confirm_with_llm: options.confirm_with_llm == null ? true : Boolean(options.confirm_with_llm),
    model: criteria.model,
    use_rag: options.use_rag == null ? true : Boolean(options.use_rag),
    max_candidates: clampInteger(options.max_candidates || options.maxCandidates, Math.max(criteria.target_track_count * 2, 16), 8, 80),
    replace_existing_links: options.replace_existing_links == null ? true : Boolean(options.replace_existing_links),
  };
}

async function updateJobState(databaseName, job, patch = {}) {
  Object.assign(job, patch, {
    updatedAt: new Date().toISOString(),
  });
  await persistThemeAlbumGroupJob(databaseName, {
    job_id: job.jobId,
    group_id: job.group_id,
    job_type: job.job_type,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    request_payload: job.request,
    result_payload: job.result || {},
    error: job.error,
    metadata: job.metadata,
    completed_at: job.completedAt || null,
  });
}

async function executeThemeAlbumGroupPipeline(options = {}, runtimeJob = null) {
  const request = buildPipelineRequest(options);
  const job = runtimeJob || {
    jobId: createStableId('theme_album_group_job', { request, ts: Date.now() }),
    job_type: 'theme_album_group_pipeline',
    group_id: request.group_id || null,
    status: 'running',
    stage: 'queued',
    progress: 0,
    error: null,
    result: null,
    metadata: {},
    request,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    updatedAt: new Date().toISOString(),
  };

  await updateJobState(request.database, job, { stage: 'ensure_schema', progress: 5 });
  if (job.cancelRequested) {
    throw new Error('Theme album group pipeline cancelled');
  }

  let group;
  if (request.group_id) {
    group = await getThemeAlbumGroup(request.database, request.group_id);
  } else if (request.title || request.goal || request.freeform_goal) {
    await updateJobState(request.database, job, { stage: 'llm_group_profile', progress: 18 });
    const profile = await generateThemeAlbumGroupProfile(request.database, request);
    group = profile.group;
    job.group_id = group.group_id;
  } else {
    throw new Error('A group_id or enough group criteria is required to run the pipeline');
  }
  if (job.cancelRequested) {
    throw new Error('Theme album group pipeline cancelled');
  }

  await updateJobState(request.database, job, { stage: 'candidate_search', progress: 35 });
  const candidateResult = await searchThemeAlbumGroupCandidates(request.database, {
    ...group,
    ...request,
    target_track_count: request.target_track_count || group.target_track_count,
    max_candidates: request.max_candidates,
  });
  if (job.cancelRequested) {
    throw new Error('Theme album group pipeline cancelled');
  }

  let selectedTrackIds = candidateResult.candidates
    .slice(0, request.target_track_count)
    .map((entry) => entry.track_id);
  let llmSelection = null;

  if (request.auto_assign) {
    await updateJobState(request.database, job, { stage: 'llm_selection', progress: 55 });
    if (request.confirm_with_llm) {
      llmSelection = await selectThemeAlbumGroupCandidatesWithLlm({
        criteria: {
          ...group,
          ...request,
        },
        candidates: candidateResult.candidates,
        target_track_count: request.target_track_count || group.target_track_count,
        maxCandidatePool: Math.min(candidateResult.candidates.length, Math.max(request.target_track_count * 2, 18)),
      });
      if (llmSelection.selected_track_ids.length) {
        selectedTrackIds = llmSelection.selected_track_ids.slice(0, request.target_track_count);
      }
    }
    if (job.cancelRequested) {
      throw new Error('Theme album group pipeline cancelled');
    }

    const selectedCandidates = selectedTrackIds
      .map((trackId) => candidateResult.candidates.find((entry) => entry.track_id === trackId))
      .filter(Boolean)
      .map((entry, index) => ({
        track_id: entry.track_id,
        position_index: index,
        assignment_source: request.confirm_with_llm ? 'llm_confirmed' : 'llm_auto',
        match_score: entry.score,
        validation_score: 0,
        is_confirmed: Boolean(request.confirm_with_llm),
        metadata: {
          matched_terms: entry.matched_terms,
          source_tables: entry.source_tables,
          snippet: entry.snippet,
          llm_reasoning_summary: llmSelection?.reasoning_summary || null,
        },
      }));

    await updateJobState(request.database, job, { stage: 'persist_links', progress: 72 });
    if (request.replace_existing_links) {
      await replaceThemeAlbumGroupTracks(request.database, group.group_id, selectedCandidates);
    } else {
      for (const entry of selectedCandidates) {
        await saveThemeAlbumGroupTrack(request.database, {
          ...entry,
          group_id: group.group_id,
        });
      }
    }
  }

  await updateJobState(request.database, job, { stage: 'validate_links', progress: 88 });
  const validation = await validateThemeAlbumGroupLinks(request.database, {
    group_id: group.group_id,
  });
  if (job.cancelRequested) {
    throw new Error('Theme album group pipeline cancelled');
  }

  const finalDetails = await getThemeAlbumGroupDetails(request.database, group.group_id);
  const result = {
    group: finalDetails.group,
    links: finalDetails.links,
    candidates: candidateResult.candidates,
    llm_selection: llmSelection,
    validation,
  };

  await updateJobState(request.database, job, {
    status: 'completed',
    stage: 'completed',
    progress: 100,
    result,
    completedAt: new Date().toISOString(),
  });

  await logGenerationResult(request.database, {
    mode: 'theme_album_group_pipeline',
    model: request.model,
    query: request.freeform_goal || request.goal || request.title || group.title,
    answer: JSON.stringify(result, null, 2),
    metadata: {
      operation: 'theme_album_group_pipeline',
      group_id: group.group_id,
      target_track_count: request.target_track_count,
      auto_assign: request.auto_assign,
    },
  });

  return result;
}

async function runThemeAlbumGroupPipelineJob(job) {
  try {
    await executeThemeAlbumGroupPipeline(job.request, job);
  } catch (error) {
    await updateJobState(job.request.database, job, {
      status: isCancelledJobError(error) ? 'cancelled' : 'failed',
      stage: isCancelledJobError(error) ? 'cancelled' : 'failed',
      progress: job.progress || 0,
      error: error?.message || 'Theme album group pipeline failed',
      completedAt: new Date().toISOString(),
    });
  }
}

async function startThemeAlbumGroupPipelineJob(options = {}) {
  cleanupPipelineJobs();
  const request = buildPipelineRequest(options);
  const job = {
    jobId: createStableId('theme_album_group_job', { request, ts: Date.now() }),
    job_type: 'theme_album_group_pipeline',
    group_id: request.group_id || null,
    status: 'running',
    stage: 'queued',
    progress: 0,
    error: null,
    result: null,
    metadata: {},
    request,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    cancelRequested: false,
  };
  pipelineJobs.set(job.jobId, job);
  await persistThemeAlbumGroupJob(request.database, {
    job_id: job.jobId,
    group_id: job.group_id,
    job_type: job.job_type,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    request_payload: request,
    result_payload: {},
    metadata: {},
  });
  Promise.resolve().then(() => runThemeAlbumGroupPipelineJob(job));
  return {
    job_id: job.jobId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    group_id: job.group_id,
  };
}

function getThemeAlbumGroupPipelineJobStatus(jobId) {
  cleanupPipelineJobs();
  const job = pipelineJobs.get(jobId);
  if (!job) return null;
  return {
    job_id: job.jobId,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    group_id: job.group_id,
    error: job.error,
    result: job.result,
    started_at: job.startedAt,
    updated_at: job.updatedAt,
    completed_at: job.completedAt || null,
  };
}

async function cancelThemeAlbumGroupPipelineJob(databaseName, jobId) {
  cleanupPipelineJobs();
  const job = pipelineJobs.get(jobId);
  if (!job) return null;
  job.cancelRequested = true;
  await updateJobState(databaseName, job, {
    status: 'running',
    stage: 'cancel_requested',
    progress: job.progress,
  });
  return getThemeAlbumGroupPipelineJobStatus(jobId);
}

module.exports = {
  MMSS_THEME_ALBUM_GROUPS_TABLE,
  MMSS_THEME_ALBUM_GROUP_TRACKS_TABLE,
  MMSS_THEME_ALBUM_GROUP_JOBS_TABLE,
  cancelThemeAlbumGroupPipelineJob,
  clearThemeAlbumGroupJobs,
  deleteThemeAlbumGroupJob,
  deleteThemeAlbumGroup,
  deleteThemeAlbumGroupTrack,
  ensureThemeAlbumGroupSchema,
  executeThemeAlbumGroupPipeline,
  generateThemeAlbumGroupProfile,
  getThemeAlbumGroup,
  getThemeAlbumGroupDetails,
  getThemeAlbumGroupPipelineJobStatus,
  listThemeAlbumGroupJobs,
  listThemeAlbumGroupMemberships,
  listThemeAlbumGroupTracks,
  listThemeAlbumGroups,
  replaceThemeAlbumGroupTracks,
  saveThemeAlbumGroup,
  saveThemeAlbumGroupTrack,
  searchThemeAlbumGroupCandidates,
  startThemeAlbumGroupPipelineJob,
  validateThemeAlbumGroupLinks,
};
