import { useEffect, useMemo, useState } from "react";
import { Copy, FolderPlus, Save } from "lucide-react";

const PANEL_APPEARANCE_STORAGE_KEY = "mmss.sequenceBuilderAppearance.v1";
const DEFAULT_PANEL_APPEARANCE = {
  controls: { color: "#17324a", fontSize: 14 },
  savedSequences: { color: "#3a2353", fontSize: 14 },
  dropzone: { color: "#1f4d45", fontSize: 15 },
  merge: { color: "#3b2f18", fontSize: 14 },
  preset: { color: "#213a5b", fontSize: 14 },
  composition: { color: "#4b2639", fontSize: 15 },
  save: { color: "#284b2c", fontSize: 14 },
  preview: { color: "#2e3148", fontSize: 13 },
};

const PANEL_FONT_OPTIONS = [12, 13, 14, 15, 16, 18, 20];
const PANEL_CONTROL_META = [
  { id: "controls", label: "Actions" },
  { id: "savedSequences", label: "Saved Sequences" },
  { id: "dropzone", label: "Dropzone" },
  { id: "merge", label: "Merge Strip" },
  { id: "preset", label: "Preset Builder" },
  { id: "composition", label: "Composition Blocks" },
  { id: "save", label: "Save Form" },
  { id: "preview", label: "Preview" },
];

