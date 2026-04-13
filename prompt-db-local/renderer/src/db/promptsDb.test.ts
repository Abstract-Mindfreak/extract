import { describe, expect, it } from 'vitest';
import { createPromptFingerprint } from '@/db/promptsDb';

describe('createPromptFingerprint', () => {
  it('treats identical json content as the same fingerprint', () => {
    const left = createPromptFingerprint({
      text: 'first text version',
      json_data: {
        name: 'Shared title',
        prompt: 'alpha',
        meta: {
          level: 1,
        },
      },
    });
    const right = createPromptFingerprint({
      text: 'second text version',
      json_data: {
        prompt: 'alpha',
        meta: {
          level: 1,
        },
        name: 'Shared title',
      },
    });

    expect(left).toBe(right);
  });

  it('keeps entries with the same title but different json content distinct', () => {
    const left = createPromptFingerprint({
      text: 'same title card',
      json_data: {
        name: 'Repeated title',
        prompt: 'alpha',
      },
    });
    const right = createPromptFingerprint({
      text: 'same title card',
      json_data: {
        name: 'Repeated title',
        prompt: 'beta',
      },
    });

    expect(left).not.toBe(right);
  });
});
