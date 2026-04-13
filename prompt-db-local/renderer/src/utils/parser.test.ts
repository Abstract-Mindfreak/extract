import { describe, expect, it } from 'vitest';
import { parseJsonToPrompts } from '@/utils/parser';

describe('parseJsonToPrompts', () => {
  it('imports a strict JSON object as a single prompt block', () => {
    const rawJson = JSON.stringify({
      id: 'drum_block_alpha',
      title: 'Drum Block Alpha',
      micro_dynamic_shaping_v4: {
        kick_transient_geometry: {
          click_layer: 'alpha-click',
          body_layer: 'alpha-body',
        },
      },
    });

    const prompts = parseJsonToPrompts(rawJson, { source: 'test-import' });
    const first = prompts[0]!;

    expect(prompts).toHaveLength(1);
    expect(first.name).toBe('Drum Block Alpha');
    expect(first.text!.trim().startsWith('{')).toBe(true);
    expect(first.text!.trim().endsWith('}')).toBe(true);
    expect(first.source).toBe('test-import');
    expect(first.serviceMeta?.fragmentIndex).toBe(0);
  });

  it('extracts only valid JSON object fragments from mixed text', () => {
    const rawText = `
      heading that must be ignored
      {"title":"First Block","kick":"alpha"}
      plain text wrapper between fragments
      {"title":"Second Block","snare":"beta"}
      trailing commentary
    `;

    const prompts = parseJsonToPrompts(rawText, { source: 'mixed-doc' });

    expect(prompts).toHaveLength(2);
    expect(prompts[0]?.name).toBe('First Block');
    expect(prompts[1]?.name).toBe('Second Block');
    expect(prompts[0]?.text).not.toContain('heading that must be ignored');
    expect(prompts[1]?.text).not.toContain('trailing commentary');
  });

  it('keeps service metadata out of prompt text', () => {
    const rawText = `
      {
        "id": "block_a",
        "__fragmentIndex": 99,
        "items": [{"id": "x", "sourceElementIds": ["root-1"]}],
        "payload": {"mode": "strict"}
      }
    `;

    const prompts = parseJsonToPrompts(rawText);
    const first = prompts[0]!;

    expect(prompts).toHaveLength(1);
    expect(first.text).not.toContain('__fragmentIndex');
    expect(first.text).not.toContain('sourceElementIds');
    expect(first.serviceMeta?.fragmentIndex).toBe(99);
    expect(first.serviceMeta?.items).toEqual([{ id: 'x', sourceElementIds: ['root-1'] }]);
  });

  it('creates human-readable fallback names instead of generic block id labels', () => {
    const rawText = `
      {
        "id": "block id",
        "signal_flow_purity_v4": {
          "phase_alignment_check": "tight"
        }
      }
    `;

    const prompts = parseJsonToPrompts(rawText);

    expect(prompts).toHaveLength(1);
    expect(prompts[0]?.name).toBe('signal flow purity v4');
  });
});
