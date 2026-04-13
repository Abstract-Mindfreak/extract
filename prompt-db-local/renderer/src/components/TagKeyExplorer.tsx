import { useEffect, useMemo, useState } from 'react';
import type { DBElement, ElementTagBinding, FrequencyEntry, Tag, TagRegistry } from '@/types/meta';
import type { PromptRecord } from '@/types/prompt';
import {
  applyTagsToElements,
  createTag,
  removeTag,
  removeTagsFromBindings,
  upsertTag,
} from '@/utils/tagRegistry';
import {
  createInitialTagRegistry,
  createTagColor,
  createTagId,
  scanResultToLists,
  scanTagsAndKeys,
} from '@/utils/tagScanner';

type TagKeyExplorerProps = {
  prompts: PromptRecord[];
  tagRegistry: TagRegistry;
  bindings: ElementTagBinding[];
  onPersist: (tagRegistry: TagRegistry, bindings: ElementTagBinding[]) => Promise<void>;
};

const toElements = (prompts: PromptRecord[]): DBElement[] =>
  prompts.map((prompt) => ({
    id: prompt.id,
    raw: prompt.json_data,
  }));

export const TagKeyExplorer = ({
  prompts,
  tagRegistry,
  bindings,
  onPersist,
}: TagKeyExplorerProps) => {
  const [localRegistry, setLocalRegistry] = useState<TagRegistry>(tagRegistry);
  const [activeTab, setActiveTab] = useState<'keys' | 'values'>('keys');
  const [scannedKeys, setScannedKeys] = useState<FrequencyEntry[]>([]);
  const [scannedValues, setScannedValues] = useState<FrequencyEntry[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});
  const [selectedValues, setSelectedValues] = useState<Record<string, boolean>>({});
  const [selectedRegistryTags, setSelectedRegistryTags] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('Registry ready');
  const [manualLabel, setManualLabel] = useState('');

  useEffect(() => {
    setLocalRegistry(tagRegistry);
  }, [tagRegistry]);

  const elements = useMemo(() => toElements(prompts), [prompts]);

  const toggleSelection = (collection: Record<string, boolean>, value: string) => ({
    ...collection,
    [value]: !collection[value],
  });

  const handleScan = () => {
    const scanResult = scanTagsAndKeys(elements);
    const lists = scanResultToLists(scanResult);

    setScannedKeys(lists.keys);
    setScannedValues(lists.values);
    setStatus(`Found ${lists.keys.length} keys and ${lists.values.length} normalized values`);
  };

  const handleSeedRegistry = () => {
    const seeded = createInitialTagRegistry(elements);
    const merged = seeded.tags.reduce(
      (registry, tag) => upsertTag(registry, tag),
      localRegistry,
    );

    setLocalRegistry(merged);
    setStatus(`Seeded registry with ${seeded.tags.length} frequent/semantic tags`);
  };

  const addSelectedToRegistry = () => {
    const nextTags: Tag[] = [
      ...Object.entries(selectedKeys)
        .filter(([, selected]) => selected)
        .map(([key]) =>
          createTag({
            id: createTagId(key),
            label: key,
            color: createTagColor(key),
            type: 'key',
          }),
        ),
      ...Object.entries(selectedValues)
        .filter(([, selected]) => selected)
        .map(([value]) =>
          createTag({
            id: createTagId(value),
            label: value,
            color: createTagColor(value),
            type: 'value',
          }),
        ),
    ];

    const merged = nextTags.reduce((registry, tag) => upsertTag(registry, tag), localRegistry);
    setLocalRegistry(merged);
    setStatus(`Added ${nextTags.length} selected entries to registry`);
  };

  const handleAddManualTag = () => {
    const tag = createTag({
      label: manualLabel || 'New semantic tag',
      type: 'semantic',
    });

    setLocalRegistry(upsertTag(localRegistry, tag));
    setManualLabel('');
    setStatus(`Added manual tag "${tag.label}"`);
  };

  const handlePersistRegistry = async () => {
    await onPersist(localRegistry, bindings);
    setStatus('Tag registry saved to .prompt-db-meta');
  };

  const handleApplyAndUpdateDb = async () => {
    const nextBindings = applyTagsToElements(elements, localRegistry);
    await onPersist(localRegistry, nextBindings);
    setStatus(`Applied tags to ${nextBindings.length} DB elements`);
  };

  const handleDeleteSelectedTags = async () => {
    const ids = Object.entries(selectedRegistryTags)
      .filter(([, selected]) => selected)
      .map(([tagId]) => tagId);

    if (ids.length === 0) {
      setStatus('Select at least one registry tag before deleting');
      return;
    }

    if (!window.confirm(`Delete ${ids.length} selected tag(s) from the registry?`)) {
      return;
    }

    const nextRegistry = ids.reduce((registry, tagId) => removeTag(registry, tagId), localRegistry);
    const nextBindings = removeTagsFromBindings(bindings, ids);

    setLocalRegistry(nextRegistry);
    setSelectedRegistryTags({});
    await onPersist(nextRegistry, nextBindings);
    setStatus(`Deleted ${ids.length} selected tag(s) and updated bindings`);
  };

  const rows = activeTab === 'keys' ? scannedKeys : scannedValues;
  const selection = activeTab === 'keys' ? selectedKeys : selectedValues;

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Meta Analysis</p>
          <h2>Tag &amp; Key Explorer</h2>
        </div>
        <span className="badge">{status}</span>
      </div>

      <p className="panel-copy">
        Scan current DB elements, curate a global registry of tags/keys, and write resolved tag
        bindings into the meta store.
      </p>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={handleScan}>
          Find all (tags &amp; keys)
        </button>
        <button type="button" className="secondary-button" onClick={handleSeedRegistry}>
          Seed frequent tags
        </button>
        <button type="button" className="secondary-button" onClick={addSelectedToRegistry}>
          Add selected to registry
        </button>
        <button type="button" className="secondary-button" onClick={() => void handleDeleteSelectedTags()}>
          Delete selected keys/tags
        </button>
        <button type="button" className="secondary-button" onClick={() => void handlePersistRegistry()}>
          Save registry
        </button>
        <button type="button" className="secondary-button" onClick={() => void handleApplyAndUpdateDb()}>
          Apply &amp; Update DB
        </button>
      </div>

      <div className="editor-grid">
        <label className="field field-full">
          <span>Manual tag label</span>
          <div className="inline-row">
            <input
              value={manualLabel}
              onChange={(event) => setManualLabel(event.target.value)}
              placeholder="kick transient geometry"
            />
            <button type="button" className="secondary-button" onClick={handleAddManualTag}>
              + Add Tag
            </button>
          </div>
        </label>
      </div>

      <div className="tab-row">
        <button
          type="button"
          className={activeTab === 'keys' ? 'secondary-button is-active' : 'secondary-button'}
          onClick={() => setActiveTab('keys')}
        >
          Keys
        </button>
        <button
          type="button"
          className={activeTab === 'values' ? 'secondary-button is-active' : 'secondary-button'}
          onClick={() => setActiveTab('values')}
        >
          Values
        </button>
      </div>

      <div className="data-table">
        {rows.slice(0, 120).map((row) => (
          <label key={row.value} className="data-row">
            <input
              type="checkbox"
              checked={Boolean(selection[row.value])}
              onChange={() =>
                activeTab === 'keys'
                  ? setSelectedKeys((current) => toggleSelection(current, row.value))
                  : setSelectedValues((current) => toggleSelection(current, row.value))
              }
            />
            <span className="data-row-main">{row.value}</span>
            <span className="badge">{row.count}</span>
          </label>
        ))}

        {rows.length === 0 ? (
          <div className="empty-inline">Run a scan to populate the key/value explorer.</div>
        ) : null}
      </div>

      <div className="registry-list">
        {localRegistry.tags.map((tag) => (
          <article key={tag.id} className="registry-item">
            <input
              type="checkbox"
              checked={Boolean(selectedRegistryTags[tag.id])}
              onChange={() =>
                setSelectedRegistryTags((current) => ({
                  ...current,
                  [tag.id]: !current[tag.id],
                }))
              }
            />
            <input
              type="color"
              value={tag.color.startsWith('#') ? tag.color : '#6aa86f'}
              onChange={(event) =>
                setLocalRegistry((current) =>
                  upsertTag(current, {
                    ...tag,
                    color: event.target.value,
                  }),
                )
              }
            />
            <input
              value={tag.label}
              onChange={(event) =>
                setLocalRegistry((current) =>
                  upsertTag(current, {
                    ...tag,
                    label: event.target.value,
                  }),
                )
              }
            />
            <select
              value={tag.type}
              onChange={(event) =>
                setLocalRegistry((current) =>
                  upsertTag(current, {
                    ...tag,
                    type: event.target.value as Tag['type'],
                  }),
                )
              }
            >
              <option value="key">key</option>
              <option value="value">value</option>
              <option value="semantic">semantic</option>
            </select>
            <code>{tag.id}</code>
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const nextRegistry = removeTag(localRegistry, tag.id);
                const nextBindings = removeTagsFromBindings(bindings, [tag.id]);
                setLocalRegistry(nextRegistry);
                await onPersist(nextRegistry, nextBindings);
                setStatus(`Deleted tag "${tag.label}"`);
              }}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};
