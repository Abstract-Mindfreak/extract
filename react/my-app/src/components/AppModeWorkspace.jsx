import { Actions, Layout, Model } from "flexlayout-react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  Database,
  ExternalLink,
  FileJson,
  FolderPlus,
  LayoutTemplate,
  RefreshCw,
  Rocket,
  Settings2,
  Sparkles,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import { useAppModeWorkspaceStore } from "../hooks/useAppModeWorkspaceStore";
import { useAseWorkspaceStore } from "../hooks/useAseWorkspaceStore";
import { useArchivesWorkspaceStore } from "../hooks/useArchivesWorkspaceStore";
import { useIdeWorkspaceStore } from "../hooks/useIdeWorkspaceStore";
import flexLayoutWorkspaceService, {
  detectScreenProfile,
  FLEX_WORKSPACE_OPTIONS,
  SCREEN_PROFILE_OPTIONS,
} from "../services/FlexLayoutWorkspaceService";
import "./PromptIdeWorkspace.css";
import "./AseIdeWorkspace.css";

const MODE_TAB_IDS = {
  prompt_library: "mode-prompt-library-tab",
  ase_console: "mode-ase-console-tab",
  archives: "mode-archives-tab",
  json_genesis: "mode-json-genesis-tab",
};

const LAYOUT_MANAGER_TAB = {
  id: "app-layout-manager-tab",
  type: "tab",
  name: "Layout Profiles",
  component: "layout-manager",
  enableClose: false,
  icon: "layout-manager",
};

function buildDefaultLayout() {
  return {
    global: {
      tabEnableClose: false,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      borderEnableAutoHide: true,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [
      {
        type: "border",
        location: "right",
        selected: 0,
        size: 360,
        children: [
          {
            id: "app-stream-feedback-tab",
            type: "tab",
            name: "Stream Feedback",
            component: "stream-feedback",
            enableClose: false,
            icon: "feedback",
          },
          {
            id: "app-stream-metrics-tab",
            type: "tab",
            name: "Stream Metrics",
            component: "stream-metrics",
            enableClose: false,
            icon: "metrics",
          },
          {
            id: "app-stream-json-tab",
            type: "tab",
            name: "Unified Preview",
            component: "stream-json",
            enableClose: false,
            icon: "json",
          },
          {
            id: "app-stream-actions-tab",
            type: "tab",
            name: "Stream Actions",
            component: "stream-actions",
            enableClose: false,
            icon: "actions",
          },
        ],
      },
      {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 230,
        children: [
          {
            id: "app-stream-logs-tab",
            type: "tab",
            name: "Recent Activity",
            component: "stream-logs",
            enableClose: false,
            icon: "logs",
          },
          {
            id: "app-services-tab",
            type: "tab",
            name: "Services",
            component: "services",
            enableClose: false,
            icon: "services",
          },
          LAYOUT_MANAGER_TAB,
        ],
      },
    ],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          id: "app-mode-tabset",
          weight: 100,
          selected: 1,
          children: [
            {
              id: MODE_TAB_IDS.prompt_library,
              type: "tab",
              name: "Prompt Library",
              component: "mode-prompt-library",
              enableClose: false,
              icon: "prompt",
            },
            {
              id: MODE_TAB_IDS.ase_console,
              type: "tab",
              name: "ASE Console",
              component: "mode-ase-console",
              enableClose: false,
              icon: "ase",
            },
            {
              id: MODE_TAB_IDS.archives,
              type: "tab",
              name: "Локальная медиатека",
              component: "mode-archives",
              enableClose: false,
              icon: "archives",
            },
            {
              id: MODE_TAB_IDS.json_genesis,
              type: "tab",
              name: "JSON Genesis",
              component: "mode-json-genesis",
              enableClose: false,
              icon: "genesis",
            },
          ],
        },
      ],
    },
  };
}

