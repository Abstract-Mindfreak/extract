import { DEFAULT_BLOCKLY_CONTEXT, MERGE_STRATEGIES } from "./promptTypes";
const PROMPT_LIBRARY_SCHEMA_VERSION = 1;
export const PROMPT_LIBRARY_STORAGE_KEY = "mmss.promptLibrary.v1";
export const PROMPT_BINDING_BUTTONS = Array.from({ length: 16 }, (_, index) => `slot_${index + 1}`);

export const DEFAULT_BLOCKLY_WORKSPACE_XML =
  '<xml xmlns="https://developers.google.com/blockly/xml"><block type="mmss_set_merge_strategy" x="24" y="24"><field name="MERGE_STRATEGY">merge_deep</field><next><block type="mmss_add_block"></block></next></block></xml>';

/**
 * @typedef {Object} PromptJsonBlock
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string} category
 * @property {string[]} tags
 * @property {{ type: string, version: string, data: any }} payload
 * @property {{ color: string, icon: string, boundButtonId: string | null }} ui
 */

/**
 * @typedef {Object} PromptJsonSequence
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {{ blockId: string, order: number }[]} blocks
 * @property {"concat"|"merge_shallow"|"merge_deep"} mergeStrategy
 * @property {{ color: string, icon: string, boundButtonId: string | null }} ui
 */

export function createPromptLibraryState(restoredState) {
  const base = createDefaultPromptLibraryState();
  if (restoredState?.__empty === true) {
    return syncPromptLibraryState({
      ...base,
      blocks: [],
      sequences: [],
      selectedBlockId: null,
      selectedSequenceId: null,
      activeComposition: {
        ...base.activeComposition,
        blockIds: [],
        combinedJson: {},
      },
    });
  }
  if (!restoredState) return base;

  const next = {
    ...base,
    ...restoredState,
    blocks: Array.isArray(restoredState.blocks) && restoredState.blocks.length ? restoredState.blocks : base.blocks,
    sequences:
      Array.isArray(restoredState.sequences) && restoredState.sequences.length
        ? restoredState.sequences
        : base.sequences,
    bindings:
      Array.isArray(restoredState.bindings) && restoredState.bindings.length === PROMPT_BINDING_BUTTONS.length
        ? restoredState.bindings
        : base.bindings,
    activeComposition: {
      ...base.activeComposition,
      ...restoredState.activeComposition,
    },
  };

  return syncPromptLibraryState(next);
}

