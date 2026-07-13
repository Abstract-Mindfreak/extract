import React, { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, LoaderCircle, Save, Sparkles, TriangleAlert } from "lucide-react";
import { useFlowmusicAgentOrchestrator } from "../../services/FlowmusicAgentOrchestrator";

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function FlowmusicAgentPanel({ onSaveToLibrary }) {
  const orchestrator = useFlowmusicAgentOrchestrator();
  const [intent, setIntent] = useState("cinematic industrial pulse with recursive low-end pressure and evolving stereo dust");
  const [titleHint, setTitleHint] = useState("Recursive Collapse");
  const [genresText, setGenresText] = useState("industrial, cinematic electronica");
  const [moodsText, setMoodsText] = useState("tense, vast, mechanical");
  const [sonicFocusText, setSonicFocusText] = useState("sub pressure, granular texture, stereo diffusion");
  const [constraintsText, setConstraintsText] = useState("clear macro arc, usable for flowmusic prompt import");
  const [negativeText, setNegativeText] = useState("cheesy EDM lead, lo-fi mud, overcrowded top end");
  const [includeLibraryContext, setIncludeLibraryContext] = useState(true);
  const [libraryLimit, setLibraryLimit] = useState(6);
  const [model, setModel] = useState("mistral-large-latest");
  const [status, setStatus] = useState({ loading: true, error: "", mistral: null, agent: null });
  const [result, setResult] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const requestPayload = useMemo(() => ({
    intent,
    title_hint: titleHint,
    genres: splitLines(genresText),
    moods: splitLines(moodsText),
    sonic_focus: splitLines(sonicFocusText),
    constraints: splitLines(constraintsText),
    negative_constraints: splitLines(negativeText),
    include_library_context: includeLibraryContext,
    library_limit: libraryLimit,
    output_language: "en",
    provider: {
      provider: "mistral",
      base_url: "https://api.mistral.ai/v1",
      model,
      temperature: 0.35,
      timeout_seconds: 120,
    },
  }), [
    constraintsText,
    genresText,
    includeLibraryContext,
    intent,
    libraryLimit,
    model,
    moodsText,
    negativeText,
    sonicFocusText,
    titleHint,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const [mistral, agent] = await Promise.all([
          orchestrator.getMistralStatus(),
          orchestrator.getFlowmusicAgentStatus(),
        ]);
        if (!cancelled) {
          setStatus({ loading: false, error: "", mistral, agent });
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({ loading: false, error: error.message, mistral: null, agent: null });
        }
      }
    };

    void loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const payload = await orchestrator.generateFlowmusicPrompt(requestPayload);
      setResult(payload);
    } catch (error) {
      setResult({ error: error.message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    if (!result?.library_block) return;
    onSaveToLibrary?.(result.library_block, {
      preserveExistingId: false,
      activateLibraryPanel: true,
    });
  };

  const availableModels = ["mistral-large-latest", "mistral-medium", "mistral-small", "open-mistral-7b"];

  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Flowmusic Agents</strong>
          <span>Planner, composer, critic, and normalizer coordinated through Pydantic + Mistral AI.</span>
        </div>
      </div>

      <div className="ase-feedback-card">
        <Bot size={14} />
        <p>
          Local provider: <strong>{model}</strong>. Using Mistral AI API for structured generation.
        </p>
      </div>

      <div className="ide-workspace-summary-grid">
        <StatusMetric label="Mistral" value={status.loading ? "Checking" : status.mistral?.api_key_configured ? "Configured" : "Not Configured"} />
        <StatusMetric label="Agent API" value={status.loading ? "Checking" : status.agent?.status === "ok" ? "Online" : "Offline"} />
        <StatusMetric label="Models" value={String(availableModels.length || 0)} />
        <StatusMetric label="Context" value={includeLibraryContext ? `${libraryLimit} blocks` : "Disabled"} />
      </div>

      {status.error ? (
        <div className="ase-feedback-card" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
          <TriangleAlert size={14} />
          <p>{status.error}</p>
        </div>
      ) : null}

      <div className="ide-settings-form">
        <label>
          <span>Title Hint</span>
          <input value={titleHint} onChange={(event) => setTitleHint(event.target.value)} />
        </label>
        <label>
          <span>Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {(availableModels.length ? availableModels : ["mmss-gemma4-q4"]).map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="ide-settings-form">
        <label>
          <span>Intent</span>
          <textarea value={intent} onChange={(event) => setIntent(event.target.value)} rows={4} />
        </label>
      </div>

      <div className="ide-settings-form">
        <label>
          <span>Genres</span>
          <textarea value={genresText} onChange={(event) => setGenresText(event.target.value)} rows={2} />
        </label>
        <label>
          <span>Moods</span>
          <textarea value={moodsText} onChange={(event) => setMoodsText(event.target.value)} rows={2} />
        </label>
      </div>

      <div className="ide-settings-form">
        <label>
          <span>Sonic Focus</span>
          <textarea value={sonicFocusText} onChange={(event) => setSonicFocusText(event.target.value)} rows={3} />
        </label>
        <label>
          <span>Constraints</span>
          <textarea value={constraintsText} onChange={(event) => setConstraintsText(event.target.value)} rows={3} />
        </label>
        <label>
          <span>Negative Prompt</span>
          <textarea value={negativeText} onChange={(event) => setNegativeText(event.target.value)} rows={3} />
        </label>
      </div>

      <div className="ide-workspace-action-row">
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={includeLibraryContext}
            onChange={(event) => setIncludeLibraryContext(event.target.checked)}
          />
          Prompt Library context
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span>Limit</span>
          <input
            type="number"
            min="0"
            max="12"
            value={libraryLimit}
            onChange={(event) => setLibraryLimit(Number(event.target.value) || 0)}
            style={{ width: 80 }}
          />
        </label>
        <button onClick={handleGenerate} disabled={isGenerating || status.loading}>
          {isGenerating ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
          {isGenerating ? "Generating" : "Generate Flowmusic JSON"}
        </button>
        <button onClick={handleSave} disabled={!result?.library_block}>
          <Save size={14} />
          Save To Library
        </button>
      </div>

      <div className="ide-workspace-focus-grid">
        <ResultCard
          title="Context Blocks"
          body={result?.context_blocks?.length ? result.context_blocks.map((entry) => entry.name).join(", ") : "No context selected yet."}
        />
        <ResultCard
          title="Archive Tracks"
          body={result?.archive_tracks?.length ? result.archive_tracks.map((entry) => entry.title).join(", ") : "No archive context yet."}
        />
        <ResultCard
          title="Planner/Composer"
          body={result?.traces?.length ? result.traces.map((trace) => `${trace.agent}: ${trace.status}${trace.tools_used?.length ? ` [${trace.tools_used.join(", ")}]` : ""}`).join(" | ") : "No agent trace yet."}
        />
        <ResultCard
          title="Final Title"
          body={result?.final_payload?.title || result?.error || "No generated prompt yet."}
        />
      </div>

      <div className="ase-config-list">
        <div className="ase-config-card">
          <strong>Final Flowmusic Payload</strong>
          <pre className="ase-stream-preview">{JSON.stringify(result?.final_payload || result || {}, null, 2)}</pre>
        </div>
        {Array.isArray(result?.traces)
          ? result.traces.map((trace) => (
              <div key={trace.agent} className="ase-config-card">
                <strong style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {trace.status === "ok" ? <CheckCircle2 size={14} /> : <TriangleAlert size={14} />}
                  {trace.agent}
                </strong>
                <span>{trace.summary}</span>
                <pre className="ase-stream-preview">{JSON.stringify(trace.payload, null, 2)}</pre>
              </div>
            ))
          : null}
      </div>
    </div>
  );
}

function StatusMetric({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResultCard({ title, body }) {
  return (
    <div className="ide-workspace-focus-card">
      <span>{title}</span>
      <small>{body}</small>
    </div>
  );
}
