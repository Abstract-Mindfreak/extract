import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity, Database, Layers, Radio, Move,
  Wind, ZapOff, Terminal, Code2, SlidersHorizontal, BrainCircuit,
  GitMerge, RefreshCw, Key, Save, ChevronDown, Box,
  FileAudio, Wifi, ArrowRightLeft, Download, ZapOff as ZapOffIcon,
  Archive, Music
} from "lucide-react";

// Import ASE component variations
import EntropyModulator from "./ase-variations/entropy_modulator";
import ModulatorRack from "./ase-variations/modulator_rack";
import ASEV4Infinity from "./ase-variations/ase-v4_infinity";
import ASEMonitorSupreme from "./ase-variations/ase_monitor_supreme";
import AASEMonitorUpdate from "./ase-variations/aase-monitor-update";
import DecompositionAudio, { SYNC_MODES } from "./ase-variations/decomposition-audio";
import AIOrchestratorPanel from "./ase-variations/ai-orchestrator-panel";
import GenerationEnginePanel from "./ase-variations/generation-engine-panel";
import ProducerArchiverPanel from "./ase-variations/producer-archiver-panel";

// Storage keys
const ASE_STORAGE_KEY = "mmss.ase.configurations.v1";
const ASE_STATE_KEY = "mmss.ase.currentState.v1";


// Formulas definitions (from main.tsx)
const FORMULAS = [
  { id: "Φ_T", label: "Φ_total", formula: "Fix(Ψ ↦ (Stack_Engine) ∘ T_Ψ)", desc: "Recursive self-optimization" },
  { id: "D_V", label: "Divergence", formula: "D = lim(Δ→0) [G(x) ⊗ Φ(x)] / R_T", desc: "Lateral trajectory" },
  { id: "H_E", label: "Entropy H(p,c)", formula: "(p * log(1/p)) + (c * exp(D_f / R_T))", desc: "Balance of order/chaos" },
  { id: "Q_G", label: "Quantum Grav", formula: "∫ (Freq_Hop * Anti_Grid) dt", desc: "Gravitational inversion" },
  { id: "Ψ_I", label: "Ψ_Injection", formula: "Ψ(O) = Ψ(Ψ(O)) ↦ ⇛ᶠ ∅", desc: "Meta-recursive injection" },
  { id: "Σ_M", label: "Σ_Synthesis", formula: "Σ(Word_i(t + τ_i) × Noise_i)", desc: "Signal fusion" },
  { id: "∇_D", label: "∇_Density", formula: "∇ · (Ψ(G) ⊗ R_T) = ∂η/∂t", desc: "Field density" },
  { id: "⧴_T", label: "⧴_Temporal", formula: "T(x) ↦ x ⊗ self(x) ⊢ᵠ Fix", desc: "Temporal shift" },
];

// Logic stack presets
const LOGIC_STACKS = {
  basic: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT"],
  extended: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT", "Ψ_RECUR", "Δ_COLLAPSE", "Σ_SYNTH", "H_ANNIHILATE"],
  supreme: ["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT", "Ψ_RECUR", "Δ_COLLAPSE", "Σ_SYNTH", "H_ANNIHILATE", "Ψ_INJECT", "∇_DENSITY", "⧴_DRIFT", "↦_MAP"],
};

// LFE Modes
const LFE_MODES = ["AMBIENT", "COLLAPSE", "DRAMA_PEAK", "META_FRACTAL"];

// Operation modes
const OP_MODES = ["CONVERGE", "DIVERT", "ANNIHILATE", "PHASE_SHIFT"];