export function reducePromptLibrary(state, action) {
  switch (action.type) {
    case "PROMPT_BLOCK_CREATE":
      return syncPromptLibraryState({
        ...state,
        blocks: [normalizeBlock(action.block), ...state.blocks],
        selectedBlockId: action.block.id,
      });

    case "PROMPT_BLOCK_UPDATE":
      return syncPromptLibraryState({
        ...state,
        blocks: state.blocks.map((block) => (block.id === action.block.id ? normalizeBlock(action.block) : block)),
        selectedBlockId: action.block.id,
      });

    case "PROMPT_BLOCK_DELETE":
      return syncPromptLibraryState({
        ...state,
        blocks: state.blocks.filter((block) => block.id !== action.blockId),
        sequences: state.sequences.map((sequence) => ({
          ...sequence,
          blocks: sequence.blocks.filter((entry) => entry.blockId !== action.blockId),
        })),
        bindings: state.bindings.map((binding) =>
          binding.targetId === action.blockId && binding.bindingType === "block"
            ? { ...binding, targetId: null, bindingType: null }
            : binding
        ),
        selectedBlockId: state.selectedBlockId === action.blockId ? null : state.selectedBlockId,
        activeComposition: {
          ...state.activeComposition,
          blockIds: state.activeComposition.blockIds.filter((blockId) => blockId !== action.blockId),
        },
      });

    case "PROMPT_BLOCK_DUPLICATE": {
      const source = state.blocks.find((block) => block.id === action.blockId);
      if (!source) return state;
      const clone = {
        ...source,
        id: createEntityId("block"),
        name: `${source.name} Copy`,
        ui: {
          ...source.ui,
          boundButtonId: null,
        },
      };
      return syncPromptLibraryState({
        ...state,
        blocks: [clone, ...state.blocks],
        selectedBlockId: clone.id,
      });
    }

    case "PROMPT_SEQUENCE_CREATE":
      return syncPromptLibraryState({
        ...state,
        sequences: [normalizeSequence(action.sequence), ...state.sequences],
        selectedSequenceId: action.sequence.id,
      });

    case "PROMPT_SEQUENCE_UPDATE":
      return syncPromptLibraryState({
        ...state,
        sequences: state.sequences.map((sequence) =>
          sequence.id === action.sequence.id ? normalizeSequence(action.sequence) : sequence
        ),
        selectedSequenceId: action.sequence.id,
      });

    case "PROMPT_SEQUENCE_DELETE":
      return syncPromptLibraryState({
        ...state,
        sequences: state.sequences.filter((sequence) => sequence.id !== action.sequenceId),
        bindings: state.bindings.map((binding) =>
          binding.targetId === action.sequenceId && binding.bindingType === "sequence"
            ? { ...binding, targetId: null, bindingType: null }
            : binding
        ),
        selectedSequenceId: state.selectedSequenceId === action.sequenceId ? null : state.selectedSequenceId,
      });

    case "PROMPT_SELECT_BLOCK":
      return {
        ...state,
        selectedBlockId: action.blockId,
      };

    case "PROMPT_SELECT_SEQUENCE":
      return {
        ...state,
        selectedSequenceId: action.sequenceId,
      };

    case "PROMPT_ACTIVE_COMPOSITION_ADD_BLOCK":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: [...state.activeComposition.blockIds, action.blockId],
          source: "manual",
        },
      });

    case "PROMPT_ACTIVE_COMPOSITION_REMOVE_BLOCK":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: state.activeComposition.blockIds.filter((_, index) => index !== action.index),
          source: "manual",
        },
      });

    case "PROMPT_ACTIVE_COMPOSITION_REORDER": {
      const nextIds = [...state.activeComposition.blockIds];
      const [entry] = nextIds.splice(action.fromIndex, 1);
      nextIds.splice(action.toIndex, 0, entry);
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: nextIds,
          source: "manual",
        },
      });
    }

    case "PROMPT_ACTIVE_COMPOSITION_CLEAR":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: [],
          combinedJson: {},
          source: null,
        },
      });

    case "PROMPT_ACTIVE_COMPOSITION_SET":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: Array.isArray(action.blockIds) ? action.blockIds : [],
          source: "manual",
        },
      });

    case "PROMPT_ACTIVE_COMPOSITION_SET_FROM_BLOCKLY":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds: Array.isArray(action.blockIds) ? action.blockIds : [],
          mergeStrategy: MERGE_STRATEGIES.includes(action.mergeStrategy)
            ? action.mergeStrategy
            : state.activeComposition.mergeStrategy,
          source: "blockly",
          blocklyWorkspaceXml:
            typeof action.workspaceXml === "string" && action.workspaceXml.trim()
              ? action.workspaceXml
              : state.activeComposition.blocklyWorkspaceXml,
          context:
            action.context && typeof action.context === "object"
              ? {
                  ...state.activeComposition.context,
                  ...action.context,
                }
              : state.activeComposition.context,
        },
      });

    case "PROMPT_SET_MERGE_STRATEGY":
      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          mergeStrategy: action.mergeStrategy,
          source: state.activeComposition.source || "manual",
        },
      });

    case "PROMPT_SEQUENCE_CREATE_FROM_COMPOSITION":
      return reducePromptLibrary(state, {
        type: "PROMPT_SAVE_COMPOSITION_AS_SEQUENCE",
        name: action.name,
        description: action.description,
        color: action.color,
        icon: action.icon,
      });

    case "PROMPT_SET_BINDING_MODE":
      return {
        ...state,
        bindingMode: action.bindingMode,
      };

    case "PROMPT_SET_SEQUENCE_PRESS_MODE":
      return {
        ...state,
        sequencePressMode: action.sequencePressMode,
      };

    case "PROMPT_BIND_BUTTON": {
      const nextBindings = state.bindings.map((binding) =>
        binding.buttonId === action.buttonId ||
        (binding.targetId === action.targetId && binding.bindingType === action.bindingType)
          ? {
              ...binding,
              bindingType: binding.buttonId === action.buttonId ? action.bindingType : null,
              targetId: binding.buttonId === action.buttonId ? action.targetId : null,
            }
          : binding
      );

      return syncPromptLibraryState({
        ...state,
        bindings: nextBindings,
        blocks: state.blocks.map((block) =>
          block.id === action.targetId && action.bindingType === "block"
            ? { ...block, ui: { ...block.ui, boundButtonId: action.buttonId } }
            : block.ui.boundButtonId === action.buttonId
              ? { ...block, ui: { ...block.ui, boundButtonId: null } }
              : block
        ),
        sequences: state.sequences.map((sequence) =>
          sequence.id === action.targetId && action.bindingType === "sequence"
            ? { ...sequence, ui: { ...sequence.ui, boundButtonId: action.buttonId } }
            : sequence.ui.boundButtonId === action.buttonId
              ? { ...sequence, ui: { ...sequence.ui, boundButtonId: null } }
              : sequence
        ),
      });
    }

    case "PROMPT_TRIGGER_BUTTON": {
      const binding = state.bindings.find((entry) => entry.buttonId === action.buttonId);
      if (!binding?.bindingType || !binding.targetId) return state;

      if (binding.bindingType === "block") {
        return reducePromptLibrary(state, {
          type: "PROMPT_ACTIVE_COMPOSITION_ADD_BLOCK",
          blockId: binding.targetId,
        });
      }

      const sequence = state.sequences.find((entry) => entry.id === binding.targetId);
      if (!sequence) return state;
      const orderedBlockIds = [...sequence.blocks]
        .sort((left, right) => left.order - right.order)
        .map((entry) => entry.blockId);

      return syncPromptLibraryState({
        ...state,
        activeComposition: {
          ...state.activeComposition,
          blockIds:
            state.sequencePressMode === "append"
              ? [...state.activeComposition.blockIds, ...orderedBlockIds]
              : orderedBlockIds,
        },
      });
    }

    case "PROMPT_SAVE_COMPOSITION_AS_SEQUENCE": {
      const uniqueBlockIds = [];
      const seen = new Set();
      state.activeComposition.blockIds.forEach((blockId) => {
        if (seen.has(blockId)) return;
        seen.add(blockId);
        uniqueBlockIds.push(blockId);
      });

      const sequence = {
        id: createEntityId("sequence"),
        name: action.name || `Composition ${state.sequences.length + 1}`,
        description: action.description || "Saved from active composition",
        blocks: uniqueBlockIds.map((blockId, index) => ({
          blockId,
          order: index,
        })),
        mergeStrategy: state.activeComposition.mergeStrategy,
        ui: {
          color: action.color || "#9be0ff",
          icon: action.icon || "stack",
          boundButtonId: null,
        },
      };

      return syncPromptLibraryState({
        ...state,
        sequences: [sequence, ...state.sequences],
        selectedSequenceId: sequence.id,
      });
    }

    case "PROMPT_IMPORT_LIBRARY":
      return createPromptLibraryState(action.payload);

    case "PROMPT_IMPORT_BLOCKS": {
      const imported = Array.isArray(action.blocks) ? action.blocks.map(normalizeBlock) : [];
      if (!imported.length) return state;
      return syncPromptLibraryState({
        ...state,
        blocks: [...imported, ...state.blocks],
        selectedBlockId: imported[0].id,
      });
    }

    case "PROMPT_IMPORT_SEQUENCES": {
      const imported = Array.isArray(action.sequences) ? action.sequences.map(normalizeSequence) : [];
      if (!imported.length) return state;
      return syncPromptLibraryState({
        ...state,
        sequences: [...imported, ...state.sequences],
        selectedSequenceId: imported[0].id,
      });
    }

    default:
      return state;
  }
}

