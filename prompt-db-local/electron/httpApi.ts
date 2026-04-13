import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import {
  appendPromptUsageLog,
  loadMetaState,
  loadPromptSnapshot,
  type PromptUsageLogEntry,
} from './metaStore';
import type { PromptSnapshotRecord } from '../shared/prompt';

type BatchConfig = {
  presetId?: string;
  pattern?: string;
  tagsInclude?: string[];
  tagsExclude?: string[];
};

type GenerateBatchPrompt = {
  id: string;
  text: string;
  presetId?: string;
  sequenceId?: string;
};

type BatchResult = {
  batchId: string;
  prompts: GenerateBatchPrompt[];
};

const DEFAULT_HTTP_PORT = 3210;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isServiceItemsArray = (value: unknown) =>
  Array.isArray(value) &&
  value.length > 0 &&
  value.every(
    (entry) =>
      isRecord(entry) &&
      typeof entry.id === 'string' &&
      Array.isArray(entry.sourceElementIds) &&
      entry.sourceElementIds.every((item) => typeof item === 'string'),
  );

const sanitizePromptJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePromptJson(entry));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, entry]) => !key.startsWith('__') && !(key === 'items' && isServiceItemsArray(entry)))
      .map(([key, entry]) => [key, sanitizePromptJson(entry)]),
  );
};

const sanitizePromptObject = (value: Record<string, unknown>) =>
  sanitizePromptJson(value) as Record<string, unknown>;

const parsePattern = (pattern?: string) => {
  const match = String(pattern || '')
    .trim()
    .toLowerCase()
    .match(/(\d+)\s*[xС…*]\s*(\d+)(?:\s+([a-z_]+))?/i);

  return {
    files: Math.max(1, Number(match?.[1]) || 1),
    items: Math.max(1, Number(match?.[2]) || 12),
    mode: match?.[3] || 'random',
  };
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
    if (!key.startsWith('__')) {
      result.add(key);
    }

    collectKeyNames(entry, result);
  });

  return result;
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

  cursor[segments[segments.length - 1]] = sanitizePromptJson(value);
};

const createTagBindingsMap = (bindings: Array<{ elementId: string; tags: string[] }>) =>
  new Map(bindings.map((binding) => [binding.elementId, binding.tags]));

const filterPrompts = (
  prompts: PromptSnapshotRecord[],
  bindingsMap: Map<string, string[]>,
  config: Required<Pick<BatchConfig, 'tagsInclude' | 'tagsExclude'>>,
  preset: {
    includeKeys: string[];
    excludeKeys: string[];
  },
) =>
  prompts.filter((prompt) => {
    const promptTags = new Set(bindingsMap.get(prompt.id) ?? []);
    const keyNames = collectKeyNames(prompt.json_data);

    if (config.tagsInclude.length > 0 && !config.tagsInclude.every((tag) => promptTags.has(tag))) {
      return false;
    }

    if (config.tagsExclude.some((tag) => promptTags.has(tag))) {
      return false;
    }

    if (preset.includeKeys.length > 0 && !preset.includeKeys.every((key) => keyNames.has(key))) {
      return false;
    }

    if (preset.excludeKeys.some((key) => keyNames.has(key))) {
      return false;
    }

    return true;
  });