function ensureLayoutManagerTab(layoutJson) {
  const nextLayout = layoutJson || buildDefaultLayout();
  const bottomBorder = Array.isArray(nextLayout?.borders)
    ? nextLayout.borders.find((border) => border?.location === "bottom")
    : null;

  if (!bottomBorder) {
    nextLayout.borders = [
      ...(Array.isArray(nextLayout?.borders) ? nextLayout.borders : []),
      {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 230,
        children: [LAYOUT_MANAGER_TAB],
      },
    ];
    return nextLayout;
  }

  const exists = Array.isArray(bottomBorder.children)
    && bottomBorder.children.some((child) => child?.component === "layout-manager");

  if (!exists) {
    bottomBorder.children = [...(bottomBorder.children || []), LAYOUT_MANAGER_TAB];
  }

  return nextLayout;
}

export default function AppModeWorkspace(props) {
  const workspaceStore = useAppModeWorkspaceStore();
  const initialLegacySnapshot = useMemo(
    () => workspaceStore.layoutSnapshot,
    []
  );
  const [model, setModel] = useState(() =>
    Model.fromJson(ensureLayoutManagerTab(workspaceStore.layoutSnapshot || buildDefaultLayout()))
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateLayout = async () => {
      const resolved = await flexLayoutWorkspaceService.loadEffectiveLayout({
        workspaceId: "app_mode_workspace",
        fallbackLayout: buildDefaultLayout(),
        legacySnapshot: initialLegacySnapshot,
      });
      if (!cancelled && resolved?.layoutJson) {
        const nextLayout = ensureLayoutManagerTab(resolved.layoutJson);
        setModel(Model.fromJson(nextLayout));
        useAppModeWorkspaceStore.getState().setLayoutSnapshot(nextLayout);
      }
    };

    void hydrateLayout();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () =>
      flexLayoutWorkspaceService.subscribe((event) => {
        if (event.workspaceId !== "app_mode_workspace") return;

        if (event.type === "apply" && event.layoutJson) {
          const nextLayout = ensureLayoutManagerTab(event.layoutJson);
          setModel(Model.fromJson(nextLayout));
          useAppModeWorkspaceStore.getState().setLayoutSnapshot(nextLayout);
        }

        if (event.type === "reset") {
          const nextLayout = ensureLayoutManagerTab(buildDefaultLayout());
          setModel(Model.fromJson(nextLayout));
          useAppModeWorkspaceStore.getState().setLayoutSnapshot(nextLayout);
        }
      }),
    []
  );

  useEffect(() => {
    const tabId = MODE_TAB_IDS[props.activeTab];
    if (tabId && model.getNodeById(tabId)) {
      model.doAction(Actions.selectTab(tabId));
    }
  }, [model, props.activeTab]);

  const activityLogs = useMemo(
    () => (Array.isArray(props.activityLogs) ? [...props.activityLogs].slice(-40).reverse() : []),
    [props.activityLogs]
  );

  const factory = (node) => {
    const component = node.getComponent();

    if (component === "mode-prompt-library") {
      return props.renderPromptLibrary();
    }
    if (component === "mode-ase-console") {
      return props.renderAse();
    }
    if (component === "mode-archives") {
      return props.renderArchives();
    }
    if (component === "mode-json-genesis") {
      return props.renderJsonGenesis();
    }
    if (component === "stream-feedback") {
      return <StreamFeedbackPanel streamFeedback={props.streamFeedback} />;
    }
    if (component === "stream-metrics") {
      return <StreamMetricsPanel heroMetrics={props.heroMetrics} />;
    }
    if (component === "stream-json") {
      return (
        <StreamJsonPanel
          onQuickSave={props.onQuickSavePreview}
          streamPreviewText={props.streamPreviewText}
        />
      );
    }
    if (component === "stream-actions") {
      return (
        <StreamActionsPanel
          activeModeLabel={props.activeModeLabel}
          onCheckServiceStatus={props.onCheckServiceStatus}
          onExportPreview={props.onExportPreview}
          onOpenInJsonHero={props.onOpenInJsonHero}
          onPushPreviewToGenesis={props.onPushPreviewToGenesis}
          onQuickSavePreview={props.onQuickSavePreview}
          onSavePreviewFile={props.onSavePreviewFile}
          streamPreviewPayload={props.streamPreviewPayload}
        />
      );
    }
    if (component === "stream-logs") {
      return <StreamLogsPanel activityLogs={activityLogs} />;
    }
    if (component === "services") {
      return (
        <ServicesPanel
          onCheckServiceStatus={props.onCheckServiceStatus}
          serviceHealth={props.serviceHealth}
        />
      );
    }
    if (component === "layout-manager") {
      return <LayoutProfilesPanel activeTab={props.activeTab} />;
    }

    return <div className="ide-panel-shell">Unknown shell panel: {component}</div>;
  };

  return (
    <div className="prompt-ide-shell app-mode-workspace-shell flexlayout__theme_dark">
      <Layout
        factory={factory}
        model={model}
        onAction={(action) => {
          if (action.type === Actions.SELECT_TAB) {
            const nodeId = String(action.data.tabNode);
            const nextMode = Object.entries(MODE_TAB_IDS).find(([, value]) => value === nodeId)?.[0];
            if (nextMode && nextMode !== props.activeTab) {
              props.onSelectMode(nextMode);
            }
          }
          return action;
        }}
        onModelChange={(nextModel) => {
          const nextJson = ensureLayoutManagerTab(nextModel.toJson());
          workspaceStore.setLayoutSnapshot(nextJson);
          void flexLayoutWorkspaceService.persistAutoLayout({
            workspaceId: "app_mode_workspace",
            layoutJson: nextJson,
          });
        }}
        onRenderTab={(node, renderValues) => {
          renderValues.leading = resolveTabIcon(node.getConfig()?.icon);
        }}
        popoutClassName="prompt-ide-popout flexlayout__theme_dark"
        popoutURL="popout.html"
      />
    </div>
  );
}

