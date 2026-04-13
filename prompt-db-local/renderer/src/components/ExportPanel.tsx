import { useMemo, useState } from 'react';
import type { DBElement, ElementTagBinding, ExportPreset, KeySequencePreset, TagRegistry } from '@/types/meta';
import type { PromptRecord } from '@/types/prompt';
import {
  critiqueOutputWithMistral,
  generateRulesStructured,
  getMistralStatus,
  planGenerationWithMistral,
} from '@/services/MistralService';
import { usePromptStore } from '@/store/promptStore';
import type { CritiqueOutput, GenerationPlan, MistralStatus } from '../../../shared/mistral';
import { generateExport, parseCompositionPattern } from '@/utils/exportComposer';
import { createTagId } from '@/utils/tagScanner';

type ExportPanelProps = {
  prompts: PromptRecord[];
  tagRegistry: TagRegistry;
  bindings: ElementTagBinding[];
  sequencePresets: KeySequencePreset[];
  exportPresets: ExportPreset[];
  onPersistPresets: (presets: ExportPreset[]) => Promise<void>;
};

const sanitizeFileName = (value: string) =>
  value
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'prompt_export';

const createDefaultPreset = (): ExportPreset => ({
  id: 'default_export',
  label: 'Default Export',
  filters: {
    includeTags: [],
    excludeTags: [],
    includeKeys: [],
    excludeKeys: [],
  },
  composition: {
    mode: 'as-is',
    pattern: '3x12 random',
    rules: {
      composition_rules: [
        { name: 'layer_balance', logic: 'must_include_layers', value: [1, 2, 3] },
        { name: 'domain_spread', logic: 'min_domains', value: 2 },
      ],
    },
  },
  slicing: {
    useKeySequences: [],
    maxBlocksPerElement: 4,
  },
  output: {
    fileNamePattern: '{index}_{id}.json',
    format: 'json',
  },
});

