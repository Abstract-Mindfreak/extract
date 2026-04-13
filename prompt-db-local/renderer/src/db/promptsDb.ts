import Dexie, { type Table } from 'dexie';
import type { PromptDraft, PromptRecord } from '@/types/prompt';
import { extractKeywords } from '@/utils/keywords';
import { derivePromptName, stringifyPromptJson } from '@/utils/promptJson';

export const PROMPTS_DB_NAME = 'prompt-db-local-v3';

const stableSerialize = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !key.startsWith('__'))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`);

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
};

export const createPromptFingerprint = (value: {
  text: string;
  json_data: Record<string, unknown>;
}): string => stableSerialize(value.json_data);

class PromptsDb extends Dexie {
  prompts!: Table<PromptRecord, string>;

  constructor() {
    super(PROMPTS_DB_NAME);

    this.version(1).stores({
      prompts: 'id, name, created_at, updated_at, *keywords, *variables',
    });

    this.version(2)
      .stores({
        prompts: 'id, &fingerprint, name, created_at, updated_at, *keywords, *variables',
      })
      .upgrade((transaction) =>
        transaction
          .table('prompts')
          .toCollection()
          .modify((prompt) => {
            const record = prompt as PromptRecord;
            record.fingerprint = createPromptFingerprint(record);
          }),
      );

    this.version(3)
      .stores({
        prompts: 'id, fingerprint, name, created_at, updated_at, *keywords, *variables',
      })
      .upgrade((transaction) =>
        transaction
          .table('prompts')
          .toCollection()
          .modify((prompt) => {
            const record = prompt as PromptRecord;
            record.fingerprint = createPromptFingerprint(record);
          }),
      );
  }
}

export const promptsDb = new PromptsDb();

export const clearPromptsDb = async () => {
  await promptsDb.prompts.clear();
};

export const normalizePromptDraft = (draft: PromptDraft): PromptRecord => {
  const now = new Date().toISOString();
  const text = stringifyPromptJson(draft.json_data);
  const mergedKeywords = Array.from(
    new Set([...(draft.keywords ?? []), ...extractKeywords(text)]),
  ).slice(0, 20);

  return {
    id: draft.id ?? crypto.randomUUID(),
    name: draft.name.trim() || derivePromptName(draft.json_data),
    text,
    json_data: draft.json_data,
    fingerprint:
      draft.fingerprint ??
      createPromptFingerprint({
        text,
        json_data: draft.json_data,
      }),
    variables: Array.from(new Set(draft.variables ?? [])),
    keywords: mergedKeywords,
    created_at: draft.created_at ?? now,
    updated_at: now,
    source: draft.source,
    serviceMeta: draft.serviceMeta,
  };
};
