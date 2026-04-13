import React, { useState, useEffect } from "react";
import { Brain, Key, Wand2, Sparkles, AlertTriangle, CheckCircle, Terminal, Activity, Zap, Shield, RefreshCw } from "lucide-react";
import { useMistralOrchestrator } from "../../services/MistralOrchestrator";
import { usePythonBridge, DEFAULT_RULES } from "../../services/PythonBridge";

export default function AIOrchestratorPanel() {
  const mistral = useMistralOrchestrator();
  const pythonBridge = usePythonBridge();
  
  // API Key state
  const [apiKey, setApiKey] = useState("");
  const [apiStatus, setApiStatus] = useState({ configured: false, checking: false });
  
  // Rule generation state
  const [intent, setIntent] = useState("");
  const [generatedRules, setGeneratedRules] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Phi optimization state
  const [processInput, setProcessInput] = useState("");
  const [phiResult, setPhiResult] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  // Plan generation state
  const [planIntent, setPlanIntent] = useState("");
  const [generationPlan, setGenerationPlan] = useState(null);
  const [isPlanning, setIsPlanning] = useState(false);
  
  // Validation state
  const [blocks, setBlocks] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  
  // Active tab
  const [activeTab, setActiveTab] = useState("config");

  useEffect(() => {
    const savedKey = mistral.getApiKey();
    if (savedKey) {
      setApiKey(savedKey);
      checkApiStatus(savedKey);
    }
  }, []);

  const checkApiStatus = async (key) => {
    setApiStatus({ configured: !!key, checking: true });
    const status = mistral.getMistralStatus();
    setApiStatus({ ...status, checking: false });
  };

  const handleSaveApiKey = () => {
    mistral.setApiKey(apiKey);
    checkApiStatus(apiKey);
  };

  const handleGenerateRules = async () => {
    if (!intent.trim()) return;
    setIsGenerating(true);
    
    const result = await mistral.generateRules(intent, ["Logic", "Audio", "Visual", "Math", "Physics"], [1, 2, 3, 4, 5]);
    
    if (result.ok) {
      setGeneratedRules(result.data);
    } else {
      setGeneratedRules({ error: result.error });
    }
    setIsGenerating(false);
  };

  const handleApplyPhi = async () => {
    if (!processInput.trim()) return;
    setIsOptimizing(true);
    
    const result = await mistral.applyPhiTotal(processInput, "ASE Console Context");
    
    if (result.ok) {
      const content = mistral.extractContentFromResponse(result);
      setPhiResult({ content, tokens: result.data?.usage });
    } else {
      setPhiResult({ error: result.error });
    }
    setIsOptimizing(false);
  };

  const handlePlanGeneration = async () => {
    if (!planIntent.trim()) return;
    setIsPlanning(true);
    
    const result = await mistral.planGeneration(planIntent, ["Logic", "Audio", "Visual", "Math"], [1, 2, 3, 4]);
    
    if (result.ok) {
      setGenerationPlan(result.data);
    } else {
      setGenerationPlan({ error: result.error });
    }
    setIsPlanning(false);
  };

  const handleValidateBlocks = () => {
    const result = pythonBridge.validateSelection(blocks);
    setValidationResult(result);
  };

  const addSampleBlock = () => {
    const domains = ["Logic", "Audio", "Visual", "Math", "Physics"];
    const domain = domains[Math.floor(Math.random() * domains.length)];
    const newBlock = {
      id: `block_${Date.now()}`,
      attr: {
        domain,
        layer: Math.floor(Math.random() * 5) + 1,
        entropy: { p: Math.random(), c: Math.random() },
        negentropy: 0.5 + Math.random() * 0.5,
        divergence: 1 + Math.random() * 2
      }
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  return (
    <div className="min-h-screen w-full bg-[#020202] text-cyan-500 p-4 font-mono">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className={`p-2 rounded-full ${apiStatus.configured ? "bg-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.3)]" : "bg-cyan-950"}`}>
              <Brain size={20} className={apiStatus.configured ? "text-green-500" : "text-cyan-900"} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                <Sparkles size={16} className="text-pink-500" />
                AI ORCHESTRATOR
                <span className="text-pink-500 italic text-sm">v1.MISTRAL</span>
              </h1>
              <div className="flex gap-3 text-[9px] uppercase tracking-[0.3em] text-cyan-800">
                <span>Mistral: {apiStatus.configured ? "● CONNECTED" : "○ DISCONNECTED"}</span>
                <span className="text-pink-900">/</span>
                <span>Model: mistral-large-latest</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            {["config", "rules", "phi", "plan", "validate"].map(tab => (
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

        {/* Config Tab */}
        {activeTab === "config" && (
          <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
            <SectionHeader icon={<Key size={14}/>} title="MISTRAL_API_CONFIGURATION" />
            
            <div className="space-y-4 max-w-2xl">
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Enter Mistral API Key..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-[#050505] border border-cyan-900 rounded px-4 py-2 text-sm text-cyan-500 focus:border-pink-500 focus:outline-none"
                />
                <button
                  onClick={handleSaveApiKey}
                  className="px-6 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all"
                >
                  SAVE KEY
                </button>
              </div>
              
              <div className={`flex items-center gap-2 text-xs ${apiStatus.configured ? "text-green-500" : "text-yellow-600"}`}>
                {apiStatus.configured ? <CheckCircle size={14}/> : <AlertTriangle size={14}/>}
                {apiStatus.configured ? "API Key configured successfully" : "API Key required for AI features"}
              </div>
              
              <div className="bg-cyan-950/10 border border-cyan-900/50 rounded p-4 text-xs text-cyan-700 space-y-1">
                <div className="font-bold text-pink-500 mb-2">Available Features:</div>
                <div className="flex items-center gap-2"><Zap size={10}/> Rule Generation from intent</div>
                <div className="flex items-center gap-2"><RefreshCw size={10}/> Phi-total optimization</div>
                <div className="flex items-center gap-2"><Activity size={10}/> Generation planning</div>
                <div className="flex items-center gap-2"><Shield size={10}/> Output critique & validation</div>
              </div>
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === "rules" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Wand2 size={14}/>} title="AI_RULE_GENERATION" />
              
              <div className="space-y-4">
                <textarea
                  placeholder="Enter intent for rule generation (e.g., 'optimize audio-visual synchronization with high negentropy')..."
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  className="w-full h-24 bg-[#050505] border border-cyan-900 rounded p-3 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none resize-none"
                />
                <button
                  onClick={handleGenerateRules}
                  disabled={!apiStatus.configured || isGenerating}
                  className={`w-full py-2 font-bold text-xs rounded transition-all ${apiStatus.configured && !isGenerating ? "bg-pink-600 hover:bg-pink-500 text-white" : "bg-cyan-950 text-cyan-800 cursor-not-allowed"}`}
                >
                  {isGenerating ? "GENERATING..." : "GENERATE RULES"}
                </button>
              </div>
              
              <div className="bg-cyan-950/10 border border-cyan-900/50 rounded p-3 text-xs text-cyan-700">
                <div className="font-bold mb-1">Default Rules Available:</div>
                {DEFAULT_RULES.composition_rules.map(r => (
                  <div key={r.name} className="ml-2">• {r.name}: {r.logic}</div>
                ))}
              </div>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="GENERATED_RULES_OUTPUT" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {generatedRules ? (
                  generatedRules.error ? (
                    <div className="text-red-500">{generatedRules.error}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-pink-500 font-bold">{generatedRules.explanation}</div>
                      <pre className="text-cyan-600">{JSON.stringify(generatedRules.rules, null, 2)}</pre>
                    </div>
                  )
                ) : (
                  <div className="text-cyan-900 italic">Generated rules will appear here...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phi Tab */}
        {activeTab === "phi" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<RefreshCw size={14}/>} title="Φ-TOTAL_OPTIMIZATION" />
              
              <div className="space-y-4">
                <textarea
                  placeholder="Describe process to optimize with Φ-total (e.g., 'recursive audio decomposition pipeline')..."
                  value={processInput}
                  onChange={(e) => setProcessInput(e.target.value)}
                  className="w-full h-24 bg-[#050505] border border-cyan-900 rounded p-3 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none resize-none"
                />
                <button
                  onClick={handleApplyPhi}
                  disabled={!apiStatus.configured || isOptimizing}
                  className={`w-full py-2 font-bold text-xs rounded transition-all ${apiStatus.configured && !isOptimizing ? "bg-pink-600 hover:bg-pink-500 text-white" : "bg-cyan-950 text-cyan-800 cursor-not-allowed"}`}
                >
                  {isOptimizing ? "OPTIMIZING..." : "APPLY Φ-TOTAL"}
                </button>
              </div>
              
              <div className="text-[10px] text-cyan-800 space-y-1">
                <div className="font-bold text-cyan-600">Φ-total applies:</div>
                <div>• Fixed-point optimization (Ψ ↦ Ψ)</div>
                <div>• Negentropy conservation (η ≥ 0.5)</div>
                <div>• Golden ratio resonance (φ = 1.618)</div>
              </div>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="OPTIMIZATION_RESULT" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {phiResult ? (
                  phiResult.error ? (
                    <div className="text-red-500">{phiResult.error}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-cyan-400 whitespace-pre-wrap">{phiResult.content}</div>
                      {phiResult.tokens && (
                        <div className="text-cyan-800 pt-2 border-t border-cyan-950">
                          Tokens: {phiResult.tokens.total} (P: {phiResult.tokens.prompt}, C: {phiResult.tokens.completion})
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  <div className="text-cyan-900 italic">Optimization result will appear here...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Plan Tab */}
        {activeTab === "plan" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Activity size={14}/>} title="GENERATION_PLANNING" />
              
              <div className="space-y-4">
                <textarea
                  placeholder="Describe generation intent for AI planning..."
                  value={planIntent}
                  onChange={(e) => setPlanIntent(e.target.value)}
                  className="w-full h-24 bg-[#050505] border border-cyan-900 rounded p-3 text-xs text-cyan-500 focus:border-pink-500 focus:outline-none resize-none"
                />
                <button
                  onClick={handlePlanGeneration}
                  disabled={!apiStatus.configured || isPlanning}
                  className={`w-full py-2 font-bold text-xs rounded transition-all ${apiStatus.configured && !isPlanning ? "bg-pink-600 hover:bg-pink-500 text-white" : "bg-cyan-950 text-cyan-800 cursor-not-allowed"}`}
                >
                  {isPlanning ? "PLANNING..." : "GENERATE PLAN"}
                </button>
              </div>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="GENERATION_PLAN" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {generationPlan ? (
                  generationPlan.error ? (
                    <div className="text-red-500">{generationPlan.error}</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-pink-500 font-bold">Mode: {generationPlan.recommendedMode}</div>
                      <div className="text-cyan-600">Domains: {generationPlan.domains?.join(", ")}</div>
                      <div className="text-cyan-600">Layers: {generationPlan.layers?.join(", ")}</div>
                      <div className="text-cyan-700 pt-2">Rationale:</div>
                      {generationPlan.rationale?.map((r, i) => (
                        <div key={i} className="text-cyan-800 ml-2">• {r}</div>
                      ))}
                      <pre className="text-cyan-800 pt-2">{JSON.stringify(generationPlan.hyperParams, null, 2)}</pre>
                    </div>
                  )
                ) : (
                  <div className="text-cyan-900 italic">Generation plan will appear here...</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Validate Tab */}
        {activeTab === "validate" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black border border-cyan-900 rounded-xl p-6 space-y-4">
              <SectionHeader icon={<Shield size={14}/>} title="RULE_VALIDATION_ENGINE" />
              
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={addSampleBlock}
                    className="flex-1 py-2 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 font-bold text-xs rounded transition-all"
                  >
                    + ADD SAMPLE BLOCK
                  </button>
                  <button
                    onClick={handleValidateBlocks}
                    disabled={blocks.length === 0}
                    className="flex-1 py-2 bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs rounded transition-all disabled:opacity-50"
                  >
                    VALIDATE
                  </button>
                </div>
                
                <div className="text-[10px] text-cyan-800">Blocks: {blocks.length}</div>
                
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {blocks.map(block => (
                    <div key={block.id} className="flex justify-between items-center bg-cyan-950/10 border border-cyan-900/50 rounded p-2 text-xs">
                      <div className="text-cyan-600">
                        <span className="text-pink-500">{block.attr.domain}</span> | Layer {block.attr.layer} | η: {block.attr.negentropy.toFixed(2)}
                      </div>
                      <button
                        onClick={() => removeBlock(block.id)}
                        className="text-cyan-800 hover:text-red-500"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="bg-black border border-cyan-900 rounded-xl p-6">
              <SectionHeader icon={<Terminal size={14}/>} title="VALIDATION_REPORT" />
              
              <div className="h-64 overflow-y-auto bg-[#050505] rounded border border-cyan-950 p-3 text-xs font-mono">
                {validationResult ? (
                  <div className="space-y-2">
                    <div className={`font-bold ${validationResult.valid ? "text-green-500" : "text-red-500"}`}>
                      Status: {validationResult.valid ? "VALID ✓" : "INVALID ✗"}
                    </div>
                    {validationResult.errors?.length > 0 && (
                      <div className="text-red-400">
                        <div className="font-bold">Errors:</div>
                        {validationResult.errors.map((e, i) => <div key={i}>• {e}</div>)}
                      </div>
                    )}
                    {validationResult.warnings?.length > 0 && (
                      <div className="text-yellow-500">
                        <div className="font-bold">Warnings:</div>
                        {validationResult.warnings.map((w, i) => <div key={i}>• {w}</div>)}
                      </div>
                    )}
                    {validationResult.suggestions?.length > 0 && (
                      <div className="text-cyan-600 pt-2 border-t border-cyan-950">
                        <div className="font-bold">Suggestions:</div>
                        {validationResult.suggestions.map((s, i) => <div key={i}>→ {s}</div>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-cyan-900 italic">Validation report will appear here...</div>
                )}
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
