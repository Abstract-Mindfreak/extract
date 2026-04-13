import { rangeLabel } from "../mmss/utils";

function ControlGrid({ controls, values, onChange }) {
  return (
    <div className="controls-grid">
      {controls.map((control) => {
        const value = values[control.key];

        return (
          <div className="control" key={control.key}>
            <label>
              {control.label}
              <output>{control.type === "select" ? String(value).replace(/_/g, " ") : rangeLabel(control.key, value)}</output>
            </label>
            {control.type === "select" ? (
              <select value={value} onChange={(event) => onChange(control.key, event.target.value)}>
                {control.options.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                onChange={(event) => onChange(control.key, Number(event.target.value))}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default ControlGrid;
