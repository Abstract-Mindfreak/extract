import {
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
  LoaderCircle,
  RefreshCcw,
  Save,
  Trash2,
} from "lucide-react";
import {
  FaClockRotateLeft,
  FaCompactDisc,
  FaFolderOpen,
  FaForwardStep,
  FaPlay,
  FaPlus,
  FaShuffle,
  FaSitemap,
  FaUpRightFromSquare,
  FaUpload,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import { useTrackStore } from "../../hooks/useTrackStore";
import appPersistenceService from "../../services/AppPersistenceService";
import { useMMSSThemeAlbumGroupsWorkspaceService } from "../../services/MMSSThemeAlbumGroupsWorkspaceService";
import "./mmss-theme-album-groups-panel.css";

const DATABASE_OPTIONS = [
  { value: "abstract-mind-lab", label: "abstract-mind-lab" },
];
const MODEL_OPTIONS = [
  "mmss-qwen2.5-3b:latest",
  "mmss-gemma4-q4:latest",
  "mmss-gemma4-mmss-json:latest",
];
const ALGORITHM_OPTIONS = [
  "thematic_mosaic",
  "publication_album",
  "genre_cluster",
  "mmss_system_cluster",
  "keyword_graph",
  "instruction_driven",
];
const LAYOUT_SCOPE = "mmss_theme_album_groups_workspace_ui";
const LAYOUT_SETTING_KEY = "layoutSnapshot";
const LAYOUT_SAVE_DEBOUNCE_MS = 500;

const WorkspaceContext = createContext(null);

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
          weight: 70,
          children: [
            {
              type: "tabset",
              id: "theme-groups-left",
              weight: 24,
              selected: 0,
              children: [
                { type: "tab", name: "Group Library", component: "group-library", enableClose: false, icon: "group-library" },
              ],
            },
            {
              type: "tabset",
              id: "theme-groups-center",
              weight: 42,
              selected: 0,
              children: [
                { type: "tab", name: "Group Editor", component: "group-editor", enableClose: false, icon: "group-editor" },
                { type: "tab", name: "Linked Tracks", component: "linked-tracks", enableClose: false, icon: "linked-tracks" },
              ],
            },
            {
              type: "tabset",
              id: "theme-groups-right",
              weight: 34,
              selected: 0,
              children: [
                { type: "tab", name: "Pipeline", component: "pipeline", enableClose: false, icon: "pipeline" },
                { type: "tab", name: "Candidates", component: "candidates", enableClose: false, icon: "candidates" },
                { type: "tab", name: "Preview Playlist", component: "preview", enableClose: false, icon: "preview" },
              ],
            },
          ],
        },
        {
          type: "row",
          weight: 30,
          children: [
            {
              type: "tabset",
              id: "theme-groups-bottom",
              weight: 100,
              selected: 0,
              children: [
                { type: "tab", name: "Pipeline Jobs", component: "jobs", enableClose: false, icon: "jobs" },
              ],
            },
          ],
        },
      ],
    },
  });
}

function resolveTabIcon(icon) {
  const common = { size: 14 };
  switch (icon) {
    case "group-library":
      return <FaFolderOpen {...common} />;
    case "group-editor":
      return <FaSitemap {...common} />;
    case "linked-tracks":
      return <FaCompactDisc {...common} />;
    case "pipeline":
      return <FaWandMagicSparkles {...common} />;
    case "candidates":
      return <FaShuffle {...common} />;
    case "preview":
      return <FaPlay {...common} />;
    case "jobs":
      return <FaClockRotateLeft {...common} />;
    default:
      return <FaFolderOpen {...common} />;
  }
}

function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("Theme album groups workspace context missing");
  }
  return value;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function createEmptyGroupDraft() {
  return {
    group_id: "",
    title: "",
    description: "",
    goal: "",
    direction: "",
    mmss_system: "",
    genre: "",
    keywordsText: "",
    instruction_text: "",
    target_track_count: 10,
    assembly_algorithm: "thematic_mosaic",
    auto_assign: true,
    confirm_with_llm: true,
    model: "mmss-qwen2.5-3b:latest",
  };
}

function mapGroupToDraft(group) {
  if (!group) return createEmptyGroupDraft();
  return {
    group_id: group.group_id || "",
    title: group.title || "",
    description: group.description || "",
    goal: group.goal || "",
    direction: group.direction || "",
    mmss_system: group.mmss_system || "",
    genre: group.genre || "",
    keywordsText: Array.isArray(group.keywords) ? group.keywords.join(", ") : "",
    instruction_text: group.instruction_text || "",
    target_track_count: Number(group.target_track_count || 10),
    assembly_algorithm: group.assembly_algorithm || "thematic_mosaic",
    auto_assign: Boolean(group.metadata?.auto_assign ?? true),
    confirm_with_llm: Boolean(group.metadata?.confirm_with_llm ?? true),
    model: group.metadata?.generation_model || "mmss-qwen2.5-3b:latest",
  };
}

