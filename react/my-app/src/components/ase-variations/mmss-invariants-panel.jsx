import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookKey,
  Bot,
  Database,
  LoaderCircle,
  Play,
  RefreshCcw,
  Search,
  Save,
  ServerCog,
  Square,
} from "lucide-react";
import {
  MMSS_INVARIANTS_DEFAULT_DATABASE,
  MMSS_INVARIANTS_DEFAULT_MODE,
  MMSS_INVARIANTS_DEFAULT_SOURCE_SCOPES,
  useMMSSInvariantsOrchestrator,
} from "../../services/MMSSInvariantsOrchestrator";
import appPersistenceService from "../../services/AppPersistenceService";
import { getInvariantModePreset, INVARIANT_PRESET_MODES } from "../../config/mmssModePresets";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
  { value: "legacy", label: "legacy (abstract_mind_db)" },
];

const MODE_OPTIONS = [
  "mmss_invariants",
  "mmss_operator_assist",
  "json_prompt_extraction",
  "ase_console_recipe",
  "cross_db_reconciliation",
];

const FILTER_PROFILE_OPTIONS = ["strict", "balanced", "exploratory"];
const MODEL_OPTIONS = ["batiai/gemma4-e2b:q4", "gemma4:e2b", "quant-mmss:latest"];
const SOURCE_TABLE_OPTIONS = ["tracks", "sessions", "music_blocks", "rag_chunks", "mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns"];
const SETTINGS_SCOPE = "mmss_invariants_ui";
const SNAPSHOT_SCOPE = "mmss_invariants_results";

