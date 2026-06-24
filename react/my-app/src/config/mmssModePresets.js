const DEFAULT_MODEL = "batiai/gemma4-e2b:q4";
const FINAL_JSON_MAX_CHARS = 40000;
const RAG_ONLY_SCOPE = { "abstract-mind-lab": ["rag_chunks"] };

const MODE_META = {
  qa: {
    label: "QA",
    family: "analysis",
    query: "Answer a focused MMSS / Flowmusic question using only curated evidence, with minimal repetition and explicit sources.",
  },
  prompt_mutation: {
    label: "Prompt Mutation",
    family: "creative",
    query: "Mutate a Flowmusic prompt while preserving the core vibe, adding stronger structure, sonic detail, and operator hints.",
  },
  session_analysis: {
    label: "Session Analysis",
    family: "analysis",
    query: "Analyze one complex Flowmusic session, identify key transitions, operator traces, prompt shifts, and strongest reusable fragments.",
  },
  mmss_operator_assist: {
    label: "Operator Assist",
    family: "operator",
    query: "Map the current task to MMSS operators, phases, and domain patterns, then propose a reusable execution path.",
  },
  mmss_invariants: {
    label: "MMSS Invariants",
    family: "operator",
    query: "Extract invariant MMSS structures, operator signatures, and reusable ontology anchors from the current evidence scope.",
  },
  cross_db_reconciliation: {
    label: "Cross-DB Reconciliation",
    family: "crossdb",
    query: "Reconcile overlapping knowledge between abstract-mind-lab and abstract_mind_db, highlight gaps, duplicates, and stronger sources.",
  },
  json_prompt_extraction: {
    label: "JSON Prompt Extraction",
    family: "operator",
    query: "Extract structured JSON prompt fragments from sessions and tracks, preserving exact intent, operator cues, and generation parameters.",
  },
  source_audit: {
    label: "Source Audit",
    family: "analysis",
    query: "Audit source coverage, provenance strength, weak chunks, and missing context for the current retrieval scope.",
  },
  ase_console_recipe: {
    label: "ASE Recipe",
    family: "operator",
    query: "Build an ASE Console procedure with steps, operators, tables, and reusable prompts grounded in the retrieved context.",
  },
  contextual_summarization: {
    label: "Contextual Summarization",
    family: "analysis",
    query: "Summarize the retrieved MMSS / Flowmusic material without losing terminology, intent layers, or key generation details.",
  },
  knowledge_synthesis: {
    label: "Knowledge Synthesis",
    family: "analysis",
    query: "Synthesize a grounded answer from multiple fragmented chunks, merging overlaps and surfacing only the strongest conclusions.",
  },
  skill_tree_pathfinding: {
    label: "Skill Tree Pathfinding",
    family: "operator",
    query: "Find the best route through available MMSS skills, sets, and trees for the current generation or analysis task.",
  },
  skill_chain_orchestration: {
    label: "Skill Chain Orchestration",
    family: "operator",
    query: "Orchestrate a practical chain of MMSS skills that can solve the task step by step with minimal redundancy.",
  },
  skill_gap_analysis: {
    label: "Skill Gap Analysis",
    family: "operator",
    query: "Inspect the current runtime skill graph and identify which missing skills or bridges would increase execution quality.",
  },
  track_variation: {
    label: "Track Variation",
    family: "creative",
    query: "Create 3-5 grounded variations of a track while preserving its identity and improving specific dimensions like energy, darkness, or movement.",
  },
  style_fusion: {
    label: "Style Fusion",
    family: "creative",
    query: "Fuse two or more stylistic sources into one coherent Flowmusic-ready hybrid style with explicit sonic anchors.",
  },
  prompt_evolution: {
    label: "Prompt Evolution",
    family: "creative",
    query: "Evolve a generation prompt iteratively: diagnose, expand, sharpen, and optimize it for Flowmusic or ASE use.",
  },
  parameter_shift: {
    label: "Parameter Shift",
    family: "creative",
    query: "Change BPM, tonal center, meter, or intensity while preserving the original vibe and conceptual identity.",
  },
  session_digest: {
    label: "Session Digest",
    family: "analysis",
    query: "Condense a long session into a short technical digest with prompts, transitions, JSON fragments, and reusable takeaways.",
  },
  vibe_extraction: {
    label: "Vibe Extraction",
    family: "creative",
    query: "Extract aesthetic, emotional, visual, and sonic vibes from the current evidence so they can be reused in generation prompts.",
  },
  pattern_mining: {
    label: "Pattern Mining",
    family: "analysis",
    query: "Mine recurring successful patterns from prompts, sessions, tracks, operators, and curated MMSS fragments.",
  },
  tag_enrichment: {
    label: "Tag Enrichment",
    family: "operator",
    query: "Generate normalized tags and operator labels from the current evidence set for stronger downstream filtering and retrieval.",
  },
  similarity_audit: {
    label: "Similarity Audit",
    family: "analysis",
    query: "Compare a fresh idea against the archive and detect duplicates, loops, overly close neighbors, and novelty opportunities.",
  },
  concept_ideation: {
    label: "Concept Ideation",
    family: "creative",
    query: "Generate a full concept for a new track: story, visual atmosphere, sonic palette, motion, and prompt direction.",
  },
  album_synthesis: {
    label: "Album Synthesis",
    family: "album",
    query: "Create a new album concept from curated MMSS fragments, prompts, instructions, and filtered evidence. Do not reuse an existing album title or track list verbatim.",
  },
  arrangement_blueprint: {
    label: "Arrangement Blueprint",
    family: "creative",
    query: "Build a structural blueprint for a track with sections, timing roles, transitions, and evolving layers.",
  },
  soundscape_design: {
    label: "Soundscape Design",
    family: "creative",
    query: "Design a dense soundscape with spatial cues, ambience, textural layers, and operator-guided sonic placement.",
  },
  album_concept: {
    label: "Album Concept",
    family: "album",
    query: "Build an album-scale concept with narrative arc, track list logic, recurring motifs, and strong prompt directions.",
  },
  deep_worldbuilding: {
    label: "Deep Worldbuilding",
    family: "album",
    query: "Create a music-world lore system that links prompts, operator logic, sound palette, imagery, and recurring album symbols.",
  },
  pattern_recognition: {
    label: "Pattern Recognition",
    family: "analysis",
    query: "Recognize latent MMSS and Flowmusic patterns across prompts, sessions, tracks, and curated fragments.",
  },
};