// ASE Component variations
const ASE_VARIATIONS = {
  unified: {
    id: "unified",
    label: "ASE Unified Console",
    description: "Combined master console with all features",
    component: null // Uses internal unified component
  },
  entropy_modulator: {
    id: "entropy_modulator",
    label: "Entropy Modulator",
    description: "Core entropy P/C pad control",
    component: EntropyModulator
  },
  modulator_rack: {
    id: "modulator_rack",
    label: "Modulator Rack",
    description: "Extended modulator with gravity & LFE",
    component: ModulatorRack
  },
  ase_v4_infinity: {
    id: "ase_v4_infinity",
    label: "ASE v4 Infinity",
    description: "Advanced v4 with Phi-Sync",
    component: ASEV4Infinity
  },
  ase_monitor_supreme: {
    id: "ase_monitor_supreme",
    label: "ASE Monitor Supreme",
    description: "Ultimate monitoring console",
    component: ASEMonitorSupreme
  },
  aase_monitor_update: {
    id: "aase_monitor_update",
    label: "AASE Monitor Update",
    description: "Updated omega monitoring with formulas",
    component: AASEMonitorUpdate
  },
  decomposition_audio: {
    id: "decomposition_audio",
    label: "Audio Decomposer",
    description: "Real-time audio spectral analysis with sync",
    component: DecompositionAudio
  },
  ai_orchestrator: {
    id: "ai_orchestrator",
    label: "AI Orchestrator",
    description: "Mistral AI integration with rule generation",
    component: AIOrchestratorPanel
  },
  generation_engine: {
    id: "generation_engine",
    label: "Generation Engine",
    description: "Python-based block generation system",
    component: GenerationEnginePanel
  },
  producer_archiver: {
    id: "producer_archiver",
    label: "FlowMusic.app Archiver",
    description: "Multi-account music library archiver",
    component: ProducerArchiverPanel
  }
};

