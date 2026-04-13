import React, { useState, useEffect, useMemo } from "react";
import { Activity, Cpu, Zap, Database, Layers, Binary, ShieldAlert, Radio, Move, Wind, ZapOff, FlaskConical, Terminal, Code2, SlidersHorizontal, BrainCircuit, Link, GitMerge, RefreshCw, Key } from "lucide-react";

export default function MMSSMasterConfig() {
  const [protocol, setProtocol] = useState(1.618);
  const [phiSync, setPhiSync] = useState(true);
  const [logicStack, setLogicStack] = useState(["G_BASE", "Φ_DIV", "Q_GRAV", "M_SHIFT"]);
  const [metaKey, setMetaKey] = useState("Φ_KEY_0411_ALPHA");
  const [entropy, setEntropy] = useState({ p: 0.965, c: 0.946 });
  const [hyperParams, setHyperParams] = useState({
    purity: 0.98,
    divergence: 1.55,
    recursion: 12,
  });

  // Reorder Logic Stack
  const moveStack = (index: number) => {
    const newStack = [...logicStack];
    const item = newStack.splice(index, 1)[0];
    newStack.push(item);
    setLogicStack(newStack);
  };

  const jsonLog = useMemo(() => {
    return JSON.stringify({
      meta_registry: {
        active_key: metaKey,
        phi_sync: phiSync ? "LOCKED_2.618" : "FREE_FLOAT",
        combination_id: logicStack.join(">>"),
        variations_depth: Math.pow(hyperParams.recursion, logicStack.length).toExponential(2)
      },
      state_vector: {
        p: entropy.p.toFixed(4),
        c: entropy.c.toFixed(4),
        logic_sequence: logicStack
      },
      formulas: {
        phi_total: "Fix(Ψ ↦ (Stack_Engine) ∘ T_Ψ)",
        divergence: `D = lim(Δ→0) [${logicStack[0]}(x) ⊗ ${logicStack[1]}(x)]`
      }
    }, null, 2);
  }, [metaKey, phiSync, logicStack, entropy, hyperParams]);

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
          
          {/* LEFT: LOGIC STACK & MAPPING */}
          <div className="xl:col-span-3 space-y-6">
             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                <SectionHeader icon={<GitMerge size={14}/>} title="LOGIC_STACK_CHAIN" />
                <div className="space-y-2">
                   {logicStack.map((step, i) => (
                      <div 
                        key={step} 
                        onClick={() => moveStack(i)}
                        className="p-3 bg-cyan-950/10 border border-cyan-900/50 rounded flex justify-between items-center cursor-pointer hover:border-pink-500 transition-all group"
                      >
                         <span className="text-[10px] font-bold text-cyan-700">{i+1}.</span>
                         <span className="text-xs font-black group-hover:text-white">{step}</span>
                         <Layers size={12} className="text-cyan-900 group-hover:text-pink-500" />
                      </div>
                   ))}
                </div>
                <p className="text-[8px] text-cyan-900 uppercase">Click to cycle application order</p>
             </div>

             <div className="bg-black border border-cyan-900 rounded-xl p-4 space-y-4">
                <SectionHeader icon={<Key size={14}/>} title="META_REGISTRY_KEY" />
                <div className="relative">
                   <Key className="absolute right-3 top-3 text-pink-500 opacity-30" size={16} />
                   <input 
                      type="text" value={metaKey} 
                      onChange={(e) => setMetaKey(e.target.value)}
                      className="w-full bg-cyan-950/20 border border-cyan-900 p-3 text-[10px] text-pink-500 font-bold focus:border-pink-500 outline-none rounded"
                   />
                </div>
                <div className="text-[8px] text-cyan-800 leading-tight">
                   Linking current state to 1,200 indexed architectural maps. 
                   Potential variations: <span className="text-pink-700">1.04e+6</span>
                </div>
             </div>
          </div>

          {/* CENTER: 2D CORE & HYPER-MODS */}
          <div className="xl:col-span-6 space-y-6">
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
                   <HyperSlider label="η_SIGNAL_PURITY" value={hyperParams.purity} min={0.5} max={1} color="pink" onChange={(v) => setHyperParams({...hyperParams, purity: v})} />
                   <HyperSlider label="δ_LATERAL_DIV" value={hyperParams.divergence} min={1} max={4} color="cyan" onChange={(v) => setHyperParams({...hyperParams, divergence: v})} />
                   <HyperSlider label="ω_RECURSION_DEPTH" value={hyperParams.recursion} min={1} max={32} step={1} color="cyan" onChange={(v) => setHyperParams({...hyperParams, recursion: v})} />
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
    # Chain: ${logicStack.join(" -> ")}
    
    phi_factor = 1.618 if PHI_SYNC else wave_input.drift()
    
    for layer in logic_stack:
        wave_input = apply_operator(layer, wave_input, factor=phi_factor)
        wave_input.recursion_depth = ${hyperParams.recursion}
        
    # Annihilation threshold check
    if wave_input.purity < ${hyperParams.purity}:
        wave_input = wave_input.filter_annihilation()
        
    return wave_input.materialize()`}
                   </pre>
                </div>
             </div>
          </div>

          {/* RIGHT: JSON DATA STREAM */}
          <div className="xl:col-span-3">
             <div className="bg-black border border-pink-900/40 rounded-xl h-full flex flex-col shadow-[0_0_50px_rgba(236,72,153,0.02)]">
                <div className="bg-pink-950/10 p-3 border-b border-pink-900/30 flex items-center gap-2">
                  <Terminal size={14} className="text-pink-500" />
                  <span className="text-[10px] font-bold text-pink-500 uppercase tracking-widest">Master_Data_Stream</span>
                </div>
                <div className="p-4 flex-1 text-[10px] font-mono text-pink-400/70 whitespace-pre overflow-y-auto">
                   {jsonLog}
                </div>
                <div className="p-3 border-t border-pink-900/20 text-[8px] text-pink-900 flex justify-between">
                   <span>VOL: 10GB_LIMIT_SAFE</span>
                   <span>DENSITY: MAX</span>
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