const FAMILY_DEFAULTS = {
  analysis: {
    primaryTables: ["rag_chunks"],
    legacyTables: [],
    topK: 4,
    queryBudget: 2,
    filterProfile: "balanced",
    includeRelationLayer: false,
  },
  creative: {
    primaryTables: ["rag_chunks"],
    legacyTables: [],
    topK: 5,
    queryBudget: 2,
    filterProfile: "balanced",
    includeRelationLayer: false,
  },
  operator: {
    primaryTables: ["rag_chunks"],
    legacyTables: [],
    topK: 5,
    queryBudget: 2,
    filterProfile: "balanced",
    includeRelationLayer: false,
  },
  crossdb: {
    primaryTables: ["rag_chunks"],
    legacyTables: ["app_entity_store", "app_setting_store"], // Access some legacy tables
    topK: 5,
    queryBudget: 3,
    filterProfile: "strict",
    includeRelationLayer: false,
  },
  album: {
    primaryTables: ["rag_chunks"],
    legacyTables: [],
    topK: 5,
    queryBudget: 2,
    filterProfile: "balanced",
    includeRelationLayer: false,
  },
};

function dedupe(list = []) {
  return Array.from(new Set((list || []).filter(Boolean)));
}

function buildScopeSelections(primaryTables, legacyTables) {
  const next = {
    ...RAG_ONLY_SCOPE,
  };
  
  // Primary database tables (abstract-mind-lab)
  if (primaryTables?.length && primaryTables.some((table) => table !== "rag_chunks")) {
    next["abstract-mind-lab"] = dedupe(primaryTables.filter((table) => table !== "rag_chunks"));
  }
  
  // Legacy database tables with amd_ prefix
  if (legacyTables?.length) {
    next["legacy"] = dedupe(legacyTables.map(table => `amd_${table}`));
  }
  
  return next;
}

function buildSupportTablesForMode(mode, variant, meta) {
  const deep = variant === "deep";
  if (!deep) {
    if (meta.family === "album") {
      return ["mmss_custom_instructions", "mmss_collection"];
    }
    if (mode === "mmss_invariants" || mode === "mmss_operator_assist") {
      return ["mmss_invariants"];
    }
    return [];
  }

  if (meta.family === "album") {
    return ["mmss_custom_instructions", "mmss_collection", "mmss_skills", "mmss_skill_trees", "mmss_skill_sets", "mmss_albums"];
  }
  if (meta.family === "operator") {
    return ["mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns", "mmss_skills", "mmss_skill_trees", "mmss_skill_sets"];
  }
  if (meta.family === "creative") {
    return ["mmss_custom_instructions", "mmss_tracks_prompts", "mmss_collection"];
  }
  if (meta.family === "analysis") {
    return ["mmss_collection", "mmss_filtered"];
  }
  if (meta.family === "crossdb") {
    return ["mmss_collection", "mmss_filtered", "mmss_invariants"];
  }
  return [];
}

