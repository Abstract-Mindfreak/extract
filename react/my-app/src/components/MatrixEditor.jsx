import { useEffect, useRef } from "react";
import { GRID_COLS, GRID_ROWS } from "../mmss/config";
import { getStageGridCell } from "../mmss/utils";

function MatrixEditor({ grid, playhead, onCellPaint }) {
  const canvasRef = useRef(null);
  const drawModeRef = useRef(1);
  const drawingRef = useRef(false);

  useEffect(() => {
    const handleResize = () => resizeCanvas(canvasRef.current, grid, playhead);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [grid, playhead]);

  function paint(clientX, clientY, fresh) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const { column, row } = getStageGridCell(clientX, clientY, rect);
    if (column < 0 || column >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;

    if (fresh) {
      drawingRef.current = true;
      drawModeRef.current = grid[column][row] ? 0 : 1;
    }

    onCellPaint(column, row, drawModeRef.current);
  }

  return (
    <canvas
      id="grid-canvas"
      ref={canvasRef}
      onMouseDown={(event) => paint(event.clientX, event.clientY, true)}
      onMouseMove={(event) => {
        if (drawingRef.current) paint(event.clientX, event.clientY, false);
      }}
      onMouseUp={() => {
        drawingRef.current = false;
      }}
      onMouseLeave={() => {
        drawingRef.current = false;
      }}
      onTouchStart={(event) => {
        event.preventDefault();
        const touch = event.touches[0];
        if (touch) paint(touch.clientX, touch.clientY, true);
      }}
      onTouchMove={(event) => {
        event.preventDefault();
        const touch = event.touches[0];
        if (drawingRef.current && touch) paint(touch.clientX, touch.clientY, false);
      }}
      onTouchEnd={() => {
        drawingRef.current = false;
      }}
    />
  );
}

export default MatrixEditor;

function resizeCanvas(canvas, grid, playhead) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
  drawMatrix(canvas, grid, playhead);
}

function drawMatrix(canvas, grid, playhead) {
  if (!canvas) return;
  const context = canvas.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.width / ratio;
  const height = canvas.height / ratio;
  const cellWidth = width / GRID_COLS;
  const cellHeight = height / GRID_ROWS;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "rgba(8, 11, 18, 1)";
  context.fillRect(0, 0, width, height);

  for (let col = 0; col < GRID_COLS; col += 1) {
    for (let row = 0; row < GRID_ROWS; row += 1) {
      context.strokeStyle = "rgba(255, 255, 255, 0.05)";
      context.strokeRect(col * cellWidth, row * cellHeight, cellWidth, cellHeight);
      if (grid[col][row]) {
        const hue = Math.round((row / GRID_ROWS) * 220 + 100);
        context.fillStyle = `hsla(${hue}, 90%, 62%, 0.85)`;
        context.fillRect(col * cellWidth + 2, row * cellHeight + 2, cellWidth - 4, cellHeight - 4);
      }
    }
  }

  context.fillStyle = "rgba(132, 231, 255, 0.18)";
  context.fillRect(playhead * cellWidth, 0, cellWidth, height);
  context.strokeStyle = "rgba(255, 213, 106, 0.95)";
  context.beginPath();
  context.moveTo(playhead * cellWidth + cellWidth / 2, 0);
  context.lineTo(playhead * cellWidth + cellWidth / 2, height);
  context.stroke();
}