export function createEntityId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function savePromptLibraryState(state) {
  const payload = {
    schemaVersion: PROMPT_LIBRARY_SCHEMA_VERSION,
    promptLibrary: state,
  };

  try {
    window.localStorage.setItem(PROMPT_LIBRARY_STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    // Ignore persistence errors (for example QuotaExceededError) to keep runtime import stable.
  }
}

export function loadPromptLibraryState() {
  try {
    const raw = window.localStorage.getItem(PROMPT_LIBRARY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.schemaVersion !== PROMPT_LIBRARY_SCHEMA_VERSION) return null;
    return parsed.promptLibrary ?? null;
  } catch (error) {
    return null;
  }
}

export function exportPromptLibraryFile(state) {
  return JSON.stringify(
    {
      schemaVersion: PROMPT_LIBRARY_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      promptLibrary: state,
    },
    null,
    2
  );
}

export function parsePromptImportText(text) {
  const raw = String(text || "").trim();
  if (!raw) return { mode: "none", library: null, blocks: [] };

  try {
    const parsed = JSON.parse(raw);
    if (looksLikePromptLibrary(parsed)) {
      return {
        mode: "library",
        library: parsed.promptLibrary ?? parsed,
        blocks: [],
      };
    }
    return {
      mode: "blocks",
      library: null,
      blocks: [createBlockFromObject(parsed, 0)],
    };
  } catch (error) {
    const fragments = extractJsonFragments(raw);
    return {
      mode: "blocks",
      library: null,
      blocks: fragments.map((fragment, index) => createBlockFromObject(fragment, index)),
    };
  }
}

export function combinePromptBlocks(blockIds, blocks, mergeStrategy) {
  const items = blockIds
    .map((blockId) => blocks.find((block) => block.id === blockId))
    .filter(Boolean)
    .map((block) => block.payload?.data);

  return applyMergeStrategy(items, mergeStrategy);
}

function syncPromptLibraryState(state) {
  const mergeStrategy = state.activeComposition?.mergeStrategy || "merge_deep";
  const combinedJson = {
    type: "flowmusic.app_prompt",
    version: "1.0",
    data: combinePromptBlocks(state.activeComposition.blockIds, state.blocks, mergeStrategy),
    blockIds: state.activeComposition.blockIds,
    mergeStrategy,
  };

  const fallbackBlockId = state.blocks[0]?.id ?? null;
  const fallbackSequenceId = state.sequences[0]?.id ?? null;

  return {
    ...state,
    selectedBlockId: state.selectedBlockId ?? fallbackBlockId,
    selectedSequenceId: state.selectedSequenceId ?? fallbackSequenceId,
    activeComposition: {
      ...state.activeComposition,
      mergeStrategy,
      source: state.activeComposition?.source || null,
      context: state.activeComposition?.context || DEFAULT_BLOCKLY_CONTEXT,
      blocklyWorkspaceXml:
        state.activeComposition?.blocklyWorkspaceXml || DEFAULT_BLOCKLY_WORKSPACE_XML,
      combinedJson,
    },
  };
}

function applyMergeStrategy(items, mergeStrategy) {
  if (!items.length) return {};

  if (mergeStrategy === "concat") {
    if (items.every((item) => typeof item === "string")) {
      return items.join("\n");
    }

    if (items.every(Array.isArray)) {
      return items.flat();
    }

    return items;
  }

  if (mergeStrategy === "merge_shallow") {
    return items.reduce((accumulator, item) => {
      if (!isPlainObject(item)) return accumulator;
      return {
        ...accumulator,
        ...item,
      };
    }, {});
  }

  return items.reduce((accumulator, item) => deepMerge(accumulator, item), {});
}

function looksLikePromptLibrary(value) {
  if (!isPlainObject(value)) return false;
  if (isPlainObject(value.promptLibrary)) return true;
  return Array.isArray(value.blocks) && Array.isArray(value.sequences);
}

function extractJsonFragments(text) {
  const results = [];
  const seenRanges = new Set();

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char !== "{" && char !== "[") continue;
    if (!looksLikeJsonStart(text, index)) continue;

    const endIndex = findBalancedJsonEnd(text, index);
    if (endIndex < 0) continue;

    const rangeKey = `${index}:${endIndex}`;
    if (seenRanges.has(rangeKey)) continue;
    seenRanges.add(rangeKey);

    const candidate = text.slice(index, endIndex + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (isPlainObject(parsed) || Array.isArray(parsed)) {
        results.push(parsed);
        index = endIndex;
      }
    } catch (error) {
      // Ignore malformed candidate and continue scanning next start.
    }
  }

  return results;
}

