const { getPool } = require("../db");
const {
  ensureSchema,
  MMSS_SKILLS_TABLE,
  MMSS_SKILL_SETS_TABLE,
  MMSS_SKILL_TREES_TABLE,
} = require("../server/mmssRuntimePersistenceService");

const DATABASE_NAME = process.argv[2] || process.env.PG_DATABASE || "abstract-mind-lab";

const skills = [
  {
    skill_id: "mmss_rag_scope_select",
    name: "RAG Scope Select",
    description: "Select the minimal valid retrieval scope with rag_chunks as the primary evidence layer and optional MMSS support tables.",
    inputs: ["goal", "mode", "available_tables"],
    outputs: ["source_scopes", "table_rationale"],
    prerequisites: [],
    failure_modes: ["empty_scope", "legacy_table_selected"],
    metrics: { precision_bias: 0.92, safety_bias: 0.95 },
    metadata: { domain: "retrieval", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_rag_query_expand",
    name: "RAG Query Expand",
    description: "Expand one operator request into several retrieval variants while preserving the original intent and MMSS terminology.",
    inputs: ["query", "mode"],
    outputs: ["query_variants"],
    prerequisites: ["mmss_rag_scope_select"],
    failure_modes: ["semantic_drift", "over_expansion"],
    metrics: { diversity: 0.84, intent_preservation: 0.94 },
    metadata: { domain: "retrieval", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_rag_context_assemble",
    name: "RAG Context Assemble",
    description: "Assemble prompt context from retrieved chunks, invariants, patterns, and curated MMSS fragments.",
    inputs: ["retrieved_sources", "query", "mode"],
    outputs: ["prompt_context_text", "context_blocks", "relation_blocks"],
    prerequisites: ["mmss_rag_query_expand"],
    failure_modes: ["context_overload", "missing_primary_evidence"],
    metrics: { grounding: 0.93, compression: 0.81 },
    metadata: { domain: "retrieval", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_operator_map",
    name: "MMSS Operator Map",
    description: "Map a task to MMSS operators, phases, domain patterns, and reusable execution motifs.",
    inputs: ["goal", "context_blocks"],
    outputs: ["operator_plan", "phase_plan"],
    prerequisites: ["mmss_rag_context_assemble"],
    failure_modes: ["weak_operator_alignment"],
    metrics: { alignment: 0.9, reuse_score: 0.87 },
    metadata: { domain: "operator", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_invariant_extract",
    name: "MMSS Invariant Extract",
    description: "Extract invariant forms, ontology anchors, and stable reusable MMSS rules from evidence.",
    inputs: ["context_blocks", "mode"],
    outputs: ["invariants", "ontology_anchors"],
    prerequisites: ["mmss_operator_map"],
    failure_modes: ["weak_invariant_signal"],
    metrics: { stability: 0.91, ontology_coverage: 0.86 },
    metadata: { domain: "operator", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_album_concept_generate",
    name: "Album Concept Generate",
    description: "Generate a new MMSS album concept with narrative arc, domain, mood logic, and album-scale identity.",
    inputs: ["goal", "context_blocks", "operator_plan"],
    outputs: ["album_concept", "album_domain", "narrative_arc"],
    prerequisites: ["mmss_invariant_extract"],
    failure_modes: ["concept_too_generic", "source_duplication"],
    metrics: { originality: 0.9, coherence: 0.92 },
    metadata: { domain: "album", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_id: "mmss_album_tracklist_synthesize",
    name: "Album Tracklist Synthesize",
    description: "Build an album tracklist with distinct per-track roles, motion, and operator-aware differentiation.",
    inputs: ["album_concept", "narrative_arc", "context_blocks"],
    outputs: ["tracklist", "track_roles"],
    prerequisites: ["mmss_album_concept_generate"],
    failure_modes: ["duplicate_tracks", "weak_progression"],
    metrics: { differentiation: 0.91, progression: 0.89 },
    metadata: { domain: "album", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_id: "mmss_album_prompt_write",
    name: "Album Prompt Write",
    description: "Write generation-ready prompts for each album track with style tags, tools, and operator notes.",
    inputs: ["tracklist", "operator_plan", "context_blocks"],
    outputs: ["track_prompts", "operator_notes"],
    prerequisites: ["mmss_album_tracklist_synthesize"],
    failure_modes: ["prompt_flatness", "style_leakage"],
    metrics: { usability: 0.94, prompt_specificity: 0.9 },
    metadata: { domain: "album", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_id: "mmss_album_json_validate",
    name: "Album JSON Validate",
    description: "Validate album output against the MMSS album JSON contract and ensure strict parseability.",
    inputs: ["track_prompts", "album_concept"],
    outputs: ["album_json", "validation_report"],
    prerequisites: ["mmss_album_prompt_write"],
    failure_modes: ["invalid_json", "schema_gap"],
    metrics: { schema_validity: 0.98, parseability: 0.99 },
    metadata: { domain: "album", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_id: "mmss_album_runtime_save",
    name: "Album Runtime Save",
    description: "Persist the generated album draft into mmss_albums and link it to collection/runtime artifacts.",
    inputs: ["album_json", "validation_report"],
    outputs: ["album_id", "collection_refs"],
    prerequisites: ["mmss_album_json_validate"],
    failure_modes: ["persistence_conflict"],
    metrics: { persistence_reliability: 0.97 },
    metadata: { domain: "album", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_id: "mmss_skill_gap_detect",
    name: "Skill Gap Detect",
    description: "Inspect the current runtime graph and determine which missing skills would increase quality or autonomy.",
    inputs: ["goal", "current_skills", "skill_runs"],
    outputs: ["missing_skills", "gap_rationale"],
    prerequisites: ["mmss_invariant_extract"],
    failure_modes: ["false_gap_detection"],
    metrics: { relevance: 0.88, autonomy_gain: 0.9 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_blueprint_generate",
    name: "Skill Blueprint Generate",
    description: "Generate a structured blueprint for a new MMSS skill including IO, prerequisites, failure modes, and metrics.",
    inputs: ["missing_skills", "gap_rationale", "context_blocks"],
    outputs: ["skill_blueprints"],
    prerequisites: ["mmss_skill_gap_detect"],
    failure_modes: ["underspecified_skill", "duplicate_skill_blueprint"],
    metrics: { blueprint_quality: 0.91, completeness: 0.9 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_contract_validate",
    name: "Skill Contract Validate",
    description: "Validate generated skills against MMSS runtime conventions and reject invalid or ambiguous contracts.",
    inputs: ["skill_blueprints"],
    outputs: ["validated_skill_blueprints", "contract_report"],
    prerequisites: ["mmss_skill_blueprint_generate"],
    failure_modes: ["contract_mismatch", "unsafe_output_shape"],
    metrics: { contract_safety: 0.96, reject_accuracy: 0.87 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_upsert_runtime",
    name: "Skill Upsert Runtime",
    description: "Insert or update generated MMSS skills inside the runtime registry.",
    inputs: ["validated_skill_blueprints", "owner_scope"],
    outputs: ["skill_ids", "upsert_report"],
    prerequisites: ["mmss_skill_contract_validate"],
    failure_modes: ["upsert_conflict"],
    metrics: { persistence_reliability: 0.97, idempotency: 0.99 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_set_compose",
    name: "Skill Set Compose",
    description: "Compose validated skills into a reusable skill set with flow edges, shared entities, and entry points.",
    inputs: ["skill_ids", "goal", "operator_plan"],
    outputs: ["skill_set_blueprint"],
    prerequisites: ["mmss_skill_upsert_runtime"],
    failure_modes: ["broken_internal_flow"],
    metrics: { set_coherence: 0.9, flow_quality: 0.88 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_tree_compose",
    name: "Skill Tree Compose",
    description: "Compose one or more skill sets into an owner-scoped skill tree with global entities and cross-links.",
    inputs: ["skill_set_blueprint", "owner_scope", "goal"],
    outputs: ["skill_tree_blueprint"],
    prerequisites: ["mmss_skill_set_compose"],
    failure_modes: ["tree_fragmentation"],
    metrics: { tree_coherence: 0.91, branch_reuse: 0.86 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_skill_tree_persist",
    name: "Skill Tree Persist",
    description: "Persist a composed skill tree into mmss_skill_trees and update owner scope metadata.",
    inputs: ["skill_tree_blueprint"],
    outputs: ["tree_id", "persistence_report"],
    prerequisites: ["mmss_skill_tree_compose"],
    failure_modes: ["owner_scope_mismatch"],
    metrics: { persistence_reliability: 0.98 },
    metadata: { domain: "skill_forge", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_runtime_plan_orchestrate",
    name: "Runtime Plan Orchestrate",
    description: "Build a step-by-step runtime plan from available skills, sets, and trees for a new task.",
    inputs: ["goal", "tree_id", "available_skills"],
    outputs: ["runtime_plan", "execution_order"],
    prerequisites: ["mmss_skill_tree_persist"],
    failure_modes: ["plan_cycle", "redundant_steps"],
    metrics: { plan_quality: 0.9, execution_clarity: 0.92 },
    metadata: { domain: "orchestration", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_quality_audit",
    name: "MMSS Quality Audit",
    description: "Audit a generated answer, album, or new skill against evidence, schema, and reuse criteria.",
    inputs: ["artifact", "context_blocks", "mode"],
    outputs: ["audit_report", "quality_score", "repair_actions"],
    prerequisites: ["mmss_runtime_plan_orchestrate"],
    failure_modes: ["audit_underfit"],
    metrics: { audit_precision: 0.91, repair_usefulness: 0.88 },
    metadata: { domain: "orchestration", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_id: "mmss_self_improvement_loop",
    name: "Self Improvement Loop",
    description: "Close the loop by feeding quality audit results back into skill generation and tree evolution.",
    inputs: ["audit_report", "quality_score", "tree_id"],
    outputs: ["improvement_tasks", "tree_evolution_patch"],
    prerequisites: ["mmss_quality_audit"],
    failure_modes: ["oscillation", "overfitting_to_last_run"],
    metrics: { autonomy_gain: 0.93, loop_stability: 0.85 },
    metadata: { domain: "orchestration", supports_album_creation: true, supports_skill_creation: true, autonomous: true },
  },
];

const skillSets = [
  {
    skill_set_id: "mmss_set_rag_context_core",
    name: "RAG Context Core",
    purpose: "Primary retrieval and context assembly pipeline using rag_chunks-first evidence.",
    skills: ["mmss_rag_scope_select", "mmss_rag_query_expand", "mmss_rag_context_assemble"],
    internal_flow: [
      { from: "mmss_rag_scope_select", to: "mmss_rag_query_expand", artifact: "source_scopes" },
      { from: "mmss_rag_query_expand", to: "mmss_rag_context_assemble", artifact: "query_variants" },
    ],
    shared_entities: ["source_scopes", "query_variants", "context_blocks"],
    entry_points: ["goal", "query"],
    exit_artifacts: ["prompt_context_text"],
    metadata: { owner_scope: "core_runtime", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_set_id: "mmss_set_operator_invariants",
    name: "Operator Invariants",
    purpose: "Map tasks to MMSS operators and extract invariant structures for downstream generation.",
    skills: ["mmss_operator_map", "mmss_invariant_extract"],
    internal_flow: [
      { from: "mmss_operator_map", to: "mmss_invariant_extract", artifact: "operator_plan" },
    ],
    shared_entities: ["operator_plan", "phase_plan", "invariants"],
    entry_points: ["context_blocks"],
    exit_artifacts: ["invariants", "ontology_anchors"],
    metadata: { owner_scope: "core_runtime", supports_album_creation: true, supports_skill_creation: true },
  },
  {
    skill_set_id: "mmss_set_album_factory",
    name: "Album Factory",
    purpose: "Generate new MMSS albums from evidence, convert them to strict JSON, and persist them into runtime storage.",
    skills: [
      "mmss_album_concept_generate",
      "mmss_album_tracklist_synthesize",
      "mmss_album_prompt_write",
      "mmss_album_json_validate",
      "mmss_album_runtime_save",
    ],
    internal_flow: [
      { from: "mmss_album_concept_generate", to: "mmss_album_tracklist_synthesize", artifact: "album_concept" },
      { from: "mmss_album_tracklist_synthesize", to: "mmss_album_prompt_write", artifact: "tracklist" },
      { from: "mmss_album_prompt_write", to: "mmss_album_json_validate", artifact: "track_prompts" },
      { from: "mmss_album_json_validate", to: "mmss_album_runtime_save", artifact: "album_json" },
    ],
    shared_entities: ["album_concept", "tracklist", "album_json"],
    entry_points: ["goal", "context_blocks", "operator_plan"],
    exit_artifacts: ["album_id", "collection_refs"],
    metadata: { owner_scope: "album_runtime", supports_album_creation: true, supports_skill_creation: false },
  },
  {
    skill_set_id: "mmss_set_skill_forge",
    name: "Skill Forge",
    purpose: "Create new MMSS skills from detected gaps and persist them safely into the runtime registry.",
    skills: [
      "mmss_skill_gap_detect",
      "mmss_skill_blueprint_generate",
      "mmss_skill_contract_validate",
      "mmss_skill_upsert_runtime",
    ],
    internal_flow: [
      { from: "mmss_skill_gap_detect", to: "mmss_skill_blueprint_generate", artifact: "missing_skills" },
      { from: "mmss_skill_blueprint_generate", to: "mmss_skill_contract_validate", artifact: "skill_blueprints" },
      { from: "mmss_skill_contract_validate", to: "mmss_skill_upsert_runtime", artifact: "validated_skill_blueprints" },
    ],
    shared_entities: ["missing_skills", "skill_blueprints", "contract_report"],
    entry_points: ["goal", "skill_runs"],
    exit_artifacts: ["skill_ids", "upsert_report"],
    metadata: { owner_scope: "skill_runtime", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_set_id: "mmss_set_skill_tree_builder",
    name: "Skill Tree Builder",
    purpose: "Compose skill sets into owner-scoped trees and persist them for future autonomous orchestration.",
    skills: [
      "mmss_skill_set_compose",
      "mmss_skill_tree_compose",
      "mmss_skill_tree_persist",
    ],
    internal_flow: [
      { from: "mmss_skill_set_compose", to: "mmss_skill_tree_compose", artifact: "skill_set_blueprint" },
      { from: "mmss_skill_tree_compose", to: "mmss_skill_tree_persist", artifact: "skill_tree_blueprint" },
    ],
    shared_entities: ["skill_set_blueprint", "skill_tree_blueprint"],
    entry_points: ["skill_ids", "goal"],
    exit_artifacts: ["tree_id", "persistence_report"],
    metadata: { owner_scope: "skill_runtime", supports_album_creation: false, supports_skill_creation: true },
  },
  {
    skill_set_id: "mmss_set_autonomy_loop",
    name: "Autonomy Loop",
    purpose: "Orchestrate execution plans, audit outputs, and evolve the runtime through self-improvement cycles.",
    skills: [
      "mmss_runtime_plan_orchestrate",
      "mmss_quality_audit",
      "mmss_self_improvement_loop",
    ],
    internal_flow: [
      { from: "mmss_runtime_plan_orchestrate", to: "mmss_quality_audit", artifact: "runtime_plan" },
      { from: "mmss_quality_audit", to: "mmss_self_improvement_loop", artifact: "audit_report" },
    ],
    shared_entities: ["runtime_plan", "audit_report", "improvement_tasks"],
    entry_points: ["goal", "tree_id"],
    exit_artifacts: ["tree_evolution_patch"],
    metadata: { owner_scope: "autonomy_runtime", supports_album_creation: true, supports_skill_creation: true, autonomous: true },
  },
];

const skillTrees = [
  {
    tree_id: "mmss_tree_album_creation",
    root_goal: "Create new MMSS albums from rag_chunks-grounded evidence and persist them as reusable runtime artifacts.",
    version: 1,
    skill_sets: ["mmss_set_rag_context_core", "mmss_set_operator_invariants", "mmss_set_album_factory", "mmss_set_autonomy_loop"],
    global_entities: ["rag_chunks", "prompt_context_text", "album_json", "quality_score"],
    cross_links: [
      { from_set: "mmss_set_rag_context_core", to_set: "mmss_set_album_factory", via: "prompt_context_text" },
      { from_set: "mmss_set_operator_invariants", to_set: "mmss_set_album_factory", via: "operator_plan" },
      { from_set: "mmss_set_album_factory", to_set: "mmss_set_autonomy_loop", via: "album_json" },
    ],
    owner_scope: "album_runtime",
    metadata: { supports_album_creation: true, supports_skill_creation: false, focus: "album_generation" },
  },
  {
    tree_id: "mmss_tree_skill_growth",
    root_goal: "Create new MMSS skills and evolve the runtime skill graph from detected gaps and audit feedback.",
    version: 1,
    skill_sets: ["mmss_set_rag_context_core", "mmss_set_operator_invariants", "mmss_set_skill_forge", "mmss_set_skill_tree_builder", "mmss_set_autonomy_loop"],
    global_entities: ["missing_skills", "skill_ids", "tree_id", "improvement_tasks"],
    cross_links: [
      { from_set: "mmss_set_operator_invariants", to_set: "mmss_set_skill_forge", via: "invariants" },
      { from_set: "mmss_set_skill_forge", to_set: "mmss_set_skill_tree_builder", via: "skill_ids" },
      { from_set: "mmss_set_skill_tree_builder", to_set: "mmss_set_autonomy_loop", via: "tree_id" },
    ],
    owner_scope: "skill_runtime",
    metadata: { supports_album_creation: false, supports_skill_creation: true, focus: "skill_generation" },
  },
  {
    tree_id: "mmss_tree_album_and_skill_autonomy",
    root_goal: "Run a self-improving MMSS operator that can both create albums and invent new skills when the runtime detects gaps.",
    version: 1,
    skill_sets: ["mmss_set_rag_context_core", "mmss_set_operator_invariants", "mmss_set_album_factory", "mmss_set_skill_forge", "mmss_set_skill_tree_builder", "mmss_set_autonomy_loop"],
    global_entities: ["rag_chunks", "album_json", "skill_ids", "tree_evolution_patch"],
    cross_links: [
      { from_set: "mmss_set_album_factory", to_set: "mmss_set_autonomy_loop", via: "album_json" },
      { from_set: "mmss_set_autonomy_loop", to_set: "mmss_set_skill_forge", via: "improvement_tasks" },
      { from_set: "mmss_set_skill_tree_builder", to_set: "mmss_set_autonomy_loop", via: "tree_id" },
    ],
    owner_scope: "autonomy_runtime",
    metadata: { supports_album_creation: true, supports_skill_creation: true, autonomous: true, focus: "album_and_skill_autonomy" },
  },
];

async function upsertSkill(client, skill) {
  await client.query(
    `
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
    `,
    [
      skill.skill_id,
      skill.name,
      skill.description,
      JSON.stringify(skill.inputs || []),
      JSON.stringify(skill.outputs || []),
      JSON.stringify(skill.prerequisites || []),
      JSON.stringify(skill.failure_modes || []),
      JSON.stringify(skill.metrics || {}),
      JSON.stringify(skill.metadata || {}),
    ],
  );
}

async function upsertSkillSet(client, skillSet) {
  await client.query(
    `
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
    `,
    [
      skillSet.skill_set_id,
      skillSet.name,
      skillSet.purpose,
      JSON.stringify(skillSet.skills || []),
      JSON.stringify(skillSet.internal_flow || []),
      JSON.stringify(skillSet.shared_entities || []),
      JSON.stringify(skillSet.entry_points || []),
      JSON.stringify(skillSet.exit_artifacts || []),
      JSON.stringify(skillSet.metadata || {}),
    ],
  );
}

async function upsertSkillTree(client, skillTree) {
  await client.query(
    `
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
    `,
    [
      skillTree.tree_id,
      skillTree.root_goal,
      skillTree.version || 1,
      JSON.stringify(skillTree.skill_sets || []),
      JSON.stringify(skillTree.global_entities || []),
      JSON.stringify(skillTree.cross_links || []),
      skillTree.owner_scope,
      JSON.stringify(skillTree.metadata || {}),
    ],
  );
}

async function main() {
  await ensureSchema(DATABASE_NAME);
  const client = await getPool(DATABASE_NAME).connect();
  try {
    await client.query("BEGIN");
    for (const skill of skills) {
      await upsertSkill(client, skill);
    }
    for (const skillSet of skillSets) {
      await upsertSkillSet(client, skillSet);
    }
    for (const skillTree of skillTrees) {
      await upsertSkillTree(client, skillTree);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const [skillCount, setCount, treeCount, albumFocused, skillFocused] = await Promise.all([
    getPool(DATABASE_NAME).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILLS_TABLE}`),
    getPool(DATABASE_NAME).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILL_SETS_TABLE}`),
    getPool(DATABASE_NAME).query(`SELECT COUNT(*)::int AS count FROM ${MMSS_SKILL_TREES_TABLE}`),
    getPool(DATABASE_NAME).query(`SELECT skill_id, name FROM ${MMSS_SKILLS_TABLE} WHERE metadata->>'supports_album_creation' = 'true' ORDER BY skill_id`),
    getPool(DATABASE_NAME).query(`SELECT skill_id, name FROM ${MMSS_SKILLS_TABLE} WHERE metadata->>'supports_skill_creation' = 'true' ORDER BY skill_id`),
  ]);

  console.log(
    JSON.stringify(
      {
        database: DATABASE_NAME,
        inserted: {
          skills_seeded: skills.length,
          skill_sets_seeded: skillSets.length,
          skill_trees_seeded: skillTrees.length,
        },
        totals: {
          mmss_skills: skillCount.rows[0]?.count || 0,
          mmss_skill_sets: setCount.rows[0]?.count || 0,
          mmss_skill_trees: treeCount.rows[0]?.count || 0,
        },
        albumCreationSkills: albumFocused.rows,
        skillCreationSkills: skillFocused.rows,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
