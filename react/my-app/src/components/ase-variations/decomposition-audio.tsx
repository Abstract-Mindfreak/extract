import React, { useState, useEffect, useMemo } from "react";
import { Activity, Cpu, Zap, Database, Layers, Binary, ShieldAlert, Radio, Move, Wind, ZapOff, FlaskConical, Terminal, Code2, SlidersHorizontal, BrainCircuit, Link, GitMerge, RefreshCw, Key, Search, Download, FileAudio, History } from "lucide-react";

export default function MMSSMasterConfig() {
  const [protocol, setProtocol] = useState(1.618);
  const [phiSync, setPhiSync] = useState(true);
  const [logicStack, setLogicStack] = useState(["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT", "Ψ_RECUR", "Δ_COLLAPSE", "Σ_SYNTH", "H_ANNIHILATE", "Ψ_INJECT", "∇_DENSITY", "⧴_DRIFT", "↦_MAP"]);
  const [metaKey, setMetaKey] = useState("Φ_KEY_0411_OMEGA_SUPREME");
  const [entropy, setEntropy] = useState({ p: 0.9999, c: 0.9999 });
  const [hyperParams, setHyperParams] = useState({
    purity: 0.9999,
    divergence: 2.618,
    recursion: 64,
    negentropy: 0.96,
    spectralDensity: 0.88,
    phaseNoise: 0.18,
    temporalRes: 1.618
  });
  const [opMode, setOpMode] = useState("ANNIHILATE");
  const [quantumState, setQuantumState] = useState("COLLAPSED");
  const [events, setEvents] = useState(["SYNC_LOCK_ESTABLISHED", "Φ_STREAM_INITIALIZED"]);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [spectralData, setSpectralData] = useState(new Array(32).fill(0));
  const [targetClipId, setTargetClipId] = useState("");
  const [inferredBPM, setInferredBPM] = useState(120);

  // Real-time Web Audio API Integration with Deep Heuristics
  useEffect(() => {
    if (!isVisualizing) return;

    let audioCtx: AudioContext;
    let analyser: AnalyserNode;
    let source: MediaStreamAudioSourceNode;
    let animationId: number;
    let stream: MediaStream;

    const startCapture = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const update = () => {
          analyser.getByteFrequencyData(dataArray);
          const normalizedData = Array.from(dataArray).map(v => v / 255);
          setSpectralData(normalizedData);

          // Deep Heuristic Inference Engine
          const low = normalizedData.slice(0, 4).reduce((a,b)=>a+b,0) / 4;
          const lowMid = normalizedData.slice(4, 12).reduce((a,b)=>a+b,0) / 8;
          const mid = normalizedData.slice(12, 20).reduce((a,b)=>a+b,0) / 8;
          const high = normalizedData.slice(20).reduce((a,b)=>a+b,0) / 12;
          
          const spectralFlatness = normalizedData.reduce((a,b)=>a+b,0) / normalizedData.length / (Math.max(...normalizedData) || 1);

          setHyperParams(prev => {
            const phi = phiSync ? 1.618 : 1.0;
            return {
              ...prev,
              // Divergence based on spectral flatness (more noise = more divergence)
              divergence: Number((1 + (spectralFlatness * 4 * phi)).toFixed(4)),
              // Recursion based on low-mid activity (harmonic complexity)
              recursion: Math.floor(32 + (lowMid * 96 * phi)),
              // Negentropy based on signal-to-noise ratio
              negentropy: Number((0.5 + (low * 0.5 * phi)).toFixed(4)),
              spectralDensity: Number((lowMid * 0.8 + mid * 0.2).toFixed(4)),
              phaseNoise: Number((high * 0.5).toFixed(4)),
              temporalRes: Number((1 + (low * 2.141)).toFixed(4))
            };
          });

          // Logic Stack Morphing based on frequency dominance
          if (low > 0.7 && logicStack[0] !== "G_BASE") {
            setLogicStack(prev => ["G_BASE", ...prev.filter(i => i !== "G_BASE")]);
          } else if (high > 0.6 && logicStack[0] !== "Φ_DIV") {
             setLogicStack(prev => ["Φ_DIV", ...prev.filter(i => i !== "Φ_DIV")]);
          }

          animationId = requestAnimationFrame(update);
        };

        update();
      } catch (err) {
        setIsVisualizing(false);
      }
    };

    startCapture();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (source) source.disconnect();
      if (audioCtx) audioCtx.close();
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isVisualizing, phiSync]);

  const capturedSamples = [
    { id: "96807206", title: "MMSS_ASE_EVOLUTION_STEP_v17.1", prompt: "V=0.999, D_f=9.5, experimental noise" },
    { id: "f8158f34", title: "Φ_TOTAL_LATERAL_DIVERGENCE v17.0", prompt: "Zero-point entropy, Phase_Shift_v2.0" },
    { id: "13373bb6", title: "Evolutionary Step MMSS v1.01", prompt: "Aperiodic rhythm, frequency hopping" },
    { id: "b5a02613", title: "Evolutionary Step MMSS v1.02", prompt: "Tectonic shift, granular shimmer" },
    { id: "8f9c3b7a", title: "Φ_TOTAL_MIRROR_SYNC_v3", prompt: "1.618 golden ratio timing, Z-axis" }
  ];

  const decomposeTrack = (prompt: string = "") => {
    setIsDecomposing(true);
    setTimeout(() => {
      // Logic for reverse engineering prompt/metadata
      if (prompt.includes("Phase_Shift")) setOpMode("PHASE_SHIFT");
      if (prompt.includes("V=0.999")) setHyperParams(prev => ({ ...prev, purity: 0.9999 }));
      if (prompt.includes("D_f=9.5")) setHyperParams(prev => ({ ...prev, divergence: 2.618 }));
      if (prompt.includes("frequency hopping")) setQuantumState("SUPERPOSED");
      
      setEntropy({ p: Math.random(), c: Math.random() });
      setEvents(prev => [`DECOMPOSITION_COMPLETE_${Math.random().toString(16).slice(2,6)}`, ...prev]);
      setIsDecomposing(false);
    }, 2500);
  };

  const formulas = [
    { id: "Φ_T", label: "Φ_total", formula: "Fix(Ψ ↦ META_G_Ψ ∘ T_Ψ)" },
    { id: "D_V", label: "Divergence", formula: "lim(Δ→0) [G(x + Δ) ⊗ Φ(x)] / R_T" },
    { id: "H_E", label: "Entropy H(p,c)", formula: "p·ln(1/p) + c·exp(9.5 / 2.618)" },
    { id: "Q_G", label: "Quantum Grav", formula: "∫ (Freq_Hop * Anti_Grid) dt" },
    { id: "Ψ_I", label: "Ψ_Injection", formula: "Ψ(O) = Ψ(Ψ(O)) ↦ ⇛ᶠ ∅" },
    { id: "Σ_M", label: "Σ_Synthesis", formula: "Σ(Word_i(t + τ_i) × Noise_i)" },
    { id: "∇_D", label: "∇_Density", formula: "∇ · (Ψ(G) ⊗ R_T) = ∂η/∂t" },
    { id: "⧴_T", label: "⧴_Temporal", formula: "T(x) ↦ x ⊗ self(x) ⊢ᵠ Fix" }
  ];

  const moveStack = (index: number) => {
    const newStack = [...logicStack];
    const item = newStack.splice(index, 1)[0];
    newStack.push(item);
    setLogicStack(newStack);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      const newEvent = [`DRIFT_CORRECTED_${Math.random().toString(16).slice(2,6)}`, `PHASE_SHIFT_${(Math.random()*100).toFixed(0)}`, "η_THRESHOLD_REACHED"][Math.floor(Math.random()*3)];
      setEvents(prev => [newEvent, ...prev].slice(0, 10));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const jsonLog = useMemo(() => {
    return JSON.stringify({
      system_state: {
        mode: opMode,
        quantum_status: quantumState,
        resonance: phiSync ? "LOCKED" : "FLUID",
        fractal_dim: (9.5 * hyperParams.negentropy).toFixed(4),
        entropy_h: (entropy.p * Math.log(1/entropy.p) + entropy.c * Math.exp(9.5/2.618)).toFixed(4)
      },
      meta_registry: {
        active_key: metaKey,
        combination_id: logicStack.join(">>"),
        variations_depth: Math.pow(hyperParams.recursion, logicStack.length).toExponential(6)
      },
      vector_modulations: {
        p: entropy.p.toFixed(8),
        c: entropy.c.toFixed(8),
        negentropy: hyperParams.negentropy,
        spectral: hyperParams.spectralDensity,
        phase_noise: hyperParams.phaseNoise
      },
      active_operators: logicStack.reduce((acc, op) => ({ ...acc, [op]: { status: "ACTIVE", load: `${(Math.random()*100).toFixed(1)}%` } }), {}),
      formula_stack: formulas.reduce((acc, f) => ({ ...acc, [f.id]: f.formula }), {}),
      events_log: events
    }, null, 2);
  }, [metaKey, phiSync, logicStack, entropy, hyperParams, opMode, quantumState, events]);

  return (
    <div className="min-h-screen w-full bg-[#020202] text-cyan-500 p-4 font-mono selection:bg-pink-900/30 overflow-x-hidden">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* HEADER & GLOBAL SYNC */}
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
             <div className={`p-2 rounded-full ${phiSync ? "bg-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.5)]" : "bg-cyan-950"}`}>
                <RefreshCw size={20} className={phiSync ? "animate-spin-slow text-white" : "text-cyan-900"} />
             </div>
             <div>
                <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                   ASE MASTER CONSOLE <span className="text-pink-500 italic">v4.INFINITY</span>
                </h1>
                <div className="flex gap-3 text-[9px] uppercase tracking-[0.3em] text-cyan-800">
                   <span>Φ-Sync: {phiSync ? "ENABLED" : "BYPASS"}</span>
                   <span className="text-pink-900">/</span>
                   <span>Meta_Maps: 1200_LOADED</span>
                </div>
             </div>
          </div>
          
          <div className="flex gap-2">
             <button 
                onClick={() => setPhiSync(!phiSync)}
                className={`px-4 py-1 text-[10px] font-bold border transition-all ${phiSync ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-900"}`}
             >
                FORCE Φ-RESONANCE
             </button>
          </div>
        </div>

        {/* WORKSPACE */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* LEFT: LOGIC & DECOMPOSITION */}
          <div className="xl:col-span-3 space-y-6">
             {/* DECOMPOSITION LAYER */}
             <div className="bg-black border border-pink-900 rounded-xl p-4 space-y-4 shadow-[0_0_20px_rgba(236,72,153,0.05)]">
                <SectionHeader icon={<Search size={14}/>} title="DECOMPOSITION_INTERFACE" />
                <div className="flex gap-2">
                   <input 
                      type="text"
                      placeholder="CLIP_ID / URL"
                      value={targetClipId}
                      onChange={(e) => setTargetClipId(e.target.value)}
                      className="bg-[#050505] border border-cyan-900 rounded px-3 py-1.5 text-[10px] flex-1 focus:outline-none focus:border-pink-500 text-cyan-500 placeholder:text-cyan-900"
                   />
                   <button 
                      onClick={() => decomposeTrack()}
                      disabled={isDecomposing}
                      className={`px-3 py-1.5 rounded font-black text-[9px] transition-all ${isDecomposing ? "bg-pink-900/50 text-pink-700 animate-pulse" : "bg-pink-600 text-white hover:bg-pink-500"}`}
                   >
                      {isDecomposing ? "ANALYZING..." : "DECOMPOSE"}
                   </button>
                </div>

                <div className="space-y-1 pt-2 border-t border-cyan-950">
                   <div className="flex items-center gap-2 text-[8px] text-cyan-800 font-bold mb-2 uppercase tracking-widest">
                      <History size={10}/> Captured_Samples
                   </div>
                   {capturedSamples.map(sample => (
                      <div 
                        key={sample.id}
                        onClick={() => { setTargetClipId(sample.id); decomposeTrack(sample.prompt); }}
                        className="p-2 bg-cyan-950/5 border border-cyan-950 rounded flex flex-col gap-0.5 cursor-pointer hover:border-cyan-600 transition-all group"
                      >
                         <div className="text-[9px] font-black group-hover:text-cyan-400 truncate">{sample.title}</div>
                         <div className="text-[7px] text-cyan-900 group-hover:text-cyan-700 truncate">{sample.id}</div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4 shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                <SectionHeader icon={<GitMerge size={14}/>} title="LOGIC_STACK_CHAIN" />
                <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                   {logicStack.map((step, i) => (
                      <div 
                        key={step} 
                        onClick={() => moveStack(i)}
                        className="p-2.5 bg-cyan-950/10 border border-cyan-900/50 rounded flex justify-between items-center cursor-pointer hover:border-pink-500 transition-all group"
                      >
                         <div className="flex items-center gap-3">
                            <span className="text-[9px] font-bold text-cyan-800">{i+1}</span>
                            <span className="text-[11px] font-black group-hover:text-white tracking-wider">{step}</span>
                         </div>
                         <Layers size={10} className="text-cyan-900 group-hover:text-pink-500" />
                      </div>
                   ))}
                </div>
                <div className="pt-2 border-t border-cyan-950 flex flex-wrap gap-1">
                   {["CONVERGE", "DIVERT", "ANNIHILATE", "PHASE_SHIFT"].map(m => (
                      <button 
                        key={m}
                        onClick={() => setOpMode(m)}
                        className={`text-[8px] px-2 py-0.5 rounded border transition-colors ${opMode === m ? "border-pink-500 bg-pink-500/10 text-pink-500" : "border-cyan-950 text-cyan-900 hover:text-cyan-600"}`}
                      >
                        {m}
                      </button>
                   ))}
                </div>
             </div>

             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                <SectionHeader icon={<BrainCircuit size={14}/>} title="SYSTEM_FORMULAS" />
                <div className="space-y-3">
                   {formulas.map(f => (
                      <div key={f.id} className="group">
                         <div className="text-[9px] text-pink-500 font-bold mb-1 tracking-widest">{f.label}</div>
                         <div className="text-[10px] text-cyan-700 bg-cyan-950/5 p-2 border-l border-cyan-900 font-mono break-all group-hover:text-cyan-300">
                            {f.formula}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* CENTER: 2D CORE & HYPER-MODS */}
          <div className="xl:col-span-6 space-y-6">
             {/* SPECTRAL DECOMPOSITION VISUALIZER */}
             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4 shadow-[0_0_30px_rgba(6,182,212,0.15)]">
                <div className="flex justify-between items-center">
                   <SectionHeader icon={<Wind size={14}/>} title="SPECTRAL_DECOMPOSITION_LAYER" />
                   <button 
                      onClick={() => setIsVisualizing(!isVisualizing)}
                      className={`px-4 py-1 rounded text-[9px] font-black transition-all border ${isVisualizing ? "bg-cyan-500/20 border-cyan-500 text-cyan-500 animate-pulse" : "bg-black border-cyan-900 text-cyan-900"}`}
                   >
                      {isVisualizing ? "LIVE_ANALYSIS_ACTIVE" : "START_VISUAL_DECODE"}
                   </button>
                </div>
                <div className="h-24 flex items-end gap-1 px-2 bg-[#030303] rounded border border-cyan-950/50">
                   {spectralData.map((val, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-gradient-to-t from-cyan-900 via-cyan-500 to-pink-500 transition-all duration-100"
                        style={{ height: `${val * 100}%`, opacity: isVisualizing ? 0.3 + val * 0.7 : 0.1 }}
                      />
                   ))}
                </div>
                <div className="flex justify-between text-[8px] text-cyan-900 font-bold uppercase tracking-widest px-1">
                   <span>20Hz</span>
                   <span>Φ_RESONANCE_PEAK</span>
                   <span>20kHz</span>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                   <SectionHeader icon={<Move size={14}/>} title="SYNAPSE_CHAOS_MAPPING" />
                   <div className="relative h-64 bg-[#050505] rounded-lg border border-cyan-900/30 overflow-hidden cursor-crosshair group">
                      <div className="absolute inset-0 grid grid-cols-12 grid-rows-12 opacity-5 pointer-events-none">
                         {[...Array(144)].map((_, i) => <div key={i} className="border-[0.5px] border-cyan-500" />)}
                      </div>
                      <div 
                        className="absolute w-6 h-6 border-2 border-pink-500 rounded-full -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(236,72,153,0.5)] transition-all duration-100"
                        style={{ left: `${entropy.p * 100}%`, top: `${(1-entropy.c) * 100}%` }}
                      >
                         <div className="absolute inset-0 animate-ping bg-pink-500 opacity-20 rounded-full" />
                      </div>
                      <div className="absolute bottom-2 left-2 text-[8px] text-cyan-900 uppercase">p: {entropy.p.toFixed(3)} | c: {entropy.c.toFixed(3)}</div>
                   </div>
                </div>

                <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-5">
                   <SectionHeader icon={<SlidersHorizontal size={14}/>} title="HYPER_MODULATORS" />
                   <HyperSlider label="η_SIGNAL_PURITY" value={hyperParams.purity} min={0.99} max={1} step={0.0001} color="pink" onChange={(v) => setHyperParams({...hyperParams, purity: v})} />
                   <HyperSlider label="δ_LATERAL_DIV" value={hyperParams.divergence} min={1} max={5} color="cyan" onChange={(v) => setHyperParams({...hyperParams, divergence: v})} />
                   <HyperSlider label="ω_RECURSION_DEPTH" value={hyperParams.recursion} min={1} max={128} step={1} color="cyan" onChange={(v) => setHyperParams({...hyperParams, recursion: v})} />
                   <HyperSlider label="ξ_NEGENTROPY" value={hyperParams.negentropy} min={0.5} max={1} color="pink" onChange={(v) => setHyperParams({...hyperParams, negentropy: v})} />
                   <HyperSlider label="σ_SPECTRAL_DENSITY" value={hyperParams.spectralDensity} min={0} max={1} color="pink" onChange={(v) => setHyperParams({...hyperParams, spectralDensity: v})} />
                   <HyperSlider label="θ_PHASE_NOISE" value={hyperParams.phaseNoise} min={0} max={0.5} color="cyan" onChange={(v) => setHyperParams({...hyperParams, phaseNoise: v})} />
                   <HyperSlider label="τ_TEMPORAL_RES" value={hyperParams.temporalRes} min={1} max={3.141} color="cyan" onChange={(v) => setHyperParams({...hyperParams, temporalRes: v})} />
                   
                   <div className="flex gap-2 pt-2">
                      <button className="flex-1 text-[8px] border border-pink-900 py-1 hover:bg-pink-900/10 text-pink-700">INVERT_ALL</button>
                      <button className="flex-1 text-[8px] border border-cyan-900 py-1 hover:bg-cyan-900/10 text-cyan-700">CALC_PATH</button>
                   </div>

                   <div className="flex justify-between items-center pt-2 border-t border-cyan-950">
                      <span className="text-[9px] text-cyan-800 font-bold uppercase">Q_State:</span>
                      <button 
                        onClick={() => setQuantumState(quantumState === "SUPERPOSED" ? "COLLAPSED" : "SUPERPOSED")}
                        className={`text-[9px] font-bold px-3 py-1 rounded border transition-all ${quantumState === "COLLAPSED" ? "bg-red-500/20 border-red-500 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]" : "bg-cyan-500/10 border-cyan-500 text-cyan-500"}`}
                      >
                         {quantumState}
                      </button>
                   </div>
                </div>
             </div>

             {/* PYTHON BRIDGE */}
             <div className="bg-[#050505] border border-cyan-900 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-cyan-950/20 p-2 border-b border-cyan-900 flex justify-between items-center px-4">
                   <div className="flex items-center gap-2"><Code2 size={12} className="text-yellow-500" /><span className="text-[10px] font-bold text-yellow-500">Φ_SYNC_ENGINE.py</span></div>
                   <div className="text-[9px] text-cyan-800">KERNEL_HASH: 0x2.618</div>
                </div>
                <div className="p-4 text-[11px] font-mono text-cyan-700/80 leading-relaxed max-h-48 overflow-y-auto">
                   <pre>
{`def process_signal(wave_input):
    # Meta_Key: ${metaKey}
    # Mode: ${opMode} | Q_State: ${quantumState}
    
    phi_factor = 1.618 if PHI_SYNC else wave_input.drift()
    
    # Execution Chain: ${logicStack.join(" >> ")}
    for op in logic_stack:
        wave_input = apply_operator(op, wave_input, factor=phi_factor)
        wave_input.recursion = ${hyperParams.recursion}
        wave_input.negentropy = ${hyperParams.negentropy}
        
    # Annihilation check at η = ${hyperParams.purity}
    if quantum_state == "COLLAPSED":
        wave_input = wave_input.collapse_to_eigenstate()
        
    divergence = calculate_divergence(${hyperParams.divergence})
    return wave_input.materialize(divergence)`}
                   </pre>
                </div>
             </div>
          </div>

          {/* RIGHT: DATA STREAM & STATUS FEED */}
          <div className="xl:col-span-3 space-y-6 flex flex-col h-full">
             <div className="bg-black border border-pink-900/40 rounded-xl flex-1 flex flex-col shadow-[0_0_50px_rgba(236,72,153,0.02)] min-h-0">
                <div className="bg-pink-950/10 p-3 border-b border-pink-900/30 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal size={14} className="text-pink-500" />
                    <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Master_Data_Stream</span>
                  </div>
                  <Radio size={12} className="text-pink-900 animate-pulse" />
                </div>
                <div className="p-4 flex-1 text-[10px] font-mono text-pink-400/70 whitespace-pre overflow-y-auto custom-scrollbar">
                   {jsonLog}
                </div>
             </div>

             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-3 h-48 overflow-hidden">
                <SectionHeader icon={<Activity size={14}/>} title="SYSTEM_EVENT_FEED" />
                <div className="space-y-1 overflow-y-auto h-full pr-2 custom-scrollbar">
                   {events.map((e, i) => (
                      <div key={i} className="text-[9px] flex gap-3 border-b border-cyan-950 pb-1">
                         <span className="text-cyan-900 font-bold">[{new Date().toLocaleTimeString().split(' ')[0]}]</span>
                         <span className="text-cyan-600 truncate">{e}</span>
                      </div>
                   ))}
                </div>
             </div>
          </div>
        </div>

        {/* BOTTOM METRICS */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 border-t border-cyan-900/20 pt-6">
           <StatBox label="Φ_TOTAL" value={(entropy.p * 1.618).toFixed(4)} />
           <StatBox label="η_PURITY" value={(hyperParams.purity * 100).toFixed(1) + "%"} />
           <StatBox label="STACK_VARS" value={Math.pow(12, logicStack.length)} />
           <StatBox label="RECURSION" value={hyperParams.recursion} />
           <StatBox label="SYNC_MODE" value={phiSync ? "Φ_LOCK" : "BYPASS"} color="text-pink-500" />
           <StatBox label="LATENCY" value="0.0411ms" />
        </div>
      </div>
    </div>
  );
}

function HyperSlider({ label, value, min, max, step = 0.01, onChange, color }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest">
        <span className="text-cyan-800">{label}</span>
        <span className={color === "pink" ? "text-pink-500" : "text-cyan-400"}>{value}</span>
      </div>
      <input 
        type="range" min={min} max={max} step={step} value={value}
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
