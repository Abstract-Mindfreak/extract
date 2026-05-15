import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Box,
  Check,
  Download,
  FileCode,
  Layers,
  Pin,
  Save,
  Search,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateWithGemini, generateWithMistral, planMistralLibraryQueries, type MistralLibraryPlan } from '../services/aiService';
import { cn } from '../lib/utils';
import { JSONBlock, JSONType, blocksToJson, chunkJSON, createDefaultBlock, jsonToBlocks } from '../types';
import { BlockNode } from './BlockNode';
import { BlockPalette } from './BlockPalette';

const MMSS_BRIDGE_API_BASE = 'http://localhost:3456/api/mmss';
const MAX_CONTEXT_BLOCKS = 10;
const STORAGE_KEY = 'json_genesis_mistral_pipeline_v1';
const DEFAULT_MMSS_META_RULES = [
  'Include MMSS metrics when relevant: V, N, S, D_f, G_S, R_T.',
  'Preserve MMSS meta-formulas and relation operators when they match the selected context.',
  'Respect MMSS JSON construction rules: explicit hierarchy, reusable principles, operator traceability, and measurable output fields.',
];

type MmssPromptBlock = {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  payload?: { data?: any };
};

type RankedBlock = {
  block: MmssPromptBlock;
  score: number;
  reasons: string[];
  roleMatches: string[];
};

type PipelineStep = 'plan' | 'preview' | 'approve' | 'generate';

type PipelinePreset = {
  pipelineMode: 'direct' | 'search-plan';
  rankedLimit: number;
  includeMmssMeta: boolean;
  assemblyRules: string;
  manualPinnedBlockIds: string[];
  approvedBlockIds: string[];
};

const EMPTY_PLAN: MistralLibraryPlan = {
  queries: [],
  principles: [],
  notes: [],
  blockRoles: [],
  metaDirectives: [],
};

const DEFAULT_PRESET: PipelinePreset = {
  pipelineMode: 'search-plan',
  rankedLimit: 4,
  includeMmssMeta: true,
  assemblyRules: '',
  manualPinnedBlockIds: [],
  approvedBlockIds: [],
};

