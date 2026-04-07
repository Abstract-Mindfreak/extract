import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * MMSS + Drawscope Audio-Wave Controller
 * Standalone single-file React tool for sound experiments.
 *
 * Merges:
 * - image sonification block scanner
 * - XY audio-wave controller pad
 * - prismatic synth controls
 * - drawscope oscilloscope / image-map feedback
 */

export default function AudioWaveControllerTool() {
  const [initialized, setInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [bpm, setBpm] = useState(110);
  const [speed, setSpeed] = useState(2);
  const [noteMult, setNoteMult] = useState(0.7);
  const [oscType, setOscType] = useState("sawtooth");
  const [scaleName, setScaleName] = useState("Pentatonic");
  const [baseNote, setBaseNote] = useState(110);

  const [prism, setPrism] = useState(200);
  const [shape, setShape] = useState(0.45);
  const [detune, setDetune] = useState(10);
  const [cutoff, setCutoff] = useState(2200);
  const [resonance, setResonance] = useState(4);
  const [colorMix, setColorMix] = useState(0.5);
  const [release, setRelease] = useState(1.1);
  const [delayMix, setDelayMix] = useState(0.28);
  const [delayTimeL, setDelayTimeL] = useState(0.3);
  const [delayTimeR, setDelayTimeR] = useState(0.42);
  const [drive, setDrive] = useState(0.35);
  const [vibratoRate, setVibratoRate] = useState(4);
  const [vibratoDepth, setVibratoDepth] = useState(5);
  const [tremoloRate, setTremoloRate] = useState(2.5);
  const [tremoloDepth, setTremoloDepth] = useState(0.16);
  const [fifthLevel, setFifthLevel] = useState(0.22);
  const [octaveLevel, setOctaveLevel] = useState(0.28);
  const [blockW, setBlockW] = useState(16);
  const [blockH, setBlockH] = useState(16);
  const [mapHeight, setMapHeight] = useState(240);
  const [xyHold, setXyHold] = useState(false);
  const [scanMode, setScanMode] = useState<"image" | "xy" | "hybrid">("hybrid");
  const [showDiag, setShowDiag] = useState(false);
  const [diagResults, setDiagResults] = useState<{ name: string; pass: boolean; info?: string }[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const shaperRef = useRef<WaveShaperNode | null>(null);
  const delayLRef = useRef<DelayNode | null>(null);
  const delayRRef = useRef<DelayNode | null>(null);
  const delayFeedLRef = useRef<GainNode | null>(null);
  const delayFeedRRef = useRef<GainNode | null>(null);
  const delayOutRef = useRef<GainNode | null>(null);
  const gainEnvRef = useRef<GainNode | null>(null);
  const colorGainRef = useRef<GainNode | null>(null);
  const osc1GainRef = useRef<GainNode | null>(null);
  const osc2GainRef = useRef<GainNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const osc1Ref = useRef<OscillatorNode | null>(null);
  const osc2Ref = useRef<OscillatorNode | null>(null);
  const oscColorRef = useRef<OscillatorNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageMapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const xyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const stepTimerRef = useRef<number | null>(null);
  const lastObjectUrlRef = useRef<string | null>(null);

  const imageDataRef = useRef<Uint8ClampedArray | null>(null);
  const imgWRef = useRef(0);
  const imgHRef = useRef(0);
  const blocksRef = useRef<{ degree: number; oct: number; velocity: number; lightness: number; hue: number }[]>([]);
  const colsRef = useRef(0);
  const rowsRef = useRef(0);
  const stepRef = useRef(0);
  const touchRef = useRef({ x: 0.5, y: 0.5, active: false });

  const scales = useMemo(
    () => [
      { name: "Major", intervals: [0, 2, 4, 5, 7, 9, 11, 12] },
      { name: "Minor", intervals: [0, 2, 3, 5, 7, 8, 10, 12] },
      { name: "Pentatonic", intervals: [0, 2, 4, 7, 9, 12] },
      { name: "Blues", intervals: [0, 3, 5, 6, 7, 10, 12] },
      { name: "Chromatic", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
      { name: "Whole Tone", intervals: [0, 2, 4, 6, 8, 10, 12] },
    ],
    []
  );
  const currentScale = useMemo(() => scales.find((s) => s.name === scaleName) || scales[0], [scaleName, scales]);

  const paramsRef = useRef<any>({});
  useEffect(() => {
    paramsRef.current = {
      volume,
      bpm,
      speed,
      noteMult,
      oscType,
      baseNote,
      prism,
      shape,
      detune,
      cutoff,
      resonance,
      colorMix,
      release,
      delayMix,
      delayTimeL,
      delayTimeR,
      drive,
      vibratoRate,
      vibratoDepth,
      tremoloRate,
      tremoloDepth,
      fifthLevel,
      octaveLevel,
      blockW,
      blockH,
      scaleIntervals: currentScale.intervals,
      scanMode,
      xy: touchRef.current,
    };
  }, [volume, bpm, speed, noteMult, oscType, baseNote, prism, shape, detune, cutoff, resonance, colorMix, release, delayMix, delayTimeL, delayTimeR, drive, vibratoRate, vibratoDepth, tremoloRate, tremoloDepth, fifthLevel, octaveLevel, blockW, blockH, currentScale, scanMode]);

  function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
  function roundTo(v: number, step: number) { return Math.round(v / step) * step; }
  function midiToFreq(m: number) { return 440 * Math.pow(2, (m - 69) / 12); }
  function freqToMidi(f: number) { return 69 + 12 * Math.log2(f / 440); }
  function rgbToHsv(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min; let h = 0;
    if (d !== 0) {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    const s = max === 0 ? 0 : d / max;
    return { h, s, v: max * 255 };
  }
  function rgbToHsl(r: number, g: number, b: number) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    const d = max - min;
    if (d !== 0) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l: l * 100 };
  }
  function makeSaturationCurve(k: number) {
    const n = 44100;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function initAudio() {
    if (audioCtxRef.current) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const master = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const oscColor = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const shaper = ctx.createWaveShaper();
    const gainEnv = ctx.createGain();
    const osc1Gain = ctx.createGain();
    const osc2Gain = ctx.createGain();
    const colorGain = ctx.createGain();
    const delayL = ctx.createDelay(1.5);
    const delayR = ctx.createDelay(1.5);
    const feedL = ctx.createGain();
    const feedR = ctx.createGain();
    const delayOut = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    osc1.type = "sawtooth";
    osc2.type = "square";
    oscColor.type = "sine";
    filter.type = "lowpass";
    shaper.curve = makeSaturationCurve(10);
    shaper.oversample = "4x";
    gainEnv.gain.value = 0;
    osc1Gain.gain.value = 0.8;
    osc2Gain.gain.value = 0.55;
    colorGain.gain.value = 0;
    delayOut.gain.value = delayMix;
    feedL.gain.value = 0.36;
    feedR.gain.value = 0.4;
    lfo.frequency.value = 2;
    lfoGain.gain.value = 450;
    master.gain.value = Math.pow(volume, 2);

    lfo.connect(lfoGain).connect(filter.frequency);
    oscColor.connect(colorGain).connect(osc1.frequency);
    osc1.connect(osc1Gain).connect(filter);
    osc2.connect(osc2Gain).connect(filter);
    filter.connect(shaper).connect(gainEnv);
    gainEnv.connect(master);
    gainEnv.connect(delayL);
    gainEnv.connect(delayR);
    delayL.connect(feedL).connect(delayL);
    delayR.connect(feedR).connect(delayR);
    delayL.connect(delayOut);
    delayR.connect(delayOut);
    delayOut.connect(master);
    master.connect(analyser);
    analyser.connect(ctx.destination);

    osc1.start();
    osc2.start();
    oscColor.start();
    lfo.start();

    audioCtxRef.current = ctx;
    masterGainRef.current = master;
    analyserRef.current = analyser;
    filterRef.current = filter;
    shaperRef.current = shaper;
    gainEnvRef.current = gainEnv;
    colorGainRef.current = colorGain;
    osc1GainRef.current = osc1Gain;
    osc2GainRef.current = osc2Gain;
    delayLRef.current = delayL;
    delayRRef.current = delayR;
    delayFeedLRef.current = feedL;
    delayFeedRRef.current = feedR;
    delayOutRef.current = delayOut;
    lfoRef.current = lfo;
    lfoGainRef.current = lfoGain;
    osc1Ref.current = osc1;
    osc2Ref.current = osc2;
    oscColorRef.current = oscColor;

    updateMasterVolumeSafe();
    updateEngineParams();
  }

  function cleanupAudio() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current as any);
    rafRef.current = null;
    stepTimerRef.current = null;
  }

  function updateMasterVolumeSafe() {
    if (!masterGainRef.current) return false;
    masterGainRef.current.gain.value = Math.pow(volume, 2);
    return true;
  }

  function updateEngineParams() {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const t = ctx.currentTime + 0.03;
    const xy = touchRef.current;
    const baseFreq = baseNote * Math.pow(2, (1 - xy.y) * 2.8);
    const hueRatio = prism / 360;
    const colorFreq = baseFreq * (2 + hueRatio * 8);

    if (osc1Ref.current) {
      if (shape < 0.33) osc1Ref.current.type = "triangle";
      else if (shape < 0.66) osc1Ref.current.type = "sawtooth";
      else osc1Ref.current.type = "square";
      osc1Ref.current.frequency.setTargetAtTime(baseFreq, t, 0.06);
    }
    if (osc2Ref.current) {
      osc2Ref.current.type = oscType as OscillatorType;
      osc2Ref.current.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.06);
      osc2Ref.current.detune.setTargetAtTime(detune, t, 0.06);
    }
    if (oscColorRef.current) oscColorRef.current.frequency.setTargetAtTime(colorFreq, t, 0.06);
    if (colorGainRef.current) colorGainRef.current.gain.setTargetAtTime(colorMix * 1800 * xy.x, t, 0.08);
    if (filterRef.current) {
      filterRef.current.frequency.setTargetAtTime(cutoff, t, 0.08);
      filterRef.current.Q.setTargetAtTime(resonance, t, 0.08);
    }
    if (delayLRef.current) delayLRef.current.delayTime.setTargetAtTime(delayTimeL, t, 0.08);
    if (delayRRef.current) delayRRef.current.delayTime.setTargetAtTime(delayTimeR, t, 0.08);
    if (delayOutRef.current) delayOutRef.current.gain.setTargetAtTime(delayMix, t, 0.08);
    if (shaperRef.current) shaperRef.current.curve = makeSaturationCurve(3 + drive * 40);
    if (lfoRef.current) lfoRef.current.frequency.setTargetAtTime(1 + tremoloRate * 0.4, t, 0.08);
    if (lfoGainRef.current) lfoGainRef.current.gain.setTargetAtTime(100 + colorMix * 700, t, 0.08);
  }

  useEffect(() => { updateMasterVolumeSafe(); }, [volume]);
  useEffect(() => { updateEngineParams(); }, [prism, shape, detune, cutoff, resonance, colorMix, release, delayMix, delayTimeL, delayTimeR, drive, oscType, baseNote, tremoloRate]);

  function triggerGate(active: boolean) {
    const ctx = audioCtxRef.current;
    const gain = gainEnvRef.current;
    if (!ctx || !gain) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), t);
    if (active) {
      gain.gain.linearRampToValueAtTime(Math.max(0.05, volume * 0.9), t + 0.04);
    } else {
      gain.gain.exponentialRampToValueAtTime(0.0001, t + release);
    }
  }

  function buildBlocks() {
    const data = imageDataRef.current;
    const W = imgWRef.current;
    const H = imgHRef.current;
    blocksRef.current = [];
    colsRef.current = 0;
    rowsRef.current = 0;
    if (!data || !W || !H) return;
    const bw = Math.max(1, Math.floor(blockW));
    const bh = Math.max(1, Math.floor(blockH));
    const cols = Math.max(1, Math.floor(W / bw));
    const rows = Math.max(1, Math.floor(H / bh));
    colsRef.current = cols;
    rowsRef.current = rows;

    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const x0 = rx * bw, y0 = ry * bh;
        const x1 = Math.min(x0 + bw, W), y1 = Math.min(y0 + bh, H);
        let rSum = 0, gSum = 0, bSum = 0, n = 0;
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * W + x) * 4;
            rSum += data[idx] as number;
            gSum += data[idx + 1] as number;
            bSum += data[idx + 2] as number;
            n++;
          }
        }
        const r = rSum / n, g = gSum / n, b = bSum / n;
        const { h } = rgbToHsv(r, g, b);
        const { l } = rgbToHsl(r, g, b);
        const degree = Math.floor(Math.sqrt(h / 360) * Math.max(1, currentScale.intervals.length - 1));
        const oct = Math.floor((l / 100) * 3) - 1;
        const velocity = clamp(0.24 + (l / 100) * 0.76, 0.08, 1);
        blocksRef.current.push({ degree, oct, velocity, lightness: l, hue: h });
      }
    }
  }
  useEffect(() => { buildBlocks(); }, [blockW, blockH, currentScale]);

  function scheduleVoice(freq: number, velocity: number, lightness01: number, hue: number) {
    const ctx = audioCtxRef.current;
    const master = masterGainRef.current;
    if (!ctx || !master) return;
    const p = paramsRef.current;
    const now = ctx.currentTime;
    const beatDur = 60 / p.bpm;
    const stepDur = Math.max(0.04, beatDur / clamp(p.speed, 0.25, 8));
    const dur = clamp(stepDur * p.noteMult * (0.6 + velocity), 0.05, 1.8);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = p.resonance;
    filter.frequency.setValueAtTime(clamp(p.cutoff * (0.55 + lightness01 * 0.9), 80, 16000), now);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(clamp(velocity * 0.18, 0.03, 0.22), now + 0.01);
    env.gain.setTargetAtTime(0.08, now + 0.04, 0.09);
    env.gain.setTargetAtTime(0.0001, now + dur * 0.7, Math.max(0.05, p.release * 0.18));

    const trem = ctx.createGain();
    trem.gain.setValueAtTime(1 - p.tremoloDepth, now);
    const tremLfo = ctx.createOscillator();
    tremLfo.frequency.setValueAtTime(p.tremoloRate, now);
    const tremDepth = ctx.createGain();
    tremDepth.gain.setValueAtTime(p.tremoloDepth, now);
    tremLfo.connect(tremDepth).connect(trem.gain);

    const osc = ctx.createOscillator();
    const osc5 = ctx.createOscillator();
    const osc8 = ctx.createOscillator();
    osc.type = p.oscType;
    osc5.type = p.oscType;
    osc8.type = p.oscType;
    osc.frequency.setValueAtTime(freq, now);
    osc5.frequency.setValueAtTime(freq * 1.5, now);
    osc8.frequency.setValueAtTime(freq * 2, now);

    const vib = ctx.createOscillator();
    vib.frequency.setValueAtTime(p.vibratoRate, now);
    const vibAmt = ctx.createGain();
    const centsToHz = (cents: number) => freq * (Math.pow(2, cents / 1200) - 1);
    vibAmt.gain.setValueAtTime(centsToHz(p.vibratoDepth + (hue / 360) * 8), now);
    vib.connect(vibAmt).connect(osc.frequency);

    const mixMain = ctx.createGain();
    const mix5 = ctx.createGain();
    const mix8 = ctx.createGain();
    mixMain.gain.value = 1;
    mix5.gain.value = clamp(p.fifthLevel, 0, 1);
    mix8.gain.value = clamp(p.octaveLevel, 0, 1);

    osc.connect(mixMain).connect(filter);
    osc5.connect(mix5).connect(filter);
    osc8.connect(mix8).connect(filter);
    filter.connect(env).connect(trem).connect(master);

    osc.start(now); osc.stop(now + dur + 0.05);
    osc5.start(now); osc5.stop(now + dur + 0.05);
    osc8.start(now); osc8.stop(now + dur + 0.05);
    vib.start(now); vib.stop(now + dur + 0.05);
    tremLfo.start(now); tremLfo.stop(now + dur + 0.05);
  }

  function playStep() {
    const p = paramsRef.current;
    const xy = touchRef.current;
    let degree = 0, oct = 0, velocity = 0.6, lightness = 50, hue = prism;

    if ((p.scanMode === "image" || p.scanMode === "hybrid") && blocksRef.current.length > 0) {
      const idx = stepRef.current % blocksRef.current.length;
      const b = blocksRef.current[idx];
      degree = b.degree;
      oct = b.oct;
      velocity = b.velocity;
      lightness = b.lightness;
      hue = b.hue;
    } else {
      degree = Math.floor(xy.x * Math.max(1, p.scaleIntervals.length - 1));
      oct = Math.floor((1 - xy.y) * 3) - 1;
      velocity = clamp(0.3 + (1 - xy.y) * 0.7, 0.1, 1);
      lightness = (1 - xy.y) * 100;
    }

    if (p.scanMode === "hybrid") {
      degree = Math.floor((degree + xy.x * Math.max(1, p.scaleIntervals.length - 1)) / 2);
      velocity = clamp((velocity + (0.35 + xy.x * 0.65)) / 2, 0.08, 1);
      lightness = (lightness + (1 - xy.y) * 100) / 2;
      hue = (hue + prism) / 2;
    }

    const baseMidi = freqToMidi(p.baseNote * (0.8 + xy.x * 0.8));
    const interval = p.scaleIntervals[degree % p.scaleIntervals.length] + 12 * oct;
    const freq = midiToFreq(baseMidi + interval);

    scheduleVoice(freq, velocity, lightness / 100, hue);
    updateEngineParams();
    stepRef.current = (stepRef.current + 1) % Math.max(1, blocksRef.current.length || 64);
  }

  function play() {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();
    triggerGate(true);
    drawVisualizer();
    const beatMs = 60000 / bpm;
    const stepMs = Math.max(18, beatMs / clamp(speed, 0.25, 8));
    if (stepTimerRef.current) clearInterval(stepTimerRef.current as any);
    stepTimerRef.current = window.setInterval(playStep, stepMs);
    setIsPlaying(true);
  }

  function stop() {
    cleanupAudio();
    triggerGate(false);
    setIsPlaying(false);
    try {
      const ctx = audioCtxRef.current;
      if (ctx && ctx.state === "running") ctx.suspend();
    } catch {}
  }

  useEffect(() => {
    if (!isPlaying) return;
    const beatMs = 60000 / bpm;
    const stepMs = Math.max(18, beatMs / clamp(speed, 0.25, 8));
    if (stepTimerRef.current) clearInterval(stepTimerRef.current as any);
    stepTimerRef.current = window.setInterval(playStep, stepMs);
    return () => { if (stepTimerRef.current) clearInterval(stepTimerRef.current as any); };
  }, [bpm, speed, isPlaying]);

  function drawImageMap() {
    const canvas = imageMapCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(3,7,18,0.96)";
    ctx.fillRect(0, 0, W, H);

    const data = imageDataRef.current;
    const imgW = imgWRef.current;
    const imgH = imgHRef.current;

    if (data && imgW && imgH) {
      const off = document.createElement("canvas");
      off.width = imgW;
      off.height = imgH;
      const octx = off.getContext("2d");
      if (octx) {
        octx.putImageData(new ImageData(new Uint8ClampedArray(data), imgW, imgH), 0, 0);
        const scale = Math.min(W / imgW, H / imgH);
        const dw = imgW * scale;
        const dh = imgH * scale;
        const dx = (W - dw) / 2;
        const dy = (H - dh) / 2;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(off, dx, dy, dw, dh);

        const cols = Math.max(1, colsRef.current || 1);
        const rows = Math.max(1, rowsRef.current || 1);
        const idx = stepRef.current % Math.max(1, blocksRef.current.length || 1);
        const rx = idx % cols;
        const ry = Math.floor(idx / cols);
        const cw = dw / cols;
        const ch = dh / rows;
        ctx.strokeStyle = `hsla(${prism},100%,60%,0.95)`;
        ctx.lineWidth = Math.max(2, Math.min(cw, ch) * 0.08);
        ctx.strokeRect(dx + rx * cw, dy + ry * ch, cw, ch);
      }
    } else {
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      for (let x = 0; x <= W; x += W / 8) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      }
      for (let y = 0; y <= H; y += H / 6) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
      }
      ctx.fillStyle = "rgba(148,163,184,0.65)";
      ctx.font = `${Math.max(14, W * 0.03)}px monospace`;
      ctx.textAlign = "center";
      ctx.fillText("UPLOAD IMAGE FOR MMSS BLOCK SCAN", W / 2, H / 2);
    }
  }

  function drawXYPad() {
    const canvas = xyCanvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = canvas.width, H = canvas.height;
    const { x, y, active } = touchRef.current;
    const hue = prism;

    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, `hsla(${hue}, 80%, 20%, 1)`);
    grad.addColorStop(1, `hsla(${(hue + 180) % 360}, 80%, 8%, 1)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    for (let gx = 0; gx < W; gx += W / 8) {
      ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
    }
    for (let gy = 0; gy < H; gy += H / 6) {
      ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    }

    const cx = x * W, cy = y * H;
    ctx.strokeStyle = active ? `hsla(${(hue + 180) % 360},100%,80%,0.95)` : "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(W, cy); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(10, Math.min(W, H) * 0.04), 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `hsla(${(hue + 180) % 360},100%,80%,0.18)`;
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `${Math.max(12, W * 0.024)}px monospace`;
    ctx.textAlign = "left";
    ctx.fillText(`X ${x.toFixed(2)}   Y ${y.toFixed(2)}`, 16, 24);
  }

  function drawVisualizer() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    let last = 0;

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      const now = performance.now();
      const targetMs = isInteracting ? 1000 / 30 : 1000 / 60;
      if (now - last < targetMs) return;
      last = now;

      analyser.getByteTimeDomainData(dataArray);
      const W = canvas.width, H = canvas.height;
      const bg = ctx.createLinearGradient(0, 0, W, H);
      bg.addColorStop(0, "rgba(2,6,23,1)");
      bg.addColorStop(1, "rgba(15,23,42,1)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      for (let x = 0; x < W; x += 24) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 24) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5,); ctx.stroke(); }

      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 14;
      ctx.shadowColor = `hsl(${prism}, 100%, 55%)`;
      ctx.strokeStyle = `hsl(${prism}, 100%, 62%)`;
      ctx.beginPath();
      const slice = W / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128;
        const y = (v * H) / 2 + (Math.random() - 0.5) * colorMix * 4;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (touchRef.current.active || xyHold) {
        const cx = touchRef.current.x * W;
        const cy = touchRef.current.y * H;
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(prism + 180) % 360},100%,80%,0.75)`;
        ctx.fill();
      }

      drawImageMap();
      drawXYPad();
    };
    draw();
  }

  function processImage(img: HTMLImageElement) {
    const maxW = 256, maxH = 256;
    const scale = Math.min(maxW / img.width, maxH / img.height, 1);
    const W = Math.max(1, Math.floor(img.width * scale));
    const H = Math.max(1, Math.floor(img.height * scale));
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const ictx = off.getContext("2d", { willReadFrequently: true } as any);
    if (!ictx) return;
    ictx.imageSmoothingEnabled = true;
    ictx.drawImage(img, 0, 0, W, H);
    const imgData = ictx.getImageData(0, 0, W, H);
    imageDataRef.current = imgData.data;
    imgWRef.current = W;
    imgHRef.current = H;
    stepRef.current = 0;
    buildBlocks();
    drawImageMap();
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (lastObjectUrlRef.current) {
        URL.revokeObjectURL(lastObjectUrlRef.current);
        lastObjectUrlRef.current = null;
      }
    } catch {}
    const url = URL.createObjectURL(file);
    lastObjectUrlRef.current = url;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try { processImage(img); }
      finally {
        try { URL.revokeObjectURL(url); lastObjectUrlRef.current = null; } catch {}
      }
    };
    img.src = url;
  }

  function analyzeImageQuick() {
    const data = imageDataRef.current;
    const W = imgWRef.current;
    const H = imgHRef.current;
    if (!data || !W || !H) return null;
    const stride = Math.max(1, Math.floor((W * H) / 8000));
    let Lsum = 0, Ssum = 0, count = 0;
    for (let i = 0; i < data.length; i += 4 * stride) {
      const { s } = rgbToHsv(data[i], data[i + 1], data[i + 2]);
      const { l } = rgbToHsl(data[i], data[i + 1], data[i + 2]);
      Lsum += l;
      Ssum += s;
      count++;
    }
    return { lightness: Lsum / count, saturation: Ssum / count, blocks: blocksRef.current.length };
  }

  function applyAutoTuning() {
    const m = analyzeImageQuick();
    if (!m) return;
    setPrism(Math.round(180 + m.saturation * 160));
    setCutoff(roundTo(800 + m.lightness * 28, 10));
    setColorMix(roundTo(clamp(0.2 + m.saturation * 0.7, 0, 1), 0.01));
    setSpeed(roundTo(clamp(0.75 + m.saturation * 3.5, 0.25, 8), 0.25));
    setBlockW(m.blocks > 200 ? 10 : 18);
    setBlockH(m.blocks > 200 ? 10 : 18);
  }

  function runDiagnostics() {
    const r: { name: string; pass: boolean; info?: string }[] = [];
    r.push({ name: "Audio context available", pass: !!((window as any).AudioContext || (window as any).webkitAudioContext) });
    r.push({ name: "midiToFreq(69)=440", pass: Math.abs(midiToFreq(69) - 440) < 1e-6, info: midiToFreq(69).toFixed(4) });
    r.push({ name: "freqToMidi(440)=69", pass: Math.abs(freqToMidi(440) - 69) < 1e-6, info: freqToMidi(440).toFixed(4) });
    r.push({ name: "Blocks built", pass: blocksRef.current.length >= 0, info: `${blocksRef.current.length}` });
    r.push({ name: "XY state valid", pass: touchRef.current.x >= 0 && touchRef.current.x <= 1 && touchRef.current.y >= 0 && touchRef.current.y <= 1 });
    initAudio();
    r.push({ name: "Analyser initialized", pass: !!analyserRef.current });
    r.push({ name: "Filter initialized", pass: !!filterRef.current });
    r.push({ name: "Delay initialized", pass: !!delayLRef.current && !!delayRRef.current });
    setDiagResults(r);
  }
  useEffect(() => { if (showDiag) runDiagnostics(); }, [showDiag, prism, cutoff, blockW, blockH]);

  function setXYFromClient(clientX: number, clientY: number, start = false) {
    const el = xyCanvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    touchRef.current = {
      x: clamp((clientX - rect.left) / rect.width, 0, 1),
      y: clamp((clientY - rect.top) / rect.height, 0, 1),
      active: true,
    };
    if (start && initialized) {
      initAudio();
      if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume();
      triggerGate(true);
    }
    updateEngineParams();
    drawXYPad();
  }

  function releaseXY() {
    if (xyHold) return;
    touchRef.current = { ...touchRef.current, active: false };
    triggerGate(false);
    drawXYPad();
  }

  useEffect(() => {
    function onResize() {
      [canvasRef.current, imageMapCanvasRef.current, xyCanvasRef.current].forEach((el) => {
        if (!el) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = el.getBoundingClientRect();
        el.width = Math.max(1, Math.floor(rect.width * dpr));
        el.height = Math.max(1, Math.floor(rect.height * dpr));
      });
      drawImageMap();
      drawXYPad();
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cleanupAudio();
    };
  }, []);

  useEffect(() => { drawImageMap(); }, [mapHeight, prism, blockW, blockH]);
  useEffect(() => { drawXYPad(); }, [prism, xyHold]);

  const ControlLabel = ({ title, hint }: { title: string; hint?: string }) => (
    <div className="text-[11px] uppercase tracking-[0.22em] text-slate-300 flex items-center justify-between gap-2">
      <span>{title}</span>
      {hint && <span className="text-slate-500 normal-case tracking-normal">{hint}</span>}
    </div>
  );

  const knobClass = "w-full accent-cyan-400";

  return (
    <div className="min-h-screen w-full bg-[#0a0908] text-white flex flex-col" style={{ ["--glow" as any]: `hsla(${prism}, 90%, 50%, 0.55)` }}>
      {!initialized && (
        <div className="fixed inset-0 z-20 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-3xl border border-cyan-500/20 bg-slate-950/80 shadow-2xl p-8 text-center">
            <div className="text-3xl md:text-4xl font-extralight tracking-[0.45em] text-cyan-300">PRISMATIC CORE</div>
            <div className="mt-4 text-sm text-slate-400 leading-6">
              Standalone audio-wave controller for MMSS and drawscope experiments.<br />
              XY pad, prismatic synthesis, block scan sonification, realtime scope.
            </div>
            <button
              onClick={() => { initAudio(); setInitialized(true); drawXYPad(); drawImageMap(); }}
              className="mt-8 px-6 py-3 rounded-2xl border border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-200 tracking-[0.2em] text-sm"
            >
              INITIALIZE SYSTEM
            </button>
            <div className="mt-5 text-xs text-slate-500">Warning: high intensity audio-visual output. Use headphones.</div>
          </div>
        </div>
      )}

      <header className="px-6 py-4 border-b border-slate-800 bg-slate-950/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => (isPlaying ? stop() : play())}
              className={`px-4 py-2 rounded-2xl border transition ${isPlaying ? "bg-rose-500/10 border-rose-400/30 hover:bg-rose-500/20" : "bg-cyan-500/10 border-cyan-400/30 hover:bg-cyan-500/20"}`}
            >
              {isPlaying ? "Stop" : "Play"}
            </button>
            <label className="px-3 py-2 rounded-2xl border border-slate-800 bg-slate-900/60 cursor-pointer hover:bg-slate-900 text-sm">
              Upload Image
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            <button onClick={applyAutoTuning} className="px-3 py-2 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-sm">
              Auto Tune
            </button>
            <button onClick={() => setShowDiag((v) => !v)} className="px-3 py-2 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-sm">
              {showDiag ? "Hide Diagnostics" : "Show Diagnostics"}
            </button>
          </div>
          <div className="text-xs tracking-[0.2em] text-slate-400 uppercase">MMSS / Drawscope Controller</div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-[1.3fr_0.9fr] gap-6 p-6">
          <section className="rounded-[28px] border border-slate-800 bg-slate-900/40 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-200">Drawscope</div>
                <div className="text-xs text-slate-500">Oscilloscope + crosshair feedback + hybrid image scan</div>
              </div>
              <div className="text-xs text-slate-500">Hue {Math.round(prism)}°</div>
            </div>
            <canvas ref={canvasRef} className="block w-full h-[320px] md:h-[420px]" />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 border-t border-slate-800">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                  <span>MMSS Image Map</span>
                  <span className="flex items-center gap-2">
                    <span>Height</span>
                    <input type="range" min={120} max={420} step={10} value={mapHeight} onInput={(e: any) => setMapHeight(parseInt(e.target.value))} className="accent-cyan-400" />
                  </span>
                </div>
                <canvas ref={imageMapCanvasRef} className="block w-full rounded-xl" style={{ height: `${mapHeight}px` }} />
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <div className="flex items-center justify-between mb-2 text-xs text-slate-400">
                  <span>XY Audio Pad</span>
                  <button onClick={() => setXyHold((v) => !v)} className={`px-2 py-1 rounded-lg border text-[11px] ${xyHold ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200" : "border-slate-700 bg-slate-900 text-slate-300"}`}>
                    {xyHold ? "Hold On" : "Hold Off"}
                  </button>
                </div>
                <canvas
                  ref={xyCanvasRef}
                  className="block w-full h-[240px] rounded-xl touch-none cursor-crosshair"
                  onMouseDown={(e) => { setIsInteracting(true); setXYFromClient(e.clientX, e.clientY, true); }}
                  onMouseMove={(e) => { if (touchRef.current.active || xyHold) setXYFromClient(e.clientX, e.clientY, false); }}
                  onMouseUp={() => { setIsInteracting(false); releaseXY(); }}
                  onMouseLeave={() => { setIsInteracting(false); releaseXY(); }}
                  onTouchStart={(e) => { setIsInteracting(true); setXYFromClient(e.touches[0].clientX, e.touches[0].clientY, true); }}
                  onTouchMove={(e) => { setXYFromClient(e.touches[0].clientX, e.touches[0].clientY, false); }}
                  onTouchEnd={() => { setIsInteracting(false); releaseXY(); }}
                />
                <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                  <div className="rounded-xl border border-slate-800 p-2">Pitch: Y-axis</div>
                  <div className="rounded-xl border border-slate-800 p-2">FM Depth: X-axis</div>
                  <div className="rounded-xl border border-slate-800 p-2">Gate: touch / hold</div>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-slate-800 bg-slate-900/40 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800">
              <div className="text-sm text-slate-200">Wave Controller</div>
              <div className="text-xs text-slate-500">Standalone merged synth + sonification engine</div>
            </div>

            <div
              className="p-4 space-y-6"
              onMouseDown={() => setIsInteracting(true)}
              onMouseUp={() => setIsInteracting(false)}
              onMouseLeave={() => setIsInteracting(false)}
              onTouchStart={() => setIsInteracting(true)}
              onTouchEnd={() => setIsInteracting(false)}
            >
              <div>
                <ControlLabel title="Scan Mode" hint={scanMode} />
                <select value={scanMode} onChange={(e) => setScanMode(e.target.value as any)} className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
                  <option value="image">Image</option>
                  <option value="xy">XY</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><ControlLabel title="Volume" hint={`${Math.round(volume * 100)}%`} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={volume} onInput={(e: any) => setVolume(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="BPM" hint={`${bpm}`} /><input className={knobClass} type="range" min={40} max={240} step={1} value={bpm} onInput={(e: any) => setBpm(parseInt(e.target.value))} /></div>
                <div><ControlLabel title="Speed" hint={`×${speed.toFixed(2)}`} /><input className={knobClass} type="range" min={0.25} max={8} step={0.25} value={speed} onInput={(e: any) => setSpeed(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Decay" hint={`${release.toFixed(2)}s`} /><input className={knobClass} type="range" min={0.05} max={5} step={0.05} value={release} onInput={(e: any) => setRelease(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Base Note" hint={`${Math.round(baseNote)} Hz`} /><input className={knobClass} type="range" min={55} max={880} step={1} value={baseNote} onInput={(e: any) => setBaseNote(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Note Length" hint={`×${noteMult.toFixed(2)}`} /><input className={knobClass} type="range" min={0.2} max={2} step={0.05} value={noteMult} onInput={(e: any) => setNoteMult(parseFloat(e.target.value))} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <ControlLabel title="Osc Type" />
                  <select value={oscType} onChange={(e) => setOscType(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm">
                    {['sine','square','sawtooth','triangle'].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <ControlLabel title="Scale" />
                  <select value={scaleName} onChange={(e) => setScaleName(e.target.value)} className="w-full bg-slate-950/60 border border-slate-800 rounded-2xl px-3 py-2 text-sm">
                    {scales.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><ControlLabel title="Prism" hint={`${Math.round(prism)}°`} /><input className={knobClass} type="range" min={0} max={360} step={1} value={prism} onInput={(e: any) => setPrism(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Morph" hint={shape.toFixed(2)} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={shape} onInput={(e: any) => setShape(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Detune" hint={`${Math.round(detune)} ct`} /><input className={knobClass} type="range" min={0} max={2400} step={1} value={detune} onInput={(e: any) => setDetune(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Color Mix" hint={`${Math.round(colorMix * 100)}%`} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={colorMix} onInput={(e: any) => setColorMix(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Cutoff" hint={`${Math.round(cutoff)} Hz`} /><input className={knobClass} type="range" min={20} max={12000} step={10} value={cutoff} onInput={(e: any) => setCutoff(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Resonance" hint={resonance.toFixed(2)} /><input className={knobClass} type="range" min={0.3} max={20} step={0.1} value={resonance} onInput={(e: any) => setResonance(parseFloat(e.target.value))} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><ControlLabel title="Drive" hint={`${Math.round(drive * 100)}%`} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={drive} onInput={(e: any) => setDrive(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Delay Mix" hint={`${Math.round(delayMix * 100)}%`} /><input className={knobClass} type="range" min={0} max={0.9} step={0.01} value={delayMix} onInput={(e: any) => setDelayMix(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Delay L" hint={`${delayTimeL.toFixed(2)}s`} /><input className={knobClass} type="range" min={0.05} max={1.2} step={0.01} value={delayTimeL} onInput={(e: any) => setDelayTimeL(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Delay R" hint={`${delayTimeR.toFixed(2)}s`} /><input className={knobClass} type="range" min={0.05} max={1.2} step={0.01} value={delayTimeR} onInput={(e: any) => setDelayTimeR(parseFloat(e.target.value))} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><ControlLabel title="Vibrato Rate" hint={`${vibratoRate.toFixed(1)} Hz`} /><input className={knobClass} type="range" min={0} max={12} step={0.1} value={vibratoRate} onInput={(e: any) => setVibratoRate(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Vibrato Depth" hint={`${vibratoDepth.toFixed(1)} ct`} /><input className={knobClass} type="range" min={0} max={50} step={0.5} value={vibratoDepth} onInput={(e: any) => setVibratoDepth(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Tremolo Rate" hint={`${tremoloRate.toFixed(1)} Hz`} /><input className={knobClass} type="range" min={0} max={20} step={0.1} value={tremoloRate} onInput={(e: any) => setTremoloRate(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Tremolo Depth" hint={`${Math.round(tremoloDepth * 100)}%`} /><input className={knobClass} type="range" min={0} max={0.95} step={0.01} value={tremoloDepth} onInput={(e: any) => setTremoloDepth(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="5th Level" hint={`${Math.round(fifthLevel * 100)}%`} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={fifthLevel} onInput={(e: any) => setFifthLevel(parseFloat(e.target.value))} /></div>
                <div><ControlLabel title="Octave Level" hint={`${Math.round(octaveLevel * 100)}%`} /><input className={knobClass} type="range" min={0} max={1} step={0.01} value={octaveLevel} onInput={(e: any) => setOctaveLevel(parseFloat(e.target.value))} /></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div><ControlLabel title="Block Width" hint={`${blockW}px`} /><input className={knobClass} type="range" min={1} max={32} step={1} value={blockW} onInput={(e: any) => setBlockW(parseInt(e.target.value))} /></div>
                <div><ControlLabel title="Block Height" hint={`${blockH}px`} /><input className={knobClass} type="range" min={1} max={32} step={1} value={blockH} onInput={(e: any) => setBlockH(parseInt(e.target.value))} /></div>
              </div>

              {showDiag && (
                <div className="text-[11px] leading-relaxed text-slate-300 bg-slate-950/40 border border-slate-800 rounded-2xl p-3 space-y-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Diagnostics</div>
                  <ul className="space-y-1">
                    {diagResults.map((r, i) => (
                      <li key={i} className="flex items-center justify-between gap-4">
                        <span>{r.name}</span>
                        <span className={r.pass ? "text-emerald-400" : "text-rose-400"}>{r.pass ? "PASS" : "FAIL"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <footer className="px-6 py-4 border-t border-slate-800 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>Hybrid controller: image blocks + XY gesture + prism-driven synthesis.</div>
          <div>Use smaller blocks for denser scans and XY hold for drone experiments.</div>
        </div>
      </footer>
    </div>
  );
}