function StatusCard({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function JsonCard({ title, value, emptyText }) {
  return (
    <div className="ase-config-card">
      <strong>{title}</strong>
      <pre className="ase-stream-preview">
        {value ? JSON.stringify(value, null, 2) : emptyText}
      </pre>
    </div>
  );
}

function FieldHint({ children }) {
  return <small className="mmss-field-hint">{children}</small>;
}

function InvariantPresetCard({ mode, activeMode, onApply }) {
  const active = mode === activeMode;
  return (
    <div className={`ase-config-card mmss-preset-card ${active ? "is-active" : ""}`}>
      <strong>{mode}</strong>
      <span>Invariant-oriented preset pair for this mode.</span>
      <div className="ide-workspace-action-row mmss-preset-actions">
        <button type="button" className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => onApply(mode, "quick")}>
          Quick
        </button>
        <button type="button" className="mmss-action-button mmss-action-button--accent is-compact" onClick={() => onApply(mode, "deep")}>
          Deep
        </button>
      </div>
    </div>
  );
}

function handleInvariantModeSelect(applyModePreset, nextMode) {
  applyModePreset(nextMode, "quick");
}

function buildScopeSelectionsFromDefaults() {
  return MMSS_INVARIANTS_DEFAULT_SOURCE_SCOPES.reduce((acc, scope) => {
    acc[scope.database] = scope.sourceTables;
    return acc;
  }, {});
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

function getAvailableTablesByDb(statusMap = {}) {
  return DATABASE_OPTIONS.reduce((acc, option) => {
    const dynamicTables = Array.isArray(statusMap?.[option.value]?.availableTables)
      ? statusMap[option.value].availableTables
      : [];
    acc[option.value] = Array.from(new Set([...SOURCE_TABLE_OPTIONS, ...dynamicTables])).sort((a, b) => a.localeCompare(b));
    return acc;
  }, {});
}

function createSnapshotKey(kind) {
  return `${kind}-${Date.now()}`;
}

function buildSnapshotEntity({ kind, query, database, mode, sourceScopes, payload }) {
  return {
    id: createSnapshotKey(kind),
    kind,
    title: `${kind}: ${String(query || "").slice(0, 96) || "untitled query"}`,
    query,
    database,
    mode,
    sourceScopes,
    payload,
    createdAt: new Date().toISOString(),
  };
}

export default function MMSSInvariantsPanel() {
  const {
    cancelInvariantJob,
    getInvariantJob,
    getInvariantStatus,
    getStatus,
    startInvariantExtraction,
    searchInvariants,
    syncInvariantSeed,
    buildInvariantContext,
    generateInvariantAnswer,
  } = useMMSSInvariantsOrchestrator();

  const [database, setDatabase] = useState(MMSS_INVARIANTS_DEFAULT_DATABASE);
  const [topK, setTopK] = useState(5);
  const [queryBudget, setQueryBudget] = useState(8);
  const [query, setQuery] = useState(
    "MMSS operator mappings, ontology terms, rhythm/space/timbre/logic/math relations and reusable invariant structures",
  );
  const [mode, setMode] = useState(MMSS_INVARIANTS_DEFAULT_MODE);
  const [model, setModel] = useState("batiai/gemma4-e2b:q4");
  const [filterProfile, setFilterProfile] = useState("balanced");
  const [includeRelationLayer, setIncludeRelationLayer] = useState(true);
  const [responseMaxChars, setResponseMaxChars] = useState(40000);
  const [scopeSelections, setScopeSelections] = useState(buildScopeSelectionsFromDefaults);
  const [status, setStatus] = useState(null);
  const [statusByDb, setStatusByDb] = useState({});
  const [invariantStatus, setInvariantStatus] = useState(null);
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [contextResult, setContextResult] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [runningSearch, setRunningSearch] = useState(false);
  const [runningContext, setRunningContext] = useState(false);
  const [runningAnswer, setRunningAnswer] = useState(false);
  const [runningSyncSeed, setRunningSyncSeed] = useState(false);
  const [runningExtraction, setRunningExtraction] = useState(false);
  const [error, setError] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [lastOperation, setLastOperation] = useState(null);

  const activeSourceScopes = useMemo(() => buildSourceScopes(scopeSelections), [scopeSelections]);
  const availableTablesByDb = useMemo(() => getAvailableTablesByDb(statusByDb), [statusByDb]);

  const loadStatus = useCallback(async (targetDatabase = database) => {
    setLoadingStatus(true);
    try {
      const [statusEntries, nextInvariantStatus] = await Promise.all([
        Promise.all(DATABASE_OPTIONS.map(async (option) => [option.value, await getStatus(option.value)])),
        getInvariantStatus(targetDatabase),
      ]);
      const nextStatusMap = Object.fromEntries(statusEntries);
      const nextStatus = nextStatusMap[targetDatabase] || nextStatusMap[database];
      setStatus(nextStatus);
      setStatusByDb(nextStatusMap);
      setInvariantStatus(nextInvariantStatus);
      if (nextInvariantStatus?.activeJob?.jobId) {
        setJob(nextInvariantStatus.activeJob);
      }
      setError("");
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoadingStatus(false);
    }
  }, [database, getInvariantStatus, getStatus]);

  useEffect(() => {
    if (!job?.jobId || job.status !== "running") return undefined;
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await getInvariantJob(job.jobId);
        setJob(nextJob);
        if (nextJob.status !== "running") {
          window.clearInterval(timer);
          setRunningExtraction(false);
          void loadStatus(database);
        }
      } catch (nextError) {
        setError(nextError.message);
        setRunningExtraction(false);
        window.clearInterval(timer);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [database, getInvariantJob, job, loadStatus]);

  useEffect(() => {
    void loadStatus(database);
  }, [database, loadStatus]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await appPersistenceService.getScope(SETTINGS_SCOPE);
        if (!active || !saved || typeof saved !== "object") return;
        if (typeof saved.database === "string") setDatabase(saved.database);
        if (Number.isFinite(Number(saved.topK))) setTopK(Number(saved.topK));
        if (Number.isFinite(Number(saved.queryBudget))) setQueryBudget(Number(saved.queryBudget));
        if (typeof saved.query === "string") setQuery(saved.query);
        if (typeof saved.mode === "string") setMode(saved.mode);
        if (typeof saved.model === "string") setModel(saved.model);
        if (typeof saved.filterProfile === "string") setFilterProfile(saved.filterProfile);
        if (typeof saved.includeRelationLayer === "boolean") setIncludeRelationLayer(saved.includeRelationLayer);
        if (Number.isFinite(Number(saved.responseMaxChars))) setResponseMaxChars(Number(saved.responseMaxChars));
        if (saved.scopeSelections && typeof saved.scopeSelections === "object") {
          setScopeSelections(saved.scopeSelections);
        }
      } catch (_error) {
        // Keep the panel usable even if persistence is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void appPersistenceService.setScope(SETTINGS_SCOPE, {
      database,
      topK,
      queryBudget,
      query,
      mode,
      model,
      filterProfile,
      includeRelationLayer,
      responseMaxChars,
      scopeSelections,
    });
  }, [
    database,
    filterProfile,
    includeRelationLayer,
    mode,
    model,
    query,
    queryBudget,
    responseMaxChars,
    scopeSelections,
    topK,
  ]);

  const statusCards = useMemo(() => ([
    { label: "Embedding model", value: status?.embeddingModel || "n/a" },
    { label: "Dimension", value: String(status?.embeddingDimension || "n/a") },
    { label: "Stored vectors", value: String(status?.totalEmbeddings || 0) },
    { label: "Source tables", value: Array.isArray(status?.sourceTables) ? status.sourceTables.join(", ") || "n/a" : "n/a" },
    { label: "Phase seeds", value: String(invariantStatus?.phasePatternCount || 0) },
    { label: "Domain seeds", value: String(invariantStatus?.domainPatternCount || 0) },
    { label: "MMSS invariants", value: String(invariantStatus?.invariantCount || 0) },
    { label: "Invariant vectors", value: String(invariantStatus?.vectorizedCount || 0) },
  ]), [invariantStatus, status]);

  const parameterGuide = useMemo(() => ({
    topK: `Top K=${topK}. Это итоговое количество самых сильных invariant-кандидатов, которые удерживаются после semantic search.`,
    queryBudget: `Query Budget=${queryBudget}. Это число query-вариантов, которыми система пытается достать контекст из ontology, operators и MMSS blocks.`,
    includeRelationLayer: includeRelationLayer
      ? "Include relation layer=on. В контекст добавляется вторичный слой relation-heavy блоков: связи между сущностями, session traces, meta anchors."
      : "Include relation layer=off. Система опирается только на primary invariant blocks без relation-слоя.",
    responseMaxChars: `Response max chars=${responseMaxChars}. Это максимальная длина итогового ответа, которую сервер просит соблюдать и затем принудительно ограничивает.`,
  }), [includeRelationLayer, queryBudget, responseMaxChars, topK]);

  const applyModePreset = (presetMode, variant = "quick") => {
    const preset = getInvariantModePreset(presetMode, variant);
    setDatabase(preset.database);
    setTopK(preset.topK);
    setQueryBudget(preset.queryBudget);
    setQuery(preset.query);
    setMode(preset.mode);
    setModel(preset.model);
    setFilterProfile(preset.filterProfile);
    setIncludeRelationLayer(preset.includeRelationLayer);
    setResponseMaxChars(preset.responseMaxChars);
    setScopeSelections(preset.scopeSelections);
  };

  const handleSyncSeed = async () => {
    setRunningSyncSeed(true);
    setError("");
    setLastOperation({
      action: "sync_seed",
      status: "running",
      startedAt: new Date().toISOString(),
      request: { database },
    });
    try {
      await syncInvariantSeed({ database });
      await loadStatus(database);
      setLastOperation({
        action: "sync_seed",
        status: "success",
        finishedAt: new Date().toISOString(),
      });
    } catch (nextError) {
      setError(nextError.message);
      setLastOperation({
        action: "sync_seed",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setRunningSyncSeed(false);
    }
  };

  const handleStartExtraction = async () => {
    setRunningExtraction(true);
    setError("");
    setLastOperation({
      action: "extract_invariants",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        sourceScopes: activeSourceScopes,
      },
    });
    try {
      const nextJob = await startInvariantExtraction({
        database,
        sourceTables: activeSourceScopes
          .filter((scope) => scope.database === database)
          .flatMap((scope) => scope.sourceTables)
          .filter((tableName) => tableName !== "mmss_invariants"),
        batchSize: 20,
        syncSeed: true,
      });
      setJob(nextJob);
      setLastOperation({
        action: "extract_invariants",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: nextJob,
      });
    } catch (nextError) {
      setError(nextError.message);
      setRunningExtraction(false);
      setLastOperation({
        action: "extract_invariants",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    }
  };

  const handleCancelExtraction = async () => {
    if (!job?.jobId) return;
    try {
      const nextJob = await cancelInvariantJob(job.jobId);
      setJob(nextJob);
      setRunningExtraction(false);
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  const handleSearch = async () => {
    setRunningSearch(true);
    setError("");
    setLastOperation({
      action: "search_invariants",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        query,
        topK,
        queryBudget,
        mode,
        sourceScopes: activeSourceScopes,
      },
    });
    try {
      const payload = await searchInvariants({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        mode,
      });
      setResult(payload);
      setLastOperation({
        action: "search_invariants",
        status: "success",
        finishedAt: new Date().toISOString(),
        summary: {
          results: Array.isArray(payload?.results) ? payload.results.length : 0,
          queryVariants: Array.isArray(payload?.queryVariants) ? payload.queryVariants.length : 0,
        },
      });
    } catch (nextError) {
      setError(nextError.message);
      setResult(null);
      setLastOperation({
        action: "search_invariants",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setRunningSearch(false);
    }
  };

  const handleBuildContext = async () => {
    setRunningContext(true);
    setError("");
    setLastOperation({
      action: "build_invariant_context",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        query,
        topK,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
        sourceScopes: activeSourceScopes,
      },
    });
    try {
      const payload = await buildInvariantContext({
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
      setLastOperation({
        action: "build_invariant_context",
        status: "success",
        finishedAt: new Date().toISOString(),
        summary: {
          primaryBlocks: Array.isArray(payload?.contextBlocks) ? payload.contextBlocks.length : 0,
          relationBlocks: Array.isArray(payload?.relationBlocks) ? payload.relationBlocks.length : 0,
          promptChars: payload?.promptContextText?.length || 0,
          retrievalDebug: payload?.retrievalDebug || {},
        },
      });
    } catch (nextError) {
      setError(nextError.message);
      setContextResult(null);
      setLastOperation({
        action: "build_invariant_context",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setRunningContext(false);
    }
  };

  const handleGenerateAnswer = async () => {
    setRunningAnswer(true);
    setError("");
    setLastOperation({
      action: "generate_invariant_answer",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        query,
        topK,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
        model,
        responseMaxChars,
        sourceScopes: activeSourceScopes,
      },
    });
    try {
      const payload = await generateInvariantAnswer({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
        model,
        responseMaxChars,
      });
      setAnswerResult(payload);
      setContextResult({
        promptContextText: payload.promptContextText,
        contextBlocks: payload.contextBlocks,
        relationBlocks: payload.relationBlocks,
        retrievalDebug: payload.debug,
        sourceScopes: payload.sourceScopes,
        queryVariants: payload.queryVariants,
        retrievedSources: payload.retrievedSources,
      });
      setLastOperation({
        action: "generate_invariant_answer",
        status: "success",
        finishedAt: new Date().toISOString(),
        summary: {
          answerChars: payload?.answer?.length || 0,
          promptChars: payload?.debug?.promptChars || 0,
          acceptedPrimary: payload?.debug?.acceptedPrimary || 0,
          acceptedRelation: payload?.debug?.acceptedRelation || 0,
          requestedAnswerMaxChars: payload?.debug?.requestedAnswerMaxChars || responseMaxChars,
        },
      });
    } catch (nextError) {
      setError(nextError.message);
      setAnswerResult(null);
      setLastOperation({
        action: "generate_invariant_answer",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setRunningAnswer(false);
    }
  };

  const handleSaveSnapshot = async (kind, payload) => {
    if (!payload) return;
    setSavingSnapshot(true);
    setError("");
    try {
      const entity = buildSnapshotEntity({
        kind,
        query,
        database,
        mode,
        sourceScopes: activeSourceScopes,
        payload,
      });
      await appPersistenceService.putEntity(SNAPSHOT_SCOPE, entity.id, entity);
      setLastSavedSnapshot(entity.id);
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSavingSnapshot(false);
    }
  };

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-invariants-panel-shell">
      <div className="ide-panel-header">
        <div>
          <strong>MMSS Invariants</strong>
          <span>Отдельный invariant-oriented режим поверх существующего RAG-ядра. Local LLM RAG остается неизменным.</span>
        </div>
      </div>

      <div className="ase-feedback-card">
        <BookKey size={14} />
        <p>
          Focus DB: <strong>{database}</strong>. Active invariant scopes: <strong>{summarizeScopes(scopeSelections) || "none"}</strong>.
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

      <div className="ase-config-card mmss-section-card mmss-section-card--preset">
        <strong>Invariant Mode Presets</strong>
        <span>Each mode has two start configurations. Quick is narrow and audit-friendly, Deep widens the retrieval cone.</span>
        <div className="ide-workspace-action-row mmss-preset-actions" style={{ marginTop: 12 }}>
          <button type="button" className="mmss-action-button mmss-action-button--secondary" onClick={() => applyModePreset(mode, "quick")}>
            Apply Current Quick
          </button>
          <button type="button" className="mmss-action-button mmss-action-button--accent" onClick={() => applyModePreset(mode, "deep")}>
            Apply Current Deep
          </button>
        </div>
        <div className="mmss-preset-grid">
          {INVARIANT_PRESET_MODES.map((presetMode) => (
            <InvariantPresetCard key={presetMode} mode={presetMode} activeMode={mode} onApply={applyModePreset} />
          ))}
        </div>
      </div>

      <div className="ide-settings-form mmss-form-grid">
        <label className="mmss-field mmss-field--runtime">
          <span>Primary DB</span>
          <select value={database} onChange={(event) => setDatabase(event.target.value)}>
            {DATABASE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <FieldHint>Primary target for invariant retrieval and extraction writes.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--retrieval">
          <span>Top K</span>
          <input type="number" min="1" max="20" value={topK} onChange={(event) => setTopK(Number(event.target.value) || 5)} />
          <FieldHint>Number of best invariant candidates retained after ranking.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--retrieval">
          <span>Query Budget</span>
          <input type="number" min="1" max="100" value={queryBudget} onChange={(event) => setQueryBudget(Number(event.target.value) || 1)} />
          <FieldHint>How many search rewrites are allowed during invariant lookup.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--retrieval">
          <span>Filter Profile</span>
          <select value={filterProfile} onChange={(event) => setFilterProfile(event.target.value)}>
            {FILTER_PROFILE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
          <FieldHint>Controls how aggressively weak evidence is trimmed.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--warning">
          <span>Answer Max Chars</span>
          <input type="number" min="500" max="200000" value={responseMaxChars} onChange={(event) => setResponseMaxChars(Number(event.target.value) || 40000)} />
          <FieldHint>Upper bound for final invariant answer length.</FieldHint>
        </label>
      </div>

      <div className="ase-config-card">
        <strong>Parameter Guide</strong>
        <p>{parameterGuide.topK}</p>
        <p>{parameterGuide.queryBudget}</p>
        <p>{parameterGuide.includeRelationLayer}</p>
        <p>{parameterGuide.responseMaxChars}</p>
      </div>

      <div className="ase-config-list mmss-scope-list">
        {DATABASE_OPTIONS.map((dbOption) => (
          <div key={dbOption.value} className="ase-config-card">
            <strong>Invariant Scope: {dbOption.label}</strong>
            <div className="ide-workspace-action-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
              {(availableTablesByDb[dbOption.value] || SOURCE_TABLE_OPTIONS).map((tableName) => (
                <label key={`${dbOption.value}-${tableName}`} className="mmss-checkbox-chip">
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
                  <span>{tableName}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="ide-settings-form mmss-form-grid">
        <label className="mmss-field mmss-field--wide mmss-field--query">
          <span>Invariant Query</span>
          <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
          <FieldHint>Main request for invariant search, context build, and answer generation.</FieldHint>
        </label>
      </div>

      <div className="ide-settings-form mmss-form-grid">
        <label className="mmss-field mmss-field--generation">
          <span>Mode</span>
          <select value={mode} onChange={(event) => handleInvariantModeSelect(applyModePreset, event.target.value)}>
            {MODE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
          <FieldHint>Changes the invariant reasoning frame and preset families.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--generation">
          <span>Answer Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {MODEL_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
          <FieldHint>Local model used for invariant answer synthesis.</FieldHint>
        </label>
        <label className="mmss-field mmss-field--operator" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={includeRelationLayer}
            onChange={(event) => setIncludeRelationLayer(event.target.checked)}
          />
          <span>Include relation layer</span>
          <FieldHint>Appends relation-rich evidence to the invariant context.</FieldHint>
        </label>
      </div>

      <div className="ide-workspace-action-row mmss-action-strip">
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => void loadStatus(database)} disabled={loadingStatus}>
          {loadingStatus ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
          Refresh Status
        </button>
        <button className="mmss-action-button mmss-action-button--primary" onClick={handleSyncSeed} disabled={runningSyncSeed}>
          {runningSyncSeed ? <LoaderCircle size={14} className="spin" /> : <Database size={14} />}
          Sync Ontology Seed
        </button>
        <button className="mmss-action-button mmss-action-button--accent" onClick={handleStartExtraction} disabled={runningExtraction}>
          {runningExtraction ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}
          Extract Invariants
        </button>
        <button className="mmss-action-button mmss-action-button--danger" onClick={handleCancelExtraction} disabled={!job?.jobId || job?.status !== "running"}>
          <Square size={14} />
          Stop Extraction
        </button>
        <button className="mmss-action-button mmss-action-button--primary" onClick={handleSearch} disabled={runningSearch || !query.trim() || !activeSourceScopes.length}>
          {runningSearch ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
          Search Invariants
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={handleBuildContext} disabled={runningContext || !query.trim() || !activeSourceScopes.length}>
          {runningContext ? <LoaderCircle size={14} className="spin" /> : <Database size={14} />}
          Build Invariant Context
        </button>
        <button className="mmss-action-button mmss-action-button--accent" onClick={handleGenerateAnswer} disabled={runningAnswer || !query.trim() || !activeSourceScopes.length}>
          {runningAnswer ? <LoaderCircle size={14} className="spin" /> : <Bot size={14} />}
          Generate Invariant Answer
        </button>
      </div>

      {job ? (
        <div className="ase-config-card">
          <strong>Invariant Extraction Job</strong>
          <pre className="ase-stream-preview">{JSON.stringify(job, null, 2)}</pre>
        </div>
      ) : null}

      <div className="ide-workspace-action-row">
        <button onClick={() => void handleSaveSnapshot("search", result)} disabled={savingSnapshot || !result}>
          <Save size={14} />
          Save Search Snapshot
        </button>
        <button onClick={() => void handleSaveSnapshot("context", contextResult)} disabled={savingSnapshot || !contextResult}>
          <Save size={14} />
          Save Context Snapshot
        </button>
        <button onClick={() => void handleSaveSnapshot("answer", answerResult)} disabled={savingSnapshot || !answerResult}>
          <Save size={14} />
          Save Answer Snapshot
        </button>
      </div>

      {lastSavedSnapshot ? (
        <div className="ase-feedback-card">
          <Save size={14} />
          <p>
            Saved to persistence scope <strong>{SNAPSHOT_SCOPE}</strong> as <strong>{lastSavedSnapshot}</strong>.
          </p>
        </div>
      ) : null}

      <div className="ase-config-list">
        <JsonCard title="Diagnostics" value={{ error: error || null, lastOperation, lastSavedSnapshot: lastSavedSnapshot || null }} emptyText="No diagnostics yet." />
        <JsonCard title="Invariant Search Results" value={result} emptyText="No search results yet." />
        <JsonCard title="Invariant Prompt Context" value={contextResult} emptyText="No prompt context yet." />
        <JsonCard title="Invariant Answer" value={answerResult} emptyText="No answer yet." />
      </div>
    </div>
  );
}
