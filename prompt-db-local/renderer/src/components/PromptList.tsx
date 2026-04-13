import type { Tag } from '@/types/meta';
import type { PromptRecord } from '@/types/prompt';
import { compactPromptPreview } from '@/utils/promptJson';

type PromptListProps = {
  prompts: PromptRecord[];
  selectedPromptId: string | null;
  searchQuery: string;
  resolveTags: (promptId: string) => Tag[];
  onSearchChange: (value: string) => void;
  onSelectPrompt: (promptId: string) => void;
};

export const PromptList = ({
  prompts,
  selectedPromptId,
  searchQuery,
  resolveTags,
  onSearchChange,
  onSelectPrompt,
}: PromptListProps) => (
  <section className="panel">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Prompt Index</p>
        <h2>Library</h2>
      </div>
      <span className="badge">{prompts.length}</span>
    </div>

    <label className="field">
      <span>Search</span>
      <input
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="keyword, title, variable, tag"
      />
    </label>

    <div className="prompt-list">
      {prompts.map((prompt) => (
        <button
          type="button"
          key={prompt.id}
          className={prompt.id === selectedPromptId ? 'prompt-card is-active' : 'prompt-card'}
          onClick={() => onSelectPrompt(prompt.id)}
        >
          <strong>{prompt.name}</strong>
          <span>{compactPromptPreview(prompt.text, 120)}</span>
          <small>{prompt.keywords.slice(0, 4).join(' • ')}</small>
          <div className="tag-chip-row">
            {resolveTags(prompt.id)
              .slice(0, 6)
              .map((tag) => (
                <span
                  key={tag.id}
                  className="tag-chip"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.label}
                </span>
              ))}
          </div>
        </button>
      ))}

      {prompts.length === 0 ? (
        <div className="empty-state">
          <strong>No prompts yet</strong>
          <span>Import a JSON file or send a payload from the Chrome extension.</span>
        </div>
      ) : null}
    </div>
  </section>
);
