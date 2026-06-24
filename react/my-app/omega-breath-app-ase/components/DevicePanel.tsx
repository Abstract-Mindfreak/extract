import React from "react";
import { Layers, Zap, Wind, Activity, Terminal } from "lucide-react";

export function DevicePanel({ state, onXYChange }: { state: any, onXYChange: (x: number, y: number) => void }) {
  const phases = [
    "emergence", 
    "stabilization", 
    "meta_question", 
    "operator_shuffle", 
    "phase_shift", 
    "co_evolution", 
    "instability", 
    "reformation"
  ];

  return (
    <div className="bg-[#1a1a1a] rounded-sm p-5 border border-[#333] flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-[#333] pb-3">
        <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
          <Terminal size={14} className="text-[#00ff41]" /> Temporal Phase Sequence
        </h2>
        <div className="flex items-center gap-3">
           <div className="text-[9px] text-[#555] uppercase tracking-widest">Operator State:</div>
           <div className="text-[10px] bg-[#000] text-[#00ff41] px-2 py-0.5 rounded-sm border border-[#00ff41]/20 font-bold">
             G = Q = Φ = M
           </div>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 h-20">
        {phases.map((ph) => (
          <div key={ph} className="flex flex-col items-center gap-2 relative">
            <div className={`w-full h-12 bg-[#000] border ${state.phase === ph ? "border-[#00ff41]" : "border-[#222]"} relative overflow-hidden group transition-all duration-300`}>
              <div
                className={`absolute bottom-0 w-full transition-all duration-500 ease-out ${
                  state.phase === ph ? "bg-[#00ff41] shadow-[0_0_10px_rgba(0,255,65,0.5)]" : "bg-[#333] opacity-20"
                }`}
                style={{ height: state.phase === ph ? "100%" : "20%" }}
              />
              <div className={`absolute inset-0 flex items-center justify-center text-[7px] font-bold z-10 break-all p-1 text-center leading-tight transition-colors ${state.phase === ph ? "text-black" : "text-[#444]"}`}>
                {ph.toUpperCase().replace("_", "\n")}
              </div>
            </div>
            <div className={`w-1 h-1 rounded-full ${state.phase === ph ? "bg-[#00ff41]" : "bg-transparent"}`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "V_VELOCITY", icon: Activity, val: state.vVelocity.toFixed(6) },
          { label: "G_S_GAIN", icon: Zap, val: "4921.07" },
          { label: "SEED_MAP", icon: Layers, val: state.seed },
          { label: "ADAPT_ρ", icon: Wind, val: (0.85 + state.recursionDepth * 0.02).toFixed(2) },
        ].map((ctrl) => (
          <div key={ctrl.label} className="bg-[#0a0a0a] p-3 border border-[#333] flex flex-col group hover:border-[#00ff41]/30 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <ctrl.icon size={11} className="text-[#555] group-hover:text-[#00ff41] transition-colors" />
              <span className="text-[8px] text-[#555] uppercase font-bold tracking-widest">{ctrl.label}</span>
            </div>
            <span className="text-[12px] text-[#00ff41] font-black">{ctrl.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}