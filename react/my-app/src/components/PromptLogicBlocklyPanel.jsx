import { useEffect, useMemo, useRef, useState } from "react";
import * as Blockly from "blockly";
import { javascriptGenerator } from "blockly/javascript";
import * as BlocklyRu from "blockly/msg/ru";
import {
  BLOCKLY_CONTEXT_PRESETS,
  DEFAULT_BLOCKLY_CONTEXT,
  MERGE_STRATEGIES,
} from "../mmss/promptTypes";
import { DEFAULT_BLOCKLY_WORKSPACE_XML } from "../mmss/promptLibrary";

const BLOCKLY_HEIGHT_STORAGE_KEY = "mmss.blockly.height.v1";
const BLOCKLY_EXPANDED_STORAGE_KEY = "mmss.blockly.expanded.v1";

let customBlocksRegistered = false;
let blockOptionsProvider = () => [["No blocks", "__none__"]];
let sequenceOptionsProvider = () => [["No sequences", "__none__"]];

function PromptLogicBlocklyPanel({
  blocks,
  sequences,
  sourceJson,
  onSetActiveComposition,
  onClearActiveComposition,
  initialContext,
  initialWorkspaceXml,
  onWorkspaceXmlChange,
}) {
  const containerRef = useRef(null);
  const workspaceRef = useRef(null);
  const onWorkspaceXmlChangeRef = useRef(onWorkspaceXmlChange);
  const initialWorkspaceXmlRef = useRef(initialWorkspaceXml);
  const [runtimeContext, setRuntimeContext] = useState(() => ({
    ...DEFAULT_BLOCKLY_CONTEXT,
    ...(initialContext || {}),
  }));
  const [selectedPreset, setSelectedPreset] = useState("neuro_dark");
  const [runError, setRunError] = useState("");
  const [sourceJsonText, setSourceJsonText] = useState("");
  const [workspaceHeight, setWorkspaceHeight] = useState(loadBlocklyHeight);
  const [expanded, setExpanded] = useState(loadBlocklyExpanded);
  const [toast, setToast] = useState(null);

  const toolbox = useMemo(
    () => ({
      kind: "categoryToolbox",
      contents: [
        {
          kind: "category",
          name: "MMSS Logic",
          colour: "#5f9bff",
          contents: [
            { kind: "block", type: "mmss_prompt_condition" },
            { kind: "block", type: "mmss_add_block" },
            { kind: "block", type: "mmss_use_sequence" },
            { kind: "block", type: "mmss_set_merge_strategy" },
          ],
        },
        {
          kind: "category",
          name: "Logic",
          colour: "#8f63d8",
          contents: [
            { kind: "block", type: "controls_if" },
            { kind: "block", type: "logic_compare" },
            { kind: "block", type: "logic_operation" },
            { kind: "block", type: "logic_boolean" },
          ],
        },
      ],
    }),
    []
  );

  useEffect(() => {
    onWorkspaceXmlChangeRef.current = onWorkspaceXmlChange;
  }, [onWorkspaceXmlChange]);

  useEffect(() => {
    blockOptionsProvider = () => toDropdownOptions(blocks);
    sequenceOptionsProvider = () => toDropdownOptions(sequences);
    Blockly.setLocale(BlocklyRu);
    registerCustomBlocks();
  }, [blocks, sequences]);

  useEffect(() => {
    if (sourceJson == null) return;
    try {
      const text = typeof sourceJson === "string" ? sourceJson : JSON.stringify(sourceJson, null, 2);
      setSourceJsonText(text || "");
    } catch {
      setSourceJsonText("");
    }
  }, [sourceJson]);

  useEffect(() => {
    registerCustomBlocks();
    if (!containerRef.current || workspaceRef.current) return;
    const workspace = Blockly.inject(containerRef.current, {
      toolbox,
      trashcan: true,
      renderer: "geras",
      move: { wheel: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 2,
        minScale: 0.4,
        scaleSpeed: 1.1,
      },
    });
    workspaceRef.current = workspace;

    const xmlText =
      typeof initialWorkspaceXmlRef.current === "string" && initialWorkspaceXmlRef.current.trim()
        ? initialWorkspaceXmlRef.current
        : DEFAULT_BLOCKLY_WORKSPACE_XML;
    restoreWorkspace(workspace, xmlText);

    const changeListener = () => {
      if (!onWorkspaceXmlChangeRef.current) return;
      try {
        const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
        onWorkspaceXmlChangeRef.current(xml);
      } catch {
        // keep editor stable
      }
    };
    workspace.addChangeListener(changeListener);

    return () => {
      workspace.removeChangeListener(changeListener);
      workspace.dispose();
      workspaceRef.current = null;
    };
  }, [toolbox]);

  useEffect(() => {
    setRuntimeContext((current) => ({
      ...current,
      ...(initialContext || {}),
    }));
  }, [initialContext]);

  useEffect(() => {
    window.localStorage.setItem(BLOCKLY_HEIGHT_STORAGE_KEY, String(workspaceHeight));
  }, [workspaceHeight]);

  useEffect(() => {
    window.localStorage.setItem(BLOCKLY_EXPANDED_STORAGE_KEY, expanded ? "1" : "0");
  }, [expanded]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setTimeout(() => Blockly.svgResize(workspace), 0);
  }, [workspaceHeight, expanded]);

  function handleApply() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    setRunError("");

    try {
      const code = javascriptGenerator.workspaceToCode(workspace);
      const composition = [];
      let mergeStrategy = "merge_deep";

      const addBlock = (id) => {
        if (!id || id === "__none__") return;
        if (!blocks.some((block) => block.id === id)) return;
        composition.push(id);
      };

      const addSequence = (sequenceId) => {
        if (!sequenceId || sequenceId === "__none__") return;
        const sequence = sequences.find((item) => item.id === sequenceId);
        if (!sequence) return;
        const ids = [...sequence.blocks]
          .sort((left, right) => Number(left.order) - Number(right.order))
          .map((entry) => entry.blockId);
        ids.forEach((id) => addBlock(id));
      };

      const setMergeStrategy = (value) => {
        if (MERGE_STRATEGIES.includes(value)) mergeStrategy = value;
      };

      // eslint-disable-next-line no-new-func
      const executor = new Function(
        "context",
        "addBlock",
        "addSequence",
        "setMergeStrategy",
        `"use strict";\n${code}`
      );
      executor(runtimeContext, addBlock, addSequence, setMergeStrategy);

      const workspaceXml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
      onSetActiveComposition(composition, mergeStrategy, {
        source: "blockly",
        workspaceXml,
        context: runtimeContext,
      });
      showToast(`Applied ${composition.length} block(s) with ${mergeStrategy}`, "success");
    } catch (error) {
      setRunError(error.message || "Blockly execution failed");
      showToast(error.message || "Blockly execution failed", "error");
    }
  }

  function handleReset() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    restoreWorkspace(workspace, DEFAULT_BLOCKLY_WORKSPACE_XML);
    setRunError("");
    if (onClearActiveComposition) onClearActiveComposition();
    if (onWorkspaceXmlChange) onWorkspaceXmlChange(DEFAULT_BLOCKLY_WORKSPACE_XML);
    showToast("Workspace reset to default", "info");
  }

  function handleContextPreset(value) {
    setSelectedPreset(value);
    const preset = BLOCKLY_CONTEXT_PRESETS[value];
    if (!preset) return;
    setRuntimeContext((current) => ({
      ...current,
      ...preset,
    }));
  }

  function handleTemplate(templateId) {
    const plan = buildTemplatePlan(templateId, blocks);
    applyPlanToWorkspace(plan);
  }

  function handleAutoMapJson() {
    setRunError("");
    if (!sourceJsonText.trim()) {
      setRunError("JSON source is empty");
      showToast("JSON source is empty", "error");
      return;
    }
    const parsed = safeParseJson(sourceJsonText);
    if (!parsed.ok) {
      setRunError(`JSON parse error: ${parsed.error}`);
      showToast("JSON parse error", "error");
      return;
    }

    const plan = buildPlanFromJson(parsed.value, blocks);
    applyPlanToWorkspace(plan);
    showToast(`Auto-mapped ${plan.blockIds.length} block(s)`, "success");
  }

  function applyPlanToWorkspace(plan) {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const xml = buildWorkspaceXml(plan);
    restoreWorkspace(workspace, xml);
    if (onWorkspaceXmlChange) onWorkspaceXmlChange(xml);
  }

  function handleExportXml() {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace));
    const blob = new Blob([xml], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "mmss_blockly_workspace.xml";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Workspace XML exported", "success");
  }

  async function handleImportXml(file) {
    if (!file) return;
    try {
      const xmlText = await file.text();
      const workspace = workspaceRef.current;
      if (!workspace) return;
      restoreWorkspace(workspace, xmlText);
      if (onWorkspaceXmlChange) onWorkspaceXmlChange(xmlText);
      setRunError("");
      showToast("Workspace XML imported", "success");
    } catch (error) {
      setRunError(error.message || "XML import failed");
      showToast("XML import failed", "error");
    }
  }

  function showToast(message, type = "success") {
    setToast({ message, type });
    window.clearTimeout(showToast.timerId);
    showToast.timerId = window.setTimeout(() => {
      setToast(null);
    }, 2800);
  }

  return (
    <div className="blockly-panel">
      <div className="blockly-header">
        <div>
          <strong>Prompt Logic Blockly</strong>
          <p>Build composition visually, then apply to Prompt Library state.</p>
        </div>

        <div className="blockly-quick-tools">
          <span>Patterns</span>
          <button onClick={() => handleTemplate("lyrics_arc")}>Lyrics Arc</button>
          <button onClick={() => handleTemplate("technical_stack")}>Technical Stack</button>
          <button onClick={() => handleTemplate("visual_pulse")}>Visual Pulse</button>
          <button onClick={() => handleTemplate("balanced_mix")}>Balanced Mix</button>
        </div>

        <div className="blockly-size-controls">
          <span>Workspace</span>
          <button onClick={() => setWorkspaceHeight((h) => Math.max(300, h - 40))}>-</button>
          <button onClick={() => setWorkspaceHeight((h) => Math.min(920, h + 40))}>+</button>
          <button onClick={() => setExpanded((value) => !value)}>
            {expanded ? "Compact" : "Expand"}
          </button>
          <label>
            Height
            <input
              type="range"
              min={300}
              max={920}
              step={10}
              value={workspaceHeight}
              onChange={(event) => setWorkspaceHeight(Number(event.target.value) || 460)}
            />
          </label>
        </div>

        <div className="blockly-context-controls">
          <label>
            Context preset
            <select value={selectedPreset} onChange={(event) => handleContextPreset(event.target.value)}>
              {Object.keys(BLOCKLY_CONTEXT_PRESETS).map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </label>
          <label>
            Genre
            <input
              value={runtimeContext.genre || ""}
              onChange={(event) =>
                setRuntimeContext((current) => ({ ...current, genre: event.target.value }))
              }
            />
          </label>
          <label>
            Mood
            <input
              value={runtimeContext.mood || ""}
              onChange={(event) =>
                setRuntimeContext((current) => ({ ...current, mood: event.target.value }))
              }
            />
          </label>
        </div>

        <div className="blockly-json-map">
          <label>
            Auto-map JSON to Blockly
            <textarea
              value={sourceJsonText}
              onChange={(event) => setSourceJsonText(event.target.value)}
              placeholder="Paste JSON and click Auto-map"
            />
          </label>
          <button onClick={handleAutoMapJson}>Auto-map JSON</button>
        </div>
      </div>

      <div
        className={`blockly-workspace ${expanded ? "expanded" : ""}`}
        style={{ height: `${workspaceHeight}px` }}
        ref={containerRef}
      />

      <div className="blockly-footer">
        <button className="accent-action" onClick={handleApply}>
          Apply Blocks
        </button>
        <button onClick={handleAutoMapJson}>Auto-map JSON</button>
        <button onClick={handleReset}>Reset Workspace</button>
        <button onClick={handleExportXml}>Export XML</button>
        <label className="blockly-file-btn">
          Import XML
          <input
            type="file"
            accept=".xml,text/xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              handleImportXml(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      {runError ? <div className="json-error">Blockly error: {runError}</div> : null}
      {toast ? <div className={`blockly-toast ${toast.type}`}>{toast.message}</div> : null}
    </div>
  );
}

