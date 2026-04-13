import type { MistralMessage, MistralResponse } from '../../../shared/electron';
import type {
  CritiqueOutput,
  CritiqueOutputRequest,
  GeneratedRules,
  GenerateRulesRequest,
  GenerationPlan,
  GenerationPlanRequest,
  MistralStatus,
  SessionSummary,
  StructuredResult,
  SummarizeSessionRequest,
} from '../../../shared/mistral';

export type { MistralMessage, MistralResponse } from '../../../shared/electron';

const missingApiError = (name: string) => `${name} API not available in Electron`;

export async function callMistral(
  messages: MistralMessage[],
  model = 'mistral-large-latest',
): Promise<MistralResponse> {
  if (!window.electronAPI?.mistralChat) {
    return { ok: false, error: missingApiError('Mistral') };
  }

  return window.electronAPI.mistralChat({ messages, model });
}

export async function applyPhiTotal(
  process: string,
  context?: string,
  model?: string,
): Promise<MistralResponse> {
  if (!window.electronAPI?.mistralApplyPhi) {
    return { ok: false, error: missingApiError('PhiTotal') };
  }

  return window.electronAPI.mistralApplyPhi({ process, context, model });
}

export async function getMistralStatus(): Promise<MistralStatus> {
  if (!window.electronAPI?.getMistralStatus) {
    return {
      configured: false,
      available: false,
      defaultModel: 'mistral-large-latest',
      error: missingApiError('Mistral status'),
    };
  }

  return window.electronAPI.getMistralStatus();
}

export async function planGenerationWithMistral(
  payload: GenerationPlanRequest,
): Promise<StructuredResult<GenerationPlan>> {
  if (!window.electronAPI?.mistralPlanGeneration) {
    return { ok: false, error: missingApiError('Plan generation') };
  }

  return window.electronAPI.mistralPlanGeneration(payload);
}

export async function generateRulesStructured(
  payload: GenerateRulesRequest,
): Promise<StructuredResult<GeneratedRules>> {
  if (!window.electronAPI?.mistralGenerateRules) {
    return { ok: false, error: missingApiError('Rule generation') };
  }

  return window.electronAPI.mistralGenerateRules(payload);
}

export async function critiqueOutputWithMistral(
  payload: CritiqueOutputRequest,
): Promise<StructuredResult<CritiqueOutput>> {
  if (!window.electronAPI?.mistralCritiqueOutput) {
    return { ok: false, error: missingApiError('Critique output') };
  }

  return window.electronAPI.mistralCritiqueOutput(payload);
}

export async function summarizeSessionWithMistral(
  payload: SummarizeSessionRequest,
): Promise<StructuredResult<SessionSummary>> {
  if (!window.electronAPI?.mistralSummarizeSession) {
    return { ok: false, error: missingApiError('Session summary') };
  }

  return window.electronAPI.mistralSummarizeSession(payload);
}

export async function generateRulesWithMistral(
  intent: string,
  availableDomains: string[],
  availableLayers: number[],
): Promise<{
  rules: GeneratedRules['rules']['composition_rules'];
  explanation: string;
}> {
  const response = await generateRulesStructured({
    intent,
    availableDomains,
    availableLayers,
    currentMode: 'rule-engine',
  });

  return {
    rules: response.data?.rules.composition_rules ?? [],
    explanation: response.data?.explanation ?? response.error ?? 'Rule generation unavailable',
  };
}

export async function analyzeExportWithMistral(
  exportData: unknown,
  currentMode: string,
): Promise<{
  insights: string[];
  suggestions: string[];
  nextSteps: string[];
}> {
  const response = await critiqueOutputWithMistral({
    exportData,
    currentMode,
  });

  const critique = response.data;

  return {
    insights: critique?.strengths ?? ['Analysis unavailable'],
    suggestions: critique?.weaknesses ?? [response.error ?? 'Try again later'],
    nextSteps: critique?.nextAdjustments ?? ['Continue with current settings'],
  };
}

export function useMistralService() {
  return {
    callMistral,
    applyPhiTotal,
    getMistralStatus,
    planGenerationWithMistral,
    generateRulesWithMistral,
    generateRulesStructured,
    analyzeExportWithMistral,
    critiqueOutputWithMistral,
    summarizeSessionWithMistral,
  };
}

export function extractContentFromResponse(response: MistralResponse): string {
  if (!response.ok || !response.data) {
    return response.error || 'Unknown error';
  }

  return response.data.choices[0]?.message?.content || 'No content';
}

export function formatPhiTotalResult(response: MistralResponse): {
  title: string;
  content: string;
  tokens?: { prompt: number; completion: number; total: number };
} {
  const content = extractContentFromResponse(response);

  if (!response.ok) {
    return {
      title: 'Phi_total (Error)',
      content: `Error applying Phi_total: ${content}`,
    };
  }

  return {
    title: 'Phi_total Analysis',
    content,
    tokens: response.data?.usage
      ? {
          prompt: response.data.usage.prompt_tokens,
          completion: response.data.usage.completion_tokens,
          total: response.data.usage.total_tokens,
        }
      : undefined,
  };
}
