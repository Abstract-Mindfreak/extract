import { Actions, Layout, Model } from "flexlayout-react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Boxes,
  Disc3,
  Database,
  ExternalLink,
  FileJson,
  FolderPlus,
  RefreshCw,
  Rocket,
  Settings2,
  Sparkles,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import { useAppModeWorkspaceStore } from "../hooks/useAppModeWorkspaceStore";
import PlayerBar from "./PlayerBar";
import "./PromptIdeWorkspace.css";
import "./AseIdeWorkspace.css";

const MODE_TAB_IDS = {
  prompt_library: "mode-prompt-library-tab",
  ase_console: "mode-ase-console-tab",
  archives: "mode-archives-tab",
  json_genesis: "mode-json-genesis-tab",
};
const PLAYER_TAB_ID = "mode-player-tab";

function buildPlayerTabNode() {
  return {
    id: PLAYER_TAB_ID,
    type: "tab",
    name: "Player",
    component: "player",
    enableClose: false,
    icon: "player",
  };
}

function ensurePlayerTabInLayout(layoutJson) {
  const nextLayout = JSON.parse(JSON.stringify(layoutJson || buildDefaultLayout()));
  const existingPlayerTab = JSON.stringify(nextLayout).includes(`"${PLAYER_TAB_ID}"`);
  if (existingPlayerTab) {
    return nextLayout;
  }
  const mainTabset = nextLayout?.layout?.children?.find((node) => node?.id === "app-mode-tabset");
  if (mainTabset && Array.isArray(mainTabset.children)) {
    mainTabset.children.push(buildPlayerTabNode());
  }
  const bottomBorder = nextLayout?.borders?.find((node) => node?.location === "bottom");
  if (bottomBorder?.children) {
    bottomBorder.children = bottomBorder.children.filter((child) => child?.id !== "app-player-tab");
  }
  return nextLayout;
}

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
              name: "Archives",
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
            buildPlayerTabNode(),
          ],
        },
      ],
    },
  };
}

export default function AppModeWorkspace(props) {
  const workspaceStore = useAppModeWorkspaceStore();
  const [model] = useState(() =>
    Model.fromJson(ensurePlayerTabInLayout(workspaceStore.layoutSnapshot || buildDefaultLayout()))
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
    if (component === "player") {
      return <PlayerBar embedded />;
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
          workspaceStore.setLayoutSnapshot(nextModel.toJson());
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
    case "player":
      return <Disc3 {...common} />;
    default:
      return <Boxes {...common} />;
  }
}
