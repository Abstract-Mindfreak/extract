import {
  Layout,
  Model,
} from "flexlayout-react";
import { useMemo, useRef, useState } from "react";
import {
  Activity,
  Boxes,
  Database,
  Download,
  ExternalLink,
  FileJson,
  FolderPlus,
  Rocket,
  Settings2,
  Sparkles,
  TerminalSquare,
  Workflow,
} from "lucide-react";
import ASEMasterConsole from "./ASEMasterConsole";
import GenerationEnginePanel from "./ase-variations/generation-engine-panel";
import { useAseWorkspaceStore } from "../hooks/useAseWorkspaceStore";
import "./PromptIdeWorkspace.css";
import "./AseIdeWorkspace.css";

function buildDefaultLayout() {
  return {
    global: {
      tabEnableClose: true,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      tabEnableRename: false,
      borderEnableAutoHide: true,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [
      {
        type: "border",
        location: "bottom",
        selected: 0,
        size: 220,
        children: [
          {
            id: "ase-activity-tab",
            type: "tab",
            name: "ASE Activity",
            component: "activity",
            enableClose: false,
            icon: "activity",
          },
          {
            id: "ase-stream-actions-tab",
            type: "tab",
            name: "Stream Actions",
            component: "stream-actions",
            enableClose: false,
            icon: "handoff",
          },
        ],
      },
      {
        type: "border",
        location: "right",
        selected: 0,
        size: 300,
        children: [
          {
            id: "ase-settings-tab",
            type: "tab",
            name: "ASE Workspace Settings",
            component: "settings",
            enableClose: false,
            icon: "settings",
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
          id: "ase-left-tabset",
          weight: 28,
          selected: 0,
          children: [
            {
              id: "ase-overview-tab",
              type: "tab",
              name: "Overview",
              component: "overview",
              enableClose: false,
              icon: "overview",
            },
            {
              id: "ase-handoff-tab",
              type: "tab",
              name: "Builder Handoff",
              component: "handoff",
              enableClose: false,
              icon: "handoff",
            },
          ],
        },
        {
          type: "tabset",
          id: "ase-center-tabset",
          weight: 46,
          selected: 0,
          children: [
            {
              id: "ase-console-tab",
              type: "tab",
              name: "ASE Unified Console",
              component: "console",
              enableClose: false,
              icon: "console",
            },
            {
              id: "ase-stream-tab",
              type: "tab",
              name: "MMSS Stream JSON",
              component: "stream",
              enableClose: false,
              icon: "json",
            },
            {
              id: "ase-stream-feedback-tab",
              type: "tab",
              name: "Stream Feedback",
              component: "stream-feedback",
              enableClose: false,
              icon: "feedback",
            },
            {
              id: "ase-python-generation-tab",
              type: "tab",
              name: "Python Generation",
              component: "python-generation",
              enableClose: false,
              icon: "python-generation",
            },
          ],
        },
        {
          type: "tabset",
          id: "ase-right-tabset",
          weight: 26,
          selected: 0,
          children: [
            {
              id: "ase-saved-configs-tab",
              type: "tab",
              name: "Saved Configurations",
              component: "saved-configs",
              enableClose: false,
              icon: "database",
            },
            {
              id: "ase-services-tab",
              type: "tab",
              name: "Services",
              component: "services",
              enableClose: false,
              icon: "services",
            },
            {
              id: "ase-stream-metrics-tab",
              type: "tab",
              name: "Stream Metrics",
              component: "stream-metrics",
              enableClose: false,
              icon: "metrics",
            },
          ],
        },
      ],
    },
  };
}

function normalizeTheme(uiTheme) {
  if (uiTheme === "alpha-light") return "flexlayout__theme_alpha_light";
  if (uiTheme === "rounded") return "flexlayout__theme_rounded";
  return "flexlayout__theme_dark";
}

export default function AseIdeWorkspace(props) {
  const workspaceStore = useAseWorkspaceStore();
  const layoutRef = useRef(null);
  const [model] = useState(() =>
    Model.fromJson(workspaceStore.layoutSnapshot || buildDefaultLayout())
  );

  const activityLogs = useMemo(
    () => (Array.isArray(props.logs) ? [...props.logs].slice(-60).reverse() : []),
    [props.logs]
  );

  const factory = (node) => {
    const component = node.getComponent();

    if (component === "console") {
      return (
        <ASEMasterConsole
          onSaveToDatabase={props.onSaveToDatabase}
          onSaveToLibrary={props.onSaveToLibrary}
          onSendToSequenceBuilder={props.onSendToSequenceBuilder}
        />
      );
    }

    if (component === "overview") {
      return (
        <AseOverviewPanel
          activeComposition={props.activeComposition}
          aseConfigCount={props.aseConfigs.length}
          onCheckServiceStatus={props.onCheckServiceStatus}
          onOpenPromptLibrary={props.onOpenPromptLibrary}
          onOpenSequenceBuilder={props.onOpenSequenceBuilder}
          promptBlockCount={props.promptBlockCount}
          sequenceCount={props.sequenceCount}
        />
      );
    }

    if (component === "handoff") {
      return (
        <AseHandoffPanel
          activeComposition={props.activeComposition}
          onOpenPromptLibrary={props.onOpenPromptLibrary}
          onOpenSequenceBuilder={props.onOpenSequenceBuilder}
          promptBlockCount={props.promptBlockCount}
          sequenceCount={props.sequenceCount}
        />
      );
    }

    if (component === "stream") {
      return <AseStreamPanel streamPreviewText={props.streamPreviewText} />;
    }

    if (component === "stream-feedback") {
      return <AseStreamFeedbackPanel streamFeedback={props.streamFeedback} />;
    }

    if (component === "python-generation") {
      return <GenerationEnginePanel onSaveToLibrary={props.onSaveToLibrary} />;
    }

    if (component === "saved-configs") {
      return <AseSavedConfigsPanel aseConfigs={props.aseConfigs} />;
    }

    if (component === "services") {
      return (
        <AseServicesPanel
          onCheckServiceStatus={props.onCheckServiceStatus}
          serviceHealth={props.serviceHealth}
        />
      );
    }

    if (component === "activity") {
      return <AseActivityPanel logs={activityLogs} />;
    }

    if (component === "stream-metrics") {
      return <AseStreamMetricsPanel heroMetrics={props.heroMetrics} />;
    }

    if (component === "stream-actions") {
      return (
        <AseStreamActionsPanel
          activeModeLabel={props.activeModeLabel}
          onExportPreview={props.onExportPreview}
          onOpenInJsonHero={props.onOpenInJsonHero}
          onPushPreviewToGenesis={props.onPushPreviewToGenesis}
          onQuickSavePreview={props.onQuickSavePreview}
          onSavePreviewFile={props.onSavePreviewFile}
          streamPreviewPayload={props.streamPreviewPayload}
        />
      );
    }

    if (component === "settings") {
      return (
        <AseSettingsPanel
          fontScale={workspaceStore.fontScale}
          onChangeFontScale={workspaceStore.setFontScale}
          onChangeTheme={workspaceStore.setUiTheme}
          uiTheme={workspaceStore.uiTheme}
        />
      );
    }

    return <div className="ide-panel-shell">Unknown ASE panel: {component}</div>;
  };

  return (
    <div className={`prompt-ide-shell ase-ide-shell ${normalizeTheme(workspaceStore.uiTheme)} ide-font-${workspaceStore.fontScale}`}>
      <Layout
        factory={factory}
        model={model}
        onModelChange={(nextModel) => {
          workspaceStore.setLayoutSnapshot(nextModel.toJson());
        }}
        onRenderTab={(node, renderValues) => {
          renderValues.leading = resolveTabIcon(node.getConfig()?.icon);
        }}
        popoutClassName={`prompt-ide-popout ase-ide-popout ${normalizeTheme(workspaceStore.uiTheme)} ide-font-${workspaceStore.fontScale}`}
        popoutURL="popout.html"
        ref={layoutRef}
      />
    </div>
  );
}

function AseOverviewPanel({
  activeComposition,
  aseConfigCount,
  onCheckServiceStatus,
  onOpenPromptLibrary,
  onOpenSequenceBuilder,
  promptBlockCount,
  sequenceCount,
}) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>ASE Workspace</strong>
          <span>Unified rack, current MMSS bridge state, and quick entry points into Prompt Library.</span>
        </div>
      </div>
      <div className="ide-workspace-summary-grid">
        <MetricCard label="Saved configs" value={String(aseConfigCount)} />
        <MetricCard label="Prompt blocks" value={String(promptBlockCount)} />
        <MetricCard label="Sequences" value={String(sequenceCount)} />
        <MetricCard label="Composition" value={`${activeComposition?.blockIds?.length || 0} items`} />
      </div>
      <div className="ide-workspace-action-row">
        <button onClick={onOpenPromptLibrary}>Open Prompt Library</button>
        <button onClick={onOpenSequenceBuilder}>Open Sequence Builder</button>
        <button onClick={onCheckServiceStatus}>Check Services</button>
      </div>
      <div className="ide-workspace-focus-grid">
        <FocusCard
          title="Handoff Target"
          value="JsonSequenceBuilder"
          meta="ASE unified pipeline feeds Prompt Library composition state."
        />
        <FocusCard
          title="Merge Strategy"
          value={activeComposition?.mergeStrategy || "merge_deep"}
          meta="Shared composition policy for ASE to Prompt Library transfer."
        />
        <FocusCard
          title="Bridge Status"
          value={promptBlockCount > 0 ? "Linked" : "Cold"}
          meta="Prompt Library inventory is visible to ASE handoff panels."
        />
      </div>
    </div>
  );
}

