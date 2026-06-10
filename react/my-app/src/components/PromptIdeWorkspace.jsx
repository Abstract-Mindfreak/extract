import Editor from "@monaco-editor/react";
import {
  Actions,
  Layout,
  Model,
  TabNode,
} from "flexlayout-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Boxes,
  FileJson,
  GitCompare,
  PanelRightOpen,
  PlaySquare,
  Settings2,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import JsonBindingsPanel from "./JsonBindingsPanel";
import JsonBlockEditor from "./JsonBlockEditor";
import JsonBlockList from "./JsonBlockList";
import PromptLibraryTopbar from "./PromptLibraryTopbar";
import PromptLogicBlocklyPanel from "./PromptLogicBlocklyPanel";
import {
  PromptWorkspacePanel,
  SavedSequencesPanel,
  SequenceActionsPanel,
} from "./SequenceWorkspacePanels";
import { useIdeWorkspaceStore } from "../hooks/useIdeWorkspaceStore";
import "./PromptIdeWorkspace.css";

const PREVIEW_TAB_ID = "ide-preview-json";

function buildDefaultLayout() {
  return {
    global: {
      tabEnableClose: true,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      tabEnableRename: true,
      borderEnableAutoHide: true,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [
      {
        type: "border",
        location: "top",
        selected: 0,
        size: 100,
        children: [
          {
            id: "ide-topbar-tab",
            type: "tab",
            name: "Topbar",
            component: "topbar",
            enableClose: false,
            icon: "topbar",
          },
        ],
      },
      {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 220,
        children: [
          {
            id: "ide-terminal-tab",
            type: "tab",
            name: "Terminal / Логи парсинга",
            component: "terminal",
            enableClose: false,
            icon: "terminal",
          },
        ],
      },
      {
        type: "border",
        location: "right",
        selected: 0,
        size: 300,
        children: [
          {
            id: "ide-settings-tab",
            type: "tab",
            name: "Workspace Settings",
            component: "settings",
            enableClose: false,
            icon: "settings",
          },
        ],
      },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          id: "ide-left-tabset",
          weight: 28,
          selected: 0,
          children: [
            {
              id: "ide-block-list-tab",
              type: "tab",
              name: "Block Library",
              component: "block-list",
              enableClose: false,
              icon: "library",
            },
            {
              id: "ide-block-editor-tab",
              type: "tab",
              name: "Block Editor",
              component: "block-editor",
              enableClose: false,
              icon: "json",
            },
            {
              id: "ide-saved-sequences-tab",
              type: "tab",
              name: "Saved Sequences",
              component: "saved-sequences",
              enableClose: false,
              icon: "saved",
            },
            {
              id: "ide-bindings-tab",
              type: "tab",
              name: "Bindings",
              component: "bindings",
              enableClose: false,
              icon: "bindings",
            },
          ],
        },
        {
          type: "tabset",
          id: "ide-center-tabset",
          weight: 44,
          selected: 0,
          children: [
            {
              id: "ide-prompt-workspace-tab",
              type: "tab",
              name: "Prompt Workspace",
              component: "prompt-workspace",
              enableClose: false,
              icon: "workspace",
            },
            {
              id: "ide-graph-canvas-tab",
              type: "tab",
              name: "Холст графа",
              component: "graph-canvas",
              enableClose: false,
              icon: "graph",
            },
            {
              id: PREVIEW_TAB_ID,
              type: "tab",
              name: "Просмотр JSON",
              component: "json-preview",
              enableClose: false,
              icon: "json",
              config: {
                mode: "preview",
              },
            },
          ],
        },
        {
          type: "tabset",
          id: "ide-right-tabset",
          weight: 28,
          selected: 0,
          children: [
            {
              id: "ide-sequence-actions-tab",
              type: "tab",
              name: "Sequence Actions",
              component: "sequence-actions",
              enableClose: false,
              icon: "sequence",
            },
            {
              id: "ide-blockly-tab",
              type: "tab",
              name: "Blockly",
              component: "blockly",
              enableClose: false,
              icon: "blockly",
            },
          ],
        },
      ],
    },
  };
}

function normalizeTheme(uiTheme) {
  if (uiTheme === "alpha-light") return "flexlayout__theme_alpha_light";
  if (uiTheme === "rounded") return "flexlayout__theme_rounded";
  return "flexlayout__theme_dark";
}