function loadBlocklyHeight() {
  const raw = Number(window.localStorage.getItem(BLOCKLY_HEIGHT_STORAGE_KEY));
  if (!Number.isFinite(raw)) return 460;
  return Math.max(300, Math.min(920, raw));
}

function loadBlocklyExpanded() {
  return window.localStorage.getItem(BLOCKLY_EXPANDED_STORAGE_KEY) === "1";
}

function toDropdownOptions(items) {
  if (!Array.isArray(items) || !items.length) return [["No entries", "__none__"]];
  return items.map((item) => [item.name || item.id, item.id]);
}

function restoreWorkspace(workspace, xmlText) {
  workspace.clear();
  try {
    const dom = Blockly.utils.xml.textToDom(xmlText || DEFAULT_BLOCKLY_WORKSPACE_XML);
    Blockly.Xml.domToWorkspace(dom, workspace);
  } catch {
    const fallback = Blockly.utils.xml.textToDom(DEFAULT_BLOCKLY_WORKSPACE_XML);
    Blockly.Xml.domToWorkspace(fallback, workspace);
  }
}

function buildTemplatePlan(templateId, blocks) {
  if (!Array.isArray(blocks) || !blocks.length) {
    return { mergeStrategy: "merge_deep", blockIds: [] };
  }
  if (templateId === "lyrics_arc") {
    return {
      mergeStrategy: "concat",
      blockIds: takeByPredicate(blocks, (block) => hasTag(block, ["lyric", "lfe", "text"]), 8),
    };
  }
  if (templateId === "technical_stack") {
    return {
      mergeStrategy: "merge_deep",
      blockIds: takeByPredicate(
        blocks,
        (block) => hasTag(block, ["audio", "eq", "mix", "filter", "phase", "compression"]),
        8
      ),
    };
  }
  if (templateId === "visual_pulse") {
    return {
      mergeStrategy: "merge_shallow",
      blockIds: takeByPredicate(
        blocks,
        (block) => hasTag(block, ["visual", "shader", "color", "orbit", "stage", "image"]),
        8
      ),
    };
  }
  return {
    mergeStrategy: "merge_deep",
    blockIds: blocks
      .slice()
      .sort((a, b) => (b.tags?.length || 0) - (a.tags?.length || 0))
      .slice(0, 8)
      .map((block) => block.id),
  };
}