function StreamFeedbackPanel({ streamFeedback }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Stream Feedback</strong>
          <span>Current guidance for the active workspace mode.</span>
        </div>
      </div>
      <div className="ase-feedback-card">
        <Sparkles size={14} />
        <p>{streamFeedback}</p>
      </div>
    </div>
  );
}

function StreamMetricsPanel({ heroMetrics }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Stream Metrics</strong>
          <span>Unified top-level metrics shared across all workspace modes.</span>
        </div>
      </div>
      <div className="ide-workspace-summary-grid">
        {heroMetrics.map((metric) => (
          <div key={metric.id} className="ide-workspace-metric-card">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreamJsonPanel({ onQuickSave, streamPreviewText }) {
  return (
    <div className="ide-panel-shell ase-flex-panel ase-json-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Unified Preview</strong>
          <span>Current shared preview payload for the selected mode.</span>
        </div>
        <button className="ui-action-btn ui-action-btn--library ui-action-btn--icon" onClick={onQuickSave}>
          <FolderPlus size={14} />
        </button>
      </div>
      <pre className="ase-stream-preview">{streamPreviewText}</pre>
    </div>
  );
}

function StreamActionsPanel({
  activeModeLabel,
  onCheckServiceStatus,
  onExportPreview,
  onOpenInJsonHero,
  onPushPreviewToGenesis,
  onQuickSavePreview,
  onSavePreviewFile,
  streamPreviewPayload,
}) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Stream Actions</strong>
          <span>Export, save, inspect, and forward the current preview payload.</span>
        </div>
      </div>
      <div className="ide-workspace-action-row">
        <button className="ui-action-btn ui-action-btn--export" onClick={() => onExportPreview(streamPreviewPayload, `${activeModeLabel}_preview`)}>
          <FileJson size={14} />
          Copy Preview
        </button>
        <button className="ui-action-btn ui-action-btn--neutral" onClick={() => onSavePreviewFile(streamPreviewPayload)}>
          <Archive size={14} />
          Save JSON
        </button>
        <button className="ui-action-btn ui-action-btn--library" onClick={onQuickSavePreview}>
          <FolderPlus size={14} />
          Quick Save
        </button>
        <button className="ui-action-btn ui-action-btn--open" onClick={() => onOpenInJsonHero(streamPreviewPayload, "Stream preview")}>
          <ExternalLink size={14} />
          Open in JSON Hero
        </button>
        <button className="ui-action-btn ui-action-btn--send" onClick={onPushPreviewToGenesis}>
          <Rocket size={14} />
          Send Preview
        </button>
        <button className="ui-action-btn ui-action-btn--open" onClick={onCheckServiceStatus}>
          <RefreshCw size={14} />
          Check Status
        </button>
      </div>
    </div>
  );
}

function StreamLogsPanel({ activityLogs }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Recent Activity</strong>
          <span>Latest logs from MMSS, ASE handoff, imports, and preview actions.</span>
        </div>
      </div>
      <div className="ide-terminal-log">
        {activityLogs.length ? (
          activityLogs.map((entry, index) => (
            <div className="ide-terminal-line" key={`${entry}-${index}`}>
              {entry}
            </div>
          ))
        ) : (
          <div className="ide-terminal-line is-empty">No activity yet.</div>
        )}
      </div>
    </div>
  );
}

function ServicesPanel({ onCheckServiceStatus, serviceHealth }) {
  const services = [
    { id: "database", name: "PostgreSQL", ...serviceHealth.database },
    { id: "mistral", name: "Mistral", ...serviceHealth.mistral },
    { id: "ollama", name: "Ollama", ...serviceHealth.ollama },
    { id: "agents", name: "Flowmusic Agents", ...serviceHealth.agents },
    { id: "jsonhero", name: "JSON Hero", ...serviceHealth.jsonhero },
  ];

  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Services</strong>
          <span>Shared backend and tool endpoints used by the workspace.</span>
        </div>
      </div>
      <div className="ase-service-list">
        {services.map((service) => (
          <div key={service.id} className={`ase-service-card ${service.online ? "is-online" : "is-offline"}`}>
            <strong>{service.name}</strong>
            <span>{service.label}</span>
            <small>{service.detail}</small>
          </div>
        ))}
      </div>
      <div className="ide-workspace-action-row">
        <button onClick={onCheckServiceStatus}>Check Status</button>
      </div>
    </div>
  );
}

