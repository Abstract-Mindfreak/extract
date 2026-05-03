import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  Settings, 
  Zap, 
  Layers, 
  Terminal, 
  Radio, 
  Activity, 
  Cpu,
  Database,
  RefreshCw,
  X,
  Maximize2,
  ChevronRight,
  TrendingUp,
  Map as MapIcon,
  FastForward,
  Ghost,
  Command,
  Wind,
  Target,
  FlaskConical,
  Binary,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  Hash,
  Boxes,
  Plus,
  Trash2,
  Play,
  Pause,
  Copy,
  Clock,
  ArrowUp,
  ArrowDown,
  Download,
  Library,
  Wand2,
  Package,
  Filter,
  Search,
  FileCode
} from "lucide-react";

// --- Advanced Orchestrator Component ---

const MistralOrchestrator = ({ onCommand }: any) => {
    const [input, setInput] = useState("");
    return (
        <div className="relative group">
            <div className="absolute -top-10 left-0 bg-blue-600/10 border border-blue-500/20 px-3 py-1 rounded-t-lg backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <Sparkles size={12} className="text-blue-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Mistral Orchestrator Active</span>
                </div>
            </div>
            <div className="flex bg-slate-900/80 border border-slate-700/50 rounded-xl overflow-hidden shadow-2xl group-focus-within:border-blue-500/50 transition-all">
                <div className="p-3 bg-slate-800/50 border-r border-slate-700/50 flex items-center">
                    <MessageSquare size={16} className="text-slate-400" />
                </div>
                <input 
                    type="text" 
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (onCommand(input), setInput(""))}
                    placeholder="Describe the desired state inversion..." 
                    className="flex-1 bg-transparent px-4 py-3 text-xs text-white placeholder:text-slate-600 outline-none"
                />
                <button 
                    onClick={() => onCommand(input)}
                    className="px-4 bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
};

// --- Protocol Matrix Component ---

const ProtocolMatrix = ({ activeProtocol, setActiveProtocol }: any) => {
    const protocols = [
        { id: "lfe", name: "Lyric Fusion", desc: "MetaFractal v1 Fusion Engine", icon: Wind, ops: ["F_loop", "Syllable_Map"] },
        { id: "freq_fractal", name: "Freq Fractals", desc: "Sub-bass & Spectral Architecture", icon: Activity, ops: ["Sub_Inversion", "High_Cryst"] },
        { id: "omni_unified", name: "Omni Unified", desc: "Total Integration Architecture", icon: Binary, ops: ["L1-L9_Sync", "Global_Φ"] },
        { id: "hyperloop_v1", name: "HL-V1 Theory", desc: "Aesthetic Singularity / G-Inversion", icon: FlaskConical, ops: ["Λ-Formalize", "Recursion"] },
        { id: "hyperloop_v2", name: "HL-V2 Practical", desc: "Pattern Search & Strategy", icon: Target, ops: ["H(p,c)_Opt", "Risk_Audit"] },
        { id: "hyperloop_v3", name: "HL-V3 Direct", desc: "High-Speed Execution", icon: Zap, ops: ["Direct_Collapse", "X10_Accel"] },
    ];

    return (
        <div className="grid grid-cols-1 gap-4">
            {protocols.map(p => (
                <div key={p.id} className={`flex flex-col rounded-xl border transition-all ${
                    activeProtocol === p.id ? "bg-blue-600/5 border-blue-500/50 ring-1 ring-blue-500/20" : "bg-black/20 border-slate-800"
                }`}>
                    <button 
                        onClick={() => setActiveProtocol(p.id)}
                        className="p-4 text-left group"
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <p.icon size={16} className={activeProtocol === p.id ? "text-blue-400" : "text-slate-500"} />
                            <span className={`text-xs font-bold tracking-[0.2em] uppercase ${activeProtocol === p.id ? "text-white" : "text-slate-400"}`}>
                                {p.name}
                            </span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight mb-3">{p.desc}</p>
                        <div className="flex flex-wrap gap-2">
                            {p.ops.map(op => (
                                <span key={op} className="px-2 py-0.5 bg-black/40 border border-slate-800 text-[8px] text-slate-500 rounded uppercase tracking-tighter">
                                    {op}
                                </span>
                            ))}
                        </div>
                    </button>
                </div>
            ))}
        </div>
    );
};

