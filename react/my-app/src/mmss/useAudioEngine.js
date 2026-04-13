import { useEffect, useRef, useState } from "react";
import { AUDIO_DEFAULTS, GRID_ROWS } from "./config";
import { cutoffToHz, decayToSeconds, midiStepForRow, midiToFreq, waveformForMorph } from "./utils";

export function useAudioEngine({ initialized, audio, transport, grid, dispatch }) {
  const engineRef = useRef(null);
  const stateRef = useRef({ audio, transport, grid });
  const [audioReady, setAudioReady] = useState(false);

  useEffect(() => {
    stateRef.current = { audio, transport, grid };
  }, [audio, transport, grid]);

  useEffect(() => {
    if (!engineRef.current) return;
    updateAudioGraph(engineRef.current, audio);
  }, [audio]);

  useEffect(() => {
    if (!initialized || !audioReady || !engineRef.current || !transport.playing) return undefined;

    const tick = () => {
      const engine = engineRef.current;
      const currentState = stateRef.current;

      while (engine.nextNoteTime < engine.ctx.currentTime + engine.scheduleAheadTime) {
        scheduleColumn(engine, currentState);
        const secondsPerBeat = 60 / currentState.transport.bpm;
        engine.nextNoteTime += secondsPerBeat * 0.25;
        engine.playhead = (engine.playhead + 1) % currentState.grid.length;
        dispatch({ type: "set_playhead", playhead: engine.playhead });
      }

      engine.timerId = window.setTimeout(tick, engine.lookahead);
    };

    tick();

    return () => {
      if (engineRef.current?.timerId) {
        clearTimeout(engineRef.current.timerId);
        engineRef.current.timerId = null;
      }
    };
  }, [audioReady, dispatch, initialized, transport.bpm, transport.playing]);

  function initializeAudio() {
    if (engineRef.current) {
      if (engineRef.current.ctx.state === "suspended") {
        engineRef.current.ctx.resume();
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContextClass();
    const master = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const delay = ctx.createDelay();
    const feedback = ctx.createGain();
    const wet = ctx.createGain();
    const analyser = ctx.createAnalyser();

    master.gain.value = 0.58;
    filter.type = "lowpass";
    delay.delayTime.value = 0.24;
    analyser.fftSize = 2048;

    filter.connect(master);
    filter.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    engineRef.current = {
      ctx,
      master,
      filter,
      delay,
      feedback,
      wet,
      analyser,
      lookahead: 25,
      scheduleAheadTime: 0.12,
      nextNoteTime: ctx.currentTime + 0.1,
      playhead: 0,
      timerId: null,
    };

    updateAudioGraph(engineRef.current, stateRef.current.audio);
    setAudioReady(true);
  }

  return {
    initializeAudio,
    audioReady,
    analyserNode: engineRef.current?.analyser ?? null,
  };
}

function updateAudioGraph(engine, audio) {
  const now = engine.ctx.currentTime;
  const safeAudio = normalizeAudio(audio);
  engine.master.gain.setTargetAtTime(0.0001 + safeAudio.master * 0.9, now, 0.08);
  engine.filter.frequency.setTargetAtTime(cutoffToHz(safeAudio.cutoff), now, 0.08);
  engine.filter.Q.setTargetAtTime(1 + safeAudio.res * 16, now, 0.08);
  engine.delay.delayTime.setTargetAtTime(0.12 + safeAudio.colorAmt * 0.28, now, 0.08);
  engine.feedback.gain.setTargetAtTime(0.22 + safeAudio.colorAmt * 0.4, now, 0.08);
  engine.wet.gain.setTargetAtTime(0.1 + safeAudio.decay * 0.18, now, 0.08);
}

function scheduleColumn(engine, state) {
  const { grid, audio } = state;
  const columnIndex = engine.playhead;

  for (let row = 0; row < GRID_ROWS; row += 1) {
    if (!grid[columnIndex][row]) continue;
    triggerVoice(engine, audio, row, engine.nextNoteTime, 0.23 + (1 - row / GRID_ROWS) * 0.2);
  }
}

function triggerVoice(engine, audio, row, time, amplitude) {
  const safeAudio = normalizeAudio(audio);
  const { ctx, filter } = engine;
  const midi = midiStepForRow(row);
  const frequency = midiToFreq(midi + Math.round(safeAudio.prism * 7));
  const oscA = ctx.createOscillator();
  const oscB = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const modGain = ctx.createGain();
  const gain = ctx.createGain();
  const voiceFilter = ctx.createBiquadFilter();

  oscA.type = waveformForMorph(safeAudio.morph);
  oscB.type = safeAudio.morph > 0.66 ? "square" : "sine";
  oscA.frequency.value = frequency;
  oscB.frequency.value = frequency * 0.5;
  oscB.detune.value = safeAudio.detune * 80;
  mod.frequency.value = frequency * (2 + safeAudio.prism * 6);
  modGain.gain.value = frequency * safeAudio.colorAmt * 0.18;

  voiceFilter.type = "lowpass";
  voiceFilter.frequency.value = cutoffToHz(safeAudio.cutoff);
  voiceFilter.Q.value = 1 + safeAudio.res * 14;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(amplitude, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + decayToSeconds(safeAudio.decay));

  mod.connect(modGain).connect(oscA.frequency);
  oscA.connect(voiceFilter);
  oscB.connect(voiceFilter);
  voiceFilter.connect(gain).connect(filter);

  oscA.start(time);
  oscB.start(time);
  mod.start(time);

  const stopTime = time + decayToSeconds(safeAudio.decay) + 0.08;
  oscA.stop(stopTime);
  oscB.stop(stopTime);
  mod.stop(stopTime);
}

function normalizeAudio(audio) {
  return {
    master: finiteOr(audio?.master, AUDIO_DEFAULTS.master),
    prism: finiteOr(audio?.prism, AUDIO_DEFAULTS.prism),
    morph: finiteOr(audio?.morph, AUDIO_DEFAULTS.morph),
    detune: finiteOr(audio?.detune, AUDIO_DEFAULTS.detune),
    cutoff: finiteOr(audio?.cutoff, AUDIO_DEFAULTS.cutoff),
    res: finiteOr(audio?.res, AUDIO_DEFAULTS.res),
    colorAmt: finiteOr(audio?.colorAmt, AUDIO_DEFAULTS.colorAmt),
    decay: finiteOr(audio?.decay, AUDIO_DEFAULTS.decay),
  };
}

function finiteOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}