export default function ASEMasterConsole({ onSaveToDatabase }) {
  // Variation switcher state
  const [currentVariation, setCurrentVariation] = useState("producer_archiver");
  const [showVariationMenu, setShowVariationMenu] = useState(false);

  // Core state (from entropy_modulator)
  const [entropy, setEntropy] = useState({ p: 0.965, c: 0.946 });

  // Extended state (from modulator_rack)
  const [gravity, setGravity] = useState(0.88);
  const [phase, setPhase] = useState("STABLE");
  const [lfeMode, setLfeMode] = useState("AMBIENT");

  // Advanced state (from ase-v4)
  const protocol = 1.618;
  const [phiSync, setPhiSync] = useState(true);
  const [logicStack, setLogicStack] = useState(LOGIC_STACKS.extended);
  const [metaKey, setMetaKey] = useState("Φ_KEY_0411_ALPHA");

  // Supreme state (from ase_monitor_supreme)
  const [hyperParams, setHyperParams] = useState({
    purity: 0.98,
    divergence: 1.55,
    recursion: 12,
    negentropy: 0.96,
    quantumDrift: 0.0411,
    spectralDensity: 0.88,
    phaseNoise: 0.18,
    temporalRes: 1.618
  });
  const [opMode, setOpMode] = useState("ANNIHILATE");
  const [quantumState, setQuantumState] = useState("COLLAPSED");
  const [events, setEvents] = useState(["SYNC_LOCK_ESTABLISHED", "Φ_STREAM_INITIALIZED"]);

  // UI State
  const [activeTab, setActiveTab] = useState("control");
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [configName, setConfigName] = useState("");

  // PrismaticCore Sync State
  const [syncMode, setSyncMode] = useState(SYNC_MODES.OFF);
  const [prismaticCoreData, setPrismaticCoreData] = useState(null);
  const [aseEngineData, setASEEngineData] = useState(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);

  // Sync handlers
  const handleSyncChange = (newMode) => {
    setSyncMode(newMode);
    setLastSyncTimestamp(Date.now());
  };

  const handleASEDataChange = (data) => {
    setASEEngineData(data);
    // If bidirectional or ASE to Prismatic, update PrismaticCore data
    if (syncMode === SYNC_MODES.ASE_TO_PRISMATIC || syncMode === SYNC_MODES.BIDIRECTIONAL) {
      setPrismaticCoreData({
        ...prismaticCoreData,
        hyperParams: data.hyperParams,
        entropy: data.entropy,
        logicStack: data.logicStack,
        metaKey: data.metaKey,
        source: "ASE"
      });
    }
  };

  // Load saved configurations on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const stored = localStorage.getItem(ASE_STORAGE_KEY);
    if (stored) {
      try {
        const configs = JSON.parse(stored);
        setSavedConfigs(configs);
      } catch (e) {
        console.error("Failed to load ASE configs:", e);
      }
    }

    // Load last state
    const lastState = localStorage.getItem(ASE_STATE_KEY);
    if (lastState) {
      try {
        const state = JSON.parse(lastState);
        setEntropy(state.entropy || entropy);
        setGravity(state.gravity || gravity);
        setPhase(state.phase || phase);
        setLfeMode(state.lfeMode || lfeMode);
        setPhiSync(state.phiSync ?? phiSync);
        setLogicStack(state.logicStack || logicStack);
        setMetaKey(state.metaKey || metaKey);
        setHyperParams(state.hyperParams || hyperParams);
        setOpMode(state.opMode || opMode);
        setQuantumState(state.quantumState || quantumState);
      } catch (e) {
        console.error("Failed to load ASE state:", e);
      }
    }
  }, []);

  // Save current state periodically
  useEffect(() => {
    const state = {
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
      timestamp: Date.now()
    };
    localStorage.setItem(ASE_STATE_KEY, JSON.stringify(state));
  }, [entropy, gravity, phase, lfeMode, phiSync, logicStack, metaKey, hyperParams, opMode, quantumState]);

  // Event simulation
  useEffect(() => {
    const timer = setInterval(() => {
      if (Math.random() > 0.6) {
        const newEvents = [
          `DRIFT_CORRECTED_${Math.random().toString(16).slice(2, 6).toUpperCase()}`,
          `PHASE_SHIFT_${(Math.random() * 100).toFixed(0)}`,
          "η_THRESHOLD_REACHED",
          `Φ_PULSE_${(Math.random() * 1000).toFixed(0)}`,
          "ENTROPY_HARVESTED",
          "Q_STATE_COLLAPSED"
        ];
        const newEvent = newEvents[Math.floor(Math.random() * newEvents.length)];
        setEvents(prev => [newEvent, ...prev].slice(0, 10));
      }
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Derived values
  const currentVelocity = useMemo(() =>
    (0.999 * (1 + (entropy.c - 0.5) * 0.1) * gravity).toFixed(3),
    [entropy.c, gravity]
  );

  const currentFractal = useMemo(() =>
    (9.5 + entropy.p + (phase === "LATERAL" ? 1.5 : 0)).toFixed(2),
    [entropy.p, phase]
  );

  const currentNegentropy = useMemo(() =>
    (0.88 - (entropy.c * 0.2) + (gravity * 0.1)).toFixed(3),
    [entropy.c, gravity]
  );

  // Handlers
  const handlePadMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    const p = Math.max(0, Math.min(1, x / rect.width));
    const c = Math.max(0, Math.min(1, 1 - y / rect.height));

    setEntropy({ p, c });
  }, []);

  const moveStack = useCallback((index) => {
    const newStack = [...logicStack];
    const item = newStack.splice(index, 1)[0];
    newStack.push(item);
    setLogicStack(newStack);
  }, [logicStack]);

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
        quantumState
      }
    };

    const newConfigs = [...savedConfigs, config];
    setSavedConfigs(newConfigs);
    localStorage.setItem(ASE_STORAGE_KEY, JSON.stringify(newConfigs));
    setConfigName("");
    setSelectedConfig(config.id);

    if (onSaveToDatabase) {
      onSaveToDatabase(config);
    }
  }, [configName, savedConfigs, entropy, gravity, phase, lfeMode, phiSync, logicStack, metaKey, hyperParams, opMode, quantumState, onSaveToDatabase]);

  const loadConfiguration = useCallback((configId) => {
    const config = savedConfigs.find(c => c.id === configId);
    if (config && config.state) {
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
      setSelectedConfig(configId);
    }
  }, [savedConfigs]);

  const deleteConfiguration = useCallback((configId) => {
    const newConfigs = savedConfigs.filter(c => c.id !== configId);
    setSavedConfigs(newConfigs);
    localStorage.setItem(ASE_STORAGE_KEY, JSON.stringify(newConfigs));
    if (selectedConfig === configId) {
      setSelectedConfig(null);
    }
  }, [savedConfigs, selectedConfig]);

  // JSON log generation
  const jsonLog = useMemo(() => {
    return JSON.stringify({
      system_state: {
        mode: opMode,
        quantum_status: quantumState,
        resonance: phiSync ? "LOCKED" : "FLUID",
        fractal_dim: (9.5 * hyperParams.negentropy).toFixed(4),
        entropy_h: (entropy.p * Math.log(1 / entropy.p) + entropy.c * Math.exp(9.5 / 2.618)).toFixed(4),
        timestamp: new Date().toISOString()
      },
      meta_registry: {
        active_key: metaKey,
        combination_id: logicStack.join(">>"),
        variations_depth: Math.pow(hyperParams.recursion, logicStack.length).toExponential(6),
        protocol: protocol
      },
      vector_modulations: {
        p: entropy.p.toFixed(8),
        c: entropy.c.toFixed(8),
        gravity: gravity.toFixed(4),
        negentropy: hyperParams.negentropy,
        drift: hyperParams.quantumDrift,
        spectral: hyperParams.spectralDensity,
        phase_noise: hyperParams.phaseNoise
      },
      active_operators: logicStack.reduce((acc, op) => ({
        ...acc,
        [op]: { status: "ACTIVE", load: `${(Math.random() * 100).toFixed(1)}%` }
      }), {}),
      formula_stack: FORMULAS.reduce((acc, f) => ({ ...acc, [f.id]: f.formula }), {}),
      events_log: events
    }, null, 2);
  }, [opMode, quantumState, phiSync, hyperParams, entropy, metaKey, logicStack, protocol, gravity, events]);

  return (
    <div className="min-h-screen w-full bg-[#020202] text-cyan-500 p-4 font-mono selection:bg-pink-900/30 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${phiSync ? "bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]" : "bg-cyan-950"}`}>
              <RefreshCw size={20} className={phiSync ? "animate-spin-slow text-white" : "text-cyan-900"} />
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
                <span>Phase: {phase}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2 items-center">
            {/* Variation Switcher */}
            <div className="relative">
              <button
                onClick={() => setShowVariationMenu(!showVariationMenu)}
                className="px-4 py-1 text-[10px] font-bold border border-cyan-900 text-cyan-800 hover:text-cyan-500 hover:border-cyan-700 flex items-center gap-2 transition-all"
              >
                {currentVariation === "producer_archiver" ? <Archive size={14} className="text-pink-500" /> :
                 currentVariation === "ai_orchestrator" ? <BrainCircuit size={14} className="text-pink-500" /> :
                 currentVariation === "generation_engine" ? <GitMerge size={14} className="text-pink-500" /> :
                 currentVariation === "decomposition_audio" ? <FileAudio size={14} className="text-pink-500" /> :
                 <Box size={14} />}
                {ASE_VARIATIONS[currentVariation].label}
                <ChevronDown size={12} className={`transform transition-transform ${showVariationMenu ? 'rotate-180' : ''}`} />
              </button>
              {showVariationMenu && (
                <div className="absolute top-full right-0 mt-1 bg-[#0a0a0a] border border-cyan-900 rounded-lg overflow-hidden z-50 min-w-[200px]">
                  {Object.values(ASE_VARIATIONS).map((variation) => (
                    <button
                      key={variation.id}
                      onClick={() => {
                        setCurrentVariation(variation.id);
                        setShowVariationMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-[10px] transition-all ${
                        currentVariation === variation.id
                          ? "bg-pink-500/10 text-pink-500 border-l-2 border-pink-500"
                          : "text-cyan-700 hover:text-cyan-500 hover:bg-cyan-950/30"
                      }`}
                    >
                      <div className="font-bold">{variation.label}</div>
                      <div className="text-[8px] text-cyan-900 mt-0.5">{variation.description}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* PrismaticCore Sync Panel - Only show for audio decomposition */}
            {currentVariation === "decomposition_audio" && (
              <div className="flex items-center gap-2 bg-black/40 border border-pink-900/30 rounded-lg px-3 py-1.5 mr-2">
                <span className="text-[8px] text-pink-700 font-bold uppercase">PrismaticCore Sync:</span>
                <button
                  onClick={() => handleSyncChange(SYNC_MODES.OFF)}
                  className={`p-1.5 rounded transition-all ${syncMode === SYNC_MODES.OFF ? "bg-gray-800 text-gray-500" : "text-cyan-900 hover:text-cyan-700"}`}
                  title="Sync: OFF"
                >
                  <ZapOffIcon size={12} />
                </button>
                <button
                  onClick={() => handleSyncChange(SYNC_MODES.ASE_TO_PRISMATIC)}
                  className={`p-1.5 rounded transition-all ${syncMode === SYNC_MODES.ASE_TO_PRISMATIC ? "bg-pink-900/50 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]" : "text-cyan-900 hover:text-cyan-700"}`}
                  title="ASE → PrismaticCore"
                >
                  <ArrowRightLeft size={12} />
                </button>
                <button
                  onClick={() => handleSyncChange(SYNC_MODES.PRISMATIC_TO_ASE)}
                  className={`p-1.5 rounded transition-all ${syncMode === SYNC_MODES.PRISMATIC_TO_ASE ? "bg-cyan-900/50 text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.3)]" : "text-cyan-900 hover:text-cyan-700"}`}
                  title="PrismaticCore → ASE"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => handleSyncChange(SYNC_MODES.BIDIRECTIONAL)}
                  className={`p-1.5 rounded transition-all ${syncMode === SYNC_MODES.BIDIRECTIONAL ? "bg-green-900/50 text-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]" : "text-cyan-900 hover:text-cyan-700"}`}
                  title="Both Way Sync"
                >
                  <Wifi size={12} />
                </button>
              </div>
            )}

            {["control", "formulas", "data"].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 text-[10px] font-bold border transition-all ${
                  activeTab === tab
                    ? "border-pink-500 text-pink-500 bg-pink-500/10"
                    : "border-cyan-900 text-cyan-800 hover:text-cyan-500"
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
            <button
              onClick={() => setPhiSync(!phiSync)}
              className={`px-4 py-1 text-[10px] font-bold border transition-all ${
                phiSync ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800 hover:text-cyan-500"
              }`}
            >
              FORCE Φ-RESONANCE
            </button>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 overflow-auto p-6">
          {/* Render selected variation or unified console */}
          {currentVariation !== "unified" ? (
            <div className="h-full">
              {/* Special handling for decomposition_audio with sync props */}
              {currentVariation === "decomposition_audio" ? (
                React.createElement(DecompositionAudio, {
                  syncMode: syncMode,
                  prismaticCoreData: prismaticCoreData,
                  onSyncChange: handleSyncChange,
                  onASEDataChange: handleASEDataChange
                })
              ) : (
                React.createElement(ASE_VARIATIONS[currentVariation].component)
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
              {/* LEFT COLUMN */}
              <div className="xl:col-span-3 space-y-6">
                {/* Entropy P/C Pad */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<Radio size={14} />} title="ENTROPY_MODULATOR [P/C]" />
                  <div
                    className="relative w-full h-48 bg-cyan-950/10 border border-cyan-900/50 rounded cursor-crosshair overflow-hidden group"
                    onMouseMove={handlePadMove}
                    onTouchMove={handlePadMove}
                  >
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 opacity-10 pointer-events-none">
                      {[...Array(96)].map((_, i) => <div key={i} className="border-[0.5px] border-cyan-700" />)}
                    </div>
                    <div
                      className="absolute w-6 h-6 bg-pink-500 rounded-full blur-[4px] shadow-[0_0_20px_rgba(236,72,153,1)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 pointer-events-none"
                      style={{ left: `${entropy.p * 100}%`, top: `${(1 - entropy.c) * 100}%` }}
                    />
                    <div className="absolute top-2 left-2 text-[8px] text-cyan-800">Y: CHAOS_LEVEL</div>
                    <div className="absolute bottom-2 right-2 text-[8px] text-cyan-800">X: ORDER_DENSITY</div>
                  </div>
                  <div className="flex justify-between text-[10px] text-cyan-700">
                    <span>p: {entropy.p.toFixed(3)}</span>
                    <span className="text-pink-500">c: {entropy.c.toFixed(3)}</span>
                  </div>
                </div>

                {/* Logic Stack */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<GitMerge size={14} />} title="LOGIC_STACK_CHAIN" />
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                    {logicStack.map((step, i) => (
                      <div
                        key={step}
                        onClick={() => moveStack(i)}
                        className="p-2.5 bg-cyan-950/10 border border-cyan-900/50 rounded flex justify-between items-center cursor-pointer hover:border-pink-500 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-bold text-cyan-800">{i + 1}</span>
                          <span className="text-[11px] font-black group-hover:text-white tracking-wider">{step}</span>
                        </div>
                        <Layers size={10} className="text-cyan-900 group-hover:text-pink-500" />
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-cyan-950 flex flex-wrap gap-1">
                    {OP_MODES.map(m => (
                      <button
                        key={m}
                        onClick={() => setOpMode(m)}
                        className={`text-[8px] px-2 py-0.5 rounded border transition-colors ${
                          opMode === m ? "border-pink-500 bg-pink-500/10 text-pink-500" : "border-cyan-950 text-cyan-900 hover:text-cyan-600"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Meta Key */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<Key size={14} />} title="META_REGISTRY_KEY" />
                  <div className="relative">
                    <Key className="absolute right-3 top-3 text-pink-500 opacity-30" size={16} />
                    <input
                      type="text"
                      value={metaKey}
                      onChange={(e) => setMetaKey(e.target.value)}
                      className="w-full bg-cyan-950/20 border border-cyan-900 p-3 text-[10px] text-pink-500 font-bold focus:border-pink-500 outline-none rounded"
                    />
                  </div>
                  <div className="text-[8px] text-cyan-800 leading-tight">
                    Variations depth: <span className="text-pink-700">{Math.pow(hyperParams.recursion, logicStack.length).toExponential(2)}</span>
                  </div>
                </div>
              </div>

            {/* CENTER COLUMN */}
            <div className="xl:col-span-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Chaos Mapping */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<Move size={14} />} title="SYNAPSE_CHAOS_MAPPING" />
                  <div className="relative h-48 bg-[#050505] rounded-lg border border-cyan-900/30 overflow-hidden">
                    <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-5 pointer-events-none">
                      {[...Array(144)].map((_, i) => <div key={i} className="border-[0.5px] border-cyan-500" />)}
                    </div>
                    <div
                      className="absolute w-6 h-6 border-2 border-pink-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-100"
                      style={{ left: `${entropy.p * 100}%`, top: `${(1 - entropy.c) * 100}%` }}
                    >
                      <div className="absolute inset-0 animate-ping bg-pink-500 opacity-20 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Hyper Modulators */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-5">
                  <SectionHeader icon={<SlidersHorizontal size={14} />} title="HYPER_MODULATORS" />
                  <HyperSlider label="η_SIGNAL_PURITY" value={hyperParams.purity} min={0.5} max={1} step={0.0001} color="pink" onChange={(v) => setHyperParams({ ...hyperParams, purity: v })} />
                  <HyperSlider label="δ_LATERAL_DIV" value={hyperParams.divergence} min={1} max={5} color="cyan" onChange={(v) => setHyperParams({ ...hyperParams, divergence: v })} />
                  <HyperSlider label="ω_RECURSION_DEPTH" value={hyperParams.recursion} min={1} max={128} step={1} color="cyan" onChange={(v) => setHyperParams({ ...hyperParams, recursion: v })} />
                  <HyperSlider label="ξ_NEGENTROPY" value={hyperParams.negentropy} min={0.5} max={1} color="pink" onChange={(v) => setHyperParams({ ...hyperParams, negentropy: v })} />

                  <div className="flex gap-2 pt-2">
                    <button className="flex-1 text-[8px] border border-pink-900 py-1 hover:bg-pink-900/10 text-pink-700">INVERT_ALL</button>
                    <button className="flex-1 text-[8px] border border-cyan-900 py-1 hover:bg-cyan-900/10 text-cyan-700">CALC_PATH</button>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-cyan-950">
                    <span className="text-[9px] text-cyan-800 font-bold uppercase">Q_State:</span>
                    <button
                      onClick={() => setQuantumState(quantumState === "SUPERPOSED" ? "COLLAPSED" : "SUPERPOSED")}
                      className={`text-[9px] font-bold px-3 py-1 rounded border transition-all ${
                        quantumState === "COLLAPSED"
                          ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                          : "bg-cyan-500/10 border-cyan-500 text-cyan-500"
                      }`}
                    >
                      {quantumState}
                    </button>
                  </div>
                </div>
              </div>

              {/* Extended Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Gravity */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<Wind size={14} />} title="Q-GRAVITY" />
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    value={gravity}
                    onChange={(e) => setGravity(parseFloat(e.target.value))}
                    className="w-full h-1 bg-cyan-900 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  />
                  <div className="flex justify-between text-[10px] text-cyan-700">
                    <span>0</span>
                    <span className="text-pink-500 font-bold">{gravity.toFixed(2)}</span>
                    <span>2</span>
                  </div>
                </div>

                {/* Phase Matrix */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<ZapOff size={14} />} title="PHASE_SHIFT" />
                  <div className="grid grid-cols-2 gap-2">
                    {["STABLE", "LATERAL"].map(m => (
                      <button
                        key={m}
                        onClick={() => setPhase(m)}
                        className={`p-2 text-[10px] border transition-all ${
                          phase === m
                            ? 'bg-pink-950/40 border-pink-500 text-pink-500'
                            : 'bg-transparent border-cyan-900 text-cyan-800 hover:border-cyan-700'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* LFE Mode */}
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                  <SectionHeader icon={<Layers size={14} />} title="LFE_MODE" />
                  <select
                    value={lfeMode}
                    onChange={(e) => setLfeMode(e.target.value)}
                    className="w-full bg-cyan-950/20 border border-cyan-900 p-2 text-[10px] text-cyan-400 rounded"
                  >
                    {LFE_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Python Bridge */}
              <div className="bg-[#050505] border border-cyan-900 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-cyan-950/20 p-2 border-b border-cyan-900 flex justify-between items-center px-4">
                  <div className="flex items-center gap-2"><Code2 size={12} className="text-yellow-500" /><span className="text-[10px] font-bold text-yellow-500">Φ_SYNC_ENGINE.py</span></div>
                  <div className="text-[9px] text-cyan-800">KERNEL_HASH: 0x2.618</div>
                </div>
                <div className="p-4 text-[11px] font-mono text-cyan-700/80 leading-relaxed max-h-48 overflow-y-auto">
                  <pre>{`def process_signal(wave_input):
    # Meta_Key: ${metaKey}
    # Mode: ${opMode} | Q_State: ${quantumState}
    
    phi_factor = ${protocol} if ${phiSync ? "PHI_SYNC" : "False"} else wave_input.drift()
    
    # Execution Chain: ${logicStack.join(" >> ")}
    for op in logic_stack:
        wave_input = apply_operator(op, wave_input, factor=phi_factor)
        wave_input.recursion = ${hyperParams.recursion}
        wave_input.negentropy = ${hyperParams.negentropy}
        
    # Annihilation check at η = ${hyperParams.purity}
    if wave_input.purity < ${hyperParams.purity}:
        wave_input = wave_input.filter_annihilation()
        
    return wave_input.materialize()`}</pre>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="xl:col-span-3 space-y-6">
              {/* Data Stream */}
              <div className="bg-black border border-pink-900/40 rounded-xl flex flex-col shadow-[0_0_50px_rgba(236,72,153,0.02)] h-64">
                <div className="bg-pink-950/10 p-3 border-b border-pink-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-pink-500" />
                    <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Data_Stream</span>
                  </div>
                  <Radio size={12} className="text-pink-900 animate-pulse" />
                </div>
                <div className="p-4 flex-1 text-[10px] font-mono text-pink-400/70 whitespace-pre overflow-y-auto">
                  {jsonLog.slice(0, 800)}...
                </div>
              </div>

              {/* Event Feed */}
              <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-3 h-48 overflow-hidden">
                <SectionHeader icon={<Activity size={14} />} title="SYSTEM_EVENT_FEED" />
                <div className="space-y-1 overflow-y-auto h-full pr-2">
                  {events.map((e, i) => (
                    <div key={i} className="text-[9px] flex gap-3 border-b border-cyan-950 pb-1">
                      <span className="text-cyan-900 font-bold">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                      <span className="text-cyan-600 truncate">{e}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Configuration Manager */}
              <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                <SectionHeader icon={<Database size={14} />} title="CONFIGURATION_DB" />

                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Configuration name..."
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    className="w-full bg-cyan-950/20 border border-cyan-900 p-2 text-[10px] text-cyan-400 placeholder-cyan-800 focus:border-pink-500 outline-none rounded"
                  />
                  <button
                    onClick={saveConfiguration}
                    disabled={!configName.trim()}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[10px] font-bold border border-pink-500 text-pink-500 hover:bg-pink-500/10 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save size={12} />
                    SAVE TO DATABASE
                  </button>
                </div>

                <div className="border-t border-cyan-950 pt-2 max-h-32 overflow-y-auto">
                  <div className="text-[8px] text-cyan-800 uppercase mb-2">Saved Configurations ({savedConfigs.length})</div>
                  {savedConfigs.length === 0 ? (
                    <div className="text-[10px] text-cyan-900 italic">No saved configs</div>
                  ) : (
                    <div className="space-y-1">
                      {savedConfigs.map(config => (
                        <div
                          key={config.id}
                          className={`flex items-center justify-between p-2 rounded text-[10px] cursor-pointer transition-all ${
                            selectedConfig === config.id
                              ? "bg-pink-950/20 border border-pink-500/50"
                              : "bg-cyan-950/10 border border-cyan-900/30 hover:border-cyan-700"
                          }`}
                        >
                          <span
                            onClick={() => loadConfiguration(config.id)}
                            className="flex-1 truncate"
                          >
                            {config.name}
                          </span>
                          <button
                            onClick={() => deleteConfiguration(config.id)}
                            className="text-cyan-800 hover:text-red-500 transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "formulas" && (
          <div className="bg-black border border-cyan-900 rounded-xl p-6">
            <SectionHeader icon={<BrainCircuit size={18} />} title="FORMULARY_REFERENCE" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {FORMULAS.map(f => (
                <div key={f.id} className="group bg-cyan-950/10 p-4 rounded border border-cyan-900/50 hover:border-pink-500/50 transition-all">
                  <div className="text-[10px] text-pink-500 font-bold mb-2 tracking-widest">{f.label}</div>
                  <div className="text-[11px] text-cyan-600 bg-black/40 p-2 rounded font-mono break-all mb-2">
                    {f.formula}
                  </div>
                  <div className="text-[8px] text-cyan-800 uppercase">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "data" && (
          <div className="bg-black border border-cyan-900 rounded-xl p-6">
            <SectionHeader icon={<Terminal size={18} />} title="FULL_DATA_STREAM" />
            <pre className="mt-4 p-4 bg-[#050505] rounded text-[10px] font-mono text-cyan-600/80 whitespace-pre-wrap overflow-auto max-h-[60vh]">
              {jsonLog}
            </pre>
          </div>
        )}

        {/* BOTTOM METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-cyan-900/20 pt-6">
          <StatBox label="Φ_TOTAL" value={(entropy.p * 1.618).toFixed(4)} />
          <StatBox label="η_PURITY" value={(hyperParams.purity * 100).toFixed(1) + "%"} />
          <StatBox label="VELOCITY" value={currentVelocity} />
          <StatBox label="FRACTAL" value={currentFractal} />
          <StatBox label="NEGENTROPY" value={currentNegentropy} />
          <StatBox label="SYNC_MODE" value={phiSync ? "Φ_LOCK" : "BYPASS"} color="text-pink-500" />
        </div>
            </div>
          )}
        </div>
      </div>
    
  );
}

// Sub-components
function HyperSlider({ label, value, min, max, step = 0.01, onChange, color }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
        <span className="text-cyan-800">{label}</span>
        <span className={color === "pink" ? "text-pink-500" : "text-cyan-400"}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-1 bg-cyan-950 rounded-lg appearance-none cursor-pointer ${color === "pink" ? "accent-pink-600" : "accent-cyan-600"}`}
      />
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
