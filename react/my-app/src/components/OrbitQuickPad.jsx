import { useRef } from "react";

function OrbitQuickPad({ slots, activePresetId, onApplySlot, onSaveSlot }) {
  const timersRef = useRef({});

  function startPress(slotId) {
    clearTimeout(timersRef.current[slotId]);
    timersRef.current[slotId] = window.setTimeout(() => {
      onSaveSlot(slotId);
    }, 900);
  }

  function clearPress(slotId) {
    clearTimeout(timersRef.current[slotId]);
  }

  return (
    <div className="orbit-quickpad">
      <div className="mini-strip-head">
        <strong>Orbit Quick Pad</strong>
        <span>Click to morph, hold to save current orbit.</span>
      </div>
      <div className="orbit-slot-grid">
        {slots.map((slot) => (
          <button
            key={slot.id}
            className={`orbit-slot ${activePresetId === slot.id ? "active" : ""}`}
            onClick={() => onApplySlot(slot)}
            onPointerDown={() => startPress(slot.id)}
            onPointerUp={() => clearPress(slot.id)}
            onPointerLeave={() => clearPress(slot.id)}
            onPointerCancel={() => clearPress(slot.id)}
          >
            <strong>{slot.label}</strong>
            <span>{slot.meta}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default OrbitQuickPad;
