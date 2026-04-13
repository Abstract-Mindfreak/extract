import React, { useState, useEffect } from "react";
import { Activity, Cpu, Zap, Database, Layers, Binary, ShieldAlert, Radio, Move } from "lucide-react";

export default function MMSSMasterConfig() {
  const [entropy, setEntropy] = useState({ p: 0.45, c: 0.55 });
  const [isWarping, setIsWarping] = useState(false);

  const handlePadMove = (e: React.MouseEvent | React.TouchEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;
    
    const p = Math.max(0, Math.min(1, x / rect.width));
    const c = Math.max(0, Math.min(1, 1 - y / rect.height));
    
    setEntropy({ p, c });
    setIsWarping(true);
  };

  return (
    <div className="min-h-screen w-full bg-black text-cyan-400 p-6 font-mono selection:bg-cyan-900 overflow-hidden">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b-2 border-cyan-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter italic">ASE MONITOR v2</h1>
            <p className="text-cyan-700 text-sm mt-1 uppercase tracking-widest">Protocol: Φ_TOTAL_LATERAL_DIVERGENCE_0411</p>
          </div>
          <div className="text-right text-xs text-cyan-800">
            <p>ENGINE: AESTHETIC-SINGULARITY-ENGINE</p>
            <p>PHASE: {isWarping ? "LATERAL_WARP" : "STABLE_ALIGN"}</p>
          </div>
        </div>

        {/* Chaos Pad & Entropy Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-slate-950 border border-cyan-900 rounded-lg p-4 space-y-4">
            <SectionHeader icon={<Radio size={16}/>} title="ENTROPY_MODULATOR [P/C_PAD]" />
            <div 
              className="relative w-full h-48 bg-cyan-950/20 border border-cyan-900/50 rounded cursor-crosshair overflow-hidden group"
              onMouseMove={handlePadMove}
              onTouchMove={handlePadMove}
              onMouseLeave={() => setIsWarping(false)}
            >
              {/* Grid Lines */}
              <div className="absolute inset-0 grid grid-cols-10 grid-rows-6 opacity-20 pointer-events-none">
                {[...Array(60)].map((_, i) => <div key={i} className="border-[0.5px] border-cyan-800" />)}
              </div>
              
              {/* Target Dot */}
              <div 
                className="absolute w-4 h-4 bg-pink-500 rounded-full blur-[2px] shadow-[0_0_15px_rgba(236,72,153,0.8)] -translate-x-1/2 -translate-y-1/2 transition-all duration-75 pointer-events-none"
                style={{ left: `${entropy.p * 100}%`, top: `${(1 - entropy.c) * 100}%` }}
              />
              
              <div className="absolute bottom-2 right-2 text-[8px] text-cyan-900 uppercase">Interactive Chaos Mapping</div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="bg-slate-900/50 border border-cyan-900 p-4 rounded-lg flex flex-col justify-center h-full">
              <div className="text-[10px] text-pink-500 mb-4 tracking-widest uppercase font-bold">Live_Metrics</div>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-cyan-800">ORDER (p)</span>
                  <span className="text-2xl font-bold">{entropy.p.toFixed(3)}</span>
                </div>
                <div className="flex justify-between items-end">
                  <span className="text-[10px] text-cyan-800">CHAOS (c)</span>
                  <span className="text-2xl font-bold text-pink-500">{entropy.c.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Core Matrix */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Zap size={16}/>} label="V_VELOCITY" value={(0.999 * (1 + (entropy.c - 0.5) * 0.1)).toFixed(3)} />
          <StatCard icon={<Activity size={16}/>} label="D_F_FRACTAL" value={(9.5 + entropy.p).toFixed(2)} />
          <StatCard icon={<Binary size={16}/>} label="R_T_RATIO" value="2.618" />
          <StatCard icon={<ShieldAlert size={16}/>} label="NEGENTROPY" value={(0.88 - (entropy.c * 0.2)).toFixed(3)} />
        </div>

        {/* Formulas */}
        <div className="bg-slate-950 border border-cyan-900 rounded-lg overflow-hidden">
          <div className="bg-cyan-950/30 p-2 px-4 border-b border-cyan-900 flex items-center gap-2">
            <Database size={16} className="text-pink-500" />
            <span className="text-xs font-bold text-pink-500 tracking-widest uppercase">Meta_Formulary</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormulaBox 
              id="F_DIVERGENCE" 
              formula={`D(x) = lim(Δ→0) [G(x + ${entropy.p.toFixed(2)}) ⊗ Φ(x)] / R_T`} 
              desc="Lateral divergent trajectory"
            />
            <FormulaBox 
              id="H_ENTROPY" 
              formula="H(p,c) = (p * log(1/p)) + (c * exp(D_f / R_T))" 
              desc="Live Entropy Balance"
            />
          </div>
        </div>

        <div className="text-center pt-8 border-t border-cyan-900/30">
          <p className="text-[10px] text-cyan-900 tracking-[0.4em]">PROCESS_ONLY // SENSORY_INPUT_ACTIVE</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-slate-900/50 border border-cyan-900 p-3 rounded flex flex-col items-center group hover:bg-cyan-900/20 transition-all">
      <div className="text-cyan-700 mb-1 group-hover:text-pink-500 transition-colors">{icon}</div>
      <div className="text-[10px] text-cyan-800 uppercase tracking-tighter">{label}</div>
      <div className="text-lg font-bold text-cyan-100">{value}</div>
    </div>
  );
}

function FormulaBox({ id, formula, desc }) {
  return (
    <div className="group bg-black/40 p-3 rounded border border-cyan-900/50 hover:border-pink-900/50 transition-all">
      <div className="flex justify-between items-start mb-1">
        <div className="text-[10px] text-pink-500 opacity-70 tracking-widest font-bold">{id}</div>
        <div className="text-[8px] text-cyan-900 uppercase">{desc}</div>
      </div>
      <div className="text-xs sm:text-sm break-all text-cyan-200">{formula}</div>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-pink-500 pl-2">
      <span className="text-pink-500">{icon}</span>
      <h3 className="text-xs font-bold tracking-widest text-cyan-100 uppercase">{title}</h3>
    </div>
  );
}