function getEditorTheme(uiTheme) {
  return uiTheme === "alpha-light" ? "light" : "vs-dark";
}

export default function PromptIdeWorkspace(props) {
  const layoutRef = useRef(null);
  const workspaceStore = useIdeWorkspaceStore();
  const { blocks, selectedBlock, selectedBlockId } = props;
  const [model] = useState(() =>
    Model.fromJson(workspaceStore.layoutSnapshot || buildDefaultLayout())
  );

  const blockMap = useMemo(
    () => new Map(blocks.map((block) => [block.id, block])),
    [blocks]
  );

  useEffect(() => {
    if (!workspaceStore.previewBlockId && selectedBlockId) {
      workspaceStore.setPreviewBlockId(selectedBlockId);
    }
  }, [selectedBlockId, workspaceStore]);

  useEffect(() => {
    const previewNode = model.getNodeById(PREVIEW_TAB_ID);
    if (!previewNode) return;
    model.doAction(
      Actions.updateNodeAttributes(PREVIEW_TAB_ID, {
        config: {
          mode: "preview",
          blockId: workspaceStore.previewBlockId,
        },
      })
    );
  }, [model, workspaceStore.previewBlockId]);

  const openInPreview = (blockId) => {
    if (blockId) {
      props.onSelectBlock(blockId);
    }
    workspaceStore.setPreviewBlockId(blockId);
    model.doAction(
      Actions.updateNodeAttributes(PREVIEW_TAB_ID, {
        config: {
          mode: "preview",
          blockId,
        },
      })
    );
    model.doAction(Actions.selectTab(PREVIEW_TAB_ID));
  };

  const openInNewTab = (blockId) => {
    const block = blockMap.get(blockId);
    if (!block) return;

    props.onSelectBlock(blockId);
    const existing = findTabNode(
      model,
      (node) => node.getConfig()?.mode === "block" && node.getConfig()?.blockId === blockId
    );
    if (existing) {
      model.doAction(Actions.selectTab(existing.getId()));
      return;
    }

    const added = layoutRef.current?.addTabToTabSet("ide-center-tabset", {
      id: `ide-block-tab:${blockId}`,
      type: "tab",
      component: "json-preview",
      name: block.name || block.id,
      enableClose: true,
      enablePopout: true,
      enablePopoutIcon: true,
      config: {
        mode: "block",
        blockId,
      },
    });

    if (added) {
      model.doAction(Actions.selectTab(added.getId()));
    }
  };

  const openBlankTab = (tabsetId = "ide-center-tabset") => {
    const draftId = workspaceStore.createDraftDocument();
    const draft = useIdeWorkspaceStore.getState().draftDocuments[draftId];
    const added = layoutRef.current?.addTabToTabSet(tabsetId, {
      id: `ide-draft-tab:${draftId}`,
      type: "tab",
      component: "json-preview",
      name: draft?.name || "New JSON",
      enableClose: true,
      enablePopout: true,
      enablePopoutIcon: true,
      config: {
        mode: "draft",
        draftId,
      },
    });

    if (added) {
      model.doAction(Actions.selectTab(added.getId()));
    }
  };

  const selectedSequence = useMemo(
    () =>
      props.sequenceBuilderProps.sequences.find(
        (sequence) => sequence.id === props.sequenceBuilderProps.selectedSequenceId
      ) || null,
    [props.sequenceBuilderProps.selectedSequenceId, props.sequenceBuilderProps.sequences]
  );

  const factory = (node) => {
    const component = node.getComponent();

    if (component === "topbar") {
      return (
        <PromptLibraryTopbar
          blocks={blocks}
          sequences={props.sequenceBuilderProps?.sequences || []}
          libraryReady={props.workspaceProps?.libraryReady || false}
          activePromptPanelMeta={{
            label: "IDE Workspace",
            subtitle: "Unified prompt library workspace",
          }}
          onLoadLibrary={props.workspaceProps?.onLoadLibrary}
          onImportSessionBlocks={props.workspaceProps?.onImportSessionBlocks}
          onResetLayout={props.workspaceProps?.onResetLayout}
          onSetActivePromptPanel={() => {}}
          onClearComposition={props.sequenceBuilderProps?.onClearComposition}
        />
      );
    }

    if (component === "block-list") {
      return (
        <JsonBlockList
          blocks={blocks}
          selectedBlockId={selectedBlockId}
          onSelect={(blockId) => {
            props.onSelectBlock(blockId);
            openInPreview(blockId);
          }}
          onOpenInNewTab={openInNewTab}
          onDuplicate={props.onDuplicateBlock}
          onDelete={props.onDeleteBlock}
          onPrepareBind={props.onPrepareBind}
        />
      );
    }

    if (component === "block-editor") {
      return (
        <JsonBlockEditor
          block={selectedBlock}
          onSave={props.onSaveBlock}
          onSaveToLibrary={props.onSaveToLibrary}
          onExport={props.onExportBlock}
        />
      );
    }

    if (component === "saved-sequences") {
      return (
        <SavedSequencesPanel
          onSelectSequence={props.sequenceBuilderProps.onSelectSequence}
          selectedSequenceId={props.sequenceBuilderProps.selectedSequenceId}
          sequences={props.sequenceBuilderProps.sequences}
        />
      );
    }

    if (component === "prompt-workspace") {
      return (
        <PromptWorkspacePanel
          activeComposition={props.sequenceBuilderProps.activeComposition}
          blocks={blocks}
          libraryReady={props.workspaceProps.libraryReady}
          selectedBlock={selectedBlock}
          selectedSequence={selectedSequence}
          sequences={props.sequenceBuilderProps.sequences}
          workspaceActions={props.workspaceProps}
        />
      );
    }

    if (component === "sequence-actions") {
      return (
        <SequenceActionsPanel
          activeComposition={props.sequenceBuilderProps.activeComposition}
          blocks={props.sequenceBuilderProps.blocks}
          onAddBlock={props.sequenceBuilderProps.onAddBlock}
          onBatchExport={props.sequenceBuilderProps.onBatchExport}
          onCopyPreview={props.sequenceBuilderProps.onCopyPreview}
          onDeleteSequence={props.sequenceBuilderProps.onDeleteSequence}
          onExportSequence={props.sequenceBuilderProps.onExportSequence}
          onGeneratePresetComposition={props.sequenceBuilderProps.onGeneratePresetComposition}
          onRemoveBlock={props.sequenceBuilderProps.onRemoveBlock}
          onReorder={props.sequenceBuilderProps.onReorder}
          onSaveCompositionAsSequence={props.sequenceBuilderProps.onSaveCompositionAsSequence}
          onSavePreviewFile={props.sequenceBuilderProps.onSavePreviewFile}
          onSaveToLibrary={props.sequenceBuilderProps.onSaveToLibrary}
          onSetMergeStrategy={props.sequenceBuilderProps.onSetMergeStrategy}
          selectedSequenceId={props.sequenceBuilderProps.selectedSequenceId}
        />
      );
    }

    if (component === "bindings") {
      return <JsonBindingsPanel {...props.bindingsProps} />;
    }

    if (component === "blockly") {
      return <PromptLogicBlocklyPanel {...props.blocklyProps} />;
    }

    if (component === "graph-canvas") {
      return (
        <GraphCanvasPanel
          blocks={blocks}
          enableGraphDecomposition={workspaceStore.enableGraphDecomposition}
          onOpenInNewTab={openInNewTab}
          onOpenInPreview={openInPreview}
          selectedBlockId={selectedBlockId}
        />
      );
    }

    if (component === "terminal") {
      return <TerminalPanel logs={props.logs} />;
    }

    if (component === "settings") {
      return (
        <SettingsPanel
          enableGraphDecomposition={workspaceStore.enableGraphDecomposition}
          fontScale={workspaceStore.fontScale}
          onChangeFontScale={workspaceStore.setFontScale}
          onChangeTheme={workspaceStore.setUiTheme}
          onToggleDecomposition={workspaceStore.setEnableGraphDecomposition}
          uiTheme={workspaceStore.uiTheme}
        />
      );
    }

    if (component === "json-preview") {
      return (
        <JsonPreviewPanel
          blockMap={blockMap}
          draftDocuments={workspaceStore.draftDocuments}
          editorTheme={getEditorTheme(workspaceStore.uiTheme)}
          fontScale={workspaceStore.fontScale}
          node={node}
          onChangeBlockJson={props.onChangeBlockJson}
          onRenameDraft={workspaceStore.renameDraftDocument}
          onUpdateDraft={workspaceStore.updateDraftContent}
          previewBlockId={workspaceStore.previewBlockId}
        />
      );
    }

    return <div className="ide-panel-shell">Unknown panel: {component}</div>;
  };

  return (
    <div className={`prompt-ide-shell ${normalizeTheme(workspaceStore.uiTheme)} ide-font-${workspaceStore.fontScale}`}>
      <Layout
        factory={factory}
        model={model}
        onAction={(action) => {
          if (action.type === Actions.DELETE_TAB) {
            const tabNode = model.getNodeById(String(action.data.node));
            const config = tabNode?.getConfig?.();
            if (config?.mode === "draft" && config?.draftId) {
              workspaceStore.removeDraftDocument(config.draftId);
            }
          }
          return action;
        }}
        onAuxMouseClick={(node, event) => {
          if (event.button !== 1 || !(node instanceof TabNode)) return;
          if (node.getId() === PREVIEW_TAB_ID && workspaceStore.previewBlockId) {
            openInNewTab(workspaceStore.previewBlockId);
          }
        }}
        onModelChange={(nextModel, action) => {
          if (action.type === Actions.RENAME_TAB) {
            const renamedNode = nextModel.getNodeById(String(action.data.node));
            const config = renamedNode?.getConfig?.();
            const nextName = String(action.data.text ?? renamedNode?.getName?.() ?? "");
            if (config?.mode === "draft" && config?.draftId) {
              workspaceStore.renameDraftDocument(config.draftId, nextName);
            }
          }
          workspaceStore.setLayoutSnapshot(nextModel.toJson());
        }}
        onRenderTab={(node, renderValues) => {
          renderValues.leading = resolveTabIcon(node.getConfig()?.icon);
        }}
        onRenderTabSet={(tabSetNode, renderValues) => {
          renderValues.buttons.push(
            <button
              key={`add-${tabSetNode.getId()}`}
              className="ide-tabset-add"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openBlankTab(tabSetNode.getId());
              }}
              title="Add Tab"
              type="button"
            >
              +
            </button>
          );
        }}
        popoutClassName={`prompt-ide-popout ${normalizeTheme(workspaceStore.uiTheme)} ide-font-${workspaceStore.fontScale}`}
        popoutURL="popout.html"
        ref={layoutRef}
      />
    </div>
  );
}

