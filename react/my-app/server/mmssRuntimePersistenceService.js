const crypto = require('crypto');
const { getPool } = require('../db');

const MMSS_GENERATION_RESULTS_TABLE = 'mmss_generation_results';
const MMSS_SKILLS_TABLE = 'mmss_skills';
const MMSS_SKILL_SETS_TABLE = 'mmss_skill_sets';
const MMSS_SKILL_TREES_TABLE = 'mmss_skill_trees';
const MMSS_SKILL_RUNS_TABLE = 'mmss_skill_runs';

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
  ]);

  return {
    database: databaseName,
    tables: {
      mmss_generation_results: checks[0].rows[0]?.count || 0,
      mmss_skills: checks[1].rows[0]?.count || 0,
      mmss_skill_sets: checks[2].rows[0]?.count || 0,
      mmss_skill_trees: checks[3].rows[0]?.count || 0,
      mmss_skill_runs: checks[4].rows[0]?.count || 0,
    },
  };
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
  MMSS_GENERATION_RESULTS_TABLE,
  MMSS_SKILLS_TABLE,
  MMSS_SKILL_SETS_TABLE,
  MMSS_SKILL_TREES_TABLE,
  MMSS_SKILL_RUNS_TABLE,
  ensureSchema,
  getRuntimeHealth,
  logGenerationResult,
  logSkillRun,
  upsertSkillTreeDesign,
};
