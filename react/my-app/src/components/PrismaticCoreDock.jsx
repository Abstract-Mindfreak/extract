import { useEffect, useMemo, useRef, useState } from "react";
import { cutoffToHz, getThemePalette, percentLabel, rangeLabel, toRgba } from "../mmss/utils";

const SCALES = ["Pentatonic", "Major", "Minor", "Blues", "Chromatic", "Whole Tone"];
const SCAN_MODES = ["image", "xy", "hybrid"];

function PrismaticCoreDock({
  audio,
  vision,
  transport,
  orbit,
  initialized,
  imagePreview,
  imageAnalysis,
  onTogglePlaying,
  onFileSelect,
  onAutoTune,
  onAudioChange,
  onVisionChange,
  onTransportChange,
  onOrbitChange,
  onApplyImageMap,
}) {
  const imageCanvasRef = useRef(null);
  const xyCanvasRef = useRef(null);
  const imageRef = useRef(null);
  const [scanMode, setScanMode] = useState("hybrid");
  const [scaleMode, setScaleMode] = useState("Pentatonic");
  const [xyHold, setXyHold] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [xyPoint, setXyPoint] = useState({ x: 0.5, y: 0.5, active: false });

  const palette = getThemePalette(vision.theme);
  const prismHue = Math.round(audio.prism * 360);
  const leftForce = Math.round(cutoffToHz(audio.cutoff));
  const rightForce = Math.round(110 + audio.prism * 770 + audio.colorAmt * 180);
  const beatForce = Math.abs(rightForce - leftForce) / 100;
  const activeBlock = transport.playhead % 24;
  const imageMeta = imageAnalysis
    ? `${imageAnalysis.theme} · contrast ${imageAnalysis.contrast.toFixed(2)}`
    : imagePreview
      ? "Vision source loaded"
      : "No image loaded";

  const diagnostics = useMemo(
    () => [
      { label: "Audio core initialized", pass: initialized },
      { label: "Vision source present", pass: Boolean(imagePreview) },
      { label: "Image analysis ready", pass: Boolean(imageAnalysis) },
      { label: "Orbit system armed", pass: orbit.enabled },
      { label: "Theme palette mapped", pass: Boolean(palette.primary), info: vision.theme },
      { label: "Scan mode", pass: true, info: scanMode },
      { label: "Scale mode", pass: true, info: scaleMode },
    ],
    [imageAnalysis, imagePreview, initialized, orbit.enabled, palette.primary, scanMode, scaleMode, vision.theme]
  );

  useEffect(() => {
    if (!imagePreview) {
      imageRef.current = null;
      drawImageMap(imageCanvasRef.current, null, activeBlock, prismHue);
      return;
    }

    const nextImage = new Image();
    nextImage.onload = () => {
      imageRef.current = nextImage;
      drawImageMap(imageCanvasRef.current, nextImage, activeBlock, prismHue);
    };
    nextImage.src = imagePreview;
  }, [activeBlock, imagePreview, prismHue]);

  useEffect(() => {
    drawImageMap(imageCanvasRef.current, imageRef.current, activeBlock, prismHue);
  }, [activeBlock, prismHue]);

  useEffect(() => {
    drawXYPad(xyCanvasRef.current, palette, prismHue, xyPoint, xyHold);
  }, [palette, prismHue, xyHold, xyPoint]);

  useEffect(() => {
    const handleResize = () => {
      drawImageMap(imageCanvasRef.current, imageRef.current, activeBlock, prismHue);
      drawXYPad(xyCanvasRef.current, palette, prismHue, xyPoint, xyHold);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [activeBlock, palette, prismHue, xyHold, xyPoint]);

  function applyXY(clientX, clientY, active = true) {
    const canvas = xyCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clamp((clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((clientY - rect.top) / rect.height, 0, 1);
    setXyPoint({ x, y, active });
    onAudioChange("colorAmt", x);
    onAudioChange("cutoff", clamp(1 - y * 0.92, 0, 1));
    onVisionChange("depth", clamp(0.2 + (1 - y) * 0.8, 0, 1));
    onVisionChange("glow", clamp(0.16 + x * 0.84, 0, 1));
  }

  function handlePointerStart(event) {
    applyXY(event.clientX, event.clientY, true);
  }

  function handlePointerMove(event) {
    if (!xyPoint.active && !xyHold) return;
    applyXY(event.clientX, event.clientY, true);
  }

  function handlePointerEnd() {
    if (xyHold) return;
    setXyPoint((current) => ({ ...current, active: false }));
  }

  return (
    <div className="prismatic-dock">
      <div className="dock-header">
        <div className="dock-eyebrow">Audio Field Lab</div>
        <h3>Hybrid Control Dock</h3>
        <p>
          React port of the Prismatic Core dock: collision readouts, image scan preview, XY pad,
          and quick engine control wired into MMSS state.
        </p>
      </div>

      <div className="dock-actions">
        <button className={`dock-btn ${transport.playing ? "active" : ""}`} onClick={onTogglePlaying}>
          {transport.playing ? "Stop Sequence" : "Play Sequence"}
        </button>
        <label className="dock-file">
          Upload Image
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileSelect(file);
            }}
          />
        </label>
        <button className="dock-btn" onClick={onAutoTune}>
          Auto Tune
        </button>
        <button
          className={`dock-btn ${diagnosticsOpen ? "active" : ""}`}
          onClick={() => setDiagnosticsOpen((value) => !value)}
        >
          Diagnostics
        </button>
      </div>

      <div className="dock-panel">
        <div className="panel-title">Mode Matrix</div>
        <div className="panel-subtitle">
          Use the image map for stepped vision binding, the XY pad for quick morphing, and the
          orbit layer for collision-style movement.
        </div>
        <div className="toggle-strip">
          <select className="mini-select" value={scanMode} onChange={(event) => setScanMode(event.target.value)}>
            {SCAN_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
          <select className="mini-select" value={scaleMode} onChange={(event) => setScaleMode(event.target.value)}>
            {SCALES.map((scale) => (
              <option key={scale} value={scale}>
                {scale}
              </option>
            ))}
          </select>
          <button className={`mini-toggle ${xyHold ? "active" : ""}`} onClick={() => setXyHold((value) => !value)}>
            {xyHold ? "Hold On" : "Hold Off"}
          </button>
        </div>
        <div className="mode-actions">
          <button className="dock-btn" onClick={() => onApplyImageMap(scanMode, scaleMode)}>
            Apply Image Map
          </button>
        </div>
      </div>

      <div className="dock-panel">
        <div className="panel-title">Collision Readouts</div>
        <div className="readout-grid">
          <div className="readout-card">
            <span>Left Force</span>
            <strong>{leftForce} Hz</strong>
          </div>
          <div className="readout-card">
            <span>Beat</span>
            <strong>{beatForce.toFixed(1)} Hz</strong>
          </div>
          <div className="readout-card">
            <span>Right Force</span>
            <strong>{rightForce} Hz</strong>
          </div>
        </div>
      </div>

      <div className="canvas-stack">
        <div className="canvas-card">
          <header>
            <span>MMSS Image Map</span>
            <span>{imageMeta}</span>
          </header>
          <canvas ref={imageCanvasRef} className="dock-canvas image-map-canvas" />
        </div>
        <div className="canvas-card">
          <header>
            <span>XY Audio Pad</span>
            <span>
              X {xyPoint.x.toFixed(2)} · Y {xyPoint.y.toFixed(2)}
            </span>
          </header>
          <canvas
            ref={xyCanvasRef}
            className="dock-canvas xy-pad-canvas"
            onPointerDown={handlePointerStart}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          />
          <div className="canvas-hints">
            <div>Cutoff follows Y-axis</div>
            <div>Glow and color follow X-axis</div>
            <div>{scanMode === "image" ? "Image-first scan mode" : scanMode === "xy" ? "Gesture-first scan mode" : "Hybrid routing active"}</div>
          </div>
        </div>
      </div>

      <div className="dock-panel">
        <div className="panel-title">Transport + Engine</div>
        <div className="range-grid">
          <RangeRow
            label="BPM"
            value={transport.bpm}
            min={64}
            max={180}
            step={1}
            readout={rangeLabel("bpm", transport.bpm)}
            onChange={(value) => onTransportChange("bpm", value)}
          />
          <RangeRow
            label="Orbit Speed"
            value={orbit.speed}
            min={0.1}
            max={2}
            step={0.01}
            readout={rangeLabel("speed", orbit.speed)}
            onChange={(value) => onOrbitChange("speed", value)}
          />
          <RangeRow
            label="Collision Mix"
            value={orbit.collisionIntensity}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(orbit.collisionIntensity)}
            onChange={(value) => onOrbitChange("collisionIntensity", value)}
          />
          <RangeRow
            label="Visual Weight"
            value={orbit.visualWeight}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(orbit.visualWeight)}
            onChange={(value) => onOrbitChange("visualWeight", value)}
          />
          <RangeRow
            label="UI Depth"
            value={vision.depth}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(vision.depth)}
            onChange={(value) => onVisionChange("depth", value)}
          />
          <RangeRow
            label="Overlay"
            value={vision.overlayDensity}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(vision.overlayDensity)}
            onChange={(value) => onVisionChange("overlayDensity", value)}
          />
        </div>
      </div>

      <div className="dock-panel">
        <div className="panel-title">Prismatic Voice</div>
        <div className="range-grid">
          <RangeRow
            label="Prism"
            value={audio.prism}
            min={0}
            max={1}
            step={0.01}
            readout={`${prismHue}°`}
            onChange={(value) => onAudioChange("prism", value)}
          />
          <RangeRow
            label="Morph"
            value={audio.morph}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(audio.morph)}
            onChange={(value) => onAudioChange("morph", value)}
          />
          <RangeRow
            label="Detune"
            value={audio.detune}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(audio.detune)}
            onChange={(value) => onAudioChange("detune", value)}
          />
          <RangeRow
            label="Cutoff"
            value={audio.cutoff}
            min={0}
            max={1}
            step={0.01}
            readout={rangeLabel("cutoff", audio.cutoff)}
            onChange={(value) => onAudioChange("cutoff", value)}
          />
          <RangeRow
            label="Resonance"
            value={audio.res}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(audio.res)}
            onChange={(value) => onAudioChange("res", value)}
          />
          <RangeRow
            label="Color Amount"
            value={audio.colorAmt}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(audio.colorAmt)}
            onChange={(value) => onAudioChange("colorAmt", value)}
          />
          <RangeRow
            label="Decay"
            value={audio.decay}
            min={0}
            max={1}
            step={0.01}
            readout={rangeLabel("decay", audio.decay)}
            onChange={(value) => onAudioChange("decay", value)}
          />
          <RangeRow
            label="Glow"
            value={vision.glow}
            min={0}
            max={1}
            step={0.01}
            readout={percentLabel(vision.glow)}
            onChange={(value) => onVisionChange("glow", value)}
          />
        </div>
        <div className={`diag-results ${diagnosticsOpen ? "active" : ""}`}>
          {diagnostics.map((row) => (
            <div className="diag-row" key={row.label}>
              <span>
                {row.label}
                {row.info ? ` · ${row.info}` : ""}
              </span>
              <strong className={row.pass ? "diag-pass" : "diag-fail"}>{row.pass ? "PASS" : "FAIL"}</strong>
            </div>
          ))}
        </div>
      </div>

      <div className="dock-footer">
        Hybrid controller ported from Prismatic Core: direct XY shaping, image-step preview, and
        collision-style readouts merged into the MMSS React app.
      </div>
    </div>
  );
}