function AseHandoffPanel({
  activeComposition,
  onOpenPromptLibrary,
  onOpenSequenceBuilder,
  promptBlockCount,
  sequenceCount,
}) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Builder Handoff</strong>
          <span>Context for moving ASE output into Prompt Library blocks, compositions, and saved sequences.</span>
        </div>
      </div>
      <div className="ase-handoff-grid">
        <div className="ase-handoff-card">
          <span>Prompt inventory</span>
          <strong>{promptBlockCount} block(s)</strong>
          <small>Current Prompt Library pool available for composition and bindings.</small>
        </div>
        <div className="ase-handoff-card">
          <span>Saved sequences</span>
          <strong>{sequenceCount} sequence(s)</strong>
          <small>Reusable sequence targets that can receive ASE unified payloads.</small>
        </div>
        <div className="ase-handoff-card">
          <span>Active composition</span>
          <strong>{activeComposition?.blockIds?.length || 0} item(s)</strong>
          <small>{activeComposition?.mergeStrategy || "merge_deep"}</small>
        </div>
      </div>
      <div className="ide-workspace-action-row">
        <button onClick={onOpenSequenceBuilder}>Jump to Sequence Builder</button>
        <button onClick={onOpenPromptLibrary}>Open Prompt Workspace</button>
      </div>
    </div>
  );
}

