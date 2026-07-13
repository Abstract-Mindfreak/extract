import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Layout, Model } from "flexlayout-react";
import {
  Bot,
  Database,
  FileJson,
  Library,
  LoaderCircle,
  Play,
  Plus,
  RefreshCcw,
  Save,
  Sparkles,
  Trash2,
  Workflow,
} from "lucide-react";
import {
  FaClockRotateLeft,
  FaFolderOpen,
  FaPlay,
  FaRobot,
  FaScrewdriverWrench,
  FaSitemap,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import { useMMSSSkillsWorkspaceService } from "../../services/MMSSSkillsWorkspaceService";
import appPersistenceService from "../../services/AppPersistenceService";
import "./mmss-skills-panel.css";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
  { value: "legacy", label: "legacy (abstract_mind_db)" },
];
const MODEL_OPTIONS = ["mmss-qwen2.5-3b:latest", "mmss-gemma4-q4:latest", "mmss-qwen-2.5-3b:latest", "mmss-gemma4-q4", "gemma4:e2b", "quant-mmss:latest"];
const DEFAULT_GOAL = "Build reusable MMSS skills for retrieval, evidence synthesis, operator reasoning, and flowmusic-ready output design.";
const DEFAULT_RUN_QUERY = "Diagnose retrieval coverage, surface evidence gaps, and propose the next MMSS action path.";
const LAYOUT_SCOPE = "mmss_skills_workspace_ui";
const LAYOUT_SETTING_KEY = "layoutSnapshot";
const LAYOUT_SAVE_DEBOUNCE_MS = 500;

const SkillsWorkspaceContext = createContext(null);