function RangeRow({ label, value, min, max, step, readout, onChange }) {
  return (
    <div className="range-row">
      <label>
        {label}
        <output>{readout}</output>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

function drawImageMap(canvas, image, activeBlock, prismHue) {
  const context = prepareCanvas(canvas);
  if (!context) return;
  const width = canvas.width / getRatio();
  const height = canvas.height / getRatio();

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(2, 7, 16, 0.98)";
  context.fillRect(0, 0, width, height);

  if (image) {
    const scale = Math.min(width / image.width, height / image.height);
    const drawWidth = image.width * scale;
    const drawHeight = image.height * scale;
    const drawX = (width - drawWidth) / 2;
    const drawY = (height - drawHeight) / 2;
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    const cols = 6;
    const rows = 4;
    const cellWidth = drawWidth / cols;
    const cellHeight = drawHeight / rows;
    const highlightX = activeBlock % cols;
    const highlightY = Math.floor(activeBlock / cols) % rows;
    context.strokeStyle = `hsla(${prismHue}, 100%, 62%, 0.95)`;
    context.lineWidth = Math.max(2, Math.min(cellWidth, cellHeight) * 0.08);
    context.strokeRect(drawX + highlightX * cellWidth, drawY + highlightY * cellHeight, cellWidth, cellHeight);
    return;
  }

  context.strokeStyle = "rgba(164, 188, 214, 0.24)";
  for (let x = 0; x <= width; x += width / 8) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y <= height; y += height / 6) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }
  context.fillStyle = "rgba(210, 224, 245, 0.6)";
  context.font = `${Math.max(12, width * 0.028)}px monospace`;
  context.textAlign = "center";
  context.fillText("UPLOAD IMAGE FOR BLOCK SCAN", width / 2, height / 2);
}

