import type {
  DBElement,
  ExportPreset,
  KeySequencePreset,
  TagRegistry,
} from '@/types/meta';
import { sanitizePromptObject } from '@/utils/promptJson';
import { createTagId } from '@/utils/tagScanner';

// Φ_total(types) — типы эволюционируют с системой
export interface Rule {
  name: string;
  logic: 'must_include_layers' | 'min_domains' | 'conditional_requirement';
  value?: number[] | number;
  if?: Record<string, unknown>;
  then?: Record<string, unknown>;
}

export interface RuleSet {
  composition_rules: Rule[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deepClone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const shuffle = <T>(values: T[]) => {
  const next = [...values];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

export const parseCompositionPattern = (pattern?: string) => {
  const match = String(pattern || '').trim().toLowerCase().match(/(\d+)\s*[xх*]\s*(\d+)(?:\s+([a-z_]+))?/i);

  return {
    files: Math.max(1, Number(match?.[1]) || 1),
    items: Math.max(1, Number(match?.[2]) || 12),
    mode: match?.[3] || 'random',
  };
};

const getValueByPath = (value: unknown, path: string): unknown => {
  const segments = path.split('.').filter(Boolean);
  let cursor: unknown = value;

  for (const segment of segments) {
    if (!isRecord(cursor)) {
      return undefined;
    }

    cursor = cursor[segment];
  }

  return cursor;
};

const setValueByPath = (target: Record<string, unknown>, path: string, value: unknown) => {
  const segments = path.split('.').filter(Boolean);

  if (segments.length === 0) {
    return;
  }

  let cursor = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index];
    const existing = cursor[key];

    if (!isRecord(existing)) {
      cursor[key] = {};
    }

    cursor = cursor[key] as Record<string, unknown>;
  }

  cursor[segments[segments.length - 1]] = deepClone(value);
};

const collectKeyNames = (value: unknown, result = new Set<string>()) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectKeyNames(entry, result));
    return result;
  }

  if (!isRecord(value)) {
    return result;
  }

  Object.entries(value).forEach(([key, entry]) => {
    result.add(key);
    collectKeyNames(entry, result);
  });

  return result;
};

const matchesKeys = (element: DBElement, includeKeys: string[] = [], excludeKeys: string[] = []) => {
  const keys = collectKeyNames(element.raw);

  if (includeKeys.length > 0 && !includeKeys.every((key) => keys.has(key))) {
    return false;
  }

  if (excludeKeys.some((key) => keys.has(key))) {
    return false;
  }

  return true;
};

const matchesTags = (element: DBElement, includeTags: string[] = [], excludeTags: string[] = []) => {
  const tagIds = new Set(element.tagIds ?? []);

  if (includeTags.length > 0 && !includeTags.every((tag) => tagIds.has(tag))) {
    return false;
  }

  if (excludeTags.some((tag) => tagIds.has(tag))) {
    return false;
  }

  return true;
};

const filterElements = (elements: DBElement[], preset: ExportPreset) =>
  elements.filter((element) => {
    const filters = preset.filters;

    return (
      matchesTags(element, filters?.includeTags, filters?.excludeTags) &&
      matchesKeys(element, filters?.includeKeys, filters?.excludeKeys)
    );
  });

const fillPattern = (pattern: string, values: Record<string, string | number>) =>
  pattern.replace(/\{([^}]+)\}/g, (_match, key) => String(values[key] ?? key));

const getTopLevelFragments = (element: DBElement) => {
  if (!isRecord(element.raw)) {
    return [];
  }

  return Object.entries(element.raw).map(([key, value]) => ({
    path: key,
    value,
    sourceId: element.id,
  }));
};

const chooseItem = <T>(
  items: T[],
  index: number,
  mode: 'random' | 'weighted' | 'sequential' = 'random',
) => {
  if (items.length === 0) {
    return null;
  }

  if (mode === 'sequential') {
    return items[index % items.length] ?? null;
  }

  if (mode === 'weighted') {
    return items[Math.min(items.length - 1, Math.floor(Math.random() * Math.random() * items.length))] ?? null;
  }

  return items[Math.floor(Math.random() * items.length)] ?? null;
};

const findFragmentsForSequence = (
  elements: DBElement[],
  sequence: KeySequencePreset['sequences'][number],
) => {
  const parentPath = sequence.pathChain[0];

  return elements
    .map((element) => ({
      elementId: element.id,
      parentPath,
      value: getValueByPath(element.raw, parentPath),
    }))
    .filter((entry) => entry.value !== undefined);
};

