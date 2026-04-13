export type DBElementId = string;

export type DBElement = {
  id: DBElementId;
  raw: unknown;
  tagIds?: string[];
};

export type Tag = {
  id: string;
  label: string;
  color: string;
  type: 'key' | 'value' | 'semantic';
};

export type TagRegistry = {
  tags: Tag[];
};

export type KeyPath = string;

export type RuleLogic = 'must_include_layers' | 'min_domains' | 'conditional_requirement';

export type Rule = {
  name: string;
  logic: RuleLogic;
  value?: number[] | number;
  if?: Record<string, unknown>;
  then?: Record<string, unknown>;
};

export type RuleSet = {
  composition_rules: Rule[];
};

export type KeySequence = {
  id: string;
  pathChain: KeyPath[];
  usageCount: number;
};

export type KeySequencePreset = {
  id: string;
  name: string;
  description?: string;
  sequences: KeySequence[];
  generationRules?: {
    mode: 'random' | 'weighted' | 'sequential';
    maxBlocks?: number;
    allowRepetition?: boolean;
  };
};

export type ElementTagBinding = {
  elementId: DBElementId;
  tags: string[];
};

export type CompositionMode =
  | 'as-is'
  | 'random-mix'
  | 'sequence-based'
  | 'mmss-v3'
  | 'rule-engine'
  | 'self-rule-engine'
  | 'mutation-engine'
  | 'mmss-v4'
  | 'F-Final'
  | 'Φ_total';

export type ExportPreset = {
  id: string;
  label: string;
  description?: string;
  filters?: {
    includeTags?: string[];
    excludeTags?: string[];
    includeKeys?: string[];
    excludeKeys?: string[];
  };
  composition?: {
    mode: CompositionMode;
    pattern?: string;
    rules?: RuleSet;
  };
  slicing?: {
    useKeySequences?: string[];
    maxBlocksPerElement?: number;
  };
  output?: {
    fileNamePattern: string;
    format: 'json';
  };
};

export type MistralCoordinationRecord = {
  id: string;
  source: 'export-panel' | 'mmss-runtime' | 'session-panel';
  intent: string;
  createdAt: string;
  appliedMode?: CompositionMode;
  plan?: {
    recommendedMode: CompositionMode;
    domains: string[];
    layers: number[];
    rationale: string[];
  };
  rules?: RuleSet;
  critique?: {
    strengths: string[];
    weaknesses: string[];
    nextAdjustments: string[];
    estimatedQuality: number;
  };
  metadata?: Record<string, string | number | boolean | string[] | number[]>;
};

export type PromptDbMetaState = {
  tagRegistry: TagRegistry;
  elementTagBindings: ElementTagBinding[];
  keySequencePresets: KeySequencePreset[];
  exportPresets: ExportPreset[];
  mistralCoordinationHistory: MistralCoordinationRecord[];
};

export type FrequencyEntry = {
  value: string;
  count: number;
};

export const createEmptyMetaState = (): PromptDbMetaState => ({
  tagRegistry: {
    tags: [],
  },
  elementTagBindings: [],
  keySequencePresets: [],
  exportPresets: [],
  mistralCoordinationHistory: [],
});
