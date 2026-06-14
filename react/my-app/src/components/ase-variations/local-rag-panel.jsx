import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Database, LoaderCircle, Search, ServerCog, Sparkles } from "lucide-react";
import { useLocalRagOrchestrator } from "../../services/LocalRagOrchestrator";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
  { value: "abstract_mind_db", label: "abstract_mind_db" },
];

const SOURCE_TABLE_OPTIONS = ["tracks", "sessions", "music_blocks", "chat_sessions", "songs"];
const FILTER_PROFILE_OPTIONS = ["strict", "balanced", "exploratory"];
const MODE_OPTIONS = [
  "qa",
  "prompt_mutation",
  "session_analysis",
  "mmss_operator_assist",
  "cross_db_reconciliation",
  "json_prompt_extraction",
  "source_audit",
  "ase_console_recipe",
];
const MODEL_OPTIONS = ["batiai/gemma4-e2b:q4", "gemma4:e2b", "quant-mmss:latest"];

function StatusCard({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function splitSelected(selected, value) {
  if (selected.includes(value)) {
    return selected.filter((entry) => entry !== value);
  }
  return [...selected, value];
}

function buildSourceScopes(scopeSelections) {
  return Object.entries(scopeSelections || {})
    .map(([database, tables]) => ({
      database,
      sourceTables: Array.isArray(tables) ? tables.filter(Boolean) : [],
    }))
    .filter((scope) => scope.sourceTables.length > 0);
}

function summarizeScopes(scopeSelections) {
  return buildSourceScopes(scopeSelections)
    .map((scope) => `${scope.database}: ${scope.sourceTables.join(", ")}`)
    .join(" | ");
}

function JsonCard({ title, value }) {
  return (
    <div className="ase-config-card">
      <strong>{title}</strong>
      <pre className="ase-stream-preview">
        {JSON.stringify(value || {}, null, 2)}
      </pre>
    </div>
  );
}

export default function LocalRagPanel() {
  const {
    answerWithLocalRag,
    buildRagContext,
    cancelRagJob,
    getRagJob,
    getRagStatus,
    searchLocalRag,
    startRagVectorization,
  } = useLocalRagOrchestrator();

  const [database, setDatabase] = useState("abstract-mind-lab");
  const [batchSize, setBatchSize] = useState(10);
  const [topK, setTopK] = useState(5);
  const [queryBudget, setQueryBudget] = useState(8);
  const [query, setQuery] = useState("industrial prompt with strong spatial diffusion and recursive low-end movement");
  const [selectedTables, setSelectedTables] = useState(["tracks", "sessions"]);
  const [scopeSelections, setScopeSelections] = useState({
    "abstract-mind-lab": ["tracks", "sessions"],
    abstract_mind_db: ["music_blocks"],
  });
  const [filterProfile, setFilterProfile] = useState("balanced");
  const [mode, setMode] = useState("qa");
  const [model, setModel] = useState("batiai/gemma4-e2b:q4");
  const [includeRelationLayer, setIncludeRelationLayer] = useState(true);
  const [status, setStatus] = useState(null);
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [contextResult, setContextResult] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [runningVectorization, setRunningVectorization] = useState(false);
  const [runningSearch, setRunningSearch] = useState(false);
  const [runningContext, setRunningContext] = useState(false);
  const [runningAnswer, setRunningAnswer] = useState(false);
  const [error, setError] = useState("");

  const activeSourceScopes = useMemo(() => buildSourceScopes(scopeSelections), [scopeSelections]);

  const loadStatus = useCallback(async (targetDatabase = database) => {
    setLoadingStatus(true);
    try {
      const nextStatus = await getRagStatus(targetDatabase);
      setStatus(nextStatus);
      setError("");
      if (nextStatus.activeJob?.jobId) {
        setJob(nextStatus.activeJob);
      }
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoadingStatus(false);
    }
  }, [database, getRagStatus]);

  useEffect(() => {
    void loadStatus(database);
  }, [database, loadStatus]);

  useEffect(() => {
    if (!job?.jobId || job.status !== "running") return undefined;
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await getRagJob(job.jobId);
        setJob(nextJob);
        if (nextJob.status !== "running") {
          window.clearInterval(timer);
          void loadStatus(database);
          setRunningVectorization(false);
        }
      } catch (nextError) {
        setError(nextError.message);
        window.clearInterval(timer);
        setRunningVectorization(false);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [database, getRagJob, job, loadStatus]);

  const statusCards = useMemo(() => ([
    { label: "Embedding model", value: status?.embeddingModel || "n/a" },
    { label: "Dimension", value: String(status?.embeddingDimension || "n/a") },
    { label: "Stored vectors", value: String(status?.totalEmbeddings || 0) },
    { label: "Source tables", value: Array.isArray(status?.sourceTables) ? status.sourceTables.join(", ") || "n/a" : "n/a" },
  ]), [status]);

  const handleVectorize = async () => {
    setRunningVectorization(true);
    setError("");
    try {
      const nextJob = await startRagVectorization({
        database,
        batchSize,
        sourceTables: selectedTables,
      });
      setJob(nextJob);
    } catch (nextError) {
      setError(nextError.message);
      setRunningVectorization(false);
    }
  };

  const handleSearch = async () => {
    setRunningSearch(true);
    setError("");
    try {
      const payload = await searchLocalRag({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        mode,
      });
      setResult(payload);
    } catch (nextError) {
      setError(nextError.message);
      setResult(null);
    } finally {
      setRunningSearch(false);
    }
  };

  const handleBuildContext = async () => {
    setRunningContext(true);
    setError("");
    try {
      const payload = await buildRagContext({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
      });
      setContextResult(payload);
    } catch (nextError) {
      setError(nextError.message);
      setContextResult(null);
    } finally {
      setRunningContext(false);
    }
  };

  const handleGenerateAnswer = async () => {
    setRunningAnswer(true);
    setError("");
    try {
      const payload = await answerWithLocalRag({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
        model,
      });
      setAnswerResult(payload);
      setContextResult({
        promptContextText: payload.promptContextText,
        contextBlocks: payload.contextBlocks,
        relationBlocks: payload.relationBlocks,
        retrievalDebug: payload.debug,
        sourceScopes: payload.sourceScopes,
        queryVariants: payload.queryVariants,
      });
    } catch (nextError) {
      setError(nextError.message);
      setAnswerResult(null);
    } finally {
      setRunningAnswer(false);
    }
  };

  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Local LLM RAG</strong>
          <span>Локальный retrieval и контекст для ASE Console через Ollama, PostgreSQL и multi-DB semantic search.</span>
        </div>
      </div>

      <div className="ase-feedback-card">
        <Database size={14} />
        <p>
          Runtime DB: <strong>{database}</strong>. Active RAG scopes: <strong>{summarizeScopes(scopeSelections) || "none"}</strong>.
        </p>
      </div>

      <div className="ide-workspace-summary-grid">
        {statusCards.map((card) => (
          <StatusCard key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      {error ? (
        <div className="ase-feedback-card" style={{ borderColor: "rgba(248,113,113,0.35)" }}>
          <ServerCog size={14} />
          <p>{error}</p>
        </div>
      ) : null}

      <div className="ide-settings-form">
        <label>
          <span>Vectorization DB</span>
          <select value={database} onChange={(event) => setDatabase(event.target.value)}>
            {DATABASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Batch Size</span>
          <input type="number" min="1" max="20" value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value) || 10)} />
        </label>
        <label>
          <span>Top K</span>
          <input type="number" min="1" max="20" value={topK} onChange={(event) => setTopK(Number(event.target.value) || 5)} />
        </label>
        <label>
          <span>Query Budget</span>
          <input type="number" min="1" max="100" value={queryBudget} onChange={(event) => setQueryBudget(Number(event.target.value) || 1)} />
        </label>
        <label>
          <span>Filter Profile</span>
          <select value={filterProfile} onChange={(event) => setFilterProfile(event.target.value)}>
            {FILTER_PROFILE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="ide-workspace-action-row" style={{ flexWrap: "wrap" }}>
        {SOURCE_TABLE_OPTIONS.map((tableName) => (
          <label key={tableName} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="checkbox"
              checked={selectedTables.includes(tableName)}
              onChange={() => setSelectedTables((current) => splitSelected(current, tableName))}
            />
            {tableName}
          </label>
        ))}
      </div>

      <div className="ase-config-list">
        {DATABASE_OPTIONS.map((dbOption) => (
          <div key={dbOption.value} className="ase-config-card">
            <strong>Search Scope: {dbOption.label}</strong>
            <div className="ide-workspace-action-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
              {SOURCE_TABLE_OPTIONS.map((tableName) => (
                <label key={`${dbOption.value}-${tableName}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={(scopeSelections[dbOption.value] || []).includes(tableName)}
                    onChange={() => {
                      setScopeSelections((current) => ({
                        ...current,
                        [dbOption.value]: splitSelected(current[dbOption.value] || [], tableName),
                      }));
                    }}
                  />
                  {tableName}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ide-workspace-action-row">
        <button onClick={() => void loadStatus(database)} disabled={loadingStatus}>
          {loadingStatus ? <LoaderCircle size={14} className="spin" /> : <ServerCog size={14} />}
          Refresh Status
        </button>
        <button onClick={handleVectorize} disabled={runningVectorization || !selectedTables.length}>
          {runningVectorization ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
          Векторизовать базу данных
        </button>
      </div>

      {job ? (
        <div className="ase-config-card">
          <strong>Vectorization Job</strong>
          <div className="ide-workspace-summary-grid">
            <StatusCard label="Job ID" value={job.jobId} />
            <StatusCard label="Status" value={job.status} />
            <StatusCard label="Stage" value={job.lastStage || "n/a"} />
            <StatusCard label="Progress" value={`${job.progress || 0}%`} />
            <StatusCard label="Processed" value={`${job.processed || 0}/${job.totalDocuments || 0}`} />
            <StatusCard label="Vectorized" value={String(job.vectorized || 0)} />
            <StatusCard label="Skipped" value={String(job.skipped || 0)} />
          </div>
          <div className="ide-workspace-action-row">
            <button
              onClick={async () => {
                try {
                  const nextJob = await cancelRagJob(job.jobId);
                  setJob(nextJob);
                  setRunningVectorization(false);
                } catch (nextError) {
                  setError(nextError.message);
                }
              }}
              disabled={job.status !== "running"}
            >
              Остановить процесс
            </button>
          </div>
          {job.error ? <pre className="ase-stream-preview">{job.error}</pre> : null}
        </div>
      ) : null}

      <div className="ide-settings-form">
        <label>
          <span>Smart Search Query</span>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
        </label>
      </div>

      <div className="ide-settings-form">
        <label>
          <span>Answer Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {MODEL_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {MODE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={includeRelationLayer}
            onChange={(event) => setIncludeRelationLayer(event.target.checked)}
          />
          <span>Include relation layer</span>
        </label>
      </div>

      <div className="ide-workspace-action-row">
        <button onClick={handleSearch} disabled={runningSearch || !query.trim() || !activeSourceScopes.length}>
          {runningSearch ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
          Smart Search
        </button>
        <button onClick={handleBuildContext} disabled={runningContext || !query.trim() || !activeSourceScopes.length}>
          {runningContext ? <LoaderCircle size={14} className="spin" /> : <Database size={14} />}
          Build Context
        </button>
        <button onClick={handleGenerateAnswer} disabled={runningAnswer || !query.trim() || !activeSourceScopes.length}>
          {runningAnswer ? <LoaderCircle size={14} className="spin" /> : <Bot size={14} />}
          Generate Answer
        </button>
      </div>

      <div className="ase-config-list">
        <JsonCard title="Search Results" value={result} />
        <JsonCard title="Prompt Context" value={contextResult} />
        <JsonCard title="Local LLM Answer" value={answerResult} />
      </div>
    </div>
  );
}
