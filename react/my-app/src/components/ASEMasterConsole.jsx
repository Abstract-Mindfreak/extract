import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  Archive,
  ArrowRightLeft,
  Box,
  BrainCircuit,
  ChevronDown,
  Code2,
  Database,
  Download,
  FileAudio,
  GitMerge,
  Key,
  Music,
  Radio,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Terminal,
  Wifi,
  ZapOff as ZapOffIcon,
} from "lucide-react";

import EntropyModulator from "./ase-variations/entropy_modulator";
import ModulatorRack from "./ase-variations/modulator_rack";
import ASEV4Infinity from "./ase-variations/ase-v4_infinity";
import ASEMonitorSupreme from "./ase-variations/ase_monitor_supreme";
import AASEMonitorUpdate from "./ase-variations/aase-monitor-update";
import DecompositionAudio, { SYNC_MODES } from "./ase-variations/decomposition-audio";
import AIOrchestratorPanel from "./ase-variations/ai-orchestrator-panel";
import GenerationEnginePanel from "./ase-variations/generation-engine-panel";
import ProducerArchiverPanel from "./ase-variations/producer-archiver-panel";
import promptLibraryService from "../services/PromptLibraryService";
import archiveDataService from "../services/ArchiveDataService";

const ASE_STORAGE_KEY = "mmss.ase.configurations.v1";
const ASE_STATE_KEY = "mmss.ase.currentState.v1";

const FORMULAS = [
  { id: "PHI_TOTAL", label: "Φ_total", formula: "Fix(Ψ -> Stack_Engine ∘ T_Ψ)", desc: "Recursive self-optimization" },
  { id: "ENTROPY", label: "Entropy H(p,c)", formula: "(p * log(1/p)) + (c * exp(D_f / R_T))", desc: "Order and chaos balance" },
  { id: "GRAVITY", label: "Quantum Grav", formula: "∫ (Freq_Hop * Anti_Grid) dt", desc: "Gravity inversion layer" },
  { id: "DENSITY", label: "Field Density", formula: "∇ · (Ψ(G) ⊗ R_T) = ∂Φ/∂t", desc: "Spectral density map" },
];

const LOGIC_STACKS = {
  basic: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT"],
  extended: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT", "Ψ_RECUR", "Σ_SYNTH"],
  supreme: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT", "Ψ_RECUR", "Σ_SYNTH", "∇_DENSITY", "↦_MAP"],
};

const LFE_MODES = ["AMBIENT", "COLLAPSE", "DRAMA_PEAK", "META_FRACTAL"];
const OP_MODES = ["CONVERGE", "DIVERT", "ANNIHILATE", "PHASE_SHIFT"];

const ASE_VARIATIONS = {
  unified: {
    id: "unified",
    label: "ASE Unified Console",
    description: "Combined master console with all features",
    component: null,
  },
  entropy_modulator: {
    id: "entropy_modulator",
    label: "Entropy Modulator",
    description: "Core entropy P/C pad control",
    component: EntropyModulator,
  },
  modulator_rack: {
    id: "modulator_rack",
    label: "Modulator Rack",
    description: "Extended modulator with gravity & LFE",
    component: ModulatorRack,
  },
  ase_v4_infinity: {
    id: "ase_v4_infinity",
    label: "ASE v4 Infinity",
    description: "Advanced v4 with Phi-Sync",
    component: ASEV4Infinity,
  },
  ase_monitor_supreme: {
    id: "ase_monitor_supreme",
    label: "ASE Monitor Supreme",
    description: "Ultimate monitoring console",
    component: ASEMonitorSupreme,
  },
  aase_monitor_update: {
    id: "aase_monitor_update",
    label: "AASE Monitor Update",
    description: "Updated omega monitoring with formulas",
    component: AASEMonitorUpdate,
  },
  decomposition_audio: {
    id: "decomposition_audio",
    label: "Audio Decomposer",
    description: "Real-time audio spectral analysis with sync",
    component: DecompositionAudio,
  },
  ai_orchestrator: {
    id: "ai_orchestrator",
    label: "AI Orchestrator",
    description: "Mistral AI integration with rule generation",
    component: AIOrchestratorPanel,
  },
  generation_engine: {
    id: "generation_engine",
    label: "Generation Engine",
    description: "Python-based block generation system",
    component: GenerationEnginePanel,
  },
  producer_archiver: {
    id: "producer_archiver",
    label: "FlowMusic.app Archiver",
    description: "Multi-account music library archiver",
    component: ProducerArchiverPanel,
  },
};

const ASE_VARIATION_DETAILS = {
  entropy_modulator: {
    category: "Core",
    tip: "Базовый модуль для задания характера системы через плотность и хаос.",
    tags: ["entropy", "pad", "seed", "core"],
    controls: [
      { label: "Entropy P", tip: "Повышает собранность и каркас системы." },
      { label: "Entropy C", tip: "Добавляет управляемую нестабильность и неожиданность." },
    ],
  },
  modulator_rack: {
    category: "Extension",
    tip: "Расширяет ядро за счёт гравитации, LFE и более телесного движения.",
    tags: ["gravity", "lfe", "motion", "rack"],
    controls: [
      { label: "Gravity", tip: "Делает модуляцию тяжелее и глубже." },
      { label: "LFE Mode", tip: "Задаёт драматургию движения по низким частотам." },
    ],
  },
  ase_v4_infinity: {
    category: "Advanced",
    tip: "Нужен для более умной структуры, Phi-Sync и сложных связей между режимами.",
    tags: ["phi-sync", "v4", "advanced", "structure"],
    controls: [
      { label: "Phi Sync", tip: "Собирает режимы вокруг гармоничного ритма и пропорции." },
      { label: "Meta Key", tip: "Основной ключ сценария и вариации сборки." },
    ],
  },
  ase_monitor_supreme: {
    category: "Monitoring",
    tip: "Даёт обзор состояния движка, метрик и событий без ухода в детали каждого модуля.",
    tags: ["monitor", "telemetry", "supreme", "events"],
    controls: [
      { label: "Hyper Params", tip: "Показывают перекосы и равновесие системы." },
      { label: "Event Feed", tip: "Нужен для чтения поведения консоли в реальном времени." },
    ],
  },
  aase_monitor_update: {
    category: "Monitoring",
    tip: "Добавляет более объяснимый, формульный слой мониторинга.",
    tags: ["omega", "formula", "monitoring", "update"],
    controls: [
      { label: "Formula Overlay", tip: "Поясняет мониторинг через вычислительные связи." },
      { label: "Alert Layer", tip: "Помогает заметить нестабильность и конфликты." },
    ],
  },
  decomposition_audio: {
    category: "Audio",
    tip: "Подключает реальное аудио и спектральную синхронизацию к общей логике панели.",
    tags: ["audio", "spectral", "sync", "analysis"],
    controls: [
      { label: "Sync Mode", tip: "Выбирает схему обмена между ASE и PrismaticCore." },
      { label: "Audio Frames", tip: "Позволяют реагировать на реальные спектральные события." },
    ],
  },
  ai_orchestrator: {
    category: "AI",
    tip: "Слой Mistral для генерации правил, планов и объяснимой склейки режимов.",
    tags: ["ai", "mistral", "rules", "planning"],
    controls: [
      { label: "Rule Generation", tip: "Автоматически предлагает логику связи модулей." },
      { label: "Plan Mode", tip: "Строит схему исполнения до генерации." },
    ],
  },
  generation_engine: {
    category: "Engine",
    tip: "Исполнительный Python-слой для сборки блоков, мутаций и crossover.",
    tags: ["python", "builder", "blocks", "runtime"],
    controls: [
      { label: "Runs", tip: "Больше прогонов - больше вариантов и больше времени." },
      { label: "Mutation/Crossover", tip: "Комбинирует и развивает существующие блоки." },
    ],
  },
  producer_archiver: {
    category: "Archive",
    tip: "Служебный финальный слой для архива, манифеста и хранения происхождения сборки.",
    tags: ["archive", "manifest", "flowmusic", "backup"],
    controls: [
      { label: "Archive Scope", tip: "Выбирает, какие источники и аккаунты попадут в архив." },
      { label: "Manifest", tip: "Фиксирует происхождение итогового MMSS JSON." },
    ],
  },
};

