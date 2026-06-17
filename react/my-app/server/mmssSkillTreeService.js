const {
  answerWithRag,
  normalizeDatabaseIdentifier,
} = require('./localRagService');
const {
  ensureSchema,
  logGenerationResult,
  logSkillRun,
  upsertSkillTreeDesign,
} = require('./mmssRuntimePersistenceService');

const JOB_TTL_MS = 1000 * 60 * 60 * 6;
const jobs = new Map();

function createJobId() {
  return `mmss_skill_tree_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function cleanupJobs() {
  const now = Date.now();
  for (const [jobId, job] of jobs.entries()) {
    if (now - job.startedAtMs > JOB_TTL_MS) {
      jobs.delete(jobId);
    }
  }
}

function extractFirstJsonObject(text) {
  const source = String(text || '').trim();
  if (!source) {
    throw new Error('Empty skill tree design response');
  }

  try {
    return JSON.parse(source);
  } catch (_error) {
    // fallback below
  }

  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error('Skill tree design response did not contain JSON');
  }

  return JSON.parse(source.slice(start, end + 1));
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeDesignPayload(payload, goal, ownerScope) {
  const normalized = asObject(payload);
  const problemMap = asObject(normalized.problem_map);
  const diagnosedProblemSpace = asObject(normalized.diagnosed_problem_space);
  const skillSet = asObject(normalized.skill_set);
  const skillTree = asObject(normalized.skill_tree);
  const skills = Array.isArray(normalized.skills) ? normalized.skills.filter((entry) => entry && typeof entry === 'object') : [];

  const normalizedSkills = skills.map((skill, index) => ({
    ...asObject(skill),
    skill_id: skill.skill_id || skill.id || null,
    name: skill.name || skill.title || `skill_${index + 1}`,
    description: skill.description || skill.summary || '',
    inputs: Array.isArray(skill.inputs) ? skill.inputs : [],
    outputs: Array.isArray(skill.outputs) ? skill.outputs : [],
    prerequisites: Array.isArray(skill.prerequisites) ? skill.prerequisites : [],
    failure_modes: Array.isArray(skill.failure_modes) ? skill.failure_modes : [],
    metrics: asObject(skill.metrics),
    metadata: asObject(skill.metadata),
  }));

  const normalizedSkillIds = normalizedSkills.map((skill) => skill.skill_id || skill.id).filter(Boolean);

  return {
    problem_map: {
      goal,
      nodes: Array.isArray(problemMap.nodes) ? problemMap.nodes : [],
      summary: typeof problemMap.summary === 'string' ? problemMap.summary : null,
      constraints: Array.isArray(problemMap.constraints) ? problemMap.constraints : [],
    },
    diagnosed_problem_space: {
      constraints: Array.isArray(diagnosedProblemSpace.constraints)
        ? diagnosedProblemSpace.constraints
        : [],
      gaps: Array.isArray(diagnosedProblemSpace.gaps)
        ? diagnosedProblemSpace.gaps
        : [],
      signals: Array.isArray(diagnosedProblemSpace.signals)
        ? diagnosedProblemSpace.signals
        : [],
      summary: typeof diagnosedProblemSpace.summary === 'string' ? diagnosedProblemSpace.summary : null,
    },
    skills: normalizedSkills,
    skill_set: {
      ...skillSet,
      name: skillSet.name || skillSet.title || 'Generated Skill Set',
      purpose: skillSet.purpose || skillSet.description || '',
      skills: Array.isArray(skillSet.skills)
        ? skillSet.skills
        : Array.isArray(skillSet.skills_referenced)
          ? skillSet.skills_referenced
          : normalizedSkillIds,
      internal_flow: Array.isArray(skillSet.internal_flow) ? skillSet.internal_flow : [],
      shared_entities: Array.isArray(skillSet.shared_entities) ? skillSet.shared_entities : [],
      entry_points: Array.isArray(skillSet.entry_points) ? skillSet.entry_points : [],
      exit_artifacts: Array.isArray(skillSet.exit_artifacts) ? skillSet.exit_artifacts : [],
      metadata: asObject(skillSet.metadata),
    },
    skill_tree: {
      ...skillTree,
      owner_scope: ownerScope,
      root_goal: skillTree.root_goal || goal,
      skill_sets: Array.isArray(skillTree.skill_sets)
        ? skillTree.skill_sets
        : [],
      global_entities: Array.isArray(skillTree.global_entities) ? skillTree.global_entities : [],
      cross_links: Array.isArray(skillTree.cross_links) ? skillTree.cross_links : [],
      metadata: asObject(skillTree.metadata),
    },
  };
}

function buildDesignRequest(options = {}) {
  const database = normalizeDatabaseIdentifier(options.database);
  const goal = String(options.goal || '').trim();
  if (!goal) {
    throw new Error('goal is required');
  }

  return {
    database,
    goal,
    ownerScope: String(options.ownerScope || 'global'),
    contextHint: String(options.contextHint || '').trim(),
    sourceTables: options.sourceTables,
    sourceScopes: options.sourceScopes,
    topK: options.topK,
    queryBudget: options.queryBudget,
    filterProfile: options.filterProfile || 'balanced',
    includeRelationLayer: options.includeRelationLayer,
    mode: options.mode || 'mmss_operator_assist',
    model: options.model,
    responseMaxChars: options.responseMaxChars || 40000,
  };
}

function buildDesignResultSummary(result) {
  const skillCount = Array.isArray(result?.design?.skills) ? result.design.skills.length : 0;
  const skillSetId = result?.design?.skill_set_id || result?.design?.skillSetId || null;
  const treeId = result?.design?.tree_id || result?.design?.treeId || null;
  return {
    database: result?.database || null,
    ownerScope: result?.ownerScope || null,
    generationResultId: result?.generationResultId || null,
    treeId,
    skillSetId,
    skillCount,
  };
}

async function executeDesignSkillTree(options = {}) {
  const request = buildDesignRequest(options);
  await ensureSchema(request.database);

  const ragResult = await answerWithRag({
    database: request.database,
    query: request.contextHint ? `${request.goal}\n\nAdditional context hint: ${request.contextHint}` : request.goal,
    topK: request.topK,
    sourceTables: request.sourceTables,
    sourceScopes: request.sourceScopes,
    queryBudget: request.queryBudget,
    filterProfile: request.filterProfile,
    includeRelationLayer: request.includeRelationLayer,
    mode: request.mode,
    model: request.model,
    responseMaxChars: request.responseMaxChars,
    systemPrompt: [
      'You are designing a minimal MMSS skill tree runtime artifact.',
      'Use only the retrieved MMSS context.',
      'Return JSON only.',
      'Do not add prose outside JSON.',
      'Return an object with keys: problem_map, diagnosed_problem_space, skills, skill_set, skill_tree.',
      'Skills must be atomic and reusable.',
      'skill_set must reference the produced skills.',
      'skill_tree must reference the produced skill_set and owner scope.',
    ].join(' '),
  });

  const parsed = extractFirstJsonObject(ragResult.answer);
  const normalizedDesign = normalizeDesignPayload(parsed, request.goal, request.ownerScope);
  const persisted = await upsertSkillTreeDesign(request.database, normalizedDesign, { ownerScope: request.ownerScope });

  const generationResultId = await logGenerationResult(request.database, {
    mode: 'mmss_skill_tree_design',
    model: ragResult.model,
    query: request.goal,
    answer: JSON.stringify(normalizedDesign, null, 2),
    sourceScopes: ragResult.sourceScopes,
    retrievedSources: ragResult.retrievedSources,
    promptContextText: ragResult.promptContextText,
    debug: {
      ...(ragResult.debug || {}),
      operation: 'skill_tree_design',
    },
    metadata: {
      operation: 'skill_tree_design',
      owner_scope: request.ownerScope,
      context_hint: request.contextHint || null,
    },
  });

  return {
    database: request.database,
    ownerScope: request.ownerScope,
    generationResultId,
    rag: {
      query: ragResult.query,
      model: ragResult.model,
      sourceScopes: ragResult.sourceScopes,
      retrievedSources: ragResult.retrievedSources,
      debug: ragResult.debug,
    },
    design: {
      ...normalizedDesign,
      ...persisted,
    },
  };
}

async function designSkillTree(options = {}) {
  return executeDesignSkillTree(options);
}

async function runDesignSkillTreeJob(job) {
  job.lastStage = 'ensuring_schema';
  job.updatedAt = new Date().toISOString();
  await ensureSchema(job.database);

  if (job.cancelRequested) {
    job.status = 'cancelled';
    job.lastStage = 'cancelled_before_execution';
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    return;
  }

  job.lastStage = 'running_design';
  job.progress = 20;
  job.updatedAt = new Date().toISOString();

  const result = await executeDesignSkillTree(job.request);

  if (job.cancelRequested) {
    job.status = 'cancelled';
    job.lastStage = 'cancelled_after_execution';
    job.progress = 100;
    job.resultSummary = buildDesignResultSummary(result);
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();
    return;
  }

  job.status = 'completed';
  job.lastStage = 'completed';
  job.progress = 100;
  job.resultSummary = buildDesignResultSummary(result);
  job.result = result;
  job.completedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();
}

async function startDesignSkillTreeJob(options = {}) {
  cleanupJobs();
  const request = buildDesignRequest(options);
  const activeJob = Array.from(jobs.values()).find(
    (job) => job.database === request.database && job.status === 'running',
  );
  if (activeJob) {
    return activeJob;
  }

  const job = {
    jobId: createJobId(),
    database: request.database,
    goal: request.goal,
    ownerScope: request.ownerScope,
    sourceTables: Array.isArray(request.sourceTables) ? request.sourceTables.filter(Boolean) : [],
    sourceScopes: Array.isArray(request.sourceScopes) ? request.sourceScopes.filter(Boolean) : [],
    topK: request.topK ?? null,
    queryBudget: request.queryBudget ?? null,
    filterProfile: request.filterProfile,
    includeRelationLayer: Boolean(request.includeRelationLayer),
    mode: request.mode,
    model: request.model || null,
    responseMaxChars: request.responseMaxChars,
    status: 'running',
    progress: 0,
    lastStage: 'queued',
    error: null,
    result: null,
    resultSummary: null,
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    cancelRequested: false,
    request,
  };

  jobs.set(job.jobId, job);

  Promise.resolve()
    .then(() => runDesignSkillTreeJob(job))
    .catch((error) => {
      job.status = 'failed';
      job.lastStage = 'failed';
      job.error = error?.message || 'MMSS skill tree design job failed';
      job.completedAt = new Date().toISOString();
      job.updatedAt = new Date().toISOString();
    });

  return job;
}

function getDesignSkillTreeJobStatus(jobId) {
  cleanupJobs();
  return jobs.get(jobId) || null;
}

function cancelDesignSkillTreeJob(jobId) {
  cleanupJobs();
  const job = jobs.get(jobId);
  if (!job) return null;
  if (job.status === 'running') {
    job.cancelRequested = true;
    job.lastStage = 'cancel_requested';
    job.updatedAt = new Date().toISOString();
  }
  return job;
}

module.exports = {
  cancelDesignSkillTreeJob,
  designSkillTree,
  getDesignSkillTreeJobStatus,
  runDummySkillTreeExecution: async function runDummySkillTreeExecution(options = {}) {
    const database = normalizeDatabaseIdentifier(options.database);
    await ensureSchema(database);
    const startedAt = Date.now();

    const run = await logSkillRun(database, {
      treeId: options.treeId || 'dummy_tree',
      skillSetId: options.skillSetId || 'dummy_skill_set',
      skillId: options.skillId || 'dummy_skill',
      mode: options.mode || 'dummy',
      inputPayload: options.inputPayload || {},
      outputPayload: {
        status: 'noop',
        note: 'Dummy runtime execution recorded successfully.',
      },
      success: true,
      qualityScore: 1,
      durationMs: Date.now() - startedAt,
      contextSwitches: 0,
      metadata: {
        operation: 'skill_tree_run_dummy',
        origin: 'mmss_skill_tree_run_dummy',
      },
    });

    return {
      database,
      run,
      status: 'ok',
    };
  },
  startDesignSkillTreeJob,
};