function buildPlanFromJson(value, blocks) {
  const tokens = collectJsonTokens(value);
  const scored = blocks
    .map((block) => ({
      id: block.id,
      score: scoreBlockAgainstTokens(block, tokens),
    }))
    .sort((a, b) => b.score - a.score);
  const selected = scored.filter((item) => item.score > 0).slice(0, 10).map((item) => item.id);
  const blockIds = selected.length ? selected : blocks.slice(0, 6).map((block) => block.id);
  const mergeStrategy = inferMergeStrategy(value, tokens);
  return { mergeStrategy, blockIds };
}

function buildWorkspaceXml(plan) {
  const strategy = MERGE_STRATEGIES.includes(plan?.mergeStrategy) ? plan.mergeStrategy : "merge_deep";
  const ids = Array.isArray(plan?.blockIds) ? plan.blockIds.filter(Boolean).slice(0, 20) : [];

  let chain = "";
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    chain = `<next><block type="mmss_add_block"><field name="BLOCK_ID">${escapeXml(
      ids[index]
    )}</field>${chain}</block></next>`;
  }

  return `<xml xmlns="https://developers.google.com/blockly/xml"><block type="mmss_set_merge_strategy" x="24" y="24"><field name="MERGE_STRATEGY">${strategy}</field>${chain}</block></xml>`;
}

