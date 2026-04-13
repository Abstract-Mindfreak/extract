import { GRID_COLS, GRID_ROWS, LEVELS, SCENES, THEME_PALETTES } from "./config";

export const SCALE_STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26];

export function clamp(value, min, max) {
  return Math.min(Math.max(Number(value), min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function easeInOutCubic(value) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

export function cutoffToHz(value) {
  return 80 * Math.pow(150, clamp(value, 0, 1));
}

export function decayToSeconds(value) {
  return 0.16 + clamp(value, 0, 1) * 1.44;
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function waveformForMorph(morph) {
  if (morph < 0.33) return "triangle";
  if (morph < 0.66) return "sawtooth";
  return "square";
}

export function percentLabel(value) {
  return `${Math.round(value * 100)}%`;
}

export function cutoffLabel(value) {
  return `${Math.round(cutoffToHz(value))} Hz`;
}

export function decayLabel(value) {
  return `${decayToSeconds(value).toFixed(2)} s`;
}

export function bpmLabel(value) {
  return String(Math.round(value));
}

export function speedLabel(value) {
  return `${value.toFixed(2)}x`;
}

export function rangeLabel(key, value) {
  if (key === "cutoff") return cutoffLabel(value);
  if (key === "decay") return decayLabel(value);
  if (key === "bpm") return bpmLabel(value);
  if (key === "speed") return speedLabel(value);
  return percentLabel(value);
}

export function formatTimeStamp(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function appendLog(logs, message) {
  return [`[${formatTimeStamp()}] ${message}`, ...logs].slice(0, 14);
}

export function cloneStateValue(value) {
  return JSON.parse(JSON.stringify(value));
}

export function toRgba(hexColor, alpha) {
  const safe = hexColor.replace("#", "");
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getThemePalette(theme) {
  return THEME_PALETTES[theme] ?? THEME_PALETTES.GLASS;
}

export function getNextLevel(currentLevel, targetLevel) {
  return LEVELS.indexOf(targetLevel) > LEVELS.indexOf(currentLevel) ? targetLevel : currentLevel;
}

export function addCheckpoint(checkpoints, level) {
  const id = `checkpoint_${level}`;
  if (checkpoints.some((checkpoint) => checkpoint.id === id)) {
    return checkpoints;
  }

  return [...checkpoints, { id, label: id }];
}

export function trackSceneUsage(sceneUsage, sceneName) {
  if (sceneName === "BASELINE" || sceneUsage.includes(sceneName)) {
    return sceneUsage;
  }

  return [...sceneUsage, sceneName];
}

export function pickThemeByHue(hue) {
  if (hue < 35 || hue > 330) return "WARM_SPECTRUM";
  if (hue < 150) return "AURORA";
  if (hue < 230) return "COLD_SPECTRUM";
  if (hue < 290) return "GLASS";
  return "TIDE";
}

export function parseIntentDuration(input) {
  const match = input.match(/(\d+)\s*(ms|sec|secs|seconds|s|minute|min)/i);

  if (!match) return 6000;

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit === "ms") return amount;
  if (unit === "s" || unit.startsWith("sec")) return amount * 1000;
  return amount * 60000;
}

export function includesAny(value, tokens) {
  return tokens.some((token) => value.includes(token));
}

export function resolveIntent(input) {
  const value = input.toLowerCase();
  const result = {
    scene: "",
    audio: {},
    vision: {},
    durationMs: parseIntentDuration(value),
    startOrbit: false,
    summary: "custom fabric",
  };

  if (includesAny(value, ["glass", "laboratory", "lab"])) {
    result.scene = "GLASS_ORBIT";
    result.summary = "glass orbit";
  }
  if (includesAny(value, ["storm", "noise"])) {
    result.scene = "NOISE_TIDE";
    result.summary = "noise tide";
  }
  if (includesAny(value, ["aurora", "northern", "prismatic gate"])) {
    result.scene = "AURORA_GATE";
    result.summary = "aurora gate";
  }
  if (includesAny(value, ["calm", "serene", "quiet", "breath"])) {
    result.audio.detune = 0.05;
    result.audio.res = 0.4;
    result.audio.decay = 0.82;
    result.vision.focusMode = "MINIMAL_HUD";
    result.vision.overlayDensity = 0.18;
    result.summary = "calm drift";
  }
  if (includesAny(value, ["aggressive", "tense", "harsh"])) {
    result.audio.detune = 0.34;
    result.audio.res = 0.84;
    result.audio.decay = 0.3;
    result.vision.overlayDensity = 0.72;
    result.vision.noise = 0.76;
    result.summary = "aggressive surge";
  }
  if (includesAny(value, ["prismatic", "prism"])) {
    result.audio.prism = 0.9;
    result.audio.colorAmt = 0.98;
    result.vision.theme = "AURORA";
    result.vision.glow = 0.9;
    result.summary = "prismatic bloom";
  }
  if (includesAny(value, ["minimal", "clean", "hud"])) {
    result.vision.focusMode = "MINIMAL_HUD";
    result.vision.overlayDensity = 0.16;
    result.vision.noise = 0.12;
  }
  if (includesAny(value, ["rich", "dense", "immersive"])) {
    result.vision.overlayDensity = 0.86;
    result.vision.depth = 0.84;
    result.vision.glow = 0.76;
  }
  if (includesAny(value, ["warm"])) result.vision.theme = "WARM_SPECTRUM";
  if (includesAny(value, ["cold"])) result.vision.theme = "COLD_SPECTRUM";
  if (includesAny(value, ["mono", "monochrome"])) {
    result.vision.theme = "MONO";
    result.audio.colorAmt = 0.18;
  }
  if (includesAny(value, ["orbit", "orbital", "drifting"])) {
    result.startOrbit = true;
  }

  return result;
}

export function analyzeImageElement(image) {
  const maxSize = 180;
  const scale = Math.min(maxSize / image.width, maxSize / image.height, 1);
  const width = Math.max(24, Math.floor(image.width * scale));
  const height = Math.max(24, Math.floor(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(image, 0, 0, width, height);
  const data = context.getImageData(0, 0, width, height).data;

  let brightnessSum = 0;
  let saturationSum = 0;
  let hueVectorX = 0;
  let hueVectorY = 0;
  let horizontalEdges = 0;
  let verticalEdges = 0;
  let symmetryError = 0;
  let varianceSum = 0;
  let sampleCount = 0;
  const luminanceMap = [];

  for (let row = 0; row < height; row += 1) {
    luminanceMap[row] = [];
    for (let col = 0; col < width; col += 1) {
      const index = (row * width + col) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const hsl = rgbToHsl(r, g, b);
      const light = luminance(r, g, b);
      brightnessSum += hsl.l;
      saturationSum += hsl.s;
      hueVectorX += Math.cos((hsl.h * Math.PI) / 180) * hsl.s;
      hueVectorY += Math.sin((hsl.h * Math.PI) / 180) * hsl.s;
      luminanceMap[row][col] = light;
      sampleCount += 1;
    }
  }

  const brightnessMean = brightnessSum / sampleCount;

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const light = luminanceMap[row][col];
      varianceSum += (light - brightnessMean) * (light - brightnessMean);
      if (col < width - 1) horizontalEdges += Math.abs(light - luminanceMap[row][col + 1]);
      if (row < height - 1) verticalEdges += Math.abs(light - luminanceMap[row + 1][col]);
      symmetryError += Math.abs(light - luminanceMap[row][width - col - 1]);
    }
  }

  const contrast = clamp(Math.sqrt(varianceSum / sampleCount) * 2.35, 0, 1);
  const edgeDensity = clamp((horizontalEdges + verticalEdges) / Math.max(1, width * height * 0.24), 0, 1);
  const symmetryScore = clamp(1 - symmetryError / Math.max(1, width * height * 0.55), 0, 1);
  const motionFlow = clamp(
    Math.abs(horizontalEdges - verticalEdges) / Math.max(1e-5, horizontalEdges + verticalEdges),
    0,
    1
  );
  const saliencySpread = clamp(contrast * 0.72 + edgeDensity * 0.35, 0, 1);
  const hueMean = (((Math.atan2(hueVectorY, hueVectorX) * 180) / Math.PI) + 360) % 360;

  return {
    brightnessMean: clamp(brightnessMean, 0, 1),
    saturationMean: clamp(saturationSum / sampleCount, 0, 1),
    edgeDensity,
    symmetryScore,
    motionFlow,
    saliencySpread,
    contrast,
    highContrast: contrast > 0.38,
    hueMean,
    theme: pickThemeByHue(hueMean),
  };
}

function luminance(r, g, b) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function rgbToHsl(r, g, b) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  let hue = 0;
  let saturation = 0;
  const lightness = (max + min) / 2;

  if (max !== min) {
    const delta = max - min;
    saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case red:
        hue = (green - blue) / delta + (green < blue ? 6 : 0);
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
        break;
    }
    hue /= 6;
  }

  return { h: hue * 360, s: saturation, l: lightness };
}

export function orbitStatesFromState(state) {
  const baseline = state.mmss.baseline ?? {
    audio: state.audio,
    vision: state.vision,
  };

  return [
    { label: "BASELINE", audio: baseline.audio, vision: baseline.vision },
    { label: "AURORA_GATE", audio: SCENES.AURORA_GATE.audio, vision: SCENES.AURORA_GATE.vision },
    { label: "GLASS_ORBIT", audio: SCENES.GLASS_ORBIT.audio, vision: SCENES.GLASS_ORBIT.vision },
    { label: "NOISE_TIDE", audio: SCENES.NOISE_TIDE.audio, vision: SCENES.NOISE_TIDE.vision },
  ];
}

export function getStageGridCell(clientX, clientY, rect) {
  const column = Math.floor(((clientX - rect.left) / rect.width) * GRID_COLS);
  const row = Math.floor(((clientY - rect.top) / rect.height) * GRID_ROWS);
  return {
    column,
    row,
  };
}

export function midiStepForRow(row) {
  return 45 + SCALE_STEPS[GRID_ROWS - row - 1];
}
