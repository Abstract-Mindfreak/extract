import { describe, expect, it } from 'vitest';
import type { DBElement, ExportPreset, KeySequencePreset, TagRegistry } from '@/types/meta';
import { generateExport, parseCompositionPattern } from '@/utils/exportComposer';

const elements: DBElement[] = [
  {
    id: 'one',
    tagIds: ['neurofunk'],
    raw: {
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'alpha-click',
          body_layer: 'alpha-body',
        },
      },
      signal_flow_purity_v4: {
        phase_alignment_check: 'alpha-phase',
      },
    },
  },
  {
    id: 'two',
    tagIds: ['neurofunk', 'dark_psy_trance'],
    raw: {
      micro_dynamic_shaping_v4: {
        snare_impact_physics: {
          initial_crack: 'beta-snare',
          tail_refinement: 'beta-tail',
        },
      },
    },
  },
];

const tagRegistry: TagRegistry = {
  tags: [
    { id: 'neurofunk', label: 'Neurofunk', color: '#111111', type: 'semantic' },
    { id: 'dark_psy_trance', label: 'Dark Psy Trance', color: '#222222', type: 'semantic' },
  ],
};

const sequencePresets: KeySequencePreset[] = [
  {
    id: 'drum_micro_dynamics',
    name: 'Drum Micro Dynamics',
    sequences: [
      {
        id: 'kick',
        usageCount: 2,
        pathChain: [
          'micro_dynamic_shaping_v4.kick_transient_geometry',
          'micro_dynamic_shaping_v4.kick_transient_geometry.click_layer',
          'micro_dynamic_shaping_v4.kick_transient_geometry.body_layer',
        ],
      },
      {
        id: 'signal',
        usageCount: 1,
        pathChain: [
          'signal_flow_purity_v4',
          'signal_flow_purity_v4.phase_alignment_check',
        ],
      },
    ],
    generationRules: {
      mode: 'sequential',
      allowRepetition: false,
    },
  },
];

describe('exportComposer', () => {
  it('parses composition pattern', () => {
    expect(parseCompositionPattern('6x12 random')).toEqual({
      files: 6,
      items: 12,
      mode: 'random',
    });
  });

  it('generates as-is export files', async () => {
    const preset: ExportPreset = {
      id: 'as_is',
      label: 'As Is',
      composition: {
        mode: 'as-is',
        pattern: '1x2 random',
      },
      output: {
        fileNamePattern: '{index}_{id}.json',
        format: 'json',
      },
    };

    const files = await generateExport(elements, preset, tagRegistry, sequencePresets);

    expect(files).toHaveLength(1);
    expect(Array.isArray(files[0]?.content)).toBe(true);
    expect((files[0]?.content as Record<string, unknown>[])).toHaveLength(2);
  });

  it('generates sequence-based export files', async () => {
    const preset: ExportPreset = {
      id: 'sequence_based',
      label: 'Sequence Based',
      composition: {
        mode: 'sequence-based',
        pattern: '1x1 random',
      },
      slicing: {
        useKeySequences: ['drum_micro_dynamics'],
        maxBlocksPerElement: 3,
      },
      output: {
        fileNamePattern: '{index}_{id}.json',
        format: 'json',
      },
    };

    const files = await generateExport(elements, preset, tagRegistry, sequencePresets);
    const item = Array.isArray(files[0]?.content)
      ? files[0]?.content[0]
      : files[0]?.content;

    expect(item).toHaveProperty('micro_dynamic_shaping_v4.kick_transient_geometry'.split('.')[0]);
  });
});
