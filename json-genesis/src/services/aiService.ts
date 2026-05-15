import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MISTRAL_API_KEY = (import.meta as any).env.VITE_MISTRAL_API_KEY || "";
const MISTRAL_PROXY_URL = "http://localhost:3456/api/mistral/chat";

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
      const proxyResponse = await fetch(MISTRAL_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: fullPrompt }],
          temperature: 0.4,
          max_tokens: 4096,
        })
      });

      options?.onProgress?.('Parsing Mistral proxy response');
      const proxyData = await proxyResponse.json();
      if (!proxyResponse.ok) {
        throw new Error(proxyData?.error || `Mistral proxy failed with HTTP ${proxyResponse.status}`);
      }
      return JSON.parse(proxyData.choices[0].message.content);
    }

    options?.onProgress?.('Sending prompt to Mistral');
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: fullPrompt }],
        response_format: { type: "json_object" }
      })
    });

    options?.onProgress?.('Parsing Mistral response');
    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return JSON.parse(data.choices[0].message.content);
  } catch (err) {
    console.error("Mistral Error:", err);
    throw err;
  }
}

export async function planMistralLibraryQueries(prompt: string, librarySummary: string, onProgress?: (message: string) => void): Promise<MistralLibraryPlan> {
  const planningPrompt = `You are preparing a retrieval plan for an MMSS JSON library.
Return strict JSON with keys: queries, principles, notes.
- queries: short search phrases to retrieve the best library blocks for the task
- principles: MMSS principles or construction patterns to preserve
- notes: brief reasoning about what should be selected

Task: ${prompt}
Library Summary: ${librarySummary}
`;

  try {
    onProgress?.('Planning Mistral library queries');

    if (!MISTRAL_API_KEY) {
      const proxyResponse = await fetch(MISTRAL_PROXY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-small-latest",
          messages: [{ role: "user", content: planningPrompt }],
          temperature: 0.2,
          max_tokens: 1200,
        })
      });

      const proxyData = await proxyResponse.json();
      if (!proxyResponse.ok) {
        throw new Error(proxyData?.error || `Mistral proxy failed with HTTP ${proxyResponse.status}`);
      }

      return normalizePlan(JSON.parse(proxyData.choices[0].message.content));
    }

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MISTRAL_API_KEY}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: [{ role: "user", content: planningPrompt }],
        response_format: { type: "json_object" }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    return normalizePlan(JSON.parse(data.choices[0].message.content));
  } catch (err) {
    console.error("Mistral Plan Error:", err);
    throw err;
  }
}

function normalizePlan(raw: any): MistralLibraryPlan {
  return {
    queries: Array.isArray(raw?.queries) ? raw.queries.map(String).filter(Boolean) : [],
    principles: Array.isArray(raw?.principles) ? raw.principles.map(String).filter(Boolean) : [],
    notes: Array.isArray(raw?.notes) ? raw.notes.map(String).filter(Boolean) : [],
  };
}
