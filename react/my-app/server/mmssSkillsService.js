const crypto = require('crypto');
const { getPool } = require('../db');
const {
  ANSWER_MODEL,
  answerWithRag,
  normalizeDatabaseIdentifier,
} = require('./localRagService');
const {
  ensureSchema,
  logGenerationResult,
  logSkillRun,
  MMSS_GENERATION_RESULTS_TABLE,
  MMSS_SKILLS_TABLE,
  MMSS_SKILL_RUNS_TABLE,
  MMSS_SKILL_SETS_TABLE,
  MMSS_SKILL_TREES_TABLE,
} = require('./mmssRuntimePersistenceService');

function createId(prefix, payload) {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload || {})).digest('hex').slice(0, 12);
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

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  try {
    return new Date(value).toISOString();
  } catch (_error) {
    return null;
  }
}

function normalizeTags(value) {
  return asArray(value)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function normalizeSkillRow(row) {
  const metadata = asObject(row.metadata);
  return {
    skill_id: row.skill_id,
    name: row.name,
    description: row.description || '',
    inputs: asArray(row.inputs).map(String),
    outputs: asArray(row.outputs).map(String),
    owner_scope: asText(metadata.owner_scope, 'global'),
    source: asText(metadata.source, 'manual'),
    tags: normalizeTags(metadata.tags),
    prompt_template: asText(metadata.prompt_template, ''),
    prerequisites: asArray(row.prerequisites),
    failure_modes: asArray(row.failure_modes),
    metrics: asObject(row.metrics),
    metadata,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeSkillSetRow(row) {
  const metadata = asObject(row.metadata);
  return {
    skill_set_id: row.skill_set_id,
    name: row.name,
    description: row.purpose || '',
    skill_ids: asArray(row.skills).map(String),
    flow: asArray(row.internal_flow),
    shared_entities: asArray(row.shared_entities),
    entry_points: asArray(row.entry_points),
    exit_artifacts: asArray(row.exit_artifacts),
    owner_scope: asText(metadata.owner_scope, 'global'),
    metadata,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeSkillTreeRow(row) {
  const metadata = asObject(row.metadata);
  return {
    tree_id: row.tree_id,
    name: asText(metadata.name, row.tree_id),
    root_goal: row.root_goal || '',
    version: String(row.version || 1),
    skill_set_ids: asArray(row.skill_sets).map(String),
    global_entities: asArray(row.global_entities),
    cross_links: asArray(row.cross_links),
    owner_scope: asText(row.owner_scope, 'global'),
    metadata,
    created_at: toIso(row.created_at),
    updated_at: toIso(row.updated_at),
  };
}

function normalizeRunRow(row) {
  const inputPayload = asObject(row.input_payload);
  const outputPayload = asObject(row.output_payload);
  const metadata = asObject(row.metadata);
  return {
    id: String(row.id),
    tree_id: row.tree_id || null,
    skill_set_id: row.skill_set_id || null,
    skill_id: row.skill_id || null,
    mode: row.mode || 'skill_execute',
    success: Boolean(row.success),
    quality_score: Number.isFinite(Number(row.quality_score)) ? Number(row.quality_score) : 0,
    duration_ms: Number.isFinite(Number(row.duration_ms)) ? Number(row.duration_ms) : 0,
    context_switches: Number.isFinite(Number(row.context_switches)) ? Number(row.context_switches) : 0,
    query: asText(inputPayload.query),
    answer: asText(outputPayload.answer),
    metadata,
    created_at: toIso(row.created_at),
  };
}

function normalizeGenerationRow(row) {
  const metadata = asObject(row.metadata);
  return {
    id: row.result_id,
    query: row.query || '',
    mode: row.mode || 'unknown',
    model: row.model || ANSWER_MODEL,
    answer: row.answer || '',
    prompt_context_text: row.prompt_context_text || '',
    retrieved_sources: asArray(row.retrieved_sources),
    debug: asObject(row.debug_payload),
    metadata,
    created_at: toIso(row.created_at),
  };
}

function replacePromptVariables(template, variables) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

function extractJsonObject(text) {
  const source = asText(text);
  if (!source) {
    throw new Error('Empty JSON response');
  }

  try {
    return JSON.parse(source);
  } catch (_error) {
    // fallback below
  }

  const fencedMatch = source.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return JSON.parse(fencedMatch[1].trim());
  }

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('JSON object not found in model response');
  }
  return JSON.parse(source.slice(start, end + 1));
}

function normalizeSkillProposal(proposal, index) {
  const payload = asObject(proposal);
  return {
    name: asText(payload.name, `generated_skill_${index + 1}`),
    description: asText(payload.description || payload.summary),
    inputs: asArray(payload.inputs).map(String),
    outputs: asArray(payload.outputs).map(String),
    tags: normalizeTags(payload.tags),
    prompt_template: asText(payload.prompt_template || payload.promptTemplate),
    rationale: asText(payload.rationale || payload.reasoning),
  };
}

function normalizeGenerateResult(payload, request, tookMs) {
  const problemMap = asObject(payload.problem_map);
  const diagnosedProblemSpace = asObject(payload.diagnosed_problem_space);
  const proposedSkillSet = asObject(payload.proposed_skill_set);
  const proposedSkills = asArray(payload.proposed_skills)
    .slice(0, request.maxSkills)
    .map(normalizeSkillProposal);

  return {
    goal: request.goal,
    problem_map: {
      goal: request.goal,
      nodes: asArray(problemMap.nodes).map((node, index) => ({
        id: asText(node?.id, `node_${index + 1}`),
        label: asText(node?.label || node?.name, `Node ${index + 1}`),
        constraints: asArray(node?.constraints).map(String),
      })),
    },
    diagnosed_problem_space: {
      constraints: asArray(diagnosedProblemSpace.constraints).map(String),
      gaps: asArray(diagnosedProblemSpace.gaps).map(String),
      signals: asArray(diagnosedProblemSpace.signals).map(String),
    },
    proposed_skills: proposedSkills,
    proposed_skill_set: Object.keys(proposedSkillSet).length
      ? {
          name: asText(proposedSkillSet.name, 'Generated Skill Set'),
          description: asText(proposedSkillSet.description || proposedSkillSet.purpose),
          flow: asArray(proposedSkillSet.flow || proposedSkillSet.internal_flow),
        }
      : null,
    took_ms: tookMs,
  };
}

function clampQualityScore(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
}

async function listSkills(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 200));
  const result = await getPool(databaseName).query(`
    SELECT skill_id, name, description, inputs, outputs, prerequisites, failure_modes, metrics, metadata, created_at, updated_at
    FROM ${MMSS_SKILLS_TABLE}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeSkillRow);
}

async function getSkill(databaseName, skillId) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT skill_id, name, description, inputs, outputs, prerequisites, failure_modes, metrics, metadata, created_at, updated_at
    FROM ${MMSS_SKILLS_TABLE}
    WHERE skill_id = $1
    LIMIT 1
  `, [skillId]);
  if (!result.rows.length) {
    throw new Error(`Skill not found: ${skillId}`);
  }
  return normalizeSkillRow(result.rows[0]);
}

async function saveSkill(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const skillId = asText(payload.skill_id || payload.skillId) || createId('skill', {
    name: payload.name,
    owner_scope: payload.owner_scope,
    ts: Date.now(),
  });
  const metadata = {
    ...asObject(payload.metadata),
    owner_scope: asText(payload.owner_scope, 'global'),
    source: asText(payload.source, 'manual'),
    tags: normalizeTags(payload.tags),
    prompt_template: asText(payload.prompt_template),
  };

  await getPool(databaseName).query(`
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
    asText(payload.name, skillId),
    asText(payload.description),
    JSON.stringify(asArray(payload.inputs).map(String)),
    JSON.stringify(asArray(payload.outputs).map(String)),
    JSON.stringify(asArray(payload.prerequisites)),
    JSON.stringify(asArray(payload.failure_modes)),
    JSON.stringify(asObject(payload.metrics)),
    JSON.stringify(metadata),
  ]);

  return getSkill(databaseName, skillId);
}

async function deleteSkill(databaseName, skillId) {
  await ensureSchema(databaseName);
  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${MMSS_SKILLS_TABLE} WHERE skill_id = $1`, [skillId]);

    const setResult = await client.query(`
      SELECT skill_set_id, name, purpose, skills, internal_flow, shared_entities, entry_points, exit_artifacts, metadata
      FROM ${MMSS_SKILL_SETS_TABLE}
      WHERE skills @> $1::jsonb
    `, [JSON.stringify([skillId])]);

    for (const row of setResult.rows) {
      const skills = asArray(row.skills).map(String).filter((entry) => entry !== skillId);
      const internalFlow = asArray(row.internal_flow).filter((edge) => edge?.from !== skillId && edge?.to !== skillId);
      await client.query(`
        UPDATE ${MMSS_SKILL_SETS_TABLE}
        SET skills = $2::jsonb, internal_flow = $3::jsonb, updated_at = NOW()
        WHERE skill_set_id = $1
      `, [row.skill_set_id, JSON.stringify(skills), JSON.stringify(internalFlow)]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { deleted: skillId };
}

async function listSkillSets(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 200));
  const result = await getPool(databaseName).query(`
    SELECT skill_set_id, name, purpose, skills, internal_flow, shared_entities, entry_points, exit_artifacts, metadata, created_at, updated_at
    FROM ${MMSS_SKILL_SETS_TABLE}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeSkillSetRow);
}

async function getSkillSet(databaseName, skillSetId) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT skill_set_id, name, purpose, skills, internal_flow, shared_entities, entry_points, exit_artifacts, metadata, created_at, updated_at
    FROM ${MMSS_SKILL_SETS_TABLE}
    WHERE skill_set_id = $1
    LIMIT 1
  `, [skillSetId]);
  if (!result.rows.length) {
    throw new Error(`Skill set not found: ${skillSetId}`);
  }
  return normalizeSkillSetRow(result.rows[0]);
}

async function saveSkillSet(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const skillSetId = asText(payload.skill_set_id || payload.skillSetId) || createId('skillset', {
    name: payload.name,
    owner_scope: payload.owner_scope,
    ts: Date.now(),
  });
  const metadata = {
    ...asObject(payload.metadata),
    owner_scope: asText(payload.owner_scope, 'global'),
  };

  await getPool(databaseName).query(`
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
    asText(payload.name, skillSetId),
    asText(payload.description || payload.purpose),
    JSON.stringify(asArray(payload.skill_ids || payload.skills).map(String)),
    JSON.stringify(asArray(payload.flow || payload.internal_flow)),
    JSON.stringify(asArray(payload.shared_entities)),
    JSON.stringify(asArray(payload.entry_points)),
    JSON.stringify(asArray(payload.exit_artifacts)),
    JSON.stringify(metadata),
  ]);

  return getSkillSet(databaseName, skillSetId);
}

async function deleteSkillSet(databaseName, skillSetId) {
  await ensureSchema(databaseName);
  const client = await getPool(databaseName).connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${MMSS_SKILL_SETS_TABLE} WHERE skill_set_id = $1`, [skillSetId]);

    const treeResult = await client.query(`
      SELECT tree_id, skill_sets
      FROM ${MMSS_SKILL_TREES_TABLE}
      WHERE skill_sets @> $1::jsonb
    `, [JSON.stringify([skillSetId])]);

    for (const row of treeResult.rows) {
      const skillSets = asArray(row.skill_sets).map(String).filter((entry) => entry !== skillSetId);
      await client.query(`
        UPDATE ${MMSS_SKILL_TREES_TABLE}
        SET skill_sets = $2::jsonb, updated_at = NOW()
        WHERE tree_id = $1
      `, [row.tree_id, JSON.stringify(skillSets)]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return { deleted: skillSetId };
}

async function listSkillTrees(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 200));
  const result = await getPool(databaseName).query(`
    SELECT tree_id, root_goal, version, skill_sets, global_entities, cross_links, owner_scope, metadata, created_at, updated_at
    FROM ${MMSS_SKILL_TREES_TABLE}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeSkillTreeRow);
}

async function getSkillTree(databaseName, treeId) {
  await ensureSchema(databaseName);
  const result = await getPool(databaseName).query(`
    SELECT tree_id, root_goal, version, skill_sets, global_entities, cross_links, owner_scope, metadata, created_at, updated_at
    FROM ${MMSS_SKILL_TREES_TABLE}
    WHERE tree_id = $1
    LIMIT 1
  `, [treeId]);
  if (!result.rows.length) {
    throw new Error(`Skill tree not found: ${treeId}`);
  }
  return normalizeSkillTreeRow(result.rows[0]);
}

async function saveSkillTree(databaseName, payload = {}) {
  await ensureSchema(databaseName);
  const treeId = asText(payload.tree_id || payload.treeId) || createId('tree', {
    root_goal: payload.root_goal,
    owner_scope: payload.owner_scope,
    ts: Date.now(),
  });
  const metadata = {
    ...asObject(payload.metadata),
    name: asText(payload.name, treeId),
  };

  await getPool(databaseName).query(`
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
    asText(payload.root_goal),
    Math.max(1, Number(payload.version) || 1),
    JSON.stringify(asArray(payload.skill_set_ids || payload.skill_sets).map(String)),
    JSON.stringify(asArray(payload.global_entities)),
    JSON.stringify(asArray(payload.cross_links)),
    asText(payload.owner_scope, 'global'),
    JSON.stringify(metadata),
  ]);

  return getSkillTree(databaseName, treeId);
}