function findBalancedJsonEnd(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{" || char === "[") {
      depth += 1;
      continue;
    }

    if (char === "}" || char === "]") {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return -1;
    }
  }

  return -1;
}

function looksLikeJsonStart(text, start) {
  const first = text[start];
  if (first !== "{" && first !== "[") return false;

  let index = start + 1;
  while (index < text.length && /\s/.test(text[index])) {
    index += 1;
  }

  if (index >= text.length) return false;
  const next = text[index];
  if (first === "{") {
    return next === "\"" || next === "}";
  }
  return next === "{" || next === "[" || next === "\"" || next === "]" || next === "-" || /[0-9tfn]/.test(next);
}

function createBlockFromObject(fragment, index) {
  const suggestedName = inferBlockName(fragment, index);
  return {
    id: createEntityId("block"),
    name: suggestedName,
    description: "Imported from mixed JSON/text document",
    category: inferCategory(fragment),
    tags: inferTags(fragment),
    payload: {
      type: "flowmusic.app_prompt",
      version: "1.0",
      data: fragment,
    },
    ui: {
      color: "#9be0ff",
      icon: "import",
      boundButtonId: null,
    },
  };
}

function inferBlockName(fragment, index) {
  if (isPlainObject(fragment)) {
    const keys = Object.keys(fragment);
    if (keys.length) return keys[0].replace(/_/g, " ");
  }
  if (Array.isArray(fragment)) return `Imported Array ${index + 1}`;
  return `Imported Block ${index + 1}`;
}

