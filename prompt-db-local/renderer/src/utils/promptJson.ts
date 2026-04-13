import type { PromptRecord, PromptServiceMeta, PromptSourceItem } from '@/types/prompt';

const NAME_KEYS = ['name', 'title', 'id', 'module_id', 'macro_name', 'package_id', 'system_id'];
const GENERIC_NAME_VALUES = new Set(['block id', 'id', 'block', 'item']);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSourceItem = (value: unknown): value is PromptSourceItem =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  Array.isArray(value.sourceElementIds) &&
  value.sourceElementIds.every((entry) => typeof entry === 'string');

const isServiceItemsArray = (value: unknown): value is PromptSourceItem[] =>
  Array.isArray(value) && value.length > 0 && value.every(isSourceItem);

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const humanizeKey = (value: string) =>
  value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeNameCandidate = (value: string) => normalizeWhitespace(value).toLowerCase();

const isMeaningfulName = (value: string) => {
  const normalized = normalizeNameCandidate(value);

  if (!normalized || GENERIC_NAME_VALUES.has(normalized)) {
    return false;
  }

  return normalized.length > 1;
};

export const sanitizePromptJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePromptJson(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entryValue]) => !key.startsWith('__') && !(key === 'items' && isServiceItemsArray(entryValue)))
      .map(([key, entryValue]) => [key, sanitizePromptJson(entryValue)]),
  );
};

export const sanitizePromptObject = (value: Record<string, unknown>) =>
  sanitizePromptJson(value) as Record<string, unknown>;

export const stringifyPromptJson = (value: Record<string, unknown>) =>
  JSON.stringify(sanitizePromptObject(value), null, 2);

export const compactPromptPreview = (value: string, limit = 160) =>
  normalizeWhitespace(value).slice(0, limit) || 'Empty JSON block';

export const extractPromptPayloadAndServiceMeta = (
  value: Record<string, unknown>,
  existingMeta?: PromptServiceMeta,
) => {
  const serviceMeta: PromptServiceMeta = {
    ...existingMeta,
  };

  if (typeof value.__fragmentIndex === 'number') {
    serviceMeta.fragmentIndex = value.__fragmentIndex;
  }

  if (isServiceItemsArray(value.items)) {
    serviceMeta.items = value.items;
  }

  return {
    json: sanitizePromptObject(value),
    serviceMeta,
  };
};

export const derivePromptName = (value: Record<string, unknown>, index = 0) => {
  for (const key of NAME_KEYS) {
    const candidate = value[key];

    if (typeof candidate === 'string' && isMeaningfulName(candidate)) {
      return normalizeWhitespace(candidate);
    }
  }

  const firstStringValue = Object.values(value).find(
    (entry): entry is string => typeof entry === 'string' && isMeaningfulName(entry),
  );

  if (firstStringValue) {
    return normalizeWhitespace(firstStringValue);
  }

  const firstKey = Object.keys(value).find(
    (entry) => !entry.startsWith('__') && isMeaningfulName(entry),
  );

  if (firstKey && isMeaningfulName(firstKey)) {
    return humanizeKey(firstKey);
  }

  return `Block #${String(index + 1).padStart(3, '0')}`;
};

export const getPromptTextForUi = (prompt: Pick<PromptRecord, 'text' | 'json_data'>) =>
  stringifyPromptJson(prompt.json_data);