const toElements = (prompts: PromptRecord[], bindings: ElementTagBinding[]): DBElement[] => {
  const bindingsMap = new Map(bindings.map((binding) => [binding.elementId, binding.tags]));

  return prompts.map((prompt) => ({
    id: prompt.id,
    raw: prompt.json_data,
    tagIds: bindingsMap.get(prompt.id) ?? [],
  }));
};

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const joinCsv = (value?: string[]) => (value ?? []).join(', ');

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const deriveAvailableDomains = (elements: DBElement[]) =>
  Array.from(
    new Set(
      elements
        .map((element) => (isRecord(element.raw) && isRecord(element.raw.attr) ? element.raw.attr.domain : undefined))
        .filter((domain): domain is string => typeof domain === 'string' && domain.trim().length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));

const deriveAvailableLayers = (elements: DBElement[]) =>
  Array.from(
    new Set(
      elements
        .map((element) => (isRecord(element.raw) && isRecord(element.raw.attr) ? element.raw.attr.layer : undefined))
        .filter((layer): layer is number => typeof layer === 'number' && Number.isFinite(layer)),
    ),
  ).sort((left, right) => left - right);

const buildConstraints = (draft: ExportPreset) => {
  const constraints: string[] = [];

  if (draft.filters?.includeTags?.length) {
    constraints.push(`Prefer tags: ${draft.filters.includeTags.join(', ')}`);
  }

  if (draft.filters?.excludeTags?.length) {
    constraints.push(`Avoid tags: ${draft.filters.excludeTags.join(', ')}`);
  }

  if (draft.filters?.includeKeys?.length) {
    constraints.push(`Include keys: ${draft.filters.includeKeys.join(', ')}`);
  }

  if (draft.filters?.excludeKeys?.length) {
    constraints.push(`Exclude keys: ${draft.filters.excludeKeys.join(', ')}`);
  }

  if (draft.slicing?.maxBlocksPerElement) {
    constraints.push(`Max blocks per element: ${draft.slicing.maxBlocksPerElement}`);
  }

  return constraints;
};

const applyRulesToDraft = (current: ExportPreset, plan: GenerationPlan): ExportPreset => ({
  ...current,
  composition: {
    mode: plan.recommendedMode,
    pattern: current.composition?.pattern ?? '3x12 random',
    rules: plan.rules,
  },
  description: [current.description, `Mistral rationale: ${plan.rationale.join(' | ')}`]
    .filter(Boolean)
    .join('\n'),
});

export const ExportPanel = ({
  prompts,
  tagRegistry,
  bindings,
  sequencePresets,
  exportPresets,
  onPersistPresets,
}: ExportPanelProps) => {
  const [draft, setDraft] = useState<ExportPreset>(createDefaultPreset);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [previewJson, setPreviewJson] = useState('');
  const [status, setStatus] = useState('Export presets ready');
  const [includeTagsInput, setIncludeTagsInput] = useState('');
  const [excludeTagsInput, setExcludeTagsInput] = useState('');
  const [includeKeysInput, setIncludeKeysInput] = useState('');
  const [excludeKeysInput, setExcludeKeysInput] = useState('');
  const [mistralIntent, setMistralIntent] = useState('Balanced export for high-quality prompt composition');
  const [mistralStatus, setMistralStatus] = useState<MistralStatus | null>(null);
  const [mistralPlan, setMistralPlan] = useState<GenerationPlan | null>(null);
  const [mistralCritique, setMistralCritique] = useState<CritiqueOutput | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isGeneratingRules, setIsGeneratingRules] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const appendMistralCoordinationRecord = usePromptStore((state) => state.appendMistralCoordinationRecord);

  const elements = useMemo(() => toElements(prompts, bindings), [prompts, bindings]);
  const patternInfo = parseCompositionPattern(draft.composition?.pattern);
  const availableDomains = useMemo(() => deriveAvailableDomains(elements), [elements]);
  const availableLayers = useMemo(() => deriveAvailableLayers(elements), [elements]);

  const syncDraftInputs = (nextDraft: ExportPreset) => {
    setIncludeTagsInput(joinCsv(nextDraft.filters?.includeTags));
    setExcludeTagsInput(joinCsv(nextDraft.filters?.excludeTags));
    setIncludeKeysInput(joinCsv(nextDraft.filters?.includeKeys));
    setExcludeKeysInput(joinCsv(nextDraft.filters?.excludeKeys));
  };

  const refreshMistralStatus = async () => {
    const nextStatus = await getMistralStatus();
    setMistralStatus(nextStatus);
    return nextStatus;
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    setMistralPlan(null);
    setMistralCritique(null);

    if (!presetId) {
      const nextDraft = createDefaultPreset();
      setDraft(nextDraft);
      syncDraftInputs(nextDraft);
      setStatus('Switched to unsaved export preset');
      return;
    }

    const preset = exportPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setDraft(preset);
    syncDraftInputs(preset);
    setStatus(`Loaded export preset "${preset.label}"`);
  };

  const handleSavePreset = async () => {
    const nextPreset = {
      ...draft,
      id: draft.id || createTagId(draft.label || `export_${exportPresets.length + 1}`),
    };

    await onPersistPresets(
      [...exportPresets.filter((preset) => preset.id !== nextPreset.id), nextPreset].sort((left, right) =>
        left.label.localeCompare(right.label),
      ),
    );
    setDraft(nextPreset);
    syncDraftInputs(nextPreset);
    setSelectedPresetId(nextPreset.id);
    setStatus(`Saved export preset "${nextPreset.label}"`);
  };

  const handleDeletePreset = async () => {
    if (!selectedPresetId) {
      return;
    }

    const preset = exportPresets.find((entry) => entry.id === selectedPresetId);
    await onPersistPresets(exportPresets.filter((entry) => entry.id !== selectedPresetId));
    setSelectedPresetId('');
    const nextDraft = createDefaultPreset();
    setDraft(nextDraft);
    syncDraftInputs(nextDraft);
    setMistralPlan(null);
    setMistralCritique(null);
    setStatus(preset ? `Deleted export preset "${preset.label}"` : 'Deleted export preset');
  };

  const runCritique = async (payload: unknown, sourceLabel: string) => {
    setIsCritiquing(true);
    try {
      const response = await critiqueOutputWithMistral({
        exportData: payload,
        currentMode: draft.composition?.mode ?? 'as-is',
        intent: mistralIntent,
        evaluationGoal: `Critique ${sourceLabel} for preset ${draft.label}`,
      });

      if (response.data) {
        setMistralCritique(response.data);
        await appendMistralCoordinationRecord({
          id: crypto.randomUUID(),
          source: 'export-panel',
          intent: mistralIntent,
          createdAt: new Date().toISOString(),
          appliedMode: draft.composition?.mode,
          plan: mistralPlan
            ? {
                recommendedMode: mistralPlan.recommendedMode,
                domains: mistralPlan.domains,
                layers: mistralPlan.layers,
                rationale: mistralPlan.rationale,
              }
            : undefined,
          rules: draft.composition?.rules,
          critique: response.data,
          metadata: {
            label: draft.label,
            sourceLabel,
            filePattern: draft.output?.fileNamePattern ?? '{index}_{id}.json',
          },
        });
      }

      setStatus(
        response.ok
          ? `Critique updated for ${sourceLabel}`
          : `Critique fallback used for ${sourceLabel}: ${response.error ?? 'unknown error'}`,
      );
    } finally {
      setIsCritiquing(false);
    }
  };

  const handlePlanWithMistral = async () => {
    setIsPlanning(true);
    try {
      const nextStatus = await refreshMistralStatus();
      if (!nextStatus.available) {
        setStatus(nextStatus.error ?? 'Mistral is not configured');
        return;
      }

      const response = await planGenerationWithMistral({
        intent: mistralIntent,
        availableDomains,
        availableLayers,
        currentMode: draft.composition?.mode,
        availableTags: tagRegistry.tags.map((tag) => tag.id),
        sequencePresetNames: sequencePresets.map((preset) => preset.name),
        sessionSummary: draft.description,
        constraints: buildConstraints(draft),
      });

      if (response.data) {
        setMistralPlan(response.data);
        await appendMistralCoordinationRecord({
          id: crypto.randomUUID(),
          source: 'export-panel',
          intent: mistralIntent,
          createdAt: new Date().toISOString(),
          appliedMode: response.data.recommendedMode,
          plan: {
            recommendedMode: response.data.recommendedMode,
            domains: response.data.domains,
            layers: response.data.layers,
            rationale: response.data.rationale,
          },
          rules: response.data.rules,
          metadata: {
            label: draft.label,
            availableDomains,
            availableLayers,
          },
        });
        setStatus(
          response.ok
            ? `Mistral plan ready: ${response.data.recommendedMode}`
            : `Plan fallback used: ${response.error ?? 'unknown error'}`,
        );
      }
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApplyPlan = () => {
    if (!mistralPlan) {
      return;
    }

    setDraft((current) => applyRulesToDraft(current, mistralPlan));
    setStatus(`Applied Mistral plan with mode "${mistralPlan.recommendedMode}"`);
  };

  const handleGenerateRules = async () => {
    setIsGeneratingRules(true);
    try {
      const nextStatus = await refreshMistralStatus();
      if (!nextStatus.available) {
        setStatus(nextStatus.error ?? 'Mistral is not configured');
        return;
      }

      const response = await generateRulesStructured({
        intent: mistralIntent,
        availableDomains,
        availableLayers,
        currentMode: draft.composition?.mode,
        constraints: buildConstraints(draft),
      });

      if (response.data) {
        const generatedRules = response.data;
        await appendMistralCoordinationRecord({
          id: crypto.randomUUID(),
          source: 'export-panel',
          intent: mistralIntent,
          createdAt: new Date().toISOString(),
          appliedMode: draft.composition?.mode,
          plan: mistralPlan
            ? {
                recommendedMode: mistralPlan.recommendedMode,
                domains: mistralPlan.domains,
                layers: mistralPlan.layers,
                rationale: mistralPlan.rationale,
              }
            : undefined,
          rules: generatedRules.rules,
          metadata: {
            explanation: generatedRules.explanation,
            label: draft.label,
          },
        });

        setDraft((current) => ({
          ...current,
          composition: {
            mode: current.composition?.mode ?? 'rule-engine',
            pattern: current.composition?.pattern ?? '3x12 random',
            rules: generatedRules.rules,
          },
          description: [current.description, `Rule notes: ${generatedRules.explanation}`]
            .filter(Boolean)
            .join('\n'),
        }));

        setStatus(
          response.ok
            ? 'Mistral rules applied to current preset'
            : `Rule fallback used: ${response.error ?? 'unknown error'}`,
        );
      }
    } finally {
      setIsGeneratingRules(false);
    }
  };

  const handleUpdatePreview = async () => {
    const files = await generateExport(elements, draft, tagRegistry, sequencePresets);
    const previewContent = files[0]?.content ?? {};
    setPreviewJson(JSON.stringify(previewContent, null, 2));
    setStatus(`Preview updated for ${files.length} file(s)`);
    await runCritique(previewContent, 'preview');
  };

  const handleExport = async () => {
    if (!window.electronAPI) {
      setStatus('Electron bridge is unavailable');
      return;
    }

    const files = await generateExport(elements, draft, tagRegistry, sequencePresets);
    const result = await window.electronAPI.exportBatchFiles({
      defaultFolderName: sanitizeFileName(
        `${draft.label}_${draft.composition?.mode || 'as_is'}_${Date.now()}`,
      ),
      files: files.map((file) => ({
        fileName: sanitizeFileName(file.fileName),
        content: JSON.stringify(file.content, null, 2),
      })),
    });

    if (!result) {
      setStatus('Export cancelled');
      return;
    }

    setStatus(`Exported ${result.count} generated file(s) to ${result.directoryPath}`);
    await runCritique(files.slice(0, 3).map((file) => file.content), 'export batch');
  };

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Composer</p>
          <h2>Export Presets</h2>
        </div>
        <span className="badge">{status}</span>
      </div>

      <p className="panel-copy">
        Generate prompt packs from the local library with a simpler flow: describe intent, let
        Mistral plan the mode and rules, preview the result, then export.
      </p>

      <div
        style={{
          display: 'grid',
          gap: 12,
          marginBottom: 18,
          padding: 16,
          borderRadius: 18,
          background: 'var(--surface-strong)',
          border: '1px solid var(--stroke)',
        }}
      >
        <strong>How Mistral rules are applied</strong>
        <span style={{ color: 'var(--muted)' }}>
          Mistral does not generate prompts directly in this panel. It chooses a composition mode,
          proposes a structured rule set, and those rules are then executed locally by the export
          composer against your prompt database.
        </span>
        <div className="export-stats" style={{ margin: 0 }}>
          <span>1. Intent to planner</span>
          <span>2. Planner to mode + rules</span>
          <span>3. Local composer to preview/export</span>
          <span>4. Critic to feedback loop</span>
        </div>
      </div>

      <div className="editor-grid">
        <label className="field">
          <span>Saved preset</span>
          <select value={selectedPresetId} onChange={(event) => handleSelectPreset(event.target.value)}>
            <option value="">Unsaved preset</option>
            {exportPresets.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Preset label</span>
          <input
            value={draft.label}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                label: event.target.value,
                id: current.id || createTagId(event.target.value),
              }))
            }
          />
        </label>

        <label className="field field-full">
          <span>Generation intent for Mistral</span>
          <textarea
            value={mistralIntent}
            onChange={(event) => setMistralIntent(event.target.value)}
            rows={2}
            placeholder="Describe what kind of export or prompt pack you want to generate"
          />
        </label>

        <label className="field">
          <span>Composition mode</span>
          <select
            value={draft.composition?.mode ?? 'as-is'}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                composition: {
                  ...current.composition,
                  mode: event.target.value as NonNullable<ExportPreset['composition']>['mode'],
                },
              }))
            }
          >
            <option value="as-is">as-is</option>
            <option value="random-mix">random-mix</option>
            <option value="sequence-based">sequence-based</option>
            <option value="mmss-v3">mmss-v3 (AI Builder)</option>
            <option value="rule-engine">rule-engine (Layer/Domains)</option>
            <option value="О¦_total">О¦_total (Meta Evolution)</option>
          </select>
        </label>

        <label className="field">
          <span>Pattern</span>
          <input
            value={draft.composition?.pattern ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                composition: {
                  mode: current.composition?.mode ?? 'as-is',
                  pattern: event.target.value,
                },
              }))
            }
            placeholder="6x12 random"
          />
        </label>
      </div>

      <div className="button-row" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handlePlanWithMistral()}
          disabled={isPlanning}
        >
          {isPlanning ? 'Planning...' : '1. Plan with Mistral'}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={handleApplyPlan}
          disabled={!mistralPlan}
        >
          2. Apply plan
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => void handleUpdatePreview()}
        >
          {isCritiquing ? 'Critiquing...' : '3. Preview + critique'}
        </button>
        <button type="button" className="primary-button" onClick={() => void handleExport()}>
          4. Export
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setShowAdvanced((current) => !current)}
        >
          {showAdvanced ? 'Hide advanced' : 'Show advanced'}
        </button>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12,
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <div className="panel-heading" style={{ marginBottom: 12 }}>
          <div>
            <p className="eyebrow">Mistral</p>
            <h3 style={{ margin: 0 }}>Coordinator Layer</h3>
          </div>
          <span className="badge">
            {mistralStatus?.available ? `Ready: ${mistralStatus.defaultModel}` : 'Status unknown'}
          </span>
        </div>

        <div className="export-stats" style={{ marginBottom: 12 }}>
          <span>{availableDomains.length} domain(s) detected</span>
          <span>{availableLayers.length} layer(s) detected</span>
          <span>{tagRegistry.tags.length} tag(s)</span>
          <span>{sequencePresets.length} sequence preset(s)</span>
        </div>

        <div className="button-row" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void handleGenerateRules()}
            disabled={isGeneratingRules}
          >
            {isGeneratingRules ? 'Generating rules...' : 'Generate rules with Mistral'}
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refreshMistralStatus()}
          >
            Refresh Mistral status
          </button>
        </div>

        {draft.composition?.mode === 'rule-engine' && (
          <div className="rule-config">
            <label className="field">
              <span>Required Layers (comma-separated)</span>
              <input
                value={String(
                  draft.composition?.rules?.composition_rules.find((r) => r.logic === 'must_include_layers')?.value ??
                    '1, 2, 3',
                )}
                onChange={(event) => {
                  const layers = event.target.value
                    .split(',')
                    .map((entry) => parseInt(entry.trim(), 10))
                    .filter((entry) => !Number.isNaN(entry));

                  setDraft((current) => {
                    const currentRules = current.composition?.rules ?? {
                      composition_rules: [
                        { name: 'layer_balance', logic: 'must_include_layers', value: [1, 2, 3] },
                        { name: 'domain_spread', logic: 'min_domains', value: 2 },
                      ],
                    };
                    const otherRules = currentRules.composition_rules.filter(
                      (rule) => rule.logic !== 'must_include_layers',
                    );

                    return {
                      ...current,
                      composition: {
                        mode: current.composition?.mode ?? 'as-is',
                        pattern: current.composition?.pattern ?? '3x12 random',
                        rules: {
                          composition_rules: [
                            ...otherRules,
                            { name: 'layer_balance', logic: 'must_include_layers', value: layers },
                          ],
                        },
                      },
                    } as ExportPreset;
                  });
                }}
                placeholder="1, 2, 3"
              />
            </label>

            <label className="field">
              <span>Min Domains</span>
              <input
                type="number"
                min={1}
                max={4}
                value={Number(
                  draft.composition?.rules?.composition_rules.find((r) => r.logic === 'min_domains')?.value ?? 2,
                )}
                onChange={(event) => {
                  const minDomains = Math.max(1, Number(event.target.value) || 1);

                  setDraft((current) => {
                    const currentRules = current.composition?.rules ?? {
                      composition_rules: [
                        { name: 'layer_balance', logic: 'must_include_layers', value: [1, 2, 3] },
                        { name: 'domain_spread', logic: 'min_domains', value: 2 },
                      ],
                    };
                    const otherRules = currentRules.composition_rules.filter(
                      (rule) => rule.logic !== 'min_domains',
                    );

                    return {
                      ...current,
                      composition: {
                        mode: current.composition?.mode ?? 'as-is',
                        pattern: current.composition?.pattern ?? '3x12 random',
                        rules: {
                          composition_rules: [
                            ...otherRules,
                            { name: 'domain_spread', logic: 'min_domains', value: minDomains },
                          ],
                        },
                      },
                    } as ExportPreset;
                  });
                }}
              />
            </label>
          </div>
        )}

        {mistralPlan && (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            <strong>Plan</strong>
            <span>Recommended mode: {mistralPlan.recommendedMode}</span>
            <span>Domains: {mistralPlan.domains.join(', ') || 'none'}</span>
            <span>Layers: {mistralPlan.layers.join(', ') || 'none'}</span>
            <span>Rules: {mistralPlan.rules.composition_rules.length}</span>
            <textarea value={mistralPlan.rationale.join('\n')} readOnly rows={4} />
          </div>
        )}

        {mistralCritique && (
          <div style={{ display: 'grid', gap: 8 }}>
            <strong>Critique</strong>
            <span>Estimated quality: {(mistralCritique.estimatedQuality * 100).toFixed(0)}%</span>
            <textarea
              readOnly
              rows={7}
              value={[
                'Strengths:',
                ...mistralCritique.strengths.map((entry) => `- ${entry}`),
                '',
                'Weaknesses:',
                ...mistralCritique.weaknesses.map((entry) => `- ${entry}`),
                '',
                'Next adjustments:',
                ...mistralCritique.nextAdjustments.map((entry) => `- ${entry}`),
              ].join('\n')}
            />
          </div>
        )}
      </div>

      {showAdvanced && (
        <>
          <div className="editor-grid" style={{ marginTop: 16 }}>
            <label className="field field-full">
              <span>Description</span>
              <textarea
                value={draft.description ?? ''}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
              />
            </label>

            <label className="field">
              <span>Include tags</span>
              <input
                value={includeTagsInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setIncludeTagsInput(nextValue);
                  setDraft((current) => ({
                    ...current,
                    filters: {
                      ...current.filters,
                      includeTags: splitCsv(nextValue),
                    },
                  }));
                }}
                placeholder={tagRegistry.tags.slice(0, 4).map((tag) => tag.id).join(', ')}
              />
            </label>

            <label className="field">
              <span>Exclude tags</span>
              <input
                value={excludeTagsInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setExcludeTagsInput(nextValue);
                  setDraft((current) => ({
                    ...current,
                    filters: {
                      ...current.filters,
                      excludeTags: splitCsv(nextValue),
                    },
                  }));
                }}
              />
            </label>

            <label className="field">
              <span>Include keys</span>
              <input
                value={includeKeysInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setIncludeKeysInput(nextValue);
                  setDraft((current) => ({
                    ...current,
                    filters: {
                      ...current.filters,
                      includeKeys: splitCsv(nextValue),
                    },
                  }));
                }}
              />
            </label>

            <label className="field">
              <span>Exclude keys</span>
              <input
                value={excludeKeysInput}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setExcludeKeysInput(nextValue);
                  setDraft((current) => ({
                    ...current,
                    filters: {
                      ...current.filters,
                      excludeKeys: splitCsv(nextValue),
                    },
                  }));
                }}
              />
            </label>

            <label className="field">
              <span>Max blocks per element</span>
              <input
                type="number"
                min={1}
                value={draft.slicing?.maxBlocksPerElement ?? 4}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    slicing: {
                      ...current.slicing,
                      maxBlocksPerElement: Math.max(1, Number(event.target.value) || 1),
                    },
                  }))
                }
              />
            </label>

            <label className="field">
              <span>File name pattern</span>
              <input
                value={draft.output?.fileNamePattern ?? '{index}_{id}.json'}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    output: {
                      fileNamePattern: event.target.value,
                      format: 'json',
                    },
                  }))
                }
              />
            </label>

            <label className="field field-full">
              <span>Sequence presets used for sequence-based mode</span>
              <div className="check-grid">
                {sequencePresets.map((preset) => {
                  const checked = draft.slicing?.useKeySequences?.includes(preset.id) ?? false;

                  return (
                    <label key={preset.id} className="check-card">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setDraft((current) => {
                            const currentIds = new Set(current.slicing?.useKeySequences ?? []);

                            if (currentIds.has(preset.id)) {
                              currentIds.delete(preset.id);
                            } else {
                              currentIds.add(preset.id);
                            }

                            return {
                              ...current,
                              slicing: {
                                ...current.slicing,
                                useKeySequences: [...currentIds],
                              },
                            };
                          })
                        }
                      />
                      <span>{preset.name}</span>
                    </label>
                  );
                })}
              </div>
            </label>
          </div>

          <div className="button-row" style={{ marginTop: 16 }}>
            <button type="button" className="secondary-button" onClick={() => void handleSavePreset()}>
              Save preset
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleDeletePreset()}
              disabled={!selectedPresetId}
            >
              Delete preset
            </button>
          </div>
        </>
      )}

      <div className="export-stats">
        <span>{elements.length} DB elements available</span>
        <span>{patternInfo.files} file(s)</span>
        <span>{patternInfo.items} item(s) per file</span>
        <span>{draft.composition?.mode ?? 'as-is'}</span>
      </div>

      <label className="field field-full">
        <span>Preview payload</span>
        <textarea
          value={previewJson || 'Preview is not generated yet. Click "Update preview".'}
          readOnly
          rows={16}
        />
      </label>
    </section>
  );
};
