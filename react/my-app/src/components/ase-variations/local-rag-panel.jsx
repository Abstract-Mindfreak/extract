import { Layout, Model } from "flexlayout-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, Database, LoaderCircle, Play, RefreshCcw, Save, Search, ServerCog, Sparkles, Square } from "lucide-react";
import { useLocalRagOrchestrator } from "../../services/LocalRagOrchestrator";
import appPersistenceService from "../../services/AppPersistenceService";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
  { value: "abstract_mind_db", label: "abstract_mind_db" },
];

const SOURCE_TABLE_OPTIONS = ["tracks", "sessions", "music_blocks", "chat_sessions", "songs", "mmss_invariants"];
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
const SETTINGS_SCOPE = "local_rag_ui";
const SNAPSHOT_SCOPE = "local_rag_results";
const RESULT_LAYOUT_SETTING_KEY = "resultLayoutSnapshot";

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

export default function LocalRagPanel() {
  const {
    answerWithLocalRag,
    buildRagContext,
    cancelMmssSkillTreeDesignJob,
    cancelRagJob,
    getMmssRuntimeHealth,
    getMmssSkillTreeDesignJob,
    getRagJob,
    getRagStatus,
    searchLocalRag,
    startMmssSkillTreeDesignJob,
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
  const [responseMaxChars, setResponseMaxChars] = useState(40000);
  const [status, setStatus] = useState(null);
  const [statusByDb, setStatusByDb] = useState({});
  const [runtimeHealth, setRuntimeHealth] = useState(null);
  const [job, setJob] = useState(null);
  const [designJob, setDesignJob] = useState(null);
  const [result, setResult] = useState(null);
  const [contextResult, setContextResult] = useState(null);
  const [answerResult, setAnswerResult] = useState(null);
  const [designResult, setDesignResult] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [runningVectorization, setRunningVectorization] = useState(false);
  const [runningSearch, setRunningSearch] = useState(false);
  const [runningContext, setRunningContext] = useState(false);
  const [runningAnswer, setRunningAnswer] = useState(false);
  const [runningDesignJob, setRunningDesignJob] = useState(false);
  const [error, setError] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [lastOperation, setLastOperation] = useState(null);
  const [skillTreeGoal, setSkillTreeGoal] = useState("Build an MMSS skill tree for operator-aware retrieval, context assembly, and reusable runtime execution.");
  const [skillTreeOwnerScope, setSkillTreeOwnerScope] = useState("local_rag_runtime");
  const [skillTreeContextHint, setSkillTreeContextHint] = useState("");
  const [resultLayoutModel, setResultLayoutModel] = useState(() => Model.fromJson(buildResultLayout()));

  const activeSourceScopes = useMemo(() => buildSourceScopes(scopeSelections), [scopeSelections]);
  const availableTablesByDb = useMemo(() => getAvailableTablesByDb(statusByDb), [statusByDb]);
  const diagnosticsPayload = useMemo(() => ({
    error: error || null,
    lastOperation,
    lastSavedSnapshot: lastSavedSnapshot || null,
    runtimeHealth,
    database,
    activeSourceScopes,
  }), [activeSourceScopes, database, error, lastOperation, lastSavedSnapshot, runtimeHealth]);
  const runtimeJobsPayload = useMemo(() => ({
    vectorizationJob: job || null,
    skillTreeDesignJob: designJob || null,
  }), [designJob, job]);

  const loadStatus = useCallback(async (targetDatabase = database) => {
    setLoadingStatus(true);
    try {
      const entries = await Promise.all(
        DATABASE_OPTIONS.map(async (option) => [option.value, await getRagStatus(option.value)]),
      );
      const nextRuntimeHealth = await getMmssRuntimeHealth(targetDatabase);
      const nextStatusMap = Object.fromEntries(entries);
      const nextStatus = nextStatusMap[targetDatabase] || nextStatusMap[database];
      setStatus(nextStatus);
      setStatusByDb(nextStatusMap);
      setRuntimeHealth(nextRuntimeHealth);
      setError("");
      if (nextStatus.activeJob?.jobId) {
        setJob(nextStatus.activeJob);
      }
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setLoadingStatus(false);
    }
  }, [database, getMmssRuntimeHealth, getRagStatus]);

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
        if (Number.isFinite(Number(saved.batchSize))) setBatchSize(Number(saved.batchSize));
        if (Number.isFinite(Number(saved.topK))) setTopK(Number(saved.topK));
        if (Number.isFinite(Number(saved.queryBudget))) setQueryBudget(Number(saved.queryBudget));
        if (typeof saved.query === "string") setQuery(saved.query);
        if (saved.selectedTables && Array.isArray(saved.selectedTables)) setSelectedTables(saved.selectedTables);
        if (saved.scopeSelections && typeof saved.scopeSelections === "object") setScopeSelections(saved.scopeSelections);
        if (typeof saved.filterProfile === "string") setFilterProfile(saved.filterProfile);
        if (typeof saved.mode === "string") setMode(saved.mode);
        if (typeof saved.model === "string") setModel(saved.model);
        if (typeof saved.includeRelationLayer === "boolean") setIncludeRelationLayer(saved.includeRelationLayer);
        if (Number.isFinite(Number(saved.responseMaxChars))) setResponseMaxChars(Number(saved.responseMaxChars));
        if (typeof saved.skillTreeGoal === "string") setSkillTreeGoal(saved.skillTreeGoal);
        if (typeof saved.skillTreeOwnerScope === "string") setSkillTreeOwnerScope(saved.skillTreeOwnerScope);
        if (typeof saved.skillTreeContextHint === "string") setSkillTreeContextHint(saved.skillTreeContextHint);
      } catch (_error) {
        // Keep the panel usable even if persistence is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const savedLayout = await appPersistenceService.getSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, null);
        if (!active || !savedLayout || typeof savedLayout !== "object") return;
        setResultLayoutModel(Model.fromJson(savedLayout));
      } catch (_error) {
        // Keep default layout if the saved snapshot is unavailable or invalid.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    void appPersistenceService.setScope(SETTINGS_SCOPE, {
      database,
      batchSize,
      topK,
      queryBudget,
      query,
      selectedTables,
      scopeSelections,
      filterProfile,
      mode,
      model,
      includeRelationLayer,
      responseMaxChars,
      skillTreeGoal,
      skillTreeOwnerScope,
      skillTreeContextHint,
    });
  }, [
    batchSize,
    database,
    filterProfile,
    includeRelationLayer,
    mode,
    model,
    query,
    queryBudget,
    responseMaxChars,
    scopeSelections,
    selectedTables,
    skillTreeContextHint,
    skillTreeGoal,
    skillTreeOwnerScope,
    topK,
  ]);

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

  useEffect(() => {
    if (!designJob?.jobId || designJob.status !== "running") return undefined;
    const timer = window.setInterval(async () => {
      try {
        const nextJob = await getMmssSkillTreeDesignJob(designJob.jobId);
        setDesignJob(nextJob);
        if (nextJob.status !== "running") {
          window.clearInterval(timer);
          setRunningDesignJob(false);
          setDesignResult(nextJob.result || null);
          void loadStatus(database);
        }
      } catch (nextError) {
        setError(nextError.message);
        window.clearInterval(timer);
        setRunningDesignJob(false);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [database, designJob, getMmssSkillTreeDesignJob, loadStatus]);

  const statusCards = useMemo(() => ([
    { label: "Embedding model", value: status?.embeddingModel || "n/a" },
    { label: "Dimension", value: String(status?.embeddingDimension || "n/a") },
    { label: "Stored vectors", value: String(status?.totalEmbeddings || 0) },
    { label: "Source tables", value: Array.isArray(status?.sourceTables) ? status.sourceTables.join(", ") || "n/a" : "n/a" },
  ]), [status]);

  const runtimeCards = useMemo(() => ([
    { label: "Generation results", value: String(runtimeHealth?.generationResults || 0) },
    { label: "Skills", value: String(runtimeHealth?.skills || 0) },
    { label: "Skill sets", value: String(runtimeHealth?.skillSets || 0) },
    { label: "Skill trees", value: String(runtimeHealth?.skillTrees || 0) },
    { label: "Skill runs", value: String(runtimeHealth?.skillRuns || 0) },
  ]), [runtimeHealth]);

  const parameterGuide = useMemo(() => ({
    topK: `Top K=${topK}. Это итоговое количество самых сильных найденных блоков, которые проходят в финальный retrieval pool и затем в отбор контекста.`,
    queryBudget: `Query Budget=${queryBudget}. Это число вариантов поискового запроса, которые система генерирует из одного исходного запроса для расширения semantic search.`,
    includeRelationLayer: includeRelationLayer
      ? "Include relation layer=on. В контекст добавляется вторичный слой relation-heavy блоков: связи, session traces, tool/meta anchors."
      : "Include relation layer=off. Берутся только основные смысловые блоки без вторичного relation-слоя.",
    filterProfile: `Filter Profile=${filterProfile}. Strict сильнее режет шум, Balanced оставляет компромисс, Exploratory расширяет поиск и чаще тянет слабые совпадения.`,
    responseMaxChars: `Response max chars=${responseMaxChars}. Это верхняя граница длины итогового ответа, которую сервер просит соблюдать и дополнительно обрезает при возврате в UI.`,
  }), [filterProfile, includeRelationLayer, queryBudget, responseMaxChars, topK]);

  const handleVectorize = async () => {
    setRunningVectorization(true);
    setError("");
    setLastOperation({
      action: "vectorize",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        batchSize,
        sourceTables: selectedTables,
      },
    });
    try {
      const nextJob = await startRagVectorization({
        database,
        batchSize,
        sourceTables: selectedTables,
      });
      setJob(nextJob);
      setLastOperation({
        action: "vectorize",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: nextJob,
      });
    } catch (nextError) {
      setError(nextError.message);
      setRunningVectorization(false);
      setLastOperation({
        action: "vectorize",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    }
  };

  const handleSearch = async () => {
    setRunningSearch(true);
    setError("");
    setLastOperation({
      action: "search",
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
      const payload = await searchLocalRag({
        database,
        query,
        topK,
        sourceScopes: activeSourceScopes,
        queryBudget,
        mode,
      });
      setResult(payload);
      setLastOperation({
        action: "search",
        status: "success",
        finishedAt: new Date().toISOString(),
        summary: {
          results: Array.isArray(payload?.results) ? payload.results.length : 0,
          queryVariants: Array.isArray(payload?.queryVariants) ? payload.queryVariants.length : 0,
          sourceScopes: payload?.sourceScopes || [],
        },
      });
    } catch (nextError) {
      setError(nextError.message);
      setResult(null);
      setLastOperation({
        action: "search",
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
      action: "build_context",
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
      setLastOperation({
        action: "build_context",
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
        action: "build_context",
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
      action: "answer",
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
      });
      setLastOperation({
        action: "answer",
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
        action: "answer",
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

  const handleStartDesignJob = async () => {
    setRunningDesignJob(true);
    setError("");
    setLastOperation({
      action: "design_skill_tree_async",
      status: "running",
      startedAt: new Date().toISOString(),
      request: {
        database,
        goal: skillTreeGoal,
        ownerScope: skillTreeOwnerScope,
        contextHint: skillTreeContextHint || null,
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
      const nextJob = await startMmssSkillTreeDesignJob({
        database,
        goal: skillTreeGoal,
        ownerScope: skillTreeOwnerScope,
        contextHint: skillTreeContextHint,
        topK,
        queryBudget,
        filterProfile,
        includeRelationLayer,
        mode,
        model,
        responseMaxChars,
        sourceScopes: activeSourceScopes,
      });
      setDesignJob(nextJob);
      setDesignResult(null);
      setLastOperation({
        action: "design_skill_tree_async",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: {
          jobId: nextJob.jobId,
          status: nextJob.status,
          database: nextJob.database,
          goal: nextJob.goal,
        },
      });
    } catch (nextError) {
      setError(nextError.message);
      setRunningDesignJob(false);
      setLastOperation({
        action: "design_skill_tree_async",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    }
  };

  const handleRefreshDesignJob = async () => {
    if (!designJob?.jobId) return;
    try {
      const nextJob = await getMmssSkillTreeDesignJob(designJob.jobId);
      setDesignJob(nextJob);
      if (nextJob.status !== "running") {
        setRunningDesignJob(false);
        setDesignResult(nextJob.result || null);
        await loadStatus(database);
      }
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  const handleCancelDesignJob = async () => {
    if (!designJob?.jobId) return;
    try {
      const nextJob = await cancelMmssSkillTreeDesignJob(designJob.jobId);
      setDesignJob(nextJob);
      setRunningDesignJob(false);
    } catch (nextError) {
      setError(nextError.message);
    }
  };

  const resultLayoutFactory = useCallback((node) => {
    const component = node.getComponent();

    if (component === "diagnostics") {
      return (
        <ResultJsonPanel
          title="Diagnostics"
          subtitle="Errors, last operation metadata, runtime health, and active scope summary."
          value={diagnosticsPayload}
        />
      );
    }

    if (component === "search-results") {
      return (
        <ResultJsonPanel
          title="Search Results"
          subtitle="Raw retrieval candidates and ranking output from Smart Search."
          value={result}
        />
      );
    }

    if (component === "prompt-context") {
      return (
        <ResultJsonPanel
          title="Prompt Context"
          subtitle="Context blocks, relation blocks, retrieval debug, and prompt assembly."
          value={contextResult}
        />
      );
    }

    if (component === "answer") {
      return (
        <ResultJsonPanel
          title="Local LLM Answer"
          subtitle="Final answer payload returned from Local LLM RAG."
          value={answerResult}
        />
      );
    }

    if (component === "skill-tree-design") {
      return (
        <ResultJsonPanel
          title="Skill Tree Design"
          subtitle="Async MMSS skill tree design result or latest job payload."
          value={designResult || designJob}
        />
      );
    }

    if (component === "runtime-jobs") {
      return (
        <ResultJsonPanel
          title="Runtime Jobs"
          subtitle="Vectorization and skill-tree background jobs."
          value={runtimeJobsPayload}
        />
      );
    }

    return <div className="ide-panel-shell ase-flex-panel">Unknown result panel: {component}</div>;
  }, [answerResult, contextResult, designJob, designResult, diagnosticsPayload, result, runtimeJobsPayload]);

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

      <div className="ase-config-card">
        <strong>MMSS Runtime Health</strong>
        <div className="ide-workspace-summary-grid" style={{ marginTop: 12 }}>
          {runtimeCards.map((card) => (
            <StatusCard key={card.label} label={card.label} value={card.value} />
          ))}
        </div>
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
        <label>
          <span>Answer Max Chars</span>
          <input type="number" min="500" max="200000" value={responseMaxChars} onChange={(event) => setResponseMaxChars(Number(event.target.value) || 40000)} />
        </label>
      </div>

      <div className="ase-config-card">
        <strong>Parameter Guide</strong>
        <p>{parameterGuide.topK}</p>
        <p>{parameterGuide.queryBudget}</p>
        <p>{parameterGuide.includeRelationLayer}</p>
        <p>{parameterGuide.filterProfile}</p>
        <p>{parameterGuide.responseMaxChars}</p>
      </div>

      <div className="ide-workspace-action-row" style={{ flexWrap: "wrap" }}>
        {(availableTablesByDb[database] || SOURCE_TABLE_OPTIONS).map((tableName) => (
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
              {(availableTablesByDb[dbOption.value] || SOURCE_TABLE_OPTIONS).map((tableName) => (
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
          {loadingStatus ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
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

      <div className="ase-config-card">
        <strong>MMSS Skill Tree Runtime</strong>
        <p style={{ marginTop: 8 }}>
          Async designer поверх текущего Local RAG. Heavy design-run уходит в background job и не держит HTTP sync request открытым.
        </p>
      </div>

      <div className="ide-settings-form">
        <label>
          <span>Skill Tree Goal</span>
          <textarea value={skillTreeGoal} onChange={(event) => setSkillTreeGoal(event.target.value)} rows={4} />
        </label>
        <label>
          <span>Owner Scope</span>
          <input type="text" value={skillTreeOwnerScope} onChange={(event) => setSkillTreeOwnerScope(event.target.value)} />
        </label>
        <label>
          <span>Context Hint</span>
          <textarea value={skillTreeContextHint} onChange={(event) => setSkillTreeContextHint(event.target.value)} rows={4} />
        </label>
      </div>

      <div className="ide-workspace-action-row">
        <button onClick={handleStartDesignJob} disabled={runningDesignJob || !skillTreeGoal.trim() || !activeSourceScopes.length}>
          {runningDesignJob ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}
          Start Skill Tree Design Job
        </button>
        <button onClick={handleRefreshDesignJob} disabled={!designJob?.jobId}>
          <RefreshCcw size={14} />
          Refresh Design Job
        </button>
        <button onClick={handleCancelDesignJob} disabled={!designJob?.jobId || designJob?.status !== "running"}>
          <Square size={14} />
          Cancel Design Job
        </button>
      </div>

      {designJob ? (
        <div className="ase-config-card">
          <strong>Skill Tree Design Job</strong>
          <div className="ide-workspace-summary-grid" style={{ marginTop: 12 }}>
            <StatusCard label="Job ID" value={designJob.jobId} />
            <StatusCard label="Status" value={designJob.status} />
            <StatusCard label="Stage" value={designJob.lastStage || "n/a"} />
            <StatusCard label="Progress" value={`${designJob.progress || 0}%`} />
            <StatusCard label="Owner Scope" value={designJob.ownerScope || "n/a"} />
            <StatusCard label="Model" value={designJob.model || "n/a"} />
          </div>
          {designJob.error ? <pre className="ase-stream-preview">{designJob.error}</pre> : null}
          {designJob.resultSummary ? (
            <pre className="ase-stream-preview">{JSON.stringify(designJob.resultSummary, null, 2)}</pre>
          ) : null}
        </div>
      ) : null}

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
        <button onClick={() => void handleSaveSnapshot("skill_tree_design", designResult || designJob)} disabled={savingSnapshot || (!designResult && !designJob)}>
          <Save size={14} />
          Save Skill Tree Snapshot
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

      <div className="ase-config-card local-rag-results-workspace-shell">
        <strong>Result Workspace</strong>
        <span style={{ display: "block", marginTop: 6, color: "#9eb0c8" }}>
          Separate flexlayout workspace for JSON-heavy outputs. Tab positions persist independently from the main ASE layout.
        </span>
        <div className="local-rag-results-workspace">
          <Layout
            factory={resultLayoutFactory}
            model={resultLayoutModel}
            onModelChange={(nextModel) => {
              setResultLayoutModel(nextModel);
              void appPersistenceService.setSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, nextModel.toJson());
            }}
          />
        </div>
      </div>
    </div>
  );
}

function buildResultLayout() {
  return {
    global: {
      tabEnableClose: false,
      tabEnableFloat: true,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      tabEnableRename: false,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          id: "local-rag-results-left",
          weight: 38,
          selected: 0,
          children: [
            { id: "local-rag-diagnostics-tab", type: "tab", name: "Diagnostics", component: "diagnostics", enableClose: false },
            { id: "local-rag-search-tab", type: "tab", name: "Search Results", component: "search-results", enableClose: false },
            { id: "local-rag-context-tab", type: "tab", name: "Prompt Context", component: "prompt-context", enableClose: false },
          ],
        },
        {
          type: "tabset",
          id: "local-rag-results-right",
          weight: 62,
          selected: 0,
          children: [
            { id: "local-rag-answer-tab", type: "tab", name: "Answer", component: "answer", enableClose: false },
            { id: "local-rag-skill-tree-tab", type: "tab", name: "Skill Tree Design", component: "skill-tree-design", enableClose: false },
            { id: "local-rag-jobs-tab", type: "tab", name: "Runtime Jobs", component: "runtime-jobs", enableClose: false },
          ],
        },
      ],
    },
  };
}

function ResultJsonPanel({ title, subtitle, value, emptyText = "No data yet." }) {
  const hasValue = !(value == null || value === "");
  return (
    <div className="ide-panel-shell ase-flex-panel ase-json-panel">
      <div className="ide-panel-header is-compact">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      <pre className="ase-stream-preview local-rag-stream-preview">
        {hasValue ? JSON.stringify(value, null, 2) : emptyText}
      </pre>
    </div>
  );
}