function JsonSequenceBuilder({
  blocks,
  sequences,
  selectedSequenceId,
  activeComposition,
  onSelectSequence,
  onDeleteSequence,
  onAddBlock,
  onRemoveBlock,
  onReorder,
  onSetMergeStrategy,
  onSaveCompositionAsSequence,
  onExportSequence,
  onGeneratePresetComposition,
  onCopyPreview,
  onSavePreviewFile,
  onSaveToLibrary,
  onBatchExport,
}) {
  const [sequenceName, setSequenceName] = useState("");
  const [sequenceDescription, setSequenceDescription] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [presetCount, setPresetCount] = useState(6);
  const [batchFormula, setBatchFormula] = useState("6x44 random");
  const [batchMode, setBatchMode] = useState("random");
  const [batchTagPreset, setBatchTagPreset] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [panelAppearance, setPanelAppearance] = useState(loadPanelAppearance);

  useEffect(() => {
    window.localStorage.setItem(PANEL_APPEARANCE_STORAGE_KEY, JSON.stringify(panelAppearance));
  }, [panelAppearance]);

  const compositionBlocks = useMemo(
    () =>
      activeComposition.blockIds.map((blockId, index) => ({
        order: index,
        block: blocks.find((entry) => entry.id === blockId),
      })),
    [activeComposition.blockIds, blocks]
  );

  const visibleSequences = useMemo(() => {
    return sequences.filter((sequence) => {
      const source = sequence.sourceMeta?.source || "manual";
      return sourceFilter === "all" || source === sourceFilter;
    });
  }, [sequences, sourceFilter]);

  const externalPipeline = activeComposition?.externalPipeline || null;

  const panelStyles = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(panelAppearance).map(([panelId, config]) => [
          panelId,
          {
            "--builder-panel-accent": config.color,
            "--builder-panel-fill": hexToRgba(config.color, 0.16),
            "--builder-panel-fill-strong": hexToRgba(config.color, 0.22),
            "--builder-panel-border": hexToRgba(config.color, 0.42),
            "--builder-panel-text": `${config.fontSize}px`,
          },
        ])
      ),
    [panelAppearance]
  );

  function updatePanelAppearance(panelId, patch) {
    setPanelAppearance((current) => ({
      ...current,
      [panelId]: {
        ...(current[panelId] || DEFAULT_PANEL_APPEARANCE[panelId] || { color: "#243447", fontSize: 14 }),
        ...patch,
      },
    }));
  }

  return (
    <div className="json-sequence-builder">
      {externalPipeline ? (
        <div className="sequence-pipeline-banner">
          <div>
            <strong>{externalPipeline.label || "External Pipeline"}</strong>
            <p>
              Источник: {externalPipeline.source || "external"}.
              Порядок модулей влияет на merge pipeline и уже перенесён в активную композицию.
            </p>
          </div>
          <div className="sequence-pipeline-meta">
            <span>{externalPipeline.modeCount || 0} modes</span>
            <span>{externalPipeline.mergeStrategy || activeComposition.mergeStrategy}</span>
          </div>
        </div>
      ) : null}

      <div className="builder-section-card panel-appearance-card">
        <div className="builder-section-card__head">
          <div>
            <strong>Panel Appearance</strong>
            <span>Separate colors and font sizes for builder panels. Saved locally with builder layout state.</span>
          </div>
          <div className="panel-appearance-grid">
            {PANEL_CONTROL_META.map((panel) => (
              <div key={panel.id} className="panel-appearance-control">
                <strong>{panel.label}</strong>
                <label>
                  Color
                  <input
                    type="color"
                    value={panelAppearance[panel.id]?.color || DEFAULT_PANEL_APPEARANCE[panel.id]?.color}
                    onChange={(event) => updatePanelAppearance(panel.id, { color: event.target.value })}
                  />
                </label>
                <label>
                  Font
                  <select
                    value={panelAppearance[panel.id]?.fontSize || DEFAULT_PANEL_APPEARANCE[panel.id]?.fontSize}
                    onChange={(event) => updatePanelAppearance(panel.id, { fontSize: Number(event.target.value) || 14 })}
                  >
                    {PANEL_FONT_OPTIONS.map((size) => (
                      <option key={`${panel.id}_${size}`} value={size}>
                        {size}px
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="sequence-builder-shell">
        <div className="sequence-builder-main">
          <div className="builder-section-card sequence-builder-actions-card" style={panelStyles.controls}>
            <div className="builder-section-card__head">
              <div>
                <strong>Sequence Actions</strong>
                <span>Primary controls for preview, export and current sequence operations.</span>
              </div>
            </div>
            <div className="sequence-builder-actions">
              <button onClick={() => setPreviewVisible((value) => !value)}>
                {previewVisible ? "Hide Preview" : "Build Preview"}
              </button>
              {selectedSequenceId ? (
                <button onClick={() => onDeleteSequence(selectedSequenceId)}>Delete Sequence</button>
              ) : null}
              <button onClick={() => onExportSequence(activeComposition.combinedJson, "composition")}>
                Export Sequence
              </button>
            </div>
          </div>

          <div
            className="builder-section-card sequence-dropzone"
            style={panelStyles.dropzone}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const blockId = event.dataTransfer.getData("text/plain");
              if (blockId) onAddBlock(blockId);
            }}
          >
            <div>
              <strong>Sequence Dropzone</strong>
              <span>Drop blocks here or use Add from the library list.</span>
            </div>
            <strong>{compositionBlocks.length} items in active composition</strong>
          </div>

          <div className="builder-section-card merge-strip-card" style={panelStyles.merge}>
            <div className="builder-section-card__head">
              <div>
                <strong>Merge Strip</strong>
                <span>Control how the active composition resolves into combined JSON.</span>
              </div>
            </div>
            <div className="merge-strip">
              <label>
                Merge Strategy
                <select
                  value={activeComposition.mergeStrategy}
                  onChange={(event) => onSetMergeStrategy(event.target.value)}
                >
                  <option value="concat">concat</option>
                  <option value="merge_shallow">merge_shallow</option>
                  <option value="merge_deep">merge_deep</option>
                </select>
              </label>
              {externalPipeline ? (
                <div className="merge-strip-note">
                  Unified pipeline: {externalPipeline.orderSummary || "custom order"}
                </div>
              ) : null}
            </div>
          </div>

          <div className="builder-section-card preset-builder" style={panelStyles.preset}>
            <div className="builder-section-card__head">
              <div>
                <strong>Preset Builder</strong>
                <span>Fast composition presets and batch export scenarios.</span>
              </div>
            </div>
            <label>
              Preset block count
              <input
                type="number"
                min={1}
                max={Math.max(1, blocks.length)}
                value={presetCount}
                onChange={(event) =>
                  setPresetCount(Math.max(1, Math.min(blocks.length || 1, Number(event.target.value) || 1)))
                }
              />
            </label>
            <div className="preset-actions">
              <button onClick={() => onGeneratePresetComposition("random", presetCount)}>Random Build</button>
              <button onClick={() => onGeneratePresetComposition("ordered_name", presetCount)}>Ordered Name</button>
              <button onClick={() => onGeneratePresetComposition("category_wave", presetCount)}>Category Wave</button>
              <button onClick={() => onGeneratePresetComposition("tag_chain", presetCount)}>Tag Chain</button>
              <button onClick={() => onGeneratePresetComposition("stride_walk", presetCount)}>Stride Walk</button>
              <button onClick={() => onGeneratePresetComposition("key_density", presetCount)}>Key Density</button>
              <button onClick={() => onGeneratePresetComposition("key_signature", presetCount)}>
                Key Signature
              </button>
            </div>
            <div className="batch-export-box">
              <strong>Batch Export Tool</strong>
              <div className="batch-export-row">
                <input
                  value={batchFormula}
                  onChange={(event) => setBatchFormula(event.target.value)}
                  placeholder="Formula: 6x44 random"
                />
                <select value={batchMode} onChange={(event) => setBatchMode(event.target.value)}>
                  <option value="random">random</option>
                  <option value="ordered_name">ordered_name</option>
                  <option value="category_wave">category_wave</option>
                  <option value="tag_chain">tag_chain</option>
                  <option value="stride_walk">stride_walk</option>
                  <option value="key_density">key_density</option>
                  <option value="key_signature">key_signature</option>
                </select>
                <select value={batchTagPreset} onChange={(event) => setBatchTagPreset(event.target.value)}>
                  <option value="all">all tags</option>
                  <option value="dense_keys">dense keys</option>
                  <option value="lyrics">lyrics/lfe</option>
                  <option value="technical">technical</option>
                  <option value="visual">visual</option>
                </select>
                <button onClick={() => onBatchExport(batchFormula, batchMode, batchTagPreset)}>
                  Batch Export
                </button>
              </div>
              <span className="batch-export-help">
                Examples: <code>6x44 random</code>, <code>4x3 tag_chain</code>, <code>8x12</code>.
              </span>
            </div>
          </div>

          <div className="builder-section-card composition-blocks-card" style={panelStyles.composition}>
            <div className="builder-section-card__head">
              <div>
                <strong>Composition Blocks</strong>
                <span>Operational order of blocks in the active MMSS sequence.</span>
              </div>
            </div>
            <div className="composition-blocks">
              {compositionBlocks.map((entry, index) => (
                <div className="composition-chip" key={`${entry.block?.id || "missing"}_${index}`}>
                  <div className="composition-chip-main">
                    <span>{entry.block?.name || "Missing block"}</span>
                    {entry.block?.sourceMeta?.source ? (
                      <small>{entry.block.sourceMeta.source}</small>
                    ) : null}
                  </div>
                  <div>
                    <button onClick={() => onReorder(index, Math.max(0, index - 1))} disabled={index === 0}>
                      Up
                    </button>
                    <button
                      onClick={() => onReorder(index, Math.min(compositionBlocks.length - 1, index + 1))}
                      disabled={index === compositionBlocks.length - 1}
                    >
                      Down
                    </button>
                    <button onClick={() => onRemoveBlock(index)}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="builder-section-card sequence-save-form" style={panelStyles.save}>
            <div className="builder-section-card__head">
              <div>
                <strong>Sequence Save Form</strong>
                <span>Persist the current composition as a reusable sequence and export the preview.</span>
              </div>
            </div>
            <input
              value={sequenceName}
              onChange={(event) => setSequenceName(event.target.value)}
              placeholder="Sequence name"
            />
            <input
              value={sequenceDescription}
              onChange={(event) => setSequenceDescription(event.target.value)}
              placeholder="Sequence description"
            />
            <button
              className="accent-action"
              onClick={() => {
                onSaveCompositionAsSequence(sequenceName, sequenceDescription);
                setSequenceName("");
                setSequenceDescription("");
              }}
              disabled={!compositionBlocks.length}
            >
              Save composition as sequence
            </button>
            <div className="sequence-save-actions">
              <button className="ui-action-btn ui-action-btn--export" onClick={() => onCopyPreview(activeComposition.combinedJson)}>
                <Copy size={14} />
                Copy JSON Preview
              </button>
              <button className="ui-action-btn ui-action-btn--neutral" onClick={() => onSavePreviewFile(activeComposition.combinedJson)}>
                <Save size={14} />
                Save JSON File
              </button>
              <button
                className="ui-action-btn ui-action-btn--library"
                onClick={() =>
                  onSaveToLibrary?.(activeComposition.combinedJson, {
                    name: sequenceName.trim() || "Sequence Preview Import",
                    description: sequenceDescription.trim() || "Imported from JsonSequenceBuilder preview",
                    category: "sequence_preview",
                    tags: ["sequence_builder", "preview", activeComposition.mergeStrategy].filter(Boolean),
                    color: "#8fcfff",
                    icon: "sequence",
                    source: "json_sequence_builder",
                    activateLibraryPanel: true,
                  })
                }
              >
                <FolderPlus size={14} />
                Save to Library
              </button>
            </div>
          </div>

          {previewVisible ? (
            <div className="builder-section-card preview-panel-card" style={panelStyles.preview}>
              <div className="builder-section-card__head">
                <div>
                  <strong>JSON Preview</strong>
                  <span>Live combined output for the current composition.</span>
                </div>
                <button
                  className="ui-action-btn ui-action-btn--library"
                  onClick={() =>
                    onSaveToLibrary?.(activeComposition.combinedJson, {
                      name: sequenceName.trim() || "Composition Preview",
                      description: sequenceDescription.trim() || "Imported from composition preview",
                      category: "composition_preview",
                      tags: ["sequence_builder", "composition", activeComposition.mergeStrategy].filter(Boolean),
                      color: "#8fcfff",
                      icon: "preview",
                      source: "json_sequence_builder",
                    })
                  }
                >
                  <FolderPlus size={14} />
                  Save to Library
                </button>
              </div>
              <pre className="json-preview">{JSON.stringify(activeComposition.combinedJson, null, 2)}</pre>
            </div>
          ) : null}
        </div>

        <aside className="sequence-builder-sidebar">
          <div className="builder-section-card sequence-saved-panel" style={panelStyles.savedSequences}>
            <div className="builder-section-card__head">
              <div>
                <strong>Saved Sequences</strong>
                <span>Library of reusable saved stacks and imported MMSS sequences.</span>
              </div>
            </div>
            <div className="sequence-filter-row">
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">all sources</option>
                <option value="flowmusic.app">flowmusic.app</option>
                <option value="manual">manual</option>
              </select>
            </div>
            <div className="saved-sequence-list">
              {visibleSequences.map((sequence) => (
                <button
                  key={sequence.id}
                  className={`saved-sequence-card ${selectedSequenceId === sequence.id ? "active" : ""}`}
                  onClick={() => onSelectSequence(sequence.id)}
                >
                  <span>{sequence.name}</span>
                  <div className="library-provenance-row">
                    <span className={`library-source-pill source-${normalizeSourceLabel(sequence.sourceMeta?.source)}`}>
                      {sequence.sourceMeta?.source || "manual"}
                    </span>
                    {sequence.conversationId ? (
                      <span className="library-meta-pill">conv {shortId(sequence.conversationId)}</span>
                    ) : null}
                    {Array.isArray(sequence.linkedTrackIds) && sequence.linkedTrackIds.length ? (
                      <span className="library-meta-pill">{sequence.linkedTrackIds.length} tracks</span>
                    ) : null}
                  </div>
                  <small>{sequence.mergeStrategy}</small>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function loadPanelAppearance() {
  try {
    const raw = window.localStorage.getItem(PANEL_APPEARANCE_STORAGE_KEY);
    if (!raw) return DEFAULT_PANEL_APPEARANCE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PANEL_APPEARANCE,
      ...parsed,
    };
  } catch (_error) {
    return DEFAULT_PANEL_APPEARANCE;
  }
}

function hexToRgba(hex, alpha) {
  const normalized = String(hex || "").replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((value) => `${value}${value}`).join("")
    : normalized.padEnd(6, "0").slice(0, 6);
  const red = Number.parseInt(safeHex.slice(0, 2), 16) || 0;
  const green = Number.parseInt(safeHex.slice(2, 4), 16) || 0;
  const blue = Number.parseInt(safeHex.slice(4, 6), 16) || 0;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function shortId(value) {
  return String(value || "").slice(0, 8);
}

function normalizeSourceLabel(value) {
  return String(value || "manual").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
}

export default JsonSequenceBuilder;
