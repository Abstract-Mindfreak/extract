import {
  Layout,
  Model,
} from "flexlayout-react";
import { useMemo, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileJson,
  FolderPlus,
  Rocket,
  Sparkles,
} from "lucide-react";
import {
  FaBoxArchive,
  FaBrain,
  FaChartLine,
  FaDatabase,
  FaFolderOpen,
  FaMusic,
  FaPython,
  FaRobot,
  FaSitemap,
  FaSliders,
  FaTerminal,
  FaWandMagicSparkles,
} from "react-icons/fa6";
import ASEMasterConsole from "./ASEMasterConsole";
import FlowmusicAgentPanel from "./ase-variations/flowmusic-agent-panel";
import GenerationEnginePanel from "./ase-variations/generation-engine-panel";
import LocalRagPanel from "./ase-variations/local-rag-panel";
import LocalRagReferencePanel from "./ase-variations/local-rag-reference-panel";
import MMSSInvariantsPanel from "./ase-variations/mmss-invariants-panel";
import MMSSSkillsPanel from "./ase-variations/mmss-skills-panel";
import MMSSThemeAlbumGroupsPanel from "./ase-variations/mmss-theme-album-groups-panel";
import MMSSMutatorPanel from "./ase-variations/mmss-mutator-panel";
import OmegaBreathPanel from "./ase-variations/omega-breath-panel";
import { useAseWorkspaceStore } from "../hooks/useAseWorkspaceStore";
import "./PromptIdeWorkspace.css";
import "./AseIdeWorkspace.css";

const ASE_THEME_COLOR_FIELDS = [
  { id: "accent", label: "Primary accent" },
  { id: "background", label: "Background dark" },
  { id: "surface", label: "Content surface" },
  { id: "tab", label: "Tab background" },
  { id: "text", label: "Text color" },
  { id: "scrollbar", label: "Scrollbar color" },
];