function drawXYPad(canvas, palette, prismHue, point, holdEnabled) {
  const context = prepareCanvas(canvas);
  if (!context) return;
  const width = canvas.width / getRatio();
  const height = canvas.height / getRatio();

  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, toRgba(palette.primary, 0.34));
  gradient.addColorStop(1, `hsla(${(prismHue + 180) % 360}, 80%, 8%, 1)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(255,255,255,0.08)";
  for (let x = 0; x < width; x += width / 8) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }
  for (let y = 0; y < height; y += height / 6) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.stroke();
  }

  const cursorX = point.x * width;
  const cursorY = point.y * height;
  context.strokeStyle = holdEnabled || point.active ? palette.accent : "rgba(255,255,255,0.4)";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(cursorX, 0);
  context.lineTo(cursorX, height);
  context.stroke();
  context.beginPath();
  context.moveTo(0, cursorY);
  context.lineTo(width, cursorY);
  context.stroke();
  context.beginPath();
  context.arc(cursorX, cursorY, Math.max(10, Math.min(width, height) * 0.04), 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = toRgba(palette.accent, 0.18);
  context.fill();

  context.fillStyle = "rgba(255,255,255,0.75)";
  context.font = `${Math.max(12, width * 0.024)}px monospace`;
  context.textAlign = "left";
  context.fillText(`X ${point.x.toFixed(2)}  Y ${point.y.toFixed(2)}`, 16, 24);
}

function prepareCanvas(canvas) {
  if (!canvas) return null;
  const context = canvas.getContext?.("2d");
  if (!context) return null;
  const rect = canvas.getBoundingClientRect();
  const ratio = getRatio();
  const nextWidth = Math.max(1, Math.floor(rect.width * ratio));
  const nextHeight = Math.max(1, Math.floor(rect.height * ratio));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  }
  return context;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRatio() {
  return window.devicePixelRatio || 1;
}

export default PrismaticCoreDock;
