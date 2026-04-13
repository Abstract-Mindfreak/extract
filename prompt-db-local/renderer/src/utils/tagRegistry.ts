import type { DBElement, ElementTagBinding, Tag, TagRegistry } from '@/types/meta';
import { createTagColor, createTagId } from '@/utils/tagScanner';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeText = (value: string) => value.trim().toLowerCase();

const flattenStringValues = (value: unknown, result: string[] = []) => {
  if (typeof value === 'string') {
    const normalized = normalizeText(value);

    if (normalized) {
      result.push(normalized);
    }

    return result;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      flattenStringValues(item, result);
    }

    return result;
  }

  if (isRecord(value)) {
    for (const entry of Object.values(value)) {
      flattenStringValues(entry, result);
    }
  }

  return result;
};

const collectKeys = (value: unknown, result = new Set<string>()) => {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, result);
    }

    return result;
  }

  if (!isRecord(value)) {
    return result;
  }

  for (const [key, entry] of Object.entries(value)) {
    result.add(key.toLowerCase());
    collectKeys(entry, result);
  }

  return result;
};

const createSemanticVariants = (tag: Tag) => {
  const normalizedLabel = normalizeText(tag.label);
  const normalizedId = normalizeText(tag.id.replaceAll('_', ' '));
  const compactId = tag.id.replaceAll('_', '');

  return Array.from(new Set([normalizedLabel, normalizedId, compactId])).filter(Boolean);
};

export const createTag = (partial?: Partial<Tag>): Tag => {
  const label = partial?.label?.trim() || 'New Tag';
  const id = partial?.id?.trim() || createTagId(label);

  return {
    id,
    label,
    color: partial?.color || createTagColor(id),
    type: partial?.type || 'semantic',
  };
};

export const upsertTag = (registry: TagRegistry, tag: Tag): TagRegistry => {
  const next = new Map<string, Tag>(registry.tags.map((entry) => [entry.id, entry]));
  next.set(tag.id, tag);

  return {
    tags: [...next.values()].sort((left, right) => left.label.localeCompare(right.label)),
  };
};

export const removeTag = (registry: TagRegistry, tagId: string): TagRegistry => ({
  tags: registry.tags.filter((tag) => tag.id !== tagId),
});

export const removeTagsFromBindings = (
  bindings: ElementTagBinding[],
  tagIds: string[],
): ElementTagBinding[] => {
  if (tagIds.length === 0) {
    return bindings;
  }

  const removed = new Set(tagIds);

  return bindings
    .map((binding) => ({
      ...binding,
      tags: binding.tags.filter((tagId) => !removed.has(tagId)),
    }))
    .filter((binding) => binding.tags.length > 0);
};

export const getTagsForElement = (element: DBElement, registry: TagRegistry): string[] => {
  const keys = collectKeys(element.raw);
  const values = flattenStringValues(element.raw).join('\n');
  const matched: string[] = [];

  for (const tag of registry.tags) {
    if (tag.type === 'key') {
      const keyName = normalizeText(tag.label || tag.id);

      if (keys.has(keyName)) {
        matched.push(tag.id);
      }

      continue;
    }

    const variants = createSemanticVariants(tag);

    if (variants.some((variant) => values.includes(variant))) {
      matched.push(tag.id);
    }
  }

  return Array.from(new Set(matched)).sort((left, right) => left.localeCompare(right));
};

export const applyTagsToElements = (
  elements: DBElement[],
  registry: TagRegistry,
): ElementTagBinding[] =>
  elements
    .map((element) => ({
      elementId: element.id,
      tags: getTagsForElement(element, registry),
    }))
    .filter((binding) => binding.tags.length > 0);

export const getBindingsMap = (bindings: ElementTagBinding[]) =>
  new Map<string, string[]>(bindings.map((binding) => [binding.elementId, binding.tags]));
