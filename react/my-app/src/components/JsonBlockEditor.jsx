import { useEffect, useState } from "react";
import { createEntityId } from "../mmss/promptLibrary";

const EMPTY_DATA = {
  prompt: "",
};

function JsonBlockEditor({ block, onSave, onExport }) {
  const [form, setForm] = useState(createDraft(block));
  const [jsonHistory, setJsonHistory] = useState([]);
  const [jsonFuture, setJsonFuture] = useState([]);
  const [jsonError, setJsonError] = useState("");

  useEffect(() => {
    setForm(createDraft(block));
    setJsonHistory([]);
    setJsonFuture([]);
    setJsonError("");
  }, [block]);

  useEffect(() => {
    setJsonError(tryParseJson(form.payloadText).nextError);
  }, [form.payloadText]);

  const canUndo = jsonHistory.length > 0;
  const canRedo = jsonFuture.length > 0;
  const { parsedPayload } = tryParseJson(form.payloadText);

  function updateField(key, value) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updatePayloadText(value) {
    setJsonHistory((current) => [...current, form.payloadText].slice(-40));
    setJsonFuture([]);
    updateField("payloadText", value);
  }

  function handleUndo() {
    if (!canUndo) return;
    const previous = jsonHistory[jsonHistory.length - 1];
    setJsonHistory((current) => current.slice(0, -1));
    setJsonFuture((current) => [form.payloadText, ...current].slice(0, 40));
    updateField("payloadText", previous);
  }

  function handleRedo() {
    if (!canRedo) return;
    const [next, ...rest] = jsonFuture;
    setJsonHistory((current) => [...current, form.payloadText].slice(-40));
    setJsonFuture(rest);
    updateField("payloadText", next);
  }

  function handleFormat() {
    if (!parsedPayload) return;
    updateField("payloadText", JSON.stringify(parsedPayload, null, 2));
  }

  function handleSave() {
    if (!parsedPayload) return;
    onSave({
      id: form.id || createEntityId("block"),
      name: form.name.trim() || "Untitled Block",
      description: form.description.trim(),
      category: form.category.trim() || "general",
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      payload: {
        type: "flowmusic.app_prompt",
        version: "1.0",
        data: parsedPayload,
      },
      ui: {
        color: form.color,
        icon: form.icon,
        boundButtonId: block?.ui?.boundButtonId ?? null,
      },
    });
  }

  return (
    <div className="json-block-editor">
      <div className="editor-grid">
        <label>
          Name
          <input value={form.name} onChange={(event) => updateField("name", event.target.value)} />
        </label>
        <label>
          Category
          <input value={form.category} onChange={(event) => updateField("category", event.target.value)} />
        </label>
        <label>
          Color
          <input value={form.color} onChange={(event) => updateField("color", event.target.value)} />
        </label>
        <label>
          Icon
          <input value={form.icon} onChange={(event) => updateField("icon", event.target.value)} />
        </label>
      </div>

      <label>
        Description
        <textarea
          className="library-textarea short"
          value={form.description}
          onChange={(event) => updateField("description", event.target.value)}
        />
      </label>

      <label>
        Tags
        <input
          value={form.tags}
          onChange={(event) => updateField("tags", event.target.value)}
          placeholder="glass, motion, fx"
        />
      </label>

      <div className="editor-toolbar">
        <button onClick={handleUndo} disabled={!canUndo}>
          Undo
        </button>
        <button onClick={handleRedo} disabled={!canRedo}>
          Redo
        </button>
        <button onClick={handleFormat}>Format JSON</button>
        <button onClick={handleSave} className="accent-action">
          Save
        </button>
        <button onClick={() => onExport(parsedPayload ? JSON.parse(form.payloadText) : EMPTY_DATA, form.name)}>
          Export Block
        </button>
      </div>

      <label>
        Payload JSON
        <textarea
          className="library-textarea"
          value={form.payloadText}
          onChange={(event) => updatePayloadText(event.target.value)}
        />
      </label>
      {jsonError ? <div className="json-error">JSON error: {jsonError}</div> : null}
    </div>
  );
}

function createDraft(block) {
  if (!block) {
    return {
      id: "",
      name: "",
      description: "",
      category: "general",
      tags: "",
      color: "#9be0ff",
      icon: "block",
      payloadText: JSON.stringify(EMPTY_DATA, null, 2),
    };
  }

  return {
    id: block.id,
    name: block.name,
    description: block.description,
    category: block.category,
    tags: (block.tags || []).join(", "),
    color: block.ui?.color || "#9be0ff",
    icon: block.ui?.icon || "block",
    payloadText: JSON.stringify(block.payload?.data ?? EMPTY_DATA, null, 2),
  };
}

function tryParseJson(value) {
  try {
    return {
      parsedPayload: JSON.parse(value || "{}"),
      nextError: "",
    };
  } catch (error) {
    return {
      parsedPayload: null,
      nextError: error.message,
    };
  }
}

export default JsonBlockEditor;
