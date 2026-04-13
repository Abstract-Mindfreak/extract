import { describe, expect, it } from 'vitest';
import type { DBElement } from '@/types/meta';
import { extractKeyPaths, extractKeySequences, formatSequenceLabel } from '@/utils/keySequenceEngine';

const elements: DBElement[] = [
  {
    id: 'alpha',
    raw: {
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'a',
          body_layer: 'b',
          sub_tail: 'c',
          transient_master: 'd',
        },
      },
      signal_flow_purity_v4: {
        multiband_splitting: 'x',
        phase_alignment_check: 'y',
        dynamic_eq_nodes: 'z',
      },
    },
  },
  {
    id: 'beta',
    raw: {
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'a2',
          body_layer: 'b2',
          sub_tail: 'c2',
          transient_master: 'd2',
        },
      },
    },
  },
];

describe('keySequenceEngine', () => {
  it('extracts dot-notation key paths', () => {
    const paths = extractKeyPaths(elements);

    expect(paths).toContain(
      'micro_dynamic_shaping_v4.kick_transient_geometry.click_layer',
    );
    expect(paths).toContain('signal_flow_purity_v4.phase_alignment_check');
  });

  it('extracts repeating key sequences with usage counts', () => {
    const sequences = extractKeySequences(elements);
    const kickSequence = sequences.find((sequence) =>
      formatSequenceLabel(sequence).includes('micro_dynamic_shaping_v4.kick_transient_geometry'),
    );

    expect(kickSequence?.usageCount).toBe(2);
    expect(kickSequence?.pathChain[0]).toBe('micro_dynamic_shaping_v4.kick_transient_geometry');
  });
});
