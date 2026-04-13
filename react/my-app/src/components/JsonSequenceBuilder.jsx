import { useMemo, useState } from "react";

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
  onBatchExport,
}) {
  const [sequenceName, setSequenceName] = useState("");
  const [sequenceDescription, setSequenceDescription] = useState("");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [presetCount, setPresetCount] = useState(6);
  const [batchFormula, setBatchFormula] = useState("6x44 random");
  const [batchMode, setBatchMode] = useState("random");
  const [batchTagPreset, setBatchTagPreset] = useState("all");

  const compositionBlocks = useMemo(
    () =>
      activeComposition.blockIds.map((blockId, index) => ({
        order: index,
        block: blocks.find((entry) => entry.id === blockId),
      })),
    [activeComposition.blockIds, blocks]
  );

  return (
    <div className="json-sequence-builder">
      <div className="sequence-builder-top">
        <div>
          <strong>Saved Sequences</strong>
          <div className="saved-sequence-list">
            {sequences.map((sequence) => (
              <button
                key={sequence.id}
                className={`saved-sequence-card ${selectedSequenceId === sequence.id ? "active" : ""}`}
                onClick={() => onSelectSequence(sequence.id)}
              >
                <span>{sequence.name}</span>
                <small>{sequence.mergeStrategy}</small>
              </button>
            ))}
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
        className="sequence-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const blockId = event.dataTransfer.getData("text/plain");
          if (blockId) onAddBlock(blockId);
        }}
      >
        <span>Drop blocks here or use Add from the library list</span>
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
      </div>

      <div className="preset-builder">
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

      <div className="composition-blocks">
        {compositionBlocks.map((entry, index) => (
          <div className="composition-chip" key={`${entry.block?.id || "missing"}_${index}`}>
            <span>{entry.block?.name || "Missing block"}</span>
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
          Save composition as lyrics
        </button>
        <div className="sequence-save-actions">
          <button onClick={() => onCopyPreview(activeComposition.combinedJson)}>Copy JSON Preview</button>
          <button onClick={() => onSavePreviewFile(activeComposition.combinedJson)}>Save JSON File</button>
        </div>
      </div>

      {previewVisible ? (
        <pre className="json-preview">{JSON.stringify(activeComposition.combinedJson, null, 2)}</pre>
      ) : null}
    </div>
  );
}

export default JsonSequenceBuilder;
