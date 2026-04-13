import type { PromptDraft, PromptSourceItem } from '@/types/prompt';
import { extractKeywords, extractVariablesFromText } from '@/utils/keywords';
import {
  derivePromptName,
  extractPromptPayloadAndServiceMeta,
  isRecord,
  stringifyPromptJson,
} from '@/utils/promptJson';

type JsonFragment = {
  parsed: Record<string, unknown>;
  start: number;
  end: number;
};

const findBalancedJsonEnd = (text: string, start: number): number => {
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

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') {
      depth += 1;
      continue;
    }

    if (char === '}') {
      depth -= 1;

      if (depth === 0) {
        return index;
      }

      if (depth < 0) {
        return -1;
      }
    }
  }

  return -1;
};

const looksLikeJsonObjectStart = (text: string, start: number): boolean => {
  if (text[start] !== '{') {
    return false;
  }

  let index = start + 1;

  while (index < text.length && /\s/.test(text[index] ?? '')) {
    index += 1;
  }

  return (text[index] ?? '') === '"' || (text[index] ?? '') === '}';
};

const extractJsonFragments = (text: string): JsonFragment[] => {
  const fragments: JsonFragment[] = [];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '{' || !looksLikeJsonObjectStart(text, index)) {
      continue;
    }

    const endIndex = findBalancedJsonEnd(text, index);

    if (endIndex < 0) {
      continue;
    }

    const candidate = text.slice(index, endIndex + 1);

    try {
      const parsed = JSON.parse(candidate) as unknown;

      if (isRecord(parsed)) {
        fragments.push({
          parsed,
          start: index,
          end: endIndex,
        });
        index = endIndex;
      }
    } catch {
      // Ignore malformed object-shaped chunks and keep scanning.
    }
  }

  return fragments;
};

const sanitizeVariables = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim();
        }

        if (isRecord(item) && typeof item.name === 'string') {
          return item.name.trim();
        }

        return '';
      })
      .filter(Boolean);
  }

  if (isRecord(value)) {
    return Object.keys(value);
  }

  return [];
};

const sanitizeKeywords = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter(Boolean);
};

const createSourceItems = (
  json: Record<string, unknown>,
  fragmentIndex: number,
  existing?: PromptSourceItem[],
): PromptSourceItem[] => {
  if (existing && existing.length > 0) {
    return existing;
  }

  const preferredId =
    (typeof json.id === 'string' && json.id.trim()) ||
    (typeof json.title === 'string' && json.title.trim()) ||
    (typeof json.name === 'string' && json.name.trim()) ||
    `fragment_${fragmentIndex + 1}`;

  return [
    {
      id: preferredId,
      sourceElementIds: [],
    },
  ];
};

const createPromptDraft = (
  json: Record<string, unknown>,
  fragmentIndex: number,
  source: string | undefined,
  sourceItems?: PromptSourceItem[],
): PromptDraft => {
  const extracted = extractPromptPayloadAndServiceMeta(json, {
    fragmentIndex,
    items: createSourceItems(json, fragmentIndex, sourceItems),
  });
  const text = stringifyPromptJson(extracted.json);
  const explicitVariables = sanitizeVariables(extracted.json.variables);
  const inlineVariables = extractVariablesFromText(text);
  const variables = Array.from(new Set([...explicitVariables, ...inlineVariables]));
  const keywords = Array.from(
    new Set([...sanitizeKeywords(extracted.json.keywords), ...extractKeywords(text)]),
  );

  return {
    name: derivePromptName(extracted.json, fragmentIndex),
    text,
    json_data: extracted.json,
    variables,
    keywords,
    source,
    serviceMeta: extracted.serviceMeta,
  };
};

const isGeneratedExportItem = (
  value: unknown,
): value is { id?: unknown; sourceElementIds?: unknown; content: Record<string, unknown> } =>
  isRecord(value) && isRecord(value.content);

const extractFromGeneratedExport = (
  parsed: Record<string, unknown>,
  source: string | undefined,
  fragmentIndex: number,
): PromptDraft[] | null => {
  if (!Array.isArray(parsed.items)) {
    return null;
  }

  const items = parsed.items.filter(isGeneratedExportItem);

  if (items.length === 0) {
    return null;
  }

  return items.map((item, itemIndex) =>
    createPromptDraft(item.content, fragmentIndex + itemIndex, source, [
      {
        id:
          typeof item.id === 'string' && item.id.trim()
            ? item.id.trim()
            : `item_${fragmentIndex + itemIndex + 1}`,
        sourceElementIds: Array.isArray(item.sourceElementIds)
          ? item.sourceElementIds
              .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
              .filter(Boolean)
          : [],
      },
    ]),
  );
};

export const parseJsonToPrompts = (
  rawJson: string,
  options?: { source?: string },
): PromptDraft[] => {
  const fragments = extractJsonFragments(rawJson);
  const prompts = fragments.flatMap((fragment, index) => {
    const fromGeneratedExport = extractFromGeneratedExport(
      fragment.parsed,
      options?.source,
      index,
    );

    if (fromGeneratedExport) {
      return fromGeneratedExport;
    }

    return createPromptDraft(fragment.parsed, index, options?.source);
  });

  return prompts;
};
