import appPersistenceService from "./AppPersistenceService";

const PRESET_SCOPE = "flexlayout_workspace_presets";
const STATE_SCOPE = "flexlayout_workspace_state";
const DEFAULT_PRESET_NAME = "auto";
const WORKSPACE_EVENT_NAME = "mmss:flexlayout-workspace-event";

export const SCREEN_PROFILE_OPTIONS = [
  { value: "landscape-screen-orientation-2k", label: "Landscape 2K" },
  { value: "portrait-screen-orientation-2k", label: "Portrait 2K" },
  { value: "landscape-screen-orientation-hd", label: "Landscape HD" },
  { value: "portrait-screen-orientation-hd", label: "Portrait HD" },
];

export const FLEX_WORKSPACE_OPTIONS = [
  { value: "app_mode_workspace", label: "App Mode Workspace" },
  { value: "prompt_ide_workspace", label: "Prompt IDE Workspace" },
  { value: "ase_workspace", label: "ASE Workspace" },
  { value: "local_media_library", label: "Local Media Library" },
];

function getViewport() {
  if (typeof window === "undefined") {
    return { width: 1920, height: 1080 };
  }
  return {
    width: Number(window.innerWidth || 1920),
    height: Number(window.innerHeight || 1080),
  };
}

export function detectScreenProfile() {
  const { width, height } = getViewport();
  const orientation = width >= height ? "landscape" : "portrait";
  const tier = Math.max(width, height) >= 2000 ? "2k" : "hd";
  return `${orientation}-screen-orientation-${tier}`;
}

function buildPresetId(workspaceId, screenProfile, presetName = DEFAULT_PRESET_NAME) {
  return `${workspaceId}::${screenProfile}::${presetName}`;
}

function normalizeLastActiveEntry(entry) {
  if (!entry) return null;
  if (typeof entry === "string") {
    return {
      screenProfile: entry,
      presetName: DEFAULT_PRESET_NAME,
    };
  }
  return {
    screenProfile: entry.screenProfile || detectScreenProfile(),
    presetName: entry.presetName || DEFAULT_PRESET_NAME,
  };
}

async function getLastActiveState() {
  return appPersistenceService.getSetting(STATE_SCOPE, "last_active_profiles", {});
}

async function setLastActiveState(nextState) {
  return appPersistenceService.setSetting(STATE_SCOPE, "last_active_profiles", nextState);
}

function emitWorkspaceEvent(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_EVENT_NAME, { detail }));
}

class FlexLayoutWorkspaceService {
  async savePreset({
    workspaceId,
    screenProfile,
    presetName = DEFAULT_PRESET_NAME,
    layoutJson,
    uiTheme = null,
    fontScale = null,
    metadata = {},
    setActive = false,
  }) {
    const effectiveProfile = screenProfile || detectScreenProfile();
    const preset = {
      id: buildPresetId(workspaceId, effectiveProfile, presetName),
      workspaceId,
      presetName,
      screenProfile: effectiveProfile,
      uiTheme,
      fontScale,
      layoutJson,
      metadata,
      updatedAt: new Date().toISOString(),
    };
    await appPersistenceService.putEntity(PRESET_SCOPE, preset.id, preset);
    if (setActive) {
      const currentState = await getLastActiveState();
      await setLastActiveState({
        ...currentState,
        [workspaceId]: {
          screenProfile: effectiveProfile,
          presetName,
        },
      });
    }
    return preset;
  }

  async loadPreset(workspaceId, screenProfile, presetName = DEFAULT_PRESET_NAME) {
    return appPersistenceService.getEntity(
      PRESET_SCOPE,
      buildPresetId(workspaceId, screenProfile, presetName),
      null,
    );
  }

