import type { DBElement, KeySequence } from '@/types/meta';
import { createTagId } from '@/utils/tagScanner';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const extractKeyPathsFromValue = (value: unknown, prefix = '', result: string[] = []) => {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      extractKeyPathsFromValue(entry, prefix, result);
    });
    return result;
  }

  if (!isRecord(value)) {
    return result;
  }

  for (const [key, entry] of Object.entries(value)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    if (Array.isArray(entry) || isRecord(entry)) {
      extractKeyPathsFromValue(entry, nextPath, result);
      continue;
    }

    result.push(nextPath);
  }

  return result;
};

export const extractKeyPaths = (elements: DBElement[]) =>
  elements.flatMap((element) => extractKeyPathsFromValue(element.raw));

const extractSequenceChainsFromValue = (
  value: unknown,
  prefix = '',
  result: string[][] = [],
): string[][] => {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      extractSequenceChainsFromValue(entry, prefix, result);
    });
    return result;
  }

  if (!isRecord(value)) {
    return result;
  }

  const entries = Object.entries(value);

  if (entries.length > 1) {
    const childPaths = entries.map(([key]) => (prefix ? `${prefix}.${key}` : key));
    const pathChain = prefix ? [prefix, ...childPaths] : childPaths;

    if (pathChain.length > 1) {
      result.push(pathChain);
    }
  }

  for (const [key, entry] of entries) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    extractSequenceChainsFromValue(entry, nextPrefix, result);
  }

  return result;
};

export const formatSequenceLabel = (sequence: KeySequence | string[]) =>
  (Array.isArray(sequence) ? sequence : sequence.pathChain).join(' -> ');

export function extractKeySequences(elements: DBElement[]): KeySequence[] {
  const counts = new Map<string, { pathChain: string[]; usageCount: number }>();

  for (const element of elements) {
    const chains = extractSequenceChainsFromValue(element.raw);

    for (const chain of chains) {
      const signature = formatSequenceLabel(chain);
      const existing = counts.get(signature);

      if (existing) {
        existing.usageCount += 1;
      } else {
        counts.set(signature, {
          pathChain: chain,
          usageCount: 1,
        });
      }
    }
  }

  return [...counts.values()]
    .map((entry) => ({
      id: createTagId(entry.pathChain.join('__')),
      pathChain: entry.pathChain,
      usageCount: entry.usageCount,
    }))
    .sort(
      (left, right) =>
        right.usageCount - left.usageCount ||
        formatSequenceLabel(left).localeCompare(formatSequenceLabel(right)),
    );
}