function AseStreamPanel({ streamPreviewText }) {
  return (
    <div className="ide-panel-shell ase-flex-panel ase-json-panel">
      <div className="ide-panel-header">
        <div>
          <strong>MMSS Stream JSON</strong>
          <span>Current stream payload snapshot as seen by the outer workspace shell.</span>
        </div>
      </div>
      <pre className="ase-stream-preview">{streamPreviewText}</pre>
    </div>
  );
}

function AseStreamFeedbackPanel({ streamFeedback }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Stream Feedback</strong>
          <span>Current workspace guidance and status message for the active ASE stream context.</span>
        </div>
      </div>
      <div className="ase-feedback-card">
        <Sparkles size={14} />
        <p>{streamFeedback}</p>
      </div>
    </div>
  );
}

function AseSavedConfigsPanel({ aseConfigs }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Saved Configurations</strong>
          <span>Local ASE configuration snapshots stored in browser persistence.</span>
        </div>
      </div>
      <div className="ase-config-list">
        {aseConfigs.length ? (
          aseConfigs.map((config, index) => (
            <div key={`${config.id || config.name || "ase"}-${index}`} className="ase-config-card">
              <strong>{config.name || `ASE Config ${index + 1}`}</strong>
              <span>{config.savedAt || "No timestamp"}</span>
              <small>{config.state?.currentVariation || config.currentVariation || "unified"}</small>
            </div>
          ))
        ) : (
          <div className="ide-empty-panel">
            <Sparkles size={14} />
            <span>No ASE configurations saved yet.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function AseServicesPanel({ onCheckServiceStatus, serviceHealth }) {
  const services = [
    { id: "mistral", name: "Mistral", ...serviceHealth.mistral },
    { id: "jsonhero", name: "JSON Hero", ...serviceHealth.jsonhero },
  ];

  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Services</strong>
          <span>External service health that ASE and the outer workspace rely on.</span>
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
        <button onClick={onCheckServiceStatus}>Check Services</button>
      </div>
    </div>
  );
}

function AseActivityPanel({ logs }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>ASE Activity</strong>
          <span>Recent MMSS and ASE-side messages useful while iterating on the rack and handoff.</span>
        </div>
      </div>
      <div className="ide-terminal-log">
        {logs.length ? (
          logs.map((entry, index) => (
            <div className="ide-terminal-line" key={`${entry}-${index}`}>
              {entry}
            </div>
          ))
        ) : (
          <div className="ide-terminal-line is-empty">No ASE activity yet.</div>
        )}
      </div>
    </div>
  );
}

function AseStreamMetricsPanel({ heroMetrics }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>Stream Metrics</strong>
          <span>Live summary metrics that previously lived in the external stream sidebar.</span>
        </div>
      </div>
      <div className="ide-workspace-summary-grid">
        {heroMetrics.map((metric) => (
          <MetricCard key={metric.id} label={metric.label} value={String(metric.value)} />
        ))}
      </div>
    </div>
  );
}

