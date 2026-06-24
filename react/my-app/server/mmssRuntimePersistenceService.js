const crypto = require('crypto');
const { getPool } = require('../db');

const MMSS_GENERATION_RESULTS_TABLE = 'mmss_generation_results';
const MMSS_SKILLS_TABLE = 'mmss_skills';
const MMSS_SKILL_SETS_TABLE = 'mmss_skill_sets';
const MMSS_SKILL_TREES_TABLE = 'mmss_skill_trees';
const MMSS_SKILL_RUNS_TABLE = 'mmss_skill_runs';
const MMSS_COLLECTION_TABLE = 'mmss_collection';
const MMSS_ALBUMS_TABLE = 'mmss_albums';
const MMSS_FILTERED_TABLE = 'mmss_filtered';
const MMSS_CUSTOM_INSTRUCTIONS_TABLE = 'mmss_custom_instructions';
const MMSS_TRACKS_PROMPTS_TABLE = 'mmss_tracks_prompts';

function createStableId(prefix, payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload || {})).digest('hex').slice(0, 16);
  return `${prefix}_${hash}`;
}

async function ensureSchema(databaseName) {
  const client = await getPool(databaseName).connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_GENERATION_RESULTS_TABLE} (
        result_id TEXT PRIMARY KEY,
        mode TEXT NOT NULL,
        model TEXT,
        query TEXT NOT NULL,
        answer TEXT,
        source_scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
        retrieved_sources JSONB NOT NULL DEFAULT '[]'::jsonb,
        prompt_context_text TEXT,
        debug_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_SKILLS_TABLE} (
        id SERIAL PRIMARY KEY,
        skill_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
        outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
        prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
        failure_modes JSONB NOT NULL DEFAULT '[]'::jsonb,
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_SKILL_SETS_TABLE} (
        id SERIAL PRIMARY KEY,
        skill_set_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        skills JSONB NOT NULL DEFAULT '[]'::jsonb,
        internal_flow JSONB NOT NULL DEFAULT '[]'::jsonb,
        shared_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
        entry_points JSONB NOT NULL DEFAULT '[]'::jsonb,
        exit_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_SKILL_TREES_TABLE} (
        id SERIAL PRIMARY KEY,
        tree_id TEXT UNIQUE NOT NULL,
        root_goal TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        skill_sets JSONB NOT NULL DEFAULT '[]'::jsonb,
        global_entities JSONB NOT NULL DEFAULT '[]'::jsonb,
        cross_links JSONB NOT NULL DEFAULT '[]'::jsonb,
        owner_scope TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_SKILL_RUNS_TABLE} (
        id SERIAL PRIMARY KEY,
        tree_id TEXT,
        skill_set_id TEXT,
        skill_id TEXT,
        mode TEXT,
        input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        output_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        success BOOLEAN,
        quality_score DOUBLE PRECISION,
        duration_ms INTEGER,
        context_switches INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_COLLECTION_TABLE} (
        id SERIAL PRIMARY KEY,
        entry_id TEXT UNIQUE NOT NULL,
        category TEXT NOT NULL,
        title TEXT,
        content TEXT,
        source_ref TEXT,
        score DOUBLE PRECISION,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_ALBUMS_TABLE} (
        id SERIAL PRIMARY KEY,
        album_id TEXT UNIQUE NOT NULL,
        collection_entry_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        domain TEXT,
        track_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
        fragment_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
        instruction_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_FILTERED_TABLE} (
        id SERIAL PRIMARY KEY,
        filtered_id TEXT UNIQUE NOT NULL,
        session_id TEXT,
        track_id TEXT,
        source_ref TEXT,
        generation_insights TEXT,
        operator_trajectory TEXT,
        temporal_phases TEXT,
        metric_v DOUBLE PRECISION,
        metric_s DOUBLE PRECISION,
        metric_d_f DOUBLE PRECISION,
        metric_r_t DOUBLE PRECISION,
        creative_choices TEXT,
        emergence_moments TEXT,
        next_vector_suggestions TEXT,
        domain TEXT,
        recursion_depth INTEGER,
        stability_flag TEXT,
        raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_CUSTOM_INSTRUCTIONS_TABLE} (
        id SERIAL PRIMARY KEY,
        instruction_id TEXT UNIQUE NOT NULL,
        title TEXT,
        category TEXT,
        instruction_text TEXT NOT NULL,
        source_label TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${MMSS_TRACKS_PROMPTS_TABLE} (
        id SERIAL PRIMARY KEY,
        prompt_id TEXT UNIQUE NOT NULL,
        track_id TEXT,
        prompt_text TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_GENERATION_RESULTS_TABLE}_mode_created
      ON ${MMSS_GENERATION_RESULTS_TABLE} (mode, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_SKILLS_TABLE}_updated
      ON ${MMSS_SKILLS_TABLE} (updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_SKILL_SETS_TABLE}_updated
      ON ${MMSS_SKILL_SETS_TABLE} (updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_SKILL_TREES_TABLE}_owner_scope
      ON ${MMSS_SKILL_TREES_TABLE} (owner_scope, updated_at DESC);
    `);
    await client.query(`
      ALTER TABLE ${MMSS_SKILL_TREES_TABLE}
      ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_SKILL_RUNS_TABLE}_tree_skill
      ON ${MMSS_SKILL_RUNS_TABLE} (tree_id, skill_set_id, skill_id, created_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_COLLECTION_TABLE}_category_updated
      ON ${MMSS_COLLECTION_TABLE} (category, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_ALBUMS_TABLE}_domain_updated
      ON ${MMSS_ALBUMS_TABLE} (domain, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_FILTERED_TABLE}_session_track
      ON ${MMSS_FILTERED_TABLE} (session_id, track_id, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_CUSTOM_INSTRUCTIONS_TABLE}_category_updated
      ON ${MMSS_CUSTOM_INSTRUCTIONS_TABLE} (category, updated_at DESC);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_${MMSS_TRACKS_PROMPTS_TABLE}_track_updated
      ON ${MMSS_TRACKS_PROMPTS_TABLE} (track_id, updated_at DESC);
    `);
  } finally {
    client.release();
  }
}

async function logGenerationResult(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const resultId = payload.resultId || createStableId('mmss_gen', {
    mode: payload.mode,
    query: payload.query,
    createdAt: payload.createdAt || new Date().toISOString(),
    operation: payload.metadata?.operation || null,
  });

  await getPool(databaseName).query(`
    INSERT INTO ${MMSS_GENERATION_RESULTS_TABLE} (
      result_id, mode, model, query, answer, source_scopes, retrieved_sources,
      prompt_context_text, debug_payload, metadata, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9::jsonb, $10::jsonb, NOW()
    )
    ON CONFLICT (result_id)
    DO UPDATE SET
      mode = EXCLUDED.mode,
      model = EXCLUDED.model,
      query = EXCLUDED.query,
      answer = EXCLUDED.answer,
      source_scopes = EXCLUDED.source_scopes,
      retrieved_sources = EXCLUDED.retrieved_sources,
      prompt_context_text = EXCLUDED.prompt_context_text,
      debug_payload = EXCLUDED.debug_payload,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `, [
    resultId,
    String(payload.mode || 'unknown'),
    payload.model || null,
    String(payload.query || ''),
    payload.answer || null,
    JSON.stringify(payload.sourceScopes || []),
    JSON.stringify(payload.retrievedSources || []),
    payload.promptContextText || null,
    JSON.stringify(payload.debug || {}),
    JSON.stringify(payload.metadata || {}),
  ]);

  return resultId;
}

async function upsertSkillTreeDesign(databaseName, design = {}, options = {}) {
  await ensureSchema(databaseName);
  const client = await getPool(databaseName).connect();
  const nowIso = new Date().toISOString();

  const skills = Array.isArray(design.skills) ? design.skills : [];
  const skillSet = design.skill_set || {};
  const skillTree = design.skill_tree || {};
  const ownerScope = String(options.ownerScope || 'global');
  const treeVersion = Number.isFinite(Number(skillTree?.version))
    ? Math.max(1, Math.floor(Number(skillTree.version)))
    : 1;

  try {
    await client.query('BEGIN');

    for (const skill of skills) {
      const skillId = skill.skill_id || createStableId('skill', { goal: design.problem_map?.goal, name: skill.name });
      await client.query(`
        INSERT INTO ${MMSS_SKILLS_TABLE} (
          skill_id, name, description, inputs, outputs, prerequisites, failure_modes, metrics, metadata, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
        ON CONFLICT (skill_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          inputs = EXCLUDED.inputs,
          outputs = EXCLUDED.outputs,
          prerequisites = EXCLUDED.prerequisites,
          failure_modes = EXCLUDED.failure_modes,
          metrics = EXCLUDED.metrics,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        skillId,
        skill.name || skillId,
        skill.description || '',
        JSON.stringify(skill.inputs || []),
        JSON.stringify(skill.outputs || []),
        JSON.stringify(skill.prerequisites || []),
        JSON.stringify(skill.failure_modes || []),
        JSON.stringify(skill.metrics || {}),
        JSON.stringify({
          ...(skill.metadata || {}),
          generated_at: nowIso,
        }),
      ]);
      skill.skill_id = skillId;
    }

    const skillSetId = skillSet.skill_set_id || createStableId('skillset', {
      goal: design.problem_map?.goal,
      name: skillSet.name || 'default',
    });
    await client.query(`
      INSERT INTO ${MMSS_SKILL_SETS_TABLE} (
        skill_set_id, name, purpose, skills, internal_flow, shared_entities, entry_points, exit_artifacts, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
      ON CONFLICT (skill_set_id)
      DO UPDATE SET
        name = EXCLUDED.name,
        purpose = EXCLUDED.purpose,
        skills = EXCLUDED.skills,
        internal_flow = EXCLUDED.internal_flow,
        shared_entities = EXCLUDED.shared_entities,
        entry_points = EXCLUDED.entry_points,
        exit_artifacts = EXCLUDED.exit_artifacts,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      skillSetId,
      skillSet.name || skillSetId,
      skillSet.purpose || '',
      JSON.stringify((skillSet.skills || skills.map((skill) => skill.skill_id)).filter(Boolean)),
      JSON.stringify(skillSet.internal_flow || []),
      JSON.stringify(skillSet.shared_entities || []),
      JSON.stringify(skillSet.entry_points || []),
      JSON.stringify(skillSet.exit_artifacts || []),
      JSON.stringify({
        ...(skillSet.metadata || {}),
        generated_at: nowIso,
      }),
    ]);
    skillSet.skill_set_id = skillSetId;

    const treeId = skillTree.tree_id || createStableId('tree', {
      goal: design.problem_map?.goal,
      ownerScope,
      skillSetId,
    });
    await client.query(`
      INSERT INTO ${MMSS_SKILL_TREES_TABLE} (
        tree_id, root_goal, version, skill_sets, global_entities, cross_links, owner_scope, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8::jsonb, NOW())
      ON CONFLICT (tree_id)
      DO UPDATE SET
        root_goal = EXCLUDED.root_goal,
        version = EXCLUDED.version,
        skill_sets = EXCLUDED.skill_sets,
        global_entities = EXCLUDED.global_entities,
        cross_links = EXCLUDED.cross_links,
        owner_scope = EXCLUDED.owner_scope,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `, [
      treeId,
      skillTree.root_goal || design.problem_map?.goal || '',
      treeVersion,
      JSON.stringify(skillTree.skill_sets || [skillSetId]),
      JSON.stringify(skillTree.global_entities || []),
      JSON.stringify(skillTree.cross_links || []),
      ownerScope,
      JSON.stringify({
        ...(skillTree.metadata || {}),
        version: treeVersion,
        problem_map: design.problem_map || {},
        diagnosed_problem_space: design.diagnosed_problem_space || {},
        generated_at: nowIso,
      }),
    ]);
    skillTree.tree_id = treeId;
    skillTree.version = treeVersion;

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return {
    skills,
    skill_set: skillSet,
    skill_tree: skillTree,
  };
}

async function getRuntimeHealth(databaseName) {
  await ensureSchema(databaseName);
  const checks = await Promise.all([
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_GENERATION_RESULTS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILLS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILL_SETS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILL_TREES_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILL_RUNS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_COLLECTION_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_ALBUMS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_FILTERED_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_CUSTOM_INSTRUCTIONS_TABLE}`),
    getPool(databaseName).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_TRACKS_PROMPTS_TABLE}`),
  ]);

  return {
    database: databaseName,
    tables: {
      mmss_generation_results: checks[0].rows[0]?.count || 0,
      mmss_skills: checks[1].rows[0]?.count || 0,
      mmss_skill_sets: checks[2].rows[0]?.count || 0,
      mmss_skill_trees: checks[3].rows[0]?.count || 0,
      mmss_skill_runs: checks[4].rows[0]?.count || 0,
      mmss_collection: checks[5].rows[0]?.count || 0,
      mmss_albums: checks[6].rows[0]?.count || 0,
      mmss_filtered: checks[7].rows[0]?.count || 0,
      mmss_custom_instructions: checks[8].rows[0]?.count || 0,
      mmss_tracks_prompts: checks[9].rows[0]?.count || 0,
    },
  };
}

function extractJsonCandidatesFromText(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const snippets = [];
  for (const match of source.matchAll(/```json\s*([\s\S]*?)```/gi)) {
    if (match?.[1]) {
      snippets.push(match[1].trim());
    }
  }

  if (!snippets.length) {
    const firstBrace = source.indexOf('{');
    const lastBrace = source.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      snippets.push(source.slice(firstBrace, lastBrace + 1).trim());
    }
    const firstBracket = source.indexOf('[');
    const lastBracket = source.lastIndexOf(']');
    if (firstBracket >= 0 && lastBracket > firstBracket) {
      snippets.push(source.slice(firstBracket, lastBracket + 1).trim());
    }
  }

  if (!snippets.length) {
    snippets.push(source);
  }

  return snippets;
}

function parseGeneratedAnswerPayload(payload = {}) {
  const answer = payload?.answerResult?.answer ?? payload?.answer ?? payload?.result?.answer ?? null;
  const directJson = payload?.answerResult?.json || payload?.json || payload?.result?.json || null;
  if (directJson && typeof directJson === 'object') {
    return directJson;
  }

  for (const snippet of extractJsonCandidatesFromText(answer)) {
    try {
      return JSON.parse(snippet);
    } catch (_error) {
      // Try next candidate.
    }
  }

  return null;
}

function normalizeAlbumTracks(rawTracks) {
  if (!Array.isArray(rawTracks)) return [];
  return rawTracks
    .map((track, index) => {
      if (typeof track === 'string') {
        return {
          index: index + 1,
          title: track.trim() || `Track ${index + 1}`,
          prompt: null,
          operatorNotes: null,
          jsonPrompt: null,
          tools: [],
        };
      }

      if (!track || typeof track !== 'object') {
        return null;
      }

      const title = safeText(track.title || track.name || track.track_title || track.track);
      const prompt = safeText(track.prompt || track.prompt_text || track.description || track.generation_prompt);
      const operatorNotes = safeText(track.operator_notes || track.operatorNotes || track.notes || track.mmss_notes);
      const jsonPrompt = track.json_prompt || track.flowmusic_json || track.final_json || track.payload || null;
      const tools = Array.isArray(track.tools)
        ? track.tools
        : Array.isArray(track.tool_chain)
          ? track.tool_chain
          : Array.isArray(track.instruments_used)
            ? track.instruments_used
            : [];

      return {
        index: Number.isFinite(Number(track.index)) ? Number(track.index) : index + 1,
        title: title || `Track ${index + 1}`,
        prompt,
        operatorNotes,
        jsonPrompt,
        tools: tools.filter(Boolean),
      };
    })
    .filter(Boolean);
}

function normalizeGeneratedAlbumDraft(payload = {}) {
  const parsed = parseGeneratedAnswerPayload(payload);
  const query = safeText(payload?.query || payload?.answerResult?.query);
  const mode = safeText(payload?.mode || payload?.answerResult?.mode);
  const raw = parsed && typeof parsed === 'object' && parsed.album && typeof parsed.album === 'object'
    ? parsed.album
    : parsed;

  const tracks = normalizeAlbumTracks(
    raw?.tracks
      || raw?.tracklist
      || raw?.album_tracks
      || raw?.items,
  );

  const title = safeText(
    raw?.title
      || raw?.album_title
      || raw?.name
      || raw?.concept_title,
  ) || safeText(`Album Draft ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);

  const description = safeText(
    raw?.description
      || raw?.concept
      || raw?.summary
      || raw?.narrative
      || raw?.worldbuilding
      || query,
  );

  const domain = safeText(
    raw?.domain
      || raw?.style
      || raw?.genre
      || raw?.world
      || raw?.theme,
  );

  return {
    parsed,
    album: {
      title,
      description,
      domain,
      mode,
      query,
      tracks,
      raw,
    },
  };
}

