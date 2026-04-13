import { useEffect, useRef } from "react";
import { getThemePalette, toRgba } from "../mmss/utils";

function StageCanvas({
  vision,
  scene,
  imagePreview,
  imageAnalysis,
  analyserNode,
  onDropFile,
  statusText,
}) {
  const stageRef = useRef(null);
  const scopeRef = useRef(null);
  const wrapperRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const analyserDataRef = useRef(null);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    let frameId = 0;

    const draw = (now) => {
      renderStage(now);
      renderScope();
      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(frameId);
  });

  function resize() {
    [stageRef.current, scopeRef.current].forEach((canvas) => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
    });
  }

  function renderStage(now) {
    const canvas = stageRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    const palette = getThemePalette(vision.theme);

    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, palette.fillA);
    gradient.addColorStop(1, palette.fillB);
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    context.save();
    context.globalAlpha = 0.08 + vision.overlayDensity * 0.24;
    for (let index = 0; index < 14 + Math.floor(vision.overlayDensity * 30); index += 1) {
      const x = (index / 14) * width;
      const wave = Math.sin(now * 0.001 + index * 0.6) * height * 0.04 * vision.depth;
      context.strokeStyle = palette.noise;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(x, 0);
      context.bezierCurveTo(x + 40, height * 0.25 + wave, x - 35, height * 0.7 - wave, x + 12, height);
      context.stroke();
    }
    context.restore();

    context.save();
    context.globalAlpha = 0.12 + vision.noise * 0.16;
    for (let index = 0; index < 100 + Math.floor(vision.noise * 180); index += 1) {
      context.fillStyle = toRgba(palette.noise, 0.08 + Math.random() * 0.2);
      context.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    }
    context.restore();

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const radius = Math.min(width, height) * (0.22 + vision.depth * 0.22);
    const ringPulse = (Math.sin(now * 0.002) * 0.5 + 0.5) * (0.12 + vision.glow * 0.12);

    context.save();
    context.strokeStyle = toRgba(palette.primary, 0.22 + ringPulse);
    context.lineWidth = 2.4;
    context.beginPath();
    context.arc(centerX, centerY, radius + ringPulse * 24, 0, Math.PI * 2);
    context.stroke();
    context.restore();

    context.save();
    context.globalAlpha = 0.22 + vision.glow * 0.28;
    const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 1.7);
    glow.addColorStop(0, toRgba(palette.primary, 0.28 + vision.glow * 0.24));
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    context.restore();

    context.save();
    context.strokeStyle = toRgba(palette.accent, 0.24 + vision.overlayDensity * 0.25);
    const bands = 5 + Math.floor(vision.overlayDensity * 5);
    for (let index = 0; index < bands; index += 1) {
      const inset = 18 + index * 18;
      context.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    }
    context.restore();
  }

  function renderScope() {
    const canvas = scopeRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.width / ratio;
    const height = canvas.height / ratio;
    context.fillStyle = "rgba(0, 0, 0, 0.1)";
    context.fillRect(0, 0, width, height);

    if (!analyserNode) return;

    if (!analyserDataRef.current || analyserDataRef.current.length !== analyserNode.frequencyBinCount) {
      analyserDataRef.current = new Uint8Array(analyserNode.frequencyBinCount);
    }

    analyserNode.getByteTimeDomainData(analyserDataRef.current);
    context.lineWidth = 2;
    context.strokeStyle = getThemePalette(vision.theme).primary;
    context.shadowBlur = 12;
    context.shadowColor = context.strokeStyle;
    context.beginPath();
    const sliceWidth = width / analyserDataRef.current.length;
    let x = 0;
    for (let index = 0; index < analyserDataRef.current.length; index += 1) {
      const value = analyserDataRef.current[index] / 128;
      const y = (value * height) / 2;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
      x += sliceWidth;
    }
    context.stroke();
    context.shadowBlur = 0;
  }

  function showDropBanner() {
    if (!wrapperRef.current) return;
    wrapperRef.current.dataset.drag = "true";
    clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = window.setTimeout(() => {
      if (wrapperRef.current) wrapperRef.current.dataset.drag = "false";
    }, 900);
  }

  return (
    <div
      className="visual-stage"
      ref={wrapperRef}
      onDragOver={(event) => {
        event.preventDefault();
        showDropBanner();
      }}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) onDropFile(file);
      }}
    >
      <canvas className="stage-canvas" ref={stageRef} />
      <canvas className="scope-canvas" ref={scopeRef} />
      <div className="stage-ui">
        <div className="stage-banner visible">{scene.replace(/_/g, " ")}</div>
        <div className="stage-corner">
          <div className="stage-meta">
            <strong>Unified Next-Level MMSS</strong>
            <p>{statusText}</p>
          </div>
          {imagePreview ? (
            <img className="preview-thumb visible" src={imagePreview} alt="Vision preview" />
          ) : (
            <div className="preview-placeholder">Drop image here</div>
          )}
        </div>
        {imageAnalysis ? (
          <div className="stage-overlay-note">
            Theme {imageAnalysis.theme} | contrast {imageAnalysis.contrast.toFixed(2)} | edge {imageAnalysis.edgeDensity.toFixed(2)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default StageCanvas;
