const { logGenerationResult } = require('../server/mmssRuntimePersistenceService');

const DATABASE = 'abstract-mind-lab';
const MODES = [
  'qa',
  'prompt_mutation',
  'session_analysis',
  'mmss_operator_assist',
  'mmss_invariants',
  'cross_db_reconciliation',
  'json_prompt_extraction',
  'source_audit',
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
];

const QUERY_TEMPLATES = [
  'baseline synthesis for reusable MMSS evidence',
  'operator-focused reconstruction with explicit source handling',
  'Flowmusic-ready prompt assembly with archive grounding',
  'curated fragment audit with generation applicability',
  'runtime-oriented reasoning pass for local album pipeline',
];

function buildSourceScopes(mode) {
  const common = [{ database: DATABASE, sourceTables: ['mmss_collection', 'mmss_filtered'] }];
  if (mode.includes('album')) {
    return [{ database: DATABASE, sourceTables: ['mmss_albums', 'mmss_collection', 'mmss_tracks_prompts', 'mmss_custom_instructions'] }];
  }
  if (mode.includes('skill') || mode.startsWith('mmss_') || mode === 'ase_console_recipe') {
    return [
      { database: DATABASE, sourceTables: ['mmss_invariants', 'mmss_phase_patterns', 'mmss_domain_patterns', 'mmss_collection'] },
      { database: 'abstract_mind_db', sourceTables: ['music_blocks'] },
    ];
  }
  if (mode === 'cross_db_reconciliation') {
    return [
      { database: DATABASE, sourceTables: ['mmss_collection', 'mmss_filtered', 'tracks', 'sessions'] },
      { database: 'abstract_mind_db', sourceTables: ['music_blocks', 'tracks', 'sessions'] },
    ];
  }
  if (mode === 'prompt_mutation' || mode === 'prompt_evolution' || mode === 'tag_enrichment') {
    return [{ database: DATABASE, sourceTables: ['mmss_tracks_prompts', 'mmss_collection', 'mmss_custom_instructions'] }];
  }
  return common;
}

function buildAnswer(mode, index) {
  return JSON.stringify({
    seed_mode: mode,
    seed_variant: index + 1,
    summary: `Manual seed result ${index + 1} for mode ${mode}.`,
    operator_focus: ['init', 'vectorize', 'convolve', 'focus'].slice(0, 2 + (index % 3)),
    retrieval_policy: index % 2 === 0 ? 'balanced synthesis' : 'relation-aware synthesis',
    recommended_tables: buildSourceScopes(mode).flatMap((scope) => scope.sourceTables),
    flowmusic_applicability: 'high',
    notes: [
      'Designed as a starter example for local RAG pattern conditioning.',
      'Intended to reduce cold-start behavior in album and prompt synthesis flows.',
    ],
  }, null, 2);
}

async function main() {
  let inserted = 0;
  for (const mode of MODES) {
    for (let index = 0; index < QUERY_TEMPLATES.length; index += 1) {
      const query = `${mode}: ${QUERY_TEMPLATES[index]}`;
      await logGenerationResult(DATABASE, {
        resultId: `seed_${mode}_${index + 1}`,
        mode,
        model: 'manual_seed',
        query,
        answer: buildAnswer(mode, index),
        sourceScopes: buildSourceScopes(mode),
        retrievedSources: [],
        promptContextText: `Seed context for ${mode}. Template ${index + 1}.`,
        debugPayload: {
          seeded: true,
          seed_family: 'manual_mode_results',
          seed_index: index + 1,
        },
        metadata: {
          source: 'seed-mmss-mode-results.js',
          seeded_at: new Date().toISOString(),
          mode,
        },
      });
      inserted += 1;
    }
  }

  console.log(JSON.stringify({ database: DATABASE, inserted }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