const DEFAULT_UNIFIED_SELECTION = [
  "entropy_modulator",
  "modulator_rack",
  "ase_v4_infinity",
  "ase_monitor_supreme",
  "ai_orchestrator",
  "generation_engine",
  "producer_archiver",
];

const DEFAULT_HYPER_PARAMS = {
  purity: 0.98,
  divergence: 1.55,
  recursion: 12,
  negentropy: 0.96,
  quantumDrift: 0.0411,
  spectralDensity: 0.88,
  phaseNoise: 0.18,
  temporalRes: 1.618,
};

export default function ASEMasterConsole({ onSaveToDatabase, onSendToSequenceBuilder }) {
  const [currentVariation, setCurrentVariation] = useState("unified");
  const [showVariationMenu, setShowVariationMenu] = useState(false);
  const [selectedModeIds, setSelectedModeIds] = useState(DEFAULT_UNIFIED_SELECTION);
  const [draggedModeId, setDraggedModeId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const [entropy, setEntropy] = useState({ p: 0.965, c: 0.946 });
  const [gravity, setGravity] = useState(0.88);
  const [phase, setPhase] = useState("STABLE");
  const [lfeMode, setLfeMode] = useState("AMBIENT");
  const [phiSync, setPhiSync] = useState(true);
  const [logicStack, setLogicStack] = useState(LOGIC_STACKS.extended);
  const [metaKey, setMetaKey] = useState("Φ_KEY_0411_ALPHA");
  const [hyperParams, setHyperParams] = useState(DEFAULT_HYPER_PARAMS);
  const [opMode, setOpMode] = useState("ANNIHILATE");
  const [quantumState, setQuantumState] = useState("COLLAPSED");
  const [events, setEvents] = useState(["SYNC_LOCK_ESTABLISHED", "Φ_STREAM_INITIALIZED"]);
  const [activeTab, setActiveTab] = useState("control");
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [configName, setConfigName] = useState("");

  const [syncMode, setSyncMode] = useState(SYNC_MODES.OFF);
  const [prismaticCoreData, setPrismaticCoreData] = useState(null);
  const [aseEngineData, setASEEngineData] = useState(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);

  // Prompt Library state
  const [promptLibraryBlocks, setPromptLibraryBlocks] = useState([]);
  const [selectedPromptBlock, setSelectedPromptBlock] = useState(null);
  const [promptLibrarySearch, setPromptLibrarySearch] = useState("");
  const [promptLibraryLoaded, setPromptLibraryLoaded] = useState(false);

  // Archive data state
  const [archiveTracks, setArchiveTracks] = useState([]);
  const [selectedArchiveTrack, setSelectedArchiveTrack] = useState(null);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [archiveLoaded, setArchiveLoaded] = useState(false);
  const [archiveStats, setArchiveStats] = useState(null);

  const protocol = 1.618;

  const handleSyncChange = (newMode) => {
    setSyncMode(newMode);
    setLastSyncTimestamp(Date.now());
  };

  const handleASEDataChange = (data) => {
    setASEEngineData(data);
    if (syncMode === SYNC_MODES.ASE_TO_PRISMATIC || syncMode === SYNC_MODES.BIDIRECTIONAL) {
      setPrismaticCoreData({
        ...(prismaticCoreData || {}),
        hyperParams: data.hyperParams,
        entropy: data.entropy,
        logicStack: data.logicStack,
        metaKey: data.metaKey,
        source: "ASE",
      });
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem(ASE_STORAGE_KEY);
    if (stored) {
      try {
        setSavedConfigs(JSON.parse(stored));
      } catch (error) {
        console.error("Failed to load ASE configs:", error);
      }
    }

    const lastState = localStorage.getItem(ASE_STATE_KEY);
    if (lastState) {
      try {
        const state = JSON.parse(lastState);
        setEntropy(state.entropy || { p: 0.965, c: 0.946 });
        setGravity(state.gravity || 0.88);
        setPhase(state.phase || "STABLE");
        setLfeMode(state.lfeMode || "AMBIENT");
        setPhiSync(state.phiSync ?? true);
        setLogicStack(state.logicStack || LOGIC_STACKS.extended);
        setMetaKey(state.metaKey || "Φ_KEY_0411_ALPHA");
        setHyperParams(state.hyperParams || DEFAULT_HYPER_PARAMS);
        setOpMode(state.opMode || "ANNIHILATE");
        setQuantumState(state.quantumState || "COLLAPSED");
        setCurrentVariation(state.currentVariation || "unified");
        setSelectedModeIds(state.selectedModeIds || DEFAULT_UNIFIED_SELECTION);
      } catch (error) {
        console.error("Failed to load ASE state:", error);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      ASE_STATE_KEY,
      JSON.stringify({
        entropy,
        gravity,
        phase,
        lfeMode,
        phiSync,
        logicStack,
        metaKey,
        hyperParams,
        opMode,
        quantumState,
        currentVariation,
        selectedModeIds,
        timestamp: Date.now(),
      })
    );
  }, [entropy, gravity, phase, lfeMode, phiSync, logicStack, metaKey, hyperParams, opMode, quantumState, currentVariation, selectedModeIds]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isFullscreen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.6) {
        const nextEvent = [
          `DRIFT_CORRECTED_${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
          `PHASE_SHIFT_${(Math.random() * 100).toFixed(0)}`,
          "Φ_THRESHOLD_REACHED",
          `Φ_PULSE_${(Math.random() * 1000).toFixed(0)}`,
          "ENTROPY_HARVESTED",
          "Q_STATE_COLLAPSED",
        ];
        setEvents((prev) => [nextEvent[Math.floor(Math.random() * nextEvent.length)], ...prev].slice(0, 10));
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Load Prompt Library data - use existing blocks from state
  useEffect(() => {
    // Try to get blocks from the main app state through window bridge
    const loadPromptLibrary = async () => {
      try {
        // First try to get from the main app's prompt library state
        if (window.__MMSS_BRIDGE__) {
          const ping = await window.__MMSS_BRIDGE__.ping();
          if (ping.ok && ping.blocks > 0) {
            // Blocks exist in main app, but we can't directly access them
            // For now, we'll use a sample block for demonstration
            const sampleBlocks = [
              {
                id: "sample_block_1",
                name: "Fractal Synthesis Engine",
                description: "Базовый движок фрактального синтеза для генерации текстур",
                category: "Synthesis",
                tags: ["fractal", "synthesis", "texture"],
                payload: {
                  type: "flowmusic.app_prompt",
                  version: "1.0",
                  data: { mode: "fractal", intensity: 0.7 }
                }
              },
              {
                id: "sample_block_2",
                name: "Spatial Diffusion",
                description: "Пространственная диффузия для создания атмосферы",
                category: "Spatial",
                tags: ["spatial", "diffusion", "atmosphere"],
                payload: {
                  type: "flowmusic.app_prompt",
                  version: "1.0",
                  data: { mode: "spatial", diffusion: 0.5 }
                }
              },
              {
                id: "sample_block_3",
                name: "Industrial Texture",
                description: "Индустриальные текстуры и noise слои",
                category: "Texture",
                tags: ["industrial", "noise", "texture"],
                payload: {
                  type: "flowmusic.app_prompt",
                  version: "1.0",
                  data: { mode: "industrial", noise: 0.8 }
                }
              }
            ];
            setPromptLibraryBlocks(sampleBlocks);
            setPromptLibraryLoaded(true);
            return;
          }
        }
        
        // Fallback to service (will return empty if no API)
        const blocks = await promptLibraryService.getBlocks();
        setPromptLibraryBlocks(blocks);
        setPromptLibraryLoaded(true);
      } catch (error) {
        console.error("Failed to load prompt library:", error);
        // Use sample blocks as fallback
        const sampleBlocks = [
          {
            id: "sample_block_1",
            name: "Fractal Synthesis Engine",
            description: "Базовый движок фрактального синтеза для генерации текстур",
            category: "Synthesis",
            tags: ["fractal", "synthesis", "texture"],
            payload: {
              type: "flowmusic.app_prompt",
              version: "1.0",
              data: { mode: "fractal", intensity: 0.7 }
            }
          }
        ];
        setPromptLibraryBlocks(sampleBlocks);
        setPromptLibraryLoaded(true);
      }
    };
    loadPromptLibrary();
  }, []);

  // Load Archive data - use sample data for demonstration
  useEffect(() => {
    const loadArchiveData = async () => {
      try {
        // Use sample tracks for demonstration
        const sampleTracks = [
          {
            id: "track_1",
            title: "Aurora Gate Session",
            accountId: "account_1",
            soundPrompt: "ethereal pads with evolving textures and spatial depth",
            audioUrl: "#",
            imageUrl: "#"
          },
          {
            id: "track_2",
            title: "Glass Orbit Experiment",
            accountId: "account_2",
            soundPrompt: "crystalline frequencies with glass-like resonance",
            audioUrl: "#",
            imageUrl: "#"
          },
          {
            id: "track_3",
            title: "Industrial Landscape",
            accountId: "account_3",
            soundPrompt: "heavy industrial textures with mechanical rhythms",
            audioUrl: "#",
            imageUrl: "#"
          },
          {
            id: "track_4",
            title: "Neural Network Drift",
            accountId: "account_4",
            soundPrompt: "neural network generated patterns with organic evolution",
            audioUrl: "#",
            imageUrl: "#"
          }
        ];
        setArchiveTracks(sampleTracks);
        setArchiveStats({ totalTracks: 4, totalBackups: 4 });
        setArchiveLoaded(true);
      } catch (error) {
        console.error("Failed to load archive data:", error);
        setArchiveLoaded(true);
      }
    };
    loadArchiveData();
  }, []);

  const currentVelocity = useMemo(
    () => (0.999 * (1 + (entropy.c - 0.5) * 0.1) * gravity).toFixed(3),
    [entropy.c, gravity]
  );

  const currentFractal = useMemo(
    () => (9.5 + entropy.p + (phase === "LATERAL" ? 1.5 : 0)).toFixed(2),
    [entropy.p, phase]
  );

  const currentNegentropy = useMemo(
    () => (0.88 - entropy.c * 0.2 + gravity * 0.1).toFixed(3),
    [entropy.c, gravity]
  );

  const selectedVariationEntries = useMemo(
    () => selectedModeIds.map((id) => ASE_VARIATIONS[id]).filter(Boolean),
    [selectedModeIds]
  );

  const unifiedConfig = useMemo(() => {
    const modeFragments = selectedVariationEntries.map((variation, index) => {
      const detail = ASE_VARIATION_DETAILS[variation.id] || {};
      const state =
        variation.id === "entropy_modulator"
          ? { entropy }
          : variation.id === "modulator_rack"
            ? { gravity, phase, lfeMode }
            : variation.id === "ase_v4_infinity"
              ? { phiSync, metaKey, logicStack }
              : variation.id === "ase_monitor_supreme" || variation.id === "aase_monitor_update"
                ? { hyperParams, opMode, quantumState }
                : variation.id === "decomposition_audio"
                  ? { syncMode, lastSyncTimestamp, linked: Boolean(aseEngineData || prismaticCoreData) }
                  : variation.id === "ai_orchestrator"
                    ? { phiSync, metaKey, ruleContext: logicStack.length }
                    : variation.id === "generation_engine"
                      ? { recursion: hyperParams.recursion, negentropy: hyperParams.negentropy }
                      : { archiveSource: "flowmusic.app", manifest: true };

      return {
        order: index + 1,
        id: variation.id,
        label: variation.label,
        category: detail.category || "module",
        description: variation.description,
        tags: detail.tags || [],
        fragment: {
          source:
            variation.id === "producer_archiver"
              ? "database"
              : variation.id === "generation_engine"
                ? "logic"
                : "hybrid",
          output: {
            engine: variation.id,
            state,
          },
        },
      };
    });

    return {
      schema: "mmss-unified-console",
      version: "1.0.0",
      locale: "ru-RU",
      ui: {
        concept: "Ableton + VST JSON configurator",
        activeVariation: currentVariation,
      },
      masterConsole: {
        name: "ASE Unified Console",
        metaKey,
        phiSync,
      },
      performance: {
        entropy,
        gravity,
        phase,
        lfeMode,
        opMode,
        quantumState,
      },
      tags: [...new Set(modeFragments.flatMap((item) => item.tags))],
      modes: modeFragments,
      mergePlan: {
        database: modeFragments.filter((item) => item.fragment.source !== "logic").map((item) => item.id),
        logic: modeFragments.filter((item) => item.fragment.source !== "database").map((item) => item.id),
        output: "Каждый режим добавляет свой JSON-фрагмент и объединяется с базой и output-логикой.",
      },
    };
  }, [
    aseEngineData,
    currentVariation,
    entropy,
    gravity,
    hyperParams,
    lastSyncTimestamp,
    lfeMode,
    logicStack,
    metaKey,
    opMode,
    phase,
    phiSync,
    prismaticCoreData,
    quantumState,
    selectedVariationEntries,
    syncMode,
  ]);

  const jsonLog = useMemo(
    () =>
      JSON.stringify(
        {
          system_state: {
            mode: opMode,
            quantum_status: quantumState,
            resonance: phiSync ? "LOCKED" : "FLUID",
            fractal_dim: (9.5 * hyperParams.negentropy).toFixed(4),
            entropy_h: (entropy.p * Math.log(1 / entropy.p) + entropy.c * Math.exp(9.5 / 2.618)).toFixed(4),
            timestamp: new Date().toISOString(),
          },
          meta_registry: {
            active_key: metaKey,
            combination_id: logicStack.join(">>"),
            protocol,
          },
          vector_modulations: {
            p: entropy.p.toFixed(8),
            c: entropy.c.toFixed(8),
            gravity: gravity.toFixed(4),
            negentropy: hyperParams.negentropy,
            drift: hyperParams.quantumDrift,
          },
          unified_modes: selectedModeIds,
          unified_config: unifiedConfig,
          events_log: events,
        },
        null,
        2
      ),
    [entropy, events, gravity, hyperParams, logicStack, metaKey, opMode, phiSync, protocol, quantumState, selectedModeIds, unifiedConfig]
  );

  const handlePadMove = useCallback((event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const client = "touches" in event ? event.touches[0] : event;
    const x = client.clientX - rect.left;
    const y = client.clientY - rect.top;
    const p = Math.max(0, Math.min(1, x / rect.width));
    const c = Math.max(0, Math.min(1, 1 - y / rect.height));
    setEntropy({ p, c });
  }, []);

  const moveStack = useCallback((index) => {
    setLogicStack((current) => {
      const next = [...current];
      const item = next.splice(index, 1)[0];
      next.push(item);
      return next;
    });
  }, []);

  const toggleUnifiedMode = useCallback((modeId) => {
    setSelectedModeIds((current) =>
      current.includes(modeId) ? current.filter((id) => id !== modeId) : [...current, modeId]
    );
  }, []);

  const reorderUnifiedMode = useCallback((fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    setSelectedModeIds((current) => {
      const next = [...current];
      const fromIndex = next.indexOf(fromId);
      const toIndex = next.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const [item] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, item);
      return next;
    });
  }, []);

  const saveConfiguration = useCallback(() => {
    if (!configName.trim()) return;

    const config = {
      id: `config_${Date.now()}`,
      name: configName,
      description: `Saved at ${new Date().toLocaleString()}`,
      state: {
        entropy,
        gravity,
        phase,
        lfeMode,
        phiSync,
        logicStack,
        metaKey,
        hyperParams,
        opMode,
        quantumState,
        currentVariation,
        selectedModeIds,
      },
      unifiedConfig,
    };

    const nextConfigs = [...savedConfigs, config];
    setSavedConfigs(nextConfigs);
    localStorage.setItem(ASE_STORAGE_KEY, JSON.stringify(nextConfigs));
    setConfigName("");
    setSelectedConfig(config.id);

    if (onSaveToDatabase) {
      onSaveToDatabase(config);
    }
  }, [
    configName,
    currentVariation,
    entropy,
    gravity,
    hyperParams,
    lfeMode,
    logicStack,
    metaKey,
    onSaveToDatabase,
    opMode,
    phase,
    phiSync,
    quantumState,
    savedConfigs,
    selectedModeIds,
    unifiedConfig,
  ]);

  const loadConfiguration = useCallback(
    (configId) => {
      const config = savedConfigs.find((item) => item.id === configId);
      if (!config?.state) return;
      setEntropy(config.state.entropy);
      setGravity(config.state.gravity);
      setPhase(config.state.phase);
      setLfeMode(config.state.lfeMode);
      setPhiSync(config.state.phiSync);
      setLogicStack(config.state.logicStack);
      setMetaKey(config.state.metaKey);
      setHyperParams(config.state.hyperParams);
      setOpMode(config.state.opMode);
      setQuantumState(config.state.quantumState);
      setCurrentVariation(config.state.currentVariation || "unified");
      setSelectedModeIds(config.state.selectedModeIds || DEFAULT_UNIFIED_SELECTION);
      setSelectedConfig(configId);
    },
    [savedConfigs]
  );

  const deleteConfiguration = useCallback(
    (configId) => {
      const nextConfigs = savedConfigs.filter((item) => item.id !== configId);
      setSavedConfigs(nextConfigs);
      localStorage.setItem(ASE_STORAGE_KEY, JSON.stringify(nextConfigs));
      if (selectedConfig === configId) {
        setSelectedConfig(null);
      }
    },
    [savedConfigs, selectedConfig]
  );

  const renderVariationIcon = () => {
    if (currentVariation === "unified") return <Music size={14} className="text-pink-500" />;
    if (currentVariation === "producer_archiver") return <Archive size={14} className="text-pink-500" />;
    if (currentVariation === "ai_orchestrator") return <BrainCircuit size={14} className="text-pink-500" />;
    if (currentVariation === "generation_engine") return <GitMerge size={14} className="text-pink-500" />;
    if (currentVariation === "decomposition_audio") return <FileAudio size={14} className="text-pink-500" />;
    return <Box size={14} />;
  };

  return (
    <div
      className={`w-full bg-[#020202] text-cyan-500 p-4 font-mono selection:bg-pink-900/30 overflow-x-hidden ${isFullscreen ? "fixed inset-0 z-[9999] min-h-screen overflow-y-auto" : "min-h-screen"}`}
    >
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${phiSync ? "bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]" : "bg-cyan-950"}`}>
              <RefreshCw size={20} className={phiSync ? "text-white" : "text-cyan-900"} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                ASE MASTER CONSOLE <span className="text-pink-500 italic">v5.UNIFIED</span>
              </h1>
              <div className="flex gap-3 text-[9px] uppercase tracking-[0.3em] text-cyan-800">
                <span>Φ-Sync: {phiSync ? "ENABLED" : "BYPASS"}</span>
                <span className="text-pink-900">/</span>
                <span>Stack: {logicStack.length} OPS</span>
                <span className="text-pink-900">/</span>
                <span>Modes: {selectedModeIds.length}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            <div className="relative">
              <button
                onClick={() => setShowVariationMenu((current) => !current)}
                className="px-4 py-1 text-[10px] font-bold border border-cyan-900 text-cyan-800 hover:text-cyan-500 hover:border-cyan-700 flex items-center gap-2 transition-all"
              >
                {renderVariationIcon()}
                {ASE_VARIATIONS[currentVariation].label}
                <ChevronDown size={12} className={`transform transition-transform ${showVariationMenu ? "rotate-180" : ""}`} />
              </button>
              {showVariationMenu ? (
                <div className="absolute top-full right-0 mt-1 bg-[#0a0a0a] border border-cyan-900 rounded-lg overflow-hidden z-50 min-w-[220px]">
                  {Object.values(ASE_VARIATIONS).map((variation) => (
                    <button
                      key={variation.id}
                      onClick={() => {
                        setCurrentVariation(variation.id);
                        setShowVariationMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[10px] transition-all ${currentVariation === variation.id ? "bg-pink-500/10 text-pink-500 border-l-2 border-pink-500" : "text-cyan-700 hover:text-cyan-500 hover:bg-cyan-950/30"}`}
                    >
                      <div className="font-bold">{variation.label}</div>
                      <div className="text-[8px] text-cyan-900 mt-0.5">{variation.description}</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {currentVariation === "decomposition_audio" ? (
              <div className="flex items-center gap-2 bg-black/40 border border-pink-900/30 rounded-lg px-3 py-1.5 mr-2">
                <span className="text-[8px] text-pink-700 font-bold uppercase">PrismaticCore Sync:</span>
                <button onClick={() => handleSyncChange(SYNC_MODES.OFF)} className={`p-1.5 rounded ${syncMode === SYNC_MODES.OFF ? "bg-gray-800 text-gray-500" : "text-cyan-900 hover:text-cyan-700"}`} title="Sync: OFF">
                  <ZapOffIcon size={12} />
                </button>
                <button onClick={() => handleSyncChange(SYNC_MODES.ASE_TO_PRISMATIC)} className={`p-1.5 rounded ${syncMode === SYNC_MODES.ASE_TO_PRISMATIC ? "bg-pink-900/50 text-pink-500" : "text-cyan-900 hover:text-cyan-700"}`} title="ASE -> PrismaticCore">
                  <ArrowRightLeft size={12} />
                </button>
                <button onClick={() => handleSyncChange(SYNC_MODES.PRISMATIC_TO_ASE)} className={`p-1.5 rounded ${syncMode === SYNC_MODES.PRISMATIC_TO_ASE ? "bg-cyan-900/50 text-cyan-500" : "text-cyan-900 hover:text-cyan-700"}`} title="PrismaticCore -> ASE">
                  <Download size={12} />
                </button>
                <button onClick={() => handleSyncChange(SYNC_MODES.BIDIRECTIONAL)} className={`p-1.5 rounded ${syncMode === SYNC_MODES.BIDIRECTIONAL ? "bg-green-900/50 text-green-500" : "text-cyan-900 hover:text-cyan-700"}`} title="Both Way Sync">
                  <Wifi size={12} />
                </button>
              </div>
            ) : null}

            {["control", "formulas", "data"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 text-[10px] font-bold border transition-all ${activeTab === tab ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800 hover:text-cyan-500"}`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setPhiSync((current) => !current)}
              className={`px-4 py-1 text-[10px] font-bold border transition-all ${phiSync ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800 hover:text-cyan-500"}`}
            >
              FORCE Φ-RESONANCE
            </button>
            <button
              onClick={() => setIsFullscreen((current) => !current)}
              className={`px-4 py-1 text-[10px] font-bold border transition-all ${isFullscreen ? "border-cyan-400 text-cyan-300 bg-cyan-500/10" : "border-cyan-900 text-cyan-800 hover:text-cyan-500"}`}
            >
              {isFullscreen ? "EXIT FULLSCREEN" : "FULLSCREEN"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === "control" ? (
            currentVariation !== "unified" ? (
              <div className="h-full">
                {currentVariation === "decomposition_audio"
                  ? React.createElement(DecompositionAudio, {
                      syncMode,
                      prismaticCoreData,
                      onSyncChange: handleSyncChange,
                      onASEDataChange: handleASEDataChange,
                    })
                  : React.createElement(ASE_VARIATIONS[currentVariation].component)}
              </div>
            ) : (
              <UnifiedRack
                configName={configName}
                currentVelocity={currentVelocity}
                currentFractal={currentFractal}
                currentNegentropy={currentNegentropy}
                deleteConfiguration={deleteConfiguration}
                entropy={entropy}
                events={events}
                gravity={gravity}
                handlePadMove={handlePadMove}
                hyperParams={hyperParams}
                jsonLog={jsonLog}
                lfeMode={lfeMode}
                loadConfiguration={loadConfiguration}
                logicStack={logicStack}
                metaKey={metaKey}
                moveStack={moveStack}
                opMode={opMode}
                phase={phase}
                phiSync={phiSync}
                quantumState={quantumState}
                saveConfiguration={saveConfiguration}
                savedConfigs={savedConfigs}
                selectedConfig={selectedConfig}
                selectedModeIds={selectedModeIds}
                selectedVariationEntries={selectedVariationEntries}
                draggedModeId={draggedModeId}
                onSendToSequenceBuilder={onSendToSequenceBuilder}
                reorderUnifiedMode={reorderUnifiedMode}
                setConfigName={setConfigName}
                setCurrentVariation={setCurrentVariation}
                setDraggedModeId={setDraggedModeId}
                setGravity={setGravity}
                setLfeMode={setLfeMode}
                setMetaKey={setMetaKey}
                setOpMode={setOpMode}
                setPhase={setPhase}
                setQuantumState={setQuantumState}
                toggleUnifiedMode={toggleUnifiedMode}
                unifiedConfig={unifiedConfig}
                promptLibraryBlocks={promptLibraryBlocks}
                selectedPromptBlock={selectedPromptBlock}
                setSelectedPromptBlock={setSelectedPromptBlock}
                promptLibrarySearch={promptLibrarySearch}
                setPromptLibrarySearch={setPromptLibrarySearch}
                promptLibraryLoaded={promptLibraryLoaded}
                archiveTracks={archiveTracks}
                selectedArchiveTrack={selectedArchiveTrack}
                setSelectedArchiveTrack={setSelectedArchiveTrack}
                archiveSearch={archiveSearch}
                setArchiveSearch={setArchiveSearch}
                archiveLoaded={archiveLoaded}
                archiveStats={archiveStats}
              />
            )
          ) : null}

          {activeTab === "formulas" ? (
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<BrainCircuit size={18} />} title="FORMULARY_REFERENCE" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                {FORMULAS.map((formula) => (
                  <div key={formula.id} className="group bg-cyan-950/10 p-4 rounded border border-cyan-900/50 hover:border-pink-500/50 transition-all">
                    <div className="text-[10px] text-pink-500 font-bold mb-2 tracking-widest">{formula.label}</div>
                    <div className="text-[11px] text-cyan-600 bg-black/40 p-2 rounded font-mono break-all mb-2">{formula.formula}</div>
                    <div className="text-[8px] text-cyan-800 uppercase">{formula.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "data" ? (
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={18} />} title="FULL_DATA_STREAM" />
              <pre className="mt-4 p-4 bg-[#050505] rounded text-[10px] font-mono text-cyan-600/80 whitespace-pre-wrap overflow-auto max-h-[60vh]">
                {jsonLog}
              </pre>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-cyan-900/20 pt-6">
          <StatBox label="Φ_TOTAL" value={(entropy.p * 1.618).toFixed(4)} />
          <StatBox label="Φ_PURITY" value={`${(hyperParams.purity * 100).toFixed(1)}%`} />
          <StatBox label="VELOCITY" value={currentVelocity} />
          <StatBox label="FRACTAL" value={currentFractal} />
          <StatBox label="NEGENTROPY" value={currentNegentropy} />
          <StatBox label="SYNC_MODE" value={phiSync ? "Φ_LOCK" : "BYPASS"} color="text-pink-500" />
        </div>
      </div>
    </div>
  );
}

function UnifiedRack({
  configName,
  currentVelocity,
  currentFractal,
  currentNegentropy,
  deleteConfiguration,
  draggedModeId,
  entropy,
  events,
  gravity,
  handlePadMove,
  hyperParams,
  jsonLog,
  lfeMode,
  loadConfiguration,
  logicStack,
  metaKey,
  moveStack,
  opMode,
  phase,
  phiSync,
  quantumState,
  saveConfiguration,
  savedConfigs,
  selectedConfig,
  selectedModeIds,
  selectedVariationEntries,
  onSendToSequenceBuilder,
  reorderUnifiedMode,
  setConfigName,
  setCurrentVariation,
  setDraggedModeId,
  setGravity,
  setLfeMode,
  setMetaKey,
  setOpMode,
  setPhase,
  setQuantumState,
  toggleUnifiedMode,
  unifiedConfig,
  promptLibraryBlocks,
  selectedPromptBlock,
  setSelectedPromptBlock,
  promptLibrarySearch,
  setPromptLibrarySearch,
  promptLibraryLoaded,
  archiveTracks,
  selectedArchiveTrack,
  setSelectedArchiveTrack,
  archiveSearch,
  setArchiveSearch,
  archiveLoaded,
  archiveStats,
}) {
  const [moduleQuery, setModuleQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [showJsonPreview, setShowJsonPreview] = useState(true);
  const [widgetLayout, setWidgetLayout] = useState([
    { id: "stats", collapsed: false, order: 0 },
    { id: "module_library", collapsed: false, order: 1 },
    { id: "pipeline", collapsed: false, order: 2 },
    { id: "entropy_pad", collapsed: false, order: 3 },
    { id: "quick_controls", collapsed: false, order: 4 },
    { id: "logic_meta", collapsed: false, order: 5 },
    { id: "prompt_library", collapsed: false, order: 6 },
    { id: "archive_tracks", collapsed: false, order: 7 },
    { id: "config_db", collapsed: true, order: 8 },
    { id: "json_preview", collapsed: false, order: 9 },
    { id: "event_feed", collapsed: true, order: 10 },
  ]);

  const copyUnifiedJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(unifiedConfig, null, 2));
    } catch (error) {
      console.error("Failed to copy unified config", error);
    }
  };

  const enableAllModes = () => {
    Object.keys(ASE_VARIATIONS)
      .filter((id) => id !== "unified")
      .forEach((id) => {
        if (!selectedModeIds.includes(id)) {
          toggleUnifiedMode(id);
        }
      });
  };

  const clearSelectedModes = () => {
    [...selectedModeIds].forEach((id) => toggleUnifiedMode(id));
  };

  const handleDropMode = (targetId) => {
    if (!draggedModeId) return;
    reorderUnifiedMode(draggedModeId, targetId);
    setDraggedModeId(null);
  };

  const toggleWidgetCollapse = (widgetId) => {
    setWidgetLayout(prev => prev.map(w => 
      w.id === widgetId ? { ...w, collapsed: !w.collapsed } : w
    ));
  };

  const moveWidget = (widgetId, direction) => {
    setWidgetLayout(prev => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex(w => w.id === widgetId);
      if (index < 0) return prev;
      
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= sorted.length) return prev;
      
      const newLayout = [...sorted];
      [newLayout[index], newLayout[newIndex]] = [newLayout[newIndex], newLayout[index]];
      
      return newLayout.map((w, i) => ({ ...w, order: i }));
    });
  };

  const sortedWidgets = [...widgetLayout].sort((a, b) => a.order - b.order);

  const allVariations = Object.values(ASE_VARIATIONS).filter((variation) => variation.id !== "unified");
  const filteredVariations = allVariations.filter((variation) => {
    if (showSelectedOnly && !selectedModeIds.includes(variation.id)) {
      return false;
    }

    if (!moduleQuery.trim()) {
      return true;
    }

    const detail = ASE_VARIATION_DETAILS[variation.id];
    const haystack = [
      variation.label,
      variation.description,
      detail?.category,
      detail?.tip,
      ...(detail?.tags || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(moduleQuery.trim().toLowerCase());
  });

  const pipelineSummary = selectedVariationEntries.map((variation) => variation.label).join(" -> ");
  const streamPreview = jsonLog ? jsonLog.slice(0, 220) : "";

  const Widget = ({ id, title, icon, children, actions, defaultCollapsed = false }) => {
    const widget = widgetLayout.find(w => w.id === id);
    const collapsed = widget?.collapsed ?? defaultCollapsed;
    
    return (
      <div className={`ase-widget ${collapsed ? 'is-collapsed' : ''}`}>
        <div className="ase-widget__header">
          <div className="ase-widget__header-left">
            <button 
              onClick={() => toggleWidgetCollapse(id)}
              className="ase-widget__toggle"
            >
              <ChevronDown size={14} className={collapsed ? 'rotate-270' : ''} />
            </button>
            <SectionHeader icon={icon} title={title} />
          </div>
          <div className="ase-widget__header-right">
            <button 
              onClick={() => moveWidget(id, 'up')}
              className="ase-widget__move"
              disabled={widget?.order === 0}
            >
              ↑
            </button>
            <button 
              onClick={() => moveWidget(id, 'down')}
              className="ase-widget__move"
              disabled={widget?.order === widgetLayout.length - 1}
            >
              ↓
            </button>
            {actions && <div className="ase-widget__actions">{actions}</div>}
          </div>
        </div>
        {!collapsed && <div className="ase-widget__content">{children}</div>}
      </div>
    );
  };

  return (
    <div className="ase-workbench">
      <div className="ase-workbench__hero">
        <div>
          <div className="ase-workbench__eyebrow">ASE Unified Console</div>
          <h2 className="ase-workbench__title">Единая консоль для настройки и экспорта MMSS JSON</h2>
          <p className="ase-workbench__copy">
            Виджет-система для управления модулями. Перетаскивайте виджеты ↑↓ для изменения порядка.
          </p>
        </div>
      </div>

      <div className="ase-workbench__widget-grid">
        {sortedWidgets.map(widget => {
          switch (widget.id) {
            case 'stats':
              return (
                <Widget 
                  key="stats" 
                  id="stats" 
                  title="STATS_WIDGET" 
                  icon={<Activity size={14} />}
                >
                  <div className="ase-chip-grid">
                    <MetricChip label="Модулей" value={selectedModeIds.length} />
                    <MetricChip label="Velocity" value={currentVelocity} />
                    <MetricChip label="Negentropy" value={currentNegentropy} />
                    <MetricChip label="Phi Sync" value={phiSync ? "ON" : "BYPASS"} />
                  </div>
                </Widget>
              );

            case 'module_library':
              return (
                <Widget 
                  key="module_library" 
                  id="module_library" 
                  title="MODULE_LIBRARY" 
                  icon={<Music size={14} />}
                  actions={
                    <>
                      <button onClick={enableAllModes} className="ase-ui-btn ase-ui-btn--ghost">SELECT ALL</button>
                      <button onClick={clearSelectedModes} className="ase-ui-btn ase-ui-btn--muted">CLEAR</button>
                    </>
                  }
                >
                  <div className="ase-filter-bar">
                    <input
                      type="text"
                      value={moduleQuery}
                      onChange={(event) => setModuleQuery(event.target.value)}
                      className="ase-filter-input"
                      placeholder="Поиск по названию, тегу или описанию..."
                    />
                    <label className="ase-checkbox">
                      <input
                        type="checkbox"
                        checked={showSelectedOnly}
                        onChange={(event) => setShowSelectedOnly(event.target.checked)}
                      />
                      <span>Только выбранные</span>
                    </label>
                  </div>

                  <div className="ase-module-grid custom-scrollbar" style={{ maxHeight: "300px" }}>
                    {filteredVariations.length === 0 ? (
                      <div className="ase-empty-state">Нет доступных модулей по запросу.</div>
                    ) : (
                      filteredVariations.map((variation) => {
                        const detail = ASE_VARIATION_DETAILS[variation.id];
                        const enabled = selectedModeIds.includes(variation.id);
                        return (
                          <article key={variation.id} className={`ase-module-card ${enabled ? "is-selected" : ""}`}>
                            <div className="ase-module-card__head">
                              <div>
                                <strong>{variation.label}</strong>
                                <small>{detail?.category}</small>
                              </div>
                              <input type="checkbox" checked={enabled} onChange={() => toggleUnifiedMode(variation.id)} />
                            </div>
                            <p className="ase-module-card__desc">{variation.description}</p>
                            <div className="ase-module-card__tip">{detail?.tip}</div>
                            <div className="ase-tag-row">
                              {(detail?.tags || []).map((tag) => (
                                <span key={tag}>{tag}</span>
                              ))}
                            </div>
                            <div className="ase-module-card__footer">
                              <button onClick={() => setCurrentVariation(variation.id)} className="ase-ui-btn ase-ui-btn--ghost">
                                OPEN
                              </button>
                              {enabled ? <span>#{selectedModeIds.indexOf(variation.id) + 1}</span> : <span>-</span>}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </Widget>
              );

            case 'pipeline':
              return (
                <Widget 
                  key="pipeline" 
                  id="pipeline" 
                  title="PIPELINE_RACK" 
                  icon={<GitMerge size={14} />}
                  actions={
                    <>
                      <button onClick={copyUnifiedJson} className="ase-ui-btn ase-ui-btn--ghost">COPY JSON</button>
                      <button
                        onClick={() => onSendToSequenceBuilder && onSendToSequenceBuilder(unifiedConfig)}
                        className="ase-ui-btn ase-ui-btn--primary"
                      >
                        SEND TO BUILDER
                      </button>
                    </>
                  }
                >
                  <div className="ase-pipeline-list custom-scrollbar" style={{ maxHeight: "250px" }}>
                    {selectedVariationEntries.length === 0 ? (
                      <div className="ase-empty-state">Нет выбранных модулей.</div>
                    ) : (
                      selectedVariationEntries.map((variation, index) => {
                        const detail = ASE_VARIATION_DETAILS[variation.id];
                        return (
                          <div
                            key={`pipeline_${variation.id}`}
                            draggable
                            onDragStart={() => setDraggedModeId(variation.id)}
                            onDragEnd={() => setDraggedModeId(null)}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={() => handleDropMode(variation.id)}
                            className={`ase-pipeline-item ${draggedModeId === variation.id ? "is-dragging" : ""}`}
                          >
                            <div className="ase-pipeline-item__order">{index + 1}</div>
                            <div className="ase-pipeline-item__body">
                              <strong>{variation.label}</strong>
                              <small>{detail?.tip}</small>
                            </div>
                            <div className="ase-pipeline-item__actions">
                              <button onClick={() => setCurrentVariation(variation.id)} className="ase-ui-btn ase-ui-btn--muted">OPEN</button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="ase-preview-line">{pipelineSummary || "Pipeline пуст"}</div>
                </Widget>
              );

            case 'entropy_pad':
              return (
                <Widget 
                  key="entropy_pad" 
                  id="entropy_pad" 
                  title="ENTROPY_PAD" 
                  icon={<Radio size={14} />}
                >
                  <div
                    className="relative w-full h-40 bg-cyan-950/10 border border-cyan-900/50 rounded-2xl cursor-crosshair overflow-hidden"
                    onMouseMove={handlePadMove}
                    onTouchMove={handlePadMove}
                  >
                    <div className="absolute inset-0 grid grid-cols-10 grid-rows-6 opacity-10 pointer-events-none">
                      {[...Array(60)].map((_, index) => <div key={index} className="border-[0.5px] border-cyan-700" />)}
                    </div>
                    <div
                      className="absolute w-5 h-5 bg-pink-500 rounded-full blur-[3px] shadow-[0_0_20px_rgba(236,72,153,1)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 pointer-events-none"
                      style={{ left: `${entropy.p * 100}%`, top: `${(1 - entropy.c) * 100}%` }}
                    />
                  </div>
                  <div className="ase-chip-grid">
                    <MetricChip label="Entropy P" value={entropy.p.toFixed(3)} />
                    <MetricChip label="Entropy C" value={entropy.c.toFixed(3)} />
                  </div>
                </Widget>
              );

            case 'quick_controls':
              return (
                <Widget 
                  key="quick_controls" 
                  id="quick_controls" 
                  title="QUICK_CONTROLS" 
                  icon={<SlidersHorizontal size={14} />}
                >
                  <div className="ase-control-stack">
                    <label className="ase-control">
                      <span>Q Gravity</span>
                      <input type="range" min="0" max="2" step="0.01" value={gravity} onChange={(event) => setGravity(parseFloat(event.target.value))} className="w-full accent-pink-500" />
                      <small>{gravity.toFixed(2)}</small>
                    </label>
                    <label className="ase-control">
                      <span>Phase</span>
                      <select value={phase} onChange={(event) => setPhase(event.target.value)} className="ase-select">
                        {["STABLE", "LATERAL"].map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                    <label className="ase-control">
                      <span>LFE Mode</span>
                      <select value={lfeMode} onChange={(event) => setLfeMode(event.target.value)} className="ase-select">
                        {LFE_MODES.map((item) => <option key={item} value={item}>{item}</option>)}
                      </select>
                    </label>
                  </div>
                </Widget>
              );

            case 'logic_meta':
              return (
                <Widget 
                  key="logic_meta" 
                  id="logic_meta" 
                  title="LOGIC_AND_META" 
                  icon={<Key size={14} />}
                >
                  <div className="ase-control-stack">
                    <label className="ase-control">
                      <span>Meta key</span>
                      <input type="text" value={metaKey} onChange={(event) => setMetaKey(event.target.value)} className="ase-filter-input" />
                    </label>
                  </div>
                  <div className="ase-chip-grid">
                    {OP_MODES.map((item) => (
                      <button key={item} onClick={() => setOpMode(item)} className={`ase-ui-btn ${opMode === item ? "ase-ui-btn--primary" : "ase-ui-btn--muted"}`}>
                        {item}
                      </button>
                    ))}
                  </div>
                </Widget>
              );

            case 'prompt_library':
              return (
                <Widget 
                  key="prompt_library" 
                  id="prompt_library" 
                  title="PROMPT_LIBRARY" 
                  icon={<Database size={14} />}
                  actions={<MetricChip label="Загружено" value={promptLibraryLoaded ? `${promptLibraryBlocks.length}` : "..."} />}
                >
                  <div className="ase-filter-bar">
                    <input
                      type="text"
                      value={promptLibrarySearch}
                      onChange={(event) => setPromptLibrarySearch(event.target.value)}
                      className="ase-filter-input"
                      placeholder="Поиск по названию или описанию..."
                    />
                  </div>

                  <div className="ase-module-grid custom-scrollbar" style={{ maxHeight: "250px" }}>
                    {!promptLibraryLoaded ? (
                      <div className="ase-empty-state">Загрузка...</div>
                    ) : promptLibraryBlocks.length === 0 ? (
                      <div className="ase-empty-state">Нет блоков.</div>
                    ) : (
                      promptLibraryBlocks
                        .filter(block =>
                          !promptLibrarySearch.trim() ||
                          block.name?.toLowerCase().includes(promptLibrarySearch.toLowerCase()) ||
                          block.description?.toLowerCase().includes(promptLibrarySearch.toLowerCase()) ||
                          block.tags?.some(tag => tag.toLowerCase().includes(promptLibrarySearch.toLowerCase()))
                        )
                        .slice(0, 6)
                        .map((block) => (
                          <article key={block.id} className={`ase-module-card ${selectedPromptBlock?.id === block.id ? "is-selected" : ""}`}>
                            <div className="ase-module-card__head">
                              <div>
                                <strong>{block.name}</strong>
                                <small>{block.category || 'General'}</small>
                              </div>
                              <button
                                onClick={() => setSelectedPromptBlock(selectedPromptBlock?.id === block.id ? null : block)}
                                className="ase-ui-btn ase-ui-btn--ghost"
                              >
                                {selectedPromptBlock?.id === block.id ? "✓" : "+"}
                              </button>
                            </div>
                            <p className="ase-module-card__desc">{block.description || "Без описания"}</p>
                            {block.tags && block.tags.length > 0 && (
                              <div className="ase-tag-row">
                                {block.tags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
                              </div>
                            )}
                          </article>
                        ))
                    )}
                  </div>
                </Widget>
              );

            case 'archive_tracks':
              return (
                <Widget 
                  key="archive_tracks" 
                  id="archive_tracks" 
                  title="ARCHIVE_TRACKS" 
                  icon={<Archive size={14} />}
                  actions={archiveStats && <MetricChip label="Всего" value={archiveStats.totalTracks || 0} />}
                >
                  <div className="ase-filter-bar">
                    <input
                      type="text"
                      value={archiveSearch}
                      onChange={(event) => setArchiveSearch(event.target.value)}
                      className="ase-filter-input"
                      placeholder="Поиск по названию или промпту..."
                    />
                  </div>

                  <div className="ase-module-grid custom-scrollbar" style={{ maxHeight: "250px" }}>
                    {!archiveLoaded ? (
                      <div className="ase-empty-state">Загрузка...</div>
                    ) : archiveTracks.length === 0 ? (
                      <div className="ase-empty-state">Нет треков.</div>
                    ) : (
                      archiveTracks
                        .filter(track =>
                          !archiveSearch.trim() ||
                          track.title?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                          track.soundPrompt?.toLowerCase().includes(archiveSearch.toLowerCase())
                        )
                        .slice(0, 6)
                        .map((track) => (
                          <article key={track.id} className={`ase-module-card ${selectedArchiveTrack?.id === track.id ? "is-selected" : ""}`}>
                            <div className="ase-module-card__head">
                              <div>
                                <strong>{track.title}</strong>
                                <small>{track.accountId || 'Unknown'}</small>
                              </div>
                              <button
                                onClick={() => setSelectedArchiveTrack(selectedArchiveTrack?.id === track.id ? null : track)}
                                className="ase-ui-btn ase-ui-btn--ghost"
                              >
                                {selectedArchiveTrack?.id === track.id ? "✓" : "+"}
                              </button>
                            </div>
                            <p className="ase-module-card__desc">
                              {track.soundPrompt?.substring(0, 60) || "Без промпта"}...
                            </p>
                          </article>
                        ))
                    )}
                  </div>
                </Widget>
              );

            case 'config_db':
              return (
                <Widget 
                  key="config_db" 
                  id="config_db" 
                  title="CONFIGURATION_DB" 
                  icon={<Database size={14} />}
                  defaultCollapsed={true}
                >
                  <div className="ase-control-stack">
                    <input
                      type="text"
                      placeholder="Название конфигурации..."
                      value={configName}
                      onChange={(event) => setConfigName(event.target.value)}
                      className="ase-filter-input"
                    />
                    <button
                      onClick={saveConfiguration}
                      disabled={!configName.trim()}
                      className="ase-ui-btn ase-ui-btn--primary"
                    >
                      <Save size={12} />
                      SAVE
                    </button>
                  </div>
                  <div className="ase-saved-list custom-scrollbar" style={{ maxHeight: "150px" }}>
                    {savedConfigs.length === 0 ? (
                      <div className="ase-empty-state">Нет сохраненных конфигураций.</div>
                    ) : (
                      savedConfigs.map((config) => (
                        <div key={config.id} className={`ase-saved-item ${selectedConfig === config.id ? "is-active" : ""}`}>
                          <button onClick={() => loadConfiguration(config.id)}>{config.name}</button>
                          <button onClick={() => deleteConfiguration(config.id)}>DELETE</button>
                        </div>
                      ))
                    )}
                  </div>
                </Widget>
              );

            case 'json_preview':
              return (
                <Widget 
                  key="json_preview" 
                  id="json_preview" 
                  title="JSON_PREVIEW" 
                  icon={<Code2 size={14} />}
                  actions={
                    <button onClick={() => setShowJsonPreview(!showJsonPreview)} className="ase-ui-btn ase-ui-btn--ghost">
                      {showJsonPreview ? "HIDE" : "SHOW"}
                    </button>
                  }
                >
                  {showJsonPreview ? (
                    <div className="ase-json-preview custom-scrollbar" style={{ maxHeight: "300px" }}>
                      <pre>{JSON.stringify(unifiedConfig, null, 2)}</pre>
                    </div>
                  ) : (
                    <div className="ase-empty-state">JSON preview скрыт</div>
                  )}
                </Widget>
              );

            case 'event_feed':
              return (
                <Widget 
                  key="event_feed" 
                  id="event_feed" 
                  title="SYSTEM_EVENT_FEED" 
                  icon={<Terminal size={14} />}
                  defaultCollapsed={true}
                >
                  <div className="ase-event-feed custom-scrollbar" style={{ maxHeight: "200px" }}>
                    {events.length === 0 ? (
                      <div className="ase-empty-state">События появятся здесь.</div>
                    ) : (
                      events.map((event, index) => (
                        <div key={`${event}_${index}`} className="ase-event-row">
                          <span>{index + 1}</span>
                          <p>{event}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="ase-preview-line">{streamPreview || "Preview stream пуст."}</div>
                </Widget>
              );

            default:
              return null;
          }
        })}
      </div>
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="bg-cyan-950/10 border border-cyan-900/40 rounded p-2">
      <div className="text-cyan-800">{label}</div>
      <div className="text-white font-bold">{value}</div>
    </div>
  );
}

function StatBox({ label, value, color = "text-cyan-500" }) {
  return (
    <div className="bg-[#050505] border border-cyan-900/30 p-3 rounded flex flex-col items-center">
      <span className="text-[8px] text-cyan-900 font-bold mb-1 uppercase tracking-tighter">{label}</span>
      <span className={`text-xs font-black ${color}`}>{value}</span>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-pink-500 pl-2 mb-2">
      <span className="text-pink-500">{icon}</span>
      <h3 className="text-[10px] font-black tracking-[0.2em] text-cyan-200 uppercase">{title}</h3>
    </div>
  );
}