const chooseIndexed = <T>(items: T[], index: number, mode: string) => {
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

const getTopLevelFragments = (prompt: PromptSnapshotRecord) => {
  const json = sanitizePromptObject(prompt.json_data);

  return Object.entries(json).map(([key, value]) => ({
    path: key,
    value,
    sourceId: prompt.id,
  }));
};

const buildRandomMixObject = (
  prompts: PromptSnapshotRecord[],
  itemIndex: number,
  mode: string,
  maxBlocksPerElement = 4,
) => {
  const allFragments = prompts.flatMap(getTopLevelFragments);
  const output: Record<string, unknown> = {};
  const used = new Set<string>();

  for (let index = 0; index < Math.max(1, maxBlocksPerElement); index += 1) {
    const fragment = chooseIndexed(allFragments, itemIndex + index, mode);

    if (!fragment || used.has(`${fragment.sourceId}:${fragment.path}`)) {
      continue;
    }

    used.add(`${fragment.sourceId}:${fragment.path}`);
    setValueByPath(output, fragment.path, fragment.value);
  }

  return output;
};

const buildSequenceBasedObject = (
  prompts: PromptSnapshotRecord[],
  selectedPresets: Array<{
    sequences: Array<{ id: string; pathChain: string[] }>;
    generationRules?: { mode?: 'random' | 'weighted' | 'sequential'; maxBlocks?: number };
  }>,
  itemIndex: number,
  maxBlocksPerElement = 4,
) => {
  const output: Record<string, unknown> = {};
  let blockCount = 0;
  let firstSequenceId: string | undefined;

  for (const preset of selectedPresets) {
    const mode = preset.generationRules?.mode ?? 'random';
    const limit = preset.generationRules?.maxBlocks ?? preset.sequences.length;

    for (let sequenceIndex = 0; sequenceIndex < preset.sequences.length; sequenceIndex += 1) {
      if (blockCount >= maxBlocksPerElement || blockCount >= limit) {
        break;
      }

      const sequence = preset.sequences[sequenceIndex];
      const parentPath = sequence.pathChain[0];
      const matches = prompts.filter(
        (prompt) => getValueByPath(prompt.json_data, parentPath) !== undefined,
      );
      const selected = chooseIndexed(matches, itemIndex + sequenceIndex, mode);

      if (!selected) {
        continue;
      }

      const value = getValueByPath(selected.json_data, parentPath);

      if (value === undefined) {
        continue;
      }

      setValueByPath(output, parentPath, value);
      firstSequenceId ??= sequence.id;
      blockCount += 1;
    }
  }

  return {
    content: output,
    sequenceId: firstSequenceId,
  };
};

const buildBatchPrompts = async (config: BatchConfig): Promise<BatchResult> => {
  const [metaState, promptSnapshot] = await Promise.all([loadMetaState(), loadPromptSnapshot()]);
  const exportPreset =
    metaState.exportPresets.find((preset) => preset.id === config.presetId) ??
    metaState.exportPresets[0];
  const parsedPattern = parsePattern(config.pattern || exportPreset?.composition?.pattern);
  const bindingsMap = createTagBindingsMap(metaState.elementTagBindings);
  const includeKeys = exportPreset?.filters?.includeKeys ?? [];
  const excludeKeys = exportPreset?.filters?.excludeKeys ?? [];
  const filtered = filterPrompts(
    promptSnapshot,
    bindingsMap,
    {
      tagsInclude:
        config.tagsInclude && config.tagsInclude.length > 0
          ? config.tagsInclude
          : exportPreset?.filters?.includeTags ?? [],
      tagsExclude: Array.from(
        new Set([...(exportPreset?.filters?.excludeTags ?? []), ...(config.tagsExclude ?? [])]),
      ),
    },
    {
      includeKeys,
      excludeKeys,
    },
  );
  const compositionMode = exportPreset?.composition?.mode ?? 'as-is';
  const sequencePresets =
    exportPreset?.slicing?.useKeySequences && exportPreset.slicing.useKeySequences.length > 0
      ? metaState.keySequencePresets.filter((preset) =>
          exportPreset.slicing?.useKeySequences?.includes(preset.id),
        )
      : metaState.keySequencePresets;

  const prompts: GenerateBatchPrompt[] = [];
  const maxMixItems = Math.max(1, exportPreset?.slicing?.maxBlocksPerElement ?? 4);

  /** Matches renderer `exportComposer.generateExport`: `files` outputs, each with `items` fragments. */
  for (let fileIndex = 0; fileIndex < parsedPattern.files; fileIndex += 1) {
    if (filtered.length === 0) {
      break;
    }

    const rawItems: Record<string, unknown>[] = [];
    let fileSequenceId: string | undefined;

    for (let itemIndex = 0; itemIndex < parsedPattern.items; itemIndex += 1) {
      const globalIndex = fileIndex * parsedPattern.items + itemIndex;

      if (compositionMode === 'random-mix') {
        const content = buildRandomMixObject(filtered, globalIndex, parsedPattern.mode, maxMixItems);
        rawItems.push(Object.keys(content).length === 0 ? {} : content);
        continue;
      }

      if (compositionMode === 'sequence-based' && sequencePresets.length > 0) {
        const { content, sequenceId } = buildSequenceBasedObject(
          filtered,
          sequencePresets,
          globalIndex,
          maxMixItems,
        );

        if (sequenceId) {
          fileSequenceId ??= sequenceId;
        }

        rawItems.push(content);
        continue;
      }

      const prompt = chooseIndexed(filtered, globalIndex, parsedPattern.mode);

      if (!prompt) {
        rawItems.push({});
        continue;
      }

      rawItems.push(prompt.json_data as Record<string, unknown>);
    }

    const sanitizedItems = rawItems.map((item) => sanitizePromptObject(item));
    const combined =
      sanitizedItems.length === 1 ? sanitizedItems[0] : sanitizedItems;

    const promptEntry: GenerateBatchPrompt = {
      id: `file_${fileIndex + 1}_${crypto.randomUUID()}`,
      text: JSON.stringify(sanitizePromptJson(combined), null, 2),
      presetId: exportPreset?.id ?? config.presetId,
    };

    if (fileSequenceId) {
      promptEntry.sequenceId = fileSequenceId;
    }

    prompts.push(promptEntry);
  }

  return {
    batchId: crypto.randomUUID(),
    prompts,
  };
};

const readJsonBody = async (request: IncomingMessage) =>
  new Promise<unknown>((resolve, reject) => {
    const chunks: Buffer[] = [];

    request.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? (JSON.parse(raw) as unknown) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });

const sendJson = (response: ServerResponse, statusCode: number, payload: unknown) => {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  response.end(JSON.stringify(payload));
};

export const startHttpApiServer = (port = DEFAULT_HTTP_PORT) => {
  const server = http.createServer(async (request, response) => {
    if (!request.url) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }

    if (request.method === 'OPTIONS') {
      sendJson(response, 204, {});
      return;
    }

    try {
      if (request.method === 'GET' && request.url === '/api/health') {
        sendJson(response, 200, {
          ok: true,
          port,
        });
        return;
      }

      if (request.method === 'GET' && request.url === '/api/exportPresets') {
        const metaState = await loadMetaState();
        sendJson(response, 200, {
          presets: metaState.exportPresets,
        });
        return;
      }

      if (request.method === 'POST' && request.url === '/api/generateBatch') {
        const body = (await readJsonBody(request)) as BatchConfig;
        const batchResult = await buildBatchPrompts(body);
        sendJson(response, 200, batchResult);
        return;
      }

      if (request.method === 'POST' && request.url === '/api/promptUsage') {
        const body = (await readJsonBody(request)) as Partial<PromptUsageLogEntry>;
        const entry: PromptUsageLogEntry = {
          promptId: String(body.promptId || ''),
          usedAt:
            typeof body.usedAt === 'number'
              ? new Date(body.usedAt).toISOString()
              : String(body.usedAt || new Date().toISOString()),
          url: String(body.url || ''),
          tabId: Number(body.tabId || 0),
          windowId: Number(body.windowId || 0),
          chromeProfileId: body.chromeProfileId ? String(body.chromeProfileId) : undefined,
          source:
            body.source === 'prompt_sent_message' ? 'prompt_sent_message' : 'prompt_used',
        };

        await appendPromptUsageLog(entry);
        sendJson(response, 200, {
          ok: true,
          promptId: entry.promptId,
        });
        return;
      }

      sendJson(response, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : 'Unknown HTTP API error',
      });
    }
  });

  return new Promise<http.Server>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve(server);
    });
  });
};

export const HTTP_API_PORT = DEFAULT_HTTP_PORT;
