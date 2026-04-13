import type { DBElement, FrequencyEntry, TagRegistry } from '@/types/meta';

export const SEMANTIC_SEED_TAGS = [
  'neurofunk',
  'dark_psy_trance',
  'techno_minimalism',
  'kick_transient_geometry',
  'snare_impact_physics',
  'hi_hat_spectral_dust',
  'signal_flow_purity_v4',
  'texture_layering_v4',
  'industrial_groove_logic',
  'spectral_purity_check',
  'temporal_vectoring_details',
  'lyric_fusion_engine_lfe',
  'hyperloop_framework',
  'custom_macros_archive',
  'neuro_industrial_pattern_library',
] as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeValue = (value: string) => value.trim().toLowerCase();

const incrementMap = (map: Map<string, number>, key: string) => {
  if (!key) {
    return;
  }

  map.set(key, (map.get(key) ?? 0) + 1);
};

const hashString = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash);
};

const humanizeTagId = (value: string) =>
  value
    .split(/[_.\-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');

export const createTagColor = (id: string) => {
  const hue = hashString(id) % 360;
  const saturation = 68;
  const lightness = 58;
  const c = ((1 - Math.abs((2 * lightness) / 100 - 1)) * saturation) / 100;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lightness / 100 - c / 2;

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) {
    red = c;
    green = x;
  } else if (hue < 120) {
    red = x;
    green = c;
  } else if (hue < 180) {
    green = c;
    blue = x;
  } else if (hue < 240) {
    green = x;
    blue = c;
  } else if (hue < 300) {
    red = x;
    blue = c;
  } else {
    red = c;
    blue = x;
  }

  const toHex = (channel: number) =>
    Math.round((channel + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`;
};

export const createTagId = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/['"`]+/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'tag';

export function scanTagsAndKeys(elements: DBElement[]): {
  keys: Map<string, number>;
  values: Map<string, number>;
} {
  const keys = new Map<string, number>();
  const values = new Map<string, number>();

  for (const element of elements) {
    const stack: unknown[] = [element.raw];

    while (stack.length > 0) {
      const current = stack.pop();

      if (Array.isArray(current)) {
        for (let index = current.length - 1; index >= 0; index -= 1) {
          stack.push(current[index]);
        }
        continue;
      }

      if (!isRecord(current)) {
        if (typeof current === 'string') {
          const normalized = normalizeValue(current);

          if (normalized && normalized.length <= 200) {
            incrementMap(values, normalized);
          }
        }

        continue;
      }

      for (const [key, value] of Object.entries(current)) {
        incrementMap(keys, key);

        if (typeof value === 'string') {
          const normalized = normalizeValue(value);

          if (normalized && normalized.length <= 200) {
            incrementMap(values, normalized);
          }
          continue;
        }

        if (Array.isArray(value) || isRecord(value)) {
          stack.push(value);
        }
      }
    }
  }

  return {
    keys,
    values,
  };
}

const mapToSortedEntries = (map: Map<string, number>): FrequencyEntry[] =>
  [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));

export const scanResultToLists = (result: ReturnType<typeof scanTagsAndKeys>) => ({
  keys: mapToSortedEntries(result.keys),
  values: mapToSortedEntries(result.values),
});

export const createInitialTagRegistry = (
  elements: DBElement[],
  minimumKeyFrequency = 3,
): TagRegistry => {
  const scanResult = scanTagsAndKeys(elements);

  const tags = [
    ...[...scanResult.keys.entries()]
      .filter(([, count]) => count > minimumKeyFrequency)
      .map(([key]) => ({
        id: createTagId(key),
        label: key,
        color: createTagColor(key),
        type: 'key' as const,
      })),
    ...SEMANTIC_SEED_TAGS.map((seed) => ({
      id: createTagId(seed),
      label: humanizeTagId(seed),
      color: createTagColor(seed),
      type: 'semantic' as const,
    })),
  ];

  const unique = new Map<string, (typeof tags)[number]>();

  for (const tag of tags) {
    if (!unique.has(tag.id)) {
      unique.set(tag.id, tag);
    }
  }

  return {
    tags: [...unique.values()].sort((left, right) => left.label.localeCompare(right.label)),
  };
};