function JsonPreviewPanel({
  blockMap,
  draftDocuments,
  editorTheme,
  fontScale,
  node,
  onChangeBlockJson,
  onRenameDraft,
  onUpdateDraft,
  previewBlockId,
}) {
  const config = node.getConfig?.() || {};
  const mode = config.mode || "preview";
  const blockId = mode === "preview" ? previewBlockId : config.blockId;
  const block = blockId ? blockMap.get(blockId) : null;
  const draft = config.draftId ? draftDocuments[config.draftId] : null;
  const [localError, setLocalError] = useState("");

  const value = useMemo(() => {
    if (mode === "draft") {
      return draft?.content || '{\n  "prompt": ""\n}';
    }
    if (!block) {
      return '{\n  "status": "No block selected"\n}';
    }
    return JSON.stringify(block.payload?.data || {}, null, 2);
  }, [block, draft?.content, mode]);

  return (
    <div className="ide-panel-shell ide-editor-panel">
      <div className="ide-panel-header">
        <div>
          <strong>{mode === "draft" ? draft?.name || "New JSON" : block?.name || "JSON Preview"}</strong>
          <span>
            {mode === "draft"
              ? "Unsaved draft tab"
              : block?.category || block?.sourceMeta?.source || "Prompt block payload"}
          </span>
        </div>
      </div>
      <div className="ide-editor-wrap">
        <Editor
          defaultLanguage="json"
          height="100%"
          onChange={(nextValue) => {
            const text = nextValue || "";
            if (mode === "draft" && draft) {
              onUpdateDraft(draft.id, text);
              if (draft.name !== node.getName()) {
                onRenameDraft(draft.id, node.getName());
              }
              setLocalError("");
              return;
            }
            if (!blockId) return;
            try {
              onChangeBlockJson(blockId, text);
              setLocalError("");
            } catch (error) {
              setLocalError(error.message || "Invalid JSON");
            }
          }}
          options={{
            automaticLayout: true,
            fontSize: fontScale === "small" ? 12 : fontScale === "large" ? 16 : 14,
            minimap: { enabled: false },
            padding: { top: 12, bottom: 12 },
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
          theme={editorTheme}
          value={value}
        />
      </div>
      {localError ? <div className="ide-error-banner">{localError}</div> : null}
    </div>
  );
}

function GraphCanvasPanel({
  blocks,
  enableGraphDecomposition,
  onOpenInNewTab,
  onOpenInPreview,
  selectedBlockId,
}) {
  return (
    <div className="ide-panel-shell ide-graph-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Холст графа</strong>
          <span>
            {enableGraphDecomposition
              ? "Decomposition toggle is enabled. File focus can drive graph-specific views later."
              : "Use left click for JSON Preview and middle click or New Tab for a dedicated editor tab."}
          </span>
        </div>
      </div>
      <div className="ide-graph-canvas">
        {blocks.slice(0, 48).map((block, index) => (
          <button
            key={block.id}
            type="button"
            className={`ide-graph-node ${selectedBlockId === block.id ? "is-active" : ""}`}
            style={{
              left: `${24 + (index % 4) * 220}px`,
              top: `${24 + Math.floor(index / 4) * 148}px`,
            }}
            onClick={() => onOpenInPreview(block.id)}
            onMouseDown={(event) => {
              if (event.button === 1) {
                event.preventDefault();
                onOpenInNewTab(block.id);
              }
            }}
          >
            <span className="ide-graph-node__title">{block.name}</span>
            <span className="ide-graph-node__meta">{block.category || "general"}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TerminalPanel({ logs }) {
  const visibleLogs = Array.isArray(logs) ? [...logs].slice(-40).reverse() : [];

  return (
    <div className="ide-panel-shell ide-terminal-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Terminal / Логи парсинга</strong>
          <span>Latest MMSS activity, imports, and composition events.</span>
        </div>
      </div>
      <div className="ide-terminal-log">
        {visibleLogs.length ? (
          visibleLogs.map((entry, index) => (
            <div className="ide-terminal-line" key={`${entry}-${index}`}>
              {entry}
            </div>
          ))
        ) : (
          <div className="ide-terminal-line is-empty">No logs yet.</div>
        )}
      </div>
    </div>
  );
}

function SettingsPanel({
  enableGraphDecomposition,
  fontScale,
  onChangeFontScale,
  onChangeTheme,
  onToggleDecomposition,
  uiTheme,
}) {
  return (
    <div className="ide-panel-shell ide-settings-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Workspace Settings</strong>
          <span>Global layout settings for IDE tabs, Monaco editors, and prompt workspace panels.</span>
        </div>
      </div>
      <div className="ide-settings-form">
        <label className="ide-toggle-row">
          <span>Детализировать изолированный граф</span>
          <input
            checked={enableGraphDecomposition}
            onChange={(event) => onToggleDecomposition(event.target.checked)}
            type="checkbox"
          />
        </label>

        <label>
          <span>Size</span>
          <select value={fontScale} onChange={(event) => onChangeFontScale(event.target.value)}>
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large">large</option>
          </select>
        </label>

        <label>
          <span>Theme</span>
          <select value={uiTheme} onChange={(event) => onChangeTheme(event.target.value)}>
            <option value="alpha-light">Alpha Light</option>
            <option value="vs-dark">vs-dark</option>
            <option value="rounded">Rounded</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function findTabNode(model, predicate) {
  let found;
  model.visitNodes((node) => {
    if (found || typeof node.getComponent !== "function") return;
    if (predicate(node)) {
      found = node;
    }
  });
  return found;
}

function resolveTabIcon(icon) {
  const common = { size: 14, strokeWidth: 2 };
  switch (icon) {
    case "library":
      return <Boxes {...common} />;
    case "json":
      return <FileJson {...common} />;
    case "sequence":
      return <PlaySquare {...common} />;
    case "saved":
      return <PanelRightOpen {...common} />;
    case "bindings":
      return <GitCompare {...common} />;
    case "blockly":
      return <Workflow {...common} />;
    case "terminal":
      return <TerminalSquare {...common} />;
    case "settings":
      return <Settings2 {...common} />;
    case "workspace":
      return <Boxes {...common} />;
    case "graph":
      return <Workflow {...common} />;
    case "topbar":
      return <Boxes {...common} />;
    default:
      return <Boxes {...common} />;
  }
}