const buildSequenceBasedItem = (
  elements: DBElement[],
  selectedPresets: KeySequencePreset[],
  itemIndex: number,
  maxBlocksPerElement?: number,
) => {
  const output: Record<string, unknown> = {};
  const sourceElementIds: string[] = [];
  let blockCount = 0;

  for (const preset of selectedPresets) {
    const mode = preset.generationRules?.mode ?? 'random';
    const limit = preset.generationRules?.maxBlocks ?? preset.sequences.length;

    for (let sequenceIndex = 0; sequenceIndex < preset.sequences.length; sequenceIndex += 1) {
      if (blockCount >= (maxBlocksPerElement || Infinity) || blockCount >= limit) {
        break;
      }

      const sequence = preset.sequences[sequenceIndex];
      const matches = findFragmentsForSequence(elements, sequence);
      const selected = chooseItem(matches, itemIndex + sequenceIndex, mode);

      if (!selected) {
        continue;
      }

      setValueByPath(output, selected.parentPath, selected.value);
      sourceElementIds.push(selected.elementId);
      blockCount += 1;
    }
  }

  return {
    id: createTagId(`generated_sequence_${itemIndex}_${sourceElementIds.join('_')}`),
    sourceElementIds: Array.from(new Set(sourceElementIds)),
    content: output,
  };
};

const buildRandomMixItem = (
  elements: DBElement[],
  itemIndex: number,
  maxBlocksPerElement = 4,
) => {
  const fragments = shuffle(elements.flatMap(getTopLevelFragments)).slice(0, maxBlocksPerElement);
  const output: Record<string, unknown> = {};

  fragments.forEach((fragment) => {
    setValueByPath(output, fragment.path, fragment.value);
  });

  return {
    id: createTagId(`generated_mix_${itemIndex}_${fragments.map((fragment) => fragment.sourceId).join('_')}`),
    sourceElementIds: Array.from(new Set(fragments.map((fragment) => fragment.sourceId))),
    content: output,
  };
};

const buildRuleEngineItem = (
  elements: DBElement[],
  rules: RuleSet,
  itemIndex: number,
  maxBlocksPerElement = 8,
) => {
  // Φ_total(rule_engine) — правила эволюционируют через применение
  const output: Record<string, unknown> = {};
  const sourceElementIds: string[] = [];
  
  // Filter elements that satisfy basic rules
  const eligibleElements = elements.filter((element) => {
    if (!isRecord(element.raw)) return false;
    
    // Check if element has required attributes
    const attr = element.raw.attr as Record<string, unknown> | undefined;
    if (!attr) return false;
    
    // Validate against rules
    const layer = attr.layer as number | undefined;
    const domain = attr.domain as string | undefined;
    
    // Must include layers rule
    const layerRules = rules.composition_rules.filter((r: Rule) => r.logic === 'must_include_layers');
    if (layerRules.length > 0 && layer === undefined) {
      return false;
    }
    
    // Domain spread rule
    const domainRules = rules.composition_rules.filter((r: Rule) => r.logic === 'min_domains');
    if (domainRules.length > 0 && domain === undefined) {
      return false;
    }
    
    return true;
  });
  
  // Group by layer to satisfy must_include_layers
  const elementsByLayer = new Map<number, DBElement[]>();
  eligibleElements.forEach((el) => {
    const raw = el.raw as Record<string, unknown>;
    const attr = raw.attr as Record<string, unknown> | undefined;
    const layer = attr?.layer as number;
    if (typeof layer === 'number') {
      if (!elementsByLayer.has(layer)) {
        elementsByLayer.set(layer, []);
      }
      elementsByLayer.get(layer)?.push(el);
    }
  });
  
  // Select blocks ensuring layer coverage
  const layerRules = rules.composition_rules.filter((r: Rule) => r.logic === 'must_include_layers');
  const requiredLayers = new Set<number>();
  layerRules.forEach((rule: Rule) => {
    (rule.value as number[]).forEach((l: number) => requiredLayers.add(l));
  });
  
  let blockCount = 0;
  
  // First pass: ensure required layers
  requiredLayers.forEach((layer) => {
    if (blockCount >= maxBlocksPerElement) return;
    const layerElements = elementsByLayer.get(layer) || [];
    if (layerElements.length > 0) {
      const selected = layerElements[(itemIndex + layer) % layerElements.length];
      if (isRecord(selected.raw)) {
        Object.entries(selected.raw).forEach(([key, value]) => {
          if (output[key] === undefined) {
            output[key] = deepClone(value);
            sourceElementIds.push(selected.id);
            blockCount++;
          }
        });
      }
    }
  });
  
  // Second pass: fill remaining slots with domain spread
  const minDomainsRule = rules.composition_rules.find((r: Rule) => r.logic === 'min_domains');
  const minDomains = minDomainsRule?.value as number | undefined;
  
  if (minDomains && blockCount < maxBlocksPerElement) {
    const domainsPresent = new Set<string>();
    Object.values(output).forEach((block) => {
      if (isRecord(block) && isRecord(block.attr)) {
        domainsPresent.add(String(block.attr.domain));
      }
    });
    
    // Add more elements to satisfy domain spread
    const remaining = eligibleElements.filter((el) => !sourceElementIds.includes(el.id));
    const shuffled = shuffle(remaining);
    
    for (const element of shuffled) {
      if (blockCount >= maxBlocksPerElement) break;
      if (domainsPresent.size >= minDomains && blockCount >= requiredLayers.size) break;
      
      if (isRecord(element.raw)) {
        const attr = element.raw.attr as Record<string, unknown> | undefined;
        const domain = attr?.domain as string | undefined;
        
        Object.entries(element.raw).forEach(([key, value]) => {
          if (blockCount >= maxBlocksPerElement) return;
          if (output[key] === undefined) {
            output[key] = deepClone(value);
            sourceElementIds.push(element.id);
            blockCount++;
            if (domain) domainsPresent.add(domain);
          }
        });
      }
    }
  }
  
  return {
    id: createTagId(`rule_engine_${itemIndex}_${sourceElementIds.slice(0, 3).join('_')}`),
    sourceElementIds: Array.from(new Set(sourceElementIds)),
    content: output,
  };
};
const buildMMSSV3Item = (elements: DBElement[]) => {
  // Φ_total(mmss_v3) — MMSS V3 blocks are specialized
  // In this mode, we assume the elements are already the selection from the builder.
  // We merge them into one object where each block contributes its technical keys.
  const output: Record<string, unknown> = {};
  const sourceElementIds = elements.map((e) => e.id);

  elements.forEach((element) => {
    if (isRecord(element.raw)) {
      Object.entries(element.raw).forEach(([key, value]) => {
        // If it's a normalized block, use its domain or a unique key to prevent collisions
        // But usually MMSS blocks have unique top-level keys like 'rhythmic_grid' etc.
        output[key] = deepClone(value);
      });
    }
  });

  return {
    id: createTagId(`mmss_v3_export_${sourceElementIds.slice(0, 3).join('_')}`),
    sourceElementIds,
    content: output,
  };
};

