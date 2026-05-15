import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Box,
  Download,
  FileCode,
  Layers,
  Save,
  Sparkles,
  Terminal,
  Upload,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { generateWithGemini, generateWithMistral } from '../services/aiService';
import { cn } from '../lib/utils';
import { JSONBlock, JSONType, blocksToJson, chunkJSON, createDefaultBlock, jsonToBlocks } from '../types';
import { BlockNode } from './BlockNode';
import { BlockPalette } from './BlockPalette';

const MMSS_BRIDGE_API_BASE = 'http://localhost:3456/api/mmss';

type MmssPromptBlock = {
  id: string;
  name?: string;
  description?: string;
  tags?: string[];
  payload?: { data?: any };
};

export const MainEditor: React.FC = () => {
  const [root, setRoot] = useState<JSONBlock>(createDefaultBlock('object', 'root'));
  const [projectName, setProjectName] = useState('Industrial_Sublime_v4');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiModel, setAiModel] = useState<'gemini' | 'mistral'>('gemini');
  const [genMode, setGenMode] = useState<'augment' | 'rewrite' | 'skeleton'>('augment');
  const [assemblyRules, setAssemblyRules] = useState('');
  const [aiEventLog, setAiEventLog] = useState<string[]>([]);
  const [aiStatusText, setAiStatusText] = useState('Idle');
  const [libraryBlocks, setLibraryBlocks] = useState<JSONBlock[]>([]);
  const [importToLib, setImportToLib] = useState(true);
  const [mmssLibrarySummary, setMmssLibrarySummary] = useState('Not synced');
  const [mmssPromptBlocks, setMmssPromptBlocks] = useState<MmssPromptBlock[]>([]);
  const [lastLibrarySyncAt, setLastLibrarySyncAt] = useState<string | null>(null);
  const [lastGenesisHandoffAt, setLastGenesisHandoffAt] = useState<string | null>(null);

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
    void requestMmssLibrary();
    void pullGenesisHandoff();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void requestMmssLibrary(true);
      void pullGenesisHandoff(true);
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastLibrarySyncAt, lastGenesisHandoffAt]);

  const appendAiEvent = (message: string) => {
    setAiEventLog((prev) => [`${new Date().toLocaleTimeString()}: ${message}`, ...prev].slice(0, 12));
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
        return genesisBlock;
      });

      setMmssPromptBlocks(promptBlocks);
      setLibraryBlocks(importedBlocks);
      setMmssLibrarySummary(`${promptBlocks.length} blocks · ${promptLibrary?.sequences?.length || 0} sequences`);
      setLastLibrarySyncAt(payload?.updatedAt || null);
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

  const relevantLibraryContext = useMemo(() => {
    const tokens = String(aiPrompt || '')
      .toLowerCase()
      .split(/[^a-zа-я0-9_]+/i)
      .filter((token) => token.length >= 3);

    const scored = mmssPromptBlocks
      .map((block) => {
        const haystack = [
          block.name || '',
          block.description || '',
          ...(Array.isArray(block.tags) ? block.tags : []),
          JSON.stringify(block.payload?.data ?? {}).slice(0, 800),
        ]
          .join(' ')
          .toLowerCase();

        const score = tokens.reduce((sum, token) => sum + (haystack.includes(token) ? 1 : 0), 0);
        return { block, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 6)
      .map(({ block }) => ({
        name: block.name,
        description: block.description,
        tags: block.tags || [],
        payload: block.payload?.data ?? {},
      }));

    if (!scored.length) {
      return `MMSS library summary: ${mmssLibrarySummary}`;
    }

    return JSON.stringify(
      {
        summary: mmssLibrarySummary,
        relevantBlocks: scored,
      },
      null,
      2,
    );
  }, [aiPrompt, mmssLibrarySummary, mmssPromptBlocks]);

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

  const runAiGen = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    setAiStatusText(`Starting ${aiModel} synthesis`);
    appendAiEvent(`Start ${aiModel} · mode ${genMode}`);
    try {
      const currentStructure = JSON.stringify(blocksToJson(root));
      const options = {
        mode: genMode,
        rules: assemblyRules,
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

  const mmssRelevantPreview = useMemo(() => relevantLibraryContext.slice(0, 800), [relevantLibraryContext]);

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
          <button onClick={requestMmssLibrary} className="px-4 py-1.5 rounded bg-cyan-950/30 text-cyan-300 text-[10px] font-bold uppercase border border-cyan-500/20 flex items-center gap-2">
            <Layers size={12} />
            Sync MMSS
          </button>
          <button onClick={pullGenesisHandoff} className="px-4 py-1.5 rounded bg-indigo-950/30 text-indigo-300 text-[10px] font-bold uppercase border border-indigo-500/20 flex items-center gap-2">
            <Download size={12} />
            Pull Handoff
          </button>
          <button onClick={saveRootToMmssLibrary} className="px-4 py-1.5 rounded bg-emerald-950/30 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/20 flex items-center gap-2">
            <Save size={12} />
            Save to MMSS
          </button>
          <button onClick={handleExport} className="px-6 py-2 rounded-lg bg-orange-600 text-[10px] font-black text-bg-deep uppercase">
            Export JSON
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-white/[0.03] bg-bg-panel flex flex-col shrink-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
            <BlockPalette onAddRoot={(type) => setRoot(createDefaultBlock(type, 'root'))} customBlocks={libraryBlocks} onAddCustomBlock={addLibraryItemToRoot} />
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
                <button onClick={runAiGen} disabled={isGenerating || !aiPrompt} className="px-10 h-12 bg-white text-bg-deep rounded-xl font-black text-[11px] tracking-widest disabled:opacity-20 shrink-0 uppercase flex items-center gap-3 shadow-xl">
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

        <aside className="w-80 border-l border-white/[0.03] bg-bg-panel flex flex-col shrink-0">
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

          <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
            <div className="mb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Relevant MMSS Context</p>
              <pre className="mt-3 bg-black/30 p-4 rounded-xl border border-white/5 text-[10px] text-zinc-400 whitespace-pre-wrap overflow-hidden">
                {mmssRelevantPreview}
              </pre>
            </div>
          </div>

          <div className="p-6 border-t border-white/[0.03]">
            <button onClick={saveToLocal} className="w-full py-4 bg-white text-bg-deep text-[10px] font-black rounded-xl uppercase tracking-[0.2em] shadow-xl">
              Commit to Storage
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