function parseTrackTitlesFromAlbumContext(contextText) {
  const text = String(contextText || '');
  const match = text.match(/track_refs:\s*(\[[\s\S]*?\])/i);
  if (!match?.[1]) {
    return [];
  }
  try {
    const parsed = JSON.parse(match[1]);
    return Array.isArray(parsed)
      ? parsed.map((entry) => safeText(entry?.title)).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

function detectCopiedAlbumDraft(payload = {}, normalized = {}) {
  const album = normalized.album || {};
  const answerResult = payload.answerResult || payload.result || {};
  const contextBlocks = Array.isArray(answerResult.contextBlocks)
    ? answerResult.contextBlocks
    : Array.isArray(payload.contextBlocks)
      ? payload.contextBlocks
      : [];
  const generatedTitle = safeText(album.title).toLowerCase();
  const generatedTracks = new Set((album.tracks || []).map((track) => safeText(track.title).toLowerCase()).filter(Boolean));
  if (!generatedTitle || !generatedTracks.size) {
    return null;
  }

  for (const block of contextBlocks) {
    if (String(block?.source_table || '').trim() !== MMSS_ALBUMS_TABLE) {
      continue;
    }
    const sourceTitle = safeText(block?.source_title).toLowerCase();
    const sourceTracks = parseTrackTitlesFromAlbumContext(block?.context_text)
      .map((title) => title.toLowerCase())
      .filter(Boolean);
    if (!sourceTitle || !sourceTracks.length) {
      continue;
    }

    const overlapCount = sourceTracks.filter((title) => generatedTracks.has(title)).length;
    const overlapRatio = overlapCount / Math.max(sourceTracks.length, generatedTracks.size);
    if (generatedTitle === sourceTitle && overlapRatio >= 0.75) {
      return {
        sourceTitle: block?.source_title || null,
        overlapCount,
        sourceTrackCount: sourceTracks.length,
        overlapRatio,
      };
    }
  }

  return null;
}

function buildAlbumCollectionContent(album = {}) {
  const header = [
    safeText(album.title) ? `title: ${album.title}` : null,
    safeText(album.domain) ? `domain: ${album.domain}` : null,
    safeText(album.description) ? `description: ${album.description}` : null,
  ].filter(Boolean);

  const trackLines = (album.tracks || []).map((track) => [
    `track_${track.index}: ${track.title}`,
    safeText(track.prompt) ? `prompt: ${track.prompt}` : null,
    safeText(track.operatorNotes) ? `operator_notes: ${track.operatorNotes}` : null,
    Array.isArray(track.tools) && track.tools.length ? `tools: ${track.tools.join(', ')}` : null,
  ].filter(Boolean).join('\n'));

  return [...header, ...trackLines].filter(Boolean).join('\n\n');
}

function buildFlowmusicAlbumPayloadFromDraft(album = {}) {
  return {
    album_title: album.title || null,
    description: album.description || null,
    domain: album.domain || null,
    tracks: (album.tracks || []).map((track) => ({
      index: track.index,
      title: track.title || null,
      prompt: track.prompt || null,
      operator_notes: track.operatorNotes || null,
      json_prompt: track.jsonPrompt || null,
      tools: Array.isArray(track.tools) ? track.tools : [],
    })),
  };
}

async function saveCustomInstruction(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const instructionText = String(payload.instructionText || '').trim();
  if (!instructionText) {
    throw new Error('instructionText is required');
  }

  const instructionId = payload.instructionId || createStableId('mmss_instr', {
    title: payload.title || null,
    instructionText,
    category: payload.category || null,
  });

  const result = await getPool(databaseName).query(`
    INSERT INTO ${MMSS_CUSTOM_INSTRUCTIONS_TABLE} (
      instruction_id, title, category, instruction_text, source_label, metadata, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
    ON CONFLICT (instruction_id)
    DO UPDATE SET
      title = EXCLUDED.title,
      category = EXCLUDED.category,
      instruction_text = EXCLUDED.instruction_text,
      source_label = EXCLUDED.source_label,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
    RETURNING instruction_id, title, category, instruction_text, source_label, metadata, created_at, updated_at
  `, [
    instructionId,
    payload.title ? String(payload.title) : null,
    payload.category ? String(payload.category) : null,
    instructionText,
    payload.sourceLabel ? String(payload.sourceLabel) : null,
    JSON.stringify(payload.metadata || {}),
  ]);

  return result.rows[0] || null;
}

async function saveGeneratedAlbum(databaseName, payload = {}) {
  await ensureSchema(databaseName);

  const normalized = normalizeGeneratedAlbumDraft(payload);
  const album = normalized.album;
  if (!album.title || !(album.tracks || []).length) {
    throw new Error('Could not extract a valid album draft with tracks from the generated answer');
  }
  const copiedAlbum = detectCopiedAlbumDraft(payload, normalized);
  if (copiedAlbum) {
    throw new Error(`Generated album draft appears to copy retrieved album "${copiedAlbum.sourceTitle}" (${copiedAlbum.overlapCount}/${copiedAlbum.sourceTrackCount} track titles matched). Regenerate with a stricter album prompt.`);
  }

  const albumId = payload.albumId || `mmss_album_${Date.now()}_${crypto.createHash('sha1')
    .update(JSON.stringify({ title: album.title, query: album.query, mode: album.mode, trackCount: album.tracks.length }))
    .digest('hex')
    .slice(0, 8)}`;
  const collectionEntryId = payload.collectionEntryId || `album_collection_${albumId}`;
  const fragmentRefs = Array.isArray(payload.retrievedSources)
    ? payload.retrievedSources.map((source) => ({
      database: source.database || null,
      source_table: source.source_table || null,
      source_id: source.source_id || null,
      source_title: source.source_title || null,
    }))
    : [];
  const instructionRefs = fragmentRefs.filter((entry) => entry.source_table === MMSS_CUSTOM_INSTRUCTIONS_TABLE);
  const flowmusicPayload = buildFlowmusicAlbumPayloadFromDraft(album);

  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');

    await upsertCollectionEntry(client, {
      entryId: collectionEntryId,
      category: 'album_draft',
      title: album.title,
      content: buildAlbumCollectionContent(album),
      sourceRef: `mmss_albums:${albumId}`,
      score: Number.isFinite(Number(payload.score)) ? Number(payload.score) : 95,
      payload: {
        album,
        flowmusic_payload: flowmusicPayload,
        parsed_answer: normalized.parsed,
      },
      metadata: {
        source_table: MMSS_ALBUMS_TABLE,
        album_id: albumId,
        mode: album.mode,
        query: album.query,
        generated_via: 'local_rag_album_save',
      },
    });

    const result = await client.query(`
      INSERT INTO ${MMSS_ALBUMS_TABLE} (
        album_id, collection_entry_id, title, description, domain,
        track_refs, fragment_refs, instruction_refs, metadata, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, NOW())
      ON CONFLICT (album_id)
      DO UPDATE SET
        collection_entry_id = EXCLUDED.collection_entry_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        domain = EXCLUDED.domain,
        track_refs = EXCLUDED.track_refs,
        fragment_refs = EXCLUDED.fragment_refs,
        instruction_refs = EXCLUDED.instruction_refs,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING id, album_id, collection_entry_id, title, description, domain, created_at, updated_at
    `, [
      albumId,
      collectionEntryId,
      album.title,
      album.description,
      album.domain,
      JSON.stringify(album.tracks),
      JSON.stringify(fragmentRefs),
      JSON.stringify(instructionRefs),
      JSON.stringify({
        mode: album.mode,
        query: album.query,
        answer_result: payload.answerResult || payload,
        flowmusic_payload: flowmusicPayload,
        generated_via: 'local_rag_album_save',
      }),
    ]);

    await client.query('COMMIT');

    return {
      album: result.rows[0] || null,
      collectionEntryId,
      flowmusicPayload,
      trackCount: album.tracks.length,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function buildGeneratedAlbumFlowmusicPayload(_databaseName, payload = {}) {
  const normalized = normalizeGeneratedAlbumDraft(payload);
  const album = normalized.album;
  if (!album.title || !(album.tracks || []).length) {
    throw new Error('Could not build Flowmusic payload because the generated answer does not contain a parseable album draft');
  }
  const copiedAlbum = detectCopiedAlbumDraft(payload, normalized);
  if (copiedAlbum) {
    throw new Error(`Generated album draft appears to copy retrieved album "${copiedAlbum.sourceTitle}" (${copiedAlbum.overlapCount}/${copiedAlbum.sourceTrackCount} track titles matched). Regenerate before building Flowmusic payload.`);
  }

  return {
    album,
    flowmusicPayload: buildFlowmusicAlbumPayloadFromDraft(album),
    parsedAnswer: normalized.parsed,
  };
}

async function listCustomInstructions(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Number.isFinite(Number(options.limit))
    ? Math.max(1, Math.min(200, Math.floor(Number(options.limit))))
    : 100;
  const result = await getPool(databaseName).query(`
    SELECT instruction_id, title, category, instruction_text, source_label, metadata, created_at, updated_at
    FROM ${MMSS_CUSTOM_INSTRUCTIONS_TABLE}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows;
}

async function syncTrackPrompts(databaseName) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    INSERT INTO ${MMSS_TRACKS_PROMPTS_TABLE} (
      prompt_id, track_id, prompt_text, metadata, updated_at
    )
    SELECT
      CONCAT('track_prompt_', COALESCE(id::text, md5(prompt))),
      id::text,
      prompt,
      jsonb_build_object(
        'title', title,
        'session_id', session_id,
        'source', 'tracks.prompt'
      ),
      NOW()
    FROM tracks
    WHERE prompt IS NOT NULL
      AND BTRIM(prompt) <> ''
    ON CONFLICT (prompt_id)
    DO UPDATE SET
      track_id = EXCLUDED.track_id,
      prompt_text = EXCLUDED.prompt_text,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `);

  const countResult = await getPool(databaseName).query(`
    SELECT COUNT(*)::int AS count
    FROM ${MMSS_TRACKS_PROMPTS_TABLE}
  `);

  return {
    upsertedRows: result.rowCount || 0,
    totalRows: countResult.rows[0]?.count || 0,
  };
}

function collectFilteredCandidates(value, path = '$', bucket = []) {
  const TARGET_KEYS = [
    'generation_insights',
    'operator_trajectory',
    'temporal_phases',
    'metric_snapshot',
    'creative_choices',
    'emergence_moments',
    'next_vector_suggestions',
    'D_metric',
    'stability_flag',
    'seed',
    'domain',
    'recursion_depth',
  ];

  function hasTargetKeys(entry) {
    return Boolean(entry) && typeof entry === 'object' && TARGET_KEYS.some((key) => Object.prototype.hasOwnProperty.call(entry, key));
  }

  function extractJsonObjectsFromText(text) {
    const source = String(text || '');
    if (!source.trim()) return [];

    const snippets = [];
    const fencedMatches = source.matchAll(/```json\s*([\s\S]*?)```/gi);
    for (const match of fencedMatches) {
      if (match?.[1]) {
        snippets.push(match[1].trim());
      }
    }

    if (!snippets.length && (source.includes('{') || source.includes('['))) {
      snippets.push(source.trim());
    }

    const parsed = [];
    for (const snippet of snippets) {
      try {
        parsed.push(JSON.parse(snippet));
      } catch (_error) {
        // Ignore non-JSON text blobs.
      }
    }
    return parsed;
  }

  function normalizeSpecialPayload(entry) {
    if (!entry || typeof entry !== 'object') return null;

    if (hasTargetKeys(entry)) {
      return entry;
    }

    if (entry.MMSS_ASE_IDEAL_ALIGNMENT && typeof entry.MMSS_ASE_IDEAL_ALIGNMENT === 'object') {
      const source = entry.MMSS_ASE_IDEAL_ALIGNMENT;
      return {
        generation_insights: source.notes || null,
        operator_trajectory: source.system_state?.observer || source.system_state?.process || null,
        temporal_phases: source.system_state?.mode || null,
        metric_snapshot: {
          V: source.core_parameters?.V_velocity ?? null,
          S: source.core_parameters?.S_stability ?? null,
          D_f: source.core_parameters?.D_f_fractal_dimension ?? null,
          R_T: source.core_parameters?.R_T_ratio ?? null,
        },
        creative_choices: source.status || null,
        domain: source.protocol_id || null,
        recursion_depth: null,
        stability_flag: source.status || null,
      };
    }

    if (entry.hyperloop_iteration && typeof entry.hyperloop_iteration === 'object') {
      const source = entry.hyperloop_iteration;
      return {
        generation_insights: source.self_analysis?.coherence || source.self_analysis?.narrative_fidelity || null,
        operator_trajectory: Array.isArray(source.applied_operators) ? source.applied_operators.join(' -> ') : null,
        temporal_phases: Array.isArray(source.l1_core) ? source.l1_core.join(' -> ') : null,
        creative_choices: source.artwork_spec || source.self_analysis?.generated_rule_r || null,
        domain: source.id || null,
        recursion_depth: null,
        stability_flag: null,
      };
    }

    return null;
  }

  if (typeof value === 'string') {
    const parsedEntries = extractJsonObjectsFromText(value);
    parsedEntries.forEach((parsed, index) => {
      collectFilteredCandidates(parsed, `${path}#json[${index}]`, bucket);
    });
    return bucket;
  }

  if (!value || typeof value !== 'object') {
    return bucket;
  }

  const normalizedPayload = normalizeSpecialPayload(value);
  if (normalizedPayload && hasTargetKeys(normalizedPayload)) {
    bucket.push({ path, payload: normalizedPayload });
  } else if (hasTargetKeys(value)) {
    bucket.push({ path, payload: value });
  }

  if (Array.isArray(value)) {
    value.forEach((child, index) => collectFilteredCandidates(child, `${path}[${index}]`, bucket));
    return bucket;
  }

  for (const [key, child] of Object.entries(value)) {
    if (typeof child === 'string') {
      collectFilteredCandidates(child, `${path}.${key}`, bucket);
    } else if (child && typeof child === 'object') {
      collectFilteredCandidates(child, `${path}.${key}`, bucket);
    }
  }

  return bucket;
}

function toMetricNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function buildCollectionTitle(row) {
  const parts = [
    safeText(row.domain),
    safeText(row.metadata?.title),
    safeText(row.track_id ? `track ${row.track_id}` : null),
    safeText(row.session_id ? `session ${row.session_id}` : null),
  ].filter(Boolean);
  return parts[0] || parts[1] || parts[2] || parts[3] || 'MMSS curated fragment';
}

function buildCollectionContent(row) {
  const fragments = [
    safeText(row.generation_insights) ? `generation_insights: ${row.generation_insights}` : null,
    safeText(row.operator_trajectory) ? `operator_trajectory: ${row.operator_trajectory}` : null,
    safeText(row.temporal_phases) && row.temporal_phases !== 'null' ? `temporal_phases: ${row.temporal_phases}` : null,
    safeText(row.creative_choices) ? `creative_choices: ${row.creative_choices}` : null,
    safeText(row.emergence_moments) ? `emergence_moments: ${row.emergence_moments}` : null,
    safeText(row.next_vector_suggestions) ? `next_vector_suggestions: ${row.next_vector_suggestions}` : null,
    safeText(row.domain) ? `domain: ${row.domain}` : null,
    (row.metric_v != null || row.metric_s != null || row.metric_d_f != null || row.metric_r_t != null)
      ? `metric_snapshot: ${JSON.stringify({
        V: row.metric_v,
        S: row.metric_s,
        D_f: row.metric_d_f,
        R_T: row.metric_r_t,
      })}`
      : null,
    safeText(row.stability_flag) ? `stability_flag: ${row.stability_flag}` : null,
  ].filter(Boolean);
  return fragments.join('\n');
}

function scoreFilteredRow(row) {
  let score = 0;

  if (safeText(row.generation_insights)) score += 30;
  if (safeText(row.operator_trajectory)) score += 18;
  if (safeText(row.temporal_phases) && row.temporal_phases !== 'null') score += 14;
  if (safeText(row.creative_choices)) score += 16;
  if (safeText(row.emergence_moments)) score += 16;
  if (safeText(row.next_vector_suggestions)) score += 14;
  if (safeText(row.domain)) score += 12;
  if (row.metric_v != null) score += 8;
  if (row.metric_s != null) score += 8;
  if (row.metric_d_f != null) score += 8;
  if (row.metric_r_t != null) score += 8;
  if (safeText(row.stability_flag)) score += 6;
  if (Number.isFinite(Number(row.recursion_depth))) score += Math.min(8, Number(row.recursion_depth) * 2);
  if (safeText(row.track_id)) score += 4;
  if (safeText(row.session_id)) score += 4;

  const contentLength = buildCollectionContent(row).length;
  score += Math.min(24, Math.floor(contentLength / 80));

  return score;
}

async function upsertCollectionEntry(client, payload = {}) {
  const entryId = payload.entryId || createStableId('mmss_collection', {
    category: payload.category,
    sourceRef: payload.sourceRef,
    title: payload.title,
  });

  await client.query(`
    INSERT INTO ${MMSS_COLLECTION_TABLE} (
      entry_id, category, title, content, source_ref, score, payload, metadata, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, NOW())
    ON CONFLICT (entry_id)
    DO UPDATE SET
      category = EXCLUDED.category,
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      source_ref = EXCLUDED.source_ref,
      score = EXCLUDED.score,
      payload = EXCLUDED.payload,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `, [
    entryId,
    payload.category || 'filtered_curated',
    payload.title || null,
    payload.content || null,
    payload.sourceRef || null,
    Number.isFinite(Number(payload.score)) ? Number(payload.score) : null,
    JSON.stringify(payload.payload || {}),
    JSON.stringify(payload.metadata || {}),
  ]);
}

async function upsertFilteredEntry(client, payload = {}) {
  const sourceTag = payload.trackId ? `track:${payload.trackId}` : `session:${payload.sessionId}`;
  const filteredId = payload.filteredId || createStableId('mmss_filtered', {
    sourceTag,
    sourceRef: payload.sourceRef,
    generationInsights: payload.generationInsights || null,
    operatorTrajectory: payload.operatorTrajectory || null,
  });

  await client.query(`
    INSERT INTO ${MMSS_FILTERED_TABLE} (
      filtered_id, session_id, track_id, source_ref, generation_insights, operator_trajectory,
      temporal_phases, metric_v, metric_s, metric_d_f, metric_r_t,
      creative_choices, emergence_moments, next_vector_suggestions,
      domain, recursion_depth, stability_flag, raw_payload, metadata, updated_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11,
      $12, $13, $14,
      $15, $16, $17, $18::jsonb, $19::jsonb, NOW()
    )
    ON CONFLICT (filtered_id)
    DO UPDATE SET
      session_id = EXCLUDED.session_id,
      track_id = EXCLUDED.track_id,
      source_ref = EXCLUDED.source_ref,
      generation_insights = EXCLUDED.generation_insights,
      operator_trajectory = EXCLUDED.operator_trajectory,
      temporal_phases = EXCLUDED.temporal_phases,
      metric_v = EXCLUDED.metric_v,
      metric_s = EXCLUDED.metric_s,
      metric_d_f = EXCLUDED.metric_d_f,
      metric_r_t = EXCLUDED.metric_r_t,
      creative_choices = EXCLUDED.creative_choices,
      emergence_moments = EXCLUDED.emergence_moments,
      next_vector_suggestions = EXCLUDED.next_vector_suggestions,
      domain = EXCLUDED.domain,
      recursion_depth = EXCLUDED.recursion_depth,
      stability_flag = EXCLUDED.stability_flag,
      raw_payload = EXCLUDED.raw_payload,
      metadata = EXCLUDED.metadata,
      updated_at = NOW()
  `, [
    filteredId,
    payload.sessionId || null,
    payload.trackId || null,
    payload.sourceRef || null,
    payload.generationInsights || null,
    payload.operatorTrajectory || null,
    payload.temporalPhases || null,
    toMetricNumber(payload.metricV),
    toMetricNumber(payload.metricS),
    toMetricNumber(payload.metricDf),
    toMetricNumber(payload.metricRt),
    payload.creativeChoices || null,
    payload.emergenceMoments || null,
    payload.nextVectorSuggestions || null,
    payload.domain || null,
    Number.isFinite(Number(payload.recursionDepth)) ? Math.floor(Number(payload.recursionDepth)) : null,
    payload.stabilityFlag || null,
    JSON.stringify(payload.rawPayload || {}),
    JSON.stringify(payload.metadata || {}),
  ]);
}

async function syncMmssFiltered(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const sessionLimit = Number.isFinite(Number(options.sessionLimit))
    ? Math.max(1, Math.min(500, Math.floor(Number(options.sessionLimit))))
    : 250;
  const trackLimit = Number.isFinite(Number(options.trackLimit))
    ? Math.max(1, Math.min(1000, Math.floor(Number(options.trackLimit))))
    : 500;

  const pool = getPool(databaseName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sessionRows = await client.query(`
      SELECT id, title, ai_snapshot, config, updated_at
      FROM sessions
      WHERE ai_snapshot IS NOT NULL OR config IS NOT NULL
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $1
    `, [sessionLimit]);

    const trackRows = await client.query(`
      SELECT id, title, session_id, raw_data, conditions, last_synced, archived_at, created_at
      FROM tracks
      WHERE raw_data IS NOT NULL OR conditions IS NOT NULL
      ORDER BY COALESCE(last_synced, archived_at, created_at) DESC NULLS LAST
      LIMIT $1
    `, [trackLimit]);

    let upserted = 0;

    for (const row of sessionRows.rows) {
      const candidates = [
        ...collectFilteredCandidates(row.ai_snapshot, '$.ai_snapshot'),
        ...collectFilteredCandidates(row.config, '$.config'),
      ];
      for (const candidate of candidates) {
        const payload = candidate.payload || {};
        const metrics = payload.metric_snapshot || {};
        await upsertFilteredEntry(client, {
          sessionId: String(row.id),
          sourceRef: `sessions:${row.id}:${candidate.path}`,
          generationInsights: payload.generation_insights,
          operatorTrajectory: payload.operator_trajectory,
          temporalPhases: typeof payload.temporal_phases === 'string'
            ? payload.temporal_phases
            : JSON.stringify(payload.temporal_phases || null),
          metricV: metrics.V,
          metricS: metrics.S,
          metricDf: metrics.D_f,
          metricRt: metrics.R_T,
          creativeChoices: payload.creative_choices,
          emergenceMoments: payload.emergence_moments,
          nextVectorSuggestions: payload.next_vector_suggestions,
          domain: payload.domain,
          recursionDepth: payload.recursion_depth,
          stabilityFlag: payload.stability_flag,
          rawPayload: payload,
          metadata: {
            source_table: 'sessions',
            source_path: candidate.path,
            title: row.title || null,
            updated_at: row.updated_at || null,
          },
        });
        upserted += 1;
      }
    }

    for (const row of trackRows.rows) {
      const candidates = [
        ...collectFilteredCandidates(row.raw_data, '$.raw_data'),
        ...collectFilteredCandidates(row.conditions, '$.conditions'),
      ];
      for (const candidate of candidates) {
        const payload = candidate.payload || {};
        const metrics = payload.metric_snapshot || {};
        await upsertFilteredEntry(client, {
          sessionId: row.session_id ? String(row.session_id) : null,
          trackId: String(row.id),
          sourceRef: `tracks:${row.id}:${candidate.path}`,
          generationInsights: payload.generation_insights,
          operatorTrajectory: payload.operator_trajectory,
          temporalPhases: typeof payload.temporal_phases === 'string'
            ? payload.temporal_phases
            : JSON.stringify(payload.temporal_phases || null),
          metricV: metrics.V,
          metricS: metrics.S,
          metricDf: metrics.D_f,
          metricRt: metrics.R_T,
          creativeChoices: payload.creative_choices,
          emergenceMoments: payload.emergence_moments,
          nextVectorSuggestions: payload.next_vector_suggestions,
          domain: payload.domain,
          recursionDepth: payload.recursion_depth,
          stabilityFlag: payload.stability_flag,
          rawPayload: payload,
          metadata: {
            source_table: 'tracks',
            source_path: candidate.path,
            title: row.title || null,
            updated_at: row.last_synced || row.archived_at || row.created_at || null,
          },
        });
        upserted += 1;
      }
    }

    await client.query('COMMIT');

    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM ${MMSS_FILTERED_TABLE}
    `);

    return {
      upsertedRows: upserted,
      totalRows: countResult.rows[0]?.count || 0,
      scannedSessions: sessionRows.rowCount || 0,
      scannedTracks: trackRows.rowCount || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function syncCollectionFromFiltered(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const rowLimit = Number.isFinite(Number(options.rowLimit))
    ? Math.max(1, Math.min(20000, Math.floor(Number(options.rowLimit))))
    : 10000;
  const minScore = Number.isFinite(Number(options.minScore))
    ? Math.max(1, Math.min(200, Math.floor(Number(options.minScore))))
    : 70;
  const maxRows = Number.isFinite(Number(options.maxRows))
    ? Math.max(1, Math.min(5000, Math.floor(Number(options.maxRows))))
    : 1500;

  const pool = getPool(databaseName);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const filteredRows = await client.query(`
      SELECT
        filtered_id,
        session_id,
        track_id,
        source_ref,
        generation_insights,
        operator_trajectory,
        temporal_phases,
        metric_v,
        metric_s,
        metric_d_f,
        metric_r_t,
        creative_choices,
        emergence_moments,
        next_vector_suggestions,
        domain,
        recursion_depth,
        stability_flag,
        raw_payload,
        metadata,
        created_at,
        updated_at
      FROM ${MMSS_FILTERED_TABLE}
      ORDER BY updated_at DESC, created_at DESC
      LIMIT $1
    `, [rowLimit]);

    const curatedRows = filteredRows.rows
      .map((row) => ({
        ...row,
        score: scoreFilteredRow(row),
        content: buildCollectionContent(row),
        title: buildCollectionTitle(row),
      }))
      .filter((row) => row.score >= minScore && safeText(row.content))
      .sort((a, b) => b.score - a.score)
      .slice(0, maxRows);

    let upsertedRows = 0;
    for (const row of curatedRows) {
      await upsertCollectionEntry(client, {
        entryId: `filtered_curated_${row.filtered_id}`,
        category: 'filtered_curated',
        title: row.title,
        content: row.content,
        sourceRef: row.source_ref,
        score: row.score,
        payload: {
          filtered_id: row.filtered_id,
          session_id: row.session_id,
          track_id: row.track_id,
          generation_insights: row.generation_insights,
          operator_trajectory: row.operator_trajectory,
          temporal_phases: row.temporal_phases,
          metric_snapshot: {
            V: row.metric_v,
            S: row.metric_s,
            D_f: row.metric_d_f,
            R_T: row.metric_r_t,
          },
          creative_choices: row.creative_choices,
          emergence_moments: row.emergence_moments,
          next_vector_suggestions: row.next_vector_suggestions,
          domain: row.domain,
          recursion_depth: row.recursion_depth,
          stability_flag: row.stability_flag,
          raw_payload: row.raw_payload || {},
        },
        metadata: {
          ...(row.metadata || {}),
          source_table: 'mmss_filtered',
          source_filtered_id: row.filtered_id,
          curated_by: 'syncCollectionFromFiltered',
          curated_category: 'filtered_curated',
          min_score: minScore,
        },
      });
      upsertedRows += 1;
    }

    await client.query('COMMIT');

    const countResult = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM ${MMSS_COLLECTION_TABLE}
      WHERE category = 'filtered_curated'
    `);

    return {
      scannedRows: filteredRows.rowCount || 0,
      selectedRows: curatedRows.length,
      upsertedRows,
      minScore,
      maxRows,
      totalCuratedRows: countResult.rows[0]?.count || 0,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function logSkillRun(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    INSERT INTO ${MMSS_SKILL_RUNS_TABLE} (
      tree_id, skill_set_id, skill_id, mode, input_payload, output_payload,
      success, quality_score, duration_ms, context_switches, metadata
    )
    VALUES (
      $1, $2, $3, $4, $5::jsonb, $6::jsonb,
      $7, $8, $9, $10, $11::jsonb
    )
    RETURNING id, created_at
  `, [
    payload.treeId || null,
    payload.skillSetId || null,
    payload.skillId || null,
    payload.mode || null,
    JSON.stringify(payload.inputPayload || {}),
    JSON.stringify(payload.outputPayload || {}),
    typeof payload.success === 'boolean' ? payload.success : null,
    Number.isFinite(Number(payload.qualityScore)) ? Number(payload.qualityScore) : null,
    Number.isFinite(Number(payload.durationMs)) ? Math.floor(Number(payload.durationMs)) : null,
    Number.isFinite(Number(payload.contextSwitches)) ? Math.floor(Number(payload.contextSwitches)) : null,
    JSON.stringify(payload.metadata || {}),
  ]);

  return {
    id: result.rows[0]?.id || null,
    createdAt: result.rows[0]?.created_at || null,
  };
}

module.exports = {
  buildGeneratedAlbumFlowmusicPayload,
  MMSS_GENERATION_RESULTS_TABLE,
  MMSS_SKILLS_TABLE,
  MMSS_SKILL_SETS_TABLE,
  MMSS_SKILL_TREES_TABLE,
  MMSS_SKILL_RUNS_TABLE,
  MMSS_COLLECTION_TABLE,
  MMSS_ALBUMS_TABLE,
  MMSS_FILTERED_TABLE,
  MMSS_CUSTOM_INSTRUCTIONS_TABLE,
  MMSS_TRACKS_PROMPTS_TABLE,
  ensureSchema,
  getRuntimeHealth,
  listCustomInstructions,
  logGenerationResult,
  logSkillRun,
  saveGeneratedAlbum,
  saveCustomInstruction,
  syncCollectionFromFiltered,
  syncMmssFiltered,
  syncTrackPrompts,
  upsertSkillTreeDesign,
};
