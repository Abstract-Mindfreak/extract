import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  Archive,
  Boxes,
  ChevronRight,
  Database,
  LayoutTemplate,
  Library,
  Settings,
  Sparkles,
  Workflow,
  X,
  Magnet,
  FileJson,
} from "lucide-react";
import "./App.css";
import ASEMasterConsole from "./components/ASEMasterConsole";
import JsonBindingsPanel from "./components/JsonBindingsPanel";
import JsonBlockEditor from "./components/JsonBlockEditor";
import JsonBlockList from "./components/JsonBlockList";
import JsonSequenceBuilder from "./components/JsonSequenceBuilder";
import PromptLogicBlocklyPanel from "./components/PromptLogicBlocklyPanel";
import SectionCard from "./components/SectionCard";
import { MMSSWidget } from "./components/MMSSWidget";
import { createInitialState } from "./mmss/config";
import {
  DEFAULT_BLOCKLY_WORKSPACE_XML,
  combinePromptBlocks,
  createEntityId,
  parsePromptImportText,
  exportPromptLibraryFile,
  loadPromptLibraryState,
  savePromptLibraryState,
} from "./mmss/promptLibrary";
import { mmssReducer } from "./mmss/reducer";
import { DEFAULT_BLOCKLY_CONTEXT } from "./mmss/promptTypes";
import { getThemePalette } from "./mmss/utils";
import ArchivesPage from "./components/ArchivesPage";
import storageService from "./services/StorageService";

const APP_TABS = [
  {
    id: "prompt_library",
    label: "Prompt Library",
    summary: "Blocks, sequences, bindings",
  },
  {
    id: "ase_console",
    label: "ASE Console",
    summary: "Unified MMSS and ASE rack",
  },
  {
    id: "archives",
    label: "Archives",
    summary: "Archive import and browsing",
  },
  {
    id: "magnetic",
    label: "Magnetic Builder",
    summary: "MMSS magnetic field simulation",
  },
  {
    id: "json_genesis",
    label: "JSON Genesis",
    summary: "AI-powered JSON structure editor",
  },
];

const HERO_METRICS = [
  { id: "active_mode", label: "Active mode" },
  { id: "prompt_blocks", label: "Prompt blocks" },
  { id: "sequences", label: "Sequences" },
  { id: "library_status", label: "Library status" },
];

const PROMPT_PANEL_ORDER_STORAGE_KEY = "mmss.promptPanelOrder.v1";
const PROMPT_ACTIVE_PANEL_STORAGE_KEY = "mmss.promptActivePanel.v1";
const ASE_DB_STORAGE_KEY = "mmss.ase.database.v1";
const PROMPT_PANEL_DEFAULT_ORDER = [
  "json_block_list",
  "prompt_logic_blockly",
  "json_block_editor",
  "json_sequence_builder",
  "json_bindings_panel",
];
const SERVICE_POLL_INTERVAL_MS = 15000;
const MMSS_BRIDGE_API_BASE = "http://localhost:3456/api/mmss";
const PROMPT_LIBRARY_PANEL_META = {
  json_block_list: {
    label: "Block Library",
    subtitle: "Searchable block catalog with filters, tags, and quick actions",
  },
  prompt_logic_blockly: {
    label: "Blockly",
    subtitle: "Visual DSL for selecting blocks/sequences and merge strategy",
  },
  json_block_editor: {
    label: "Block Editor",
    subtitle: "Metadata form plus validated JSON editor with save, format, and export",
  },
  json_sequence_builder: {
    label: "Sequences",
    subtitle: "Assemble active compositions, preview merge output, and save sequences",
  },
  json_bindings_panel: {
    label: "Bindings",
    subtitle: "4 x 4 trigger matrix for block and sequence bindings with import/export tools",
  },
};

