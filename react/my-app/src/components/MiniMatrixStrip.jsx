import { useEffect, useRef, useState } from "react";
import { GRID_COLS, GRID_ROWS } from "../mmss/config";

function MiniMatrixStrip({ grid, playhead, onOpenAdvanced }) {
  const canvasRef = useRef(null);
  const [hoverInfo, setHoverInfo] = useState("");

  useEffect(() => {
    const handleResize = () => drawMiniMatrix(canvasRef.current, grid, playhead);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [grid, playhead]);

  function handlePointerMove(event) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const column = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(((event.clientX - rect.left) / rect.width) * GRID_COLS)));
    const row = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(((event.clientY - rect.top) / rect.height) * GRID_ROWS)));
    const active = grid[column][row] ? "On" : "Off";
    setHoverInfo(`Step ${column + 1} · Row ${GRID_ROWS - row} · ${active}`);
  }

  return (
    <div className="mini-matrix-strip">
      <div className="mini-strip-head">
        <strong>Pattern Strip</strong>
        <button className="mini-link" onClick={onOpenAdvanced}>
          Open Full Matrix
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="mini-matrix-canvas"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverInfo("")}
        onClick={onOpenAdvanced}
      />
      <div className="mini-strip-foot">
        <span>{hoverInfo || "Compact view of the 24 x 12 pattern."}</span>
        <strong>Playhead {playhead + 1}</strong>
      </div>
    </div>
  );
}

export default MiniMatrixStrip;

function drawMiniMatrix(canvas, grid, playhead) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const cellWidth = width / GRID_COLS;
  const cellHeight = height / GRID_ROWS;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(7, 11, 18, 0.92)";
  context.fillRect(0, 0, width, height);

  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      if (!grid[col][row]) continue;
      context.fillStyle = `hsla(${120 + row * 11}, 90%, 64%, 0.92)`;
      context.fillRect(col * cellWidth + 1, row * cellHeight + 1, cellWidth - 2, cellHeight - 2);
    }
  }

  context.fillStyle = "rgba(132, 231, 255, 0.2)";
  context.fillRect(playhead * cellWidth, 0, cellWidth, height);
  context.strokeStyle = "rgba(255, 213, 106, 0.95)";
  context.beginPath();
  context.moveTo(playhead * cellWidth + cellWidth / 2, 0);
  context.lineTo(playhead * cellWidth + cellWidth / 2, height);
  context.stroke();
}