function buildWorkspaceModel() {
  return Model.fromJson({
    global: {
      tabEnableClose: false,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [],
    layout: {
      type: "column",
      weight: 100,
      children: [
        {
          type: "row",
          weight: 68,
          children: [
            {
              type: "tabset",
              id: "skills-left",
              weight: 25,
              selected: 0,
              children: [
                { type: "tab", name: "Skills Library", component: "skills-library", enableClose: false, icon: "skills-library" },
              ],
            },
            {
              type: "tabset",
              id: "skills-center",
              weight: 43,
              selected: 0,
              children: [
                { type: "tab", name: "Skill Editor", component: "skill-editor", enableClose: false, icon: "skill-editor" },
                { type: "tab", name: "Skill Sets", component: "skill-sets", enableClose: false, icon: "skill-sets" },
                { type: "tab", name: "Skill Trees", component: "skill-trees", enableClose: false, icon: "skill-trees" },
              ],
            },
            {
              type: "tabset",
              id: "skills-right",
              weight: 32,
              selected: 0,
              children: [
                { type: "tab", name: "Generator", component: "skill-generator", enableClose: false, icon: "skill-generator" },
                { type: "tab", name: "Runner", component: "skill-runner", enableClose: false, icon: "skill-runner" },
              ],
            },
          ],
        },
        {
          type: "row",
          weight: 32,
          children: [
            {
              type: "tabset",
              id: "skills-bottom-left",
              weight: 50,
              selected: 0,
              children: [
                { type: "tab", name: "Run History", component: "run-history", enableClose: false, icon: "run-history" },
              ],
            },
            {
              type: "tabset",
              id: "skills-bottom-right",
              weight: 50,
              selected: 0,
              children: [
                { type: "tab", name: "Generation Log", component: "generation-log", enableClose: false, icon: "generation-log" },
              ],
            },
          ],
        },
      ],
    },
  });
}

function useSkillsWorkspace() {
  const value = useContext(SkillsWorkspaceContext);
  if (!value) {
    throw new Error("MMSSSkillsPanel context missing");
  }
  return value;
}

function asPrettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function resolveSkillsTabIcon(icon) {
  const common = { size: 14 };
  switch (icon) {
    case "skills-library":
      return <FaFolderOpen {...common} />;
    case "skill-editor":
      return <FaScrewdriverWrench {...common} />;
    case "skill-sets":
      return <FaScrewdriverWrench {...common} />;
    case "skill-trees":
      return <FaSitemap {...common} />;
    case "skill-generator":
      return <FaWandMagicSparkles {...common} />;
    case "skill-runner":
      return <FaPlay {...common} />;
    case "run-history":
      return <FaClockRotateLeft {...common} />;
    case "generation-log":
      return <FaRobot {...common} />;
    default:
      return <FaRobot {...common} />;
  }
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseJsonInput(text, fallback, label) {
  const source = String(text || "").trim();
  if (!source) return fallback;
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label}: invalid JSON. ${error?.message || error}`);
  }
}

function createEmptySkillDraft() {
  return {
    skill_id: "",
    name: "",
    description: "",
    inputsText: "",
    outputsText: "",
    tagsText: "",
    owner_scope: "skills_workspace",
    source: "manual",
    prompt_template: "",
  };
}

function createEmptySkillSetDraft() {
  return {
    skill_set_id: "",
    name: "",
    description: "",
    skillIdsText: "",
    owner_scope: "skills_workspace",
    flowText: "[]",
  };
}

function createEmptySkillTreeDraft() {
  return {
    tree_id: "",
    name: "",
    root_goal: "",
    version: "1",
    owner_scope: "skills_workspace",
    skillSetIdsText: "",
    crossLinksText: "[]",
    globalEntitiesText: "[]",
  };
}

function mapSkillToDraft(skill) {
  if (!skill) return createEmptySkillDraft();
  return {
    skill_id: skill.skill_id || "",
    name: skill.name || "",
    description: skill.description || "",
    inputsText: (skill.inputs || []).join(", "),
    outputsText: (skill.outputs || []).join(", "),
    tagsText: (skill.tags || []).join(", "),
    owner_scope: skill.owner_scope || "skills_workspace",
    source: skill.source || "manual",
    prompt_template: skill.prompt_template || "",
  };
}

function mapSkillSetToDraft(skillSet) {
  if (!skillSet) return createEmptySkillSetDraft();
  return {
    skill_set_id: skillSet.skill_set_id || "",
    name: skillSet.name || "",
    description: skillSet.description || "",
    skillIdsText: (skillSet.skill_ids || []).join(", "),
    owner_scope: skillSet.owner_scope || "skills_workspace",
    flowText: asPrettyJson(skillSet.flow || []),
  };
}

function mapSkillTreeToDraft(tree) {
  if (!tree) return createEmptySkillTreeDraft();
  return {
    tree_id: tree.tree_id || "",
    name: tree.name || "",
    root_goal: tree.root_goal || "",
    version: String(tree.version || "1"),
    owner_scope: tree.owner_scope || "skills_workspace",
    skillSetIdsText: (tree.skill_set_ids || []).join(", "),
    crossLinksText: asPrettyJson(tree.cross_links || []),
    globalEntitiesText: asPrettyJson(tree.global_entities || []),
  };
}

function normalizeMetricValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toFixed(2);
}

export default function MMSSSkillsPanel() {
  const service = useMMSSSkillsWorkspaceService();
  const [workspaceModel, setWorkspaceModel] = useState(() => buildWorkspaceModel());
  const layoutSaveTimerRef = useRef(null);
  const [database, setDatabase] = useState("abstract-mind-lab");
  const [health, setHealth] = useState(null);
  const [skills, setSkills] = useState([]);
  const [skillSets, setSkillSets] = useState([]);
  const [skillTrees, setSkillTrees] = useState([]);
  const [runs, setRuns] = useState([]);
  const [generations, setGenerations] = useState([]);
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedSkillSetId, setSelectedSkillSetId] = useState("");
  const [selectedTreeId, setSelectedTreeId] = useState("");
  const [skillSearch, setSkillSearch] = useState("");
  const [skillDraft, setSkillDraft] = useState(createEmptySkillDraft);
  const [skillSetDraft, setSkillSetDraft] = useState(createEmptySkillSetDraft);
  const [skillTreeDraft, setSkillTreeDraft] = useState(createEmptySkillTreeDraft);
  const [generatorGoal, setGeneratorGoal] = useState(DEFAULT_GOAL);
  const [generatorContextHint, setGeneratorContextHint] = useState("");
  const [generatorOwnerScope, setGeneratorOwnerScope] = useState("skills_workspace");
  const [generatorMaxSkills, setGeneratorMaxSkills] = useState(4);
  const [lastGeneration, setLastGeneration] = useState(null);
  const [selectedGeneratedIndexes, setSelectedGeneratedIndexes] = useState([]);
  const [runnerQuery, setRunnerQuery] = useState(DEFAULT_RUN_QUERY);
  const [runnerModel, setRunnerModel] = useState("mmss-qwen2.5-3b:latest");
  const [runnerInputsText, setRunnerInputsText] = useState("{}");
  const [lastExecution, setLastExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingSkill, setSavingSkill] = useState(false);
  const [savingSkillSet, setSavingSkillSet] = useState(false);
  const [savingSkillTree, setSavingSkillTree] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const selectedSkill = useMemo(
    () => skills.find((entry) => entry.skill_id === selectedSkillId) || null,
    [skills, selectedSkillId],
  );
  const selectedSkillSet = useMemo(
    () => skillSets.find((entry) => entry.skill_set_id === selectedSkillSetId) || null,
    [skillSets, selectedSkillSetId],
  );
  const selectedTree = useMemo(
    () => skillTrees.find((entry) => entry.tree_id === selectedTreeId) || null,
    [skillTrees, selectedTreeId],
  );

  const filteredSkills = useMemo(() => {
    const needle = skillSearch.trim().toLowerCase();
    if (!needle) return skills;
    return skills.filter((entry) =>
      [entry.name, entry.skill_id, entry.description, ...(entry.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [skillSearch, skills]);

  const reloadAll = useCallback(async (targetDatabase = database, silent = false) => {
    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [
        nextHealth,
        nextSkills,
        nextSkillSets,
        nextSkillTrees,
        nextRuns,
        nextGenerations,
      ] = await Promise.all([
        service.getRuntimeHealth(targetDatabase),
        service.listSkills(targetDatabase),
        service.listSkillSets(targetDatabase),
        service.listSkillTrees(targetDatabase),
        service.listSkillRuns(targetDatabase),
        service.listGenerations(targetDatabase),
      ]);

      setHealth(nextHealth);
      setSkills(nextSkills);
      setSkillSets(nextSkillSets);
      setSkillTrees(nextSkillTrees);
      setRuns(nextRuns);
      setGenerations(nextGenerations);
      setSelectedSkillId((current) => {
        if (current && nextSkills.some((entry) => entry.skill_id === current)) return current;
        return nextSkills[0]?.skill_id || "";
      });
      setSelectedSkillSetId((current) => {
        if (current && nextSkillSets.some((entry) => entry.skill_set_id === current)) return current;
        return nextSkillSets[0]?.skill_set_id || "";
      });
      setSelectedTreeId((current) => {
        if (current && nextSkillTrees.some((entry) => entry.tree_id === current)) return current;
        return nextSkillTrees[0]?.tree_id || "";
      });
      setError("");
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [database, service]);

  useEffect(() => {
    reloadAll(database);
  }, [database, reloadAll]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const savedLayout = await appPersistenceService.getSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, null);
      if (!mounted || !savedLayout) return;
      try {
        setWorkspaceModel(Model.fromJson(savedLayout));
      } catch (_error) {
        // Ignore broken saved layout and keep the default workspace usable.
      }
    })();

    return () => {
      mounted = false;
      if (layoutSaveTimerRef.current) {
        window.clearTimeout(layoutSaveTimerRef.current);
      }
    };
  }, []);

  const persistWorkspaceLayout = useCallback((nextModel) => {
    const nextJson = nextModel.toJson();
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }
    layoutSaveTimerRef.current = window.setTimeout(() => {
      void appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, nextJson);
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, []);

  const saveWorkspaceLayout = useCallback(() => {
    void appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, workspaceModel.toJson());
  }, [workspaceModel]);

  const resetWorkspaceLayout = useCallback(() => {
    const nextModel = buildWorkspaceModel();
    setWorkspaceModel(nextModel);
    void appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, nextModel.toJson());
  }, []);

  useEffect(() => {
    setSkillDraft(mapSkillToDraft(selectedSkill));
  }, [selectedSkill]);

  useEffect(() => {
    setSkillSetDraft(mapSkillSetToDraft(selectedSkillSet));
  }, [selectedSkillSet]);

  useEffect(() => {
    setSkillTreeDraft(mapSkillTreeToDraft(selectedTree));
  }, [selectedTree]);

  const createSkill = useCallback(() => {
    setSelectedSkillId("");
    setSkillDraft(createEmptySkillDraft());
  }, []);

  const createSkillSet = useCallback(() => {
    setSelectedSkillSetId("");
    setSkillSetDraft(createEmptySkillSetDraft());
  }, []);

  const createSkillTree = useCallback(() => {
    setSelectedTreeId("");
    setSkillTreeDraft(createEmptySkillTreeDraft());
  }, []);

  const saveSkill = useCallback(async () => {
    setSavingSkill(true);
    try {
      const payload = {
        database,
        skill_id: skillDraft.skill_id || undefined,
        name: skillDraft.name,
        description: skillDraft.description,
        inputs: splitCsv(skillDraft.inputsText),
        outputs: splitCsv(skillDraft.outputsText),
        tags: splitCsv(skillDraft.tagsText),
        owner_scope: skillDraft.owner_scope,
        source: skillDraft.source || "manual",
        prompt_template: skillDraft.prompt_template,
      };
      const saved = skillDraft.skill_id
        ? await service.updateSkill(skillDraft.skill_id, payload)
        : await service.createSkill(payload);
      setSelectedSkillId(saved.skill_id);
      await reloadAll(database, true);
      setError("");
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setSavingSkill(false);
    }
  }, [database, reloadAll, service, skillDraft]);

  const removeSkill = useCallback(async () => {
    if (!selectedSkillId) return;
    if (!window.confirm(`Delete skill ${selectedSkillId}?`)) return;
    try {
      await service.deleteSkill(database, selectedSkillId);
      setSelectedSkillId("");
      createSkill();
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    }
  }, [createSkill, database, reloadAll, selectedSkillId, service]);

  const saveSkillSet = useCallback(async () => {
    setSavingSkillSet(true);
    try {
      const payload = {
        database,
        skill_set_id: skillSetDraft.skill_set_id || undefined,
        name: skillSetDraft.name,
        description: skillSetDraft.description,
        skill_ids: splitCsv(skillSetDraft.skillIdsText),
        owner_scope: skillSetDraft.owner_scope,
        flow: parseJsonInput(skillSetDraft.flowText, [], "Skill set flow"),
      };
      const saved = skillSetDraft.skill_set_id
        ? await service.updateSkillSet(skillSetDraft.skill_set_id, payload)
        : await service.createSkillSet(payload);
      setSelectedSkillSetId(saved.skill_set_id);
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setSavingSkillSet(false);
    }
  }, [database, reloadAll, service, skillSetDraft]);

  const removeSkillSet = useCallback(async () => {
    if (!selectedSkillSetId) return;
    if (!window.confirm(`Delete skill set ${selectedSkillSetId}?`)) return;
    try {
      await service.deleteSkillSet(database, selectedSkillSetId);
      setSelectedSkillSetId("");
      createSkillSet();
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    }
  }, [createSkillSet, database, reloadAll, selectedSkillSetId, service]);

  const saveSkillTree = useCallback(async () => {
    setSavingSkillTree(true);
    try {
      const payload = {
        database,
        tree_id: skillTreeDraft.tree_id || undefined,
        name: skillTreeDraft.name,
        root_goal: skillTreeDraft.root_goal,
        version: skillTreeDraft.version,
        owner_scope: skillTreeDraft.owner_scope,
        skill_set_ids: splitCsv(skillTreeDraft.skillSetIdsText),
        cross_links: parseJsonInput(skillTreeDraft.crossLinksText, [], "Tree cross links"),
        global_entities: parseJsonInput(skillTreeDraft.globalEntitiesText, [], "Tree global entities"),
      };
      const saved = skillTreeDraft.tree_id
        ? await service.updateSkillTree(skillTreeDraft.tree_id, payload)
        : await service.createSkillTree(payload);
      setSelectedTreeId(saved.tree_id);
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setSavingSkillTree(false);
    }
  }, [database, reloadAll, service, skillTreeDraft]);

  const removeSkillTree = useCallback(async () => {
    if (!selectedTreeId) return;
    if (!window.confirm(`Delete skill tree ${selectedTreeId}?`)) return;
    try {
      await service.deleteSkillTree(database, selectedTreeId);
      setSelectedTreeId("");
      createSkillTree();
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    }
  }, [createSkillTree, database, reloadAll, selectedTreeId, service]);

  const generateSkills = useCallback(async () => {
    setGenerating(true);
    try {
      const payload = await service.generateSkills({
        database,
        goal: generatorGoal,
        context_hint: generatorContextHint,
        owner_scope: generatorOwnerScope,
        max_skills: generatorMaxSkills,
        model: runnerModel,
      });
      setLastGeneration(payload);
      setSelectedGeneratedIndexes((payload.proposed_skills || []).map((_entry, index) => index));
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setGenerating(false);
    }
  }, [
    database,
    generatorContextHint,
    generatorGoal,
    generatorMaxSkills,
    generatorOwnerScope,
    reloadAll,
    runnerModel,
    service,
  ]);

  const saveGenerated = useCallback(async () => {
    if (!lastGeneration?.proposed_skills?.length) return;
    try {
      const proposals = selectedGeneratedIndexes
        .map((index) => lastGeneration.proposed_skills[index])
        .filter(Boolean);
      await service.saveGeneratedSkills({
        database,
        owner_scope: generatorOwnerScope,
        proposals,
      });
      setLastGeneration(null);
      setSelectedGeneratedIndexes([]);
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    }
  }, [database, generatorOwnerScope, lastGeneration, reloadAll, selectedGeneratedIndexes, service]);

  const executeSelectedSkill = useCallback(async () => {
    const skillId = selectedSkillId || selectedSkill?.skill_id;
    if (!skillId) {
      setError("Select a skill before running execution.");
      return;
    }
    setExecuting(true);
    try {
      const payload = await service.executeSkill({
        database,
        skill_id: skillId,
        query: runnerQuery,
        model: runnerModel,
        inputs: parseJsonInput(runnerInputsText, {}, "Runner inputs"),
      });
      setLastExecution(payload);
      await reloadAll(database, true);
    } catch (nextError) {
      setError(nextError?.message || String(nextError));
    } finally {
      setExecuting(false);
    }
  }, [database, reloadAll, runnerInputsText, runnerModel, runnerQuery, selectedSkill, selectedSkillId, service]);

  const contextValue = useMemo(() => ({
    database,
    setDatabase,
    health,
    skills,
    skillSets,
    skillTrees,
    runs,
    generations,
    selectedSkillId,
    setSelectedSkillId,
    selectedSkillSetId,
    setSelectedSkillSetId,
    selectedTreeId,
    setSelectedTreeId,
    skillSearch,
    setSkillSearch,
    filteredSkills,
    selectedSkill,
    selectedSkillSet,
    selectedTree,
    skillDraft,
    setSkillDraft,
    skillSetDraft,
    setSkillSetDraft,
    skillTreeDraft,
    setSkillTreeDraft,
    createSkill,
    createSkillSet,
    createSkillTree,
    saveSkill,
    saveSkillSet,
    saveSkillTree,
    removeSkill,
    removeSkillSet,
    removeSkillTree,
    generatorGoal,
    setGeneratorGoal,
    generatorContextHint,
    setGeneratorContextHint,
    generatorOwnerScope,
    setGeneratorOwnerScope,
    generatorMaxSkills,
    setGeneratorMaxSkills,
    lastGeneration,
    selectedGeneratedIndexes,
    setSelectedGeneratedIndexes,
    generateSkills,
    saveGenerated,
    runnerQuery,
    setRunnerQuery,
    runnerModel,
    setRunnerModel,
    runnerInputsText,
    setRunnerInputsText,
    executeSelectedSkill,
    lastExecution,
    setLastExecution,
    loading,
    savingSkill,
    savingSkillSet,
    savingSkillTree,
    generating,
    executing,
    refreshing,
    error,
    setError,
    reloadAll,
    setWorkspaceModel,
  }), [
    createSkill,
    createSkillSet,
    createSkillTree,
    database,
    error,
    executeSelectedSkill,
    filteredSkills,
    generateSkills,
    generations,
    generatorContextHint,
    generatorGoal,
    generatorMaxSkills,
    generatorOwnerScope,
    health,
    lastExecution,
    lastGeneration,
    loading,
    refreshing,
    reloadAll,
    removeSkill,
    removeSkillSet,
    removeSkillTree,
    runnerInputsText,
    runnerModel,
    runnerQuery,
    runs,
    saveGenerated,
    saveSkill,
    saveSkillSet,
    saveSkillTree,
    savingSkill,
    savingSkillSet,
    savingSkillTree,
    selectedGeneratedIndexes,
    selectedSkill,
    selectedSkillId,
    selectedSkillSet,
    selectedSkillSetId,
    selectedTree,
    selectedTreeId,
    skillDraft,
    skillSearch,
    skillSetDraft,
    skillSets,
    skillTreeDraft,
    skillTrees,
    skills,
    generating,
    executing,
  ]);

  const factory = useCallback((node) => {
    const component = node.getComponent();
    if (component === "skills-library") return <SkillsLibraryTab />;
    if (component === "skill-editor") return <SkillEditorTab />;
    if (component === "skill-sets") return <SkillSetsTab />;
    if (component === "skill-trees") return <SkillTreesTab />;
    if (component === "skill-generator") return <SkillGeneratorTab />;
    if (component === "skill-runner") return <SkillRunnerTab />;
    if (component === "run-history") return <RunHistoryTab />;
    if (component === "generation-log") return <GenerationLogTab />;
    return <div className="ide-panel-shell">Unknown skills component: {component}</div>;
  }, []);

  return (
    <SkillsWorkspaceContext.Provider value={contextValue}>
      <div className="ide-panel-shell ase-flex-panel mmss-skills-panel">
        <div className="ide-panel-header">
          <div>
            <strong>Skills Workspace</strong>
            <span>Local LLM creates, stores, executes, and logs reusable MMSS skills on PostgreSQL.</span>
          </div>
          <div className="mmss-skills-toolbar">
            <label className="mmss-inline-field">
              <span>DB</span>
              <select value={database} onChange={(event) => setDatabase(event.target.value)}>
                {DATABASE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={() => reloadAll(database, true)} disabled={refreshing || loading}>
              {refreshing ? <LoaderCircle size={14} className="is-spinning" /> : <RefreshCcw size={14} />}
              Refresh
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={saveWorkspaceLayout}>
              <Save size={14} />
              Save Layout
            </button>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={resetWorkspaceLayout}>
              <RefreshCcw size={14} />
              Reset Layout
            </button>
          </div>
        </div>

        <div className="ide-workspace-summary-grid">
          <StatusCard label="Skills" value={String(health?.tables?.mmss_skills || skills.length)} />
          <StatusCard label="Skill Sets" value={String(health?.tables?.mmss_skill_sets || skillSets.length)} />
          <StatusCard label="Skill Trees" value={String(health?.tables?.mmss_skill_trees || skillTrees.length)} />
          <StatusCard label="Skill Runs" value={String(health?.tables?.mmss_skill_runs || runs.length)} />
          <StatusCard label="Generations" value={String(health?.tables?.mmss_generation_results || generations.length)} />
          <StatusCard label="Skill-RAG Vectors" value={health?.skill_rag_vectorization?.summary || "0/3 ready"} />
        </div>

        <div className="ase-feedback-card">
          <Bot size={14} />
          <p>
            Verified skill-RAG modes: <strong>mmss-qwen2.5-3b:latest</strong> (priority) and <strong>mmss-gemma4-q4:latest</strong> (fallback).
            Skill vectorization status: <strong>{health?.skill_rag_vectorization?.summary || "0/3 ready"}</strong>.
          </p>
        </div>

        {error ? (
          <div className="ase-config-card mmss-skills-error-card">
            <strong>Operation Error</strong>
            <pre className="ase-stream-preview">{error}</pre>
          </div>
        ) : null}

        <div className="mmss-skills-layout-shell">
          {loading ? (
            <div className="ide-empty-panel">
              <LoaderCircle size={16} className="is-spinning" />
              <span>Loading skills workspace...</span>
            </div>
          ) : (
            <Layout
              factory={factory}
              model={workspaceModel}
              onRenderTab={(node, renderValues) => {
                renderValues.leading = resolveSkillsTabIcon(node.getConfig()?.icon);
              }}
              onModelChange={(nextModel) => {
                setWorkspaceModel(nextModel);
                persistWorkspaceLayout(nextModel);
              }}
            />
          )}
        </div>
      </div>
    </SkillsWorkspaceContext.Provider>
  );
}

function StatusCard({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SkillsLibraryTab() {
  const {
    filteredSkills,
    selectedSkillId,
    setSelectedSkillId,
    skillSearch,
    setSkillSearch,
    createSkill,
  } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skills Library</strong>
          <span>Search and select reusable MMSS skills stored in PostgreSQL.</span>
        </div>
        <button className="mmss-action-button mmss-action-button--accent" onClick={createSkill}>
          <Plus size={14} />
          New Skill
        </button>
      </div>

      <div className="mmss-skills-filter-row">
        <input
          value={skillSearch}
          onChange={(event) => setSkillSearch(event.target.value)}
          placeholder="Search by name, id, description, tag..."
        />
      </div>

      <div className="mmss-skills-list">
        {filteredSkills.length ? filteredSkills.map((skill) => (
          <button
            key={skill.skill_id}
            type="button"
            className={`mmss-skills-list-item ${selectedSkillId === skill.skill_id ? "is-active" : ""}`}
            onClick={() => setSelectedSkillId(skill.skill_id)}
          >
            <div className="mmss-skills-list-heading">
              <span>{skill.name}</span>
              <small>{skill.source}</small>
            </div>
            <strong>{skill.skill_id}</strong>
            <p>{skill.description || "No description yet."}</p>
            <div className="mmss-skills-chip-row">
              {(skill.tags || []).slice(0, 5).map((tag) => (
                <span key={tag} className="mmss-skill-chip">
                  {tag}
                </span>
              ))}
            </div>
          </button>
        )) : (
          <div className="ide-empty-panel">
            <Library size={14} />
            <span>No skills found.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillEditorTab() {
  const {
    selectedSkill,
    skillDraft,
    setSkillDraft,
    saveSkill,
    removeSkill,
    savingSkill,
    createSkill,
  } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skill Editor</strong>
          <span>{selectedSkill ? `Editing ${selectedSkill.skill_id}` : "Create or edit a reusable MMSS skill."}</span>
        </div>
        <div className="ide-workspace-action-row">
          <button className="mmss-action-button mmss-action-button--secondary" onClick={createSkill}>
            <Plus size={14} />
            Blank
          </button>
          <button className="mmss-action-button mmss-action-button--secondary" onClick={removeSkill} disabled={!selectedSkill}>
            <Trash2 size={14} />
            Delete
          </button>
          <button className="mmss-action-button mmss-action-button--accent" onClick={saveSkill} disabled={savingSkill || !skillDraft.name.trim()}>
            {savingSkill ? <LoaderCircle size={14} className="is-spinning" /> : <Save size={14} />}
            Save
          </button>
        </div>
      </div>

      <div className="mmss-skills-form-grid">
        <label>
          <span>Skill ID</span>
          <input value={skillDraft.skill_id} onChange={(event) => setSkillDraft((current) => ({ ...current, skill_id: event.target.value }))} placeholder="auto-generated if empty" />
        </label>
        <label>
          <span>Name</span>
          <input value={skillDraft.name} onChange={(event) => setSkillDraft((current) => ({ ...current, name: event.target.value }))} />
        </label>
        <label>
          <span>Owner Scope</span>
          <input value={skillDraft.owner_scope} onChange={(event) => setSkillDraft((current) => ({ ...current, owner_scope: event.target.value }))} />
        </label>
        <label>
          <span>Source</span>
          <select value={skillDraft.source} onChange={(event) => setSkillDraft((current) => ({ ...current, source: event.target.value }))}>
            <option value="manual">manual</option>
            <option value="llm_generated">llm_generated</option>
            <option value="imported">imported</option>
          </select>
        </label>
        <label className="is-wide">
          <span>Description</span>
          <textarea rows={4} value={skillDraft.description} onChange={(event) => setSkillDraft((current) => ({ ...current, description: event.target.value }))} />
        </label>
        <label>
          <span>Inputs CSV</span>
          <input value={skillDraft.inputsText} onChange={(event) => setSkillDraft((current) => ({ ...current, inputsText: event.target.value }))} placeholder="query, context_hint" />
        </label>
        <label>
          <span>Outputs CSV</span>
          <input value={skillDraft.outputsText} onChange={(event) => setSkillDraft((current) => ({ ...current, outputsText: event.target.value }))} placeholder="answer, diagnosis" />
        </label>
        <label className="is-wide">
          <span>Tags CSV</span>
          <input value={skillDraft.tagsText} onChange={(event) => setSkillDraft((current) => ({ ...current, tagsText: event.target.value }))} placeholder="retrieval, synthesis, operator" />
        </label>
        <label className="is-wide">
          <span>Prompt Template</span>
          <textarea
            rows={10}
            value={skillDraft.prompt_template}
            onChange={(event) => setSkillDraft((current) => ({ ...current, prompt_template: event.target.value }))}
            placeholder={"Use {{query}} and optional named variables from runner inputs."}
          />
        </label>
      </div>
    </div>
  );
}

function SkillSetsTab() {
  const {
    skillSets,
    selectedSkillSetId,
    setSelectedSkillSetId,
    skillSetDraft,
    setSkillSetDraft,
    createSkillSet,
    saveSkillSet,
    removeSkillSet,
    savingSkillSet,
  } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skill Sets</strong>
          <span>Compose multiple skills into a reusable execution flow.</span>
        </div>
        <div className="ide-workspace-action-row">
          <button className="mmss-action-button mmss-action-button--secondary" onClick={createSkillSet}>
            <Plus size={14} />
            New Set
          </button>
          <button className="mmss-action-button mmss-action-button--secondary" onClick={removeSkillSet} disabled={!selectedSkillSetId}>
            <Trash2 size={14} />
            Delete
          </button>
          <button className="mmss-action-button mmss-action-button--accent" onClick={saveSkillSet} disabled={savingSkillSet || !skillSetDraft.name.trim()}>
            {savingSkillSet ? <LoaderCircle size={14} className="is-spinning" /> : <Save size={14} />}
            Save Set
          </button>
        </div>
      </div>

      <div className="mmss-skills-split-grid">
        <div className="mmss-skills-list">
          {skillSets.length ? skillSets.map((entry) => (
            <button
              key={entry.skill_set_id}
              type="button"
              className={`mmss-skills-list-item ${selectedSkillSetId === entry.skill_set_id ? "is-active" : ""}`}
              onClick={() => setSelectedSkillSetId(entry.skill_set_id)}
            >
              <div className="mmss-skills-list-heading">
                <span>{entry.name}</span>
                <small>{entry.owner_scope}</small>
              </div>
              <strong>{entry.skill_set_id}</strong>
              <p>{entry.description || "No description yet."}</p>
            </button>
          )) : (
            <div className="ide-empty-panel">
              <Workflow size={14} />
              <span>No skill sets yet.</span>
            </div>
          )}
        </div>

        <div className="mmss-skills-form-grid">
          <label>
            <span>Skill Set ID</span>
            <input value={skillSetDraft.skill_set_id} onChange={(event) => setSkillSetDraft((current) => ({ ...current, skill_set_id: event.target.value }))} placeholder="auto-generated if empty" />
          </label>
          <label>
            <span>Name</span>
            <input value={skillSetDraft.name} onChange={(event) => setSkillSetDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="is-wide">
            <span>Description</span>
            <textarea rows={4} value={skillSetDraft.description} onChange={(event) => setSkillSetDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          <label>
            <span>Owner Scope</span>
            <input value={skillSetDraft.owner_scope} onChange={(event) => setSkillSetDraft((current) => ({ ...current, owner_scope: event.target.value }))} />
          </label>
          <label className="is-wide">
            <span>Skill IDs CSV</span>
            <input value={skillSetDraft.skillIdsText} onChange={(event) => setSkillSetDraft((current) => ({ ...current, skillIdsText: event.target.value }))} placeholder="skill_a, skill_b, skill_c" />
          </label>
          <label className="is-wide">
            <span>Flow JSON</span>
            <textarea rows={10} value={skillSetDraft.flowText} onChange={(event) => setSkillSetDraft((current) => ({ ...current, flowText: event.target.value }))} />
          </label>
        </div>
      </div>
    </div>
  );
}

function SkillTreesTab() {
  const {
    skillTrees,
    selectedTreeId,
    setSelectedTreeId,
    skillTreeDraft,
    setSkillTreeDraft,
    createSkillTree,
    saveSkillTree,
    removeSkillTree,
    savingSkillTree,
  } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skill Trees</strong>
          <span>Persist higher-level MMSS runtime trees that reference skill sets.</span>
        </div>
        <div className="ide-workspace-action-row">
          <button className="mmss-action-button mmss-action-button--secondary" onClick={createSkillTree}>
            <Plus size={14} />
            New Tree
          </button>
          <button className="mmss-action-button mmss-action-button--secondary" onClick={removeSkillTree} disabled={!selectedTreeId}>
            <Trash2 size={14} />
            Delete
          </button>
          <button className="mmss-action-button mmss-action-button--accent" onClick={saveSkillTree} disabled={savingSkillTree || !skillTreeDraft.name.trim()}>
            {savingSkillTree ? <LoaderCircle size={14} className="is-spinning" /> : <Save size={14} />}
            Save Tree
          </button>
        </div>
      </div>

      <div className="mmss-skills-split-grid">
        <div className="mmss-skills-list">
          {skillTrees.length ? skillTrees.map((entry) => (
            <button
              key={entry.tree_id}
              type="button"
              className={`mmss-skills-list-item ${selectedTreeId === entry.tree_id ? "is-active" : ""}`}
              onClick={() => setSelectedTreeId(entry.tree_id)}
            >
              <div className="mmss-skills-list-heading">
                <span>{entry.name}</span>
                <small>v{entry.version}</small>
              </div>
              <strong>{entry.tree_id}</strong>
              <p>{entry.root_goal || "No root goal yet."}</p>
            </button>
          )) : (
            <div className="ide-empty-panel">
              <Database size={14} />
              <span>No skill trees yet.</span>
            </div>
          )}
        </div>

        <div className="mmss-skills-form-grid">
          <label>
            <span>Tree ID</span>
            <input value={skillTreeDraft.tree_id} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, tree_id: event.target.value }))} placeholder="auto-generated if empty" />
          </label>
          <label>
            <span>Name</span>
            <input value={skillTreeDraft.name} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label>
            <span>Version</span>
            <input value={skillTreeDraft.version} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, version: event.target.value }))} />
          </label>
          <label>
            <span>Owner Scope</span>
            <input value={skillTreeDraft.owner_scope} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, owner_scope: event.target.value }))} />
          </label>
          <label className="is-wide">
            <span>Root Goal</span>
            <textarea rows={4} value={skillTreeDraft.root_goal} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, root_goal: event.target.value }))} />
          </label>
          <label className="is-wide">
            <span>Skill Set IDs CSV</span>
            <input value={skillTreeDraft.skillSetIdsText} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, skillSetIdsText: event.target.value }))} placeholder="set_a, set_b" />
          </label>
          <label className="is-wide">
            <span>Cross Links JSON</span>
            <textarea rows={8} value={skillTreeDraft.crossLinksText} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, crossLinksText: event.target.value }))} />
          </label>
          <label className="is-wide">
            <span>Global Entities JSON</span>
            <textarea rows={8} value={skillTreeDraft.globalEntitiesText} onChange={(event) => setSkillTreeDraft((current) => ({ ...current, globalEntitiesText: event.target.value }))} />
          </label>
        </div>
      </div>
    </div>
  );
}

function SkillGeneratorTab() {
  const {
    generatorGoal,
    setGeneratorGoal,
    generatorContextHint,
    setGeneratorContextHint,
    generatorOwnerScope,
    setGeneratorOwnerScope,
    generatorMaxSkills,
    setGeneratorMaxSkills,
    lastGeneration,
    selectedGeneratedIndexes,
    setSelectedGeneratedIndexes,
    generateSkills,
    saveGenerated,
    generating,
  } = useSkillsWorkspace();

  const toggleGenerated = (index) => {
    setSelectedGeneratedIndexes((current) =>
      current.includes(index)
        ? current.filter((entry) => entry !== index)
        : [...current, index].sort((left, right) => left - right),
    );
  };

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skill Generator</strong>
          <span>Use Local LLM RAG to propose MMSS skills for a concrete goal.</span>
        </div>
        <button className="mmss-action-button mmss-action-button--accent" onClick={generateSkills} disabled={generating || !generatorGoal.trim()}>
          {generating ? <LoaderCircle size={14} className="is-spinning" /> : <Sparkles size={14} />}
          Generate
        </button>
      </div>

      <div className="mmss-skills-form-grid">
        <label className="is-wide">
          <span>Goal</span>
          <textarea rows={4} value={generatorGoal} onChange={(event) => setGeneratorGoal(event.target.value)} />
        </label>
        <label className="is-wide">
          <span>Context Hint</span>
          <textarea rows={4} value={generatorContextHint} onChange={(event) => setGeneratorContextHint(event.target.value)} />
        </label>
        <label>
          <span>Owner Scope</span>
          <input value={generatorOwnerScope} onChange={(event) => setGeneratorOwnerScope(event.target.value)} />
        </label>
        <label>
          <span>Max Skills</span>
          <input type="number" min="1" max="8" value={generatorMaxSkills} onChange={(event) => setGeneratorMaxSkills(Number(event.target.value) || 4)} />
        </label>
      </div>

      {lastGeneration ? (
        <div className="ase-config-card mmss-generation-card">
          <div className="mmss-skills-list-heading">
            <span>{lastGeneration.proposed_skills?.length || 0} proposed skill(s)</span>
            <small>{lastGeneration.took_ms} ms</small>
          </div>
          <pre className="ase-stream-preview">{asPrettyJson(lastGeneration.diagnosed_problem_space)}</pre>
          <div className="mmss-generated-list">
            {(lastGeneration.proposed_skills || []).map((proposal, index) => {
              const active = selectedGeneratedIndexes.includes(index);
              return (
                <button
                  key={`${proposal.name}-${index}`}
                  type="button"
                  className={`mmss-generated-card ${active ? "is-active" : ""}`}
                  onClick={() => toggleGenerated(index)}
                >
                  <div className="mmss-skills-list-heading">
                    <span>{proposal.name}</span>
                    <small>{active ? "selected" : "click to select"}</small>
                  </div>
                  <p>{proposal.description}</p>
                  <div className="mmss-skills-chip-row">
                    {(proposal.tags || []).map((tag) => (
                      <span key={tag} className="mmss-skill-chip">{tag}</span>
                    ))}
                  </div>
                  <pre className="ase-stream-preview">{proposal.prompt_template}</pre>
                </button>
              );
            })}
          </div>
          <div className="ide-workspace-action-row">
            <button className="mmss-action-button mmss-action-button--accent" onClick={saveGenerated} disabled={!selectedGeneratedIndexes.length}>
              <Save size={14} />
              Save Selected
            </button>
          </div>
        </div>
      ) : (
        <div className="ide-empty-panel">
          <Bot size={14} />
          <span>No generation result yet.</span>
        </div>
      )}
    </div>
  );
}

function SkillRunnerTab() {
  const {
    filteredSkills,
    selectedSkillId,
    setSelectedSkillId,
    selectedSkill,
    runnerQuery,
    setRunnerQuery,
    runnerModel,
    setRunnerModel,
    runnerInputsText,
    setRunnerInputsText,
    executeSelectedSkill,
    lastExecution,
    executing,
  } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Skill Runner</strong>
          <span>Execute one skill through Local LLM RAG and persist the run in PostgreSQL.</span>
        </div>
        <button className="mmss-action-button mmss-action-button--accent" onClick={executeSelectedSkill} disabled={executing || !selectedSkillId || !runnerQuery.trim()}>
          {executing ? <LoaderCircle size={14} className="is-spinning" /> : <Play size={14} />}
          Run Skill
        </button>
      </div>

      <div className="mmss-skills-form-grid">
        <label className="is-wide">
          <span>Skill</span>
          <select value={selectedSkillId} onChange={(event) => setSelectedSkillId(event.target.value)}>
            <option value="">Select skill...</option>
            {filteredSkills.map((skill) => (
              <option key={skill.skill_id} value={skill.skill_id}>
                {skill.name} ({skill.skill_id})
              </option>
            ))}
          </select>
        </label>
        {selectedSkill ? (
          <div className="ase-config-card is-wide">
            <strong>{selectedSkill.name}</strong>
            <span>{selectedSkill.description}</span>
            <pre className="ase-stream-preview">{selectedSkill.prompt_template || "No prompt template"}</pre>
          </div>
        ) : null}
        <label className="is-wide">
          <span>Query</span>
          <textarea rows={4} value={runnerQuery} onChange={(event) => setRunnerQuery(event.target.value)} />
        </label>
        <label>
          <span>Model</span>
          <select value={runnerModel} onChange={(event) => setRunnerModel(event.target.value)}>
            {MODEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>Named Inputs JSON</span>
          <textarea rows={6} value={runnerInputsText} onChange={(event) => setRunnerInputsText(event.target.value)} />
        </label>
      </div>

      {lastExecution ? (
        <div className="ase-config-card mmss-execution-card">
          <div className="mmss-skills-list-heading">
            <span>{lastExecution.skill?.name || lastExecution.run?.skill_id}</span>
            <small>{normalizeMetricValue(lastExecution.run?.quality_score)} quality</small>
          </div>
          <pre className="ase-stream-preview">{lastExecution.run?.answer || "No answer."}</pre>
          <pre className="ase-stream-preview">{asPrettyJson(lastExecution.debug || {})}</pre>
        </div>
      ) : null}
    </div>
  );
}

function RunHistoryTab() {
  const { runs } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Run History</strong>
          <span>Recent persisted skill executions.</span>
        </div>
      </div>
      <div className="mmss-skills-list">
        {runs.length ? runs.map((run) => (
          <div key={run.id} className="mmss-skills-list-item is-static">
            <div className="mmss-skills-list-heading">
              <span>{run.skill_id || "no-skill-id"}</span>
              <small>{run.mode}</small>
            </div>
            <strong>{run.created_at}</strong>
            <p>{run.query || "No query"}</p>
            <div className="mmss-skills-chip-row">
              <span className="mmss-skill-chip">q={normalizeMetricValue(run.quality_score)}</span>
              <span className="mmss-skill-chip">{run.duration_ms}ms</span>
              <span className="mmss-skill-chip">{run.context_switches} ctx</span>
            </div>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <Play size={14} />
            <span>No skill runs yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GenerationLogTab() {
  const { generations } = useSkillsWorkspace();

  return (
    <div className="ide-panel-shell ase-flex-panel mmss-skills-tab">
      <div className="ide-panel-header">
        <div>
          <strong>Generation Log</strong>
          <span>Latest MMSS generation results related to RAG, skills, and runtime design.</span>
        </div>
      </div>
      <div className="mmss-skills-list">
        {generations.length ? generations.map((entry) => (
          <div key={entry.id} className="mmss-skills-list-item is-static">
            <div className="mmss-skills-list-heading">
              <span>{entry.mode}</span>
              <small>{entry.model}</small>
            </div>
            <strong>{entry.created_at}</strong>
            <p>{entry.query}</p>
            <div className="mmss-skills-chip-row">
              <span className="mmss-skill-chip">{entry.metadata?.operation || "unknown-op"}</span>
              <span className="mmss-skill-chip">{entry.metadata?.origin || "unknown-origin"}</span>
            </div>
            <pre className="ase-stream-preview">{entry.answer}</pre>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <FileJson size={14} />
            <span>No generation results yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
