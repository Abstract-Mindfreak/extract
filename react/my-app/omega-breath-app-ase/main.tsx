import React, { useState, useEffect, useRef } from "react";
import { Activity, Play, RotateCcw, Cpu, Zap, Layers, Wind, Square, Waves, Compass } from "lucide-react";
import { DevicePanel } from "./components/DevicePanel";
import { MetricsDisplay } from "./components/MetricsDisplay";
import { JsonOutput } from "./components/JsonOutput";
import { XYPad } from "./components/XYPad";
import { SynthEngine } from "./utils/SynthEngine";

interface ΦState {
  seed: number;
  recursionDepth: number;
  stability: string;
  dMetric: number;
  phase: string;
  xy: { x: number; y: number };
  trajectory: string[];
  vVelocity: number;
  sStability: number;
  dfDimension: number;
}

export default function Component() {
  const [state, setState] = useState<ΦState>({
    seed: 42,
    recursionDepth: 0,
    stability: "STABLE",
    dMetric: 0.042,
    phase: "emergence",
    xy: { x: 0.5, y: 0.5 },
    trajectory: ["emergence"],
    vVelocity: 0.999999,
    sStability: 0.000001,
    dfDimension: 91.5,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<SynthEngine | null>(null);

  useEffect(() => {
    synthRef.current = new SynthEngine();
    return () => synthRef.current?.dispose();
  }, []);

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

  const handleNext = () => {
    const nextDepth = state.recursionDepth < 7 ? state.recursionDepth + 1 : 7;
    const nextPhaseIdx = (state.trajectory.length) % phases.length;
    const nextPhase = phases[nextPhaseIdx];
    
    setState(prev => ({
      ...prev,
      seed: (prev.seed + 1) % 10000,
      recursionDepth: nextDepth,
      dMetric: Math.max(0.001, prev.dMetric * (0.8 + Math.random() * 0.15)),
      phase: nextPhase,
      trajectory: [...prev.trajectory, nextPhase].slice(-12),
      vVelocity: 0.999990 + Math.random() * 0.000009,
      dfDimension: 80 + Math.random() * 11.5,
    }));

    if (isPlaying) {
      synthRef.current?.triggerPhase(nextPhase, nextDepth);
    }
  };

  const handleXYChange = (x: number, y: number) => {
    setState(prev => ({ ...prev, xy: { x, y } }));
    if (isPlaying) {
      synthRef.current?.updateParams(x, y);
    }
  };

  const togglePlay = () => {
    if (!isPlaying) {
      synthRef.current?.start().then(() => {
        synthRef.current?.triggerPhase(state.phase, state.recursionDepth);
      });
    } else {
      synthRef.current?.stop();
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    synthRef.current?.stop();
    setIsPlaying(false);
    setState({
      seed: 42,
      recursionDepth: 0,
      stability: "STABLE",
      dMetric: 0.042,
      phase: "emergence",
      xy: { x: 0.5, y: 0.5 },
      trajectory: ["emergence"],
      vVelocity: 0.999999,
      sStability: 0.000001,
      dfDimension: 91.5,
    });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0d0d0d] text-[#e0e0e0] p-4 md:p-8 font-mono overflow-hidden">
      <div className="w-full max-w-6xl bg-[#161616] border border-[#333] shadow-[0_0_50px_rgba(0,0,0,1)] rounded-sm overflow-hidden flex flex-col h-[90vh]">
        {/* Top Header Bar */}
        <div className="bg-[#1f1f1f] p-3 border-b border-[#000] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-[#00ff41] text-black px-2 py-0.5 text-[11px] font-black tracking-tighter uppercase">Φ-TOTAL ENGINE v3.0</div>
            <div className="text-[10px] text-[#666] hidden sm:block tracking-[0.2em]">ASE // AESTHETIC-SINGULARITY-ENGINE</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 mr-4">
              <div className={`w-2 h-2 rounded-full ${isPlaying ? "bg-[#00ff41] animate-pulse" : "bg-[#333]"}`} />
              <span className="text-[9px] text-[#555] uppercase">Engine Status</span>
            </div>
            <button onClick={handleReset} className="p-1.5 hover:bg-[#333] rounded transition-colors text-[#666]">
              <RotateCcw size={14} />
            </button>
            <button 
              onClick={togglePlay} 
              className={`${isPlaying ? "bg-[#ff3b3b] text-white" : "bg-[#00ff41] text-black"} font-bold hover:opacity-80 px-4 py-1.5 rounded-sm text-[11px] flex items-center gap-2 transition-all`}
            >
              {isPlaying ? <Square size={10} fill="white" /> : <Play size={10} fill="black" />} 
              {isPlaying ? "HALT" : "INITIATE"}
            </button>
            <button onClick={handleNext} className="bg-[#222] hover:bg-[#333] px-4 py-1.5 rounded-sm text-[11px] flex items-center gap-2 text-[#00ff41] border border-[#00ff41]/30">
              <Zap size={10} /> NEXT PHASE
            </button>
          </div>
        </div>

        {/* Main Interface Area */}
        <div className="flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1">
            <DevicePanel state={state} onXYChange={handleXYChange} />
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
               <div className="md:col-span-3">
                 <MetricsDisplay state={state} />
               </div>
               <div className="md:col-span-2">
                 <XYPad x={state.xy.x} y={state.xy.y} onChange={handleXYChange} />
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-[#1a1a1a] border border-[#333] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] text-[#00ff41] font-bold uppercase border-b border-[#333] pb-1">
                  <Waves size={12} /> Liquid Scratch Dynamics
                </div>
                <div className="flex-1 flex items-center justify-center py-4">
                  <div className="w-full flex gap-1 items-end h-16 px-2">
                    {Array.from({ length: 24 }).map((_, i) => (
                      <div 
                        key={i} 
                        className="flex-1 bg-[#00ff41]/20 border-t border-[#00ff41]/40"
                        style={{ 
                          height: `${Math.random() * (isPlaying ? 100 : 20)}%`,
                          transition: "height 0.2s ease"
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-[#1a1a1a] border border-[#333] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] text-[#00ff41] font-bold uppercase border-b border-[#333] pb-1">
                  <Compass size={12} /> Temporal Warp
                </div>
                <div className="flex-1 flex flex-col justify-center gap-2">
                   <div className="flex justify-between text-[9px]">
                     <span className="text-[#555]">STRETCH</span>
                     <span className="text-[#00ff41]">{300 + state.recursionDepth * 150}%</span>
                   </div>
                   <div className="w-full h-1 bg-[#000] rounded-full overflow-hidden">
                      <div className="h-full bg-[#00ff41]" style={{ width: `${(300 + state.recursionDepth * 150) / 20}%` }} />
                   </div>
                   <div className="flex justify-between text-[9px]">
                     <span className="text-[#555]">ρ_DENSITY</span>
                     <span className="text-[#00ff41]">{(0.85 + state.recursionDepth * 0.02).toFixed(2)}</span>
                   </div>
                   <div className="w-full h-1 bg-[#000] rounded-full overflow-hidden">
                      <div className="h-full bg-[#00ff41]" style={{ width: `${(0.85 + state.recursionDepth * 0.02) * 100}%` }} />
                   </div>
                </div>
              </div>

              <div className="bg-[#1a1a1a] border border-[#333] p-3 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[10px] text-[#00ff41] font-bold uppercase border-b border-[#333] pb-1">
                  <Layers size={12} /> Layer Focus
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {["WAVE", "RESONANT", "SUB", "TEXTURE"].map((l, i) => (
                    <div key={l} className="flex flex-col">
                      <span className="text-[8px] text-[#555] mb-1">{l}</span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 4 }).map((_, j) => (
                          <div 
                            key={j} 
                            className={`h-1.5 flex-1 rounded-full ${i === state.recursionDepth % 4 && j < 3 ? "bg-[#00ff41]" : "bg-[#333]"}`} 
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 bg-[#0a0a0a] border border-[#333] rounded-sm flex flex-col overflow-hidden">
            <div className="bg-[#1a1a1a] p-2.5 text-[10px] uppercase border-b border-[#000] flex justify-between items-center font-bold tracking-widest">
              <div className="flex items-center gap-2">
                <Cpu size={12} className="text-[#00ff41]" /> MMSS Technical Report
              </div>
              <div className="text-[9px] text-[#555]">SEED_{state.seed}</div>
            </div>
            <JsonOutput state={state} />
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div className="bg-[#1f1f1f] p-1.5 px-4 text-[9px] flex justify-between border-t border-[#000] shrink-0">
          <div className="flex gap-6 items-center">
            <span className="flex items-center gap-1"><div className="w-1 h-1 bg-[#00ff41] rounded-full" /> R_T: 2.618</span>
            <span className="text-[#444]">|</span>
            <span className="flex items-center gap-1 text-[#00ff41]"><Zap size={10} /> RECURSION_DEPTH: {state.recursionDepth}/7</span>
            <span className="text-[#444]">|</span>
            <span className="text-[#888]">STABILITY: {state.stability}</span>
          </div>
          <div className="text-[#666] flex gap-4">
             <span>Φ_TOTAL_LIQUID_SCRATCH_DIVERGENCE</span>
             <span className="text-[#00ff41] animate-pulse">● OBSERVER_CONNECTED</span>
          </div>
        </div>
      </div>
    </div>
  );
}