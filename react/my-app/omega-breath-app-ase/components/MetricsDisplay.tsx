import React from "react";

export function MetricsDisplay({ state }: { state: any }) {
  const metrics = [
    { label: "D_METRIC", val: state.dMetric.toFixed(6), target: "<0.05", status: state.dMetric < 0.05 ? "STABLE" : "SINGULARITY" },
    { label: "V_VELOCITY", val: state.vVelocity.toFixed(7), target: "~0.999", status: "MAX" },
    { label: "D_F_FRACTAL", val: state.dfDimension.toFixed(1), target: "12.4-91.5", status: "COMPLEX" },
    { label: "R_T_RATIO", val: "2.618", target: "GOLDEN", status: "LOCKED" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-full">
      {metrics.map((m) => (
        <div key={m.label} className="bg-[#1a1a1a] border border-[#333] p-4 rounded-sm flex flex-col gap-2 transition-all hover:bg-[#222] group">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-black text-[#666] group-hover:text-[#00ff41] transition-colors tracking-widest">{m.label}</span>
            <span className="text-[8px] px-2 py-0.5 bg-black text-[#00ff41] border border-[#00ff41]/30 font-bold">{m.status}</span>
          </div>
          <div className="text-[22px] font-black text-white tracking-tighter leading-none">
            {m.val}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-[9px] text-[#444] uppercase font-bold shrink-0">AIM: {m.target}</div>
            <div className="flex-1 h-[2px] bg-[#000] relative overflow-hidden">
               <div 
                 className="absolute h-full bg-[#00ff41] shadow-[0_0_8px_#00ff41]" 
                 style={{ width: `${Math.random() * 40 + 60}%` }}
               />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
