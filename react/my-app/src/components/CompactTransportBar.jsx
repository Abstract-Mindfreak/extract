function CompactTransportBar({
  playing,
  bpm,
  volume,
  currentScene,
  scenes,
  onTogglePlaying,
  onBpmChange,
  onVolumeChange,
  onSceneSelect,
}) {
  return (
    <div className="compact-transport-bar">
      <div className="transport-core">
        <button className={`transport-play ${playing ? "active" : ""}`} onClick={onTogglePlaying}>
          {playing ? "Pause" : "Play"}
        </button>
        <div className="transport-mini-control">
          <label>BPM</label>
          <input
            type="range"
            min={64}
            max={180}
            step={1}
            value={bpm}
            onChange={(event) => onBpmChange(Number(event.target.value))}
          />
          <strong>{Math.round(bpm)}</strong>
        </div>
        <div className="transport-mini-control">
          <label>Volume</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
          />
          <strong>{Math.round(volume * 100)}%</strong>
        </div>
      </div>

      <div className="transport-scenes">
        {scenes.map((sceneName) => (
          <button
            key={sceneName}
            className={`scene-chip ${currentScene === sceneName ? "active" : ""}`}
            onClick={() => onSceneSelect(sceneName)}
          >
            {sceneName.replace(/_/g, " ")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default CompactTransportBar;