export async function generateExport(
  elements: DBElement[],
  exportPreset: ExportPreset,
  tagRegistry: TagRegistry,
  sequences: KeySequencePreset[],
): Promise<{ fileName: string; content: Record<string, unknown> | Record<string, unknown>[] }[]> {
  void tagRegistry;

  const filtered = filterElements(elements, exportPreset);
  const parsedPattern = parseCompositionPattern(exportPreset.composition?.pattern);
  const selectedSequencePresets =
    exportPreset.slicing?.useKeySequences && exportPreset.slicing.useKeySequences.length > 0
      ? sequences.filter((preset) => exportPreset.slicing?.useKeySequences?.includes(preset.id))
      : sequences;
  const fileNamePattern = exportPreset.output?.fileNamePattern || '{index}_{id}.json';
  const compositionMode = exportPreset.composition?.mode || 'as-is';

  return Array.from({ length: parsedPattern.files }, (_unused, fileIndex) => {
    const items = Array.from({ length: parsedPattern.items }, (_value, itemIndex) => {
      if (compositionMode === 'rule-engine') {
        // Φ_total(rule_engine_mode) — интеграция с Python rule_engine.py
        const defaultRules: RuleSet = {
          composition_rules: [
            { name: 'layer_balance', logic: 'must_include_layers', value: [1, 2, 3] },
            { name: 'domain_spread', logic: 'min_domains', value: 2 },
          ],
        };
        return buildRuleEngineItem(
          filtered,
          (exportPreset.composition as unknown as { rules: RuleSet }).rules ?? defaultRules,
          fileIndex * parsedPattern.items + itemIndex,
          exportPreset.slicing?.maxBlocksPerElement,
        );
      }

      if (compositionMode === 'mmss-v3') {
        return buildMMSSV3Item(filtered);
      }

      if (compositionMode === 'random-mix') {
        return buildRandomMixItem(
          filtered,
          fileIndex * parsedPattern.items + itemIndex,
          exportPreset.slicing?.maxBlocksPerElement,
        );
      }

      if (compositionMode === 'sequence-based') {
        return buildSequenceBasedItem(
          filtered,
          selectedSequencePresets,
          fileIndex * parsedPattern.items + itemIndex,
          exportPreset.slicing?.maxBlocksPerElement,
        );
      }

      const source = filtered[(fileIndex * parsedPattern.items + itemIndex) % Math.max(filtered.length, 1)];

      return source
        ? {
            id: source.id,
            sourceElementIds: [source.id],
            content: deepClone(source.raw),
          }
        : {
            id: createTagId(`empty_${fileIndex}_${itemIndex}`),
            sourceElementIds: [],
            content: {},
          };
    });

    const fileId = items[0]?.id || `file_${fileIndex + 1}`;

    const sanitizedItems = items.map((item) =>
      sanitizePromptObject(item.content as Record<string, unknown>),
    );

    return {
      fileName: fillPattern(fileNamePattern, {
        index: fileIndex + 1,
        id: fileId,
      }),
      content: sanitizedItems.length === 1 ? sanitizedItems[0] : sanitizedItems,
    };
  });
}
