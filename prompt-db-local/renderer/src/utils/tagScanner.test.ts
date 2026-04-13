import { describe, expect, it } from 'vitest';
import type { DBElement } from '@/types/meta';
import { createInitialTagRegistry, scanTagsAndKeys } from '@/utils/tagScanner';

const elements: DBElement[] = [
  {
    id: 'alpha',
    raw: {
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'Fractal kick attack',
          body_layer: 'Neurofunk body',
        },
      },
      genre: 'neurofunk',
    },
  },
  {
    id: 'beta',
    raw: {
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'Fractal kick attack',
          sub_tail: 'Dark_psy_trance low tail',
        },
      },
      genre: 'dark_psy_trance',
    },
  },
  {
    id: 'gamma',
    raw: {
      signal_flow_purity_v4: {
        phase_alignment_check: 'entropy',
      },
      genre: 'neurofunk',
    },
  },
  {
    id: 'delta',
    raw: {
      signal_flow_purity_v4: {
        dynamic_eq_nodes: 'fractal',
      },
      genre: 'neurofunk',
    },
  },
];

describe('tagScanner', () => {
  it('collects keys and normalized values', () => {
    const result = scanTagsAndKeys(elements);

    expect(result.keys.get('genre')).toBe(4);
    expect(result.keys.get('click_layer')).toBe(2);
    expect(result.values.get('neurofunk')).toBe(3);
    expect(result.values.get('fractal kick attack')).toBe(2);
  });

  it('creates initial registry from frequent keys and semantic seeds', () => {
    const registry = createInitialTagRegistry(elements, 1);

    expect(registry.tags.some((tag) => tag.label === 'genre')).toBe(true);
    expect(registry.tags.some((tag) => tag.id === 'neurofunk')).toBe(true);
    expect(registry.tags.some((tag) => tag.id === 'signal_flow_purity_v4')).toBe(true);
  });
});
