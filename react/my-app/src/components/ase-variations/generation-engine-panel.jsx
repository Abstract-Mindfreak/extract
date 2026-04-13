import React, { useState, useEffect } from "react";
import { Cpu, Dna, GitMerge, Brain, Play, Save, Download, Upload, Trash2, Activity, Layers, Target, Zap, RefreshCw, Terminal, Code2 } from "lucide-react";
import { usePythonGenerationLayer } from "../../services/PythonGenerationLayer";
import { DEFAULT_RULES } from "../../services/PythonBridge";

export default function GenerationEnginePanel() {
  const genLayer = usePythonGenerationLayer();
  
  // State
  const [intent, setIntent] = useState("industrial texture with spatial diffusion");
  const [domains, setDomains] = useState(["Rhythm", "Timbre", "Space", "Logic"]);
  const [layers, setLayers] = useState([1, 2, 3]);
  const [maxBlocks, setMaxBlocks] = useState(8);
  const [temperature, setTemperature] = useState(0.7);
  const [runs, setRuns] = useState(8);
  
  // Block Index (simulated - in real app would load from backend)
  const [blockIndex, setBlockIndex] = useState(null);
  const [graph, setGraph] = useState(null);
  const [embeddings, setEmbeddings] = useState(null);
  
  // Results
  const [generationResult, setGenerationResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState("builder");
  
  // Mutation/Crossover
  const [mutations, setMutations] = useState([]);
  const [crossovers, setCrossovers] = useState([]);
  const [selfRules, setSelfRules] = useState(null);

  // Initialize with sample data
  useEffect(() => {
    // Create sample block index for demo
    const sampleBlocks = {};
    const domains_list = ["Rhythm", "Timbre", "Space", "Logic", "Math"];
    const phases = ["emergence", "stabilization", "shift", "collapse"];
    
    for (let i = 1; i <= 50; i++) {
      const domain = domains_list[i % domains_list.length];
      sampleBlocks[`block_${i.toString().padStart(3, '0')}`] = {
        domain,
        layer: (i % 5) + 1,
        priority: 0.3 + Math.random() * 0.7,
        confidence: 0.5 + Math.random() * 0.5,
        phase: phases[i % phases.length],
        tags: [domain.toLowerCase(), `layer${(i % 5) + 1}`, phases[i % phases.length]],
        mutation_ready: Math.random() > 0.5,
        crossover_ready: Math.random() > 0.5,
        params: { frequency: 440 + i * 10, amplitude: 0.5 + Math.random() * 0.5 },
        intent: `Sample ${domain} block ${i}`
      };
    }
    
    setBlockIndex({ blocks: sampleBlocks });
    
    // Create sample graph
    const sampleEdges = {};
    for (const bid of Object.keys(sampleBlocks)) {
      const edges = [];
      const numEdges = 1 + Math.floor(Math.random() * 4);
      for (let j = 0; j < numEdges; j++) {
        const targetIdx = Math.floor(Math.random() * 50) + 1;
        edges.push({ target: `block_${targetIdx.toString().padStart(3, '0')}`, weight: Math.random() });
      }
      sampleEdges[bid] = edges;
    }
    setGraph({ edges: sampleEdges });
    
    // Create sample embeddings
    const sampleEmbeddings = { blocks: {} };
    for (const bid of Object.keys(sampleBlocks)) {
      const vector = {};
      const terms = ["rhythm", "timbre", "space", "logic", "texture", "industrial", "ambient"];
      for (const term of terms) {
        vector[term] = Math.random();
      }
      sampleEmbeddings.blocks[bid] = { vector };
    }
    setEmbeddings(sampleEmbeddings);
  }, []);

  const handleBuild = async (version = "v1") => {
    if (!blockIndex) return;
    
    setIsGenerating(true);
    
    const config = {
      intent,
      domains,
      layers,
      max_blocks: maxBlocks,
      temperature,
      blockIndex,
      graph,
      rules: DEFAULT_RULES
    };
    
    if (version === "v3") {
      config.runs = runs;
      config.embeddings = embeddings;
    }
    
    // Simulate async generation
    setTimeout(() => {
      const result = version === "v3" 
        ? genLayer.buildV3(config)
        : genLayer.build(config);
      
      setGenerationResult(result);
      setIsGenerating(false);
    }, 500);
  };

  const handleMutate = () => {
    if (!blockIndex) return;
    const { report, mutations: muts } = genLayer.runMutationEngine(blockIndex, 10);
    setMutations(muts);
  };

  const handleCrossover = () => {
    if (!blockIndex) return;
    const { report, crossovers: crosses } = genLayer.runCrossoverEngine(blockIndex, 5);
    setCrossovers(crosses);
  };

  const handleSelfRules = () => {
    if (!blockIndex || !graph) return;
    const rules = genLayer.runSelfRuleEngine(blockIndex, graph);
    setSelfRules(rules);
  };

  const exportResult = () => {
    if (!generationResult) return;
    const blob = new Blob([JSON.stringify(generationResult, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `generation_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearMemory = () => {
    localStorage.removeItem("mmss.generation.memory_v3");
    alert("Memory cleared");
  };

  const toggleDomain = (d) => {
    if (domains.includes(d)) {
      setDomains(domains.filter(x => x !== d));
    } else {
      setDomains([...domains, d]);
    }
  };

  const toggleLayer = (l) => {
    if (layers.includes(l)) {
      setLayers(layers.filter(x => x !== l));
    } else {
      setLayers([...layers, l]);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#020202] text-cyan-500 p-4 font-mono">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-cyan-950">
              <Cpu size={20} className="text-cyan-500" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                <Dna size={16} className="text-pink-500" />
                PYTHON GENERATION LAYER
                <span className="text-pink-500 italic text-sm">v3.0</span>
              </h1>
              <div className="flex gap-3 text-[9px] uppercase tracking-[0.3em] text-cyan-800">
                <span>Builder: READY</span>
                <span className="text-pink-900">/</span>
                <span>Mutation: READY</span>
                <span className="text-pink-900">/</span>
                <span>Crossover: READY</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {["builder", "mutation", "crossover", "self-rules", "memory"].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1 text-[10px] font-bold border transition-all ${activeTab === tab ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800"}`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Builder Tab */}
        {activeTab === "builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Target size={14}/>} title="BUILDER_CONFIG" />
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Intent</label>
                  <textarea
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    className="w-full h-16 bg-[#050505] border border-cyan-900 rounded p-2 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none resize-none"
                    placeholder="Describe your generation intent..."
                  />
                </div>
                
                <div>
                  <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Domains</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {["Rhythm", "Timbre", "Space", "Logic", "Math"].map(d => (
                      <button
                        key={d}
                        onClick={() => toggleDomain(d)}
                        className={`px-3 py-1 text-[10px] border transition-all ${domains.includes(d) ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800"}`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Layers</label>
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map(l => (
                      <button
                        key={l}
                        onClick={() => toggleLayer(l)}
                        className={`w-8 h-8 text-[10px] border transition-all ${layers.includes(l) ? "border-pink-500 text-pink-500 bg-pink-500/10" : "border-cyan-900 text-cyan-800"}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Max Blocks</label>
                    <input
                      type="number"
                      value={maxBlocks}
                      onChange={(e) => setMaxBlocks(Number(e.target.value))}
                      className="w-full bg-[#050505] border border-cyan-900 rounded p-2 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Temperature</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={temperature}
                      onChange={(e) => setTemperature(Number(e.target.value))}
                      className="w-full bg-[#050505] border border-cyan-900 rounded p-2 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-[10px] text-cyan-700 uppercase tracking-wider">Runs (V3 only)</label>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={runs}
                    onChange={(e) => setRuns(Number(e.target.value))}
                    className="w-full accent-pink-600"
                  />
                  <div className="text-[10px] text-cyan-800">{runs} runs</div>
                </div>
                
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => handleBuild("v1")}
                    disabled={isGenerating}
                    className="flex-1 py-2 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 font-bold text-xs rounded transition-all disabled:opacity-50"
                  >
                    {isGenerating ? "..." : "BUILD V1"}
                  </button>
                  <button
                    onClick={() => handleBuild("v3")}
                    disabled={isGenerating}
                    className="flex-1 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all disabled:opacity-50"
                  >
                    {isGenerating ? "..." : "BUILD V3"}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="GENERATION_OUTPUT" />
              
              <div className="h-96 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {generationResult ? (
                  <div className="space-y-2">
                    <div className="text-pink-500 font-bold border-b border-cyan-950 pb-2">
                      Intent: {generationResult.meta?.intent}
                    </div>
                    <div className="text-cyan-600">
                      Blocks: {generationResult.meta?.block_count} | 
                      Score: {generationResult.meta?.run_score || "N/A"} |
                      Valid: {generationResult.meta?.validation?.valid ? "✓" : "✗"}
                    </div>
                    
                    {generationResult.blocks?.map((block, i) => (
                      <div key={block.id || i} className="border-l-2 border-cyan-800 pl-2 py-1">
                        <div className="flex justify-between">
                          <span className="text-pink-500 font-bold">{block.id || `block_${i}`}</span>
                          <span className="text-cyan-800">{block.domain}</span>
                        </div>
                        <div className="text-cyan-700 text-[10px]">
                          L{block.layer} | P:{(block.priority || 0).toFixed(2)} | C:{(block.confidence || 0).toFixed(2)}
                        </div>
                        {block.phase && (
                          <div className="text-cyan-800 text-[10px]">Phase: {block.phase}</div>
                        )}
                      </div>
                    ))}
                    
                    {generationResult.meta?.validation?.errors?.length > 0 && (
                      <div className="text-red-500 mt-2">
                        <div className="font-bold">Errors:</div>
                        {generationResult.meta.validation.errors.map((e, i) => (
                          <div key={i} className="text-[10px]">• {e}</div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-cyan-900 italic">Generation result will appear here...</div>
                )}
              </div>
              
              <button
                onClick={exportResult}
                disabled={!generationResult}
                className="mt-4 w-full py-2 border border-cyan-700 text-cyan-600 hover:bg-cyan-950 font-bold text-xs rounded transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download size={12}/> EXPORT RESULT
              </button>
            </div>
          </div>
        )}

        {/* Mutation Tab */}
        {activeTab === "mutation" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Zap size={14}/>} title="MUTATION_ENGINE" />
              
              <div className="text-xs text-cyan-700 space-y-2">
                <p>Generates mutated variants of existing blocks using:</p>
                <div className="grid grid-cols-1 gap-1 text-[10px]">
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">param_shift</span>: +/- 10% parameter variation</div>
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">phase_shift</span>: Change phase state</div>
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">detail_amplification</span>: Boost priority</div>
                </div>
              </div>
              
              <button
                onClick={handleMutate}
                className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all"
              >
                RUN MUTATION ENGINE
              </button>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="MUTATIONS" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {mutations.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-pink-500 font-bold">Generated: {mutations.length} mutations</div>
                    {mutations.map((m, i) => (
                      <div key={m.id} className="border-l-2 border-pink-900 pl-2 py-1">
                        <div className="flex justify-between">
                          <span className="text-pink-400">{m.id}</span>
                          <span className="text-cyan-800 text-[10px]">{m.origin?.mutation_type}</span>
                        </div>
                        <div className="text-cyan-700 text-[10px]">Parent: {m.origin?.parents?.[0]}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-cyan-900 italic">Run mutation engine to see results...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Crossover Tab */}
        {activeTab === "crossover" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<GitMerge size={14}/>} title="CROSSOVER_ENGINE" />
              
              <div className="text-xs text-cyan-700 space-y-2">
                <p>Creates hybrid blocks by combining two parents:</p>
                <div className="grid grid-cols-1 gap-1 text-[10px]">
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">params_union</span>: Same domain merge</div>
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">shared_domain_merge</span>: Adjacent layer merge</div>
                </div>
              </div>
              
              <button
                onClick={handleCrossover}
                className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all"
              >
                RUN CROSSOVER ENGINE
              </button>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="CROSSOVERS" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {crossovers.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-pink-500 font-bold">Generated: {crossovers.length} crossovers</div>
                    {crossovers.map((c, i) => (
                      <div key={c.id} className="border-l-2 border-cyan-800 pl-2 py-1">
                        <div className="flex justify-between">
                          <span className="text-cyan-400">{c.id}</span>
                          <span className="text-cyan-800 text-[10px]">{c.origin?.strategy}</span>
                        </div>
                        <div className="text-cyan-700 text-[10px]">
                          Parents: {c.origin?.parents?.join(" × ")}
                        </div>
                        <div className="text-cyan-800 text-[10px]">Domain: {c.domain} | Layer: {c.layer}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-cyan-900 italic">Run crossover engine to see results...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Self-Rules Tab */}
        {activeTab === "self-rules" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Brain size={14}/>} title="SELF_RULE_ENGINE" />
              
              <div className="text-xs text-cyan-700 space-y-2">
                <p>Analyzes graph patterns to generate rules:</p>
                <div className="grid grid-cols-1 gap-1 text-[10px]">
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">Domain Affinity</span>: Detect domain pairs</div>
                  <div className="bg-cyan-950/20 p-2 rounded">• <span className="text-pink-500">Layer Correlation</span>: Detect layer patterns</div>
                </div>
              </div>
              
              <button
                onClick={handleSelfRules}
                className="w-full py-3 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all"
              >
                ANALYZE & GENERATE RULES
              </button>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Code2 size={14}/>} title="GENERATED_RULES" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {selfRules ? (
                  <div className="space-y-2">
                    <div className="text-pink-500 font-bold">Version: {selfRules.version}</div>
                    <div className="text-cyan-600">Rules: {selfRules.generated_rules?.length || 0}</div>
                    
                    {selfRules.generated_rules?.map((rule, i) => (
                      <div key={i} className="border-l-2 border-cyan-800 pl-2 py-1">
                        <div className="flex justify-between">
                          <span className="text-cyan-400">{rule.name}</span>
                          <span className="text-pink-500 text-[10px]">w:{rule.weight}</span>
                        </div>
                        <div className="text-cyan-700 text-[10px]">Type: {rule.type}</div>
                        <div className="text-cyan-800 text-[10px]">
                          Evidence: {JSON.stringify(rule.evidence)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-cyan-900 italic">Run self-rule engine to see results...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Memory Tab */}
        {activeTab === "memory" && (
          <div className="bg-black border border-cyan-900 rounded-xl p-6">
            <SectionHeader icon={<Activity size={14}/>} title="MEMORY_V3" />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <MemoryStats />
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={clearMemory}
                  className="w-full py-3 bg-red-900/50 hover:bg-red-800 text-red-300 font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 size={12}/> CLEAR MEMORY
                </button>
                
                <div className="bg-cyan-950/10 border border-cyan-900/50 rounded p-4 text-[10px] text-cyan-700 space-y-1">
                  <div className="font-bold text-cyan-600">Memory Structure:</div>
                  <div>• block_stats: usage, success_score</div>
                  <div>• intent_stats: intent → block mapping</div>
                  <div>• generation_stats: lineage tracking</div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
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

function MemoryStats() {
  const [stats, setStats] = useState(null);
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem("mmss.generation.memory_v3");
      if (saved) {
        setStats(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Failed to load memory stats");
    }
  }, []);
  
  if (!stats) {
    return (
      <div className="h-48 flex items-center justify-center text-cyan-900 text-xs italic">
        No memory data available
      </div>
    );
  }
  
  return (
    <div className="h-48 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
      <div className="space-y-4">
        <div>
          <div className="text-pink-500 font-bold">Block Stats ({Object.keys(stats.block_stats || {}).length} blocks)</div>
          {Object.entries(stats.block_stats || {}).slice(0, 10).map(([bid, s]) => (
            <div key={bid} className="text-cyan-700 text-[10px] flex justify-between">
              <span>{bid}</span>
              <span>use:{s.usage_count} score:{(s.success_score || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
        
        <div>
          <div className="text-pink-500 font-bold">Intent Stats ({Object.keys(stats.intent_stats || {}).length} intents)</div>
          {Object.entries(stats.intent_stats || {}).slice(0, 5).map(([intent, blocks]) => (
            <div key={intent} className="text-cyan-700 text-[10px]">
              "{intent.slice(0, 30)}..." → {Object.keys(blocks).length} blocks
            </div>
          ))}
        </div>
        
        <div>
          <div className="text-pink-500 font-bold">Generation Stats ({Object.keys(stats.generation_stats || {}).length} gens)</div>
          {Object.entries(stats.generation_stats || {}).slice(0, 5).map(([gen, s]) => (
            <div key={gen} className="text-cyan-700 text-[10px] flex justify-between">
              <span>{gen}</span>
              <span>stability: {(s.stability_score || 0).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
