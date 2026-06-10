import { useMemo } from "react";

const PROMPT_PANEL_DEFAULT_ORDER = [
  "json_block_list",
  "prompt_logic_blockly",
  "json_block_editor",
  "json_sequence_builder",
  "json_bindings_panel",
];

function PromptLibraryTopbar({
  blocks,
  sequences,
  libraryReady,
  activePromptPanelMeta,
  onLoadLibrary,
  onImportSessionBlocks,
  onResetLayout,
  onSetActivePromptPanel,
  onClearComposition,
}) {
  const blockCount = blocks?.length || 0;
  const sequenceCount = sequences?.length || 0;

  return (
    <div className="prompt-library-topbar">
      <div className="prompt-library-topbar__head">
        <div>
          <strong>Prompt Workspace</strong>
          <span>
            {blockCount} block(s), {sequenceCount} sequence(s)
          </span>
        </div>
        <div className="prompt-library-status">
          <span>{libraryReady ? "Ready" : "Idle"}</span>
          <span>{activePromptPanelMeta?.label || "IDE Workspace"}</span>
        </div>
      </div>
      <div className="row">
        <button onClick={onLoadLibrary} disabled={libraryReady}>
          {libraryReady ? "Library Ready" : "Load Library"}
        </button>
        <button onClick={onImportSessionBlocks}>
          Import Session Blocks
        </button>
        <button
          onClick={() => {
            onResetLayout?.();
            onSetActivePromptPanel?.(PROMPT_PANEL_DEFAULT_ORDER[0]);
          }}
        >
          Reset Layout
        </button>
        <button onClick={onClearComposition}>
          Clear Composition
        </button>
      </div>
    </div>
  );
}

export default PromptLibraryTopbar;
