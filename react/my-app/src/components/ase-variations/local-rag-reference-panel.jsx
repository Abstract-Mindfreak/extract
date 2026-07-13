import { Actions, Layout, Model } from "flexlayout-react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Database, LoaderCircle, Play, RefreshCcw, Save, Search, ServerCog, Sparkles, Square } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocalRagOrchestrator } from "../../services/LocalRagOrchestrator";
import appPersistenceService from "../../services/AppPersistenceService";
import { getLocalRagModePreset, LOCAL_RAG_PRESET_MODES } from "../../config/mmssModePresets";
import { useAseWorkspaceStore } from "../../hooks/useAseWorkspaceStore";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
];
const SEARCH_SCOPE_DATABASE_OPTIONS = [
  { value: "rag_chunks_db", label: "rag_chunks_db" },
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
];

const SOURCE_TABLE_OPTIONS = [
  "tracks",
  "sessions",
  "music_blocks",
  "chat_sessions",
  "songs",
  "rag_chunks",
  "mmss_invariants",
  "mmss_phase_patterns",
  "mmss_domain_patterns",
  "mmss_skills",
  "mmss_skill_trees",
  "mmss_skill_sets",
  "mmss_collection",
  "mmss_albums",
  "mmss_filtered",
  "mmss_custom_instructions",
  "mmss_tracks_prompts",
];
const FILTER_PROFILE_OPTIONS = ["strict", "balanced", "exploratory"];
const LOCAL_RAG_TAB_COLOR_FALLBACKS = {
  "main-panel-rag": "#3b82f6",
  "search-results": "#22c55e",
  "skill-tree-design": "#f59e0b",
  answer: "#ef4444",
  "prompt-context": "#d946ef",
  diagnostics: "#fde047",
  "runtime-jobs": "#2dd4bf",
};
const MODE_OPTIONS = [
  "qa",
  "prompt_mutation",
  "session_analysis",
  "mmss_operator_assist",
  "mmss_invariants",
  "cross_db_reconciliation",
  "json_prompt_extraction",
  "source_audit",
  "ase_console_recipe",
  "contextual_summarization",
  "knowledge_synthesis",
  "skill_tree_pathfinding",
  "skill_chain_orchestration",
  "skill_gap_analysis",
  "track_variation",
  "style_fusion",
  "prompt_evolution",
  "parameter_shift",
  "session_digest",
  "vibe_extraction",
  "pattern_mining",
  "tag_enrichment",
  "similarity_audit",
  "concept_ideation",
  "album_synthesis",
  "arrangement_blueprint",
  "soundscape_design",
  "album_concept",
  "deep_worldbuilding",
  "pattern_recognition",
];
const MODEL_OPTIONS = [
  "mmss-qwen2.5-3b:latest",
  "mmss-gemma4-q4:latest",
  "mmss-gemma4-q4-creative:latest",
  "mmss-gemma4-mmss-json:latest",
];
const SETTINGS_SCOPE = "local_rag_reference_ui";
const SNAPSHOT_SCOPE = "local_rag_reference_results";
const RESULT_LAYOUT_SETTING_KEY = "resultLayoutSnapshotReference";
const DEFAULT_SKILL_TREE_SCOPE_TABLES = ["mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns"];
const SETTINGS_DEBOUNCE_MS = 500;
const LAYOUT_DEBOUNCE_MS = 800;
const QUERY_HISTORY_STORAGE_KEY = "local_rag_reference_query_history";
const MAX_QUERY_HISTORY = 25;
const ACTION_SHORTCUTS = {
  refreshStatus: "Ctrl/Cmd+Alt+H",
  vectorize: "Ctrl/Cmd+Shift+V",
  applySkillTreePreset: "Ctrl/Cmd+Alt+P",
  refreshRagChunks: "Ctrl/Cmd+Alt+R",
  stopRagChunks: "Ctrl/Cmd+Alt+X",
  syncTracksPrompt: "Ctrl/Cmd+Alt+T",
  syncFiltered: "Ctrl/Cmd+Alt+F",
  curateCollection: "Ctrl/Cmd+Alt+C",
  search: "Ctrl/Cmd+Shift+S",
  buildContext: "Ctrl/Cmd+Shift+B",
  answer: "Ctrl/Cmd+Enter",
  startDesignJob: "Ctrl/Cmd+Alt+D",
  refreshDesignJob: "Ctrl/Cmd+Alt+J",
  cancelDesignJob: "Ctrl/Cmd+Alt+K",
};
const MODE_DESCRIPTION_RU = {
  qa: "Точечный вопрос-ответ по MMSS и Flowmusic только на основе подтвержденных фрагментов.",
  prompt_mutation: "Мутация промпта с сохранением исходного вайба, но с усилением структуры, деталей и операторских подсказок.",
  session_analysis: "Разбор сложной сессии с акцентом на переходы, операторские следы и повторно используемые фрагменты.",
  mmss_operator_assist: "Подбор MMSS-операторов, фаз и доменных паттернов под текущую задачу.",
  mmss_invariants: "Извлечение инвариантов MMSS, онтологических опор и устойчивых операторских структур.",
  cross_db_reconciliation: "Сопоставление rag_chunks и активных MMSS-источников, поиск дублей, пробелов и конфликтов.",
  json_prompt_extraction: "Извлечение структурированных JSON-фрагментов промптов и параметров генерации.",
  source_audit: "Аудит покрытия источников, силы доказательной базы и недостающего контекста.",
  ase_console_recipe: "Сборка пошагового рецепта для ASE Console с операторами, таблицами и переиспользуемыми промптами.",
  contextual_summarization: "Умное резюме без потери терминологии, намерения и технических деталей.",
  knowledge_synthesis: "Синтез ответа из нескольких фрагментов с устранением дублей и сохранением только сильных выводов.",
  skill_tree_pathfinding: "Поиск лучшего маршрута по дереву навыков MMSS под текущую задачу.",
  skill_chain_orchestration: "Оркестрация практической цепочки навыков MMSS с минимальной избыточностью.",
  skill_gap_analysis: "Поиск недостающих навыков и слабых мест runtime-графа навыков.",
  track_variation: "Создание вариаций трека с сохранением идентичности и изменением энергии, мрака или движения.",
  style_fusion: "Слияние нескольких стилевых источников в один согласованный Flowmusic-ready гибрид.",
  prompt_evolution: "Итеративная эволюция промпта: диагностика, расширение, заострение и оптимизация.",
  parameter_shift: "Сдвиг BPM, тональности, метра или интенсивности без потери исходной концепции.",
  session_digest: "Короткий, но плотный технический дайджест длинной сессии.",
  vibe_extraction: "Извлечение эстетики, эмоций, визуальных и звуковых вайбов для повторного использования.",
  pattern_mining: "Поиск повторяющихся удачных паттернов в промптах, сессиях, треках и MMSS-фрагментах.",
  tag_enrichment: "Нормализация тегов и операторских меток для последующей фильтрации и поиска.",
  similarity_audit: "Проверка идеи на дубли, циклы, слишком близкие соседи и потенциал новизны.",
  concept_ideation: "Генерация новой концепции трека: история, визуал, звуковая палитра и направление промпта.",
  album_synthesis: "Синтез нового альбома из отобранных MMSS-фрагментов, инструкций и подтвержденных источников.",
  arrangement_blueprint: "Построение структурной карты трека с ролями секций и эволюцией слоев.",
  soundscape_design: "Проектирование пространственной, атмосферной и текстурной звуковой среды.",
  album_concept: "Построение альбомной концепции с нарративной аркой и логикой треклиста.",
  deep_worldbuilding: "Создание музыкального мира с lore, символами, правилами и звуково-визуальными связями.",
  pattern_recognition: "Распознавание скрытых MMSS- и Flowmusic-паттернов в архивах и runtime-материалах.",
};

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

function applySkillTreePresetToScopes(currentScopes = {}) {
  return {
    ...currentScopes,
    "abstract-mind-lab": Array.from(new Set([
      ...(currentScopes["abstract-mind-lab"] || []),
      ...DEFAULT_SKILL_TREE_SCOPE_TABLES,
    ])),
  };
}

