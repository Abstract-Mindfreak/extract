import { useMemo, useState } from 'react';
import type { DBElement, KeySequencePreset } from '@/types/meta';
import type { PromptRecord } from '@/types/prompt';
import {
  extractKeyPaths,
  extractKeySequences,
  formatSequenceLabel,
} from '@/utils/keySequenceEngine';
import { createTagId } from '@/utils/tagScanner';

type SequencePresetsPanelProps = {
  prompts: PromptRecord[];
  presets: KeySequencePreset[];
  onPersist: (presets: KeySequencePreset[]) => Promise<void>;
};

const toElements = (prompts: PromptRecord[]): DBElement[] =>
  prompts.map((prompt) => ({
    id: prompt.id,
    raw: prompt.json_data,
  }));

export const SequencePresetsPanel = ({
  prompts,
  presets,
  onPersist,
}: SequencePresetsPanelProps) => {
  const [discovered, setDiscovered] = useState<ReturnType<typeof extractKeySequences>>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'random' | 'weighted' | 'sequential'>('random');
  const [status, setStatus] = useState('Sequence presets ready');

  const elements = useMemo(() => toElements(prompts), [prompts]);
  const pathCount = useMemo(() => extractKeyPaths(elements).length, [elements]);

  const handleDiscover = () => {
    const sequences = extractKeySequences(elements);
    setDiscovered(sequences);
    setStatus(`Discovered ${sequences.length} reusable key sequences across ${pathCount} key paths`);
  };

  const handleSavePreset = async () => {
    const sequences = discovered.filter((sequence) => selected[sequence.id]);

    if (sequences.length === 0) {
      setStatus('Select at least one sequence before saving a preset');
      return;
    }

    const nextPreset: KeySequencePreset = {
      id: createTagId(name || `sequence_preset_${presets.length + 1}`),
      name: name || `Sequence preset ${presets.length + 1}`,
      description: description || undefined,
      sequences,
      generationRules: {
        mode,
        maxBlocks: sequences.length,
        allowRepetition: false,
      },
    };

    await onPersist(
      [...presets.filter((preset) => preset.id !== nextPreset.id), nextPreset].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    );
    setStatus(`Saved sequence preset "${nextPreset.name}"`);
    setName('');
    setDescription('');
  };

  const handleDeletePreset = async (presetId: string) => {
    const preset = presets.find((entry) => entry.id === presetId);
    await onPersist(presets.filter((entry) => entry.id !== presetId));
    setStatus(preset ? `Deleted sequence preset "${preset.name}"` : 'Deleted sequence preset');
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Structure</p>
          <h2>Sequence Presets</h2>
        </div>
        <span className="badge">{status}</span>
      </div>

      <p className="panel-copy">
        Extract repeated key-path chains, inspect their frequency, and save thematic presets for
        sequence-based export generation.
      </p>

      <div className="button-row">
        <button type="button" className="primary-button" onClick={handleDiscover}>
          Extract key sequences
        </button>
      </div>

      <div className="data-table">
        {discovered.slice(0, 120).map((sequence) => (
          <label key={sequence.id} className="data-row">
            <input
              type="checkbox"
              checked={Boolean(selected[sequence.id])}
              onChange={() =>
                setSelected((current) => ({
                  ...current,
                  [sequence.id]: !current[sequence.id],
                }))
              }
            />
            <span className="data-row-main">{formatSequenceLabel(sequence)}</span>
            <span className="badge">{sequence.usageCount}</span>
          </label>
        ))}

        {discovered.length === 0 ? (
          <div className="empty-inline">Run extraction to discover frequently reused sequences.</div>
        ) : null}
      </div>

      <div className="editor-grid">
        <label className="field">
          <span>Preset name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="field">
          <span>Generation mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
            <option value="random">random</option>
            <option value="weighted">weighted</option>
            <option value="sequential">sequential</option>
          </select>
        </label>

        <label className="field field-full">
          <span>Description</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={4}
          />
        </label>
      </div>

      <div className="button-row">
        <button type="button" className="secondary-button" onClick={() => void handleSavePreset()}>
          Save sequence preset
        </button>
      </div>

      <div className="registry-list">
        {presets.map((preset) => (
          <article key={preset.id} className="registry-item registry-item-wide">
            <div>
              <strong>{preset.name}</strong>
              <p className="compact-copy">
                {preset.description || 'No description'} | {preset.sequences.length} sequence(s) |{' '}
                {preset.generationRules?.mode ?? 'random'}
              </p>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleDeletePreset(preset.id)}
            >
              Delete
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};