function App() {
  const sectionRefs = useRef({
    prompt_library: null,
    ase_console: null,
    archives: null,
    magnetic: null,
    json_genesis: null,
  });
  const [expandedPanel, setExpandedPanel] = useState(null);
  const [activeTab, setActiveTab] = useState("ase_console");
  const [state, dispatch] = useReducer(
    mmssReducer,
    undefined,
    () => createInitialState({ __empty: true })
  );
  const [libraryReady, setLibraryReady] = useState(false);
  const [promptPanelOrder, setPromptPanelOrder] = useState(loadStoredPromptPanelOrder);
  const [activePromptPanel, setActivePromptPanel] = useState(loadStoredPromptActivePanel);
  const [serviceHealth, setServiceHealth] = useState({
    magnetic: { online: false, label: "Offline", detail: "http://localhost:8001/state" },
    mistral: { online: false, label: "Offline", detail: "http://localhost:3456/api/mistral/status" },
    jsonhero: { online: false, label: "Offline", detail: "http://localhost:8787" },
  });

  // Bridge object intentionally captures current render state.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!libraryReady) return;
    savePromptLibraryState(state.promptLibrary);
  }, [state.promptLibrary, libraryReady]);

  useEffect(() => {
    window.localStorage.setItem(PROMPT_PANEL_ORDER_STORAGE_KEY, JSON.stringify(promptPanelOrder));
  }, [promptPanelOrder]);

  useEffect(() => {
    window.localStorage.setItem(PROMPT_ACTIVE_PANEL_STORAGE_KEY, activePromptPanel);
  }, [activePromptPanel]);

  useEffect(() => {
    if (!libraryReady) {
      handleLoadLibrary();
    }
  }, [libraryReady]);

  useEffect(() => {
    if (activeTab !== "prompt_library") return;
    if (state.transport.playing) {
      dispatch({ type: "toggle_playing" });
    }
    if (state.orbit.enabled) {
      dispatch({ type: "toggle_orbit", enabled: false });
    }
  }, [activeTab, state.transport.playing, state.orbit.enabled]);

  useEffect(() => {
    let cancelled = false;

    const updateServiceHealth = async () => {
      const [magnetic, mistral, jsonhero] = await Promise.all([
        probeJsonEndpoint("http://localhost:8001/state", (payload) => ({
          online: true,
          label: `Online · day ${payload?.day ?? "?"}`,
          detail: payload?.phase ? `phase: ${payload.phase}` : "http://localhost:8001/state",
        })),
        probeJsonEndpoint("http://localhost:3456/api/mistral/status", (payload) => ({
          online: !!payload?.configured,
          label: payload?.configured ? "Online · env key" : "Offline",
          detail: payload?.defaultModel || "http://localhost:3456/api/mistral/status",
        })),
        probeTextEndpoint("http://localhost:8787", () => ({
          online: true,
          label: "Online",
          detail: "http://localhost:8787",
        })),
      ]);

      if (!cancelled) {
        setServiceHealth({
          magnetic,
          mistral,
          jsonhero,
        });
      }
    };

    void updateServiceHealth();
    const intervalId = window.setInterval(() => {
      void updateServiceHealth();
    }, SERVICE_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!libraryReady) {
      return;
    }

    void fetch(`${MMSS_BRIDGE_API_BASE}/library-state`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        promptLibrary: state.promptLibrary,
      }),
    }).catch(() => {
      // Ignore bridge sync errors in UI loop; status panel already reflects backend availability.
    });
  }, [libraryReady, state.promptLibrary]);

  useEffect(() => {
    let cancelled = false;

    const pollImportQueue = async () => {
      try {
        const response = await fetch(`${MMSS_BRIDGE_API_BASE}/import-queue`);
        if (!response.ok) {
          return;
        }

        const payload = await response.json();
        const items = Array.isArray(payload?.items) ? payload.items : [];
        if (!items.length || cancelled) {
          return;
        }

        if (!libraryReady) {
          handleLoadLibrary();
        }

        const ackIds = [];
        for (const item of items) {
          const jsonText = JSON.stringify(item.json ?? {}, null, 2);
          const parsedImport = parsePromptImportText(jsonText);

          if (parsedImport.mode === "library" && parsedImport.library) {
            dispatch({
              type: "PROMPT_IMPORT_LIBRARY",
              payload: parsedImport.library,
            });
          } else if (parsedImport.blocks.length) {
            dispatch({ type: "PROMPT_IMPORT_BLOCKS", blocks: parsedImport.blocks });
          }

          ackIds.push(item.id);
        }

        if (ackIds.length) {
          await fetch(`${MMSS_BRIDGE_API_BASE}/import-queue/ack`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ids: ackIds }),
          });
        }
      } catch (_error) {
        // noop
      }
    };

    void pollImportQueue();
    const intervalId = window.setInterval(() => {
      void pollImportQueue();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [libraryReady]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.__MMSS_BRIDGE__ = {
      ping() {
        return {
          ok: true,
          app: "MMSS React",
          libraryReady,
          blocks: state.promptLibrary.blocks.length,
          sequences: state.promptLibrary.sequences.length,
        };
      },
      async ensureLibraryReady() {
        handleLoadLibrary();
        return {
          ok: true,
          libraryReady: true,
          blocks: state.promptLibrary.blocks.length,
        };
      },
      async addBlocksFromInput({ text } = {}) {
        if (!libraryReady) {
          handleLoadLibrary();
        }
        const sourceText = String(text || "");
        const parsedImport = parsePromptImportText(sourceText);
        if (parsedImport.mode === "library" && parsedImport.library) {
          dispatch({
            type: "PROMPT_IMPORT_LIBRARY",
            payload: parsedImport.library,
          });
          return {
            ok: true,
            mode: "library",
            imported: parsedImport.library?.blocks?.length || 0,
          };
        }

        if (parsedImport.mode === "blocks" && parsedImport.blocks.length) {
          dispatch({ type: "PROMPT_IMPORT_BLOCKS", blocks: parsedImport.blocks });
          return {
            ok: true,
            mode: "blocks",
            imported: parsedImport.blocks.length,
          };
        }

        return {
          ok: false,
          mode: "none",
          imported: 0,
          message: "No valid JSON blocks found",
        };
      },
      async importNormalizedSessionAssets() {
        return handleImportNormalizedPromptAssets();
      },
      async generateBatch(request = {}) {
        if (!libraryReady) {
          handleLoadLibrary();
        }
        const scopedBlocks = filterBlocksByPreset(
          state.promptLibrary.blocks,
          request.tagPreset || "all"
        );
        if (!scopedBlocks.length) {
          return {
            ok: false,
            message: "No blocks available in selected preset",
            results: [],
          };
        }

        const formula =
          request.formula ||
          `${Math.max(1, Number(request.files) || 1)}x${Math.max(1, Number(request.items) || 12)} ${
            request.mode || "random"
          }`;
        const batch = parseBatchFormula(formula, request.mode || "random");
        const results = [];
        const stamp = Date.now();

        for (let fileIndex = 0; fileIndex < batch.files; fileIndex += 1) {
          const blockIds = generateCompositionByMode(scopedBlocks, batch.mode, batch.items);
          const payload = combinePromptBlocks(
            blockIds,
            scopedBlocks,
            state.promptLibrary.activeComposition?.mergeStrategy || "merge_deep"
          );

          results.push({
            id: `batch_${stamp}_${fileIndex + 1}`,
            title: `Batch ${fileIndex + 1}/${batch.files}`,
            text: JSON.stringify(payload, null, 2),
            blockIds,
            mode: batch.mode,
            tagPreset: request.tagPreset || "all",
            used: false,
          });
        }

        return {
          ok: true,
          batch: {
            files: batch.files,
            items: batch.items,
            mode: batch.mode,
            tagPreset: request.tagPreset || "all",
          },
          results,
        };
      },
    };

    return () => {
      if (window.__MMSS_BRIDGE__) {
        delete window.__MMSS_BRIDGE__;
      }
    };
  }, [libraryReady, state.promptLibrary.blocks, state.promptLibrary.sequences]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const palette = getThemePalette(state.vision.theme);
  const themeStyle = {
    "--accent-primary": palette.primary,
    "--accent-secondary": palette.accent,
    "--panel-fill-a": palette.fillA,
    "--panel-fill-b": palette.fillB,
    "--panel-noise": palette.noise,
  };
  const selectedBlock =
    state.promptLibrary.blocks.find((block) => block.id === state.promptLibrary.selectedBlockId) || null;
  const activePromptPanelMeta =
    PROMPT_LIBRARY_PANEL_META[activePromptPanel] || PROMPT_LIBRARY_PANEL_META.json_block_list;
  const aseConfigCount = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(ASE_DB_STORAGE_KEY) || "[]").length;
    } catch {
      return 0;
    }
  }, []);
  const promptPanelIndex = useMemo(
    () =>
      promptPanelOrder.reduce((map, panelId, index) => {
        map[panelId] = index;
        return map;
      }, {}),
    [promptPanelOrder]
  );

  function launchCore() {
    if (!state.initialized) {
      dispatch({ type: "initialize" });
      dispatch({ type: "capture_baseline", reason: "launch_sequence" });
    }
  }

  function handlePromptBlockSave(block) {
    const actionType = state.promptLibrary.blocks.some((entry) => entry.id === block.id)
      ? "PROMPT_BLOCK_UPDATE"
      : "PROMPT_BLOCK_CREATE";
    dispatch({ type: actionType, block });
  }

  function handlePrepareBind(bindingMode, targetId) {
    setActiveTab("prompt_library");
    dispatch({ type: "PROMPT_SET_BINDING_MODE", bindingMode });
    dispatch({
      type: bindingMode === "block" ? "PROMPT_SELECT_BLOCK" : "PROMPT_SELECT_SEQUENCE",
      ...(bindingMode === "block" ? { blockId: targetId } : { sequenceId: targetId }),
    });
  }

  function handleLoadLibrary() {
    if (libraryReady) return;
    const restored = loadPromptLibraryState();
    dispatch({
      type: "PROMPT_IMPORT_LIBRARY",
      payload: restored || {},
    });
    setLibraryReady(true);
    dispatch({ type: "append_log", message: "Prompt library mode enabled." });
  }

  async function handleImportLibrary(filesInput) {
    const files = Array.isArray(filesInput)
      ? filesInput
      : filesInput
        ? [filesInput]
        : [];
    if (!files.length) return;
    if (!libraryReady) handleLoadLibrary();

    let importedCount = 0;
    for (const file of files) {
      try {
        const sourceText = await file.text();
        const parsedImport = parsePromptImportText(sourceText);
        if (parsedImport.mode === "library" && parsedImport.library) {
          dispatch({
            type: "PROMPT_IMPORT_LIBRARY",
            payload: parsedImport.library,
          });
          importedCount += parsedImport.library?.blocks?.length || 0;
          continue;
        }

        if (parsedImport.mode === "blocks" && parsedImport.blocks.length) {
          dispatch({ type: "PROMPT_IMPORT_BLOCKS", blocks: parsedImport.blocks });
          importedCount += parsedImport.blocks.length;
          continue;
        }
      } catch (error) {
        dispatch({
          type: "append_log",
          message: `Prompt library import failed (${file.name}): ${error.message}`,
        });
      }
    }

    dispatch({
      type: "append_log",
      message: importedCount
        ? `Imported ${importedCount} JSON block(s) from ${files.length} file(s).`
        : "No valid JSON blocks found in selected files.",
    });
  }

  async function handleImportNormalizedPromptAssets() {
    if (!libraryReady) handleLoadLibrary();

    try {
      const [storedBlocks, storedSequences] = await Promise.all([
        storageService.getAllPromptBlocks(),
        storageService.getAllPromptSequences(),
      ]);

      const existingBlockSourceIds = new Set(
        (state.promptLibrary.blocks || [])
          .map((block) => block?.sourceAssetId || block?.sourceMeta?.sourceAssetId)
          .filter(Boolean)
      );
      const existingSequenceIds = new Set((state.promptLibrary.sequences || []).map((sequence) => sequence.id));

      const blocksToImport = (storedBlocks || []).filter((block) => {
        if (!block?.id) return false;
        if (state.promptLibrary.blocks.some((entry) => entry.id === block.id)) return false;
        if (block.sourceAssetId && existingBlockSourceIds.has(block.sourceAssetId)) return false;
        return true;
      });

      const importedBlockIds = new Set(blocksToImport.map((block) => block.id));
      const sequencesToImport = (storedSequences || []).filter((sequence) => {
        if (!sequence?.id || existingSequenceIds.has(sequence.id)) return false;
        const blockIds = Array.isArray(sequence.blocks) ? sequence.blocks.map((entry) => entry.blockId) : [];
        return blockIds.length > 0 && blockIds.every((blockId) => importedBlockIds.has(blockId) || state.promptLibrary.blocks.some((entry) => entry.id === blockId));
      });

      if (blocksToImport.length > 0) {
        dispatch({ type: "PROMPT_IMPORT_BLOCKS", blocks: blocksToImport });
      }

      if (sequencesToImport.length > 0) {
        dispatch({ type: "PROMPT_IMPORT_SEQUENCES", sequences: sequencesToImport });
      }

      const message =
        blocksToImport.length || sequencesToImport.length
          ? `Imported ${blocksToImport.length} normalized block(s) and ${sequencesToImport.length} sequence(s) from session storage.`
          : "No new normalized prompt assets found in session storage.";

      dispatch({ type: "append_log", message });

      return {
        ok: true,
        importedBlocks: blocksToImport.length,
        importedSequences: sequencesToImport.length,
        message,
      };
    } catch (error) {
      const message = `Normalized prompt import failed: ${error.message}`;
      dispatch({ type: "append_log", message });
      return {
        ok: false,
        importedBlocks: 0,
        importedSequences: 0,
        message,
      };
    }
  }

  async function handleExportPayload(payload, label) {
    const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        dispatch({ type: "append_log", message: `${label} copied to clipboard.` });
        return;
      }
    } catch (error) {
      dispatch({ type: "append_log", message: `${label} clipboard export failed, downloading instead.` });
    }

    downloadTextFile(`${label.replace(/\s+/g, "_").toLowerCase()}.json`, text);
  }

  function handleExportLibrary() {
    downloadTextFile("mmss_prompt_library.json", exportPromptLibraryFile(state.promptLibrary));
    dispatch({ type: "append_log", message: "Prompt library exported." });
  }

  function handleSavePreviewFile(payload) {
    const fileName = `composition_preview_${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    downloadTextFile(fileName, JSON.stringify(payload || {}, null, 2));
    dispatch({ type: "append_log", message: `JSON preview saved as ${fileName}.` });
  }

  function handleOpenInJsonHero(payload, label = "JSON preview") {
    try {
      const jsonText = typeof payload === "string" ? payload : JSON.stringify(payload || {}, null, 2);
      const encoded = bytesToBase64(new TextEncoder().encode(jsonText));
      window.open(`http://localhost:8787/new?j=${encodeURIComponent(encoded)}`, "_blank", "noopener,noreferrer");
      dispatch({ type: "append_log", message: `${label} opened in JSON Hero.` });
    } catch (error) {
      dispatch({ type: "append_log", message: `Failed to open ${label} in JSON Hero: ${error.message}` });
    }
  }

  function handleOpenJsonHeroRepo() {
    window.open("http://localhost:8787", "_blank", "noopener,noreferrer");
    dispatch({ type: "append_log", message: "Local JSON Hero opened." });
  }

  async function handlePushPreviewToGenesis() {
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/genesis-handoff`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          json: streamPreviewPayload || {},
          source: activeModeMeta.label,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      dispatch({ type: "append_log", message: "Current preview sent to JSON Genesis." });
    } catch (error) {
      dispatch({ type: "append_log", message: `Failed to send preview to JSON Genesis: ${error.message}` });
    }
  }

  async function handlePushLibraryToGenesis() {
    if (!libraryReady) {
      handleLoadLibrary();
    }
    try {
      const response = await fetch(`${MMSS_BRIDGE_API_BASE}/library-state`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          promptLibrary: state.promptLibrary,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      dispatch({
        type: "append_log",
        message: `Prompt library pushed to JSON Genesis: ${state.promptLibrary.blocks.length} block(s), ${state.promptLibrary.sequences.length} sequence(s).`,
      });
    } catch (error) {
      dispatch({ type: "append_log", message: `Failed to push library to JSON Genesis: ${error.message}` });
    }
  }

  async function handleExportBlocksAsFiles() {
    const blocks = state.promptLibrary.blocks || [];
    if (!blocks.length) {
      dispatch({ type: "append_log", message: "No blocks to export." });
      return;
    }

    if (typeof window.showDirectoryPicker === "function") {
      try {
        const root = await window.showDirectoryPicker();
        const folder = await root.getDirectoryHandle("prompt-library-blocks", { create: true });

        for (const block of blocks) {
          const fileName = `${sanitizeFileName(block.name || block.id)}__${sanitizeFileName(block.id)}.json`;
          const handle = await folder.getFileHandle(fileName, { create: true });
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(block, null, 2));
          await writable.close();
        }

        dispatch({
          type: "append_log",
          message: `Exported ${blocks.length} block file(s) to prompt-library-blocks.`,
        });
        return;
      } catch (error) {
        dispatch({
          type: "append_log",
          message: `Folder export cancelled or failed (${error.message}). Falling back to downloads.`,
        });
      }
    }

    blocks.forEach((block) => {
      const fileName = `${sanitizeFileName(block.name || block.id)}__${sanitizeFileName(block.id)}.json`;
      downloadTextFile(fileName, JSON.stringify(block, null, 2));
    });
    dispatch({
      type: "append_log",
      message: `Downloaded ${blocks.length} separate block JSON file(s).`,
    });
  }

  function handleGeneratePresetComposition(mode, count) {
    const blockIds = generateCompositionByMode(state.promptLibrary.blocks, mode, count);
    dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_SET", blockIds });
    dispatch({
      type: "append_log",
      message: `Composition preset applied (${mode}, ${blockIds.length} block(s)).`,
    });
  }

  function handleSetActiveCompositionFromBlockly(blockIds, mergeStrategy, meta = {}) {
    dispatch({
      type: "PROMPT_ACTIVE_COMPOSITION_SET_FROM_BLOCKLY",
      blockIds,
      mergeStrategy,
      workspaceXml: meta.workspaceXml || "",
      context: meta.context || null,
    });
    dispatch({
      type: "append_log",
      message: `Blockly composition applied (${blockIds.length} block(s), ${mergeStrategy}).`,
    });
  }

  function handleApplyAseUnifiedToSequenceBuilder(unifiedConfig) {
    if (!unifiedConfig || !Array.isArray(unifiedConfig.modes) || !unifiedConfig.modes.length) {
      dispatch({ type: "append_log", message: "ASE unified export skipped: no modes selected." });
      return;
    }

    if (!libraryReady) {
      handleLoadLibrary();
    }

    const modeBlocks = unifiedConfig.modes.map((mode, index) => {
      const blockId = `ase_mode_${mode.id}`;
      return {
        id: blockId,
        name: mode.name || mode.label || `ASE Mode ${index + 1}`,
        description: mode.description || "Generated from ASE Unified Console",
        category: mode.category || "ase_mode",
        tags: Array.isArray(mode.tags) ? [...mode.tags, "ase_console", "unified_pipeline"] : ["ase_console", "unified_pipeline"],
        payload: {
          type: "flowmusic.app_prompt",
          version: "1.0",
          data: {
            ase_mode: mode,
            fragment: mode.fragment || null,
          },
        },
        ui: {
          color: "#ff8bd6",
          icon: "ase",
          boundButtonId: null,
        },
        sourceMeta: {
          source: "ase_console",
          pipeline: "unified",
          order: index + 1,
        },
      };
    });

    const masterBlock = {
      id: "ase_unified_master",
      name: "ASE Unified Master",
      description: "Master MMSS JSON generated from ASE Unified Console",
      category: "ase_master",
      tags: ["ase_console", "master", "mmss", "unified_json"],
      payload: {
        type: "flowmusic.app_prompt",
        version: "1.0",
        data: unifiedConfig,
      },
      ui: {
        color: "#9be0ff",
        icon: "stack",
        boundButtonId: null,
      },
      sourceMeta: {
        source: "ase_console",
        pipeline: "master",
      },
    };

    const allBlocks = [...modeBlocks, masterBlock];
    const existingIds = new Set(state.promptLibrary.blocks.map((block) => block.id));
    allBlocks.forEach((block) => {
      dispatch({
        type: existingIds.has(block.id) ? "PROMPT_BLOCK_UPDATE" : "PROMPT_BLOCK_CREATE",
        block,
      });
    });

    const orderedBlockIds = [...modeBlocks.map((block) => block.id), masterBlock.id];
    dispatch({
      type: "PROMPT_ACTIVE_COMPOSITION_SET",
      blockIds: orderedBlockIds,
      mergeStrategy: "merge_deep",
      source: "ase_console",
      externalPipeline: {
        source: "ASE Unified Console",
        label: unifiedConfig.masterConsole?.name || "ASE Unified Console",
        modeCount: unifiedConfig.modes.length,
        mergeStrategy: "merge_deep",
        orderSummary: unifiedConfig.modes.map((mode) => mode.shortName || mode.name || mode.id).join(" -> "),
      },
    });
    dispatch({ type: "PROMPT_SET_MERGE_STRATEGY", mergeStrategy: "merge_deep" });

    const sequence = {
      id: `sequence_ase_${Date.now()}`,
      name: `ASE Unified ${new Date().toLocaleTimeString()}`,
      description: "Sequence generated from ASE Unified Console",
      blocks: orderedBlockIds.map((blockId, index) => ({ blockId, order: index })),
      mergeStrategy: "merge_deep",
      ui: {
        color: "#ffb4e8",
        icon: "ase",
        boundButtonId: null,
      },
      sourceMeta: {
        source: "ase_console",
      },
      conversationId: createEntityId("ase"),
      linkedTrackIds: [],
    };
    dispatch({ type: "PROMPT_SEQUENCE_CREATE", sequence });

    setActiveTab("prompt_library");
    setActivePromptPanel("json_sequence_builder");
    dispatch({
      type: "append_log",
      message: `ASE unified pipeline loaded into JsonSequenceBuilder (${orderedBlockIds.length} block(s)).`,
    });
  }

  function handleMovePromptPanel(panelId, direction) {
    const currentIndex = promptPanelOrder.indexOf(panelId);
    if (currentIndex < 0) return;
    const step = direction === "left" ? -1 : direction === "right" ? 1 : direction === "up" ? -2 : 2;
    const nextIndex = currentIndex + step;
    if (nextIndex < 0 || nextIndex >= promptPanelOrder.length) return;

    const next = [...promptPanelOrder];
    [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
    setPromptPanelOrder(next);
  }

  function handleBatchExportByFormula(formulaInput, modeFromUi, tagPreset) {
    const batch = parseBatchFormula(formulaInput, modeFromUi);
    const scopedBlocks = filterBlocksByPreset(state.promptLibrary.blocks, tagPreset);
    if (!scopedBlocks.length) {
      dispatch({ type: "append_log", message: "Batch export skipped: no blocks in selected tag preset." });
      return;
    }

    for (let fileIndex = 0; fileIndex < batch.files; fileIndex += 1) {
      const blockIds = generateCompositionByMode(scopedBlocks, batch.mode, batch.items);
      const payload = combinePromptBlocks(
        blockIds,
        scopedBlocks,
        state.promptLibrary.activeComposition?.mergeStrategy || "merge_deep"
      );
      const fileName = `batch_${batch.mode}_${tagPreset}_${fileIndex + 1}_of_${batch.files}.json`;
      downloadTextFile(fileName, JSON.stringify(payload, null, 2));
    }

    dispatch({
      type: "append_log",
      message: `Batch export done: ${batch.files} file(s), ${batch.items} blocks per file, mode ${batch.mode}, preset ${tagPreset}.`,
    });
  }

  function focusWorkspaceSection(sectionId) {
    setActiveTab(sectionId);
    setExpandedPanel(null);
    const node = sectionRefs.current[sectionId];
    if (node?.scrollIntoView) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  const drawerItems = [
    { id: "overview", icon: LayoutTemplate, label: "Workspace" },
    { id: "prompt_library", icon: Library, label: "Prompt Tools" },
    { id: "ase_console", icon: Workflow, label: "ASE Flow" },
    { id: "archives", icon: Archive, label: "Archives" },
    { id: "magnetic", icon: Magnet, label: "Magnetic" },
    { id: "json_genesis", icon: FileJson, label: "JSON Genesis" },
    { id: "system", icon: Settings, label: "System State" },
  ];

  const activeSequence = state.promptLibrary.sequences.find(
    (sequence) => sequence.id === state.promptLibrary.selectedSequenceId
  ) || null;
  const activeComposition = state.promptLibrary.activeComposition || null;
  const activityLogs = useMemo(
    () => [...(state.mmss?.logs || [])].slice(-8).reverse(),
    [state.mmss?.logs]
  );
  const heroMetrics = HERO_METRICS.map((metric) => {
    if (metric.id === "active_mode") {
      return {
        ...metric,
        value: APP_TABS.find((tab) => tab.id === activeTab)?.label || "Workspace",
      };
    }

    if (metric.id === "prompt_blocks") {
      return { ...metric, value: state.promptLibrary.blocks.length };
    }

    if (metric.id === "sequences") {
      return { ...metric, value: state.promptLibrary.sequences.length };
    }

    return {
      ...metric,
      value: libraryReady ? "Ready" : "Idle",
    };
  });
  const serviceCards = [
    { id: "magnetic", name: "Magnetic", ...serviceHealth.magnetic },
    { id: "mistral", name: "Mistral", ...serviceHealth.mistral },
    { id: "jsonhero", name: "JSON Hero", ...serviceHealth.jsonhero },
  ];
  const activeModeMeta = APP_TABS.find((tab) => tab.id === activeTab) || APP_TABS[0];
  const streamFeedback = useMemo(() => {
    if (activeTab === "prompt_library") {
      if (!libraryReady) {
        return "Prompt library is idle. Load the library to unlock blocks, sequences, bindings, and JSON composition tools.";
      }
      return `Prompt workspace ready. ${state.promptLibrary.blocks.length} blocks and ${state.promptLibrary.sequences.length} sequences are available in the active toolchain.`;
    }

    if (activeTab === "archives") {
      return "Archive workspace is online. Import local Flowmusic data, inspect sessions, and keep archive flows inside the same shell.";
    }

    if (activeTab === "magnetic") {
      return "Magnetic Builder is active. Simulate field evolution with charge, spin, wavelength, and stability metrics. Backend running on port 8001.";
    }

    if (activeTab === "json_genesis") {
      return "JSON Genesis workspace ready. AI-powered JSON structure editor with block-based composition and neural synthesis capabilities.";
    }

    return `ASE workspace is active. ${aseConfigCount} saved configs are available and direct handoff into the sequence builder remains linked.`;
  }, [
    activeTab,
    aseConfigCount,
    libraryReady,
    state.promptLibrary.blocks.length,
    state.promptLibrary.sequences.length,
  ]);
  const streamPreviewPayload = useMemo(() => {
    if (activeTab === "prompt_library") {
      return (
        activeComposition?.combinedJson ||
        selectedBlock?.payload?.data ||
        {
          mode: "prompt_library",
          libraryReady,
          activePanel: PROMPT_LIBRARY_PANEL_META[activePromptPanel]?.label || activePromptPanel,
          blocks: state.promptLibrary.blocks.length,
          sequences: state.promptLibrary.sequences.length,
          bindingMode: state.promptLibrary.bindingMode,
          mergeStrategy: activeComposition?.mergeStrategy || "merge_deep",
        }
      );
    }

    if (activeTab === "archives") {
      return {
        mode: "archives",
        source: "flowmusic",
        libraryReady,
        selectedSequence: activeSequence?.name || null,
        checkpoints: state.mmss.checkpoints.slice(-4),
        logs: activityLogs.slice(0, 4),
      };
    }

    if (activeTab === "magnetic") {
      return {
        mode: "magnetic",
        backend: "FastAPI",
        port: 8001,
        features: ["field_simulation", "charge_metrics", "spin_dynamics", "phase_transitions"],
        state: "persistent_json",
      };
    }

    if (activeTab === "json_genesis") {
      return {
        mode: "json_genesis",
        engine: "Vite + React",
        ai_models: ["Gemini 3-Flash", "Mistral Large 2"],
        features: ["block_editor", "ai_synthesis", "fragment_library", "export_import"],
        location: "json-genesis/",
      };
    }

    return {
      mode: "ase_console",
      savedConfigs: aseConfigCount,
      builderLinked: true,
      promptBlocks: state.promptLibrary.blocks.length,
      sequences: state.promptLibrary.sequences.length,
      activeComposition: {
        blocks: activeComposition?.blockIds?.length || 0,
        mergeStrategy: activeComposition?.mergeStrategy || "merge_deep",
      },
      system: {
        initialized: state.initialized,
        theme: state.vision.theme,
        playing: state.transport.playing,
        orbitEnabled: state.orbit.enabled,
      },
    };
  }, [
    activeTab,
    activeComposition,
    activePromptPanel,
    activeSequence,
    activityLogs,
    aseConfigCount,
    libraryReady,
    selectedBlock,
    state.initialized,
    state.mmss.checkpoints,
    state.orbit.enabled,
    state.promptLibrary.bindingMode,
    state.promptLibrary.blocks.length,
    state.promptLibrary.sequences.length,
    state.transport.playing,
    state.vision.theme,
  ]);
  const streamPreviewText = useMemo(
    () => JSON.stringify(streamPreviewPayload || {}, null, 2),
    [streamPreviewPayload]
  );
  const activeTopbarLabel =
    activeTab === "ase_console"
      ? "ASE_CONSOLE_X10"
      : activeTab === "prompt_library"
        ? "PROMPT_LIBRARY"
        : activeTab === "magnetic"
          ? "MAGNETIC_BUILDER"
          : activeTab === "json_genesis"
            ? "JSON_GENESIS"
            : "ARCHIVE_WORKSPACE";
  const activeSeedLabel =
    activeTab === "ase_console"
      ? "@_TOTAL_INIT"
      : activeTab === "prompt_library"
        ? `@_${(activePromptPanelMeta.label || "PANEL").replace(/\s+/g, "_").toUpperCase()}`
        : activeTab === "magnetic"
          ? "@_MAGNETIC_FIELD"
          : activeTab === "json_genesis"
            ? "@_JSON_SYNTHESIS"
            : "@_FLOWMUSIC_ARCHIVE";

  function toggleDrawerPanel(panelId) {
    setExpandedPanel((current) => (current === panelId ? null : panelId));
  }

  function renderPromptLibraryStage() {
    return (
      <section
        ref={(node) => { sectionRefs.current.prompt_library = node; }}
        className="workspace-surface workspace-surface--library is-focused template-stage-panel"
      >
        <div className="workspace-surface__head">
          <div>
            <span className="workspace-surface__eyebrow">Core Mode 01</span>
            <h3>Prompt Library</h3>
            <p>Blocks, sequences, bindings, and unified JSON composition stay accessible here.</p>
          </div>
          <button className="workspace-surface__action" onClick={() => setExpandedPanel("prompt_library")}>
            Open Tools
          </button>
        </div>

        <div className="workspace-surface__summary">
          <div className="workspace-summary-card">
            <span>Focused panel</span>
            <strong>{activePromptPanelMeta.label}</strong>
          </div>
          <div className="workspace-summary-card">
            <span>Active composition</span>
            <strong>{state.promptLibrary.activeComposition?.blockIds?.length || 0} block(s)</strong>
          </div>
          <div className="workspace-summary-card">
            <span>Merge strategy</span>
            <strong>{state.promptLibrary.activeComposition?.mergeStrategy || "merge_deep"}</strong>
          </div>
        </div>

        <div className="tab-view prompt-library-view">
          <div className="prompt-library-shell">
            <div className="prompt-library-topbar">
              <div className="prompt-library-topbar__head">
                <div>
                  <strong>Prompt Workspace</strong>
                  <span>
                    {state.promptLibrary.blocks.length} block(s), {state.promptLibrary.sequences.length} sequence(s)
                  </span>
                </div>
                <div className="prompt-library-status">
                  <span>{libraryReady ? "Ready" : "Idle"}</span>
                  <span>{activePromptPanelMeta.label}</span>
                </div>
              </div>
              <div className="row">
                <button onClick={handleLoadLibrary} disabled={libraryReady}>
                  {libraryReady ? "Library Ready" : "Load Library"}
                </button>
                <button onClick={handleImportNormalizedPromptAssets}>
                  Import Session Blocks
                </button>
                <button
                  onClick={() => {
                    setPromptPanelOrder(PROMPT_PANEL_DEFAULT_ORDER);
                    setActivePromptPanel(PROMPT_PANEL_DEFAULT_ORDER[0]);
                  }}
                >
                  Reset Layout
                </button>
                <button onClick={() => dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_CLEAR" })}>
                  Clear Composition
                </button>
              </div>
            </div>

            {libraryReady ? (
              <div className="prompt-library-workbench">
                <aside className="prompt-panel-sidebar">
                  <div className="prompt-panel-sidebar-head">
                    <strong>Panels</strong>
                    <span>Switch tools without leaving the workspace</span>
                  </div>
                  <div className="prompt-panel-sidebar-list">
                    {promptPanelOrder.map((panelId) => {
                      const panelMeta = PROMPT_LIBRARY_PANEL_META[panelId];
                      const isActive = activePromptPanel === panelId;
                      return (
                        <button
                          key={`nav-${panelId}`}
                          className={`prompt-panel-nav ${isActive ? "active" : ""}`}
                          onClick={() => setActivePromptPanel(panelId)}
                        >
                          <strong>{panelMeta.label}</strong>
                          <span>{panelMeta.subtitle}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>
                <div className="prompt-panel-stage">
                  <div className="prompt-stage-shell-head">
                    <div>
                      <strong>{activePromptPanelMeta.label}</strong>
                      <span>{activePromptPanelMeta.subtitle}</span>
                    </div>
                    <div className="prompt-stage-shell-tags">
                      <span>{state.promptLibrary.blocks.length} blocks</span>
                      <span>{state.promptLibrary.sequences.length} sequences</span>
                      <span>{selectedBlock?.name || "No block selected"}</span>
                    </div>
                  </div>
                  <div className="prompt-panel-grid">
                    {promptPanelOrder.map((panelId) => {
                      const panelActions = (
                        <div className="panel-move-actions">
                          <button
                            onClick={() => handleMovePromptPanel(panelId, "left")}
                            disabled={(promptPanelIndex[panelId] ?? 0) % 2 === 0}
                          >
                            в†ђ
                          </button>
                          <button
                            onClick={() => handleMovePromptPanel(panelId, "right")}
                            disabled={(promptPanelIndex[panelId] ?? 0) % 2 === 1}
                          >
                            в†’
                          </button>
                          <button
                            onClick={() => handleMovePromptPanel(panelId, "up")}
                            disabled={(promptPanelIndex[panelId] ?? 0) < 2}
                          >
                            в†‘
                          </button>
                          <button
                            onClick={() => handleMovePromptPanel(panelId, "down")}
                            disabled={(promptPanelIndex[panelId] ?? 0) > 1}
                          >
                            в†“
                          </button>
                        </div>
                      );

                      if (panelId !== activePromptPanel) {
                        return null;
                      }

                      if (panelId === "json_block_list") {
                        return (
                          <SectionCard
                            key={panelId}
                            className="prompt-fixed-panel"
                            title="JsonBlockList"
                            subtitle="Searchable block catalog with filters, tags, and quick actions"
                            actions={panelActions}
                          >
                            <JsonBlockList
                              blocks={state.promptLibrary.blocks}
                              selectedBlockId={state.promptLibrary.selectedBlockId}
                              onSelect={(blockId) => dispatch({ type: "PROMPT_SELECT_BLOCK", blockId })}
                              onDuplicate={(blockId) => dispatch({ type: "PROMPT_BLOCK_DUPLICATE", blockId })}
                              onDelete={(blockId) => dispatch({ type: "PROMPT_BLOCK_DELETE", blockId })}
                              onPrepareBind={handlePrepareBind}
                            />
                          </SectionCard>
                        );
                      }

                      if (panelId === "json_block_editor") {
                        return (
                          <SectionCard
                            key={panelId}
                            className="prompt-fixed-panel"
                            title="JsonBlockEditor"
                            subtitle="Metadata form plus validated JSON editor with save, format, and export"
                            actions={panelActions}
                          >
                            <JsonBlockEditor
                              block={selectedBlock}
                              onSave={handlePromptBlockSave}
                              onExport={(payload, name) => handleExportPayload(payload, `${name || "block"}_payload`)}
                            />
                          </SectionCard>
                        );
                      }

                      if (panelId === "prompt_logic_blockly") {
                        return (
                          <SectionCard
                            key={panelId}
                            className="prompt-fixed-panel blockly-panel-shell"
                            title="PromptLogicBlocklyPanel"
                            subtitle="Visual DSL for selecting blocks/sequences and merge strategy"
                            actions={panelActions}
                          >
                            <PromptLogicBlocklyPanel
                              blocks={state.promptLibrary.blocks}
                              sequences={state.promptLibrary.sequences}
                              sourceJson={
                                selectedBlock?.payload?.data ||
                                state.promptLibrary.activeComposition.combinedJson?.data ||
                                state.promptLibrary.activeComposition.combinedJson
                              }
                              initialContext={state.promptLibrary.activeComposition.context || DEFAULT_BLOCKLY_CONTEXT}
                              initialWorkspaceXml={
                                state.promptLibrary.activeComposition.blocklyWorkspaceXml ||
                                DEFAULT_BLOCKLY_WORKSPACE_XML
                              }
                              onWorkspaceXmlChange={(workspaceXml) =>
                                dispatch({
                                  type: "PROMPT_ACTIVE_COMPOSITION_SET_FROM_BLOCKLY",
                                  blockIds: state.promptLibrary.activeComposition.blockIds,
                                  mergeStrategy: state.promptLibrary.activeComposition.mergeStrategy,
                                  workspaceXml,
                                  context: state.promptLibrary.activeComposition.context || DEFAULT_BLOCKLY_CONTEXT,
                                })
                              }
                              onSetActiveComposition={handleSetActiveCompositionFromBlockly}
                              onClearActiveComposition={() =>
                                dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_CLEAR" })
                              }
                            />
                          </SectionCard>
                        );
                      }

                      if (panelId === "json_sequence_builder") {
                        return (
                          <SectionCard
                            key={panelId}
                            className="prompt-fixed-panel"
                            title="JsonSequenceBuilder"
                            subtitle="Assemble active compositions, preview merge output, and save sequences"
                            actions={panelActions}
                          >
                            <JsonSequenceBuilder
                              blocks={state.promptLibrary.blocks}
                              sequences={state.promptLibrary.sequences}
                              selectedSequenceId={state.promptLibrary.selectedSequenceId}
                              activeComposition={state.promptLibrary.activeComposition}
                              onSelectSequence={(sequenceId) =>
                                dispatch({ type: "PROMPT_SELECT_SEQUENCE", sequenceId })
                              }
                              onDeleteSequence={(sequenceId) => dispatch({ type: "PROMPT_SEQUENCE_DELETE", sequenceId })}
                              onAddBlock={(blockId) =>
                                dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_ADD_BLOCK", blockId })
                              }
                              onRemoveBlock={(index) =>
                                dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_REMOVE_BLOCK", index })
                              }
                              onReorder={(fromIndex, toIndex) =>
                                dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_REORDER", fromIndex, toIndex })
                              }
                              onSetMergeStrategy={(mergeStrategy) =>
                                dispatch({ type: "PROMPT_SET_MERGE_STRATEGY", mergeStrategy })
                              }
                              onSaveCompositionAsSequence={(name, description) =>
                                dispatch({ type: "PROMPT_SAVE_COMPOSITION_AS_SEQUENCE", name, description })
                              }
                              onExportSequence={(payload, label) => handleExportPayload(payload, label)}
                              onGeneratePresetComposition={handleGeneratePresetComposition}
                              onCopyPreview={(payload) => handleExportPayload(payload, "json_preview")}
                              onSavePreviewFile={handleSavePreviewFile}
                              onBatchExport={handleBatchExportByFormula}
                            />
                          </SectionCard>
                        );
                      }

                      return (
                        <SectionCard
                          key={panelId}
                          className="prompt-fixed-panel"
                          title="JsonBindingsPanel"
                          subtitle="4 x 4 trigger matrix for block and sequence bindings with import/export tools"
                          actions={panelActions}
                        >
                          <JsonBindingsPanel
                            bindings={state.promptLibrary.bindings}
                            bindingMode={state.promptLibrary.bindingMode}
                            sequencePressMode={state.promptLibrary.sequencePressMode}
                            blocks={state.promptLibrary.blocks}
                            sequences={state.promptLibrary.sequences}
                            selectedBlockId={state.promptLibrary.selectedBlockId}
                            selectedSequenceId={state.promptLibrary.selectedSequenceId}
                            activeComposition={state.promptLibrary.activeComposition}
                            onSetBindingMode={(bindingMode) =>
                              dispatch({ type: "PROMPT_SET_BINDING_MODE", bindingMode })
                            }
                            onSetSequencePressMode={(sequencePressMode) =>
                              dispatch({ type: "PROMPT_SET_SEQUENCE_PRESS_MODE", sequencePressMode })
                            }
                            onBindButton={(buttonId, bindingType, targetId) =>
                              dispatch({ type: "PROMPT_BIND_BUTTON", buttonId, bindingType, targetId })
                            }
                            onTriggerButton={(buttonId) => dispatch({ type: "PROMPT_TRIGGER_BUTTON", buttonId })}
                            onClearComposition={() => dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_CLEAR" })}
                            onSaveCompositionAsSequence={() =>
                              dispatch({
                                type: "PROMPT_SAVE_COMPOSITION_AS_SEQUENCE",
                                name: `Composition ${state.promptLibrary.sequences.length + 1}`,
                                description: "Saved from binding panel",
                              })
                            }
                            onExportComposition={(payload, label) => handleExportPayload(payload, label)}
                            onPrepareBind={handlePrepareBind}
                            onImportLibrary={handleImportLibrary}
                            onExportLibrary={handleExportLibrary}
                            onExportBlocksAsFiles={handleExportBlocksAsFiles}
                            onLoadLibrary={handleLoadLibrary}
                            libraryReady={libraryReady}
                          />
                        </SectionCard>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <SectionCard
                title="Prompt Library Idle"
                subtitle="Library data stays unloaded until explicit activation"
              >
                <p>
                  Click <strong>Load Library</strong> to open prompt panels, imports, exports, and sequence tools
                  inside the unified workspace.
                </p>
              </SectionCard>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderAseStage() {
    return (
      <section
        ref={(node) => { sectionRefs.current.ase_console = node; }}
        className="workspace-surface workspace-surface--ase is-focused template-stage-panel template-stage-panel--ase"
      >
        <div className="workspace-surface__head">
          <div>
            <span className="workspace-surface__eyebrow">Core Mode 02</span>
            <h3>ASE Console</h3>
            <p>Unified ASE rack, MMSS JSON, mode tips, pipeline ordering, and builder handoff.</p>
          </div>
          <button className="workspace-surface__action" onClick={() => setExpandedPanel("ase_console")}>
            Open Flow
          </button>
        </div>

        <div className="tab-view ase-console-view">
          <div className="workspace-surface__summary">
            <div className="workspace-summary-card">
              <span>Saved configs</span>
              <strong>{aseConfigCount}</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Unified handoff</span>
              <strong>JsonSequenceBuilder</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Active model</span>
              <strong>ASE Unified Rack</strong>
            </div>
          </div>
          <div className="mode-shell-head mode-shell-head--ase">
            <div>
              <strong>ASE Workspace</strong>
              <span>Unified modules, pipeline order, and direct MMSS builder handoff.</span>
            </div>
            <div className="mode-shell-status">
              <span>{aseConfigCount} saved configs</span>
              <span>Builder linked</span>
            </div>
          </div>
          <ASEMasterConsole
            onSendToSequenceBuilder={handleApplyAseUnifiedToSequenceBuilder}
            onSaveToDatabase={(config) => {
              const existing = JSON.parse(localStorage.getItem(ASE_DB_STORAGE_KEY) || "[]");
              const updated = [...existing, { ...config, savedAt: new Date().toISOString() }];
              localStorage.setItem(ASE_DB_STORAGE_KEY, JSON.stringify(updated));
              dispatch({ type: "append_log", message: `ASE config "${config.name}" saved to database.` });
            }}
          />
        </div>
      </section>
    );
  }

  function renderArchivesStage() {
    return (
      <section
        ref={(node) => { sectionRefs.current.archives = node; }}
        className="workspace-surface workspace-surface--archives is-focused template-stage-panel"
      >
        <div className="workspace-surface__head">
          <div>
            <span className="workspace-surface__eyebrow">Core Mode 03</span>
            <h3>Archives</h3>
            <p>Archive import, browsing, filtering, and session drill-down stay available in the same workspace.</p>
          </div>
          <button className="workspace-surface__action" onClick={() => setExpandedPanel("archives")}>
            Open Archive
          </button>
        </div>

        <div className="workspace-archives-shell">
          <div className="workspace-surface__summary">
            <div className="workspace-summary-card">
              <span>Source of truth</span>
              <strong>flowmusic_backup_*</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Legacy fallback</span>
              <strong>producer_backup_*</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Auth preference</span>
              <strong>flowmusic_auth_*</strong>
            </div>
          </div>
          <div className="mode-shell-head mode-shell-head--archives">
            <div>
              <strong>Archive Workspace</strong>
              <span>Import local data, browse sessions, and keep archive flows inside the same app shell.</span>
            </div>
            <div className="mode-shell-status">
              <span>Flowmusic source</span>
              <span>Import ready</span>
            </div>
          </div>
          <ArchivesPage />
        </div>
      </section>
    );
  }

  function renderMagneticStage() {
    return (
      <section
        ref={(node) => { sectionRefs.current.magnetic = node; }}
        className="workspace-surface workspace-surface--magnetic is-focused template-stage-panel"
      >
        <div className="workspace-surface__head">
          <div>
            <span className="workspace-surface__eyebrow">Core Mode 04</span>
            <h3>Magnetic Builder</h3>
            <p>MMSS magnetic field simulation with charge, spin, wavelength, and stability metrics.</p>
          </div>
          <button className="workspace-surface__action" onClick={() => setExpandedPanel("magnetic")}>
            Open Controls
          </button>
        </div>

        <div className="workspace-magnetic-shell">
          <div className="workspace-surface__summary">
            <div className="workspace-summary-card">
              <span>Backend</span>
              <strong>{serviceHealth.magnetic.online ? "FastAPI · online" : "FastAPI · offline"}</strong>
            </div>
            <div className="workspace-summary-card">
              <span>State</span>
              <strong>{serviceHealth.magnetic.detail}</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Phases</span>
              <strong>harmonic → wave → pulse → void</strong>
            </div>
          </div>
          <div className="mode-shell-head mode-shell-head--magnetic">
            <div>
              <strong>Magnetic Workspace</strong>
              <span>Interactive field simulation with real-time canvas visualization.</span>
            </div>
            <div className="mode-shell-status">
              <span>Port 8001</span>
              <span>{serviceHealth.magnetic.label}</span>
            </div>
          </div>
          <div style={{ padding: 20 }}>
            <MMSSWidget mode="magnetic" title="🧲 MMSS: Магнитное поле" />
          </div>
        </div>
      </section>
    );
  }

  function renderJsonGenesisStage() {
    return (
      <section
        ref={(node) => { sectionRefs.current.json_genesis = node; }}
        className="workspace-surface workspace-surface--json-genesis is-focused template-stage-panel"
      >
        <div className="workspace-surface__head">
          <div>
            <span className="workspace-surface__eyebrow">Core Mode 05</span>
            <h3>JSON Genesis</h3>
            <p>AI-powered JSON structure editor with block-based composition and neural synthesis.</p>
          </div>
          <button className="workspace-surface__action" onClick={() => setExpandedPanel("json_genesis")}>
            Open Editor
          </button>
        </div>

        <div className="workspace-json-genesis-shell">
          <div className="workspace-surface__summary">
            <div className="workspace-summary-card">
              <span>Engine</span>
              <strong>Vite + React</strong>
            </div>
            <div className="workspace-summary-card">
              <span>JSON Hero</span>
              <strong>{serviceHealth.jsonhero.label}</strong>
            </div>
            <div className="workspace-summary-card">
              <span>Mistral</span>
              <strong>{serviceHealth.mistral.label}</strong>
            </div>
          </div>
          <div className="mode-shell-head mode-shell-head--json-genesis">
            <div>
              <strong>JSON Genesis Workspace</strong>
              <span>Visual JSON structure editor with AI-powered content generation.</span>
            </div>
            <div className="mode-shell-status">
              <span>Standalone</span>
              <span>{serviceHealth.jsonhero.online ? "JSON Hero Online" : "JSON Hero Offline"}</span>
            </div>
          </div>
          <div style={{ padding: 20, textAlign: 'center' }}>
            <SectionCard title="JSON Genesis Integration" subtitle="AI-powered JSON editor">
              <p style={{ marginBottom: 16 }}>
                JSON Genesis is a standalone Vite application located at <code>json-genesis/</code>.
              </p>
              <p style={{ marginBottom: 16 }}>
                To use it, run: <code>cd json-genesis &amp;&amp; npm run dev</code> and open <code>http://localhost:3001</code>
              </p>
              <p>
                Features: Block-based JSON editing, AI synthesis with Gemini/Mistral, fragment library, export/import.
              </p>
            </SectionCard>
            <SectionCard
              title="JSON Hero Bridge"
              subtitle="Open current app JSON in jsonhero-web"
              className="jsonhero-bridge-card"
            >
              <p style={{ marginBottom: 16 }}>
                Send the current preview payload from this app to JSON Hero, or open the upstream
                local
                <code> jsonhero-web </code>
                service.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button className="workspace-surface__action" onClick={() => handleOpenInJsonHero(streamPreviewPayload, "Stream preview")}>
                  Open Preview in JSON Hero
                </button>
                <button className="workspace-surface__action" onClick={handleOpenJsonHeroRepo}>
                  Open Local JSON Hero
                </button>
                <button className="workspace-surface__action" onClick={handlePushPreviewToGenesis}>
                  Send Preview to Genesis
                </button>
                <button className="workspace-surface__action" onClick={handlePushLibraryToGenesis}>
                  Send Library to Genesis
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      </section>
    );
  }

  function renderActiveStageSection() {
    if (activeTab === "prompt_library") {
      return renderPromptLibraryStage();
    }
    if (activeTab === "archives") {
      return renderArchivesStage();
    }
    if (activeTab === "magnetic") {
      return renderMagneticStage();
    }
    if (activeTab === "json_genesis") {
      return renderJsonGenesisStage();
    }
    return renderAseStage();
  }

  return (
    <div className="app-shell compact-shell" style={themeStyle}>
      {!state.initialized ? (
        <div className="boot-overlay">
          <div className="boot-card">
            <span className="eyebrow">MMSS React Rebuild</span>
            <h1>Core Workspace</h1>
            <p>
              Focused workspace for Prompt Library, ASE Console, and Archives inside `react/my-app`.
            </p>
            <button className="btn accent" onClick={launchCore}>
              Open Workspace
            </button>
          </div>
        </div>
      ) : null}

      <main className={`compact-app-layout workspace-shell-with-rail ${expandedPanel ? "has-drawer" : ""}`}>
        <aside className="workspace-rail">
          <div className="workspace-rail__logo">
            <Boxes size={20} />
          </div>
          <div className="workspace-rail__nav">
            {drawerItems.map((item) => (
              <button
                key={item.id}
                className={`workspace-rail__btn ${
                  expandedPanel === item.id || activeTab === item.id ? "active" : ""
                }`}
                onClick={() => toggleDrawerPanel(item.id)}
                title={item.label}
              >
                <item.icon size={18} />
              </button>
            ))}
            <button
              className="workspace-rail__btn"
              onClick={() => {
                focusWorkspaceSection("archives");
                setTimeout(() => {
                  const importButton = document.querySelector('.archives-header .btn-primary');
                  if (importButton) importButton.click();
                }, 500);
              }}
              title="Import Archive Data"
            >
              <Archive size={18} />
            </button>
            <button
              className="workspace-rail__btn"
              onClick={() => {
                handleLoadLibrary();
                setTimeout(() => {
                  handleImportNormalizedPromptAssets();
                }, 300);
              }}
              title="Import Session Blocks"
            >
              <Database size={18} />
            </button>
          </div>
        </aside>
        <aside className={`workspace-drawer ${expandedPanel ? "is-open" : ""}`}>
          <div className="workspace-drawer__head">
            <div>
              <span className="workspace-surface__eyebrow">Context Drawer</span>
              <h3>{drawerItems.find((item) => item.id === expandedPanel)?.label || "Workspace"}</h3>
            </div>
            <button className="workspace-drawer__close" onClick={() => setExpandedPanel(null)}>
              <X size={18} />
            </button>
          </div>

          <div className="workspace-drawer__body">
            {expandedPanel === "overview" ? (
              <div className="drawer-stack">
                <SectionCard title="Workspace Focus" subtitle="Current rebuild direction">
                  <div className="drawer-metric-grid">
                    <div className="drawer-metric-card"><span>Modes</span><strong>5 Core</strong></div>
                    <div className="drawer-metric-card"><span>Prompt Blocks</span><strong>{state.promptLibrary.blocks.length}</strong></div>
                    <div className="drawer-metric-card"><span>Sequences</span><strong>{state.promptLibrary.sequences.length}</strong></div>
                    <div className="drawer-metric-card"><span>ASE Saves</span><strong>{aseConfigCount}</strong></div>
                  </div>
                </SectionCard>
                <SectionCard title="Quick Jumps" subtitle="Move around the workspace">
                  <div className="drawer-link-list">
                    {APP_TABS.map((tab) => (
                      <button key={`drawer-${tab.id}`} onClick={() => focusWorkspaceSection(tab.id)}>
                        <div>
                          <strong>{tab.label}</strong>
                          <span>{tab.summary}</span>
                        </div>
                        <ChevronRight size={14} />
                      </button>
                    ))}
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "prompt_library" ? (
              <div className="drawer-stack">
                <SectionCard title="Prompt Sections" subtitle="Prompt tools in one place">
                  <div className="drawer-link-list">
                    {promptPanelOrder.map((panelId) => {
                      const panelMeta = PROMPT_LIBRARY_PANEL_META[panelId];
                      return (
                        <button
                          key={`drawer-panel-${panelId}`}
                          onClick={() => {
                            setActivePromptPanel(panelId);
                            focusWorkspaceSection("prompt_library");
                          }}
                        >
                          <div>
                            <strong>{panelMeta.label}</strong>
                            <span>{panelMeta.subtitle}</span>
                          </div>
                          <ChevronRight size={14} />
                        </button>
                      );
                    })}
                  </div>
                </SectionCard>
                <SectionCard title="Active Composition" subtitle="Live prompt composition state">
                  <div className="drawer-note-list">
                    <div><strong>Merge:</strong> {activeComposition?.mergeStrategy || "merge_deep"}</div>
                    <div><strong>Blocks:</strong> {activeComposition?.blockIds?.length || 0}</div>
                    <div><strong>Selected sequence:</strong> {activeSequence?.name || "None"}</div>
                    <div><strong>Selected block:</strong> {selectedBlock?.name || "None"}</div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "ase_console" ? (
              <div className="drawer-stack">
                <SectionCard title="ASE Workflow" subtitle="Unified rack and builder handoff">
                  <div className="drawer-note-list">
                    <div><strong>Saved configs:</strong> {aseConfigCount}</div>
                    <div><strong>Builder handoff:</strong> Direct to `JsonSequenceBuilder`</div>
                    <div><strong>Rack mode:</strong> Unified MMSS pipeline</div>
                  </div>
                </SectionCard>
                <SectionCard title="Quick Actions" subtitle="Jump to the active ASE surface">
                  <div className="drawer-link-list">
                    <button onClick={() => focusWorkspaceSection("ase_console")}>
                      <strong>Open ASE workspace</strong>
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setActivePromptPanel("json_sequence_builder");
                        focusWorkspaceSection("prompt_library");
                      }}
                    >
                      <strong>Open JsonSequenceBuilder</strong>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "archives" ? (
              <div className="drawer-stack">
                <SectionCard title="Archive Tools" subtitle="Archive import stays inside the same workspace">
                  <div className="drawer-link-list">
                    <button onClick={() => focusWorkspaceSection("archives")}>
                      <strong>Open Archives surface</strong>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </SectionCard>
                <SectionCard title="Archive Focus" subtitle="Single source of truth already switched to flowmusic">
                  <div className="drawer-note-list">
                    <div><strong>Output folders:</strong> `flowmusic_backup_*`</div>
                    <div><strong>Legacy support:</strong> `producer_backup_*` still readable</div>
                    <div><strong>Auth files:</strong> `flowmusic_auth_*` preferred</div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "magnetic" ? (
              <div className="drawer-stack">
                <SectionCard title="Magnetic Tools" subtitle="Field simulation controls">
                  <div className="drawer-link-list">
                    <button onClick={() => focusWorkspaceSection("magnetic")}>
                      <strong>Open Magnetic workspace</strong>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </SectionCard>
                <SectionCard title="Magnetic Focus" subtitle="FastAPI backend on port 8001">
                  <div className="drawer-note-list">
                    <div><strong>Backend:</strong> FastAPI (uvicorn)</div>
                    <div><strong>State file:</strong> mmss_state.json</div>
                    <div><strong>Metrics:</strong> charge, spin, wavelength, stability</div>
                    <div><strong>Phases:</strong> harmonic → wave → pulse → void</div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "json_genesis" ? (
              <div className="drawer-stack">
                <SectionCard title="JSON Genesis Tools" subtitle="AI-powered JSON editor">
                  <div className="drawer-link-list">
                    <button onClick={() => focusWorkspaceSection("json_genesis")}>
                      <strong>Open JSON Genesis workspace</strong>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </SectionCard>
                <SectionCard title="JSON Genesis Focus" subtitle="Standalone Vite application">
                  <div className="drawer-note-list">
                    <div><strong>Location:</strong> json-genesis/</div>
                    <div><strong>Engine:</strong> Vite + React + TypeScript</div>
                    <div><strong>AI Models:</strong> Gemini 3-Flash, Mistral Large 2</div>
                    <div><strong>Features:</strong> Block editor, AI synthesis, fragment library</div>
                  </div>
                </SectionCard>
              </div>
            ) : null}

            {expandedPanel === "system" ? (
              <div className="drawer-stack">
                <SectionCard title="System State" subtitle="Current shell status">
                  <div className="drawer-metric-grid">
                    <div className="drawer-metric-card"><span>Library</span><strong>{libraryReady ? "Ready" : "Idle"}</strong></div>
                    <div className="drawer-metric-card"><span>Focused mode</span><strong>{APP_TABS.find((tab) => tab.id === activeTab)?.label}</strong></div>
                    <div className="drawer-metric-card"><span>Drawer</span><strong>{expandedPanel || "Closed"}</strong></div>
                    <div className="drawer-metric-card"><span>State</span><strong>{state.initialized ? "Initialized" : "Boot"}</strong></div>
                  </div>
                </SectionCard>
                <SectionCard title="Rebuild Status" subtitle="Current direction of the UI rewrite">
                  <div className="drawer-note-list">
                    <div><Sparkles size={14} /> Single-page shell is active</div>
                    <div><Database size={14} /> Prompt/ASE/Archives/Magnetic/JSON Genesis are preserved</div>
                    <div><Workflow size={14} /> Legacy prismatic/performance surface is detached</div>
                  </div>
                </SectionCard>
              </div>
            ) : null}
          </div>
        </aside>

        <div className="core-workspace-shell template-workspace-shell">
          <header className="template-topbar">
            <div className="template-topbar__brand">
              <Boxes size={18} />
              <span>{activeTopbarLabel}</span>
            </div>
            <div className="template-topbar__center">
              <div className="template-topbar__seed">
                <Sparkles size={14} />
                <span>{activeSeedLabel}</span>
              </div>
              <div className="core-shell-nav template-mode-switcher">
                {APP_TABS.map((tab, index) => (
                  <button
                    key={tab.id}
                    className={`core-shell-pill template-mode-pill ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => focusWorkspaceSection(tab.id)}
                  >
                    <span className="core-shell-pill__index">0{index + 1}</span>
                    <strong>{tab.label}</strong>
                    <span>{tab.summary}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="template-topbar__actions">
              <div className="template-topbar__badge">
                <span>Mode</span>
                <strong>{activeModeMeta.label}</strong>
              </div>
              <div className="template-topbar__badge">
                <span>Status</span>
                <strong>{libraryReady ? "Ready" : "Idle"}</strong>
              </div>
            </div>
          </header>

          <div className="workspace-core-grid template-stage-grid">
            <div className="template-stage-column">
              {renderActiveStageSection()}
            </div>

            <aside className="template-stream-sidebar">
              <div className="template-stream-sidebar__head">
                <div className="template-stream-sidebar__title">
                  <ChevronRight size={16} />
                  <span>{activeModeMeta.label.toUpperCase()} STREAM</span>
                </div>
                <div className="template-stream-sidebar__status">
                  <span className="template-stream-sidebar__dot" />
                  <strong>{activeTab === "ase_console" ? "ACTIVE STREAM" : "SYNCED"}</strong>
                </div>
              </div>

              <div className="template-stream-card template-stream-card--feedback">
                <div className="template-stream-card__eyebrow">
                  <Sparkles size={12} />
                  <span>Orchestrator Feedback</span>
                </div>
                <p>{streamFeedback}</p>
              </div>

              <div className="template-stream-metrics">
                {heroMetrics.map((metric) => (
                  <div key={metric.id} className="template-stream-metric">
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </div>
                ))}
              </div>

              <div className="template-stream-card template-stream-card--services">
                <div className="template-stream-card__eyebrow">
                  <Boxes size={12} />
                  <span>Service Health</span>
                </div>
                <div className="template-service-list">
                  {serviceCards.map((service) => (
                    <div
                      key={service.id}
                      className={`template-service-item ${service.online ? "is-online" : "is-offline"}`}
                    >
                      <div className="template-service-item__head">
                        <span>{service.name}</span>
                        <strong>{service.label}</strong>
                      </div>
                      <small>{service.detail}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="template-stream-card template-stream-card--json">
                <div className="template-stream-card__eyebrow">
                  <Database size={12} />
                  <span>Unified Preview</span>
                </div>
                <pre>{streamPreviewText}</pre>
              </div>

              <div className="template-stream-card template-stream-card--logs">
                <div className="template-stream-card__eyebrow">
                  <Workflow size={12} />
                  <span>Recent Activity</span>
                </div>
                <div className="template-stream-log-list">
                  {activityLogs.length ? (
                    activityLogs.map((entry, index) => (
                      <div key={`${entry}-${index}`} className="template-stream-log-item">
                        {entry}
                      </div>
                    ))
                  ) : (
                    <div className="template-stream-log-item is-empty">No activity yet.</div>
                  )}
                </div>
              </div>

              <div className="template-stream-actions">
                <button
                  className="template-stream-actions__primary"
                  onClick={() => {
                    if (activeTab === "prompt_library" && !libraryReady) {
                      handleLoadLibrary();
                      return;
                    }
                    setExpandedPanel(activeTab);
                  }}
                >
                  {activeTab === "prompt_library" && !libraryReady ? "LOAD LIBRARY" : `OPEN ${activeModeMeta.label.toUpperCase()}`}
                </button>
                <div className="template-stream-actions__row">
                  <button onClick={() => handleExportPayload(streamPreviewPayload, `${activeModeMeta.label}_preview`)}>
                    Copy Preview
                  </button>
                  <button onClick={() => handleSavePreviewFile(streamPreviewPayload)}>
                    Save JSON
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

function generateCompositionByMode(blocks, mode, requestedCount) {
  const ids = blocks.map((block) => block.id);
  if (!ids.length) return [];
  const count = Math.max(1, Math.min(ids.length, Number(requestedCount) || 1));

  if (mode === "random") {
    return shuffle(ids).slice(0, count);
  }

  if (mode === "ordered_name") {
    return [...blocks]
      .sort((left, right) => left.name.localeCompare(right.name))
      .slice(0, count)
      .map((block) => block.id);
  }

  if (mode === "category_wave") {
    const byCategory = new Map();
    blocks.forEach((block) => {
      const key = block.category || "general";
      const list = byCategory.get(key) || [];
      list.push(block.id);
      byCategory.set(key, list);
    });
    const categories = [...byCategory.keys()].sort();
    const result = [];
    let round = 0;
    while (result.length < count) {
      const category = categories[round % categories.length];
      const list = byCategory.get(category) || [];
      const index = Math.floor(round / categories.length);
      if (list[index]) {
        result.push(list[index]);
      }
      round += 1;
      if (round > blocks.length * 4) break;
    }
    return result.slice(0, count);
  }

  if (mode === "tag_chain") {
    const sorted = [...blocks].sort((left, right) => (right.tags?.length || 0) - (left.tags?.length || 0));
    const result = [];
    const used = new Set();
    let current = sorted[0];
    while (result.length < count && current) {
      result.push(current.id);
      used.add(current.id);
      const currentTags = new Set(current.tags || []);
      const next = sorted.find((candidate) => {
        if (used.has(candidate.id)) return false;
        const overlap = (candidate.tags || []).filter((tag) => currentTags.has(tag)).length;
        return overlap > 0;
      });
      current = next || sorted.find((candidate) => !used.has(candidate.id));
    }
    return result.slice(0, count);
  }

  if (mode === "stride_walk") {
    const ordered = [...blocks].sort((left, right) => left.id.localeCompare(right.id));
    const result = [];
    const used = new Set();
    let index = 0;
    const stride = 3;
    while (result.length < count && used.size < ordered.length) {
      const block = ordered[index % ordered.length];
      if (!used.has(block.id)) {
        result.push(block.id);
        used.add(block.id);
      }
      index += stride;
    }
    return result.slice(0, count);
  }

  if (mode === "key_density") {
    return [...blocks]
      .sort((left, right) => getKeyTagScore(right) - getKeyTagScore(left))
      .slice(0, count)
      .map((block) => block.id);
  }

  if (mode === "key_signature") {
    const bySignature = new Map();
    blocks.forEach((block) => {
      const signature = getKeySignature(block);
      const list = bySignature.get(signature) || [];
      list.push(block);
      bySignature.set(signature, list);
    });

    const signatures = [...bySignature.keys()].sort();
    const result = [];
    let round = 0;
    while (result.length < count) {
      const signature = signatures[round % signatures.length];
      const list = bySignature.get(signature) || [];
      const index = Math.floor(round / signatures.length);
      if (list[index]) {
        result.push(list[index].id);
      }
      round += 1;
      if (round > blocks.length * 5) break;
    }
    return result.slice(0, count);
  }

  return ids.slice(0, count);
}

function shuffle(values) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function getKeyTagScore(block) {
  const tags = Array.isArray(block?.tags) ? block.tags : [];
  return tags.filter((tag) => {
    const value = String(tag || "").toLowerCase();
    return value.includes("_") || value.length >= 8;
  }).length;
}

function getKeySignature(block) {
  const tags = Array.isArray(block?.tags) ? block.tags : [];
  const preferred = tags
    .map((tag) => String(tag || "").toLowerCase())
    .filter((tag) => tag.includes("_"))
    .slice(0, 3);

  if (preferred.length) {
    return preferred
      .map((tag) => tag.split("_")[0])
      .join("+");
  }

  const fallback = tags
    .map((tag) => String(tag || "").toLowerCase())
    .filter((tag) => tag.length >= 6)
    .slice(0, 2);
  return fallback.join("+") || "generic";
}

function parseBatchFormula(input, fallbackMode) {
  const raw = String(input || "").trim().toLowerCase();
  const match = raw.match(/(\d+)\s*[xх*]\s*(\d+)(?:\s+['"]?([a-z_]+)['"]?)?/i);
  if (!match) {
    return {
      files: 1,
      items: 12,
      mode: resolveGenerationMode(fallbackMode || "random"),
    };
  }

  return {
    files: Math.max(1, Number(match[1]) || 1),
    items: Math.max(1, Number(match[2]) || 1),
    mode: resolveGenerationMode(match[3] || fallbackMode || "random"),
  };
}

function resolveGenerationMode(mode) {
  const supported = new Set([
    "random",
    "ordered_name",
    "category_wave",
    "tag_chain",
    "stride_walk",
    "key_density",
    "key_signature",
  ]);
  return supported.has(mode) ? mode : "random";
}

function filterBlocksByPreset(blocks, tagPreset) {
  if (!Array.isArray(blocks)) return [];
  if (!tagPreset || tagPreset === "all") return blocks;

  return blocks.filter((block) => {
    const tags = (block.tags || []).map((tag) => String(tag).toLowerCase());
    if (tagPreset === "dense_keys") {
      return tags.some((tag) => tag.includes("_") || tag.length >= 10);
    }
    if (tagPreset === "lyrics") {
      return tags.some((tag) => tag.includes("lyric") || tag.includes("lfe") || tag.includes("text"));
    }
    if (tagPreset === "technical") {
      return tags.some((tag) =>
        ["audio", "eq", "mix", "phase", "filter", "compression", "sidechain"].some((token) =>
          tag.includes(token)
        )
      );
    }
    if (tagPreset === "visual") {
      return tags.some((tag) =>
        ["visual", "shader", "color", "orbit", "stage", "image"].some((token) => tag.includes(token))
      );
    }
    return true;
  });
}

function loadStoredPromptPanelOrder() {
  try {
    const raw = window.localStorage.getItem(PROMPT_PANEL_ORDER_STORAGE_KEY);
    if (!raw) return PROMPT_PANEL_DEFAULT_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PROMPT_PANEL_DEFAULT_ORDER;
    const valid = PROMPT_PANEL_DEFAULT_ORDER.filter((item) => parsed.includes(item));
    if (valid.length !== PROMPT_PANEL_DEFAULT_ORDER.length) {
      return PROMPT_PANEL_DEFAULT_ORDER;
    }
    return valid;
  } catch (error) {
    return PROMPT_PANEL_DEFAULT_ORDER;
  }
}

function loadStoredPromptActivePanel() {
  try {
    const raw = window.localStorage.getItem(PROMPT_ACTIVE_PANEL_STORAGE_KEY);
    return PROMPT_PANEL_DEFAULT_ORDER.includes(raw) ? raw : PROMPT_PANEL_DEFAULT_ORDER[0];
  } catch (error) {
    return PROMPT_PANEL_DEFAULT_ORDER[0];
  }
}

function downloadTextFile(fileName, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(input) {
  const raw = String(input || "block")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_");
  let cleaned = "";
  for (let index = 0; index < raw.length; index += 1) {
    const code = raw.charCodeAt(index);
    cleaned += code >= 32 ? raw[index] : "_";
  }
  return cleaned.slice(0, 80);
}

function bytesToBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

async function probeJsonEndpoint(url, onSuccess) {
  try {
    const response = await fetchWithTimeout(url, 3500);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json();
    return onSuccess(payload);
  } catch (error) {
    return {
      online: false,
      label: "Offline",
      detail: error.message || url,
    };
  }
}

async function probeTextEndpoint(url, onSuccess) {
  try {
    await fetchWithTimeout(url, 3500, { mode: "no-cors" });
    return onSuccess();
  } catch (error) {
    return {
      online: false,
      label: "Offline",
      detail: error.message || url,
    };
  }
}

async function fetchWithTimeout(url, timeoutMs, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export default App;





