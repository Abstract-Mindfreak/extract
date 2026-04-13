import { MMSSBuilderConfig, MMSSJobResult } from '../types/mmss';

const getElectronApi = () => {
  if (!window.electronAPI?.mmssRunTask) {
    throw new Error('MMSS runtime is only available inside Electron');
  }

  return window.electronAPI;
};

export const MMSSRuntimeService = {
  async runTransform(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'transform_blocks.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runIndexerV3(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/indexer_v3.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runEmbeddings(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/embedding_builder.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runGraphV3(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/graph_builder_v3.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runMutation(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/mutation_engine.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runCrossover(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/crossover_engine.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runSelfRules(): Promise<MMSSJobResult> {
    return getElectronApi().mmssRunTask({
      script: 'system/self_rule_engine.py',
      args: [],
    }) as Promise<MMSSJobResult>;
  },

  async runBuilderV3(config: MMSSBuilderConfig): Promise<MMSSJobResult> {
    const args = [
      '--intent', config.intent,
      '--domains', config.domains.join(','),
      '--layers', config.layers.join(','),
      '--max_blocks', config.max_blocks.toString(),
      '--temperature', config.temperature.toString(),
      '--runs', config.runs.toString(),
    ];

    return getElectronApi().mmssRunTask({
      script: 'system/builder_v3.py',
      args,
    }) as Promise<MMSSJobResult>;
  },
};