const tokenize = (input: string) =>
  String(input || '')
    .toLowerCase()
    .split(/[^a-zа-я0-9_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);

const dedupeStrings = (items: string[]) => Array.from(new Set(items.filter(Boolean)));
const safeJsonSnippet = (value: unknown, maxLength = 1600) => JSON.stringify(value ?? {}).slice(0, maxLength);

export const MainEditor: React.FC = () => {
  const [root, setRoot] = useState<JSONBlock>(createDefaultBlock('object', 'root'));
  const [projectName, setProjectName] = useState('Industrial_Sublime_v4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlanningContext, setIsPlanningContext] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<'gemini' | 'mistral'>('gemini');
  const [genMode, setGenMode] = useState<'augment' | 'rewrite' | 'skeleton'>('augment');
  const [assemblyRules, setAssemblyRules] = useState(DEFAULT_PRESET.assemblyRules);
  const [aiEventLog, setAiEventLog] = useState<string[]>([]);
  const [aiStatusText, setAiStatusText] = useState('Idle');
  const [libraryBlocks, setLibraryBlocks] = useState<JSONBlock[]>([]);
  const [importToLib, setImportToLib] = useState(true);
  const [mmssLibrarySummary, setMmssLibrarySummary] = useState('Not synced');
  const [mmssPromptBlocks, setMmssPromptBlocks] = useState<MmssPromptBlock[]>([]);
  const [lastLibrarySyncAt, setLastLibrarySyncAt] = useState<string | null>(null);
  const [lastGenesisHandoffAt, setLastGenesisHandoffAt] = useState<string | null>(null);
  const [lastPresetSyncAt, setLastPresetSyncAt] = useState<string | null>(null);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [manualPinnedBlockIds, setManualPinnedBlockIds] = useState<string[]>(DEFAULT_PRESET.manualPinnedBlockIds);
  const [approvedBlockIds, setApprovedBlockIds] = useState<string[]>(DEFAULT_PRESET.approvedBlockIds);
  const [rankedLimit, setRankedLimit] = useState(DEFAULT_PRESET.rankedLimit);
  const [selectedLibraryBlockId, setSelectedLibraryBlockId] = useState<string | null>(null);
  const [mistralPlan, setMistralPlan] = useState<MistralLibraryPlan>(EMPTY_PLAN);
  const [mistralPipelineMode, setMistralPipelineMode] = useState<'direct' | 'search-plan'>(DEFAULT_PRESET.pipelineMode);
  const [lastSentBlockNames, setLastSentBlockNames] = useState<string[]>([]);
  const [pipelineStep, setPipelineStep] = useState<PipelineStep>('plan');
  const [includeMmssMeta, setIncludeMmssMeta] = useState(DEFAULT_PRESET.includeMmssMeta);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('json_genesis_project');
    if (!saved) return;
    try {
      const data = JSON.parse(saved);
      setRoot(data.root);
      if (data.library) setLibraryBlocks(data.library);
      setProjectName(data.name || 'Industrial_Sublime_v4');
    } catch (error) {
      console.error('Failed to load project', error);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PipelinePreset>;
      setMistralPipelineMode(parsed.pipelineMode || DEFAULT_PRESET.pipelineMode);
      setRankedLimit(parsed.rankedLimit || DEFAULT_PRESET.rankedLimit);
      setIncludeMmssMeta(parsed.includeMmssMeta ?? DEFAULT_PRESET.includeMmssMeta);
      setAssemblyRules(parsed.assemblyRules ?? DEFAULT_PRESET.assemblyRules);
      setManualPinnedBlockIds(Array.isArray(parsed.manualPinnedBlockIds) ? parsed.manualPinnedBlockIds : []);
      setApprovedBlockIds(Array.isArray(parsed.approvedBlockIds) ? parsed.approvedBlockIds : []);
    } catch (error) {
      console.error('Failed to load Mistral preset', error);
    }
  }, []);

  useEffect(() => {
    void loadMistralPresetFromBridge();
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        pipelineMode: mistralPipelineMode,
        rankedLimit,
        includeMmssMeta,
        assemblyRules,
        manualPinnedBlockIds,
        approvedBlockIds,
      } satisfies PipelinePreset),
    );
  }, [mistralPipelineMode, rankedLimit, includeMmssMeta, assemblyRules, manualPinnedBlockIds, approvedBlockIds]);

  useEffect(() => {
    void requestMmssLibrary();
    void pullGenesisHandoff();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void requestMmssLibrary(true);
      void pullGenesisHandoff(true);
    }, 4000);
    return () => window.clearInterval(intervalId);
  }, [lastLibrarySyncAt, lastGenesisHandoffAt]);

  const appendAiEvent = (message: string) => {
    setAiEventLog((prev) => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev].slice(0, 24));
  };

  const saveToLocal = () => {
    localStorage.setItem(
      'json_genesis_project',
      JSON.stringify({
        root,
        library: libraryBlocks,
        name: projectName,
      }),
    );
  };

  const buildPipelinePreset = (): PipelinePreset => ({
    pipelineMode: mistralPipelineMode,
    rankedLimit,
    includeMmssMeta,
    assemblyRules,
    manualPinnedBlockIds,
    approvedBlockIds,
  });

  const loadMistralPresetFromBridge = async () => {
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/mistral-preset`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.preset) return;
      const preset = payload.preset as Partial<PipelinePreset>;
      setMistralPipelineMode(preset.pipelineMode || DEFAULT_PRESET.pipelineMode);
      setRankedLimit(preset.rankedLimit || DEFAULT_PRESET.rankedLimit);
      setIncludeMmssMeta(preset.includeMmssMeta ?? DEFAULT_PRESET.includeMmssMeta);
      setAssemblyRules(preset.assemblyRules ?? DEFAULT_PRESET.assemblyRules);
      setManualPinnedBlockIds(Array.isArray(preset.manualPinnedBlockIds) ? preset.manualPinnedBlockIds : []);
      setApprovedBlockIds(Array.isArray(preset.approvedBlockIds) ? preset.approvedBlockIds : []);
      setLastPresetSyncAt(payload.updatedAt || null);
      appendAiEvent('Loaded Mistral preset from MMSS bridge');
    } catch (error) {
      appendAiEvent(`Preset bridge load failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  const saveMistralPresetToBridge = async () => {
    try {
      setIsSavingPreset(true);
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/mistral-preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preset: buildPipelinePreset(),
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      setLastPresetSyncAt(payload.updatedAt || null);
      appendAiEvent('Saved Mistral preset to MMSS bridge');
    } catch (error) {
      appendAiEvent(`Preset bridge save failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsSavingPreset(false);
    }
  };

  const requestMmssLibrary = async (silent = false) => {
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/library-state`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (silent && payload?.updatedAt && payload.updatedAt === lastLibrarySyncAt) return;

      const promptLibrary = payload?.promptLibrary;
      const promptBlocks = Array.isArray(promptLibrary?.blocks) ? promptLibrary.blocks : [];
      const importedBlocks = promptBlocks.map((block: MmssPromptBlock) => {
        const blockJson = block?.payload?.data ?? {};
        const genesisBlock = jsonToBlocks(blockJson, block?.name || 'MMSS Block');
        genesisBlock.libraryName = block?.name || 'MMSS Block';
        genesisBlock.sourcePromptBlockId = block.id;
        return genesisBlock;
      });

      setMmssPromptBlocks(promptBlocks);
      setLibraryBlocks(importedBlocks);
      setMmssLibrarySummary(`${promptBlocks.length} blocks · ${promptLibrary?.sequences?.length || 0} sequences`);
      setLastLibrarySyncAt(payload?.updatedAt || null);
      setSelectedLibraryBlockId((current) => current || promptBlocks[0]?.id || null);
      appendAiEvent(`MMSS library synced: ${promptBlocks.length} block(s)`);
    } catch (error) {
      if (!silent) {
        appendAiEvent(`MMSS sync failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  };

  const pullGenesisHandoff = async (silent = false) => {
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/genesis-handoff`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.json) return;
      if (payload.updatedAt && payload.updatedAt === lastGenesisHandoffAt) return;

      setRoot(jsonToBlocks(payload.json));
      setProjectName(`${payload.source || 'MMSS'}_handoff`);
      setLastGenesisHandoffAt(payload.updatedAt || null);
      appendAiEvent(`Received JSON from my-app: ${payload.source || 'MMSS'}`);
    } catch (error) {
      if (!silent) {
        appendAiEvent(`Genesis handoff pull failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  };

  const saveRootToMmssLibrary = async () => {
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/import-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: blocksToJson(root),
          source: projectName,
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      appendAiEvent('Sent current root to my-app library');
    } catch (error) {
      appendAiEvent(`Failed to save to my-app library: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  };

  const resetPipeline = () => {
    setMistralPlan(EMPTY_PLAN);
    setApprovedBlockIds([]);
    setPipelineStep('plan');
    appendAiEvent('Mistral pipeline reset');
  };

  const allSearchTokens = useMemo(() => {
    const promptTokens = tokenize(aiPrompt);
    const manualTokens = tokenize(librarySearchQuery);
    const planTokens = mistralPlan.queries.flatMap((query) => tokenize(query));
    const roleTokens = mistralPlan.blockRoles.flatMap((role) => tokenize(role));
    const principleTokens = mistralPlan.principles.flatMap((item) => tokenize(item));
    return dedupeStrings([...promptTokens, ...manualTokens, ...planTokens, ...roleTokens, ...principleTokens]);
  }, [aiPrompt, librarySearchQuery, mistralPlan]);

  const buildRankedBlocks = (tokens: string[]): RankedBlock[] =>
    mmssPromptBlocks
      .map((block) => {
        const rawPayload = block.payload?.data ?? {};
        const name = (block.name || '').toLowerCase();
        const description = (block.description || '').toLowerCase();
        const tags = Array.isArray(block.tags) ? block.tags.map((tag) => tag.toLowerCase()) : [];
        const payloadText = safeJsonSnippet(rawPayload, 2400).toLowerCase();
        const payloadKeys = collectKeys(rawPayload);
        const payloadDepth = getJsonDepth(rawPayload);
        const roleMatches: string[] = [];
        let score = 0;
        const reasons: string[] = [];

        tokens.forEach((token) => {
          let tokenScore = 0;
          if (name.includes(token)) tokenScore += 7;
          if (description.includes(token)) tokenScore += 4;
          if (tags.some((tag) => tag.includes(token))) tokenScore += 5;
          if (payloadKeys.some((key) => key.includes(token))) tokenScore += 4;
          if (payloadText.includes(token)) tokenScore += 2;
          if (tokenScore > 0) reasons.push(`${token}:${tokenScore}`);
          score += tokenScore;
        });

        mistralPlan.blockRoles.forEach((role) => {
          const roleToken = role.toLowerCase();
          const roleMatched =
            name.includes(roleToken) ||
            description.includes(roleToken) ||
            tags.some((tag) => tag.includes(roleToken)) ||
            payloadKeys.some((key) => key.includes(roleToken));
          if (roleMatched) {
            score += 6;
            roleMatches.push(role);
          }
        });

        if (payloadDepth >= 4) {
          score += 2;
          reasons.push(`depth:${payloadDepth}`);
        }
        if (payloadKeys.length >= 12) {
          score += 2;
          reasons.push(`keys:${payloadKeys.length}`);
        }
        if (containsMmssMeta(rawPayload)) {
          score += 4;
          reasons.push('mmss-meta');
        }
        if (manualPinnedBlockIds.includes(block.id)) {
          score += 50;
          reasons.push('pinned');
        }

        return { block, score, reasons, roleMatches };
      })
      .filter((entry) => entry.score > 0 || manualPinnedBlockIds.includes(entry.block.id))
      .sort((left, right) => right.score - left.score || (left.block.name || '').localeCompare(right.block.name || ''));

  const rankedBlocks = useMemo(
    () => buildRankedBlocks(allSearchTokens),
    [allSearchTokens, mmssPromptBlocks, manualPinnedBlockIds, mistralPlan.blockRoles],
  );

  const candidateBlocks = useMemo(
    () => rankedBlocks.slice(0, Math.max(rankedLimit + manualPinnedBlockIds.length + 2, rankedLimit)),
    [rankedBlocks, rankedLimit, manualPinnedBlockIds.length],
  );

  const approvedContextBlocks = useMemo(() => {
    if (!approvedBlockIds.length) return [];
    return approvedBlockIds
      .map((id) => mmssPromptBlocks.find((block) => block.id === id))
      .filter((block): block is MmssPromptBlock => Boolean(block))
      .slice(0, MAX_CONTEXT_BLOCKS);
  }, [approvedBlockIds, mmssPromptBlocks]);

  const selectedContextBlocks = useMemo(() => {
    if (mistralPipelineMode === 'search-plan' && approvedContextBlocks.length) {
      return approvedContextBlocks;
    }
    return dedupeById(
      candidateBlocks
        .filter((entry) => manualPinnedBlockIds.includes(entry.block.id) || entry.score > 0)
        .slice(0, rankedLimit + manualPinnedBlockIds.length)
        .map((entry) => entry.block),
    ).slice(0, MAX_CONTEXT_BLOCKS);
  }, [mistralPipelineMode, approvedContextBlocks, candidateBlocks, manualPinnedBlockIds, rankedLimit]);

  const mmssMetaContext = useMemo(() => {
    if (!includeMmssMeta) return null;
    return {
      requiredMetrics: ['V', 'N', 'S', 'D_f', 'G_S', 'R_T'],
      defaultRules: DEFAULT_MMSS_META_RULES,
      planPrinciples: mistralPlan.principles,
      metaDirectives: mistralPlan.metaDirectives,
    };
  }, [includeMmssMeta, mistralPlan]);

  const relevantLibraryContext = useMemo(
    () =>
      JSON.stringify(
        {
          summary: mmssLibrarySummary,
          pipeline: {
            mode: mistralPipelineMode,
            step: pipelineStep,
            queryTokens: allSearchTokens,
            approvedBlockIds,
            pinnedBlockIds: manualPinnedBlockIds,
            mistralQueries: mistralPlan.queries,
            blockRoles: mistralPlan.blockRoles,
            principles: mistralPlan.principles,
          },
          mmssMeta: mmssMetaContext,
          relevantBlocks: selectedContextBlocks.map((block) => ({
            id: block.id,
            name: block.name,
            description: block.description,
            tags: block.tags || [],
            payload: block.payload?.data ?? {},
          })),
        },
        null,
        2,
      ),
    [
      mmssLibrarySummary,
      mistralPipelineMode,
      pipelineStep,
      allSearchTokens,
      approvedBlockIds,
      manualPinnedBlockIds,
      mistralPlan,
      mmssMetaContext,
      selectedContextBlocks,
    ],
  );

  const selectedLibraryBlock = useMemo(() => {
    const fromPromptLibrary = mmssPromptBlocks.find((block) => block.id === selectedLibraryBlockId);
    if (fromPromptLibrary) return fromPromptLibrary;
    const fromGenesisLibrary = libraryBlocks.find((block) => block.id === selectedLibraryBlockId);
    if (!fromGenesisLibrary) return null;
    return {
      id: fromGenesisLibrary.id,
      name: fromGenesisLibrary.libraryName,
      description: 'Imported fragment preview',
      tags: [],
      payload: { data: blocksToJson(fromGenesisLibrary) },
    } satisfies MmssPromptBlock;
  }, [selectedLibraryBlockId, mmssPromptBlocks, libraryBlocks]);

  const selectedLibraryJson = useMemo(
    () => JSON.stringify(selectedLibraryBlock?.payload?.data ?? {}, null, 2),
    [selectedLibraryBlock],
  );

  const togglePinnedBlock = (blockId: string) => {
    setManualPinnedBlockIds((prev) => (prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]));
  };

  const toggleApprovedBlock = (blockId: string) => {
    setApprovedBlockIds((prev) => (prev.includes(blockId) ? prev.filter((id) => id !== blockId) : [...prev, blockId]));
  };

  const approveSuggestedContext = () => {
    const nextIds = candidateBlocks.slice(0, rankedLimit + manualPinnedBlockIds.length).map((entry) => entry.block.id);
    setApprovedBlockIds(dedupeStrings([...manualPinnedBlockIds, ...nextIds]));
    setPipelineStep('approve');
    appendAiEvent(`Approved context blocks: ${nextIds.length}`);
  };

  const updateBlock = (id: string, updates: Partial<JSONBlock>) => {
    const walk = (blocks: JSONBlock[]): JSONBlock[] =>
      blocks.map((block) => {
        if (block.id === id) return { ...block, ...updates };
        if (block.children) return { ...block, children: walk(block.children) };
        return block;
      });

    if (root.id === id) {
      setRoot({ ...root, ...updates });
      return;
    }

    setRoot((prev) => ({ ...prev, children: walk(prev.children || []) }));
  };

  const deleteBlock = (id: string) => {
    if (root.id === id) return;
    const walk = (blocks: JSONBlock[]): JSONBlock[] =>
      blocks
        .filter((block) => block.id !== id)
        .map((block) => ({
          ...block,
          children: block.children ? walk(block.children) : undefined,
        }));
    setRoot((prev) => ({ ...prev, children: walk(prev.children || []) }));
  };

  const addChild = (parentId: string, type: JSONType) => {
    const newBlock = createDefaultBlock(type, `new_${type}`);
    const walk = (blocks: JSONBlock[]): JSONBlock[] =>
      blocks.map((block) => {
        if (block.id === parentId) {
          return { ...block, children: [...(block.children || []), newBlock], isExpanded: true };
        }
        if (block.children) return { ...block, children: walk(block.children) };
        return block;
      });

    if (root.id === parentId) {
      setRoot((prev) => ({ ...prev, children: [...(prev.children || []), newBlock], isExpanded: true }));
      return;
    }

    setRoot((prev) => ({ ...prev, children: walk(prev.children || []) }));
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const json = JSON.parse(loadEvent.target?.result as string);
        if (importToLib) {
          setLibraryBlocks((prev) => [...prev, ...chunkJSON(json)]);
        } else {
          setRoot(jsonToBlocks(json));
          setProjectName(file.name.replace('.json', ''));
        }
      } catch (_error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const addLibraryItemToRoot = (block: JSONBlock) => {
    const clone = (node: JSONBlock): JSONBlock => ({
      ...node,
      id: uuidv4(),
      children: node.children?.map(clone),
    });
    const newBlock = clone(block);
    setRoot((prev) => ({ ...prev, children: [...(prev.children || []), newBlock] }));
  };

  const handleExport = () => {
    const json = blocksToJson(root);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}.json`;
    anchor.click();
  };

  const handlePlanMistralContext = async () => {
    if (!aiPrompt.trim()) return;
    setIsPlanningContext(true);
    setPipelineStep('plan');
    appendAiEvent('Mistral planning retrieval queries');
    try {
      const summary = JSON.stringify(
        {
          librarySummary: mmssLibrarySummary,
          availableBlocks: mmssPromptBlocks.slice(0, 40).map((block) => ({
            id: block.id,
            name: block.name,
            description: block.description,
            tags: block.tags || [],
            payloadKeys: collectKeys(block.payload?.data ?? {}).slice(0, 24),
            hasMmssMeta: containsMmssMeta(block.payload?.data ?? {}),
          })),
        },
        null,
        2,
      );
      const plan = await planMistralLibraryQueries(aiPrompt, summary, (message) => {
        setAiStatusText(message);
        appendAiEvent(message);
      });
      setMistralPlan(plan);
      setPipelineStep('preview');
      appendAiEvent(`Mistral queries: ${plan.queries.join(' | ') || 'none'}`);
      appendAiEvent(`Mistral roles: ${plan.blockRoles.join(', ') || 'none'}`);
    } catch (error) {
      appendAiEvent(`Mistral planning failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsPlanningContext(false);
      setAiStatusText('Idle');
    }
  };

  const runAiGen = async () => {
    if (!aiPrompt) return;
    if (aiModel === 'mistral' && mistralPipelineMode === 'search-plan') {
      if (pipelineStep === 'plan') {
        appendAiEvent('Plan the Mistral retrieval step before generation');
        return;
      }
      if (!approvedBlockIds.length) {
        appendAiEvent('Approve at least one context block before generation');
        return;
      }
    }

    setIsGenerating(true);
    setPipelineStep('generate');
    setAiStatusText(`Starting ${aiModel} synthesis`);
    appendAiEvent(`Start ${aiModel} · mode ${genMode}`);
    try {
      const currentStructure = JSON.stringify(blocksToJson(root));
      const selectedNames = selectedContextBlocks.map((block) => block.name || block.id);
      setLastSentBlockNames(selectedNames);
      appendAiEvent(`Context blocks sent: ${selectedNames.join(', ') || 'none'}`);

      const mergedRules = includeMmssMeta
        ? [assemblyRules, ...DEFAULT_MMSS_META_RULES, ...mistralPlan.metaDirectives].filter(Boolean).join('\n')
        : assemblyRules;

      const options = {
        mode: genMode,
        rules: mergedRules,
        libraryContext: relevantLibraryContext,
        onProgress: (message: string) => {
          setAiStatusText(message);
          appendAiEvent(message);
        },
      };

      const result =
        aiModel === 'gemini'
          ? await generateWithGemini(aiPrompt, currentStructure, options)
          : await generateWithMistral(aiPrompt, currentStructure, options);

      setRoot(jsonToBlocks(result));
      setAiStatusText('Completed');
      appendAiEvent('Canvas updated from AI output');
    } catch (error) {
      console.error(error);
      setAiStatusText('Failed');
      appendAiEvent(`Error: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const runApprovedContextGen = async () => {
    if (aiModel !== 'mistral') {
      appendAiEvent('Approved-context generation is available only for Mistral');
      return;
    }
    if (mistralPipelineMode !== 'search-plan') {
      appendAiEvent('Switch Mistral pipeline mode to search-plan to use approved-context generation');
      return;
    }
    if (!approvedBlockIds.length) {
      appendAiEvent('Approve at least one context block before approved-context generation');
      return;
    }
    await runAiGen();
  };

  const mmssRelevantPreview = useMemo(() => relevantLibraryContext.slice(0, 2200), [relevantLibraryContext]);

  return (
    <div className="flex flex-col h-screen bg-bg-deep overflow-hidden selection:bg-orange-500/30">
      <header className="h-14 border-b border-white/[0.03] flex items-center justify-between px-6 bg-bg-panel shrink-0 z-50 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 bg-orange-600 rounded-lg flex items-center justify-center font-black text-bg-deep text-lg">G</div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white uppercase">JSON <span className="text-orange-500 italic font-light">Genesis v4.2</span></h1>
            <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-tighter">Unified Structural Interface</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="px-4 py-1.5 rounded bg-zinc-800 text-white text-[10px] font-bold hover:bg-zinc-700 transition-all tracking-widest cursor-pointer uppercase border border-white/5 flex items-center gap-2">
            <Upload size={12} className="text-orange-500" />
            Import
            <input type="file" className="hidden" onChange={handleImport} accept=".json" />
          </label>
          <button onClick={() => setImportToLib((prev) => !prev)} className="px-4 py-1.5 rounded bg-zinc-900/70 text-zinc-300 text-[10px] font-bold uppercase border border-white/5 flex items-center gap-2">
            <Box size={12} />
            {importToLib ? 'Import to Library' : 'Import to Root'}
          </button>
          <button onClick={() => void requestMmssLibrary()} className="px-4 py-1.5 rounded bg-cyan-950/30 text-cyan-300 text-[10px] font-bold uppercase border border-cyan-500/20 flex items-center gap-2">
            <Layers size={12} />
            Sync MMSS
          </button>
          <button onClick={() => void pullGenesisHandoff()} className="px-4 py-1.5 rounded bg-indigo-950/30 text-indigo-300 text-[10px] font-bold uppercase border border-indigo-500/20 flex items-center gap-2">
            <Download size={12} />
            Pull Handoff
          </button>
          <button onClick={() => void saveRootToMmssLibrary()} className="px-4 py-1.5 rounded bg-emerald-950/30 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/20 flex items-center gap-2">
            <Save size={12} />
            Save to MMSS
          </button>
          <button onClick={handleExport} className="px-6 py-2 rounded-lg bg-orange-600 text-[10px] font-black text-bg-deep uppercase">
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-80 border-r border-white/[0.03] bg-bg-panel flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <BlockPalette
              onAddRoot={(type) => setRoot(createDefaultBlock(type, 'root'))}
              customBlocks={libraryBlocks}
              onAddCustomBlock={addLibraryItemToRoot}
              onPreviewCustomBlock={(block) => setSelectedLibraryBlockId(block.sourcePromptBlockId || block.id)}
              activePreviewBlockId={selectedLibraryBlockId}
            />
          </div>
        </aside>

        <main className="flex-1 bg-bg-deep flex flex-col min-w-0 p-8 relative">
          <div className="mb-8 flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileCode size={14} className="text-orange-500" />
                <h3 className="text-zinc-500 text-[10px] font-mono tracking-[0.2em] uppercase">Composition Pipeline</h3>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white/90">
                Assembly: <span className="text-orange-500 italic lowercase font-light ml-1">{projectName}</span>
              </h2>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">MMSS Base</p>
              <p className="text-sm font-mono text-cyan-300 italic">{mmssLibrarySummary}</p>
            </div>
          </div>

          <div className="flex-1 border border-white/[0.05] bg-bg-base/95 rounded-2xl relative overflow-hidden flex flex-col shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
            <div className="absolute inset-0 opacity-20 pointer-events-none grid-bg" />
            <div className="flex-1 overflow-y-auto custom-scrollbar p-12 relative z-10">
              <BlockNode block={root} onUpdate={updateBlock} onDelete={deleteBlock} onAddChild={addChild} tagColorMap={{}} />
            </div>

            <div className="h-auto border-t border-white/[0.05] bg-bg-panel flex flex-col p-6 gap-5 shrink-0 z-20">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex bg-black/60 rounded-xl p-1 border border-white/5 shadow-inner">
                  {(['augment', 'rewrite', 'skeleton'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setGenMode(mode)}
                      className={cn(
                        'px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all duration-300',
                        genMode === mode ? 'bg-orange-600 text-bg-deep shadow-lg' : 'text-zinc-600 hover:text-zinc-300',
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                <div className="flex-grow flex bg-black/40 border border-white/5 rounded-xl px-4 py-3 items-center gap-4 shadow-inner">
                  <Terminal size={14} className="text-zinc-600" />
                  <input
                    value={assemblyRules}
                    onChange={(event) => setAssemblyRules(event.target.value)}
                    placeholder="Assembly constraints"
                    className="bg-transparent border-none text-xs flex-grow focus:outline-none placeholder:text-zinc-800 text-zinc-300 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-grow flex bg-black/40 border border-white/5 rounded-xl px-4 py-3 items-center gap-4 shadow-inner">
                  <Box size={14} className="text-zinc-600" />
                  <input
                    value={aiPrompt}
                    onChange={(event) => setAiPrompt(event.target.value)}
                    placeholder="Enter synthesis prompt for structure generation..."
                    className="bg-transparent border-none text-xs flex-grow focus:outline-none placeholder:text-zinc-800 text-zinc-300 font-medium"
                  />
                </div>
                <button onClick={() => void runAiGen()} disabled={isGenerating || !aiPrompt} className="px-10 h-12 bg-white text-bg-deep rounded-xl font-black text-[11px] tracking-widest disabled:opacity-20 shrink-0 uppercase flex items-center gap-3 shadow-xl">
                  {isGenerating ? <Activity size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isGenerating ? 'Synthesizing...' : 'Execute Synth'}
                </button>
              </div>

              <div className="border border-white/5 rounded-xl bg-black/30 p-4">
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">AI Activity</div>
                  <div className="text-[11px] font-mono text-orange-400">{aiModel.toUpperCase()} · {aiStatusText}</div>
                </div>
                <div className="max-h-28 overflow-y-auto custom-scrollbar space-y-2">
                  {aiEventLog.length ? aiEventLog.map((entry, index) => (
                    <div key={`${entry}-${index}`} className="text-[11px] text-zinc-400 font-mono">{entry}</div>
                  )) : <div className="text-[11px] text-zinc-600 font-mono">No AI events yet.</div>}
                </div>
              </div>
            </div>
          </div>
        </main>

        <aside className="w-[34rem] border-l border-white/[0.03] bg-bg-panel flex flex-col shrink-0">
          <div className="p-6 border-b border-white/[0.03]">
            <div className="flex items-center gap-3">
              <Sparkles size={14} className="text-orange-500" />
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">AI Engines</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { id: 'gemini', label: 'Gemini 3-Flash', desc: 'Fast multimodal reasoning' },
                { id: 'mistral', label: 'Mistral Large 2', desc: 'Precision structural output' },
              ].map((model) => (
                <button
                  key={model.id}
                  onClick={() => setAiModel(model.id as 'gemini' | 'mistral')}
                  className={cn(
                    'w-full flex flex-col p-4 rounded-xl border transition-all text-left',
                    aiModel === model.id ? 'bg-zinc-800/50 border-orange-500/30 shadow-lg' : 'bg-black/20 border-white/5 opacity-70',
                  )}
                >
                  <span className="text-[11px] font-black tracking-tight uppercase text-white/80">{model.label}</span>
                  <p className="text-[10px] text-zinc-500 font-mono tracking-tight">{model.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-5">
            <section className="border border-white/5 rounded-xl bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Mistral Multi-Step Pipeline</p>
                <div className="flex gap-2">
                  {(['plan', 'preview', 'approve', 'generate'] as PipelineStep[]).map((step) => (
                    <div
                      key={step}
                      className={cn(
                        'px-2 py-1 rounded text-[9px] font-black uppercase border',
                        pipelineStep === step ? 'border-orange-500/30 text-orange-300 bg-orange-500/10' : 'border-white/5 text-zinc-600',
                      )}
                    >
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex bg-black/50 rounded-lg p-1 border border-white/5 mb-3">
                {(['direct', 'search-plan'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setMistralPipelineMode(mode)}
                    className={cn(
                      'px-3 py-1 rounded text-[9px] font-black uppercase',
                      mistralPipelineMode === mode ? 'bg-orange-600 text-bg-deep' : 'text-zinc-500',
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-3 mb-4 px-3 py-2 rounded-lg border border-white/5 bg-black/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMmssMeta}
                  onChange={(event) => setIncludeMmssMeta(event.target.checked)}
                />
                <div>
                  <div className="text-[10px] font-black uppercase text-zinc-300">Include MMSS Meta Rules</div>
                  <div className="text-[10px] text-zinc-500">Include MMSS metrics, meta-formulas, and MMSS JSON construction rules in the payload.</div>
                </div>
              </label>

              <div className="flex items-center gap-3 mb-3 bg-black/40 border border-white/5 rounded-xl px-3 py-2">
                <Search size={12} className="text-zinc-600" />
                <input
                  value={librarySearchQuery}
                  onChange={(event) => setLibrarySearchQuery(event.target.value)}
                  placeholder="Manual search override for MMSS blocks"
                  className="bg-transparent border-none text-xs flex-grow focus:outline-none placeholder:text-zinc-700 text-zinc-300"
                />
              </div>

              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => void handlePlanMistralContext()}
                  disabled={isPlanningContext || !aiPrompt.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-950/40 text-cyan-300 text-[10px] font-black uppercase border border-cyan-500/20 disabled:opacity-40"
                >
                  {isPlanningContext ? 'Planning...' : '1. Plan Queries'}
                </button>
                <button
                  onClick={approveSuggestedContext}
                  disabled={!candidateBlocks.length}
                  className="px-4 py-2 rounded-lg bg-emerald-950/40 text-emerald-300 text-[10px] font-black uppercase border border-emerald-500/20 disabled:opacity-40"
                >
                  2. Approve Suggested
                </button>
                <button
                  onClick={resetPipeline}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-300 text-[10px] font-black uppercase border border-white/5"
                >
                  Reset
                </button>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => void saveMistralPresetToBridge()}
                  disabled={isSavingPreset}
                  className="px-4 py-2 rounded-lg bg-indigo-950/40 text-indigo-300 text-[10px] font-black uppercase border border-indigo-500/20 disabled:opacity-40"
                >
                  {isSavingPreset ? 'Saving Preset...' : 'Save Preset to Bridge'}
                </button>
                <button
                  onClick={() => void loadMistralPresetFromBridge()}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-zinc-300 text-[10px] font-black uppercase border border-white/5"
                >
                  Load Preset from Bridge
                </button>
                <div className="text-[10px] font-mono text-zinc-600">
                  {lastPresetSyncAt ? `bridge: ${new Date(lastPresetSyncAt).toLocaleTimeString()}` : 'bridge: not synced'}
                </div>
              </div>

              <div className="flex items-center gap-3 mb-3">
                <label className="text-[10px] font-mono text-zinc-500">Auto picks: {rankedLimit}</label>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={rankedLimit}
                  onChange={(event) => setRankedLimit(Number(event.target.value))}
                  className="flex-1"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <InfoList title="Mistral Queries" items={mistralPlan.queries} empty="No retrieval queries yet." />
                <InfoList title="Desired Block Roles" items={mistralPlan.blockRoles} empty="No block roles yet." />
                <InfoList title="MMSS Principles" items={mistralPlan.principles} empty="No extracted principles yet." />
                <InfoList title="Meta Directives" items={mistralPlan.metaDirectives} empty="No meta directives yet." />
                <InfoList title="Blocks Sent to Mistral" items={lastSentBlockNames} empty="No context blocks sent yet." />
              </div>
            </section>

            <section className="border border-white/5 rounded-xl bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Candidate Blocks</p>
                <p className="text-[10px] font-mono text-zinc-600">{candidateBlocks.length} candidates</p>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {candidateBlocks.length ? candidateBlocks.map((entry) => {
                  const isPinned = manualPinnedBlockIds.includes(entry.block.id);
                  const isApproved = approvedBlockIds.includes(entry.block.id);
                  return (
                    <div
                      key={entry.block.id}
                      className={cn(
                        'border rounded-lg p-3 transition-all',
                        isApproved ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/5 bg-black/20',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button onClick={() => setSelectedLibraryBlockId(entry.block.id)} className="text-left min-w-0">
                          <div className="text-[11px] font-black text-white/80 truncate">{entry.block.name || entry.block.id}</div>
                          <div className="text-[10px] text-zinc-500 line-clamp-2">{entry.block.description || 'No description'}</div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] font-mono text-cyan-300">{entry.score}</span>
                          <button
                            onClick={() => togglePinnedBlock(entry.block.id)}
                            className={cn('p-1 rounded border', isPinned ? 'border-orange-500/30 text-orange-300' : 'border-white/10 text-zinc-500')}
                          >
                            <Pin size={12} />
                          </button>
                          <button
                            onClick={() => toggleApprovedBlock(entry.block.id)}
                            className={cn('p-1 rounded border', isApproved ? 'border-emerald-500/30 text-emerald-300' : 'border-white/10 text-zinc-500')}
                          >
                            <Check size={12} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 text-[9px] text-zinc-600 font-mono break-words">{entry.reasons.join(' · ') || 'manual only'}</div>
                      {!!entry.roleMatches.length && <div className="mt-1 text-[9px] text-indigo-300 font-mono">roles: {entry.roleMatches.join(', ')}</div>}
                    </div>
                  );
                }) : (
                  <div className="text-[11px] text-zinc-600 font-mono">No candidate blocks yet. Run the planning step first.</div>
                )}
              </div>
            </section>

            <section className="border border-white/5 rounded-xl bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Approved Context Payload</p>
                <p className="text-[10px] font-mono text-zinc-600">{selectedContextBlocks.length} block(s)</p>
              </div>
              <pre className="bg-black/30 p-4 rounded-xl border border-white/5 text-[10px] text-zinc-400 whitespace-pre-wrap overflow-hidden max-h-72 overflow-y-auto custom-scrollbar">
                {mmssRelevantPreview}
              </pre>
            </section>

            <section className="border border-white/5 rounded-xl bg-black/20 p-4">
              <div className="flex items-center justify-between gap-4 mb-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Library Block Inspector</p>
                <p className="text-[10px] font-mono text-zinc-600">{selectedLibraryBlock?.name || 'No block selected'}</p>
              </div>
              <div className="text-[10px] text-zinc-500 mb-3">
                Click any library block on the left or any candidate block here to inspect its full payload without reloading the page.
              </div>
              <pre className="bg-black/30 p-4 rounded-xl border border-white/5 text-[10px] text-zinc-400 whitespace-pre-wrap overflow-auto max-h-[28rem]">
                {selectedLibraryJson}
              </pre>
            </section>
          </div>

          <div className="p-6 border-t border-white/[0.03] space-y-3">
            <button
              onClick={() => void runApprovedContextGen()}
              disabled={isGenerating || !aiPrompt || !approvedBlockIds.length || aiModel !== 'mistral' || mistralPipelineMode !== 'search-plan'}
              className="w-full py-4 bg-emerald-500 text-bg-deep text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-xl disabled:opacity-30"
            >
              Generate with Approved Context
            </button>
            <button onClick={saveToLocal} className="w-full py-4 bg-white text-bg-deep text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-xl">
              Commit to Storage
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};

function dedupeById(blocks: MmssPromptBlock[]) {
  const map = new Map<string, MmssPromptBlock>();
  blocks.forEach((block) => map.set(block.id, block));
  return Array.from(map.values());
}

function collectKeys(value: unknown, prefix = '', seen = new Set<string>()): string[] {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, `${prefix}[${index}]`, seen));
  }

  const keys: string[] = [];
  Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!seen.has(path)) {
      seen.add(path);
      keys.push(path.toLowerCase());
    }
    keys.push(...collectKeys(child, path, seen));
  });
  return keys;
}

function getJsonDepth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map((item) => getJsonDepth(item)));
  }
  return 1 + Math.max(0, ...Object.values(value as Record<string, unknown>).map((item) => getJsonDepth(item)));
}

function containsMmssMeta(value: unknown): boolean {
  const text = JSON.stringify(value ?? {}).toLowerCase();
  return ['v', 'n', 's', 'd_f', 'g_s', 'r_t', 'formula', 'operator', 'metric'].some((token) => text.includes(`"${token}`) || text.includes(token));
}

const InfoList: React.FC<{ title: string; items: string[]; empty: string }> = ({ title, items, empty }) => (
  <div className="border border-white/5 rounded-lg p-3 bg-black/20">
    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">{title}</div>
    {items.length ? (
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={`${title}-${index}-${item}`} className="text-[10px] text-zinc-300 font-mono break-words">
            {item}
          </div>
        ))}
      </div>
    ) : (
      <div className="text-[10px] text-zinc-600 font-mono">{empty}</div>
    )}
  </div>
);
