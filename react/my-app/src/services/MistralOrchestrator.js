/**
 * Mistral Orchestrator Service
 * Provides AI-powered orchestration for ASE Console
 * Compatible with browser environment (no Electron dependencies)
 */

const MISTRAL_API_BASE = "https://api.mistral.ai/v1";
const DEFAULT_MODEL = "mistral-large-latest";

// API Key management
let apiKey = localStorage.getItem("mistral_api_key") || "";

export function setApiKey(key) {
  apiKey = key;
  localStorage.setItem("mistral_api_key", key);
}

export function getApiKey() {
  return apiKey;
}

export function hasApiKey() {
  return !!apiKey && apiKey.length > 10;
}

/**
 * Core Mistral API call
 */
export async function callMistral(messages, model = DEFAULT_MODEL, temperature = 0.7) {
  if (!hasApiKey()) {
    return { ok: false, error: "Mistral API key not configured" };
  }

  try {
    const response = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: 4096
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return { ok: false, error: `API Error: ${response.status} - ${error}` };
    }

    const data = await response.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Apply Phi-total recursive optimization
 */
export async function applyPhiTotal(process, context = "", model) {
  const messages = [
    {
      role: "system",
      content: `You are Phi-total optimizer. Apply recursive self-optimization to processes.
Rules:
1. Identify fixed points where Ψ maps to itself
2. Apply negentropy conservation (η ≥ 0.5)
3. Use golden ratio φ=1.618 for resonance
4. Output structured optimization plan`
    },
    {
      role: "user",
      content: `Process: ${process}\nContext: ${context}\nApply Phi-total optimization.`
    }
  ];

  return callMistral(messages, model || DEFAULT_MODEL, 0.3);
}

/**
 * Generate rules for composition
 */
export async function generateRulesStructured(intent, availableDomains, availableLayers, constraints = []) {
  const messages = [
    {
      role: "system",
      content: `You are a rule generation engine for the MMSS/ASE system.
Generate composition rules based on intent and available resources.
Output valid JSON with structure:
{
  "rules": {
    "composition_rules": [
      {"name": "rule_name", "logic": "rule_type", "value": ...}
    ],
    "validation_rules": [...],
    "optimization_rules": [...]
  },
  "explanation": "human readable explanation"
}`
    },
    {
      role: "user",
      content: `Intent: ${intent}
Available Domains: ${availableDomains.join(", ")}
Available Layers: ${availableLayers.join(", ")}
Constraints: ${constraints.join(", ")}

Generate appropriate rules.`
    }
  ];

  const response = await callMistral(messages, DEFAULT_MODEL, 0.2);
  
  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  try {
    const content = response.data.choices[0]?.message?.content || "";
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const jsonStr = jsonMatch[1].trim();
    const parsed = JSON.parse(jsonStr);
    
    return { 
      ok: true, 
      data: {
        rules: parsed.rules || parsed,
        explanation: parsed.explanation || "Rules generated successfully"
      }
    };
  } catch (err) {
    return { ok: false, error: `Failed to parse rules: ${err.message}` };
  }
}

/**
 * Generate composition plan with AI
 */
export async function planGeneration(intent, availableDomains, availableLayers, currentMode = "unified") {
  const messages = [
    {
      role: "system",
      content: `You are a generation planner for ASE (Autonomous Symbolic Engine).
Analyze intent and recommend optimal composition strategy.
Output JSON with:
{
  "recommendedMode": "mode_name",
  "domains": ["domain1", "domain2"],
  "layers": [1, 2, 3],
  "rationale": ["reason1", "reason2"],
  "hyperParams": {"recursion": 64, "divergence": 2.618}
}`
    },
    {
      role: "user",
      content: `Intent: ${intent}
Current Mode: ${currentMode}
Available Domains: ${availableDomains.join(", ")}
Available Layers: ${availableLayers.join(", ")}

Recommend generation plan.`
    }
  ];

  const response = await callMistral(messages, DEFAULT_MODEL, 0.3);
  
  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  try {
    const content = response.data.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const plan = JSON.parse(jsonMatch[1].trim());
    
    return { ok: true, data: plan };
  } catch (err) {
    return { ok: false, error: `Failed to parse plan: ${err.message}` };
  }
}

/**
 * Critique/analyze output
 */
export async function critiqueOutput(exportData, currentMode, intent = "") {
  const messages = [
    {
      role: "system",
      content: `You are a critique engine for ASE outputs.
Analyze strengths, weaknesses, and suggest improvements.
Output JSON with:
{
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1"],
  "nextAdjustments": ["adjustment1"],
  "estimatedQuality": 0.85
}`
    },
    {
      role: "user",
      content: `Mode: ${currentMode}
Intent: ${intent}
Data: ${JSON.stringify(exportData, null, 2)}

Provide critique.`
    }
  ];

  const response = await callMistral(messages, DEFAULT_MODEL, 0.4);
  
  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  try {
    const content = response.data.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const critique = JSON.parse(jsonMatch[1].trim());
    
    return { ok: true, data: critique };
  } catch (err) {
    return { ok: false, error: `Failed to parse critique: ${err.message}` };
  }
}

/**
 * Summarize session
 */
export async function summarizeSession(sessionName, totalMessages, recentContext) {
  const messages = [
    {
      role: "system",
      content: `Summarize ASE session concisely.
Output JSON with:
{
  "summary": "brief summary",
  "suggestedNextSteps": ["step1", "step2"],
  "tags": ["tag1", "tag2"],
  "confidence": 0.9
}`
    },
    {
      role: "user",
      content: `Session: ${sessionName}
Messages: ${totalMessages}
Recent: ${recentContext}

Summarize.`
    }
  ];

  const response = await callMistral(messages, DEFAULT_MODEL, 0.3);
  
  if (!response.ok) {
    return { ok: false, error: response.error };
  }

  try {
    const content = response.data.choices[0]?.message?.content || "";
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
    const summary = JSON.parse(jsonMatch[1].trim());
    
    return { ok: true, data: summary };
  } catch (err) {
    return { ok: false, error: `Failed to parse summary: ${err.message}` };
  }
}

/**
 * Get Mistral status
 */
export function getMistralStatus() {
  return {
    configured: hasApiKey(),
    available: hasApiKey(),
    defaultModel: DEFAULT_MODEL,
    error: hasApiKey() ? undefined : "API key not set"
  };
}

/**
 * Extract text from response
 */
export function extractContentFromResponse(response) {
  if (!response.ok || !response.data) {
    return response.error || "Unknown error";
  }
  return response.data.choices[0]?.message?.content || "No content";
}

/**
 * Convenience hook for components
 */
export function useMistralOrchestrator() {
  return {
    // Config
    setApiKey,
    getApiKey,
    hasApiKey,
    getMistralStatus,
    
    // Core
    callMistral,
    applyPhiTotal,
    extractContentFromResponse,
    
    // ASE-specific
    generateRules: generateRulesStructured,
    planGeneration,
    critiqueOutput,
    summarizeSession
  };
}

export default useMistralOrchestrator;