function AseStreamActionsPanel({
  activeModeLabel,
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
          <span>Export, save, inspect, and forward the active ASE stream payload.</span>
        </div>
      </div>
      <div className="ide-workspace-action-row">
        <button className="ui-action-btn ui-action-btn--export" onClick={() => onExportPreview(streamPreviewPayload, `${activeModeLabel}_preview`)}>
          <Download size={14} />
          Copy Preview
        </button>
        <button className="ui-action-btn ui-action-btn--neutral" onClick={() => onSavePreviewFile(streamPreviewPayload)}>
          <FileJson size={14} />
          Save JSON
        </button>
        <button className="ui-action-btn ui-action-btn--library" onClick={onQuickSavePreview}>
          <FolderPlus size={14} />
          Quick Save
        </button>
        <button className="ui-action-btn ui-action-btn--open" onClick={() => onOpenInJsonHero(streamPreviewPayload, "ASE stream preview")}>
          <ExternalLink size={14} />
          Open in JSON Hero
        </button>
        <button className="ui-action-btn ui-action-btn--send" onClick={onPushPreviewToGenesis}>
          <Rocket size={14} />
          Send Preview
        </button>
      </div>
    </div>
  );
}

function AseSettingsPanel({ fontScale, onChangeFontScale, onChangeTheme, uiTheme }) {
  return (
    <div className="ide-panel-shell ase-flex-panel">
      <div className="ide-panel-header">
        <div>
          <strong>ASE Workspace Settings</strong>
          <span>Layout and editor theme controls for the ASE flex workspace.</span>
        </div>
      </div>
      <div className="ide-settings-form">
        <label>
          <span>Size</span>
          <select value={fontScale} onChange={(event) => onChangeFontScale(event.target.value)}>
            <option value="small">small</option>
            <option value="medium">medium</option>
            <option value="large">large</option>
          </select>
        </label>
        <label>
          <span>Theme</span>
          <select value={uiTheme} onChange={(event) => onChangeTheme(event.target.value)}>
            <option value="alpha-light">Alpha Light</option>
            <option value="vs-dark">vs-dark</option>
            <option value="rounded">Rounded</option>
          </select>
        </label>
      </div>
    </div>
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

function FocusCard({ title, value, meta }) {
  return (
    <div className="ide-workspace-focus-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{meta}</small>
    </div>
  );
}

function resolveTabIcon(icon) {
  const common = { size: 14, strokeWidth: 2 };
  switch (icon) {
    case "overview":
      return <Boxes {...common} />;
    case "handoff":
      return <Workflow {...common} />;
    case "console":
      return <Workflow {...common} />;
    case "json":
      return <FileJson {...common} />;
    case "feedback":
      return <Sparkles {...common} />;
    case "python-generation":
      return <Database {...common} />;
    case "database":
      return <Database {...common} />;
    case "metrics":
      return <Activity {...common} />;
    case "services":
      return <Activity {...common} />;
    case "activity":
      return <TerminalSquare {...common} />;
    case "settings":
      return <Settings2 {...common} />;
    default:
      return <Boxes {...common} />;
  }
}