async function deleteSkillTree(databaseName, treeId) {
  await ensureSchema(databaseName);
  await getPool(databaseName).query(`DELETE FROM ${MMSS_SKILL_TREES_TABLE} WHERE tree_id = $1`, [treeId]);
  return { deleted: treeId };
}

async function listSkillRuns(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  const result = await getPool(databaseName).query(`
    SELECT id, tree_id, skill_set_id, skill_id, mode, input_payload, output_payload, success, quality_score, duration_ms, context_switches, metadata, created_at
    FROM ${MMSS_SKILL_RUNS_TABLE}
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeRunRow);
}

async function listGenerationResults(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const limit = Math.max(1, Math.min(500, Number(options.limit) || 100));
  const result = await getPool(databaseName).query(`
    SELECT result_id, query, mode, model, answer, prompt_context_text, retrieved_sources, debug_payload, metadata, created_at
    FROM ${MMSS_GENERATION_RESULTS_TABLE}
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit]);
  return result.rows.map(normalizeGenerationRow);
}

async function generateSkills(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const goal = asText(options.goal);
  if (!goal) {
    throw new Error('goal is required');
  }

  const request = {
    goal,
    ownerScope: asText(options.owner_scope || options.ownerScope, 'skills_workspace'),
    contextHint: asText(options.context_hint || options.contextHint),
    maxSkills: Math.max(1, Math.min(8, Number(options.max_skills || options.maxSkills) || 4)),
    topK: Math.max(1, Math.min(12, Number(options.top_k || options.topK) || 6)),
    queryBudget: Math.max(1, Math.min(24, Number(options.query_budget || options.queryBudget) || 8)),
    model: asText(options.model, ANSWER_MODEL),
  };

  const startedAt = Date.now();
  const ragResult = await answerWithRag({
    database: databaseName,
    query: request.contextHint ? `${request.goal}\n\nContext hint: ${request.contextHint}` : request.goal,
    topK: request.topK,
    queryBudget: request.queryBudget,
    mode: 'skills_workspace_generate',
    model: request.model,
    responseMaxChars: 24000,
    forceJsonResponse: true,
    systemPrompt: [
      'You are generating reusable MMSS skills for a local skills workspace.',
      'Use only the retrieved context.',
      'Return JSON only with keys: problem_map, diagnosed_problem_space, proposed_skills, proposed_skill_set.',
      `Return at most ${request.maxSkills} proposed_skills.`,
      'Each proposed skill must contain name, description, inputs, outputs, tags, prompt_template, rationale.',
      'proposed_skill_set should summarize an optional flow between the proposed skills.',
      'Do not include markdown fences or prose outside JSON.',
    ].join(' '),
  });

  const parsed = extractJsonObject(ragResult.answer);
  const normalized = normalizeGenerateResult(parsed, request, Date.now() - startedAt);

  await logGenerationResult(databaseName, {
    mode: 'skills_workspace_generate',
    model: ragResult.model,
    query: request.goal,
    answer: JSON.stringify(normalized, null, 2),
    sourceScopes: ragResult.sourceScopes,
    retrievedSources: ragResult.retrievedSources,
    promptContextText: ragResult.promptContextText,
    debug: {
      ...(ragResult.debug || {}),
      took_ms: normalized.took_ms,
      proposed_skill_count: normalized.proposed_skills.length,
    },
    metadata: {
      operation: 'problem_map',
      origin: 'skills_workspace',
      owner_scope: request.ownerScope,
      logged: true,
    },
  });

  return normalized;
}