// --- JSON Library Component ---

const JsonLibrary = ({ blocks, sequences, onAddBlock, onLoadSequence }: any) => {
    const [filter, setFilter] = useState("all");
    const [search, setSearch] = useState("");

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex flex-col gap-3">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input 
                        type="text" 
                        placeholder="Search blocks or sequences..." 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full bg-black/40 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs focus:border-blue-500 outline-none transition-all"
                    />
                </div>
                <div className="flex gap-2 p-1 bg-black/40 border border-slate-800 rounded-lg">
                    {["all", "blocks", "sequences"].map(f => (
                        <button 
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`flex-1 py-1 text-[9px] font-bold uppercase rounded ${filter === f ? "bg-slate-800 text-white" : "text-slate-600 hover:text-slate-400"}`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6">
                {(filter === "all" || filter === "blocks") && (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Boxes size={12} /> Prompt Blocks
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {blocks.map((block: any) => (
                                <div key={block.id} className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl hover:border-blue-500/30 group transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-bold text-slate-300">{block.name}</span>
                                        <button onClick={() => onAddBlock(block)} className="p-1 text-slate-600 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Plus size={14} />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        {block.tags.slice(0, 3).map((tag: string) => (
                                            <span key={tag} className="text-[8px] text-slate-600 bg-black/40 px-1.5 py-0.5 rounded">#{tag}</span>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {(filter === "all" || filter === "sequences") && (
                    <div className="space-y-3">
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Library size={12} /> Saved Sequences
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {sequences.map((seq: any) => (
                                <div 
                                    key={seq.id} 
                                    onClick={() => onLoadSequence(seq)}
                                    className="p-3 bg-blue-600/5 border border-blue-500/10 rounded-xl hover:border-blue-500/50 cursor-pointer transition-all group"
                                >
                                    <div className="text-[10px] font-bold text-blue-400 mb-1">{seq.name}</div>
                                    <div className="flex justify-between text-[8px] text-slate-500 uppercase">
                                        <span>{seq.items} items</span>
                                        <span>{seq.source}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- Synthesis Hub Component ---

const SynthesisHub = ({ onGeneratePreset, onBatchExport }: any) => {
    const algorithms = [
        { id: "random", name: "Random Build", desc: "Stochastic selection" },
        { id: "ordered", name: "Ordered Name", desc: "Alphabetical sorting" },
        { id: "wave", name: "Category Wave", desc: "Oscillating category selection" },
        { id: "tag", name: "Tag Chain", desc: "Linked semantic nodes" },
        { id: "stride", name: "Stride Walk", desc: "Incremental index stepping" },
        { id: "density", name: "Key Density", desc: "Semantic weight optimization" },
        { id: "signature", name: "Key Signature", desc: "Signature tag clustering" }
    ];

    const [batchFormula, setBatchFormula] = useState("6x44 random");

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Wand2 size={12} className="text-amber-400" /> Preset Generator
                </div>
                <div className="grid grid-cols-1 gap-2">
                    {algorithms.map(algo => (
                        <button 
                            key={algo.id}
                            onClick={() => onGeneratePreset(algo.id)}
                            className="p-3 bg-black/40 border border-slate-800 rounded-xl text-left hover:border-amber-500/50 transition-all group"
                        >
                            <div className="text-[10px] font-bold text-slate-300 mb-1 group-hover:text-amber-400 transition-colors">{algo.name}</div>
                            <div className="text-[9px] text-slate-600">{algo.desc}</div>
                        </button>
                    ))}
                </div>
            </div>

            <div className="p-5 bg-blue-600/5 border border-blue-500/20 rounded-2xl space-y-4">
                <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Package size={12} /> Batch Export Tool
                </div>
                <div className="space-y-2">
                    <label className="text-[8px] text-slate-500 uppercase font-bold">Export Formula</label>
                    <input 
                        type="text" 
                        value={batchFormula}
                        onChange={(e) => setBatchFormula(e.target.value)}
                        className="w-full bg-black/60 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-blue-300 outline-none"
                    />
                </div>
                <button 
                    onClick={() => onBatchExport(batchFormula)}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black tracking-widest uppercase shadow-lg shadow-blue-500/10"
                >
                    Initialize Batch
                </button>
            </div>
        </div>
    );
};

// --- Extraction Steps Component ---

const ExtractionSteps = ({ currentStep, setStep }: any) => {
    const steps = [
        { id: 1, name: "Analysis", desc: "Λ-Formalization & Seed Capture" },
        { id: 2, name: "Transformation", desc: "G(s) Recursive Inversion" },
        { id: 3, name: "Fusion", desc: "MMSS Omni Synthesis" },
        { id: 4, name: "Collapse", desc: "Final Φ-Output Generation" }
    ];

    return (
        <div className="space-y-4">
            {steps.map(s => (
                <button 
                    key={s.id} 
                    onClick={() => setStep(s.id)}
                    className="w-full relative pl-8 border-l border-slate-800/50 pb-6 last:pb-0 text-left group"
                >
                    <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full border-2 border-[#070707] transition-all duration-500 ${currentStep >= s.id ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] scale-110" : "bg-slate-800"}`}></div>
                    <div className={`p-4 rounded-2xl border transition-all duration-500 ${currentStep === s.id ? "bg-emerald-500/10 border-emerald-500/40 translate-x-1 shadow-lg" : "bg-black/20 border-slate-900 group-hover:border-slate-700"}`}>
                        <div className="text-[9px] font-black text-slate-600 uppercase mb-2 tracking-tighter">Step 0{s.id}</div>
                        <div className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentStep === s.id ? "text-white" : "text-slate-500"}`}>{s.name}</div>
                        <p className="text-[10px] text-slate-700 mt-2 leading-relaxed font-medium">{s.desc}</p>
                    </div>
                </button>
            ))}
        </div>
    );
};

// --- Main App Component ---

export default function Component() {
  const [expandedPanel, setExpandedPanel] = useState<string | null>(null);
  const [seed, setSeed] = useState("Φ_TOTAL_INIT");
  const [lastCommand, setLastCommand] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  
  // ASE State
  const [activeProtocol, setActiveProtocol] = useState("hyperloop_v2");
  const [mergeStrategy, setMergeStrategy] = useState("merge_deep");
  const [phiTotal, setPhiTotal] = useState({
    status: "OMNI_COHERENT",
    V_val: 0.999,
    S_ent: 0.001,
    accel: 10.0
  });

  // Data
  const [availableBlocks] = useState([
    { id: "b1", name: "Sub-Bass Architecture", tags: ["audio", "low-end", "structural"] },
    { id: "b2", name: "Glitch Meltdown", tags: ["effects", "chaos", "random"] },
    { id: "b3", name: "Ethereal Vocals", tags: ["vocals", "lfe", "ambient"] },
    { id: "b4", name: "Recursive Percussion", tags: ["drums", "rhythm", "g-inversion"] }
  ]);

  const [savedSequences] = useState([
    { id: "s1", name: "Gothic Techno Fusion", items: 4, source: "manual" },
    { id: "s2", name: "Omni Extraction v1", items: 12, source: "flowmusic.app" }
  ]);

  // Composition State
  const [composition, setComposition] = useState<any[]>([
    { id: "c1", name: "Analysis Node", protocol: "hyperloop_v2", step: 1, entropy: { p: 0.9, c: 0.1 }, phase: 0.1 },
    { id: "c2", name: "State Transformation", protocol: "hyperloop_v2", step: 2, entropy: { p: 0.7, c: 0.3 }, phase: 0.4 }
  ]);
  const [activeIndex, setActiveIndex] = useState(0);

  const activeItem = composition[activeIndex];

  const updateActiveItem = (updates: any) => {
    const updated = [...composition];
    updated[activeIndex] = { ...updated[activeIndex], ...updates };
    setComposition(updated);
  };

  const moveItem = (idx: number, dir: 'up' | 'down') => {
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === composition.length - 1) return;
    const updated = [...composition];
    const target = dir === 'up' ? idx - 1 : idx + 1;
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    setComposition(updated);
    setActiveIndex(target);
  };

  const handleOrchestratorCommand = (cmd: string) => {
    setLastCommand(cmd);
    if (cmd.toLowerCase().includes("chaos")) updateActiveItem({ entropy: { ...activeItem.entropy, c: 0.9 } });
    if (cmd.toLowerCase().includes("theory")) updateActiveItem({ protocol: "hyperloop_v1" });
  };

  const addBlockToComposition = (block: any) => {
    setComposition([...composition, {
        id: `c${Date.now()}`,
        name: block.name,
        protocol: activeProtocol,
        step: 1,
        entropy: { p: 0.8, c: 0.2 },
        phase: 0.5
    }]);
  };

  const sidebarItems = [
    { id: "library", icon: Library, label: "JSON Library" },
    { id: "steps", icon: Layers, label: "Extraction Steps" },
    { id: "protocols", icon: Command, label: "ASE Protocols" },
    { id: "synthesis", icon: Wand2, label: "Synthesis Tools" },
    { id: "archive", icon: Database, label: "Archive Mapping" },
    { id: "metrics", icon: TrendingUp, label: "Fractal Metrics" },
    { id: "settings", icon: Settings, label: "Engine Config" },
  ];

  const currentPhaseName = useMemo(() => {
    if (!activeItem) return "Idle";
    const p = activeItem.phase;
    if (p < 0.15) return "Emergence";
    if (p < 0.4) return "Stabilization";
    if (p < 0.6) return "Meta-Question";
    if (p < 0.8) return "Co-Evolution";
    return "Reformation";
  }, [activeItem]);

  const togglePanel = (id: string) => setExpandedPanel(expandedPanel === id ? null : id);

  return (
    <div className="flex h-screen w-full bg-[#030303] text-slate-300 font-mono overflow-hidden selection:bg-blue-500/40">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-16 flex flex-col items-center py-8 border-r border-slate-800/40 bg-[#070707] z-50 shadow-2xl">
        <div className="p-3 mb-12 bg-blue-600/10 rounded-2xl text-blue-500 border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)] group cursor-pointer overflow-hidden relative">
          <div className="absolute inset-0 bg-blue-500/5 animate-pulse"></div>
          <Cpu size={24} className="relative z-10" />
        </div>
        <div className="flex flex-col gap-5">
          {sidebarItems.map((item) => (
            <button 
              key={item.id}
              onClick={() => togglePanel(item.id)}
              className={`p-3.5 rounded-xl transition-all duration-300 relative group ${
                expandedPanel === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-110" 
                  : "text-slate-600 hover:text-slate-300 hover:bg-slate-800/40"
              }`}
            >
              <item.icon size={20} />
              <div className="absolute left-16 px-3 py-1.5 bg-slate-800 text-[10px] font-bold rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-2 group-hover:translate-x-0 whitespace-nowrap z-50 uppercase tracking-widest">
                {item.label}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* DYNAMIC OVERLAY PANEL */}
      <div 
        className={`absolute left-16 top-0 bottom-0 z-40 bg-[#070707]/98 border-r border-slate-800/50 backdrop-blur-3xl transition-all duration-500 ease-in-out overflow-hidden shadow-2xl ${
          expandedPanel ? "w-[400px]" : "w-0"
        }`}
      >
        <div className="w-[400px] h-full flex flex-col p-8 border-l border-white/5">
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-3">
               <div className="w-1.5 h-6 bg-blue-600 rounded-full"></div>
               <h2 className="text-xs font-black tracking-[0.3em] text-white uppercase">
                 {sidebarItems.find(i => i.id === expandedPanel)?.label}
               </h2>
            </div>
            <button onClick={() => setExpandedPanel(null)} className="p-2 hover:bg-white/5 rounded-full text-slate-500 transition-colors">
                <X size={18} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-8">
            {expandedPanel === "library" && <JsonLibrary blocks={availableBlocks} sequences={savedSequences} onAddBlock={addBlockToComposition} onLoadSequence={(s:any) => console.log(s)} />}
            {expandedPanel === "steps" && <ExtractionSteps currentStep={activeItem?.step} setStep={(s: number) => updateActiveItem({ step: s })} />}
            {expandedPanel === "protocols" && <ProtocolMatrix activeProtocol={activeItem?.protocol} setActiveProtocol={(p: string) => updateActiveItem({ protocol: p })} />}
            {expandedPanel === "synthesis" && <SynthesisHub onGeneratePreset={(id: string) => console.log("Preset", id)} onBatchExport={(f: string) => console.log("Batch", f)} />}
            {/* ... other panels ... */}
          </div>
        </div>
      </div>

      {/* CORE WORKSPACE */}
      <div className={`flex-1 flex flex-col transition-all duration-700 ${expandedPanel ? "ml-0 scale-95 opacity-20 blur-2xl grayscale pointer-events-none" : ""}`}>
        
        {/* HEADER BAR */}
        <div className="h-16 border-b border-slate-800/40 flex items-center justify-between px-10 bg-[#070707]/60 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-4">
                <Boxes className="text-blue-500" size={22} />
                <span className="text-[12px] font-black tracking-[0.5em] text-white uppercase">ASE_CONSOLE_X10</span>
            </div>
            <div className="h-4 w-[1px] bg-slate-800"></div>
            <div className="flex items-center gap-4">
                <Hash className="text-slate-600" size={14} />
                <input 
                    type="text" value={seed} onChange={(e) => setSeed(e.target.value)}
                    className="bg-transparent border-none outline-none text-[11px] text-slate-400 font-mono w-48 hover:text-white transition-colors"
                />
            </div>
          </div>
          
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-4 bg-black/40 border border-slate-800 p-1.5 rounded-xl">
                <span className="text-[9px] font-black text-slate-600 uppercase ml-2">Merge Strategy</span>
                <select 
                    value={mergeStrategy}
                    onChange={(e) => setMergeStrategy(e.target.value)}
                    className="bg-slate-900 text-[10px] font-bold text-blue-400 border-none outline-none rounded-lg px-2 py-1 appearance-none cursor-pointer"
                >
                    <option value="concat">Concat</option>
                    <option value="merge_shallow">Merge Shallow</option>
                    <option value="merge_deep">Merge Deep</option>
                </select>
            </div>
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isPlaying ? "bg-amber-600 text-white shadow-[0_0_20px_rgba(217,119,6,0.3)]" : "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] active:scale-95"}`}
            >
                {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>
          </div>
        </div>

        {/* MAIN STAGE */}
        <div className="flex-1 flex flex-col p-10 gap-10 overflow-y-auto bg-[#030303] custom-scrollbar">
          
          {/* VISUALIZER CANVAS */}
          <div className="relative min-h-[380px] border border-slate-800/30 rounded-[3rem] bg-black overflow-hidden flex items-center justify-center shadow-2xl">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#111_1px,transparent_1px)] [background-size:48px_48px] opacity-20"></div>
            
            <div className="relative group flex flex-col items-center">
                <div className="relative w-72 h-72 flex items-center justify-center">
                    <div className="absolute w-full h-full rounded-full border-2 border-blue-500/10 animate-[spin_20s_linear_infinite]"></div>
                    <div className="absolute w-[80%] h-[80%] border border-slate-800/50 rounded-full animate-[spin_12s_linear_infinite_reverse]"></div>
                    <div className="absolute w-40 h-40 bg-blue-600/5 blur-[100px] rounded-full"></div>
                    
                    <div className="relative z-10 flex flex-col items-center">
                        <Zap className="text-blue-500 filter drop-shadow-[0_0_25px_rgba(59,130,246,0.7)]" size={72} />
                        <span className="text-[13px] text-white font-black uppercase tracking-[0.8em] mt-6 ml-2">{currentPhaseName}</span>
                    </div>
                </div>
            </div>

            {/* Corner HUD */}
            <div className="absolute top-10 left-10 p-4 border-l-2 border-t-2 border-blue-500/20 rounded-tl-3xl">
                <div className="text-[9px] text-blue-400 font-black tracking-widest uppercase mb-1">Active Item: #{activeIndex + 1}</div>
                <div className="text-[11px] text-white font-bold font-mono tracking-tighter truncate max-w-[200px]">{activeItem?.name}</div>
            </div>
          </div>

          {/* SEQUENCE TIMELINE HUB */}
          <div className="flex flex-col gap-6 p-8 bg-slate-900/30 border border-slate-800/50 rounded-[2.5rem]">
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                    <Clock size={16} className="text-blue-400" />
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Active Composition // {composition.length} items</span>
                </div>
                <div className="flex gap-4">
                    <button onClick={() => setComposition([...composition, { ...composition[composition.length-1], id: `c${Date.now()}` }])} className="flex items-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-xl text-[10px] font-black uppercase hover:bg-blue-600 hover:text-white transition-all">
                        <Plus size={14} /> Add Step
                    </button>
                </div>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                {composition.map((item, idx) => (
                    <div 
                        key={item.id}
                        onClick={() => setActiveIndex(idx)}
                        className={`min-w-[180px] p-5 rounded-2xl border transition-all relative group cursor-pointer ${
                            activeIndex === idx 
                            ? "bg-blue-600/10 border-blue-500 shadow-xl scale-[1.02]" 
                            : "bg-black/40 border-slate-800 hover:border-slate-700"
                        }`}
                    >
                        <div className="flex justify-between items-start mb-4">
                            <span className={`text-[10px] font-black ${activeIndex === idx ? "text-blue-400" : "text-slate-600"}`}>#0{idx + 1}</span>
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={(e) => { e.stopPropagation(); moveItem(idx, 'up'); }} className="p-1 hover:text-blue-400"><ArrowUp size={12} /></button>
                                <button onClick={(e) => { e.stopPropagation(); moveItem(idx, 'down'); }} className="p-1 hover:text-blue-400"><ArrowDown size={12} /></button>
                                <button onClick={(e) => { e.stopPropagation(); setComposition(composition.filter((_, i) => i !== idx)); if(activeIndex >= idx) setActiveIndex(Math.max(0, activeIndex-1)); }} className="p-1 hover:text-red-400"><Trash2 size={12} /></button>
                            </div>
                        </div>
                        <div className="text-[10px] font-black text-white uppercase tracking-tight mb-4 truncate">{item.name}</div>
                        <div className="space-y-2">
                            <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" style={{ width: `${item.phase * 100}%` }}></div>
                            </div>
                            <div className="flex justify-between text-[8px] font-bold text-slate-500 uppercase tracking-tighter">
                                <span>Entropy: {item.entropy.c}</span>
                                <span>P: {item.step}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
          </div>

          {/* MISTRAL ORCHESTRATOR HUB */}
          <div className="flex flex-col gap-8">
              <MistralOrchestrator onCommand={(cmd: string) => handleOrchestratorCommand(cmd)} />
              
              <div className="grid grid-cols-2 gap-10">
                  <div className="p-8 border border-slate-800/30 rounded-[2rem] bg-[#070707]/40 backdrop-blur-md">
                      <div className="flex justify-between items-center mb-8">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest font-mono">Structural Order (p)</span>
                          <span className="text-xl text-white font-black font-mono">{activeItem?.entropy.p}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01" value={activeItem?.entropy.p} 
                        onChange={(e) => updateActiveItem({ entropy: { ...activeItem.entropy, p: parseFloat(e.target.value) } })}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-blue-600" 
                      />
                  </div>
                  <div className="p-8 border border-slate-800/30 rounded-[2rem] bg-[#070707]/40 backdrop-blur-md">
                      <div className="flex justify-between items-center mb-8">
                          <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest font-mono">Chaos Coefficient (c)</span>
                          <span className="text-xl text-amber-500 font-black font-mono">{activeItem?.entropy.c}</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.01" value={activeItem?.entropy.c} 
                        onChange={(e) => updateActiveItem({ entropy: { ...activeItem.entropy, c: parseFloat(e.target.value) } })}
                        className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-amber-500" 
                      />
                  </div>
              </div>
          </div>
        </div>
      </div>

      {/* JSON STREAM SIDEBAR (RIGHT) */}
      <div className="w-[540px] border-l border-slate-800/40 bg-[#050505] flex flex-col z-20 shadow-[-50px_0_100px_rgba(0,0,0,0.8)]">
        <div className="p-6 border-b border-slate-800/40 bg-black/30 flex items-center justify-between backdrop-blur-md sticky top-0 z-10">
            <div className="flex items-center gap-3">
                <Terminal size={18} className="text-blue-500" />
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.4em]">Φ_Sequence Unified Stream</span>
            </div>
            <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[9px] text-emerald-500 font-black uppercase">Active Stream</span>
            </div>
        </div>

        <div className="flex-1 p-8 overflow-hidden flex flex-col gap-8">
            <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-3xl space-y-3">
                <div className="flex items-center gap-2 text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    <Sparkles size={14} /> Orchestrator Feedback
                </div>
                <p className="text-[12px] text-slate-500 italic leading-relaxed">
                    {lastCommand ? `Orchestrating intent: "${lastCommand}". Mapping semantic inversion to frame #${activeIndex + 1}.` : "Φ_TOTAL Synchronized. Awaiting state trigger."}
                </p>
            </div>

            <div className="flex-1 w-full bg-black/60 rounded-[2.5rem] p-8 font-mono text-[11px] text-emerald-500/90 overflow-y-auto border border-emerald-500/5 custom-scrollbar shadow-inner leading-relaxed">
                <pre className="whitespace-pre-wrap">
{`{
  "SEQUENCE_BUILDER_OUTPUT": {
    "composition": {
      "name": "ASE_DYNAMIC_SEQUENCE",
      "items": ${composition.length},
      "merge_strategy": "${mergeStrategy}"
    },
    "ACTIVE_FRAME": {
      "idx": ${activeIndex},
      "name": "${activeItem?.name}",
      "protocol": "${activeItem?.protocol.toUpperCase()}",
      "params": {
        "step": ${activeItem?.step},
        "phase": "${currentPhaseName}",
        "entropy": { "p": ${activeItem?.entropy.p}, "c": ${activeItem?.entropy.c} }
      }
    },
    "METRICS": {
      "V_val": ${phiTotal.V_val},
      "S_ent": ${phiTotal.S_ent},
      "seed": "${seed}"
    }
  }
}`}
                </pre>
            </div>

            <div className="flex flex-col gap-4">
                <button className="w-full py-6 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white rounded-[1.5rem] text-[13px] font-black tracking-[0.6em] transition-all uppercase flex items-center justify-center gap-3 shadow-2xl active:scale-[0.98]">
                    <Zap size={20} /> COLLAPSE TO SINGULARITY
                </button>
                <div className="grid grid-cols-2 gap-4">
                    <button className="flex items-center justify-center gap-2 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black tracking-widest uppercase">
                        <Copy size={14} /> Copy Preview
                    </button>
                    <button className="flex items-center justify-center gap-2 py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 rounded-2xl text-[10px] font-black tracking-widest uppercase">
                        <Download size={14} /> Save JSON
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
