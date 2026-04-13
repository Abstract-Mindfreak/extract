function JsonBindingsPanel({
  bindings,
  bindingMode,
  sequencePressMode,
  blocks,
  sequences,
  selectedBlockId,
  selectedSequenceId,
  activeComposition,
  onSetBindingMode,
  onSetSequencePressMode,
  onBindButton,
  onTriggerButton,
  onClearComposition,
  onSaveCompositionAsSequence,
  onExportComposition,
  onPrepareBind,
  onImportLibrary,
  onExportLibrary,
  onExportBlocksAsFiles,
  onLoadLibrary,
  libraryReady,
}) {
  const selectedTargetId = bindingMode === "block" ? selectedBlockId : selectedSequenceId;
  const selectedTarget =
    bindingMode === "block"
      ? blocks.find((block) => block.id === selectedBlockId)
      : sequences.find((sequence) => sequence.id === selectedSequenceId);

  return (
    <div className="json-bindings-panel">
      <div className="bindings-head">
        <div className="binding-mode-strip">
          <button
            className={bindingMode === "block" ? "active" : ""}
            onClick={() => onSetBindingMode("block")}
          >
            Block Mode
          </button>
          <button
            className={bindingMode === "sequence" ? "active" : ""}
            onClick={() => onSetBindingMode("sequence")}
          >
            Sequence Mode
          </button>
        </div>

        <label>
          Sequence Press
          <select value={sequencePressMode} onChange={(event) => onSetSequencePressMode(event.target.value)}>
            <option value="replace">replace</option>
            <option value="append">append</option>
          </select>
        </label>
      </div>

      <div className="binding-selected-source">
        <span>Selected source</span>
        <strong>{selectedTarget ? selectedTarget.name : "Pick a block or sequence first"}</strong>
        {selectedTarget ? (
          <button onClick={() => onPrepareBind(bindingMode, selectedTargetId)}>Prepare bind</button>
        ) : null}
      </div>

      <div className="binding-grid">
        {bindings.map((binding) => (
          <button
            key={binding.buttonId}
            className={`binding-slot ${binding.targetId ? "bound" : ""}`}
            onClick={() => {
              if (selectedTargetId) {
                onBindButton(binding.buttonId, bindingMode, selectedTargetId);
              } else {
                onTriggerButton(binding.buttonId);
              }
            }}
          >
            <span>{binding.buttonId.replace("slot_", "S")}</span>
            <strong>{resolveBindingName(binding, blocks, sequences)}</strong>
          </button>
        ))}
      </div>

      <div className="binding-actions">
        <button onClick={onClearComposition}>Step 1: Clear</button>
        <button onClick={onSaveCompositionAsSequence} disabled={!activeComposition.blockIds.length}>
          Save composition as lyrics
        </button>
        <button onClick={() => onExportComposition(activeComposition.combinedJson, "composition")}>
          Export Composition
        </button>
        <div className="library-step-actions">
          <button onClick={onLoadLibrary} disabled={libraryReady}>
            {libraryReady ? "Step 2: Library Loaded" : "Step 2: Load Library"}
          </button>
          <label className="dock-file library-file">
            Step 3: Import JSON files
            <input
              type="file"
              accept="application/json,.txt"
              multiple
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (files.length) onImportLibrary(files);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <button onClick={onExportLibrary}>Step 4: Export Library</button>
          <button onClick={onExportBlocksAsFiles}>Step 5: Export Blocks Folder</button>
        </div>
      </div>
    </div>
  );
}

function resolveBindingName(binding, blocks, sequences) {
  if (!binding.targetId || !binding.bindingType) return "Unbound";
  if (binding.bindingType === "block") {
    return blocks.find((block) => block.id === binding.targetId)?.name || "Missing block";
  }
  return sequences.find((sequence) => sequence.id === binding.targetId)?.name || "Missing sequence";
}

export default JsonBindingsPanel;
