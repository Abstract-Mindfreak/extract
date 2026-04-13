import { useRef } from "react";

function HeaderBar({
  level,
  scene,
  visionBound,
  orbitEnabled,
  playing,
  onCaptureBaseline,
  onToggleOrbit,
  onTogglePlaying,
  onFileSelect,
  onLongPressCapture,
}) {
  const timerRef = useRef(null);

  function handlePointerDown() {
    clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      onLongPressCapture();
    }, 3000);
  }

  function clearLongPress() {
    clearTimeout(timerRef.current);
  }

  return (
    <header className="topbar">
      <div className="brand-block">
        <button
          className="brand-button"
          id="mmss-logo"
          onPointerDown={handlePointerDown}
          onPointerUp={clearLongPress}
          onPointerLeave={clearLongPress}
          onPointerCancel={clearLongPress}
        >
          <strong>Prismatic Core</strong>
          <span>Vision UI / Unified MMSS Dispatcher</span>
        </button>
        <div className="chip-row">
          <div className="chip">
            Level <strong>{level}</strong>
          </div>
          <div className="chip">
            Scene <strong>{scene.replace(/_/g, " ")}</strong>
          </div>
          <div className="chip">
            Vision <strong>{visionBound ? "Bound" : "Unbound"}</strong>
          </div>
          <div className="chip">
            Orbit <strong>{orbitEnabled ? "Active" : "Idle"}</strong>
          </div>
        </div>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={onCaptureBaseline}>
          Capture Baseline
        </button>
        <button className={`btn ${orbitEnabled ? "active" : ""}`} onClick={onToggleOrbit}>
          {orbitEnabled ? "Orbit Stop" : "Orbit Start"}
        </button>
        <button className="btn" onClick={onTogglePlaying}>
          {playing ? "Pause" : "Play"}
        </button>
        <label className="file-btn">
          Bind Vision
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onFileSelect(file);
            }}
          />
        </label>
      </div>
    </header>
  );
}

export default HeaderBar;