function inferCategory(fragment) {
  if (Array.isArray(fragment)) return "array";
  if (isPlainObject(fragment)) {
    const keys = Object.keys(fragment).map((key) => key.toLowerCase());
    if (keys.some((key) => key.includes("metadata"))) return "metadata";
    if (keys.some((key) => key.includes("logic"))) return "logic";
    if (keys.some((key) => key.includes("archive"))) return "archive";
  }
  return "imported";
}

function inferTags(fragment) {
  if (Array.isArray(fragment)) {
    return ["import", "array", "list", "items"].slice(0, 15);
  }

  if (!isPlainObject(fragment)) {
    return ["import"];
  }

  const collector = new Set(["import"]);
  collectKeyTags(fragment, collector, 0);
  return [...collector].slice(0, 15);
}

function collectKeyTags(value, collector, depth) {
  if (collector.size >= 40 || depth > 6) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectKeyTags(item, collector, depth + 1));
    return;
  }

  if (!isPlainObject(value)) return;

  Object.keys(value).forEach((rawKey) => {
    const normalized = normalizeTag(rawKey);
    if (normalized) collector.add(normalized);

    const parts = rawKey
      .split(/[_\-\s]+/)
      .map((part) => normalizeTag(part))
      .filter(Boolean);
    parts.forEach((part) => collector.add(part));

    collectKeyTags(value[rawKey], collector, depth + 1);
  });
}

