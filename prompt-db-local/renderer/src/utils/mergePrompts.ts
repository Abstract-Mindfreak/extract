import type { PromptRecord } from '@/types/prompt';

const resolvePath = (prompt: PromptRecord, field: string) => {
  if (field === 'text') {
    return prompt.text;
  }

  if (field === 'name') {
    return prompt.name;
  }

  if (field in prompt.json_data) {
    const value = prompt.json_data[field];
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  return '';
};

export const mergePrompts = (prompts: PromptRecord[], formula: string): string => {
  const byName = new Map(prompts.map((prompt) => [prompt.name, prompt]));
  const byId = new Map(prompts.map((prompt) => [prompt.id, prompt]));

  const withRandom = formula.replace(/random\(([^)]+)\)/g, (_match, group: string) => {
    const parts = group
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return '';
    }

    const picked = parts[Math.floor(Math.random() * parts.length)];
    const prompt = byId.get(picked) ?? byName.get(picked);
    return prompt?.text ?? picked;
  });

  return withRandom.replace(/\{\{\s*([^.}]+)\.([^.}]+)\s*\}\}/g, (_match, promptKey, field) => {
    const prompt = byId.get(promptKey) ?? byName.get(promptKey);
    return prompt ? resolvePath(prompt, field) : '';
  });
};
