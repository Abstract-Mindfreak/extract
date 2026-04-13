import { usePromptStore } from '@/store/promptStore';

export const usePrompts = () => {
  const prompts = usePromptStore((state) => state.prompts);
  const filters = usePromptStore((state) => state.filters);
  const selectedPromptId = usePromptStore((state) => state.selectedPromptId);
  const tagRegistry = usePromptStore((state) => state.tagRegistry);
  const elementTagBindings = usePromptStore((state) => state.elementTagBindings);

  const query = filters.query.trim().toLowerCase();
  const keyword = filters.keyword?.trim().toLowerCase();
  const bindingsMap = new Map(
    elementTagBindings.map((binding) => [binding.elementId, binding.tags]),
  );

  const filteredPrompts = prompts.filter((prompt) => {
    const matchesQuery =
      !query ||
      prompt.name.toLowerCase().includes(query) ||
      prompt.text.toLowerCase().includes(query) ||
      prompt.keywords.some((entry) => entry.includes(query)) ||
      (bindingsMap.get(prompt.id) ?? []).some((tagId) => tagId.includes(query));
    const matchesKeyword = !keyword || prompt.keywords.includes(keyword);

    return matchesQuery && matchesKeyword;
  });

  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) ?? filteredPrompts[0] ?? null;

  const selectedPromptTags = (selectedPrompt ? bindingsMap.get(selectedPrompt.id) : [])
    ?.map((tagId) => tagRegistry.tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is (typeof tagRegistry.tags)[number] => tag !== undefined);

  return {
    prompts,
    filteredPrompts,
    selectedPrompt,
    selectedPromptTags: selectedPromptTags ?? [],
    tagsByPromptId: bindingsMap,
  };
};
