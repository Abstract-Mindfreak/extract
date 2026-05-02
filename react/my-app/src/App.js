import { useEffect, useMemo, useReducer, useState } from "react";
import "./App.css";
import AccordionSection from "./components/AccordionSection";
import ASEMasterConsole from "./components/ASEMasterConsole";
import CompactTransportBar from "./components/CompactTransportBar";
import ControlGrid from "./components/ControlGrid";
import HeaderBar from "./components/HeaderBar";
import IntentComposer from "./components/IntentComposer";
import JsonBindingsPanel from "./components/JsonBindingsPanel";
import JsonBlockEditor from "./components/JsonBlockEditor";
import JsonBlockList from "./components/JsonBlockList";
import JsonSequenceBuilder from "./components/JsonSequenceBuilder";
import MatrixEditor from "./components/MatrixEditor";
import MiniMatrixStrip from "./components/MiniMatrixStrip";
import OrbitQuickPad from "./components/OrbitQuickPad";
import PromptLogicBlocklyPanel from "./components/PromptLogicBlocklyPanel";
import PrismaticCoreDock from "./components/PrismaticCoreDock";
import SectionCard from "./components/SectionCard";
import StageCanvas from "./components/StageCanvas";
import StatusCards from "./components/StatusCards";
import TextListPanel from "./components/TextListPanel";
import {
  AUDIO_CONTROLS,
  DEFAULT_INTENT_EXAMPLE,
  GRID_COLS,
  GRID_ROWS,
  SCENES,
  TRANSPORT_CONTROLS,
  VISION_CONTROLS,
  createGrid,
  createInitialState,
} from "./mmss/config";
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
import { useAudioEngine } from "./mmss/useAudioEngine";
import { useHotkeys } from "./mmss/useHotkeys";
import { useOrbitMotion } from "./mmss/useOrbitMotion";
import { analyzeImageElement, getThemePalette } from "./mmss/utils";
import ArchivesPage from "./components/ArchivesPage";
import storageService from "./services/StorageService";

const APP_TABS = [
  { id: "performance", label: "Performance" },
  { id: "advanced", label: "Advanced" },
  { id: "prompt_library", label: "Prompt Library" },
  { id: "ase_console", label: "ASE Console" },
  { id: "archives", label: "Archives" },
];

const ORBIT_SLOT_STORAGE_KEY = "mmss.orbitQuickSlots.v1";
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
const PROMPT_LIBRARY_PANEL_META = {
  json_block_list: {
    label: "Block Library",
    title: "JsonBlockList",
    subtitle: "Searchable block catalog with filters, tags, and quick actions",
  },
  prompt_logic_blockly: {
    label: "Blockly",
    title: "PromptLogicBlocklyPanel",
    subtitle: "Visual DSL for selecting blocks/sequences and merge strategy",
  },
  json_block_editor: {
    label: "Block Editor",
    title: "JsonBlockEditor",
    subtitle: "Metadata form plus validated JSON editor with save, format, and export",
  },
  json_sequence_builder: {
    label: "Sequences",
    title: "JsonSequenceBuilder",
    subtitle: "Assemble active compositions, preview merge output, and save sequences",
  },
  json_bindings_panel: {
    label: "Bindings",
    title: "JsonBindingsPanel",
    subtitle: "4 x 4 trigger matrix for block and sequence bindings with import/export tools",
  },
};
const DEFAULT_ORBIT_SLOTS = [
  {
    id: "calm",
    label: "Calm",
    meta: "soft drift",
    values: { speed: 0.34, visualWeight: 0.52, collisionIntensity: 0.18 },
  },
  {
    id: "intense",
    label: "Intense",
    meta: "tight pull",
    values: { speed: 0.92, visualWeight: 0.84, collisionIntensity: 0.62 },
  },
  {
    id: "chaos",
    label: "Chaos",
    meta: "collision storm",
    values: { speed: 1.48, visualWeight: 0.9, collisionIntensity: 0.94 },
  },
  {
    id: "glass_orbit",
    label: "GlassOrbit",
    meta: "balanced lab",
    values: { speed: 0.64, visualWeight: 0.82, collisionIntensity: 0.45 },
  },
];