  async loadEffectiveLayout({
    workspaceId,
    fallbackLayout,
    legacySnapshot = null,
    presetName = DEFAULT_PRESET_NAME,
  }) {
    const currentProfile = detectScreenProfile();
    const lastActiveState = await getLastActiveState();
    const lastActive = normalizeLastActiveEntry(lastActiveState?.[workspaceId]);
    const candidates = [
      lastActive ? { screenProfile: lastActive.screenProfile, presetName: lastActive.presetName } : null,
      { screenProfile: currentProfile, presetName },
      lastActive && lastActive.presetName !== presetName
        ? { screenProfile: currentProfile, presetName: lastActive.presetName }
        : null,
      lastActive && lastActive.screenProfile !== currentProfile
        ? { screenProfile: lastActive.screenProfile, presetName }
        : null,
    ].filter(Boolean);

    for (const candidate of candidates) {
      const preset = await this.loadPreset(
        workspaceId,
        candidate.screenProfile,
        candidate.presetName,
      );
      if (preset?.layoutJson) {
        return {
          layoutJson: preset.layoutJson,
          screenProfile: currentProfile,
          loadedProfile: candidate.screenProfile,
          loadedPresetName: candidate.presetName,
          source: "preset",
          preset,
        };
      }
    }

    if (legacySnapshot) {
      return {
        layoutJson: legacySnapshot,
        screenProfile: currentProfile,
        loadedProfile: currentProfile,
        loadedPresetName: presetName,
        source: "legacy",
        preset: null,
      };
    }

    return {
      layoutJson: fallbackLayout,
      screenProfile: currentProfile,
      loadedProfile: currentProfile,
      loadedPresetName: presetName,
      source: "default",
      preset: null,
    };
  }

  async persistAutoLayout({
    workspaceId,
    layoutJson,
    uiTheme = null,
    fontScale = null,
    metadata = {},
  }) {
    return this.savePreset({
      workspaceId,
      screenProfile: detectScreenProfile(),
      presetName: DEFAULT_PRESET_NAME,
      layoutJson,
      uiTheme,
      fontScale,
      metadata,
      setActive: true,
    });
  }

  async getLastActiveProfile(workspaceId) {
    const state = await getLastActiveState();
    return normalizeLastActiveEntry(state?.[workspaceId]);
  }

  async listPresets() {
    const items = await appPersistenceService.listEntities(PRESET_SCOPE);
    return items
      .filter(Boolean)
      .sort((left, right) => String(right?.updatedAt || "").localeCompare(String(left?.updatedAt || "")));
  }

  subscribe(listener) {
    if (typeof window === "undefined") {
      return () => {};
    }
    const handler = (event) => {
      listener(event?.detail || {});
    };
    window.addEventListener(WORKSPACE_EVENT_NAME, handler);
    return () => window.removeEventListener(WORKSPACE_EVENT_NAME, handler);
  }

  async applyPreset({ workspaceId, screenProfile, presetName = DEFAULT_PRESET_NAME }) {
    const effectiveProfile = screenProfile || detectScreenProfile();
    const preset = await this.loadPreset(workspaceId, effectiveProfile, presetName);
    if (!preset?.layoutJson) {
      throw new Error(`Preset not found for ${workspaceId} / ${effectiveProfile} / ${presetName}`);
    }
    const currentState = await getLastActiveState();
    await setLastActiveState({
      ...currentState,
      [workspaceId]: {
        screenProfile: effectiveProfile,
        presetName,
      },
    });
    emitWorkspaceEvent({
      type: "apply",
      workspaceId,
      screenProfile: effectiveProfile,
      presetName,
      layoutJson: preset.layoutJson,
      preset,
    });
    return preset;
  }

  async applyPresetToAll({ workspaceIds, screenProfile, presetName = DEFAULT_PRESET_NAME }) {
    const applied = [];
    for (const workspaceId of workspaceIds) {
      try {
        const preset = await this.applyPreset({ workspaceId, screenProfile, presetName });
        applied.push({ workspaceId, ok: true, preset });
      } catch (error) {
        applied.push({ workspaceId, ok: false, error: error?.message || String(error) });
      }
    }
    return applied;
  }

  async resetWorkspace(workspaceId) {
    const items = await this.listPresets();
    const matching = items.filter((item) => item.workspaceId === workspaceId);
    for (const item of matching) {
      await appPersistenceService.deleteEntity(PRESET_SCOPE, item.id);
    }
    const currentState = await getLastActiveState();
    if (Object.prototype.hasOwnProperty.call(currentState || {}, workspaceId)) {
      const nextState = { ...(currentState || {}) };
      delete nextState[workspaceId];
      await setLastActiveState(nextState);
    }
    emitWorkspaceEvent({
      type: "reset",
      workspaceId,
    });
    return { workspaceId, removed: matching.length };
  }

  async resetAllWorkspaces(workspaceIds) {
    const results = [];
    for (const workspaceId of workspaceIds) {
      results.push(await this.resetWorkspace(workspaceId));
    }
    return results;
  }
}

const flexLayoutWorkspaceService = new FlexLayoutWorkspaceService();

export default flexLayoutWorkspaceService;
