import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import {
  createEmptyMetaState,
  type PromptDbMetaState,
} from '../shared/meta';
import type { PromptSnapshotRecord } from '../shared/prompt';

export type PromptUsageLogEntry = {
  promptId: string;
  usedAt: string;
  url: string;
  tabId: number;
  windowId: number;
  chromeProfileId?: string;
  source: 'prompt_used' | 'prompt_sent_message';
};

const META_FILE_NAMES = {
  tagRegistry: 'tag-registry.json',
  elementTagBindings: 'element-tag-bindings.json',
  keySequencePresets: 'key-sequence-presets.json',
  exportPresets: 'export-presets.json',
  mistralCoordinationHistory: 'mistral-coordination-history.json',
  promptSnapshot: 'prompts-snapshot.json',
  promptUsageLog: 'prompt-usage-log.json',
} as const;

const getMetaDirectory = () => path.join(app.getPath('userData'), '.prompt-db-meta');

const ensureMetaDirectory = async () => {
  const directoryPath = getMetaDirectory();
  await mkdir(directoryPath, { recursive: true });
  return directoryPath;
};

const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
};

const writeJsonFile = async (filePath: string, value: unknown) => {
  await writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8');
};

export const loadMetaState = async (): Promise<PromptDbMetaState> => {
  const metaDir = await ensureMetaDirectory();
  const empty = createEmptyMetaState();

  const [tagRegistry, elementTagBindings, keySequencePresets, exportPresets, mistralCoordinationHistory] = await Promise.all([
    readJsonFile(path.join(metaDir, META_FILE_NAMES.tagRegistry), empty.tagRegistry),
    readJsonFile(path.join(metaDir, META_FILE_NAMES.elementTagBindings), empty.elementTagBindings),
    readJsonFile(path.join(metaDir, META_FILE_NAMES.keySequencePresets), empty.keySequencePresets),
    readJsonFile(path.join(metaDir, META_FILE_NAMES.exportPresets), empty.exportPresets),
    readJsonFile(
      path.join(metaDir, META_FILE_NAMES.mistralCoordinationHistory),
      empty.mistralCoordinationHistory,
    ),
  ]);

  return {
    tagRegistry,
    elementTagBindings,
    keySequencePresets,
    exportPresets,
    mistralCoordinationHistory,
  };
};

export const saveMetaState = async (state: PromptDbMetaState) => {
  const metaDir = await ensureMetaDirectory();

  await Promise.all([
    writeJsonFile(path.join(metaDir, META_FILE_NAMES.tagRegistry), state.tagRegistry),
    writeJsonFile(path.join(metaDir, META_FILE_NAMES.elementTagBindings), state.elementTagBindings),
    writeJsonFile(path.join(metaDir, META_FILE_NAMES.keySequencePresets), state.keySequencePresets),
    writeJsonFile(path.join(metaDir, META_FILE_NAMES.exportPresets), state.exportPresets),
    writeJsonFile(
      path.join(metaDir, META_FILE_NAMES.mistralCoordinationHistory),
      state.mistralCoordinationHistory,
    ),
  ]);

  return {
    directoryPath: metaDir,
  };
};

export const clearMetaState = async () => {
  const empty = createEmptyMetaState();
  await saveMetaState(empty);
  return empty;
};

export const loadPromptSnapshot = async (): Promise<PromptSnapshotRecord[]> => {
  const metaDir = await ensureMetaDirectory();
  return readJsonFile(path.join(metaDir, META_FILE_NAMES.promptSnapshot), []);
};

export const savePromptSnapshot = async (prompts: PromptSnapshotRecord[]) => {
  const metaDir = await ensureMetaDirectory();
  await writeJsonFile(path.join(metaDir, META_FILE_NAMES.promptSnapshot), prompts);
  return {
    directoryPath: metaDir,
    count: prompts.length,
  };
};

export const loadPromptUsageLog = async (): Promise<PromptUsageLogEntry[]> => {
  const metaDir = await ensureMetaDirectory();
  return readJsonFile(path.join(metaDir, META_FILE_NAMES.promptUsageLog), []);
};

export const appendPromptUsageLog = async (entry: PromptUsageLogEntry) => {
  const metaDir = await ensureMetaDirectory();
  const existing = await readJsonFile<PromptUsageLogEntry[]>(
    path.join(metaDir, META_FILE_NAMES.promptUsageLog),
    [],
  );
  const next = [entry, ...existing].slice(0, 5000);
  await writeJsonFile(path.join(metaDir, META_FILE_NAMES.promptUsageLog), next);
  return {
    directoryPath: metaDir,
    count: next.length,
  };
};
