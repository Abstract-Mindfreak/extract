/**
 * Shared prompt library entity types and constants.
 * Kept in one module so UI, reducer, and Blockly layer use the same contracts.
 */

/**
 * @typedef {"concat"|"merge_shallow"|"merge_deep"} MergeStrategy
 */

/**
 * @typedef {"manual"|"blockly"|null} CompositionSource
 */

export const MERGE_STRATEGIES = ["concat", "merge_shallow", "merge_deep"];

export const DEFAULT_BLOCKLY_CONTEXT = {
  genre: "neurofunk",
  mood: "dark",
  role: "producer",
  trackLengthBars: 64,
  energy: 0.75,
};

export const BLOCKLY_CONTEXT_PRESETS = {
  neuro_dark: {
    genre: "neurofunk",
    mood: "dystopian",
    role: "producer",
    trackLengthBars: 64,
    energy: 0.82,
  },
  glass_minimal: {
    genre: "minimal",
    mood: "glass",
    role: "arranger",
    trackLengthBars: 48,
    energy: 0.58,
  },
  hyper_chaos: {
    genre: "experimental",
    mood: "chaotic",
    role: "sound_designer",
    trackLengthBars: 96,
    energy: 0.95,
  },
};

