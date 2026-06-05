import { useMemo } from "react";
import { Copy, FolderPlus, Save, Sparkles } from "lucide-react";
import { useIdeWorkspaceStore } from "../hooks/useIdeWorkspaceStore";

const PANEL_FONT_OPTIONS = [12, 13, 14, 15, 16, 18, 20];
const PANEL_CONTROL_META = [
  { id: "workspace", label: "Prompt Workspace" },
  { id: "actions", label: "Sequence Actions" },
  { id: "savedSequences", label: "Saved Sequences" },
];

export function PromptWorkspacePanel({
  activeComposition,
  blocks,
  libraryReady,
  selectedBlock,
  selectedSequence,
  sequences,
  workspaceActions,
}) {
  const {
    sequencePanelAppearance,
    updateSequencePanelAppearance,
  } = useIdeWorkspaceStore();

  const panelStyle = useMemo(
    () => buildPanelStyle(sequencePanelAppearance.workspace),
    [sequencePanelAppearance.workspace]
  );

  return (
    <div className="ide-panel-shell ide-workspace-panel" style={panelStyle}>
      <div className="ide-panel-header">
        <div>
          <strong>Prompt Workspace</strong>
          <span>Workspace controls, active selection, and shared panel appearance for the prompt IDE.</span>
        </div>
      </div>

      <div className="ide-workspace-summary-grid">
        <MetricCard label="Library" value={libraryReady ? "Ready" : "Idle"} />
        <MetricCard label="Blocks" value={String(blocks.length)} />
        <MetricCard label="Sequences" value={String(sequences.length)} />
        <MetricCard label="Composition" value={`${activeComposition.blockIds.length} items`} />
      </div>

      <div className="ide-workspace-action-row">
        <button onClick={workspaceActions.onLoadLibrary} disabled={libraryReady}>
          {libraryReady ? "Library Ready" : "Load Library"}
        </button>
        <button onClick={workspaceActions.onImportSessionBlocks}>Import Session Blocks</button>
        <button onClick={workspaceActions.onResetLayout}>Reset Layout</button>
        <button onClick={workspaceActions.onClearComposition}>Clear Composition</button>
      </div>

      <div className="ide-workspace-focus-grid">
        <FocusCard
          title="Selected Block"
          value={selectedBlock?.name || "No block selected"}
          meta={selectedBlock?.category || "Pick a block from the library or graph"}
        />
        <FocusCard
          title="Selected Sequence"
          value={selectedSequence?.name || "No sequence selected"}
          meta={selectedSequence?.mergeStrategy || "Saved sequence focus"}
        />
        <FocusCard
          title="Merge Strategy"
          value={activeComposition.mergeStrategy || "merge_deep"}
          meta={activeComposition.externalPipeline?.label || "Active composition output mode"}
        />
      </div>

      <div className="ide-workspace-appearance">
        <div className="ide-panel-header is-compact">
          <div>
            <strong>Panel Appearance</strong>
            <span>Shared accent and font controls for the decomposed sequence workspace panels.</span>
          </div>
        </div>
        <div className="ide-appearance-grid">
          {PANEL_CONTROL_META.map((panel) => (
            <div key={panel.id} className="ide-appearance-card">
              <strong>{panel.label}</strong>
              <label>
                Color
                <input
                  type="color"
                  value={sequencePanelAppearance[panel.id]?.color || "#243447"}
                  onChange={(event) =>
                    updateSequencePanelAppearance(panel.id, { color: event.target.value })
                  }
                />
              </label>
              <label>
                Font
                <select
                  value={sequencePanelAppearance[panel.id]?.fontSize || 14}
                  onChange={(event) =>
                    updateSequencePanelAppearance(panel.id, {
                      fontSize: Number(event.target.value) || 14,
                    })
                  }
                >
                  {PANEL_FONT_OPTIONS.map((size) => (
                    <option key={`${panel.id}-${size}`} value={size}>
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
  );
}

export function SequenceActionsPanel({
  activeComposition,
  blocks,
  onAddBlock,
  onBatchExport,
  onCopyPreview,
  onDeleteSequence,
  onExportSequence,
  onGeneratePresetComposition,
  onRemoveBlock,
  onReorder,
  onSaveCompositionAsSequence,
  onSavePreviewFile,
  onSaveToLibrary,
  onSetMergeStrategy,
  selectedSequenceId,
}) {
  const {
    sequenceBatchFormula,
    sequenceBatchMode,
    sequenceBatchTagPreset,
    sequenceDescription,
    sequenceName,
    sequencePanelAppearance,
    sequencePresetCount,
    sequencePreviewVisible,
    setSequenceBatchFormula,
    setSequenceBatchMode,
    setSequenceBatchTagPreset,
    setSequenceDescription,
    setSequenceName,
    setSequencePresetCount,
    setSequencePreviewVisible,
  } = useIdeWorkspaceStore();

  const compositionBlocks = useMemo(
    () =>
      activeComposition.blockIds.map((blockId, index) => ({
        order: index,
        block: blocks.find((entry) => entry.id === blockId),
      })),
    [activeComposition.blockIds, blocks]
  );

  const panelStyle = useMemo(
    () => buildPanelStyle(sequencePanelAppearance.actions),
    [sequencePanelAppearance.actions]
  );

  const externalPipeline = activeComposition?.externalPipeline || null;

  return (
    <div className="ide-panel-shell ide-sequence-actions-panel" style={panelStyle}>
      <div className="ide-panel-header">
        <div>
          <strong>Sequence Actions</strong>
          <span>Build compositions, reorder blocks, export previews, and save reusable sequences.</span>
        </div>
      </div>

      {externalPipeline ? (
        <div className="sequence-pipeline-banner">
          <div>
            <strong>{externalPipeline.label || "External Pipeline"}</strong>
            <p>
              Источник: {externalPipeline.source || "external"}. Порядок модулей уже перенесен в активную композицию.
            </p>
          </div>
          <div className="sequence-pipeline-meta">
            <span>{externalPipeline.modeCount || 0} modes</span>
            <span>{externalPipeline.mergeStrategy || activeComposition.mergeStrategy}</span>
          </div>
        </div>
      ) : null}

      <div className="sequence-builder-actions">
        <button onClick={() => setSequencePreviewVisible(!sequencePreviewVisible)}>
          {sequencePreviewVisible ? "Hide Preview" : "Build Preview"}
        </button>
        {selectedSequenceId ? (
          <button onClick={() => onDeleteSequence(selectedSequenceId)}>Delete Sequence</button>
        ) : null}
        <button onClick={() => onExportSequence(activeComposition.combinedJson, "composition")}>
          Export Sequence
        </button>
      </div>

      <div
        className="builder-section-card sequence-dropzone"
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

      <div className="preset-builder">
        <label>
          Preset block count
          <input
            type="number"
            min={1}
            max={Math.max(1, blocks.length)}
            value={sequencePresetCount}
            onChange={(event) =>
              setSequencePresetCount(
                Math.max(1, Math.min(blocks.length || 1, Number(event.target.value) || 1))
              )
            }
          />
        </label>
        <div className="preset-actions">
          <button onClick={() => onGeneratePresetComposition("random", sequencePresetCount)}>Random Build</button>
          <button onClick={() => onGeneratePresetComposition("ordered_name", sequencePresetCount)}>Ordered Name</button>
          <button onClick={() => onGeneratePresetComposition("category_wave", sequencePresetCount)}>Category Wave</button>
          <button onClick={() => onGeneratePresetComposition("tag_chain", sequencePresetCount)}>Tag Chain</button>
          <button onClick={() => onGeneratePresetComposition("stride_walk", sequencePresetCount)}>Stride Walk</button>
          <button onClick={() => onGeneratePresetComposition("key_density", sequencePresetCount)}>Key Density</button>
          <button onClick={() => onGeneratePresetComposition("key_signature", sequencePresetCount)}>Key Signature</button>
        </div>
      </div>

      <div className="batch-export-box">
        <strong>Batch Export Tool</strong>
        <div className="batch-export-row">
          <input
            value={sequenceBatchFormula}
            onChange={(event) => setSequenceBatchFormula(event.target.value)}
            placeholder="Formula: 6x44 random"
          />
          <select value={sequenceBatchMode} onChange={(event) => setSequenceBatchMode(event.target.value)}>
            <option value="random">random</option>
            <option value="ordered_name">ordered_name</option>
            <option value="category_wave">category_wave</option>
            <option value="tag_chain">tag_chain</option>
            <option value="stride_walk">stride_walk</option>
            <option value="key_density">key_density</option>
            <option value="key_signature">key_signature</option>
          </select>
          <select
            value={sequenceBatchTagPreset}
            onChange={(event) => setSequenceBatchTagPreset(event.target.value)}
          >
            <option value="all">all tags</option>
            <option value="dense_keys">dense keys</option>
            <option value="lyrics">lyrics/lfe</option>
            <option value="technical">technical</option>
            <option value="visual">visual</option>
          </select>
          <button onClick={() => onBatchExport(sequenceBatchFormula, sequenceBatchMode, sequenceBatchTagPreset)}>
            Batch Export
          </button>
        </div>
      </div>

      <div className="composition-blocks">
        {compositionBlocks.length ? (
          compositionBlocks.map((entry, index) => (
            <div className="composition-chip" key={`${entry.block?.id || "missing"}_${index}`}>
              <div className="composition-chip-main">
                <span>{entry.block?.name || "Missing block"}</span>
                {entry.block?.sourceMeta?.source ? <small>{entry.block.sourceMeta.source}</small> : null}
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
          ))
        ) : (
          <div className="ide-empty-panel">Active composition is empty.</div>
        )}
      </div>

      <div className="sequence-save-form">
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
                description: sequenceDescription.trim() || "Imported from sequence actions preview",
                category: "sequence_preview",
                tags: ["sequence_builder", "preview", activeComposition.mergeStrategy].filter(Boolean),
                color: "#8fcfff",
                icon: "sequence",
                source: "sequence_actions_panel",
                activateLibraryPanel: true,
              })
            }
          >
            <FolderPlus size={14} />
            Save to Library
          </button>
        </div>
      </div>

      {sequencePreviewVisible ? (
        <div className="preview-panel-card">
          <div className="ide-panel-header is-compact">
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
                  source: "sequence_actions_panel",
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
  );
}

export function SavedSequencesPanel({
  onSelectSequence,
  selectedSequenceId,
  sequences,
}) {
  const {
    sequencePanelAppearance,
    sequenceSourceFilter,
    setSequenceSourceFilter,
  } = useIdeWorkspaceStore();

  const visibleSequences = useMemo(
    () =>
      sequences.filter((sequence) => {
        const source = sequence.sourceMeta?.source || "manual";
        return sequenceSourceFilter === "all" || source === sequenceSourceFilter;
      }),
    [sequenceSourceFilter, sequences]
  );

  const panelStyle = useMemo(
    () => buildPanelStyle(sequencePanelAppearance.savedSequences),
    [sequencePanelAppearance.savedSequences]
  );

  return (
    <div className="ide-panel-shell ide-saved-sequences-panel" style={panelStyle}>
      <div className="ide-panel-header">
        <div>
          <strong>Saved Sequences</strong>
          <span>Reusable sequence stacks and imported MMSS sequence records.</span>
        </div>
      </div>
      <div className="sequence-filter-row">
        <select value={sequenceSourceFilter} onChange={(event) => setSequenceSourceFilter(event.target.value)}>
          <option value="all">all sources</option>
          <option value="flowmusic.app">flowmusic.app</option>
          <option value="manual">manual</option>
        </select>
      </div>
      <div className="saved-sequence-list">
        {visibleSequences.length ? (
          visibleSequences.map((sequence) => (
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
          ))
        ) : (
          <div className="ide-empty-panel">
            <Sparkles size={14} />
            <span>No sequences match the current source filter.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FocusCard({ title, value, meta }) {
  return (
    <div className="ide-workspace-focus-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function buildPanelStyle(config = {}) {
  const color = config.color || "#243447";
  const fontSize = config.fontSize || 14;
  return {
    "--builder-panel-accent": color,
    "--builder-panel-fill": hexToRgba(color, 0.16),
    "--builder-panel-fill-strong": hexToRgba(color, 0.22),
    "--builder-panel-border": hexToRgba(color, 0.42),
    "--builder-panel-text": `${fontSize}px`,
  };
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
