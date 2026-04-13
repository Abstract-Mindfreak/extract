export type MMSSDomain = 'Rhythm' | 'Timbre' | 'Space' | 'Logic';
export type MMSSPhase = 'emergence' | 'stabilization' | 'shift' | 'collapse';
export type MMSSOp = 'G' | 'Q' | 'Φ' | 'M';

export type MMSSBlock = {
  id: string;
  op: MMSSOp;
  attr: {
    domain: MMSSDomain;
    phase: MMSSPhase;
    layer: number;
    priority: number;
  };
  dna: {
    seed_ref: string;
    params: Record<string, number>;
  };
  synergy: {
    links: string[];
    mode: string;
  };
  meta: {
    intent: string;
    confidence: number;
  };
  origin?: {
    mode: 'mutation' | 'crossover' | 'original';
    parents?: string[];
    mutation_type?: string;
    strategy?: string;
  };
  legacy: Record<string, any>;
};

export type MMSSBuilderConfig = {
  intent: string;
  domains: MMSSDomain[];
  layers: number[];
  max_blocks: number;
  temperature: number;
  runs: number;
  allow_mutation: boolean;
  allow_crossover: boolean;
};

export type MMSSRuntimeResult = {
  meta: {
    intent: string;
    block_count: number;
    run_score: number;
    validation: {
      valid: boolean;
      errors?: string[];
    };
  };
  blocks: MMSSBlock[];
};

export type MMSSJobStatus = 'idle' | 'running' | 'success' | 'error';

export type MMSSJobResult = {
  ok: boolean;
  output: string;
  error?: string;
  data?: any;
};
