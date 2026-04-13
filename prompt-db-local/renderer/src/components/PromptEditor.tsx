import { useEffect, useState } from 'react';
import type { Tag } from '@/types/meta';
import type { PromptRecord, PromptServiceMeta } from '@/types/prompt';
import { isRecord, stringifyPromptJson } from '@/utils/promptJson';

type PromptEditorProps = {
  prompt: PromptRecord | null;
  promptTags: Tag[];
  onSave: (payload: {
    id?: string;
    name: string;
    json_data: Record<string, unknown>;
    variables: string[];
    keywords: string[];
    source?: string;
    serviceMeta?: PromptServiceMeta;
  }) => Promise<void>;
  onDelete: (promptId: string) => Promise<void>;
};

export const PromptEditor = ({ prompt, promptTags, onSave, onDelete }: PromptEditorProps) => {
  const [name, setName] = useState('');
  const [jsonText, setJsonText] = useState('{}');
  const [variables, setVariables] = useState('');
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    if (!prompt) {
      setName('');
      setJsonText('{}');
      setVariables('');
      setKeywords('');
      return;
    }

    setName(prompt.name);
    setJsonText(stringifyPromptJson(prompt.json_data));
    setVariables(prompt.variables.join(', '));
    setKeywords(prompt.keywords.join(', '));
  }, [prompt]);

  const handleSave = async () => {
    const parsedJson = JSON.parse(jsonText) as unknown;

    if (!isRecord(parsedJson)) {
      throw new Error('Prompt JSON must be a JSON object wrapped in { ... }.');
    }

    await onSave({
      id: prompt?.id,
      name,
      json_data: parsedJson,
      variables: variables
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      keywords: keywords
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean),
      source: prompt?.source,
      serviceMeta: prompt?.serviceMeta,
    });
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Editor</p>
          <h2>Prompt Detail</h2>
        </div>
      </div>

      {promptTags.length > 0 ? (
        <div className="tag-chip-row tag-chip-row-spaced">
          {promptTags.map((tag) => (
            <span
              key={tag.id}
              className="tag-chip"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.label}
            </span>
          ))}
        </div>
      ) : null}

      <div className="editor-grid">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="field">
          <span>Variables</span>
          <input
            value={variables}
            onChange={(event) => setVariables(event.target.value)}
            placeholder="topic, tone, audience"
          />
        </label>

        <label className="field field-full">
          <span>Keywords</span>
          <input value={keywords} onChange={(event) => setKeywords(event.target.value)} />
        </label>

        <label className="field field-full">
          <span>Prompt JSON</span>
          <textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            rows={14}
          />
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={() => void handleSave()}>
          Save prompt
        </button>
        {prompt ? (
          <button type="button" className="secondary-button" onClick={() => void onDelete(prompt.id)}>
            Delete
          </button>
        ) : null}
      </div>
    </section>
  );
};