function buildInstructionText(mode, meta, variant) {
  return [
    `Mode: ${mode}`,
    `Preset variant: ${variant === "deep" ? "deep" : "quick"}`,
    `Focus: ${meta.label}.`,
    `Use the selected tables and MMSS context as the only evidence layer.`,
    `Prefer reusable prompts, operator-aware structure, and direct Flowmusic applicability.`,
  ].join(" ");
}

export function getLocalRagModePreset(mode, variant = "quick") {
  const meta = MODE_META[mode] || MODE_META.qa;
  const family = FAMILY_DEFAULTS[meta.family] || FAMILY_DEFAULTS.analysis;
  const deep = variant === "deep";
  const primaryTables = dedupe([
    ...(meta.primaryTables || family.primaryTables),
    ...buildSupportTablesForMode(mode, variant, meta),
  ]);
  const legacyTables = dedupe(meta.legacyTables || family.legacyTables);
  const scopeSelections = buildScopeSelections(primaryTables, legacyTables);
  return {
    mode,
    label: meta.label,
    variant,
    database: "abstract-mind-lab",
    batchSize: 8,
    topK: deep ? Math.min(12, family.topK + 2) : family.topK,
    queryBudget: deep ? Math.min(8, family.queryBudget + 2) : family.queryBudget,
    query: meta.query,
    selectedTables: ["mmss_collection", "mmss_filtered", "mmss_custom_instructions", "mmss_tracks_prompts", "mmss_albums", "mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns", "mmss_skills", "mmss_skill_trees", "mmss_skill_sets"].filter((table) => scopeSelections["abstract-mind-lab"]?.includes(table)),
    scopeSelections,
    filterProfile: deep ? (meta.family === "crossdb" ? "strict" : "balanced") : family.filterProfile,
    includeRelationLayer: deep ? meta.family === "operator" || meta.family === "album" : family.includeRelationLayer,
    responseMaxChars: FINAL_JSON_MAX_CHARS,
    model: DEFAULT_MODEL,
    skillTreeGoal: `Build a reusable ${mode} runtime workflow with strong MMSS operator coverage and Flowmusic-ready output structure.`,
    skillTreeOwnerScope: `${mode}_${variant}_runtime`,
    skillTreeContextHint: `Mode=${mode}. Variant=${variant}. Use only the selected evidence scopes. Prefer structured output, reusable operator paths, and concrete generation applicability.`,
    instructionTitle: `${meta.label} ${deep ? "Deep" : "Quick"} Preset`,
    instructionCategory: mode,
    instructionSourceLabel: `preset_${variant}`,
    instructionText: buildInstructionText(mode, meta, variant),
  };
}

export function getInvariantModePreset(mode, variant = "quick") {
  const meta = MODE_META[mode] || MODE_META.mmss_invariants;
  const deep = variant === "deep";
  const primaryTables = dedupe(meta.family === "crossdb"
    ? ["mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns", "mmss_collection"]
    : ["mmss_invariants", ...(deep ? ["mmss_phase_patterns", "mmss_domain_patterns", "mmss_collection"] : [])]);
  return {
    mode,
    database: "abstract-mind-lab",
    topK: deep ? 8 : 4,
    queryBudget: deep ? 5 : 2,
    query: `${meta.query} Focus on ontology, operators, seeds, and reusable invariant forms.`,
    scopeSelections: {
      rag_chunks_db: ["rag_chunks"],
      ...(primaryTables.length ? { "abstract-mind-lab": primaryTables } : {}),
    },
    filterProfile: deep ? "balanced" : "strict",
    includeRelationLayer: deep,
    responseMaxChars: FINAL_JSON_MAX_CHARS,
    model: DEFAULT_MODEL,
  };
}

export const LOCAL_RAG_PRESET_MODES = Object.keys(MODE_META);
export const INVARIANT_PRESET_MODES = [
  "mmss_invariants",
  "mmss_operator_assist",
  "json_prompt_extraction",
  "ase_console_recipe",
  "cross_db_reconciliation",
];

export { MODE_META, DEFAULT_MODEL, FINAL_JSON_MAX_CHARS };
