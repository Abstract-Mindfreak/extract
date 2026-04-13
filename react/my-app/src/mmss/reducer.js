import {
  AUDIO_DEFAULTS,
  SCENES,
  VISION_DEFAULTS,
  createInitialState,
} from "./config";
import { reducePromptLibrary } from "./promptLibrary";
import {
  addCheckpoint,
  appendLog,
  cloneStateValue,
  getNextLevel,
  resolveIntent,
  trackSceneUsage,
} from "./utils";

function elevateState(state, targetLevel, logMessage) {
  const nextLevel = getNextLevel(state.mmss.level, targetLevel);
  if (nextLevel === state.mmss.level) return state;

  return {
    ...state,
    mmss: {
      ...state.mmss,
      level: nextLevel,
      lastCheckpoint: `checkpoint_${nextLevel}`,
      checkpoints: addCheckpoint(state.mmss.checkpoints, nextLevel),
      logs: appendLog(state.mmss.logs, logMessage ?? `Level up to ${nextLevel}.`),
    },
  };
}

export function mmssReducer(state, action) {
  if (action.type.startsWith("PROMPT_")) {
    return {
      ...state,
      promptLibrary: reducePromptLibrary(state.promptLibrary, action),
    };
  }

  switch (action.type) {
    case "initialize":
      return {
        ...state,
        initialized: true,
        mmss: {
          ...state.mmss,
          logs: appendLog(state.mmss.logs, "System initialized. Shared MMSS dispatcher online."),
        },
      };

    case "set_audio_param":
      if (typeof state.audio[action.key] === "number" && !Number.isFinite(action.value)) {
        return state;
      }
      return {
        ...state,
        audio: {
          ...state.audio,
          [action.key]: action.value,
        },
      };

    case "set_vision_param":
      if (typeof state.vision[action.key] === "number" && !Number.isFinite(action.value)) {
        return state;
      }
      return {
        ...state,
        vision: {
          ...state.vision,
          [action.key]: action.value,
        },
      };

    case "set_transport_param":
      if (typeof state.transport[action.key] === "number" && !Number.isFinite(action.value)) {
        return state;
      }
      return {
        ...state,
        transport: {
          ...state.transport,
          [action.key]: action.value,
        },
      };

    case "set_orbit_param":
      if (typeof state.orbit[action.key] === "number" && !Number.isFinite(action.value)) {
        return state;
      }
      return {
        ...state,
        orbit: {
          ...state.orbit,
          [action.key]: action.value,
        },
      };

    case "toggle_playing":
      return {
        ...state,
        transport: {
          ...state.transport,
          playing: !state.transport.playing,
        },
      };

    case "set_playhead":
      return {
        ...state,
        transport: {
          ...state.transport,
          playhead: action.playhead,
        },
      };

    case "toggle_matrix_cell": {
      const nextGrid = state.matrix.grid.map((column) => [...column]);
      nextGrid[action.column][action.row] = action.value;
      return {
        ...state,
        matrix: {
          ...state.matrix,
          grid: nextGrid,
        },
      };
    }

    case "set_matrix_grid":
      return {
        ...state,
        matrix: {
          ...state.matrix,
          grid: action.grid,
        },
      };

    case "capture_baseline":
      return {
        ...state,
        mmss: {
          ...state.mmss,
          baseline: {
            audio: cloneStateValue(state.audio),
            vision: cloneStateValue(state.vision),
          },
          lastCheckpoint: "baseline",
          checkpoints: state.mmss.checkpoints.some((checkpoint) => checkpoint.id === "baseline")
            ? state.mmss.checkpoints
            : [{ id: "baseline", label: "baseline" }, ...state.mmss.checkpoints],
          logs: appendLog(state.mmss.logs, `Baseline captured via ${action.reason}.`),
        },
      };

    case "load_scene": {
      if (action.sceneName === "BASELINE") {
        const baseline = state.mmss.baseline ?? {
          audio: AUDIO_DEFAULTS,
          vision: VISION_DEFAULTS,
        };

        return {
          ...state,
          audio: cloneStateValue(baseline.audio),
          vision: cloneStateValue(baseline.vision),
          mmss: {
            ...state.mmss,
            currentScene: "BASELINE",
            logs: appendLog(state.mmss.logs, "Restored baseline state."),
          },
        };
      }

      const scene = SCENES[action.sceneName];
      if (!scene) return state;

      const nextState = {
        ...state,
        audio: cloneStateValue(scene.audio),
        vision: cloneStateValue(scene.vision),
        mmss: {
          ...state.mmss,
          currentScene: action.sceneName,
          sceneUsage: trackSceneUsage(state.mmss.sceneUsage, action.sceneName),
          logs: appendLog(state.mmss.logs, `Loaded scene ${action.sceneName}.`),
        },
      };

      return nextState.mmss.sceneUsage.length >= 2
        ? elevateState(nextState, "L1", "Level up to L1.")
        : nextState;
    }

    case "apply_image_analysis": {
      const nextAudio = {
        ...state.audio,
        colorAmt: action.analysis.saturationMean,
        decay: Math.max(0.12, Math.min(0.92, 1 - action.analysis.brightnessMean)),
        detune: action.analysis.edgeDensity,
        morph: Math.max(0, Math.min(1, 1 - action.analysis.symmetryScore)),
        cutoff: action.analysis.highContrast
          ? Math.max(state.audio.cutoff, 0.75)
          : Math.min(state.audio.cutoff, 0.35),
        res: action.analysis.highContrast
          ? Math.max(state.audio.res, 0.8)
          : Math.min(state.audio.res, 0.3),
      };

      const nextVision = {
        ...state.vision,
        theme: action.analysis.theme,
        depth: action.analysis.highContrast
          ? Math.max(action.analysis.contrast, 0.8)
          : action.analysis.contrast,
        glow: action.analysis.highContrast
          ? Math.max(state.vision.glow, 0.9)
          : Math.min(state.vision.glow, 0.35),
        noise: action.analysis.highContrast
          ? action.analysis.edgeDensity
          : Math.max(action.analysis.edgeDensity, 0.6),
        focusMode: action.analysis.motionFlow > 0.45 ? "FLOW_FIELD" : "SOFT_CENTRIC",
        overlayDensity: action.analysis.saliencySpread,
      };

      return elevateState(
        {
          ...state,
          audio: nextAudio,
          vision: nextVision,
          image: {
            previewSrc: action.previewSrc,
            analysis: action.analysis,
          },
          mmss: {
            ...state.mmss,
            currentScene: "VISION_METAMOD",
            visionBound: true,
            logs: appendLog(
              state.mmss.logs,
              `Vision source bound. Theme ${action.analysis.theme}, contrast ${action.analysis.contrast.toFixed(2)}.`
            ),
          },
        },
        "L2",
        "Level up to L2."
      );
    }

    case "toggle_orbit": {
      const enabled = action.enabled ?? !state.orbit.enabled;
      const nextState = {
        ...state,
        orbit: {
          ...state.orbit,
          enabled,
        },
        mmss: {
          ...state.mmss,
          currentScene: enabled ? "ORBITAL_DUO" : state.mmss.currentScene,
          logs: appendLog(state.mmss.logs, enabled ? "Orbit started." : "Orbit stopped."),
        },
      };

      return enabled ? elevateState(nextState, "L3", "Level up to L3.") : nextState;
    }

    case "apply_intent": {
      const resolved = resolveIntent(action.prompt);
      const scene = resolved.scene ? SCENES[resolved.scene] : null;
      const audio = {
        ...(scene ? scene.audio : state.audio),
        ...resolved.audio,
      };
      const vision = {
        ...(scene ? scene.vision : state.vision),
        ...resolved.vision,
      };

      let nextState = {
        ...state,
        audio,
        vision,
        mmss: {
          ...state.mmss,
          currentScene: resolved.scene || state.mmss.currentScene,
          lastIntent: resolved.summary,
          logs: appendLog(state.mmss.logs, `Intent applied: ${resolved.summary}.`),
        },
      };

      if (resolved.startOrbit) {
        nextState = {
          ...nextState,
          orbit: {
            ...nextState.orbit,
            enabled: true,
          },
        };
      }

      return elevateState(nextState, "L4", "Level up to L4.");
    }

    case "append_log":
      return {
        ...state,
        mmss: {
          ...state.mmss,
          logs: appendLog(state.mmss.logs, action.message),
        },
      };

    case "reset_all":
      return createInitialState();

    case "sync_orbit_snapshot":
      return {
        ...state,
        audio: {
          ...state.audio,
          ...action.audio,
        },
        vision: {
          ...state.vision,
          ...action.vision,
        },
        mmss: {
          ...state.mmss,
          currentScene: action.sceneLabel,
        },
      };

    default:
      return state;
  }
}