async function saveGeneratedSkills(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const ownerScope = asText(options.owner_scope || options.ownerScope, 'skills_workspace');
  const proposals = asArray(options.proposals).map(normalizeSkillProposal);
  const created = [];

  for (const proposal of proposals) {
    created.push(await saveSkill(databaseName, {
      name: proposal.name,
      description: proposal.description,
      inputs: proposal.inputs,
      outputs: proposal.outputs,
      tags: proposal.tags,
      prompt_template: proposal.prompt_template,
      owner_scope: ownerScope,
      source: 'llm_generated',
      metadata: {
        rationale: proposal.rationale,
        origin: 'skills_workspace',
      },
    }));
  }

  return created;
}

async function executeSkill(databaseName, options = {}) {
  await ensureSchema(databaseName);
  const skillId = asText(options.skill_id || options.skillId);
  const query = asText(options.query);
  if (!skillId) {
    throw new Error('skill_id is required');
  }
  if (!query) {
    throw new Error('query is required');
  }

  const skill = await getSkill(databaseName, skillId);
  const inputs = asObject(options.inputs);
  const renderedPrompt = replacePromptVariables(skill.prompt_template || '', {
    query,
    ...inputs,
  });
  const runPrompt = [
    `Skill name: ${skill.name}`,
    skill.description ? `Skill description: ${skill.description}` : null,
    renderedPrompt ? `Skill template:\n${renderedPrompt}` : null,
    Object.keys(inputs).length ? `Named inputs: ${JSON.stringify(inputs, null, 2)}` : null,
    `Execution task: ${query}`,
  ].filter(Boolean).join('\n\n');

  const startedAt = Date.now();
  const ragResult = await answerWithRag({
    database: databaseName,
    query: runPrompt,
    topK: Math.max(1, Math.min(12, Number(options.top_k || options.topK) || 6)),
    queryBudget: Math.max(1, Math.min(24, Number(options.query_budget || options.queryBudget) || 8)),
    mode: 'skills_workspace_execute',
    model: asText(options.model, ANSWER_MODEL),
    responseMaxChars: 24000,
    systemPrompt: [
      'You are executing one MMSS skill inside the local skills workspace.',
      'Use the retrieved context and the skill template.',
      'Return the completed result directly.',
      'Do not explain the process unless it is needed for the skill output.',
    ].join(' '),
  });

  const durationMs = Date.now() - startedAt;
  const retrievedCount = asArray(ragResult.retrievedSources).length;
  const qualityScore = clampQualityScore(0.55 + Math.min(0.35, retrievedCount * 0.05));

  const runRecord = await logSkillRun(databaseName, {
    skillId: skill.skill_id,
    mode: 'skill_execute',
    inputPayload: {
      query,
      inputs,
      prompt_template: skill.prompt_template || '',
    },
    outputPayload: {
      answer: ragResult.answer,
      retrieved_sources: ragResult.retrievedSources,
    },
    success: true,
    qualityScore,
    durationMs,
    contextSwitches: Math.max(0, retrievedCount - 1),
    metadata: {
      operation: 'skill_execute',
      origin: 'skills_workspace',
      model: ragResult.model,
      prompt_chars: ragResult.debug?.promptChars || 0,
    },
  });

  await logGenerationResult(databaseName, {
    resultId: `skill_run_${runRecord.id}`,
    mode: 'skill_execute',
    model: ragResult.model,
    query,
    answer: ragResult.answer,
    sourceScopes: ragResult.sourceScopes,
    retrievedSources: ragResult.retrievedSources,
    promptContextText: ragResult.promptContextText,
    debug: ragResult.debug || {},
    metadata: {
      operation: 'skill_execute',
      origin: 'skills_workspace',
      logged: true,
      linked_run_id: runRecord.id,
      skill_id: skill.skill_id,
    },
  });

  return {
    run: {
      id: String(runRecord.id),
      tree_id: null,
      skill_set_id: null,
      skill_id: skill.skill_id,
      mode: 'skill_execute',
      success: true,
      quality_score: qualityScore,
      duration_ms: durationMs,
      context_switches: Math.max(0, retrievedCount - 1),
      query,
      answer: ragResult.answer,
      metadata: {
        operation: 'skill_execute',
        origin: 'skills_workspace',
        model: ragResult.model,
      },
      created_at: toIso(runRecord.createdAt),
    },
    skill,
    debug: {
      prompt_chars: Number(ragResult.debug?.promptChars || 0),
      tokens_generated: Number(ragResult.debug?.evalCount || 0),
      steps: [
        { label: 'Resolve skill', detail: skill.skill_id },
        { label: 'Render prompt', detail: renderedPrompt ? 'template + query merged' : 'query-only execution' },
        { label: 'Retrieve context', detail: `${retrievedCount} source(s) used` },
        { label: 'Generate answer', detail: `${durationMs}ms via ${ragResult.model}` },
      ],
    },
  };
}

module.exports = {
  normalizeSkillsDatabase(database) {
    return normalizeDatabaseIdentifier(database);
  },
  listSkills,
  saveSkill,
  deleteSkill,
  listSkillSets,
  saveSkillSet,
  deleteSkillSet,
  listSkillTrees,
  saveSkillTree,
  deleteSkillTree,
  listSkillRuns,
  listGenerationResults,
  generateSkills,
  saveGeneratedSkills,
  executeSkill,
};
