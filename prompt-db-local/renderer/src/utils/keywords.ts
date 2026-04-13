const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'if',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'with',
  'you',
  'your',
  'и',
  'в',
  'во',
  'на',
  'не',
  'но',
  'что',
  'это',
  'как',
  'для',
  'из',
  'под',
  'или',
  'по',
  'к',
  'с',
  'со',
  'а',
  'о',
  'же',
]);

const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));

export const extractKeywords = (text: string): string[] => {
  const tokens = tokenize(text);
  const frequencies = new Map<string, number>();

  for (const token of tokens) {
    frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const ngram = `${tokens[index]} ${tokens[index + 1]}`;
    frequencies.set(ngram, (frequencies.get(ngram) ?? 0) + 1);
  }

  return [...frequencies.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 12)
    .map(([keyword]) => keyword);
};

export const extractVariablesFromText = (text: string): string[] =>
  Array.from(
    new Set(
      [...text.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)].map((match) => match[1].trim()),
    ),
  );