function normalizeTag(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function deepMerge(target, source) {
  if (Array.isArray(target) && Array.isArray(source)) {
    return [...target, ...source];
  }

  if (!isPlainObject(target) || !isPlainObject(source)) {
    return clone(source);
  }

  const result = { ...target };
  Object.keys(source).forEach((key) => {
    if (key in result) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = clone(source[key]);
    }
  });
  return result;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBlock(block) {
  return {
    ...block,
    tags: Array.isArray(block.tags) ? block.tags : [],
    payload: {
      type: block.payload?.type || "flowmusic.app_prompt",
      version: block.payload?.version || "1.0",
      data: block.payload?.data ?? {},
    },
    ui: {
      color: block.ui?.color || "#9be0ff",
      icon: block.ui?.icon || "block",
      boundButtonId: block.ui?.boundButtonId ?? null,
    },
  };
}

function normalizeSequence(sequence) {
  return {
    ...sequence,
    blocks: Array.isArray(sequence.blocks) ? sequence.blocks : [],
    mergeStrategy: sequence.mergeStrategy || "merge_deep",
    ui: {
      color: sequence.ui?.color || "#ffd06f",
      icon: sequence.ui?.icon || "stack",
      boundButtonId: sequence.ui?.boundButtonId ?? null,
    },
  };
}

function createDefaultPromptLibraryState() {
  const blocks = [
    {
      id: "block_scene_glass",
      name: "Glass Stage",
      description: "Cool transparent space with minimal HUD and drifting lab energy.",
      category: "scene",
      tags: ["glass", "lab", "cool"],
      payload: {
        type: "flowmusic.app_prompt",
        version: "1.0",
        data: {
          prompt: "glass laboratory with soft blue highlights and suspended particles",
          visual: {
            environment: "glass_lab",
            lighting: "cool_refractions",
          },
        },
      },
      ui: {
        color: "#9be0ff",
        icon: "glass",
        boundButtonId: "slot_1",
      },
    },
    {
      id: "block_motion_orbit",
      name: "Orbit Motion",
      description: "Orbital drift with smooth camera movement and rotating accents.",
      category: "motion",
      tags: ["orbit", "drift", "camera"],
      payload: {
        type: "flowmusic.app_prompt",
        version: "1.0",
        data: {
          motion: {
            camera: "slow_orbit",
            energy: "steady",
          },
          timing: {
            pace: "measured",
          },
        },
      },
      ui: {
        color: "#ffd06f",
        icon: "orbit",
        boundButtonId: "slot_2",
      },
    },
    {
      id: "block_fx_prism",
      name: "Prismatic FX",
      description: "Adds spectral bloom, diffraction, and luminous edge treatment.",
      category: "fx",
      tags: ["prism", "glow", "spectral"],
      payload: {
        type: "flowmusic.app_prompt",
        version: "1.0",
        data: {
          effects: {
            bloom: "high",
            refraction: "prismatic",
            edges: ["glow", "spectral_split"],
          },
        },
      },
      ui: {
        color: "#9dff9a",
        icon: "spark",
        boundButtonId: "slot_3",
      },
    },
  ];

  const sequences = [
    {
      id: "sequence_intro",
      name: "Glass Intro",
      description: "Stage + orbit + prismatic polish.",
      blocks: [
        { blockId: "block_scene_glass", order: 0 },
        { blockId: "block_motion_orbit", order: 1 },
        { blockId: "block_fx_prism", order: 2 },
      ],
      mergeStrategy: "merge_deep",
      ui: {
        color: "#c6f3ff",
        icon: "stack",
        boundButtonId: "slot_5",
      },
    },
  ];

  return {
    schemaVersion: PROMPT_LIBRARY_SCHEMA_VERSION,
    blocks,
    sequences,
    selectedBlockId: blocks[0].id,
    selectedSequenceId: sequences[0].id,
    bindingMode: "block",
    sequencePressMode: "replace",
    bindings: PROMPT_BINDING_BUTTONS.map((buttonId) => {
      const block = blocks.find((entry) => entry.ui.boundButtonId === buttonId);
      const sequence = sequences.find((entry) => entry.ui.boundButtonId === buttonId);
      return {
        buttonId,
        bindingType: block ? "block" : sequence ? "sequence" : null,
        targetId: block?.id ?? sequence?.id ?? null,
      };
    }),
    activeComposition: {
      blockIds: [],
      combinedJson: {},
      mergeStrategy: "merge_deep",
      source: null,
      context: DEFAULT_BLOCKLY_CONTEXT,
      blocklyWorkspaceXml: DEFAULT_BLOCKLY_WORKSPACE_XML,
    },
  };
}