const ASE_RAG_TAB_COLOR_FIELDS = [
  { id: "main-panel-rag", label: "Main panel RAG" },
  { id: "search-results", label: "Search Results" },
  { id: "skill-tree-design", label: "Skill Tree Design" },
  { id: "answer", label: "Answer" },
  { id: "prompt-context", label: "Prompt Context" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "runtime-jobs", label: "Runtime Jobs" },
];

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
            {
              id: "ase-flowmusic-agents-tab",
              type: "tab",
              name: "Flowmusic Agents",
              component: "flowmusic-agents",
              enableClose: false,
              icon: "flowmusic-agents",
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

function ensureWorkspaceTab(layoutJson, tabConfig) {
  const nextLayout = layoutJson || buildDefaultLayout();
  const centerTabset = nextLayout?.layout?.children?.find(
    (child) => child?.id === "ase-center-tabset",
  );
  if (!centerTabset) return nextLayout;

  const exists = Array.isArray(centerTabset.children)
    && centerTabset.children.some((child) => child?.component === tabConfig.component);

  if (!exists) {
    centerTabset.children = [...(centerTabset.children || []), tabConfig];
  }

  return nextLayout;
}

function hexToRgb(hex) {
  const raw = (hex || "").replace("#", "").trim();
  const normalized = raw.length === 3
    ? raw.split("").map((char) => `${char}${char}`).join("")
    : raw;

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return "74, 160, 217";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `${red}, ${green}, ${blue}`;
}

export default function AseIdeWorkspace(props) {
  const workspaceStore = useAseWorkspaceStore();
  const layoutRef = useRef(null);
  const [model] = useState(() =>
    Model.fromJson(
      [
        {
          id: "ase-mmss-mutator-tab",
          type: "tab",
          name: "Мутатор MMSS",
          component: "mmss-mutator",
          enableClose: false,
          icon: "mmss-mutator",
        },
        {
          id: "ase-local-rag-tab",
          type: "tab",
          name: "Local LLM RAG",
          component: "local-rag",
          enableClose: false,
          icon: "local-rag",
        },
        {
          id: "ase-local-rag-reference-tab",
          type: "tab",
          name: "Local LLM RAG Ref",
          component: "local-rag-reference",
          enableClose: false,
          icon: "local-rag-reference",
        },
        {
          id: "ase-mmss-invariants-tab",
          type: "tab",
          name: "MMSS Invariants",
          component: "mmss-invariants",
          enableClose: false,
          icon: "mmss-invariants",
        },
        {
          id: "ase-mmss-skills-tab",
          type: "tab",
          name: "MMSS Skills",
          component: "mmss-skills",
          enableClose: false,
          icon: "mmss-skills",
        },
        {
          id: "ase-theme-album-groups-tab",
          type: "tab",
          name: "Theme Album Groups",
          component: "theme-album-groups",
          enableClose: false,
          icon: "theme-album-groups",
        },
        {
          id: "ase-omega-breath-tab",
          type: "tab",
          name: "Omega Breath ASE",
          component: "omega-breath",
          enableClose: false,
          icon: "omega-breath",
        },
      ].reduce(
        (layoutJson, tabConfig) => ensureWorkspaceTab(layoutJson, tabConfig),
        workspaceStore.layoutSnapshot || buildDefaultLayout(),
      ),
    )
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

    if (component === "mmss-mutator") {
      return <MMSSMutatorPanel onSaveToLibrary={props.onSaveToLibrary} />;
    }

    if (component === "local-rag") {
      return <LocalRagPanel />;
    }

    if (component === "local-rag-reference") {
      return <LocalRagReferencePanel />;
    }

    if (component === "mmss-invariants") {
      return <MMSSInvariantsPanel />;
    }

    if (component === "mmss-skills") {
      return <MMSSSkillsPanel />;
    }

    if (component === "theme-album-groups") {
      return <MMSSThemeAlbumGroupsPanel />;
    }

    if (component === "omega-breath") {
      return <OmegaBreathPanel />;
    }

    if (component === "flowmusic-agents") {
      return <FlowmusicAgentPanel onSaveToLibrary={props.onSaveToLibrary} />;
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
          onSetRagTabColor={workspaceStore.setRagTabColor}
          onSetThemeColor={workspaceStore.setThemeColor}
          onChangeTheme={workspaceStore.setUiTheme}
          ragTabColors={workspaceStore.ragTabColors}
          themeColors={workspaceStore.themeColors}
          uiTheme={workspaceStore.uiTheme}
        />
      );
    }

      return <div className="ide-panel-shell">Unknown ASE panel: {component}</div>;
  };

  const aseThemeStyle = useMemo(() => {
    const themeColors = workspaceStore.themeColors || {};
    const ragTabColors = workspaceStore.ragTabColors || {};
    const accent = themeColors.accent || "#4aa0d9";
    const background = themeColors.background || "#08111f";
    const surface = themeColors.surface || "#101826";
    const tab = themeColors.tab || "#182235";
    const text = themeColors.text || "#e7edf7";
    const scrollbar = themeColors.scrollbar || accent;

    return {
      "--ase-theme-accent": accent,
      "--ase-theme-accent-rgb": hexToRgb(accent),
      "--ase-theme-background": background,
      "--ase-theme-surface": surface,
      "--ase-theme-tab": tab,
      "--ase-theme-text": text,
      "--ase-theme-scrollbar": scrollbar,
      "--ase-theme-scrollbar-rgb": hexToRgb(scrollbar),
      "--ase-rag-main-panel-rag": ragTabColors["main-panel-rag"] || "#3b82f6",
      "--ase-rag-search-results": ragTabColors["search-results"] || "#22c55e",
      "--ase-rag-skill-tree-design": ragTabColors["skill-tree-design"] || "#f59e0b",
      "--ase-rag-answer": ragTabColors.answer || "#ef4444",
      "--ase-rag-prompt-context": ragTabColors["prompt-context"] || "#d946ef",
      "--ase-rag-diagnostics": ragTabColors.diagnostics || "#fde047",
      "--ase-rag-runtime-jobs": ragTabColors["runtime-jobs"] || "#2dd4bf",
    };
  }, [workspaceStore.ragTabColors, workspaceStore.themeColors]);

  return (
    <div
      className={`prompt-ide-shell ase-ide-shell ${normalizeTheme(workspaceStore.uiTheme)} ide-font-${workspaceStore.fontScale}`}
      style={aseThemeStyle}
    >
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

function AseSettingsPanel({
  fontScale,
  onChangeFontScale,
  onChangeTheme,
  onSetRagTabColor,
  onSetThemeColor,
  ragTabColors,
  themeColors,
  uiTheme,
}) {
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
      <div className="ide-workspace-appearance">
        <div className="ide-panel-header is-compact">
          <div>
            <strong>Panel Appearance</strong>
            <span>Theme variables and per-tab colors for the Local LLM RAG Ref flex workspace.</span>
          </div>
        </div>
        <div className="ide-appearance-grid">
          {ASE_RAG_TAB_COLOR_FIELDS.map((tab) => (
            <div key={tab.id} className="ide-appearance-card">
              <strong>{tab.label}</strong>
              <label>
                Color
                <input
                  type="color"
                  value={ragTabColors?.[tab.id] || "#243447"}
                  onChange={(event) => onSetRagTabColor(tab.id, event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      </div>
      <div className="ide-workspace-appearance">
        <div className="ide-panel-header is-compact">
          <div>
            <strong>Theme Colors</strong>
            <span>CSS variables that recolor the flexlayout surface and the shared scrollbar styling.</span>
          </div>
        </div>
        <div className="ide-appearance-grid">
          {ASE_THEME_COLOR_FIELDS.map((field) => (
            <div key={field.id} className="ide-appearance-card">
              <strong>{field.label}</strong>
              <label>
                Color
                <input
                  type="color"
                  value={themeColors?.[field.id] || "#243447"}
                  onChange={(event) => onSetThemeColor(field.id, event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
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
  const common = { size: 14 };
  switch (icon) {
    case "overview":
      return <FaBrain {...common} />;
    case "handoff":
      return <FaFolderOpen {...common} />;
    case "console":
      return <FaTerminal {...common} />;
    case "json":
      return <FaDatabase {...common} />;
    case "feedback":
      return <FaWandMagicSparkles {...common} />;
    case "python-generation":
      return <FaPython {...common} />;
    case "mmss-mutator":
      return <FaWandMagicSparkles {...common} />;
    case "local-rag":
      return <FaRobot {...common} />;
    case "local-rag-reference":
      return <FaDatabase {...common} />;
    case "mmss-invariants":
      return <FaSitemap {...common} />;
    case "mmss-skills":
      return <FaRobot {...common} />;
    case "theme-album-groups":
      return <FaFolderOpen {...common} />;
    case "omega-breath":
      return <FaBrain {...common} />;
    case "flowmusic-agents":
      return <FaMusic {...common} />;
    case "database":
      return <FaBoxArchive {...common} />;
    case "metrics":
      return <FaChartLine {...common} />;
    case "services":
      return <FaSliders {...common} />;
    case "activity":
      return <FaChartLine {...common} />;
    case "settings":
      return <FaSliders {...common} />;
    default:
      return <FaBrain {...common} />;
  }
}