function collectJsonTokens(value) {
  const tokens = new Set();
  collectTokens(value, tokens, 0);
  return tokens;
}

function collectTokens(value, out, depth) {
  if (depth > 6 || out.size > 320) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectTokens(item, out, depth + 1));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      tokenize(key).forEach((token) => out.add(token));
      collectTokens(child, out, depth + 1);
    });
    return;
  }
  if (typeof value === "string") {
    tokenize(value).forEach((token) => out.add(token));
  }
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .split(/[^a-z0-9_]+/g)
    .filter((token) => token.length > 2);
}

function scoreBlockAgainstTokens(block, tokens) {
  if (!tokens?.size) return 0;
  const local = new Set([
    ...tokenize(block.name),
    ...tokenize(block.category),
    ...tokenize((block.tags || []).join(" ")),
  ]);
  let score = 0;
  local.forEach((token) => {
    if (tokens.has(token)) score += token.length > 7 ? 3 : 2;
  });
  if (tokens.has("lyrics") && hasTag(block, ["lyric", "lfe", "text"])) score += 2;
  if (tokens.has("visual") && hasTag(block, ["visual", "shader", "color"])) score += 2;
  if (tokens.has("audio") && hasTag(block, ["audio", "mix", "eq", "phase"])) score += 2;
  return score;
}

