import { useEffect, useRef } from "react";
import { SCENES } from "./config";
import { clamp, easeInOutCubic, orbitStatesFromState } from "./utils";

export function useOrbitMotion({ orbit, baseline, dispatch, enabled }) {
  const phaseRef = useRef(0);
  const collisionRef = useRef(0);
  const baselineRef = useRef(baseline);

  useEffect(() => {
    baselineRef.current = baseline;
  }, [baseline]);

  useEffect(() => {
    if (!enabled) return undefined;

    const intervalId = window.setInterval(() => {
      const states = orbitStatesFromState({
        audio: SCENES.GLASS_ORBIT.audio,
        vision: SCENES.GLASS_ORBIT.vision,
        mmss: { baseline: baselineRef.current },
      });

      if (states.length < 2) return;

      phaseRef.current += 0.12 * orbit.speed;
      const cycle = states.length;
      const wrapped = phaseRef.current % cycle;
      const currentIndex = Math.floor(wrapped);
      const nextIndex = (currentIndex + 1) % cycle;
      const local = wrapped - currentIndex;
      const amount = clamp(local + Math.sin(Date.now() * 0.0007) * 0.02, 0, 1);
      const eased = easeInOutCubic(amount);

      const audio = mixNumericObject(states[currentIndex].audio, states[nextIndex].audio, eased);
      const vision = mixVisionObject(states[currentIndex].vision, states[nextIndex].vision, eased);

      if (local < 0.08 && Date.now() - collisionRef.current > 1100) {
        collisionRef.current = Date.now();
        audio.prism = clamp(audio.prism + randomRange(-0.08, 0.1) * orbit.collisionIntensity, 0, 1);
        audio.detune = clamp(audio.detune + 0.16 * orbit.collisionIntensity, 0, 1);
        audio.res = clamp(audio.res + 0.12 * orbit.collisionIntensity, 0, 1);
        vision.glow = clamp(vision.glow + 0.18 * orbit.collisionIntensity, 0, 1);
        vision.noise = clamp(vision.noise + 0.14 * orbit.collisionIntensity, 0, 1);
      }

      dispatch({
        type: "sync_orbit_snapshot",
        audio,
        vision,
        sceneLabel: states[currentIndex].label,
      });
    }, 160);

    return () => window.clearInterval(intervalId);
  }, [dispatch, enabled, orbit.collisionIntensity, orbit.speed]);
}

function mixNumericObject(from, to, amount) {
  const result = {};
  Object.keys(from).forEach((key) => {
    result[key] = from[key] + (to[key] - from[key]) * amount;
  });
  return result;
}

function mixVisionObject(from, to, amount) {
  return {
    theme: amount < 0.5 ? from.theme : to.theme,
    focusMode: amount < 0.5 ? from.focusMode : to.focusMode,
    depth: from.depth + (to.depth - from.depth) * amount,
    glow: from.glow + (to.glow - from.glow) * amount,
    noise: from.noise + (to.noise - from.noise) * amount,
    overlayDensity: from.overlayDensity + (to.overlayDensity - from.overlayDensity) * amount,
  };
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}
