function IntentComposer({ value, onChange, onApply, onLoadExample }) {
  return (
    <div className="intent-box">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Example: calm glass laboratory drifting into a prismatic storm over 2 minutes"
      />
      <div className="intent-actions">
        <button className="btn accent" onClick={onApply}>
          Apply Intent
        </button>
        <button className="btn" onClick={onLoadExample}>
          Load Example
        </button>
      </div>
    </div>
  );
}

export default IntentComposer;
