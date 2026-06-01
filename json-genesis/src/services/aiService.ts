import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MISTRAL_API_KEY = (import.meta as any).env.VITE_MISTRAL_API_KEY || "";
const MISTRAL_PROXY_URL = "http://localhost:3456/api/mistral/chat";
type MistralProxyMode = 'plan' | 'generate' | 'validate';

// Re-initialize for each call to ensure latest key is used if it changes
const getAi = () => new GoogleGenAI({ apiKey: GEMINI_API_KEY });

interface GenOptions {
  mode: 'augment' | 'rewrite' | 'skeleton';
  rules?: string;
  onProgress?: (message: string) => void;
  libraryContext?: string;
}

export interface MistralLibraryPlan {
  queries: string[];
  principles: string[];
  notes: string[];
  blockRoles: string[];
  metaDirectives: string[];
}

function safePayloadPreview(value: unknown, maxLength = 600) {
  try {
    return JSON.stringify(value).slice(0, maxLength);
  } catch (_error) {
    return String(value).slice(0, maxLength);
  }
}

function extractMistralContent(payload: any, sourceLabel: string): string {
  if (payload?.error) {
    throw new Error(payload?.error?.message || payload?.error || `${sourceLabel} returned an error payload`);
  }

  const firstChoice = Array.isArray(payload?.choices) ? payload.choices[0] : null;
  if (!firstChoice) {
    throw new Error(`${sourceLabel} returned no choices: ${safePayloadPreview(payload)}`);
  }

  const content = firstChoice?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const merged = content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        if (typeof part?.content === "string") return part.content;
        return "";
      })
      .join("")
      .trim();

    if (merged) {
      return merged;
    }
  }

  throw new Error(`${sourceLabel} returned empty message content: ${safePayloadPreview(firstChoice)}`);
}

function parseJsonFromMistralPayload(payload: any, sourceLabel: string) {
  const rawContent = extractMistralContent(payload, sourceLabel).trim();
  const normalizedContent = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(normalizedContent);
  } catch (error) {
    throw new Error(
      `${sourceLabel} returned non-JSON content: ${error instanceof Error ? error.message : "parse failed"} :: ${normalizedContent.slice(0, 400)}`,
    );
  }
}

async function callMistralProxy(
  mode: MistralProxyMode,
  prompt: string,
  overrides: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {},
) {
  const response = await fetch(MISTRAL_PROXY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode,
      prompt,
      model: overrides.model || "mistral-small-latest",
      temperature: overrides.temperature,
      max_tokens: overrides.max_tokens,
    }),
  });

  const proxyText = await response.text();
  const proxyData = proxyText ? JSON.parse(proxyText) : {};
  if (!response.ok) {
    throw new Error(proxyData?.error || `Mistral proxy failed with HTTP ${response.status}`);
  }
  return proxyData;
}

async function callMistralDirect(
  mode: MistralProxyMode,
  prompt: string,
  overrides: {
    model?: string;
    temperature?: number;
    max_tokens?: number;
  } = {},
) {
  const modeDefaults = {
    plan: { temperature: 0.2, max_tokens: 1200 },
    generate: { temperature: 0.4, max_tokens: 4096 },
    validate: { temperature: 0.15, max_tokens: 1800 },
  } as const;

  const defaults = modeDefaults[mode];
  const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${MISTRAL_API_KEY}`
    },
    body: JSON.stringify({
      model: overrides.model || "mistral-small-latest",
      messages: [{ role: "user", content: prompt }],
      temperature: overrides.temperature ?? defaults.temperature,
      max_tokens: overrides.max_tokens ?? defaults.max_tokens,
      response_format: { type: "json_object" }
    })
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : {};
  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Mistral ${mode} failed with HTTP ${response.status}`);
  }
  return data;
}

export async function generateWithGemini(prompt: string, structure?: string, options?: GenOptions) {
  try {
    options?.onProgress?.('Preparing Gemini request');
    const ai = getAi();
    const modeInstruction = {
      augment: "Fill in missing values or extend with new meaningful keys based on the existing structure and user prompt.",
      rewrite: "Completely recreate the JSON from scratch based on the user prompt. Use the existing structure as a loose inspiration if present.",
      skeleton: "Only generate the structure and keys. Use null, empty strings, or 0 for values to define the schema/skeleton only."
    }[options?.mode || 'augment'];

    const fullPrompt = `You are a JSON Genesis System.
Generation Mode: ${options?.mode || 'augment'}
Instruction: ${modeInstruction}
${options?.rules ? `Assembly Rules: ${options.rules}` : ''}
${options?.libraryContext ? `MMSS Library Context: ${options.libraryContext}` : ''}

Existing Context Structure: ${structure || 'N/A'}

Target Task: ${prompt}

IMPORTANT: Return ONLY a valid JSON object. No markdown, no conversation.`;
    
    options?.onProgress?.('Sending prompt to Gemini');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: fullPrompt }] }],
      config: {
        responseMimeType: "application/json"
      }
    });

    options?.onProgress?.('Parsing Gemini response');
    const text = response.text || "";
    return JSON.parse(text);
  } catch (err) {
    console.error("Gemini Error:", err);
    throw err;
  }
}

