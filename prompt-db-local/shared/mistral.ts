import type { CompositionMode, RuleSet } from './meta';

export type StructuredResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
  warnings?: string[];
  rawContent?: string;
};

export type MistralStatus = {
  configured: boolean;
  available: boolean;
  defaultModel: string;
  error?: string;
};

export type GenerationPlanRequest = {
  intent: string;
  availableDomains: string[];
  availableLayers: number[];
  currentMode?: CompositionMode;
  availableTags?: string[];
  sequencePresetNames?: string[];
  sessionSummary?: string;
  constraints?: string[];
  model?: string;
};

export type GenerationPlan = {
  intent: string;
  recommendedMode: CompositionMode;
  domains: string[];
  layers: number[];
  rules: RuleSet;
  rationale: string[];
};

export type GenerateRulesRequest = {
  intent: string;
  availableDomains: string[];
  availableLayers: number[];
  currentMode?: CompositionMode;
  constraints?: string[];
  model?: string;
};

export type GeneratedRules = {
  rules: RuleSet;
  explanation: string;
};

export type CritiqueOutputRequest = {
  exportData: unknown;
  currentMode: string;
  intent?: string;
  evaluationGoal?: string;
  model?: string;
};

export type CritiqueOutput = {
  strengths: string[];
  weaknesses: string[];
  nextAdjustments: string[];
  estimatedQuality: number;
};

export type SummarizeSessionRequest = {
  sessionName: string;
  accountId?: string;
  accountName?: string;
  totalMessages: number;
  recentContext: string;
  previousSummary?: string;
  customPrompt?: string;
  model?: string;
};

export type SessionSummary = {
  summary: string;
  suggestedNextSteps: string[];
  tags: string[];
  confidence: number;
};