function inferMergeStrategy(value, tokens) {
  if (Array.isArray(value)) return "concat";
  if (tokens.has("lyrics") || tokens.has("text") || tokens.has("archive")) return "concat";
  if (tokens.has("visual") || tokens.has("metadata")) return "merge_shallow";
  return "merge_deep";
}

function hasTag(block, fragments) {
  const haystack = `${block.name || ""} ${block.category || ""} ${(block.tags || []).join(" ")}`.toLowerCase();
  return fragments.some((token) => haystack.includes(token));
}

function takeByPredicate(blocks, predicate, limit) {
  const picked = blocks.filter(predicate).slice(0, limit).map((block) => block.id);
  if (picked.length) return picked;
  return blocks.slice(0, Math.min(limit, blocks.length)).map((block) => block.id);
}

function safeParseJson(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function registerCustomBlocks() {
  if (customBlocksRegistered) return;
  customBlocksRegistered = true;

  Blockly.Blocks.mmss_prompt_condition = {
    init() {
      this.appendValueInput("COND").setCheck("Boolean").appendField("if");
      this.appendStatementInput("DO").appendField("then");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(210);
      this.setTooltip("Conditional MMSS prompt logic.");
    },
  };

  Blockly.Blocks.mmss_add_block = {
    init() {
      this.appendDummyInput()
        .appendField("add block")
        .appendField(new Blockly.FieldDropdown(() => blockOptionsProvider()), "BLOCK_ID");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(180);
      this.setTooltip("Add selected JSON block by id.");
    },
  };

  Blockly.Blocks.mmss_use_sequence = {
    init() {
      this.appendDummyInput()
        .appendField("use sequence")
        .appendField(new Blockly.FieldDropdown(() => sequenceOptionsProvider()), "SEQUENCE_ID");
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(160);
      this.setTooltip("Expand and add sequence blocks.");
    },
  };

  Blockly.Blocks.mmss_set_merge_strategy = {
    init() {
      this.appendDummyInput()
        .appendField("set merge strategy")
        .appendField(
          new Blockly.FieldDropdown([
            ["concat", "concat"],
            ["merge_shallow", "merge_shallow"],
            ["merge_deep", "merge_deep"],
          ]),
          "MERGE_STRATEGY"
        );
      this.setPreviousStatement(true);
      this.setNextStatement(true);
      this.setColour(230);
      this.setTooltip("Set prompt composition merge strategy.");
    },
  };

  javascriptGenerator.forBlock.mmss_prompt_condition = function (block, generator) {
    const conditionCode = generator.valueToCode(block, "COND", javascriptGenerator.ORDER_NONE) || "false";
    const branch = generator.statementToCode(block, "DO");
    return `if (${conditionCode}) {\n${branch}}\n`;
  };

  javascriptGenerator.forBlock.mmss_add_block = function (block) {
    const blockId = block.getFieldValue("BLOCK_ID");
    return `addBlock(${JSON.stringify(blockId)});\n`;
  };

  javascriptGenerator.forBlock.mmss_use_sequence = function (block) {
    const sequenceId = block.getFieldValue("SEQUENCE_ID");
    return `addSequence(${JSON.stringify(sequenceId)});\n`;
  };

  javascriptGenerator.forBlock.mmss_set_merge_strategy = function (block) {
    const strategy = block.getFieldValue("MERGE_STRATEGY");
    return `setMergeStrategy(${JSON.stringify(strategy)});\n`;
  };
}

export default PromptLogicBlocklyPanel;