export async function generateWithMistral(prompt: string, structure?: string, options?: GenOptions) {
  try {
    options?.onProgress?.('Preparing Mistral request');
    const modeInstruction = {
      augment: "Fill in missing values or extend with new meaningful keys.",
      rewrite: "Completely recreate JSON.",
      skeleton: "Only structure/keys, values should be null/0."
    }[options?.mode || 'augment'];

    const fullPrompt = `Mode: ${options?.mode || 'augment'}
Rules: ${options?.rules || 'None'}
MMSS Library Context: ${options?.libraryContext || 'None'}
Context: ${structure || 'None'}
Action: ${prompt}
Instruction: ${modeInstruction}
Return JSON strictly.`;

    if (!MISTRAL_API_KEY) {
      options?.onProgress?.('Sending prompt to local Mistral proxy');
      options?.onProgress?.('Parsing Mistral proxy response');
      const proxyData = await callMistralProxy('generate', fullPrompt, {
        model: "mistral-small-latest",
        temperature: 0.4,
        max_tokens: 4096,
      });
      return parseJsonFromMistralPayload(proxyData, 'Mistral proxy');
    }

    options?.onProgress?.('Sending prompt to Mistral');
    options?.onProgress?.('Parsing Mistral response');
    const data = await callMistralDirect('generate', fullPrompt, {
      model: "mistral-small-latest",
      temperature: 0.4,
      max_tokens: 4096,
    });
    return parseJsonFromMistralPayload(data, 'Mistral');
  } catch (err) {
    console.error("Mistral Error:", err);
    throw err;
  }
}

export async function planMistralLibraryQueries(prompt: string, librarySummary: string, onProgress?: (message: string) => void): Promise<MistralLibraryPlan> {
  const planningPrompt = `You are preparing a retrieval plan for an MMSS JSON library.
Return strict JSON with keys: queries, principles, notes, blockRoles, metaDirectives.
- queries: short search phrases to retrieve the best library blocks for the task
- principles: MMSS principles or construction patterns to preserve
- notes: brief reasoning about what should be selected
- blockRoles: desired kinds of blocks to retrieve, such as schema, principle, operator, example, metrics, rule
- metaDirectives: MMSS-specific formula or metric directives that should be included in the generation context

Task: ${prompt}
Library Summary: ${librarySummary}
`;

  try {
    onProgress?.('Planning Mistral library queries');

    if (!MISTRAL_API_KEY) {
      const proxyData = await callMistralProxy('plan', planningPrompt, {
        model: "mistral-small-latest",
        temperature: 0.2,
        max_tokens: 1200,
      });
      return normalizePlan(parseJsonFromMistralPayload(proxyData, 'Mistral plan proxy'));
    }

    const data = await callMistralDirect('plan', planningPrompt, {
      model: "mistral-small-latest",
      temperature: 0.2,
      max_tokens: 1200,
    });
    return normalizePlan(parseJsonFromMistralPayload(data, 'Mistral plan'));
  } catch (err) {
    console.error("Mistral Plan Error:", err);
    throw err;
  }
}

export async function validateWithMistral(generatedJson: unknown, mmssContextSummary: string) {
  const validationPrompt = `You are validating an MMSS JSON generation result.
Return strict JSON with keys: valid, issues, warnings, strengths, suggestedFixes.

MMSS Context Summary:
${mmssContextSummary}

Generated JSON:
${JSON.stringify(generatedJson, null, 2)}
`;

  if (!MISTRAL_API_KEY) {
    const proxyData = await callMistralProxy('validate', validationPrompt, {
      model: "mistral-small-latest",
      temperature: 0.15,
      max_tokens: 1800,
    });
    return parseJsonFromMistralPayload(proxyData, 'Mistral validate proxy');
  }

  const data = await callMistralDirect('validate', validationPrompt, {
    model: "mistral-small-latest",
    temperature: 0.15,
    max_tokens: 1800,
  });
  return parseJsonFromMistralPayload(data, 'Mistral validate');
}

function normalizePlan(raw: any): MistralLibraryPlan {
  return {
    queries: Array.isArray(raw?.queries) ? raw.queries.map(String).filter(Boolean) : [],
    principles: Array.isArray(raw?.principles) ? raw.principles.map(String).filter(Boolean) : [],
    notes: Array.isArray(raw?.notes) ? raw.notes.map(String).filter(Boolean) : [],
    blockRoles: Array.isArray(raw?.blockRoles) ? raw.blockRoles.map(String).filter(Boolean) : [],
    metaDirectives: Array.isArray(raw?.metaDirectives) ? raw.metaDirectives.map(String).filter(Boolean) : [],
  };
}