function getAvailableTablesByDb(statusMap = {}) {
  return SEARCH_SCOPE_DATABASE_OPTIONS.reduce((acc, option) => {
    if (option.value === "rag_chunks_db") {
      acc[option.value] = ["rag_chunks"];
      return acc;
    }
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
            { id: "local-rag-main-panel-tab", type: "tab", name: "Main panel RAG", component: "main-panel-rag", enableClose: false, className: "ase-rag-tab ase-rag-tab--main-panel-rag", contentClassName: "ase-rag-content ase-rag-content--main-panel-rag", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS["main-panel-rag"] } },
            { id: "local-rag-diagnostics-tab", type: "tab", name: "Diagnostics", component: "diagnostics", enableClose: false, className: "ase-rag-tab ase-rag-tab--diagnostics", contentClassName: "ase-rag-content ase-rag-content--diagnostics", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS.diagnostics } },
            { id: "local-rag-search-tab", type: "tab", name: "Search Results", component: "search-results", enableClose: false, className: "ase-rag-tab ase-rag-tab--search-results", contentClassName: "ase-rag-content ase-rag-content--search-results", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS["search-results"] } },
            { id: "local-rag-context-tab", type: "tab", name: "Prompt Context", component: "prompt-context", enableClose: false, className: "ase-rag-tab ase-rag-tab--prompt-context", contentClassName: "ase-rag-content ase-rag-content--prompt-context", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS["prompt-context"] } },
          ],
        },
        {
          type: "tabset",
          id: "local-rag-results-right",
          weight: 62,
          selected: 0,
          children: [
            { id: "local-rag-answer-tab", type: "tab", name: "Answer", component: "answer", enableClose: false, className: "ase-rag-tab ase-rag-tab--answer", contentClassName: "ase-rag-content ase-rag-content--answer", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS.answer } },
            { id: "local-rag-skill-tree-tab", type: "tab", name: "Skill Tree Design", component: "skill-tree-design", enableClose: false, className: "ase-rag-tab ase-rag-tab--skill-tree-design", contentClassName: "ase-rag-content ase-rag-content--skill-tree-design", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS["skill-tree-design"] } },
            { id: "local-rag-jobs-tab", type: "tab", name: "Runtime Jobs", component: "runtime-jobs", enableClose: false, className: "ase-rag-tab ase-rag-tab--runtime-jobs", contentClassName: "ase-rag-content ase-rag-content--runtime-jobs", config: { tabColor: LOCAL_RAG_TAB_COLOR_FALLBACKS["runtime-jobs"] } },
          ],
        },
      ],
    },
  };
}

function ensureResultLayoutIntegrity(layoutJson) {
  const fallback = buildResultLayout();
  const nextLayout = layoutJson && typeof layoutJson === "object"
    ? JSON.parse(JSON.stringify(layoutJson))
    : fallback;

  const rowChildren = Array.isArray(nextLayout?.layout?.children) ? nextLayout.layout.children : [];
  const leftTabset = rowChildren.find((child) => child?.id === "local-rag-results-left");
  if (!leftTabset) {
    return fallback;
  }

  if (!Array.isArray(leftTabset.children)) {
    leftTabset.children = [];
  }

  const mainTabIndex = leftTabset.children.findIndex((child) => child?.component === "main-panel-rag");
  if (mainTabIndex === -1) {
    leftTabset.children.unshift({
      id: "local-rag-main-panel-tab",
      type: "tab",
      name: "Main panel RAG",
      component: "main-panel-rag",
      enableClose: false,
    });
    leftTabset.selected = 0;
  } else if (mainTabIndex !== 0) {
    const [mainTab] = leftTabset.children.splice(mainTabIndex, 1);
    leftTabset.children.unshift(mainTab);
    leftTabset.selected = 0;
  } else if (typeof leftTabset.selected !== "number") {
    leftTabset.selected = 0;
  }

  return nextLayout;
}

function patchTabColorInLayoutJson(layoutJson, component, color) {
  const nextLayout = JSON.parse(JSON.stringify(layoutJson));

  const visitNode = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "tab" && node.component === component) {
      node.config = {
        ...(node.config || {}),
        tabColor: color,
      };
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(visitNode);
    }
  };

  if (nextLayout?.layout) {
    visitNode(nextLayout.layout);
  }
  if (Array.isArray(nextLayout?.borders)) {
    nextLayout.borders.forEach(visitNode);
  }

  return nextLayout;
}

function ResultJsonPanel({ title, subtitle, value, emptyText = "No data yet.", actions = null, footer = null }) {
  const [filterText, setFilterText] = useState("");
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const hasValue = !(value == null || value === "");
  const serializedValue = useMemo(() => (hasValue ? JSON.stringify(value, null, 2) : emptyText), [emptyText, hasValue, value]);
  const jsonLines = useMemo(() => serializedValue.split("\n"), [serializedValue]);
  const shouldCollapse = jsonLines.length > 80;
  const visibleLines = useMemo(() => {
    const source = expanded || !shouldCollapse ? jsonLines : jsonLines.slice(0, 80);
    const needle = filterText.trim().toLowerCase();
    if (!needle) return source;
    return source.filter((line) => line.toLowerCase().includes(needle));
  }, [expanded, filterText, jsonLines, shouldCollapse]);

  const handleCopy = useCallback(async () => {
    if (!hasValue) return;
    try {
      await navigator.clipboard.writeText(serializedValue);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (_error) {
      // Ignore clipboard failures and leave the panel usable.
    }
  }, [hasValue, serializedValue]);

  return (
    <div className="ide-panel-shell ase-flex-panel ase-json-panel">
      <div className="ide-panel-header is-compact">
        <div>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
      </div>
      {actions ? <div className="ide-workspace-action-row mmss-action-strip" style={{ padding: "0 16px 12px" }}>{actions}</div> : null}
      {hasValue ? (
        <div className="ide-workspace-action-row mmss-action-strip" style={{ padding: "0 16px 12px" }}>
          <input
            type="text"
            value={filterText}
            onChange={(event) => setFilterText(event.target.value)}
            placeholder="Filter JSON lines..."
            style={{ minWidth: 220, flex: "1 1 240px" }}
          />
          <button className="mmss-action-button mmss-action-button--secondary is-compact" onClick={handleCopy}>
            {copied ? "Copied" : "Copy JSON"}
          </button>
          {shouldCollapse ? (
            <button className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => setExpanded((current) => !current)}>
              {expanded ? "Collapse" : "Expand"}
            </button>
          ) : null}
        </div>
      ) : null}
      <pre className="ase-stream-preview local-rag-stream-preview">
        {visibleLines.join("\n")}
      </pre>
      {hasValue && shouldCollapse && !expanded ? (
        <div style={{ padding: "8px 16px 0" }}>
          <small>Showing first 80 of {jsonLines.length} lines.</small>
        </div>
      ) : null}
      {footer ? <div style={{ padding: "12px 16px 0" }}>{footer}</div> : null}
    </div>
  );
}

function FieldHint({ children }) {
  return <small className="mmss-field-hint">{children}</small>;
}

function PresetModeCard({ mode, activeMode, onApply, t }) {
  const quick = getLocalRagModePreset(mode, "quick");
  const active = mode === activeMode;
  return (
    <div className={`ase-config-card mmss-preset-card ${active ? "is-active" : ""}`}>
      <strong>{t(`localRagRef.mode.${mode}.title`, { defaultValue: quick.label })}</strong>
      <span>{mode}</span>
      <small>{t(`localRagRef.mode.${mode}.description`, { defaultValue: MODE_DESCRIPTION_RU[mode] || quick.query })}</small>
      <div className="ide-workspace-action-row mmss-preset-actions">
        <button type="button" className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => onApply(mode, "quick")}>
          {t("localRagRef.common.quick", { defaultValue: "Быстрый / Quick" })}
        </button>
        <button type="button" className="mmss-action-button mmss-action-button--accent is-compact" onClick={() => onApply(mode, "deep")}>
          {t("localRagRef.common.deep", { defaultValue: "Глубокий / Deep" })}
        </button>
      </div>
    </div>
  );
}

