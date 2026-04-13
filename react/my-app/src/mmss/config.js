import { createPromptLibraryState } from "./promptLibrary";

export const GRID_COLS = 24;
export const GRID_ROWS = 12;

export const AUDIO_DEFAULTS = {
  master: 0.58,
  prism: 0.56,
  morph: 0.34,
  detune: 0.12,
  cutoff: 0.52,
  res: 0.38,
  colorAmt: 0.52,
  decay: 0.58,
};

export const VISION_DEFAULTS = {
  theme: "GLASS",
  depth: 0.42,
  glow: 0.46,
  noise: 0.16,
  focusMode: "MINIMAL_HUD",
  overlayDensity: 0.24,
};

export const TRANSPORT_DEFAULTS = {
  bpm: 108,
  playing: false,
  playhead: 0,
};

export const ORBIT_DEFAULTS = {
  enabled: false,
  speed: 0.6,
  visualWeight: 0.8,
  collisionIntensity: 0.55,
};

export const LEVELS = ["L0", "L1", "L2", "L3", "L4"];

export const SCENES = {
  AURORA_GATE: {
    audio: {
      prism: 0.82,
      morph: 0.4,
      detune: 0.2,
      cutoff: 0.72,
      res: 0.5,
      colorAmt: 0.86,
      decay: 0.5,
    },
    vision: {
      theme: "AURORA",
      depth: 0.78,
      glow: 0.88,
      noise: 0.3,
      focusMode: "SOFT_CENTRIC",
      overlayDensity: 0.4,
    },
  },
  GLASS_ORBIT: {
    audio: {
      prism: 0.3,
      morph: 0.2,
      detune: 0.05,
      cutoff: 0.5,
      res: 0.3,
      colorAmt: 0.4,
      decay: 0.76,
    },
    vision: {
      theme: "GLASS",
      depth: 0.34,
      glow: 0.46,
      noise: 0.1,
      focusMode: "MINIMAL_HUD",
      overlayDensity: 0.18,
    },
  },
  NOISE_TIDE: {
    audio: {
      prism: 0.9,
      morph: 0.86,
      detune: 0.34,
      cutoff: 0.3,
      res: 0.76,
      colorAmt: 0.9,
      decay: 0.3,
    },
    vision: {
      theme: "TIDE",
      depth: 0.88,
      glow: 0.72,
      noise: 0.74,
      focusMode: "FLOW_FIELD",
      overlayDensity: 0.72,
    },
  },
};

export const THEME_PALETTES = {
  AURORA: {
    primary: "#77f7ff",
    accent: "#9dff9a",
    fillA: "#102840",
    fillB: "#172258",
    noise: "#7cf4ff",
  },
  GLASS: {
    primary: "#9be0ff",
    accent: "#d8f3ff",
    fillA: "#101927",
    fillB: "#172436",
    noise: "#c3ecff",
  },
  TIDE: {
    primary: "#80c8ff",
    accent: "#ffd06f",
    fillA: "#142034",
    fillB: "#20143e",
    noise: "#ff936f",
  },
  WARM_SPECTRUM: {
    primary: "#ffb167",
    accent: "#ffe58a",
    fillA: "#2a1418",
    fillB: "#402313",
    noise: "#ffcf82",
  },
  COLD_SPECTRUM: {
    primary: "#7bd4ff",
    accent: "#8fffee",
    fillA: "#0d1d2b",
    fillB: "#102646",
    noise: "#92f0ff",
  },
  MONO: {
    primary: "#d7dde7",
    accent: "#ffffff",
    fillA: "#1b1e24",
    fillB: "#14171d",
    noise: "#f4f6fb",
  },
};

export const AUDIO_CONTROLS = [
  { key: "master", label: "Master", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "prism", label: "Prism", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "morph", label: "Morph", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "detune", label: "Detune", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "cutoff", label: "Cutoff", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "res", label: "Res", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "colorAmt", label: "Color Amt", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "decay", label: "Decay", min: 0, max: 1, step: 0.01, type: "range" },
];

export const VISION_CONTROLS = [
  {
    key: "theme",
    label: "UI Theme",
    type: "select",
    options: ["AURORA", "GLASS", "TIDE", "WARM_SPECTRUM", "COLD_SPECTRUM", "MONO"],
  },
  {
    key: "focusMode",
    label: "Focus Mode",
    type: "select",
    options: ["SOFT_CENTRIC", "MINIMAL_HUD", "FLOW_FIELD"],
  },
  { key: "depth", label: "UI Depth", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "glow", label: "UI Glow", min: 0, max: 1, step: 0.01, type: "range" },
  { key: "noise", label: "UI Noise", min: 0, max: 1, step: 0.01, type: "range" },
  {
    key: "overlayDensity",
    label: "Overlay",
    min: 0,
    max: 1,
    step: 0.01,
    type: "range",
  },
];

export const TRANSPORT_CONTROLS = [
  { key: "bpm", label: "BPM", min: 64, max: 180, step: 1, type: "range" },
  { key: "speed", label: "Orbit Speed", min: 0.1, max: 2, step: 0.01, type: "range" },
  {
    key: "visualWeight",
    label: "Visual Weight",
    min: 0,
    max: 1,
    step: 0.01,
    type: "range",
  },
  {
    key: "collisionIntensity",
    label: "Collision",
    min: 0,
    max: 1,
    step: 0.01,
    type: "range",
  },
];

export const DEFAULT_INTENT_EXAMPLE =
  "calm glass laboratory drifting into a prismatic storm over 2 minutes";

export function createGrid() {
  return Array.from({ length: GRID_COLS }, () => Array.from({ length: GRID_ROWS }, () => 0));
}

export function seedGrid() {
  const grid = createGrid();

  for (let col = 0; col < GRID_COLS; col += 1) {
    const row = Math.floor((Math.sin(col * 0.5) * 0.5 + 0.5) * (GRID_ROWS - 1));
    grid[col][row] = 1;
    if (col % 4 === 0) {
      grid[col][Math.min(GRID_ROWS - 1, row + 3)] = 1;
    }
  }

  return grid;
}

export function createInitialState(restoredPromptLibrary) {
  return {
    initialized: false,
    audio: { ...AUDIO_DEFAULTS },
    vision: { ...VISION_DEFAULTS },
    transport: { ...TRANSPORT_DEFAULTS },
    orbit: { ...ORBIT_DEFAULTS },
    image: {
      previewSrc: "",
      analysis: null,
    },
    mmss: {
      level: "L0",
      currentScene: "BASELINE",
      visionBound: false,
      lastIntent: "idle",
      lastCheckpoint: "baseline",
      baseline: {
        audio: { ...AUDIO_DEFAULTS },
        vision: { ...VISION_DEFAULTS },
      },
      checkpoints: [{ id: "baseline", label: "baseline" }],
      sceneUsage: [],
      logs: [],
    },
    matrix: {
      grid: seedGrid(),
    },
    promptLibrary: createPromptLibraryState(restoredPromptLibrary),
  };
}
