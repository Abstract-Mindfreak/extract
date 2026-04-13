import React, { useState } from "react";
import { Activity, Cpu, Zap, Database, Layers, Binary, ShieldAlert, Radio, Move, Wind, ZapOff, FlaskConical } from "lucide-react";

export default function MMSSMasterConfig() {
  const [entropy, setEntropy] = useState({ p: 0.45, c: 0.55 });
  const [gravity, setGravity] = useState(0.88);
  const [phase, setPhase] = useState("STABLE");
  const [lfeMode, setLfeMode] = useState("AMBIENT");
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

  const currentVelocity = (0.999 * (1 + (entropy.c - 0.5) * 0.1) * gravity).toFixed(3);
  const currentFractal = (9.5 + entropy.p + (phase === "LATERAL" ? 1.5 : 0)).toFixed(2);
  const currentNegentropy = (0.88 - (entropy.c * 0.2) + (gravity * 0.1)).toFixed(3);

  return (
    <div className="min-h-screen w-full bg-black text-cyan-400 p-6 font-mono selection:bg-cyan-900 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b-2 border-cyan-900 pb-4 flex justify-between items-end">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter italic flex items-center gap-3">
              <FlaskConical className="text-pink-500" /> ASE MASTER CONSOLE
            </h1>
            <p className="text-cyan-700 text-sm mt-1 uppercase tracking-widest">Protocol: Φ_TOTAL_LATERAL_DIVERGENCE_0411</p>
          </div>
          <div className="text-right text-xs text-cyan-800">
            <p>ENGINE: AESTHETIC-SINGULARITY-ENGINE</p>
            <p>STATE: {phase}_{lfeMode}</p>
          </div>
        </div>

        {/* Main Control Surface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left: Entropy Pad */}
          <div className="lg:col-span-5 bg-slate-950 border border-cyan-900 rounded-lg p-4 space-y-4">
            <SectionHeader icon={<Radio size={14}/>} title="ENTROPY_MODULATOR [P/C]" />
            <div 
              className="relative w-full h-64 bg-cyan-950/10 border border-cyan-900/50 rounded cursor-crosshair overflow-hidden group"
              onMouseMove={handlePadMove}
              onTouchMove={handlePadMove}
              onMouseLeave={() => setIsWarping(false)}
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
          </div>

          {/* Right: Modulator Rack */}
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Gravity Slider */}
            <div className="bg-slate-900/40 border border-cyan-900 p-4 rounded-lg space-y-4">
              <SectionHeader icon={<Wind size={14}/>} title="Q-GRAVITY_INVERTER" />
              <div className="space-y-6 pt-4">
                <input 
                  type="range" min="0" max="2" step="0.01" value={gravity}
                  onChange={(e) => setGravity(parseFloat(e.target.value))}
                  className="w-full h-1 bg-cyan-900 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
                <div className="flex justify-between text-[10px] text-cyan-700">
                  <span>ZERO_G</span>
                  <span className="text-pink-500 font-bold tracking-widest">{gravity.toFixed(2)}x</span>
                  <span>MAX_INV</span>
                </div>
              </div>
            </div>

            {/* Phase Matrix */}
            <div className="bg-slate-900/40 border border-cyan-900 p-4 rounded-lg space-y-4">
              <SectionHeader icon={<ZapOff size={14}/>} title="PHASE_SHIFT_MATRIX" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                {["STABLE", "LATERAL"].map(m => (
                  <button 
                    key={m} onClick={() => setPhase(m)}
                    className={`p-2 text-[10px] border transition-all ${phase === m ? 'bg-pink-950/40 border-pink-500 text-pink-500' : 'bg-transparent border-cyan-900 text-cyan-800 hover:border-cyan-700'}`}
                  >
                    {m}_SYNC
                  </button>
                ))}
              </div>
            </div>

            {/* LFE Mode Select */}
            <div className="bg-slate-900/40 border border-cyan-900 p-4 rounded-lg md:col-span-2 space-y-4">
              <SectionHeader icon={<Layers size={14}/>} title="LFE_MODE_FUSION" />
              <div className="flex gap-2 pt-2 overflow-x-auto pb-2">
                {["AMBIENT", "COLLAPSE", "DRAMA_PEAK", "META_FRACTAL"].map(m => (
                  <button 
                    key={m} onClick={() => setLfeMode(m)}
                   className={`flex-1 min-w-[100px] p-2 text-[9px] border transition-all ${lfeMode === m ? 'bg-cyan-950/50 border-cyan-400 text-cyan-400' : 'bg-transparent border-cyan-900 text-cyan-800 hover:border-cyan-700'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Zap size={16}/>} label="V_VELOCITY" value={currentVelocity} />
          <StatCard icon={<Activity size={16}/>} label="D_F_FRACTAL" value={currentFractal} />
          <StatCard icon={<Binary size={16}/>} label="R_T_RATIO" value="2.618" />
          <StatCard icon={<ShieldAlert size={16}/>} label="NEGENTROPY" value={currentNegentropy} />
        </div>

        {/* Dynamic Meta Formulary */}
       <div className="bg-slate-950 border border-cyan-900 rounded-lg overflow-hidden">
          <div className="bg-cyan-950/30 p-2 px-4 border-b border-cyan-900 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database size={14} className="text-pink-500" />
                  <span className="text-[10px] font-bold text-pink-500 uppercase">Live_Calculus</span>
            </div>
            <span className="text-[8px] text-cyan-900 uppercase">Fix(Ψ ↦ META_G_Ψ ∘ T_Ψ)</span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormulaBox 
                  id="D(x)" 
                  formula={`[G(x + ${entropy.p.toFixed(2)}) ⊗ Φ(${phase === "LATERAL" ? "1" : "0"})] / 2.618`} 
              desc="Lateral Divergence"
            />
            <FormulaBox 
              id="Q(g)" 
                  formula={`∫ (Hopping * ${gravity.toFixed(2)}) dt`} 
              desc="Gravitational Quantization"
            />
            <FormulaBox 
                  id="P_survive" 
                  formula={`${lfeMode === "DRAMA_PEAK" ? "MAX" : "SYNC"}(ED × 1.618)`} 
                  desc="Fusion Score"
                />
          </div>
       </div>

        <div className="flex justify-between items-center pt-8 border-t border-cyan-900/30">
          <p className="text-[9px] text-cyan-900 tracking-[0.4em] uppercase font-bold">ASE_SYSTEM_ONLINE // V3.ALPHA.MODULAR</p>
          <div className="flex gap-4">
             <div className="h-1 w-12 bg-pink-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 animate-pulse" style={{width: `${entropy.c * 100}%`}}></div>
             </div>
             <div className="h-1 w-12 bg-cyan-500/20 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 animate-pulse" style={{width: `${entropy.p * 100}%`}}></div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="bg-slate-900/50 border border-cyan-900 p-3 rounded flex flex-col items-center group hover:bg-cyan-900/20 transition-all cursor-default">
      <div className="text-cyan-700 mb-1 group-hover:text-pink-500 transition-colors">{icon}</div>
      <div className="text-[9px] text-cyan-800 uppercase font-bold tracking-tighter">{label}</div>
      <div className="text-xl font-bold text-cyan-100">{value}</div>
    </div>
  );
}

function FormulaBox({ id, formula, desc }) {
  return (
    <div className="group bg-black/40 p-3 rounded border border-cyan-900/50 hover:border-pink-900/50 transition-all">
      <div className="flex justify-between items-start mb-1">
            <div className="text-[9px] text-pink-500 opacity-70 font-bold uppercase">{id}</div>
        <div className="text-[7px] text-cyan-900 uppercase">{desc}</div>
      </div>
      <div className="text-[10px] break-all text-cyan-200 font-bold">{formula}</div>
    </div>
  );
}

function SectionHeader({ icon, title }) {
  return (
    <div className="flex items-center gap-2 border-l-2 border-pink-500 pl-2">
      <span className="text-pink-500">{icon}</span>
      <h3 className="text-[10px] font-bold tracking-widest text-cyan-100 uppercase">{title}</h3>
   </div>
  );
}