function LayoutProfilesPanel({ activeTab }) {
  const appStore = useAppModeWorkspaceStore();
  const promptStore = useIdeWorkspaceStore();
  const aseStore = useAseWorkspaceStore();
  const archivesStore = useArchivesWorkspaceStore();
  const activeWorkspaceId = resolveWorkspaceIdByMode(activeTab);
  const [screenProfile, setScreenProfile] = useState(() => detectScreenProfile());
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId);
  const [presetName, setPresetName] = useState("manual");
  const [presets, setPresets] = useState([]);
  const [isBusy, setIsBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setWorkspaceId(activeWorkspaceId);
  }, [activeWorkspaceId]);

  const refreshPresets = async () => {
    const items = await flexLayoutWorkspaceService.listPresets();
    setPresets(items);
  };

  useEffect(() => {
    void refreshPresets();
  }, []);

  const workspaceStateMap = useMemo(
    () => ({
      app_mode_workspace: {
        layoutJson: appStore.layoutSnapshot,
        uiTheme: null,
        fontScale: null,
      },
      prompt_ide_workspace: {
        layoutJson: promptStore.layoutSnapshot,
        uiTheme: promptStore.uiTheme,
        fontScale: promptStore.fontScale,
      },
      ase_workspace: {
        layoutJson: aseStore.layoutSnapshot,
        uiTheme: aseStore.uiTheme,
        fontScale: aseStore.fontScale,
      },
      local_media_library: {
        layoutJson: archivesStore.layoutSnapshot,
        uiTheme: null,
        fontScale: null,
      },
    }),
    [
      appStore.layoutSnapshot,
      archivesStore.layoutSnapshot,
      aseStore.fontScale,
      aseStore.layoutSnapshot,
      aseStore.uiTheme,
      promptStore.fontScale,
      promptStore.layoutSnapshot,
      promptStore.uiTheme,
    ]
  );

  const presetOptions = useMemo(() => {
    const names = new Set();
    presets
      .filter((item) => item.workspaceId === workspaceId && item.screenProfile === screenProfile)
      .forEach((item) => names.add(item.presetName));
    names.add(presetName || "manual");
    return Array.from(names).sort((left, right) => left.localeCompare(right));
  }, [presetName, presets, screenProfile, workspaceId]);

  const saveCurrentWorkspace = async () => {
    const workspaceState = workspaceStateMap[workspaceId];
    if (!workspaceState?.layoutJson) {
      setStatus("Нет layout snapshot для выбранного workspace.");
      return;
    }
    setIsBusy(true);
    try {
      await flexLayoutWorkspaceService.savePreset({
        workspaceId,
        screenProfile,
        presetName,
        layoutJson: workspaceState.layoutJson,
        uiTheme: workspaceState.uiTheme,
        fontScale: workspaceState.fontScale,
      });
      await refreshPresets();
      setStatus(`Сохранен preset ${presetName} для ${resolveWorkspaceLabel(workspaceId)}.`);
    } catch (error) {
      setStatus(error?.message || "Не удалось сохранить preset.");
    } finally {
      setIsBusy(false);
    }
  };

  const saveAllWorkspaces = async () => {
    setIsBusy(true);
    try {
      for (const option of FLEX_WORKSPACE_OPTIONS) {
        const workspaceState = workspaceStateMap[option.value];
        if (!workspaceState?.layoutJson) continue;
        await flexLayoutWorkspaceService.savePreset({
          workspaceId: option.value,
          screenProfile,
          presetName,
          layoutJson: workspaceState.layoutJson,
          uiTheme: workspaceState.uiTheme,
          fontScale: workspaceState.fontScale,
        });
      }
      await refreshPresets();
      setStatus(`Сохранены все workspace-пресеты для профиля ${screenProfile}.`);
    } catch (error) {
      setStatus(error?.message || "Не удалось сохранить все workspace-пресеты.");
    } finally {
      setIsBusy(false);
    }
  };

  const applyCurrentWorkspace = async () => {
    setIsBusy(true);
    try {
      await flexLayoutWorkspaceService.applyPreset({
        workspaceId,
        screenProfile,
        presetName,
      });
      setStatus(`Применен preset ${presetName} для ${resolveWorkspaceLabel(workspaceId)}.`);
    } catch (error) {
      setStatus(error?.message || "Не удалось применить preset.");
    } finally {
      setIsBusy(false);
    }
  };

  const applyAllWorkspaces = async () => {
    setIsBusy(true);
    try {
      const results = await flexLayoutWorkspaceService.applyPresetToAll({
        workspaceIds: FLEX_WORKSPACE_OPTIONS.map((option) => option.value),
        screenProfile,
        presetName,
      });
      const appliedCount = results.filter((item) => item.ok).length;
      const failedCount = results.length - appliedCount;
      setStatus(`Применено: ${appliedCount}, пропущено: ${failedCount}.`);
    } catch (error) {
      setStatus(error?.message || "Не удалось применить presets для всех workspace.");
    } finally {
      setIsBusy(false);
    }
  };

  const resetAllWorkspaces = async () => {
    setIsBusy(true);
    try {
      await flexLayoutWorkspaceService.resetAllWorkspaces(
        FLEX_WORKSPACE_OPTIONS.map((option) => option.value)
      );
      await refreshPresets();
      setStatus("Все flexlayout-пресеты сброшены к базовой раскладке.");
    } catch (error) {
      setStatus(error?.message || "Не удалось сбросить presets.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Layout Profiles</strong>
          <span>Сохранение, применение и сброс flexlayout-состояний для всех ключевых workspace.</span>
        </div>
      </div>
      <div className="ide-settings-form">
        <label>
          <span>Screen Profile</span>
          <select value={screenProfile} onChange={(event) => setScreenProfile(event.target.value)}>
            {SCREEN_PROFILE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Workspace</span>
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
            {FLEX_WORKSPACE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Preset</span>
          <input
            list="layout-profile-presets"
            onChange={(event) => setPresetName(event.target.value || "manual")}
            placeholder="manual"
            type="text"
            value={presetName}
          />
          <datalist id="layout-profile-presets">
            {presetOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
        </label>
      </div>

      <div className="ide-workspace-summary-grid">
        <div className="ide-workspace-metric-card">
          <span>Current Mode</span>
          <strong>{resolveWorkspaceLabel(activeWorkspaceId)}</strong>
        </div>
        <div className="ide-workspace-metric-card">
          <span>Viewport</span>
          <strong>{detectScreenProfile()}</strong>
        </div>
        <div className="ide-workspace-metric-card">
          <span>Presets</span>
          <strong>{presets.length}</strong>
        </div>
      </div>

      <div className="ide-workspace-action-row">
        <button disabled={isBusy} onClick={saveCurrentWorkspace}>
          Save Current
        </button>
        <button disabled={isBusy} onClick={saveAllWorkspaces}>
          Save All
        </button>
        <button disabled={isBusy} onClick={applyCurrentWorkspace}>
          Apply Current
        </button>
        <button disabled={isBusy} onClick={applyAllWorkspaces}>
          Apply All
        </button>
        <button disabled={isBusy} onClick={resetAllWorkspaces}>
          Reset All
        </button>
      </div>

      <div className="ase-config-list">
        {presets.length ? (
          presets.slice(0, 16).map((preset) => (
            <div key={preset.id} className="ase-config-card">
              <strong>{resolveWorkspaceLabel(preset.workspaceId)}</strong>
              <span>{preset.presetName} / {preset.screenProfile}</span>
              <small>{preset.updatedAt || "no timestamp"}</small>
            </div>
          ))
        ) : (
          <div className="ide-empty-panel">
            <LayoutTemplate size={14} />
            <span>Сохраненные flexlayout-пресеты пока отсутствуют.</span>
          </div>
        )}
      </div>

      {status ? <div className="ase-feedback-card"><Sparkles size={14} /><p>{status}</p></div> : null}
    </div>
  );
}

function resolveWorkspaceIdByMode(activeTab) {
  if (activeTab === "prompt_library") return "prompt_ide_workspace";
  if (activeTab === "ase_console") return "ase_workspace";
  if (activeTab === "archives") return "local_media_library";
  return "app_mode_workspace";
}

function resolveWorkspaceLabel(workspaceId) {
  return (
    FLEX_WORKSPACE_OPTIONS.find((option) => option.value === workspaceId)?.label || workspaceId
  );
}

function resolveTabIcon(icon) {
  const common = { size: 14, strokeWidth: 2 };
  switch (icon) {
    case "prompt":
      return <Boxes {...common} />;
    case "ase":
      return <Workflow {...common} />;
    case "archives":
      return <Archive {...common} />;
    case "genesis":
      return <FileJson {...common} />;
    case "feedback":
      return <Sparkles {...common} />;
    case "metrics":
      return <Database {...common} />;
    case "json":
      return <FileJson {...common} />;
    case "actions":
      return <Rocket {...common} />;
    case "logs":
      return <TerminalSquare {...common} />;
    case "services":
      return <Settings2 {...common} />;
    case "layout-manager":
      return <LayoutTemplate {...common} />;
    default:
      return <Boxes {...common} />;
  }
}