export default function LocalRagReferencePanel() {
  const { t } = useTranslation();
  const ragTabColors = useAseWorkspaceStore((state) => state.ragTabColors);
  const setRagTabColor = useAseWorkspaceStore((state) => state.setRagTabColor);
  const {
    answerWithLocalRag,
    buildRagContext,
    buildGeneratedMmssAlbumFlowmusicPayload,
    cancelRagChunksRefreshJob,
    cancelMmssSkillTreeDesignJob,
    cancelRagJob,
    listMmssCustomInstructions,
    getMmssRuntimeHealth,
    getMmssSkillTreeDesignJob,
    getRagChunksRefreshJob,
    getRagJob,
    saveGeneratedMmssAlbum,
    getRagStatus,
    saveMmssCustomInstruction,
    searchLocalRag,
    startRagChunksRefreshJob,
    startMmssSkillTreeDesignJob,
    startRagVectorization,
    syncMmssCollectionFromFiltered,
    syncMmssFiltered,
    syncMmssTrackPrompts,
  } = useLocalRagOrchestrator();

  const [database, setDatabase] = useState("abstract-mind-lab");
  const [batchSize, setBatchSize] = useState(10);
  const [topK, setTopK] = useState(4);
  const [queryBudget, setQueryBudget] = useState(2);
  const [query, setQuery] = useState("industrial prompt with strong spatial diffusion and recursive low-end movement");
  const [selectedTables, setSelectedTables] = useState(["mmss_collection", "mmss_filtered", "mmss_custom_instructions", "mmss_tracks_prompts", "mmss_albums", "mmss_invariants", "mmss_phase_patterns", "mmss_domain_patterns", "mmss_skills", "mmss_skill_trees", "mmss_skill_sets"]);
  const [scopeSelections, setScopeSelections] = useState({
    rag_chunks_db: ["rag_chunks"],
    "abstract-mind-lab": [],
  });
  const [filterProfile, setFilterProfile] = useState("balanced");
  const [mode, setMode] = useState("qa");
  const [model, setModel] = useState("mmss-qwen2.5-3b:latest");
  const [includeRelationLayer, setIncludeRelationLayer] = useState(true);
  const [responseMaxChars, setResponseMaxChars] = useState(40000);
  const [status, setStatus] = useState(null);
  const [statusByDb, setStatusByDb] = useState({});
  const [runtimeHealth, setRuntimeHealth] = useState(null);
  const [job, setJob] = useState(null);
  const [designJob, setDesignJob] = useState(null);
  const [ragChunksRefreshJob, setRagChunksRefreshJob] = useState(null);
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
  const [runningRagChunksRefresh, setRunningRagChunksRefresh] = useState(false);
  const [error, setError] = useState("");
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [lastOperation, setLastOperation] = useState(null);
  const [skillTreeGoal, setSkillTreeGoal] = useState("Build an MMSS skill tree for operator-aware retrieval, context assembly, and reusable runtime execution.");
  const [skillTreeOwnerScope, setSkillTreeOwnerScope] = useState("local_rag_runtime");
  const [skillTreeContextHint, setSkillTreeContextHint] = useState("");
  const [instructionTitle, setInstructionTitle] = useState("");
  const [instructionCategory, setInstructionCategory] = useState("flowmusic_manual");
  const [instructionSourceLabel, setInstructionSourceLabel] = useState("manual_ui");
  const [instructionText, setInstructionText] = useState("");
  const [customInstructions, setCustomInstructions] = useState([]);
  const [queryHistory, setQueryHistory] = useState([]);
  const [savingInstruction, setSavingInstruction] = useState(false);
  const [savingAlbumDraft, setSavingAlbumDraft] = useState(false);
  const [buildingAlbumPayload, setBuildingAlbumPayload] = useState(false);
  const [syncingTrackPrompts, setSyncingTrackPrompts] = useState(false);
  const [syncingFiltered, setSyncingFiltered] = useState(false);
  const [syncingCollection, setSyncingCollection] = useState(false);
  const [albumDraftResult, setAlbumDraftResult] = useState(null);
  const [albumFlowmusicPreview, setAlbumFlowmusicPreview] = useState(null);
  const [resultLayoutModel, setResultLayoutModel] = useState(() =>
    Model.fromJson(ensureResultLayoutIntegrity(buildResultLayout())),
  );
  const settingsWriteTimerRef = useRef(null);
  const layoutWriteTimerRef = useRef(null);
  const answerShortcutRef = useRef(null);
  const searchShortcutRef = useRef(null);
  const contextShortcutRef = useRef(null);
  const vectorizeShortcutRef = useRef(null);
  const refreshStatusShortcutRef = useRef(null);
  const applySkillTreePresetShortcutRef = useRef(null);
  const refreshRagChunksShortcutRef = useRef(null);
  const stopRagChunksShortcutRef = useRef(null);
  const syncTracksPromptShortcutRef = useRef(null);
  const syncFilteredShortcutRef = useRef(null);
  const curateCollectionShortcutRef = useRef(null);
  const startDesignShortcutRef = useRef(null);
  const refreshDesignShortcutRef = useRef(null);
  const cancelDesignShortcutRef = useRef(null);

  const activeSourceScopes = useMemo(() => buildSourceScopes(scopeSelections), [scopeSelections]);
  const resolvedRagTabColors = useMemo(
    () => ({
      ...LOCAL_RAG_TAB_COLOR_FALLBACKS,
      ...(ragTabColors || {}),
    }),
    [ragTabColors],
  );
  const availableTablesByDb = useMemo(() => getAvailableTablesByDb(statusByDb), [statusByDb]);
  const diagnosticsPayload = useMemo(() => ({
    error: error || null,
    lastOperation,
    lastSavedSnapshot: lastSavedSnapshot || null,
    runtimeHealth,
    database,
    activeSourceScopes,
    albumDraftResult,
    albumFlowmusicPreview,
  }), [activeSourceScopes, albumDraftResult, albumFlowmusicPreview, database, error, lastOperation, lastSavedSnapshot, runtimeHealth]);
  const runtimeJobsPayload = useMemo(() => ({
    vectorizationJob: job || null,
    skillTreeDesignJob: designJob || null,
    ragChunksRefreshJob: ragChunksRefreshJob || null,
  }), [designJob, job, ragChunksRefreshJob]);
  const actionGuideRows = useMemo(() => ([
    {
      id: "refreshStatus",
      label: t("localRagRef.actions.refreshStatus.label", { defaultValue: "Обновить статус" }),
      description: t("localRagRef.actions.refreshStatus.description", { defaultValue: "Перечитывает состояние runtime, таблиц и health-показателей для текущей базы. / Reloads runtime state, table counters, and health metrics for the current database." }),
      shortcut: ACTION_SHORTCUTS.refreshStatus,
    },
    {
      id: "vectorize",
      label: t("localRagRef.actions.vectorize.label", { defaultValue: "Векторизовать базу" }),
      description: t("localRagRef.actions.vectorize.description", { defaultValue: "Запускает векторизацию выбранных таблиц в embedding-индекс для последующего RAG-поиска. / Starts vectorization of the selected tables into the embedding index for later RAG retrieval." }),
      shortcut: ACTION_SHORTCUTS.vectorize,
    },
    {
      id: "applySkillTreePreset",
      label: t("localRagRef.actions.applySkillTreePreset.label", { defaultValue: "Применить пресет Skill Tree" }),
      description: t("localRagRef.actions.applySkillTreePreset.description", { defaultValue: "Переключает ref-режим в операторский профиль MMSS: подставляет безопасные retrieval-параметры, goal для runtime и актуальные scope. / Switches the ref mode to the MMSS operator profile with safe retrieval settings, runtime goal, and current scopes." }),
      shortcut: ACTION_SHORTCUTS.applySkillTreePreset,
    },
    {
      id: "refreshRagChunks",
      label: t("localRagRef.actions.refreshRagChunks.label", { defaultValue: "Обновить rag_chunks" }),
      description: t("localRagRef.actions.refreshRagChunks.description", { defaultValue: "Запускает фоновое обновление основной таблицы rag_chunks из текущего runtime-потока. / Starts a background refresh of the main rag_chunks table from the current runtime pipeline." }),
      shortcut: ACTION_SHORTCUTS.refreshRagChunks,
    },
    {
      id: "stopRagChunks",
      label: t("localRagRef.actions.stopRagChunks.label", { defaultValue: "Остановить rag_chunks" }),
      description: t("localRagRef.actions.stopRagChunks.description", { defaultValue: "Останавливает активную задачу обновления rag_chunks, если она еще выполняется. / Stops the active rag_chunks refresh job if it is still running." }),
      shortcut: ACTION_SHORTCUTS.stopRagChunks,
    },
    {
      id: "syncTracksPrompt",
      label: t("localRagRef.actions.syncTracksPrompt.label", { defaultValue: "Синхронизировать tracks.prompt" }),
      description: t("localRagRef.actions.syncTracksPrompt.description", { defaultValue: "Переносит prompt-поля треков в отдельный MMSS-слой для поиска и повторного использования. / Copies track prompt fields into a dedicated MMSS layer for retrieval and reuse." }),
      shortcut: ACTION_SHORTCUTS.syncTracksPrompt,
    },
    {
      id: "syncFiltered",
      label: t("localRagRef.actions.syncFiltered.label", { defaultValue: "Синхронизировать mmss_filtered" }),
      description: t("localRagRef.actions.syncFiltered.description", { defaultValue: "Пересобирает очищенный слой mmss_filtered из треков и сессий по правилам runtime. / Rebuilds the cleaned mmss_filtered layer from tracks and sessions using runtime rules." }),
      shortcut: ACTION_SHORTCUTS.syncFiltered,
    },
    {
      id: "curateCollection",
      label: t("localRagRef.actions.curateCollection.label", { defaultValue: "Собрать mmss_collection" }),
      description: t("localRagRef.actions.curateCollection.description", { defaultValue: "Курирует витрину mmss_collection на основе filtered-слоя и score-ограничений. / Curates the mmss_collection showcase from the filtered layer using score thresholds." }),
      shortcut: ACTION_SHORTCUTS.curateCollection,
    },
    {
      id: "skillTreeRuntime",
      label: t("localRagRef.actions.skillTreeRuntime.label", { defaultValue: "MMSS Skill Tree Runtime" }),
      description: t("localRagRef.actions.skillTreeRuntime.description", { defaultValue: "Раздел для проектирования и сопровождения skill-tree runtime поверх Local RAG. / Section for designing and maintaining the skill-tree runtime on top of Local RAG." }),
      shortcut: "—",
    },
    {
      id: "startDesignJob",
      label: t("localRagRef.actions.startDesignJob.label", { defaultValue: "Запустить Skill Tree Design Job" }),
      description: t("localRagRef.actions.startDesignJob.description", { defaultValue: "Стартует асинхронный job, который строит skill tree и сохраняет runtime-результат. / Starts an async job that designs the skill tree and stores the runtime result." }),
      shortcut: ACTION_SHORTCUTS.startDesignJob,
    },
    {
      id: "refreshDesignJob",
      label: t("localRagRef.actions.refreshDesignJob.label", { defaultValue: "Обновить Design Job" }),
      description: t("localRagRef.actions.refreshDesignJob.description", { defaultValue: "Принудительно перечитывает текущее состояние job без ожидания следующего poll-цикла. / Force-refreshes the current job state without waiting for the next polling cycle." }),
      shortcut: ACTION_SHORTCUTS.refreshDesignJob,
    },
    {
      id: "cancelDesignJob",
      label: t("localRagRef.actions.cancelDesignJob.label", { defaultValue: "Отменить Design Job" }),
      description: t("localRagRef.actions.cancelDesignJob.description", { defaultValue: "Отменяет активный job проектирования skill tree и снимает runtime-блокировку панели. / Cancels the active skill-tree design job and releases the runtime lock in the panel." }),
      shortcut: ACTION_SHORTCUTS.cancelDesignJob,
    },
  ]), [t]);

  const pushQueryHistory = useCallback((entry) => {
    if (!entry?.query?.trim()) return;
    setQueryHistory((current) => {
      const nextEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ranAt: new Date().toISOString(),
        database: entry.database || database,
        mode: entry.mode || mode,
        action: entry.action || "search",
        query: entry.query.trim(),
        resultCount: Number.isFinite(Number(entry.resultCount)) ? Number(entry.resultCount) : null,
      };
      const deduped = current.filter((item) => !(item.query === nextEntry.query && item.database === nextEntry.database && item.mode === nextEntry.mode && item.action === nextEntry.action));
      const nextHistory = [nextEntry, ...deduped].slice(0, MAX_QUERY_HISTORY);
      try {
        window.localStorage.setItem(QUERY_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch (_error) {
        // Ignore storage failures and keep the panel usable.
      }
      return nextHistory;
    });
  }, [database, mode]);

  const restoreHistoryEntry = useCallback((entry) => {
    if (!entry) return;
    if (typeof entry.query === "string") setQuery(entry.query);
    if (typeof entry.database === "string") setDatabase(entry.database);
    if (typeof entry.mode === "string") setMode(entry.mode);
  }, []);

  const clearQueryHistory = useCallback(() => {
    setQueryHistory([]);
    try {
      window.localStorage.removeItem(QUERY_HISTORY_STORAGE_KEY);
    } catch (_error) {
      // Ignore storage failures and keep the panel usable.
    }
  }, []);

  const removeQueryHistoryEntry = useCallback((entryId) => {
    setQueryHistory((current) => {
      const nextHistory = current.filter((entry) => entry.id !== entryId);
      try {
        window.localStorage.setItem(QUERY_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));
      } catch (_error) {
        // Ignore storage failures and keep the panel usable.
      }
      return nextHistory;
    });
  }, []);

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

  const loadCustomInstructions = useCallback(async (targetDatabase = database) => {
    try {
      const payload = await listMmssCustomInstructions(targetDatabase, 50);
      setCustomInstructions(Array.isArray(payload?.items) ? payload.items : []);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, listMmssCustomInstructions]);

  useEffect(() => {
    void loadStatus(database);
  }, [database, loadStatus]);

  useEffect(() => {
    void loadCustomInstructions(database);
  }, [database, loadCustomInstructions]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(QUERY_HISTORY_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setQueryHistory(parsed.slice(0, MAX_QUERY_HISTORY));
      }
    } catch (_error) {
      // Ignore invalid local history snapshots.
    }
  }, []);

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
        if (typeof saved.instructionTitle === "string") setInstructionTitle(saved.instructionTitle);
        if (typeof saved.instructionCategory === "string") setInstructionCategory(saved.instructionCategory);
        if (typeof saved.instructionSourceLabel === "string") setInstructionSourceLabel(saved.instructionSourceLabel);
        if (typeof saved.instructionText === "string") setInstructionText(saved.instructionText);
      } catch (_error) {
        // Keep the panel usable even if persistence is unavailable.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const currentJson = resultLayoutModel.toJson();
    let nextJson = currentJson;
    let changed = false;

    Object.entries(resolvedRagTabColors).forEach(([component, color]) => {
      const lookup = {
        "main-panel-rag": "local-rag-main-panel-tab",
        diagnostics: "local-rag-diagnostics-tab",
        "search-results": "local-rag-search-tab",
        "prompt-context": "local-rag-context-tab",
        answer: "local-rag-answer-tab",
        "skill-tree-design": "local-rag-skill-tree-tab",
        "runtime-jobs": "local-rag-jobs-tab",
      };
      const nodeId = lookup[component];
      const node = nodeId ? resultLayoutModel.getNodeById(nodeId) : null;
      if ((node?.getConfig?.()?.tabColor || null) !== color) {
        nextJson = patchTabColorInLayoutJson(nextJson, component, color);
        changed = true;
      }
    });

    if (!changed) return;

    const nextModel = Model.fromJson(nextJson);
    setResultLayoutModel(nextModel);
    void appPersistenceService.setSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, nextJson);
  }, [resolvedRagTabColors, resultLayoutModel]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const savedLayout = await appPersistenceService.getSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, null);
        if (!active || !savedLayout || typeof savedLayout !== "object") return;
        const normalizedLayout = ensureResultLayoutIntegrity(savedLayout);
        setResultLayoutModel(Model.fromJson(normalizedLayout));
        await appPersistenceService.setSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, normalizedLayout);
      } catch (_error) {
        // Keep default layout if the saved snapshot is unavailable or invalid.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (settingsWriteTimerRef.current) {
      window.clearTimeout(settingsWriteTimerRef.current);
    }

    settingsWriteTimerRef.current = window.setTimeout(() => {
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
        instructionTitle,
        instructionCategory,
        instructionSourceLabel,
        instructionText,
      });
    }, SETTINGS_DEBOUNCE_MS);

    return () => {
      if (settingsWriteTimerRef.current) {
        window.clearTimeout(settingsWriteTimerRef.current);
        settingsWriteTimerRef.current = null;
      }
    };
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
    instructionCategory,
    instructionSourceLabel,
    instructionText,
    instructionTitle,
    topK,
  ]);

  useEffect(() => () => {
    if (settingsWriteTimerRef.current) {
      window.clearTimeout(settingsWriteTimerRef.current);
    }
    if (layoutWriteTimerRef.current) {
      window.clearTimeout(layoutWriteTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!job?.jobId || job.status !== "running") return undefined;
    const timer = window.setInterval(async () => {
      if (document.visibilityState === "hidden") return;
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
      if (document.visibilityState === "hidden") return;
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

  useEffect(() => {
    if (!ragChunksRefreshJob?.jobId || ragChunksRefreshJob.status !== "running") return undefined;
    const timer = window.setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const nextJob = await getRagChunksRefreshJob(ragChunksRefreshJob.jobId);
        setRagChunksRefreshJob(nextJob);
        if (nextJob.status !== "running") {
          window.clearInterval(timer);
          setRunningRagChunksRefresh(false);
        }
      } catch (nextError) {
        setError(nextError.message);
        window.clearInterval(timer);
        setRunningRagChunksRefresh(false);
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [getRagChunksRefreshJob, ragChunksRefreshJob]);

  const statusCards = useMemo(() => ([
    { label: "Embedding model", value: status?.embeddingModel || "n/a" },
    { label: "Dimension", value: String(status?.embeddingDimension || "n/a") },
    { label: "Stored vectors", value: String(status?.totalEmbeddings || 0) },
    { label: "Source tables", value: Array.isArray(status?.sourceTables) ? status.sourceTables.join(", ") || "n/a" : "n/a" },
  ]), [status]);

  const runtimeCards = useMemo(() => ([
    { label: "Generation results", value: String(runtimeHealth?.tables?.mmss_generation_results || 0) },
    { label: "Skills", value: String(runtimeHealth?.tables?.mmss_skills || 0) },
    { label: "Skill sets", value: String(runtimeHealth?.tables?.mmss_skill_sets || 0) },
    { label: "Skill trees", value: String(runtimeHealth?.tables?.mmss_skill_trees || 0) },
    { label: "Skill-RAG vectors", value: runtimeHealth?.skill_rag_vectorization?.summary || "0/3 ready" },
    { label: "Skill runs", value: String(runtimeHealth?.tables?.mmss_skill_runs || 0) },
    { label: "MMSS collection", value: String(runtimeHealth?.tables?.mmss_collection || 0) },
    { label: "MMSS albums", value: String(runtimeHealth?.tables?.mmss_albums || 0) },
    { label: "MMSS filtered", value: String(runtimeHealth?.tables?.mmss_filtered || 0) },
    { label: "Custom instructions", value: String(runtimeHealth?.tables?.mmss_custom_instructions || 0) },
    { label: "Track prompts", value: String(runtimeHealth?.tables?.mmss_tracks_prompts || 0) },
  ]), [runtimeHealth]);

  const parameterGuide = useMemo(() => ({
    topK: `Top K=${topK}. Это итоговое количество самых сильных найденных блоков, которые проходят в финальный retrieval pool и затем в отбор контекста.`,
    queryBudget: `Query Budget=${queryBudget}. Это число вариантов поискового запроса, которые система генерирует из одного исходного запроса для расширения semantic search.`,
    includeRelationLayer: includeRelationLayer
      ? "Include relation layer=on. В контекст добавляется вторичный слой relation-heavy блоков: связи, session traces, tool/meta anchors."
      : "Include relation layer=off. Берутся только основные смысловые блоки без вторичного relation-слоя.",
    filterProfile: `Filter Profile=${filterProfile}. Strict сильнее режет шум, Balanced оставляет компромисс, Exploratory расширяет поиск и чаще тянет слабые совпадения.`,
    responseMaxChars: `Final Flowmusic JSON max chars=${responseMaxChars}. Это лимит только для финального JSON-промта, который потом пойдет в flowmusic.app. Промежуточные RAG/skill-tree ответы не должны жестко резаться этим значением.`,
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
      pushQueryHistory({
        action: "search",
        database,
        mode,
        query,
        resultCount: Array.isArray(payload?.results) ? payload.results.length : 0,
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
      pushQueryHistory({
        action: "build_context",
        database,
        mode,
        query,
        resultCount: Array.isArray(payload?.contextBlocks) ? payload.contextBlocks.length : 0,
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
        enforceResponseMaxChars: ["album_synthesis", "album_concept", "deep_worldbuilding"].includes(mode),
      });
      setAnswerResult(payload);
      setAlbumDraftResult(null);
      setAlbumFlowmusicPreview(null);
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
      pushQueryHistory({
        action: "answer",
        database,
        mode,
        query,
        resultCount: payload?.answer?.length || 0,
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

  useEffect(() => {
    answerShortcutRef.current = handleGenerateAnswer;
    searchShortcutRef.current = handleSearch;
    contextShortcutRef.current = handleBuildContext;
    vectorizeShortcutRef.current = handleVectorize;
    refreshStatusShortcutRef.current = () => void loadStatus(database);
    applySkillTreePresetShortcutRef.current = applySkillTreePreset;
    refreshRagChunksShortcutRef.current = handleStartRagChunksRefresh;
    stopRagChunksShortcutRef.current = handleCancelRagChunksRefresh;
    syncTracksPromptShortcutRef.current = handleSyncTrackPrompts;
    syncFilteredShortcutRef.current = handleSyncFiltered;
    curateCollectionShortcutRef.current = handleSyncCollectionFromFiltered;
    startDesignShortcutRef.current = handleStartDesignJob;
    refreshDesignShortcutRef.current = handleRefreshDesignJob;
    cancelDesignShortcutRef.current = handleCancelDesignJob;
  });

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target;
      const tagName = target?.tagName?.toLowerCase?.() || "";
      const isTypingTarget = tagName === "textarea" || tagName === "input" || target?.isContentEditable;
      const withCommand = event.metaKey || event.ctrlKey;
      if (!withCommand) return;

      if (event.key === "Enter") {
        event.preventDefault();
        answerShortcutRef.current?.();
        return;
      }

      if (event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === "h") {
          event.preventDefault();
          refreshStatusShortcutRef.current?.();
        } else if (key === "p") {
          event.preventDefault();
          applySkillTreePresetShortcutRef.current?.();
        } else if (key === "r") {
          event.preventDefault();
          refreshRagChunksShortcutRef.current?.();
        } else if (key === "x") {
          event.preventDefault();
          stopRagChunksShortcutRef.current?.();
        } else if (key === "t") {
          event.preventDefault();
          syncTracksPromptShortcutRef.current?.();
        } else if (key === "f") {
          event.preventDefault();
          syncFilteredShortcutRef.current?.();
        } else if (key === "c") {
          event.preventDefault();
          curateCollectionShortcutRef.current?.();
        } else if (key === "d") {
          event.preventDefault();
          startDesignShortcutRef.current?.();
        } else if (key === "j") {
          event.preventDefault();
          refreshDesignShortcutRef.current?.();
        } else if (key === "k") {
          event.preventDefault();
          cancelDesignShortcutRef.current?.();
        }
        return;
      }

      if (!event.shiftKey) return;
      const key = event.key.toLowerCase();

      if (key === "s") {
        event.preventDefault();
        searchShortcutRef.current?.();
      } else if (key === "b") {
        event.preventDefault();
        contextShortcutRef.current?.();
      } else if (key === "v" && !isTypingTarget) {
        event.preventDefault();
        vectorizeShortcutRef.current?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSaveAlbumDraft = async () => {
    if (!answerResult) return;
    setSavingAlbumDraft(true);
    setError("");
    try {
      const payload = await saveGeneratedMmssAlbum({
        database,
        answerResult,
        query,
        mode,
        retrievedSources: answerResult?.retrievedSources || [],
      });
      setAlbumDraftResult(payload);
      await loadStatus(database);
      setLastOperation({
        action: "save_generated_album",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
      setLastOperation({
        action: "save_generated_album",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setSavingAlbumDraft(false);
    }
  };

  const handleBuildAlbumFlowmusicPayload = async () => {
    if (!answerResult) return;
    setBuildingAlbumPayload(true);
    setError("");
    try {
      const payload = await buildGeneratedMmssAlbumFlowmusicPayload({
        database,
        answerResult,
        query,
        mode,
        retrievedSources: answerResult?.retrievedSources || [],
      });
      setAlbumFlowmusicPreview(payload);
      setLastOperation({
        action: "build_album_flowmusic_payload",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
      setLastOperation({
        action: "build_album_flowmusic_payload",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    } finally {
      setBuildingAlbumPayload(false);
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

  const applySkillTreePreset = () => {
    setMode("mmss_invariants");
    setTopK(2);
    setQueryBudget(2);
    setFilterProfile("balanced");
    setIncludeRelationLayer(false);
    setScopeSelections((current) => applySkillTreePresetToScopes(current));
    setSkillTreeGoal("Build an MMSS skill tree for operator-aware retrieval, context assembly, and reusable runtime execution.");
    setSkillTreeOwnerScope("local_rag_runtime");
    setSkillTreeContextHint("Use MMSS invariants, phase patterns, and domain patterns. Produce a reusable operator-aware skill tree for retrieval, context assembly, evidence filtering, and runtime execution. Return only structured JSON.");
  };

  const applyModePreset = (presetMode, variant = "quick") => {
    const preset = getLocalRagModePreset(presetMode, variant);
    setDatabase(preset.database);
    setBatchSize(preset.batchSize);
    setTopK(preset.topK);
    setQueryBudget(preset.queryBudget);
    setQuery(preset.query);
    setSelectedTables(preset.selectedTables);
    setScopeSelections(preset.scopeSelections);
    setFilterProfile(preset.filterProfile);
    setMode(preset.mode);
    setModel(preset.model);
    setIncludeRelationLayer(preset.includeRelationLayer);
    setResponseMaxChars(preset.responseMaxChars);
    setSkillTreeGoal(preset.skillTreeGoal);
    setSkillTreeOwnerScope(preset.skillTreeOwnerScope);
    setSkillTreeContextHint(preset.skillTreeContextHint);
    setInstructionTitle(preset.instructionTitle);
    setInstructionCategory(preset.instructionCategory);
    setInstructionSourceLabel(preset.instructionSourceLabel);
    setInstructionText(preset.instructionText);
  };

  const handleModeSelect = (nextMode) => {
    applyModePreset(nextMode, "quick");
  };

  const handleSaveInstruction = async () => {
    setSavingInstruction(true);
    setError("");
    try {
      const payload = await saveMmssCustomInstruction({
        database,
        title: instructionTitle,
        category: instructionCategory,
        sourceLabel: instructionSourceLabel,
        instructionText,
        metadata: {
          origin: "local_rag_panel",
        },
      });
      setInstructionText("");
      setInstructionTitle("");
      await loadCustomInstructions(database);
      await loadStatus(database);
      setLastOperation({
        action: "save_custom_instruction",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSavingInstruction(false);
    }
  };

  const handleSyncTrackPrompts = async () => {
    setSyncingTrackPrompts(true);
    setError("");
    try {
      const payload = await syncMmssTrackPrompts({ database });
      await loadStatus(database);
      setLastOperation({
        action: "sync_track_prompts",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSyncingTrackPrompts(false);
    }
  };

  const handleSyncFiltered = async () => {
    setSyncingFiltered(true);
    setError("");
    try {
      const payload = await syncMmssFiltered({
        database,
        sessionLimit: 250,
        trackLimit: 500,
      });
      await loadStatus(database);
      setLastOperation({
        action: "sync_mmss_filtered",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSyncingFiltered(false);
    }
  };

  const handleSyncCollectionFromFiltered = async () => {
    setSyncingCollection(true);
    setError("");
    try {
      const payload = await syncMmssCollectionFromFiltered({
        database,
        rowLimit: 10000,
        minScore: 70,
        maxRows: 1500,
      });
      await loadStatus(database);
      setLastOperation({
        action: "sync_mmss_collection_from_filtered",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: payload,
      });
    } catch (nextError) {
      setError(nextError.message);
    } finally {
      setSyncingCollection(false);
    }
  };

  const handleStartRagChunksRefresh = async () => {
    setRunningRagChunksRefresh(true);
    setError("");
    try {
      const nextJob = await startRagChunksRefreshJob();
      setRagChunksRefreshJob(nextJob);
      setLastOperation({
        action: "refresh_rag_chunks",
        status: "success",
        finishedAt: new Date().toISOString(),
        response: nextJob,
      });
    } catch (nextError) {
      setError(nextError.message);
      setRunningRagChunksRefresh(false);
      setLastOperation({
        action: "refresh_rag_chunks",
        status: "error",
        finishedAt: new Date().toISOString(),
        error: nextError.message,
      });
    }
  };

  const handleCancelRagChunksRefresh = async () => {
    if (!ragChunksRefreshJob?.jobId) return;
    try {
      const nextJob = await cancelRagChunksRefreshJob(ragChunksRefreshJob.jobId);
      setRagChunksRefreshJob(nextJob);
      setRunningRagChunksRefresh(false);
    } catch (nextError) {
      setError(nextError.message);
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

  const resultLayoutFactory = (node) => {
    const component = node.getComponent();

    if (component === "main-panel-rag") {
      return (
        <div className="ide-panel-shell ase-flex-panel" style={{ overflow: "auto" }}>
          <div className="ide-panel-header">
            <div>
              <strong>Main panel RAG</strong>
              <span>Control panel for Local LLM RAG configuration and operations.</span>
            </div>
          </div>

          <div className="ase-feedback-card">
            <Database size={14} />
            <p>
              Reference workspace mode. Runtime DB: <strong>{database}</strong>. Active RAG scopes: <strong>{summarizeScopes(scopeSelections) || "none"}</strong>.
            </p>
          </div>

          <div className="ase-feedback-card">
            <Bot size={14} />
            <p>
              Verified skill-RAG modes: <strong>mmss-qwen2.5-3b:latest</strong> (priority) and <strong>mmss-gemma4-q4:latest</strong> (fallback).
              Skill vectorization coverage: <strong>{runtimeHealth?.skill_rag_vectorization?.summary || "0/3 ready"}</strong>.
            </p>
          </div>

          <div className="ide-workspace-summary-grid">
            {statusCards.map((card) => (
              <StatusCard key={card.label} label={card.label} value={card.value} />
            ))}
          </div>

          <div className="ase-config-card mmss-section-card mmss-section-card--skilltree">
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

          <details className="ase-config-card mmss-section-card mmss-section-card--preset" open={false}>
            <summary className="mmss-accordion-summary">
              <strong>Mode Presets</strong>
              <span>Quick and Deep presets for each mode.</span>
            </summary>
            <div className="ide-workspace-action-row mmss-preset-actions" style={{ marginTop: 12 }}>
              <button type="button" className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => applyModePreset(mode, "quick")}>
                {t("localRagRef.common.currentQuick", { defaultValue: "Текущий быстрый / Current Quick" })}
              </button>
              <button type="button" className="mmss-action-button mmss-action-button--accent is-compact" onClick={() => applyModePreset(mode, "deep")}>
                {t("localRagRef.common.currentDeep", { defaultValue: "Текущий глубокий / Current Deep" })}
              </button>
            </div>
            <div className="mmss-preset-grid">
              {LOCAL_RAG_PRESET_MODES.map((presetMode) => (
                <PresetModeCard key={presetMode} mode={presetMode} activeMode={mode} onApply={applyModePreset} t={t} />
              ))}
            </div>
          </details>

          <div className="mmss-section-grid">
            <div className="ase-config-card mmss-section-card mmss-section-card--runtime">
              <strong>Runtime Parameters</strong>
              <span>Low-level controls for DB target, batch size, retrieval width, and final Flowmusic JSON cap.</span>
              <div className="ide-settings-form mmss-form-grid">
                <label className="mmss-field mmss-field--runtime">
                  <span>Vectorization DB</span>
                  <select value={database} onChange={(event) => setDatabase(event.target.value)}>
                    {DATABASE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <FieldHint>Where vectorization and MMSS runtime actions are written.</FieldHint>
                </label>
                <label className="mmss-field mmss-field--numeric">
                  <span>Batch Size</span>
                  <input type="number" min="1" max="20" value={batchSize} onChange={(event) => setBatchSize(Number(event.target.value) || 10)} />
                  <FieldHint>Embedding job chunk size. Lower is safer, higher is faster.</FieldHint>
                </label>
                <label className="mmss-field mmss-field--retrieval">
                  <span>Top K</span>
                  <input type="number" min="1" max="20" value={topK} onChange={(event) => setTopK(Number(event.target.value) || 5)} />
                  <FieldHint>Final number of strongest chunks kept after retrieval.</FieldHint>
                </label>
                <label className="mmss-field mmss-field--retrieval">
                  <span>Query Budget</span>
                  <input type="number" min="1" max="100" value={queryBudget} onChange={(event) => setQueryBudget(Number(event.target.value) || 1)} />
                  <FieldHint>How many search variants the system is allowed to try.</FieldHint>
                </label>
                <label className="mmss-field mmss-field--retrieval">
                  <span>Filter Profile</span>
                  <select value={filterProfile} onChange={(event) => setFilterProfile(event.target.value)}>
                    {FILTER_PROFILE_OPTIONS.map((entry) => (
                      <option key={entry} value={entry}>{entry}</option>
                    ))}
                  </select>
                  <FieldHint>`strict` trims harder, `balanced` is default, `exploratory` keeps wider evidence.</FieldHint>
                </label>
                <label className="mmss-field mmss-field--warning">
                  <span>Final Flowmusic JSON Max Chars</span>
                  <input type="number" min="500" max="200000" value={responseMaxChars} onChange={(event) => setResponseMaxChars(Number(event.target.value) || 40000)} />
                  <FieldHint>Applies only to the final JSON prompt meant for Flowmusic testing, not to intermediate RAG outputs.</FieldHint>
                </label>
              </div>
            </div>

            <div className="ase-config-card mmss-section-card mmss-section-card--guide">
              <strong>Parameter Guide</strong>
              <span>Live hints for the current retrieval profile and answer pipeline.</span>
              <div className="mmss-hint-stack">
                <p>{parameterGuide.topK}</p>
                <p>{parameterGuide.queryBudget}</p>
                <p>{parameterGuide.includeRelationLayer}</p>
                <p>{parameterGuide.filterProfile}</p>
                <p>{parameterGuide.responseMaxChars}</p>
              </div>
            </div>
          </div>

          <details className="ase-config-card mmss-section-card mmss-section-card--selection" open={false}>
            <summary className="mmss-accordion-summary">
              <strong>{t("localRagRef.vectorization.title", { defaultValue: "Vectorization Table Selection / Таблицы векторизации" })}</strong>
              <span>{t("localRagRef.vectorization.summary", { defaultValue: `Выбрано ${selectedTables.length} таблиц для ${database}. / ${selectedTables.length} tables selected for ${database}.` })}</span>
            </summary>
            <div className="mmss-checkbox-grid" style={{ marginTop: 12 }}>
              {(availableTablesByDb[database] || SOURCE_TABLE_OPTIONS).map((tableName) => (
                <label key={tableName} className="mmss-checkbox-chip">
                  <input
                    type="checkbox"
                    checked={selectedTables.includes(tableName)}
                    onChange={() => setSelectedTables((current) => splitSelected(current, tableName))}
                  />
                  <span>{tableName}</span>
                </label>
              ))}
            </div>
          </details>

          <div className="ide-workspace-action-row mmss-action-strip" style={{ display: "none" }}>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={() => void loadStatus(database)} disabled={loadingStatus} title={ACTION_SHORTCUTS.refreshStatus}>
              {loadingStatus ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              {t("localRagRef.actions.refreshStatus.label", { defaultValue: "Обновить статус" })}
            </button>
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleVectorize} disabled={runningVectorization || !selectedTables.length} title={ACTION_SHORTCUTS.vectorize}>
              {runningVectorization ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
              {t("localRagRef.actions.vectorize.label", { defaultValue: "Векторизовать базу" })}
            </button>
          </div>

          <div className="ase-config-list mmss-scope-list">
            {SEARCH_SCOPE_DATABASE_OPTIONS.map((dbOption) => (
              <details key={dbOption.value} className="ase-config-card mmss-section-card mmss-section-card--scope" open={dbOption.value === "rag_chunks_db"}>
                <summary className="mmss-accordion-summary">
                  <strong>{t("localRagRef.scope.title", { defaultValue: "Search Scope" })}: {dbOption.label}</strong>
                  <span>{t("localRagRef.scope.summary", { defaultValue: `Выбрано ${(scopeSelections[dbOption.value] || []).length} таблиц. / ${(scopeSelections[dbOption.value] || []).length} tables selected.` })}</span>
                </summary>
                <div className="mmss-checkbox-grid" style={{ marginTop: 12 }}>
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
              </details>
            ))}
          </div>

          <div className="ide-workspace-action-row mmss-action-strip">
            <button className="mmss-action-button mmss-action-button--secondary" onClick={() => void loadStatus(database)} disabled={loadingStatus}>
              {loadingStatus ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              Refresh Status
            </button>
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleVectorize} disabled={runningVectorization || !selectedTables.length} title="Ctrl/Cmd+Shift+V">
              {runningVectorization ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
              Векторизовать базу данных
            </button>
          </div>

          {job ? (
            <div className="ase-config-card mmss-section-card mmss-section-card--runtime">
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
              <div className="ide-workspace-action-row mmss-action-strip">
                <button
                  className="mmss-action-button mmss-action-button--danger"
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

          <div className="ase-config-card mmss-section-card mmss-section-card--query">
            <strong>Search Query</strong>
            <span>Main retrieval request. Presets rewrite this for the chosen mode, but you can override it manually.</span>
            <div className="ide-settings-form mmss-form-grid">
            <label className="mmss-field mmss-field--wide mmss-field--query">
              <span>Smart Search Query</span>
              <textarea value={query} onChange={(event) => setQuery(event.target.value)} rows={4} />
              <FieldHint>Use it for search, context assembly, answer generation, and as the anchor for preset workflows. Shortcuts: Ctrl/Cmd+Enter, Ctrl/Cmd+Shift+S, Ctrl/Cmd+Shift+B.</FieldHint>
            </label>
            </div>
          </div>

          <div className="ase-config-card mmss-section-card">
            <div className="ide-panel-header is-compact">
              <div>
                <strong>Query History</strong>
                <span>Recent runs saved only for this reference panel.</span>
              </div>
              <button className="mmss-action-button mmss-action-button--secondary is-compact" onClick={clearQueryHistory} disabled={!queryHistory.length}>
                Clear All
              </button>
            </div>
            <div className="mmss-hint-stack">
              {queryHistory.length ? queryHistory.slice(0, 8).map((entry) => (
                <div key={entry.id} className="ase-feedback-card" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong>{entry.action}</strong>
                    <p style={{ marginTop: 4 }}>{entry.query}</p>
                    <small>{entry.database} · {entry.mode} · {new Date(entry.ranAt).toLocaleString()}</small>
                  </div>
                  <div className="ide-workspace-action-row">
                    <button className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => restoreHistoryEntry(entry)}>
                      Restore
                    </button>
                    <button className="mmss-action-button mmss-action-button--danger is-compact" onClick={() => removeQueryHistoryEntry(entry.id)}>
                      Remove
                    </button>
                  </div>
                </div>
              )) : <p>No query history yet.</p>}
            </div>
          </div>

          <div className="ide-workspace-action-row mmss-action-strip">
            <button className="mmss-action-button mmss-action-button--secondary" onClick={applySkillTreePreset} title={ACTION_SHORTCUTS.applySkillTreePreset}>
              <Sparkles size={14} />
              {t("localRagRef.actions.applySkillTreePreset.label", { defaultValue: "Применить пресет Skill Tree" })}
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={handleStartRagChunksRefresh} disabled={runningRagChunksRefresh} title={ACTION_SHORTCUTS.refreshRagChunks}>
              {runningRagChunksRefresh ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              {t("localRagRef.actions.refreshRagChunks.label", { defaultValue: "Обновить rag_chunks" })}
            </button>
            <button className="mmss-action-button mmss-action-button--danger" onClick={handleCancelRagChunksRefresh} disabled={!ragChunksRefreshJob?.jobId || ragChunksRefreshJob?.status !== "running"} title={ACTION_SHORTCUTS.stopRagChunks}>
              <Square size={14} />
              {t("localRagRef.actions.stopRagChunks.label", { defaultValue: "Остановить rag_chunks" })}
            </button>
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleSyncTrackPrompts} disabled={syncingTrackPrompts} title={ACTION_SHORTCUTS.syncTracksPrompt}>
              {syncingTrackPrompts ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              {t("localRagRef.actions.syncTracksPrompt.label", { defaultValue: "Синхронизировать tracks.prompt" })}
            </button>
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleSyncFiltered} disabled={syncingFiltered} title={ACTION_SHORTCUTS.syncFiltered}>
              {syncingFiltered ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              {t("localRagRef.actions.syncFiltered.label", { defaultValue: "Синхронизировать mmss_filtered" })}
            </button>
            <button className="mmss-action-button mmss-action-button--accent" onClick={handleSyncCollectionFromFiltered} disabled={syncingCollection} title={ACTION_SHORTCUTS.curateCollection}>
              {syncingCollection ? <LoaderCircle size={14} className="spin" /> : <RefreshCcw size={14} />}
              {t("localRagRef.actions.curateCollection.label", { defaultValue: "Собрать mmss_collection" })}
            </button>
          </div>

          <div className="ase-config-card mmss-section-card mmss-section-card--skilltree">
            <strong>{t("localRagRef.actions.skillTreeRuntime.label", { defaultValue: "MMSS Skill Tree Runtime" })}</strong>
            <p style={{ marginTop: 8 }}>
              {t("localRagRef.actions.skillTreeRuntime.description", { defaultValue: "Раздел для проектирования и сопровождения skill-tree runtime поверх Local RAG. / Section for designing and maintaining the skill-tree runtime on top of Local RAG." })}
            </p>
          </div>

          <div className="ase-config-card mmss-section-card">
            <strong>{t("localRagRef.actionsGuide.title", { defaultValue: "Справка по действиям / Action Guide" })}</strong>
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>{t("localRagRef.actionsGuide.button", { defaultValue: "Кнопка / Button" })}</th>
                    <th style={{ textAlign: "left", padding: "8px 10px" }}>{t("localRagRef.actionsGuide.description", { defaultValue: "Описание / Description" })}</th>
                    <th style={{ textAlign: "left", padding: "8px 10px", whiteSpace: "nowrap" }}>{t("localRagRef.actionsGuide.shortcut", { defaultValue: "Горячая клавиша / Shortcut" })}</th>
                  </tr>
                </thead>
                <tbody>
                  {actionGuideRows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: "8px 10px", verticalAlign: "top" }}><strong>{row.label}</strong></td>
                      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>{row.description}</td>
                      <td style={{ padding: "8px 10px", verticalAlign: "top", whiteSpace: "nowrap" }}>{row.shortcut}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ase-config-card mmss-section-card mmss-section-card--skilltree">
            <strong>Skill Tree Configuration</strong>
            <span>Presets also fill these fields so each mode has a usable runtime design profile.</span>
            <div className="ide-settings-form mmss-form-grid">
            <label className="mmss-field mmss-field--wide">
              <span>Skill Tree Goal</span>
              <textarea value={skillTreeGoal} onChange={(event) => setSkillTreeGoal(event.target.value)} rows={4} />
              <FieldHint>Defines what kind of skill graph the async designer should build.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--operator">
              <span>Owner Scope</span>
              <input type="text" value={skillTreeOwnerScope} onChange={(event) => setSkillTreeOwnerScope(event.target.value)} />
              <FieldHint>Runtime namespace for related jobs, results, and execution traces.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--wide">
              <span>Context Hint</span>
              <textarea value={skillTreeContextHint} onChange={(event) => setSkillTreeContextHint(event.target.value)} rows={4} />
              <FieldHint>Extra guidance about evidence policy, output shape, and operator focus.</FieldHint>
            </label>
            </div>
          </div>

          <div className="ide-workspace-action-row mmss-action-strip">
            <button className="mmss-action-button mmss-action-button--accent" onClick={handleStartDesignJob} disabled={runningDesignJob || !skillTreeGoal.trim() || !activeSourceScopes.length} title={ACTION_SHORTCUTS.startDesignJob}>
              {runningDesignJob ? <LoaderCircle size={14} className="spin" /> : <Play size={14} />}
              {t("localRagRef.actions.startDesignJob.label", { defaultValue: "Запустить Skill Tree Design Job" })}
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={handleRefreshDesignJob} disabled={!designJob?.jobId} title={ACTION_SHORTCUTS.refreshDesignJob}>
              <RefreshCcw size={14} />
              {t("localRagRef.actions.refreshDesignJob.label", { defaultValue: "Обновить Design Job" })}
            </button>
            <button className="mmss-action-button mmss-action-button--danger" onClick={handleCancelDesignJob} disabled={!designJob?.jobId || designJob?.status !== "running"} title={ACTION_SHORTCUTS.cancelDesignJob}>
              <Square size={14} />
              {t("localRagRef.actions.cancelDesignJob.label", { defaultValue: "Отменить Design Job" })}
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

          <div className="ase-config-card">
            <strong>MMSS Custom Instructions</strong>
            <p style={{ marginTop: 8 }}>
              Manual instructions for Flowmusic are stored in <code>mmss_custom_instructions</code> and can later be vectorized as a separate RAG source.
            </p>
          </div>

          <div className="ase-config-card mmss-section-card mmss-section-card--instruction">
            <strong>Instruction Capture</strong>
            <span>Manual Flowmusic inputs become a dedicated MMSS source once saved and vectorized.</span>
            <div className="ide-settings-form mmss-form-grid">
            <label className="mmss-field mmss-field--instruction">
              <span>Instruction Title</span>
              <input type="text" value={instructionTitle} onChange={(event) => setInstructionTitle(event.target.value)} placeholder="Optional title" />
              <FieldHint>Short label used in lists and manual curation passes.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--instruction">
              <span>Instruction Category</span>
              <input type="text" value={instructionCategory} onChange={(event) => setInstructionCategory(event.target.value)} />
              <FieldHint>Usually aligned to the current mode or prompt family.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--instruction">
              <span>Source Label</span>
              <input type="text" value={instructionSourceLabel} onChange={(event) => setInstructionSourceLabel(event.target.value)} />
              <FieldHint>Use labels like manual, preset_quick, preset_deep, imported, or test.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--wide">
              <span>Instruction Text</span>
              <textarea value={instructionText} onChange={(event) => setInstructionText(event.target.value)} rows={8} placeholder="Paste manual instruction text here..." />
              <FieldHint>Keep the exact wording you use in Flowmusic when it matters for reproducibility.</FieldHint>
            </label>
            </div>
          </div>

          <div className="ide-workspace-action-row mmss-action-strip">
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleSaveInstruction} disabled={savingInstruction || !instructionText.trim()}>
              {savingInstruction ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
              Save Custom Instruction
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={() => void loadCustomInstructions(database)}>
              <RefreshCcw size={14} />
              Refresh Instructions
            </button>
          </div>

          <details className="ase-config-card" open={false}>
            <summary className="mmss-accordion-summary">
              <strong>{t("localRagRef.instructions.recentTitle", { defaultValue: "Recent Custom Instructions / Последние инструкции" })}</strong>
              <span>{t("localRagRef.instructions.recentSummary", { defaultValue: `Показать ${Math.min(customInstructions.length, 8)} последних записей. / Show the latest ${Math.min(customInstructions.length, 8)} items.` })}</span>
            </summary>
            <pre className="ase-stream-preview">
              {customInstructions.length
                ? JSON.stringify(customInstructions.slice(0, 8), null, 2)
                : t("localRagRef.instructions.empty", { defaultValue: "Пока нет сохраненных инструкций. / No custom instructions saved yet." })}
            </pre>
          </details>

          <div className="ase-config-card mmss-section-card mmss-section-card--generation">
            <strong>Answer and Retrieval Mode</strong>
            <span>Choose the mode, then use Quick or Deep presets to fill the whole workbench.</span>
            <div className="ide-settings-form mmss-form-grid">
            <label className="mmss-field mmss-field--generation">
              <span>Answer Model</span>
              <select value={model} onChange={(event) => setModel(event.target.value)}>
                {MODEL_OPTIONS.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
              <FieldHint>{t("localRagRef.model.hint", { defaultValue: "Для JSON-модели backend принудительно включает think=false и format=json. / For the JSON model, the backend forces think=false and format=json." })}</FieldHint>
            </label>
            <label className="mmss-field mmss-field--generation">
              <span>Mode</span>
              <select value={mode} onChange={(event) => handleModeSelect(event.target.value)}>
                {MODE_OPTIONS.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
              <FieldHint>Switches the reasoning template while staying on the same archive.</FieldHint>
            </label>
            <label className="mmss-field mmss-field--operator" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                checked={includeRelationLayer}
                onChange={(event) => setIncludeRelationLayer(event.target.checked)}
              />
              <span>Include relation layer</span>
              <FieldHint>Pulls relation-heavy links and secondary traces into the context bundle.</FieldHint>
            </label>
            </div>
          </div>

          <div className="ide-workspace-action-row mmss-action-strip">
            <button className="mmss-action-button mmss-action-button--primary" onClick={handleSearch} disabled={runningSearch || !query.trim() || !activeSourceScopes.length} title="Ctrl/Cmd+Shift+S">
              {runningSearch ? <LoaderCircle size={14} className="spin" /> : <Search size={14} />}
              Smart Search
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={handleBuildContext} disabled={runningContext || !query.trim() || !activeSourceScopes.length} title="Ctrl/Cmd+Shift+B">
              {runningContext ? <LoaderCircle size={14} className="spin" /> : <Database size={14} />}
              Build Context
            </button>
            <button className="mmss-action-button mmss-action-button--accent" onClick={handleGenerateAnswer} disabled={runningAnswer || !query.trim() || !activeSourceScopes.length} title="Ctrl/Cmd+Enter">
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
        </div>
      );
    }

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
          actions={(
            <>
              <button
                className="mmss-action-button mmss-action-button--primary"
                onClick={handleSaveAlbumDraft}
                disabled={savingAlbumDraft || !answerResult}
              >
                {savingAlbumDraft ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />}
                Save Album Draft
              </button>
              <button
                className="mmss-action-button mmss-action-button--secondary"
                onClick={handleBuildAlbumFlowmusicPayload}
                disabled={buildingAlbumPayload || !answerResult}
              >
                {buildingAlbumPayload ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />}
                Build Flowmusic Album JSON
              </button>
            </>
          )}
          footer={(
            <>
              {albumDraftResult ? (
                <div className="ase-feedback-card" style={{ marginBottom: 12 }}>
                  <Save size={14} />
                  <p>
                    Album draft saved to <strong>mmss_albums</strong> and <strong>mmss_collection</strong>.
                    Album ID: <strong>{albumDraftResult?.album?.album_id || "n/a"}</strong>.
                  </p>
                </div>
              ) : null}
              {albumFlowmusicPreview ? (
                <pre className="ase-stream-preview local-rag-stream-preview" style={{ height: 320 }}>
                  {JSON.stringify(albumFlowmusicPreview, null, 2)}
                </pre>
              ) : null}
            </>
          )}
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
  };

  const updateResultTabColor = useCallback((tabNode, color) => {
    const component = tabNode.getComponent?.();
    if (!component) return;

    setRagTabColor(component, color);
    resultLayoutModel.doAction(
      Actions.updateNodeAttributes(tabNode.getId(), {
        config: {
          ...(tabNode.getConfig?.() || {}),
          tabColor: color,
        },
      }),
    );
    setResultLayoutModel(Model.fromJson(resultLayoutModel.toJson()));
  }, [resultLayoutModel, setRagTabColor]);

  return (
    <div className="ide-panel-shell ase-flex-panel local-rag-panel-shell">
      <div className="local-rag-results-workspace local-rag-results-workspace--full">
        <Layout
          factory={resultLayoutFactory}
          model={resultLayoutModel}
          onRenderTab={(node, renderValues) => {
            const tabColor = node.getConfig?.()?.tabColor
              || resolvedRagTabColors[node.getComponent?.()]
              || "#4aa0d9";
            const originalContent = renderValues.content || node.getName();

            renderValues.content = (
              <div
                className="ase-rag-tab-chip"
                style={{ "--ase-rag-inline-color": tabColor }}
              >
                {originalContent}
              </div>
            );

            renderValues.buttons.push(
              <input
                key={`${node.getId()}-color`}
                aria-label={`Color for ${node.getName()}`}
                className="ase-rag-tab-color-input"
                type="color"
                value={tabColor}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  event.stopPropagation();
                  updateResultTabColor(node, event.target.value);
                }}
              />,
            );
          }}
          onModelChange={(nextModel) => {
            setResultLayoutModel(nextModel);
            if (layoutWriteTimerRef.current) {
              window.clearTimeout(layoutWriteTimerRef.current);
            }
            layoutWriteTimerRef.current = window.setTimeout(() => {
              void appPersistenceService.setSetting(SETTINGS_SCOPE, RESULT_LAYOUT_SETTING_KEY, nextModel.toJson());
            }, LAYOUT_DEBOUNCE_MS);
          }}
        />
      </div>
    </div>
  );
}