function buildGroupPayload(database, draft) {
  return {
    database,
    group_id: draft.group_id || undefined,
    title: draft.title,
    description: draft.description,
    goal: draft.goal,
    direction: draft.direction,
    mmss_system: draft.mmss_system,
    genre: draft.genre,
    keywords: splitCsv(draft.keywordsText),
    instruction_text: draft.instruction_text,
    target_track_count: Number(draft.target_track_count || 10),
    assembly_algorithm: draft.assembly_algorithm,
    auto_assign: Boolean(draft.auto_assign),
    confirm_with_llm: Boolean(draft.confirm_with_llm),
    model: draft.model,
  };
}

function buildFlowmusicTrackUrl(track) {
  if (!track) return "";
  if (track.sourceUrl) return track.sourceUrl;
  if (track.sessionUrl) return track.sessionUrl;
  if (track.rawData?.source_url) return track.rawData.source_url;
  if (track.conversationId && track.id) {
    return `https://www.flowmusic.app/session/${track.conversationId}#song-${track.id}`;
  }
  return "";
}

function getCandidateLimit(targetCount) {
  const normalizedTarget = Math.max(1, Number(targetCount || 10));
  return Math.min(28, Math.max(normalizedTarget + 6, 12));
}

export default function MMSSThemeAlbumGroupsPanel() {
  const service = useMMSSThemeAlbumGroupsWorkspaceService();
  const [workspaceModel, setWorkspaceModel] = useState(() => buildWorkspaceModel());
  const layoutSaveTimerRef = useRef(null);
  const [database, setDatabase] = useState("abstract-mind-lab");
  const [groups, setGroups] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupDetails, setGroupDetails] = useState(null);
  const [groupDraft, setGroupDraft] = useState(createEmptyGroupDraft);
  const [freeformGoal, setFreeformGoal] = useState("Brutal album of 20 tracks for publication with MMSS-aware cohesion and strong archive evidence.");
  const [candidateResult, setCandidateResult] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [activeJob, setActiveJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const {
    currentTrack,
    incrementPlayCount,
    setCurrentTrack,
    tracks,
    loadTracks,
  } = useTrackStore();

  useEffect(() => {
    let mounted = true;
    async function loadSavedLayout() {
      const savedLayout = await appPersistenceService.getSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, null);
      if (!mounted || !savedLayout) return;
      try {
        setWorkspaceModel(Model.fromJson(savedLayout));
      } catch (_error) {
        // keep default layout
      }
    }
    loadSavedLayout();
    return () => {
      mounted = false;
    };
  }, []);

  const persistWorkspaceLayout = useCallback((nextModel) => {
    const nextJson = nextModel.toJson();
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }
    layoutSaveTimerRef.current = window.setTimeout(() => {
      appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, nextJson).catch(() => {});
    }, LAYOUT_SAVE_DEBOUNCE_MS);
  }, []);

  const saveWorkspaceLayout = useCallback(() => {
    return appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, workspaceModel.toJson());
  }, [workspaceModel]);

  const resetWorkspaceLayout = useCallback(() => {
    const nextModel = buildWorkspaceModel();
    setWorkspaceModel(nextModel);
    return appPersistenceService.setSetting(LAYOUT_SCOPE, LAYOUT_SETTING_KEY, nextModel.toJson());
  }, []);

  const loadWorkspace = useCallback(async (nextDatabase = database, preferredGroupId = "") => {
    setError("");
    const [nextGroups, nextJobs] = await Promise.all([
      service.listGroups(nextDatabase),
      service.listJobs(nextDatabase),
    ]);
    setGroups(nextGroups);
    setJobs(nextJobs);

    const fallbackGroupId = preferredGroupId || selectedGroupId || nextGroups[0]?.group_id || "";
    if (fallbackGroupId) {
      const details = await service.getGroup(nextDatabase, fallbackGroupId);
      setSelectedGroupId(fallbackGroupId);
      setGroupDetails(details);
      setGroupDraft(mapGroupToDraft(details.group));
    } else {
      setSelectedGroupId("");
      setGroupDetails(null);
      setGroupDraft(createEmptyGroupDraft());
    }
  }, [database, selectedGroupId, service]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      setLoading(true);
      try {
        if (!tracks.length) {
          await loadTracks();
        }
        if (!cancelled) {
          await loadWorkspace(database);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError.message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [database, loadTracks, loadWorkspace, tracks.length]);

  useEffect(() => () => {
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!activeJob?.job_id || !running) return undefined;
    const interval = window.setInterval(async () => {
      try {
        const nextJob = await service.getPipelineJob(activeJob.job_id);
        setActiveJob(nextJob);
        if (nextJob.status !== "running") {
          setRunning(false);
          await loadWorkspace(database, nextJob.group_id || selectedGroupId);
          if (nextJob.result?.validation) {
            setValidationResult(nextJob.result.validation);
          }
          if (nextJob.result?.candidates) {
            setCandidateResult({
              candidates: nextJob.result.candidates,
            });
          }
        }
      } catch (nextError) {
        setRunning(false);
        setError(nextError.message);
      }
    }, 2500);
    return () => window.clearInterval(interval);
  }, [activeJob, database, loadWorkspace, running, selectedGroupId, service]);

  const resolvedTracks = useMemo(() => {
    const index = new Map(tracks.map((track) => [String(track.id || ""), track]));
    return asArray(groupDetails?.links).map((link) => ({
      link,
      track: index.get(String(link.track_id || "")) || null,
    }));
  }, [groupDetails, tracks]);

  const trackIndex = useMemo(
    () => new Map(tracks.map((track) => [String(track.id || ""), track])),
    [tracks],
  );

  const playTrack = useCallback(async (track) => {
    if (!track?.audioUrl) return;
    setCurrentTrack(track);
    if (track.id) {
      await incrementPlayCount(track.id);
    }
  }, [incrementPlayCount, setCurrentTrack]);

  const openTrackSource = useCallback((track) => {
    const url = buildFlowmusicTrackUrl(track);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }, []);

  const contextValue = useMemo(() => ({
    activeJob,
    candidateResult,
    currentTrack,
    database,
    error,
    freeformGoal,
    groupDetails,
    groupDraft,
    groups,
    jobs,
    loading,
    openTrackSource,
    playTrack,
    refreshWorkspace: async () => {
      setRefreshing(true);
      try {
        await loadWorkspace(database, selectedGroupId);
      } finally {
        setRefreshing(false);
      }
    },
    resolvedTracks,
    running,
    saveWorkspaceLayout,
    resetWorkspaceLayout,
    selectedGroupId,
    setFreeformGoal,
    setGroupDraft,
    setSelectedGroupId,
    trackIndex,
    validationResult,
    service,
  }), [
    activeJob,
    candidateResult,
    currentTrack,
    database,
    error,
    freeformGoal,
    groupDetails,
    groupDraft,
    groups,
    jobs,
    loading,
    loadWorkspace,
    openTrackSource,
    playTrack,
    resolvedTracks,
    running,
    saveWorkspaceLayout,
    resetWorkspaceLayout,
    selectedGroupId,
    trackIndex,
    validationResult,
    service,
  ]);

  const handleSelectGroup = useCallback(async (groupId) => {
    try {
      const details = await service.getGroup(database, groupId);
      setSelectedGroupId(groupId);
      setGroupDetails(details);
      setGroupDraft(mapGroupToDraft(details.group));
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, service]);

  const handleSaveGroup = useCallback(async () => {
    try {
      const payload = buildGroupPayload(database, groupDraft);
      const saved = groupDraft.group_id
        ? await service.updateGroup(groupDraft.group_id, payload)
        : await service.createGroup(payload);
      await loadWorkspace(database, saved.group_id);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, groupDraft, loadWorkspace, service]);

  const handleDeleteGroup = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      await service.deleteGroup(database, selectedGroupId);
      setCandidateResult(null);
      setValidationResult(null);
      await loadWorkspace(database, "");
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, loadWorkspace, selectedGroupId, service]);

  const handleGenerateGroup = useCallback(async () => {
    try {
      setRunning(true);
      const payload = await service.generateGroup({
        ...buildGroupPayload(database, groupDraft),
        database,
        freeform_goal: freeformGoal,
      });
      await loadWorkspace(database, payload.group.group_id);
      setRunning(false);
    } catch (nextError) {
      setRunning(false);
      setError(nextError.message);
    }
  }, [database, freeformGoal, groupDraft, loadWorkspace, service]);

  const handleSearchCandidates = useCallback(async (overrideCount = null) => {
    try {
      const targetCount = overrideCount || Number(groupDraft.target_track_count || 10);
      const payload = await service.searchCandidates({
        ...buildGroupPayload(database, groupDraft),
        database,
        target_track_count: targetCount,
        max_candidates: getCandidateLimit(targetCount),
      });
      setCandidateResult(payload);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, groupDraft, service]);

  const handleValidateLinks = useCallback(async () => {
    if (!selectedGroupId) return;
    try {
      const payload = await service.validateLinks({
        database,
        group_id: selectedGroupId,
      });
      setValidationResult(payload);
      await loadWorkspace(database, selectedGroupId);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, loadWorkspace, selectedGroupId, service]);

  const handleRunPipeline = useCallback(async () => {
    try {
      setRunning(true);
      setError("");
      const payload = await service.startPipeline({
        ...buildGroupPayload(database, groupDraft),
        database,
        group_id: selectedGroupId || undefined,
        freeform_goal: freeformGoal,
        max_candidates: getCandidateLimit(groupDraft.target_track_count),
      });
      setActiveJob(payload);
    } catch (nextError) {
      setRunning(false);
      setError(nextError.message);
    }
  }, [database, freeformGoal, groupDraft, selectedGroupId, service]);

  const handleCancelJob = useCallback(async () => {
    if (!activeJob?.job_id) return;
    try {
      const payload = await service.cancelPipeline(database, activeJob.job_id);
      setActiveJob(payload);
      if (payload.status !== "running") {
        setRunning(false);
        await loadWorkspace(database, payload.group_id || selectedGroupId);
      }
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [activeJob, database, loadWorkspace, selectedGroupId, service]);

  const handleDeleteJob = useCallback(async (jobId) => {
    try {
      await service.deleteJob(database, jobId);
      if (activeJob?.job_id === jobId) {
        setActiveJob(null);
        setRunning(false);
      }
      await loadWorkspace(database, selectedGroupId);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [activeJob, database, loadWorkspace, selectedGroupId, service]);

  const handleClearJobs = useCallback(async (statuses) => {
    try {
      await service.clearJobs(database, statuses);
      if (activeJob?.status && statuses.includes(activeJob.status)) {
        setActiveJob(null);
        setRunning(false);
      }
      await loadWorkspace(database, selectedGroupId);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [activeJob, database, loadWorkspace, selectedGroupId, service]);

  const handleAssignCandidate = useCallback(async (candidate) => {
    const groupId = selectedGroupId || groupDraft.group_id;
    if (!groupId) {
      setError("Save or generate a group before assigning tracks.");
      return;
    }
    try {
      await service.addTrackToGroup(groupId, {
        database,
        track_id: candidate.track_id,
        position_index: groupDetails?.links?.length || 0,
        assignment_source: "manual",
        match_score: candidate.score,
        metadata: {
          matched_terms: candidate.matched_terms,
          source_tables: candidate.source_tables,
          snippet: candidate.snippet,
        },
      });
      await loadWorkspace(database, groupId);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, groupDetails, groupDraft.group_id, loadWorkspace, selectedGroupId, service]);

  const handleRemoveLinkedTrack = useCallback(async (trackId) => {
    if (!selectedGroupId) return;
    try {
      await service.deleteTrackFromGroup(database, selectedGroupId, trackId);
      await loadWorkspace(database, selectedGroupId);
    } catch (nextError) {
      setError(nextError.message);
    }
  }, [database, loadWorkspace, selectedGroupId, service]);

  const factory = useCallback((node) => {
    const component = node.getComponent();
    if (component === "group-library") return <GroupLibraryTab onSelectGroup={handleSelectGroup} />;
    if (component === "group-editor") return <GroupEditorTab onDeleteGroup={handleDeleteGroup} onGenerateGroup={handleGenerateGroup} onSaveGroup={handleSaveGroup} />;
    if (component === "linked-tracks") return <LinkedTracksTab onRemoveLinkedTrack={handleRemoveLinkedTrack} />;
    if (component === "pipeline") return <PipelineTab onCancelJob={handleCancelJob} onRunPipeline={handleRunPipeline} onSearchCandidates={handleSearchCandidates} onValidateLinks={handleValidateLinks} />;
    if (component === "candidates") return <CandidatesTab onAssignCandidate={handleAssignCandidate} onSearchTen={() => handleSearchCandidates(10)} onSearchCandidates={handleSearchCandidates} />;
    if (component === "preview") return <PreviewPlaylistTab />;
    if (component === "jobs") return <JobsTab onClearJobs={handleClearJobs} onDeleteJob={handleDeleteJob} onCancelJob={handleCancelJob} />;
    return <div className="ide-panel-shell">Unknown theme album groups tab: {component}</div>;
  }, [
    handleAssignCandidate,
    handleCancelJob,
    handleClearJobs,
    handleDeleteGroup,
    handleDeleteJob,
    handleGenerateGroup,
    handleRemoveLinkedTrack,
    handleRunPipeline,
    handleSaveGroup,
    handleSearchCandidates,
    handleSelectGroup,
    handleValidateLinks,
  ]);

  return (
    <WorkspaceContext.Provider value={contextValue}>
      <div className="ide-panel-shell ase-flex-panel mmss-theme-groups-panel">
        <div className="ide-panel-header">
          <div>
            <strong>Theme Album Groups</strong>
            <span>Group archive tracks into reusable MMSS-aware album folders with LLM search, validation, and preview playback.</span>
          </div>
          <div className="mmss-theme-groups-toolbar">
            <label className="mmss-inline-field">
              <span>DB</span>
              <select value={database} onChange={(event) => setDatabase(event.target.value)}>
                {DATABASE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button className="mmss-action-button mmss-action-button--secondary" onClick={contextValue.refreshWorkspace} disabled={refreshing || loading}>
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
          <MetricCard label="Groups" value={String(groups.length)} />
          <MetricCard label="Linked Tracks" value={String(resolvedTracks.length)} />
          <MetricCard label="Candidates" value={String(candidateResult?.candidates?.length || 0)} />
          <MetricCard label="Jobs" value={String(jobs.length)} />
          <MetricCard label="Validation" value={validationResult?.summary?.validation_status || groupDetails?.group?.validation_status || "unvalidated"} />
          <MetricCard label="Target" value={String(groupDraft.target_track_count || 0)} />
        </div>

        <div className="ase-feedback-card">
          <Bot size={14} />
          <p>
            Goal prompt: <strong>{freeformGoal || "n/a"}</strong>. Auto-assign is <strong>{groupDraft.auto_assign ? "on" : "off"}</strong>.
          </p>
        </div>

        {error ? (
          <div className="ase-config-card mmss-theme-groups-error-card">
            <strong>Operation Error</strong>
            <pre className="ase-stream-preview">{error}</pre>
          </div>
        ) : null}

        <div className="mmss-theme-groups-layout-shell">
          {loading ? (
            <div className="ide-empty-panel">
              <LoaderCircle size={16} className="is-spinning" />
              <span>Loading theme album groups workspace...</span>
            </div>
          ) : (
            <Layout
              factory={factory}
              model={workspaceModel}
              onRenderTab={(node, renderValues) => {
                renderValues.leading = resolveTabIcon(node.getConfig()?.icon);
              }}
              onModelChange={(nextModel) => {
                setWorkspaceModel(nextModel);
                persistWorkspaceLayout(nextModel);
              }}
            />
          )}
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="ide-workspace-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function GroupLibraryTab({ onSelectGroup }) {
  const { groups, selectedGroupId } = useWorkspace();
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Folders / Groups</strong>
        <small>{groups.length} item(s)</small>
      </div>
      <div className="mmss-theme-list">
        {groups.length ? groups.map((group) => (
          <button
            key={group.group_id}
            type="button"
            className={`mmss-theme-list-item${selectedGroupId === group.group_id ? " is-active" : ""}`}
            onClick={() => onSelectGroup(group.group_id)}
          >
            <div className="mmss-theme-list-heading">
              <span><FaFolderOpen /> {group.title || group.group_id}</span>
              <small>{group.validation_status}</small>
            </div>
            <p>{group.direction || group.goal || "No direction set yet."}</p>
            <div className="mmss-theme-chip-row">
              <span className="mmss-skill-chip">{group.assembly_algorithm}</span>
              <span className="mmss-skill-chip">{group.target_track_count} tracks</span>
              {group.genre ? <span className="mmss-skill-chip">{group.genre}</span> : null}
            </div>
          </button>
        )) : (
          <div className="ide-empty-panel">
            <FaFolderOpen size={16} />
            <span>No theme groups yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupEditorTab({ onDeleteGroup, onGenerateGroup, onSaveGroup }) {
  const { freeformGoal, groupDraft, setFreeformGoal, setGroupDraft } = useWorkspace();
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Group Definition</strong>
        <small>Theme, MMSS, genre, keywords, instruction, and target count.</small>
      </div>
      <div className="mmss-skills-form-grid">
        <label className="is-wide">
          <span>Freeform Goal</span>
          <textarea value={freeformGoal} onChange={(event) => setFreeformGoal(event.target.value)} rows={4} />
        </label>
        <label>
          <span>Title</span>
          <input value={groupDraft.title} onChange={(event) => setGroupDraft((current) => ({ ...current, title: event.target.value }))} />
        </label>
        <label>
          <span>Target Track Count</span>
          <input type="number" min="1" max="200" value={groupDraft.target_track_count} onChange={(event) => setGroupDraft((current) => ({ ...current, target_track_count: Number(event.target.value) || 10 }))} />
        </label>
        <label>
          <span>Direction</span>
          <input value={groupDraft.direction} onChange={(event) => setGroupDraft((current) => ({ ...current, direction: event.target.value }))} />
        </label>
        <label>
          <span>MMSS System</span>
          <input value={groupDraft.mmss_system} onChange={(event) => setGroupDraft((current) => ({ ...current, mmss_system: event.target.value }))} />
        </label>
        <label>
          <span>Genre</span>
          <input value={groupDraft.genre} onChange={(event) => setGroupDraft((current) => ({ ...current, genre: event.target.value }))} />
        </label>
        <label>
          <span>Model</span>
          <select value={groupDraft.model} onChange={(event) => setGroupDraft((current) => ({ ...current, model: event.target.value }))}>
            {MODEL_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>Description</span>
          <textarea value={groupDraft.description} onChange={(event) => setGroupDraft((current) => ({ ...current, description: event.target.value }))} rows={3} />
        </label>
        <label className="is-wide">
          <span>Goal</span>
          <textarea value={groupDraft.goal} onChange={(event) => setGroupDraft((current) => ({ ...current, goal: event.target.value }))} rows={3} />
        </label>
        <label className="is-wide">
          <span>Keywords</span>
          <input value={groupDraft.keywordsText} onChange={(event) => setGroupDraft((current) => ({ ...current, keywordsText: event.target.value }))} placeholder="brutal, industrial, ritual, pressure..." />
        </label>
        <label className="is-wide">
          <span>Instruction Text</span>
          <textarea value={groupDraft.instruction_text} onChange={(event) => setGroupDraft((current) => ({ ...current, instruction_text: event.target.value }))} rows={4} />
        </label>
        <label>
          <span>Assembly Algorithm</span>
          <select value={groupDraft.assembly_algorithm} onChange={(event) => setGroupDraft((current) => ({ ...current, assembly_algorithm: event.target.value }))}>
            {ALGORITHM_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>{entry}</option>
            ))}
          </select>
        </label>
        <label className="mmss-theme-checkbox">
          <input type="checkbox" checked={groupDraft.auto_assign} onChange={(event) => setGroupDraft((current) => ({ ...current, auto_assign: event.target.checked }))} />
          <span>Auto-assign group tracks</span>
        </label>
        <label className="mmss-theme-checkbox">
          <input type="checkbox" checked={groupDraft.confirm_with_llm} onChange={(event) => setGroupDraft((current) => ({ ...current, confirm_with_llm: event.target.checked }))} />
          <span>LLM confirms selection</span>
        </label>
      </div>
      <div className="ide-workspace-action-row">
        <button className="mmss-action-button mmss-action-button--primary" onClick={onSaveGroup}>
          <Save size={14} />
          Save Group
        </button>
        <button className="mmss-action-button mmss-action-button--accent" onClick={onGenerateGroup}>
          <FaWandMagicSparkles size={14} />
          Create Group via LLM
        </button>
        <button className="mmss-action-button mmss-action-button--danger" onClick={onDeleteGroup}>
          <Trash2 size={14} />
          Delete Group
        </button>
      </div>
    </div>
  );
}

function LinkedTracksTab({ onRemoveLinkedTrack }) {
  const { groupDetails, openTrackSource, playTrack, resolvedTracks } = useWorkspace();
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Linked Tracks</strong>
        <small>{groupDetails?.stats?.linked_count || 0} linked track(s)</small>
      </div>
      <div className="mmss-theme-list">
        {resolvedTracks.length ? resolvedTracks.map(({ link, track }) => (
          <div key={link.link_id || link.track_id} className="mmss-theme-list-item is-static">
            <div className="mmss-theme-list-heading">
              <span><FaCompactDisc /> {track?.title || link.track_id}</span>
              <small>{link.assignment_source}</small>
            </div>
            <p>{track?.soundPrompt || link.metadata?.snippet || "No preview text."}</p>
            <div className="mmss-theme-chip-row">
              <span className="mmss-skill-chip mmss-skill-chip--accent">album-linked</span>
              <span className="mmss-skill-chip">match {Number(link.match_score || 0).toFixed(2)}</span>
              <span className="mmss-skill-chip">validation {Number(link.validation_score || 0).toFixed(2)}</span>
              <span className="mmss-skill-chip">{track ? "resolved" : "unresolved"}</span>
            </div>
            <div className="ide-workspace-action-row">
              <button
                className="mmss-action-button mmss-action-button--secondary is-compact"
                onClick={() => track && playTrack(track)}
                disabled={!track?.audioUrl}
              >
                <FaPlay size={14} />
                Play
              </button>
              <button
                className="mmss-action-button mmss-action-button--secondary is-compact"
                onClick={() => openTrackSource(track)}
                disabled={!buildFlowmusicTrackUrl(track)}
              >
                <FaUpRightFromSquare size={14} />
                Flowmusic
              </button>
              <button className="mmss-action-button mmss-action-button--danger is-compact" onClick={() => onRemoveLinkedTrack(link.track_id)}>
                <Trash2 size={14} />
                Remove
              </button>
            </div>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <FaCompactDisc size={16} />
            <span>No linked tracks yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineTab({ onCancelJob, onRunPipeline, onSearchCandidates, onValidateLinks }) {
  const { activeJob, groupDraft, running } = useWorkspace();
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Pipeline Control</strong>
        <small>Run stepwise grouping and auto-assignment over archive evidence.</small>
      </div>
      <div className="mmss-theme-pipeline-card">
        <p>Use quick candidate search for manual curation or run the full pipeline to generate, search, assign, and validate automatically.</p>
        <div className="ide-workspace-action-row">
          <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onSearchCandidates(10)}>
            <FaShuffle size={14} />
            Find 10-track album
          </button>
          <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onSearchCandidates(groupDraft.target_track_count)}>
            <FaShuffle size={14} />
            Find {groupDraft.target_track_count}-track album
          </button>
          <button className="mmss-action-button mmss-action-button--accent" onClick={onRunPipeline} disabled={running}>
            {running ? <LoaderCircle size={14} className="is-spinning" /> : <FaUpload size={14} />}
            Run Pipeline
          </button>
          <button className="mmss-action-button mmss-action-button--primary" onClick={onValidateLinks}>
            <FaSitemap size={14} />
            Check Links
          </button>
          <button className="mmss-action-button mmss-action-button--danger" onClick={onCancelJob} disabled={!activeJob?.job_id || activeJob?.status !== "running"}>
            <Trash2 size={14} />
            Cancel Job
          </button>
        </div>
      </div>

      <div className="ase-config-card mmss-theme-pipeline-card">
        <strong>Current Job</strong>
        {activeJob ? (
          <div className="ide-workspace-summary-grid" style={{ marginTop: 12 }}>
            <MetricCard label="Job ID" value={activeJob.job_id} />
            <MetricCard label="Status" value={activeJob.status} />
            <MetricCard label="Stage" value={activeJob.stage || "n/a"} />
            <MetricCard label="Progress" value={`${activeJob.progress || 0}%`} />
          </div>
        ) : (
          <div className="ide-empty-panel">
            <FaClockRotateLeft size={16} />
            <span>No active job.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidatesTab({ onAssignCandidate, onSearchTen, onSearchCandidates }) {
  const { candidateResult, groupDraft, openTrackSource, playTrack, trackIndex } = useWorkspace();
  const candidates = candidateResult?.candidates || [];
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Candidate Tracks</strong>
        <small>{candidates.length} candidate(s)</small>
      </div>
      <div className="ide-workspace-action-row">
        <button className="mmss-action-button mmss-action-button--secondary" onClick={onSearchTen}>
          <FaShuffle size={14} />
          Search 10-track album
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onSearchCandidates(groupDraft.target_track_count)}>
          <FaShuffle size={14} />
          Search target count
        </button>
      </div>
      <div className="mmss-theme-list">
        {candidates.length ? candidates.map((candidate) => (
          <div key={candidate.track_id} className="mmss-theme-list-item is-static">
            <div className="mmss-theme-list-heading">
              <span><FaCompactDisc /> {candidate.title || candidate.track_id}</span>
              <small>score {Number(candidate.score || 0).toFixed(2)}</small>
            </div>
            <p>{candidate.snippet || "No snippet available."}</p>
            <div className="mmss-theme-chip-row">
              {candidate.matched_terms?.slice(0, 6).map((term) => (
                <span key={`${candidate.track_id}-${term}`} className="mmss-skill-chip">{term}</span>
              ))}
              {candidate.group_memberships?.slice(0, 3).map((membership) => (
                <span key={`${candidate.track_id}-${membership.group_id}`} className="mmss-skill-chip mmss-skill-chip--accent">
                  album: {membership.title}
                </span>
              ))}
            </div>
            <div className="ide-workspace-action-row">
              <button
                className="mmss-action-button mmss-action-button--secondary is-compact"
                onClick={() => playTrack(trackIndex.get(String(candidate.track_id || "")))}
                disabled={!trackIndex.get(String(candidate.track_id || ""))?.audioUrl}
              >
                <FaPlay size={14} />
                Play
              </button>
              <button
                className="mmss-action-button mmss-action-button--secondary is-compact"
                onClick={() => openTrackSource(trackIndex.get(String(candidate.track_id || "")))}
                disabled={!buildFlowmusicTrackUrl(trackIndex.get(String(candidate.track_id || "")))}
              >
                <FaUpRightFromSquare size={14} />
                Flowmusic
              </button>
              <button className="mmss-action-button mmss-action-button--primary is-compact" onClick={() => onAssignCandidate(candidate)}>
                <FaPlus size={14} />
                Assign
              </button>
            </div>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <FaShuffle size={16} />
            <span>No candidate search has been run yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewPlaylistTab() {
  const { currentTrack, openTrackSource, playTrack, resolvedTracks } = useWorkspace();
  const playableTracks = resolvedTracks.filter((entry) => entry.track?.audioUrl);
  const currentTrackId = String(currentTrack?.id || "");

  const playIndex = useCallback((index) => {
    const item = playableTracks[index];
    if (item?.track) {
      void playTrack(item.track);
    }
  }, [playTrack, playableTracks]);

  const currentIndex = playableTracks.findIndex((entry) => String(entry.track?.id || "") === currentTrackId);

  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Playlist Preview</strong>
        <small>{playableTracks.length} playable track(s)</small>
      </div>
      <div className="ide-workspace-action-row">
        <button className="mmss-action-button mmss-action-button--primary" onClick={() => playIndex(currentIndex >= 0 ? currentIndex : 0)} disabled={!playableTracks.length}>
          <FaPlay size={14} />
          {currentIndex >= 0 ? "Replay Current" : "Play"}
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => playIndex(currentIndex + 1 < playableTracks.length ? currentIndex + 1 : 0)} disabled={!playableTracks.length}>
          <FaForwardStep size={14} />
          Next
        </button>
      </div>
      <div className="mmss-theme-list">
        {playableTracks.length ? playableTracks.map(({ link, track }, index) => (
          <button
            key={link.link_id || track.id}
            type="button"
            className={`mmss-theme-list-item${String(currentTrackId || "") === String(track.id || "") ? " is-active" : ""}`}
            onClick={() => playIndex(index)}
          >
            <div className="mmss-theme-list-heading">
              <span><FaCompactDisc /> {track.title}</span>
              <small>{track.accountId || "archive"}</small>
            </div>
            <p>{track.soundPrompt || track.lyrics || "No prompt preview available."}</p>
            <div className="ide-workspace-action-row">
              <span className="mmss-skill-chip mmss-skill-chip--accent">album-linked</span>
              <button
                className="mmss-action-button mmss-action-button--secondary is-compact"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openTrackSource(track);
                }}
                disabled={!buildFlowmusicTrackUrl(track)}
              >
                <FaUpRightFromSquare size={14} />
                Flowmusic
              </button>
            </div>
          </button>
        )) : (
          <div className="ide-empty-panel">
            <FaPlay size={16} />
            <span>No resolved audio tracks linked to this group yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
// eslint-disable-next-line no-unused-vars
function JobsTabLegacy() {
  const { jobs } = useWorkspace();
  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Pipeline Jobs</strong>
        <small>{jobs.length} job(s)</small>
      </div>
      <div className="mmss-theme-list">
        {jobs.length ? jobs.map((job) => (
          <div key={job.job_id} className="mmss-theme-list-item is-static">
            <div className="mmss-theme-list-heading">
              <span><FaClockRotateLeft /> {job.job_id}</span>
              <small>{job.status}</small>
            </div>
            <p>{job.stage || "No stage"} • progress {job.progress || 0}%</p>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <FaClockRotateLeft size={16} />
            <span>No pipeline jobs recorded yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function JobsTab({ onClearJobs, onDeleteJob, onCancelJob }) {
  const { activeJob, jobs, refreshWorkspace } = useWorkspace();
  const [showCompleted, setShowCompleted] = useState(false);
  const visibleJobs = useMemo(
    () => jobs.filter((job) => showCompleted || job.status !== "completed"),
    [jobs, showCompleted],
  );

  return (
    <div className="mmss-theme-tab">
      <div className="mmss-theme-section-head">
        <strong>Pipeline Jobs</strong>
        <small>{visibleJobs.length} visible / {jobs.length} total</small>
      </div>
      <div className="ide-workspace-action-row">
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => setShowCompleted((current) => !current)}>
          <FaClockRotateLeft size={14} />
          {showCompleted ? "Hide Completed" : "Show Completed"}
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => refreshWorkspace()}>
          <RefreshCcw size={14} />
          Refresh Jobs
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onClearJobs(["completed"])}>
          <Trash2 size={14} />
          Clear Completed
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onClearJobs(["failed", "cancelled"])}>
          <Trash2 size={14} />
          Clear Failed/Cancelled
        </button>
        <button className="mmss-action-button mmss-action-button--secondary" onClick={() => onClearJobs(["completed", "failed", "cancelled"])}>
          <Trash2 size={14} />
          Clear Finished
        </button>
      </div>
      <div className="mmss-theme-list">
        {visibleJobs.length ? visibleJobs.map((job) => (
          <div key={job.job_id} className="mmss-theme-list-item is-static">
            <div className="mmss-theme-list-heading">
              <span><FaClockRotateLeft /> {job.job_id}</span>
              <small>{job.status}</small>
            </div>
            <p>{job.stage || "No stage"} • progress {job.progress || 0}%</p>
            <div className="ide-workspace-action-row">
              <span className="mmss-skill-chip">{job.group_id || "no-group"}</span>
              {job.status === "running" && activeJob?.job_id === job.job_id ? (
                <button className="mmss-action-button mmss-action-button--danger is-compact" onClick={onCancelJob}>
                  <Trash2 size={14} />
                  Cancel
                </button>
              ) : null}
              {job.status !== "running" ? (
                <button className="mmss-action-button mmss-action-button--secondary is-compact" onClick={() => onDeleteJob(job.job_id)}>
                  <Trash2 size={14} />
                  Delete
                </button>
              ) : null}
            </div>
          </div>
        )) : (
          <div className="ide-empty-panel">
            <FaClockRotateLeft size={16} />
            <span>No pipeline jobs recorded yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}