function App() {
  const [activeTab, setActiveTab] = useState("ase_console");
  const [state, dispatch] = useReducer(
    mmssReducer,
    undefined,
    () => createInitialState({ __empty: true })
  );
  const [intentText, setIntentText] = useState(DEFAULT_INTENT_EXAMPLE);
  const [orbitSlots, setOrbitSlots] = useState(loadStoredOrbitSlots);
  const [libraryReady, setLibraryReady] = useState(false);
  const [promptPanelOrder, setPromptPanelOrder] = useState(loadStoredPromptPanelOrder);
  const [activePromptPanel, setActivePromptPanel] = useState(loadStoredPromptActivePanel);
  const { initializeAudio, analyserNode } = useAudioEngine({
    initialized: state.initialized,
    audio: state.audio,
    transport: state.transport,
    grid: state.matrix.grid,
    dispatch,
  });

  useOrbitMotion({
    orbit: state.orbit,
    baseline: state.mmss.baseline,
    dispatch,
    enabled: state.orbit.enabled,
  });

  // Bridge object intentionally captures current render state.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!libraryReady) return;
    savePromptLibraryState(state.promptLibrary);
  }, [state.promptLibrary, libraryReady]);

  useEffect(() => {
    window.localStorage.setItem(ORBIT_SLOT_STORAGE_KEY, JSON.stringify(orbitSlots));
  }, [orbitSlots]);

  useEffect(() => {
    window.localStorage.setItem(PROMPT_PANEL_ORDER_STORAGE_KEY, JSON.stringify(promptPanelOrder));
  }, [promptPanelOrder]);

  useEffect(() => {
    window.localStorage.setItem(PROMPT_ACTIVE_PANEL_STORAGE_KEY, activePromptPanel);
  }, [activePromptPanel]);

  useEffect(() => {
    if (activeTab !== "prompt_library") return;
    if (state.transport.playing) {
      dispatch({ type: "toggle_playing" });
    }
    if (state.orbit.enabled) {
      dispatch({ type: "toggle_orbit", enabled: false });
    }
  }, [activeTab, state.transport.playing, state.orbit.enabled]);

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

  useHotkeys([
    {
      match: (event) => event.code === "Space",
      preventDefault: true,
      run: () => handleTogglePlaying(),
    },
    {
      match: (event) => event.code === "KeyB",
      run: () => handleCaptureBaseline("hotkey"),
    },
    {
      match: (event) => event.code === "KeyO",
      run: () => handleToggleOrbit(),
    },
    {
      match: (event) => event.code === "Digit1",
      run: () => handleSceneLoad("BASELINE"),
    },
    {
      match: (event) => event.code === "Digit2",
      run: () => handleSceneLoad("AURORA_GATE"),
    },
    {
      match: (event) => event.code === "Digit3",
      run: () => handleSceneLoad("GLASS_ORBIT"),
    },
    {
      match: (event) => event.code === "Digit4",
      run: () => handleSceneLoad("NOISE_TIDE"),
    },
  ]);

  const palette = getThemePalette(state.vision.theme);
  const themeStyle = {
    "--accent-primary": palette.primary,
    "--accent-secondary": palette.accent,
    "--panel-fill-a": palette.fillA,
    "--panel-fill-b": palette.fillB,
    "--panel-noise": palette.noise,
  };
  const sceneKeys = ["BASELINE", ...Object.keys(SCENES)];
  const effectivePlaying = state.initialized ? state.transport.playing : false;
  const statusText = buildStatusText(state);
  const transportValues = {
    bpm: state.transport.bpm,
    speed: state.orbit.speed,
    visualWeight: state.orbit.visualWeight,
    collisionIntensity: state.orbit.collisionIntensity,
  };
  const checkpointItems = state.mmss.checkpoints.map((checkpoint) => checkpoint.label);
  const selectedBlock =
    state.promptLibrary.blocks.find((block) => block.id === state.promptLibrary.selectedBlockId) || null;
  const activeOrbitPreset = orbitSlots.find((slot) =>
    ["speed", "visualWeight", "collisionIntensity"].every(
      (key) => Math.abs(slot.values[key] - state.orbit[key]) < 0.01
    )
  );
  const promptPanelIndex = useMemo(
    () =>
      promptPanelOrder.reduce((map, panelId, index) => {
        map[panelId] = index;
        return map;
      }, {}),
    [promptPanelOrder]
  );

  function launchCore() {
    initializeAudio();
    if (!state.initialized) {
      dispatch({ type: "initialize" });
      dispatch({ type: "capture_baseline", reason: "launch_sequence" });
    }
  }

  function handleCaptureBaseline(reason = "manual_capture") {
    launchCore();
    dispatch({ type: "capture_baseline", reason });
  }

  function handleRestoreBaseline() {
    launchCore();
    if (state.orbit.enabled) {
      dispatch({ type: "toggle_orbit", enabled: false });
    }
    dispatch({ type: "load_scene", sceneName: "BASELINE" });
  }

  function handleTogglePlaying() {
    if (activeTab === "prompt_library") {
      dispatch({ type: "append_log", message: "Audio is paused while Prompt Library mode is active." });
      return;
    }

    if (!state.initialized) {
      launchCore();
      return;
    }

    initializeAudio();
    dispatch({ type: "toggle_playing" });
  }

  function handleToggleOrbit() {
    launchCore();
    dispatch({ type: "toggle_orbit" });
  }

  function handleSceneLoad(sceneName) {
    launchCore();
    if (sceneName === "BASELINE" && state.orbit.enabled) {
      dispatch({ type: "toggle_orbit", enabled: false });
    }
    dispatch({ type: "load_scene", sceneName });
  }

  function handleAudioChange(key, value) {
    dispatch({ type: "set_audio_param", key, value });
  }

  function handleVisionChange(key, value) {
    dispatch({ type: "set_vision_param", key, value });
  }

  function handleTransportChange(key, value) {
    if (key === "bpm") {
      dispatch({ type: "set_transport_param", key, value });
      return;
    }
    dispatch({ type: "set_orbit_param", key, value });
  }

  function handleOrbitChange(key, value) {
    dispatch({ type: "set_orbit_param", key, value });
  }

  function handleCellPaint(column, row, value) {
    if (state.matrix.grid[column]?.[row] === value) return;
    dispatch({ type: "toggle_matrix_cell", column, row, value });
  }

  function handleApplyIntent() {
    const prompt = intentText.trim();
    if (!prompt) return;
    launchCore();
    dispatch({ type: "apply_intent", prompt });
  }

  function handleImageFile(file) {
    if (!file) return;
    launchCore();

    const reader = new FileReader();
    reader.onload = () => {
      const previewSrc = typeof reader.result === "string" ? reader.result : "";
      if (!previewSrc) return;

      const image = new Image();
      image.onload = () => {
        const analysis = analyzeImageElement(image);
        dispatch({ type: "apply_image_analysis", previewSrc, analysis });
      };
      image.src = previewSrc;
    };
    reader.readAsDataURL(file);
  }

  function handlePrismaticAutoTune() {
    if (!state.image.analysis || !state.image.previewSrc) {
      dispatch({ type: "append_log", message: "Prismatic auto tune needs a bound vision source." });
      return;
    }

    dispatch({
      type: "apply_image_analysis",
      previewSrc: state.image.previewSrc,
      analysis: state.image.analysis,
    });
    dispatch({ type: "append_log", message: "Prismatic auto tune re-applied image analysis." });
  }

  async function handleApplyImageMap(scanMode, scaleMode) {
    launchCore();
    const grid = await buildGridFromImageMap({
      previewSrc: state.image.previewSrc,
      analysis: state.image.analysis,
      scanMode,
      scaleMode,
    });
    dispatch({ type: "set_matrix_grid", grid });
    if (!state.transport.playing) {
      dispatch({ type: "toggle_playing" });
    }
    dispatch({
      type: "append_log",
      message: `Image map applied to matrix (${scanMode}, ${scaleMode}).`,
    });
  }

  function handleApplyOrbitSlot(slot) {
    launchCore();
    Object.entries(slot.values).forEach(([key, value]) => {
      dispatch({ type: "set_orbit_param", key, value });
    });
    if (!state.orbit.enabled) {
      dispatch({ type: "toggle_orbit", enabled: true });
    }
  }

  function handleSaveOrbitSlot(slotId) {
    const nextSlots = orbitSlots.map((slot) =>
      slot.id === slotId
        ? {
            ...slot,
            meta: "saved preset",
            values: {
              speed: state.orbit.speed,
              visualWeight: state.orbit.visualWeight,
              collisionIntensity: state.orbit.collisionIntensity,
            },
          }
        : slot
    );
    setOrbitSlots(nextSlots);
    dispatch({ type: "append_log", message: `Orbit slot ${slotId} saved.` });
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

  return (
    <div className="app-shell compact-shell" style={themeStyle}>
      {!state.initialized ? (
        <div className="boot-overlay">
          <div className="boot-card">
            <span className="eyebrow">MMSS React Rebuild</span>
            <h1>Prismatic Core Dispatcher</h1>
            <p>
              Compact performance shell, full advanced controls, and isolated JSON prompt library
              for flowmusic.app workflow.
            </p>
            <button className="btn accent" onClick={launchCore}>
              Launch Core
            </button>
          </div>
        </div>
      ) : null}

      <HeaderBar
        level={state.mmss.level}
        scene={state.mmss.currentScene}
        visionBound={state.mmss.visionBound}
        orbitEnabled={state.orbit.enabled}
        playing={effectivePlaying}
        onCaptureBaseline={() => handleCaptureBaseline("header_button")}
        onToggleOrbit={handleToggleOrbit}
        onTogglePlaying={handleTogglePlaying}
        onFileSelect={handleImageFile}
        onLongPressCapture={handleRestoreBaseline}
      />

      <main className="compact-app-layout">
        <div className="tab-bar">
          {APP_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab-pill ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "performance" ? (
          <div className="tab-view performance-view">
            <CompactTransportBar
              playing={effectivePlaying}
              bpm={state.transport.bpm}
              volume={state.audio.master}
              currentScene={state.mmss.currentScene}
              scenes={sceneKeys}
              onTogglePlaying={handleTogglePlaying}
              onBpmChange={(value) => handleTransportChange("bpm", value)}
              onVolumeChange={(value) => handleAudioChange("master", value)}
              onSceneSelect={handleSceneLoad}
            />

            <div className="performance-grid">
              <SectionCard title="Stage Canvas" subtitle="Compact visual core with waveform and current scene">
                <StageCanvas
                  vision={state.vision}
                  scene={state.mmss.currentScene}
                  imagePreview={state.image.previewSrc}
                  imageAnalysis={state.image.analysis}
                  analyserNode={analyserNode}
                  onDropFile={handleImageFile}
                  statusText={statusText}
                />
              </SectionCard>

              <div className="performance-sidebar">
                <SectionCard title="Pattern Strip" subtitle="Always-visible pattern context without the full grid">
                  <MiniMatrixStrip
                    grid={state.matrix.grid}
                    playhead={state.transport.playhead}
                    onOpenAdvanced={() => setActiveTab("advanced")}
                  />
                </SectionCard>

                <SectionCard title="Orbit Pad" subtitle="Quick morph presets with hold-to-save slots">
                  <OrbitQuickPad
                    slots={orbitSlots}
                    activePresetId={activeOrbitPreset?.id ?? ""}
                    onApplySlot={handleApplyOrbitSlot}
                    onSaveSlot={handleSaveOrbitSlot}
                  />
                </SectionCard>

                <SectionCard title="Quick Status" subtitle="Only the essentials stay visible in performance mode">
                  <StatusCards
                    checkpoint={state.mmss.lastCheckpoint}
                    intent={state.mmss.lastIntent}
                    orbitSpeed={state.orbit.speed}
                    contrast={state.image.analysis?.contrast ?? state.vision.depth}
                  />
                </SectionCard>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "advanced" ? (
          <div className="tab-view advanced-view">
            <div className="advanced-grid">
              <div className="advanced-main">
                <SectionCard title="Full Matrix Editor" subtitle="Detailed transport editing and stage monitoring">
                  <StageCanvas
                    vision={state.vision}
                    scene={state.mmss.currentScene}
                    imagePreview={state.image.previewSrc}
                    imageAnalysis={state.image.analysis}
                    analyserNode={analyserNode}
                    onDropFile={handleImageFile}
                    statusText={statusText}
                  />
                  <div className="advanced-spacer" />
                  <MatrixEditor
                    grid={state.matrix.grid}
                    playhead={state.transport.playhead}
                    onCellPaint={handleCellPaint}
                  />
                </SectionCard>
              </div>

              <div className="advanced-side">
                <AccordionSection
                  title="Audio Engine Panel"
                  subtitle="Master volume plus the full prismatic voice controls"
                  defaultOpen
                >
                  <ControlGrid controls={AUDIO_CONTROLS} values={state.audio} onChange={handleAudioChange} />
                </AccordionSection>

                <AccordionSection
                  title="Orbit Motion Panel"
                  subtitle="Transport bar details, orbit blending, and quick preset morphing"
                >
                  <ControlGrid
                    controls={TRANSPORT_CONTROLS}
                    values={transportValues}
                    onChange={handleTransportChange}
                  />
                  <div className="advanced-spacer compact" />
                  <OrbitQuickPad
                    slots={orbitSlots}
                    activePresetId={activeOrbitPreset?.id ?? ""}
                    onApplySlot={handleApplyOrbitSlot}
                    onSaveSlot={handleSaveOrbitSlot}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Image Analysis Panel"
                  subtitle="Scene launcher, vision controls, and the React port of Prismatic Core dock"
                >
                  <div className="scene-grid compact">
                    {sceneKeys.map((sceneName) => (
                      <button
                        key={sceneName}
                        className={`scene-pill ${state.mmss.currentScene === sceneName ? "active" : ""}`}
                        onClick={() => handleSceneLoad(sceneName)}
                      >
                        <strong>{sceneName.replace(/_/g, " ")}</strong>
                        <span>{sceneName === "BASELINE" ? "Stored neutral state" : "Preset state"}</span>
                      </button>
                    ))}
                  </div>
                  <div className="advanced-spacer compact" />
                  <ControlGrid controls={VISION_CONTROLS} values={state.vision} onChange={handleVisionChange} />
                  <div className="advanced-spacer compact" />
                  <PrismaticCoreDock
                    audio={state.audio}
                    vision={state.vision}
                    transport={state.transport}
                    orbit={state.orbit}
                    initialized={state.initialized}
                    imagePreview={state.image.previewSrc}
                    imageAnalysis={state.image.analysis}
                    onTogglePlaying={handleTogglePlaying}
                    onFileSelect={handleImageFile}
                    onAutoTune={handlePrismaticAutoTune}
                    onAudioChange={handleAudioChange}
                    onVisionChange={handleVisionChange}
                    onTransportChange={handleTransportChange}
                    onOrbitChange={handleOrbitChange}
                    onApplyImageMap={handleApplyImageMap}
                  />
                </AccordionSection>

                <AccordionSection
                  title="Intent Panel"
                  subtitle="Prompt-to-state steering and operational feedback"
                >
                  <IntentComposer
                    value={intentText}
                    onChange={setIntentText}
                    onApply={handleApplyIntent}
                    onLoadExample={() => setIntentText(DEFAULT_INTENT_EXAMPLE)}
                  />
                  <StatusCards
                    checkpoint={state.mmss.lastCheckpoint}
                    intent={state.mmss.lastIntent}
                    orbitSpeed={state.orbit.speed}
                    contrast={state.image.analysis?.contrast ?? state.vision.depth}
                  />
                </AccordionSection>

                <AccordionSection
                  title="System Panels"
                  subtitle="Checkpoints and logs moved one click deeper instead of living on the main screen"
                >
                  <div className="prompt-two-column">
                    <SectionCard title="Checkpoints" subtitle="Captured anchors and milestones">
                      <TextListPanel
                        className="checkpoint-list"
                        items={checkpointItems}
                        emptyText="No checkpoints yet."
                      />
                    </SectionCard>
                    <SectionCard title="System Log" subtitle="Recent orchestration events">
                      <TextListPanel
                        className="log-list"
                        items={state.mmss.logs}
                        emptyText="Logs will appear after launch."
                      />
                    </SectionCard>
                  </div>
                </AccordionSection>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "prompt_library" ? (
          <div className="tab-view prompt-library-view">
            <div className="prompt-library-shell">
              <div className="prompt-library-topbar">
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
                    Reset Panel Layout
                  </button>
                  <button onClick={() => dispatch({ type: "PROMPT_ACTIVE_COMPOSITION_CLEAR" })}>
                    Clear Active Composition
                  </button>
                </div>
              </div>

              {libraryReady ? (
                <div className="prompt-library-workbench">
                  <aside className="prompt-panel-sidebar">
                    <div className="prompt-panel-sidebar-head">
                      <strong>Sections</strong>
                      <span>
                        {state.promptLibrary.blocks.length} block(s), {state.promptLibrary.sequences.length} sequence(s)
                      </span>
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
                    <div className="prompt-panel-grid">
                  {promptPanelOrder.map((panelId) => {
                    const panelActions = (
                      <div className="panel-move-actions">
                        <button
                          onClick={() => handleMovePromptPanel(panelId, "left")}
                          disabled={(promptPanelIndex[panelId] ?? 0) % 2 === 0}
                        >
                          ←
                        </button>
                        <button
                          onClick={() => handleMovePromptPanel(panelId, "right")}
                          disabled={(promptPanelIndex[panelId] ?? 0) % 2 === 1}
                        >
                          →
                        </button>
                        <button
                          onClick={() => handleMovePromptPanel(panelId, "up")}
                          disabled={(promptPanelIndex[panelId] ?? 0) < 2}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => handleMovePromptPanel(panelId, "down")}
                          disabled={(promptPanelIndex[panelId] ?? 0) > 1}
                        >
                          ↓
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
                    Library is currently detached from audio workflow. Click <strong>Load Library</strong> to open
                    prompt panels, imports, and exports.
                  </p>
                </SectionCard>
              )}
            </div>
          </div>
        ) : null}

        {activeTab === "ase_console" ? (
          <div className="tab-view ase-console-view">
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
        ) : null}

        {activeTab === "archives" ? (
          <ArchivesPage />
        ) : null}
      </main>
    </div>
  );
}

function buildStatusText(state) {
  if (state.orbit.enabled) {
    return `Orbit active with ${state.orbit.speed.toFixed(2)}x interpolation speed and ${Math.round(
      state.orbit.collisionIntensity * 100
    )}% collision intensity.`;
  }

  if (state.image.analysis) {
    return `Vision bound with ${state.image.analysis.theme.toLowerCase()} theme and contrast ${state.image.analysis.contrast.toFixed(
      2
    )}.`;
  }

  if (state.mmss.lastIntent !== "idle") {
    return `Last intent: ${state.mmss.lastIntent}.`;
  }

  return "Capture a baseline, bind an image, or apply an intent to steer the system.";
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

async function buildGridFromImageMap({ previewSrc, analysis, scanMode, scaleMode }) {
  const fallback = createGrid();
  if (!previewSrc || scanMode === "xy") {
    return generatePatternGridFromMeta(fallback, analysis, scaleMode);
  }

  try {
    const image = await loadImage(previewSrc);
    return generatePatternGridFromImage(image, analysis, scanMode, scaleMode);
  } catch (error) {
    return generatePatternGridFromMeta(fallback, analysis, scaleMode);
  }
}

function generatePatternGridFromImage(image, analysis, scanMode, scaleMode) {
  const grid = createGrid();
  const canvas = document.createElement("canvas");
  const width = GRID_COLS;
  const height = GRID_ROWS;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;

  const modeShift = scaleMode === "Chromatic" ? 0.18 : scaleMode === "Minor" ? 0.1 : 0.14;
  const thresholdBase = scanMode === "image" ? 0.42 : 0.36;
  const contrastBoost = Number.isFinite(analysis?.contrast) ? analysis.contrast * 0.2 : 0;
  const threshold = thresholdBase - contrastBoost;

  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      const index = (row * width + col) * 4;
      const red = data[index] / 255;
      const green = data[index + 1] / 255;
      const blue = data[index + 2] / 255;
      const brightness = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const wave = (Math.sin(col * 0.45 + row * 0.38) + 1) * 0.5 * modeShift;
      const on = brightness + wave > threshold;
      grid[col][row] = on ? 1 : 0;
    }
  }

  return grid;
}

function generatePatternGridFromMeta(baseGrid, analysis, scaleMode) {
  const grid = baseGrid.map((column) => [...column]);
  const contrast = Number.isFinite(analysis?.contrast) ? analysis.contrast : 0.45;
  const symmetry = Number.isFinite(analysis?.symmetryScore) ? analysis.symmetryScore : 0.5;
  const modifier = scaleMode === "Whole Tone" ? 0.8 : scaleMode === "Blues" ? 0.62 : 0.7;

  for (let col = 0; col < GRID_COLS; col += 1) {
    const primary = Math.floor(((Math.sin(col * modifier) * 0.5 + 0.5) * (GRID_ROWS - 1)));
    const shifted = Math.floor((primary + contrast * 4 + symmetry * 2) % GRID_ROWS);
    grid[col][primary] = 1;
    grid[col][shifted] = 1;
    if (col % 4 === 0) {
      grid[col][(GRID_ROWS - 1) - primary] = 1;
    }
  }

  return grid;
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
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

function loadStoredOrbitSlots() {
  try {
    const raw = window.localStorage.getItem(ORBIT_SLOT_STORAGE_KEY);
    if (!raw) return DEFAULT_ORBIT_SLOTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_ORBIT_SLOTS;
  } catch (error) {
    return DEFAULT_ORBIT_SLOTS;
  }
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

export default App;
