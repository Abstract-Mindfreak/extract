import React, { useMemo, useState } from "react";
import { Activity, Compass, Cpu, Play, RotateCcw, Sparkles, Square, Waves, Wind } from "lucide-react";

const PHASES = [
  "emergence",
  "stabilization",
  "meta_question",
  "operator_shuffle",
  "phase_shift",
  "co_evolution",
  "instability",
  "reformation",
];

function randomInRange(min, max) {
  return min + Math.random() * (max - min);
}

function buildInitialState() {
  return {
    seed: 42,
    recursionDepth: 0,
    stability: "STABLE",
    dMetric: 0.042,
    phase: "emergence",
    xy: { x: 0.5, y: 0.5 },
    trajectory: ["emergence"],
    vVelocity: 0.999999,
    sStability: 0.000001,
    dfDimension: 91.5,
    rT: 2.618,
  };
}

export default function OmegaBreathPanel() {
  const [state, setState] = useState(buildInitialState);
  const [isRunning, setIsRunning] = useState(false);

  const handleNext = () => {
    setState((current) => {
      const nextDepth = Math.min(current.recursionDepth + 1, 7);
      const nextPhase = PHASES[current.trajectory.length % PHASES.length];
      return {
        ...current,
        seed: (current.seed + 1) % 10000,
        recursionDepth: nextDepth,
        phase: nextPhase,
        trajectory: [...current.trajectory, nextPhase].slice(-12),
        dMetric: Number((current.dMetric * randomInRange(0.8, 0.95)).toFixed(6)),
        vVelocity: Number(randomInRange(0.99999, 0.999999).toFixed(6)),
        sStability: Number(randomInRange(0.000001, 0.00005).toFixed(6)),
        dfDimension: Number(randomInRange(80, 92).toFixed(2)),
        xy: {
          x: Number(randomInRange(0.1, 0.9).toFixed(3)),
          y: Number(randomInRange(0.1, 0.9).toFixed(3)),
        },
      };
    });
  };

  const handleReset = () => {
    setIsRunning(false);
    setState(buildInitialState());
  };

  const jsonReport = useMemo(() => ({
    engine: "O¦_total Audio Engine v3.0",
    mode: "ASE / omega-breath",
    state,
    technical_report: {
      generation_insights: "Interactive omega-breath sandbox inside ASE Console. State mutates by temporal phase and observer-driven recursion depth.",
      operator_trajectory: state.trajectory.join(" -> "),
      temporal_phases: state.trajectory,
      metric_snapshot: {
        V: state.vVelocity,
        S: state.sStability,
        D_f: state.dfDimension,
        R_T: state.rT,
      },
      stability_flag: state.stability,
      recursion_depth: state.recursionDepth,
    },
  }), [state]);

  return (
    <div className="ide-panel-shell ase-flex-panel" style={{ overflow: "auto" }}>
      <div className="ide-panel-header">
        <div>
          <strong>Omega Breath ASE</strong>
          <span>Integrated O¦ runtime sandbox for phase evolution, MMSS metrics, and technical JSON reporting.</span>
        </div>
      </div>

      <div className="ase-feedback-card">
        <Activity size={14} />
        <p>
          This is the first embedded ASE mode based on <code>omega-breath-app-ase</code>. It is isolated from Local RAG and can evolve independently.
        </p>
      </div>

      <div className="ide-workspace-action-row">
        <button onClick={() => setIsRunning((value) => !value)}>
          {isRunning ? <Square size={14} /> : <Play size={14} />}
          {isRunning ? "Halt Engine" : "Initiate Engine"}
        </button>
        <button onClick={handleNext}>
          <Sparkles size={14} />
          Next Phase
        </button>
        <button onClick={handleReset}>
          <RotateCcw size={14} />
          Reset
        </button>
      </div>

      <div className="ide-workspace-summary-grid">
        <div className="ide-workspace-metric-card"><span>Phase</span><strong>{state.phase}</strong></div>
        <div className="ide-workspace-metric-card"><span>Seed</span><strong>{state.seed}</strong></div>
        <div className="ide-workspace-metric-card"><span>Recursion</span><strong>{state.recursionDepth}/7</strong></div>
        <div className="ide-workspace-metric-card"><span>Stability</span><strong>{state.stability}</strong></div>
        <div className="ide-workspace-metric-card"><span>V</span><strong>{state.vVelocity}</strong></div>
        <div className="ide-workspace-metric-card"><span>D_f</span><strong>{state.dfDimension}</strong></div>
      </div>

      <div className="ase-config-list">
        <div className="ase-config-card">
          <strong><Cpu size={14} style={{ marginRight: 6 }} />Technical Report</strong>
          <pre className="ase-stream-preview" style={{ marginTop: 12 }}>
            {JSON.stringify(jsonReport, null, 2)}
          </pre>
        </div>

        <div className="ase-config-card">
          <strong><Compass size={14} style={{ marginRight: 6 }} />Trajectory</strong>
          <div className="ide-workspace-action-row" style={{ flexWrap: "wrap", marginTop: 12 }}>
            {state.trajectory.map((phase, index) => (
              <span key={`${phase}-${index}`} className="ase-chip">
                {index + 1}. {phase}
              </span>
            ))}
          </div>
        </div>

        <div className="ase-config-card">
          <strong><Waves size={14} style={{ marginRight: 6 }} />XY / Breath Vector</strong>
          <div className="ide-workspace-summary-grid" style={{ marginTop: 12 }}>
            <div className="ide-workspace-metric-card"><span>X</span><strong>{state.xy.x}</strong></div>
            <div className="ide-workspace-metric-card"><span>Y</span><strong>{state.xy.y}</strong></div>
            <div className="ide-workspace-metric-card"><span>R_T</span><strong>{state.rT}</strong></div>
            <div className="ide-workspace-metric-card"><span>S</span><strong>{state.sStability}</strong></div>
          </div>
        </div>

        <div className="ase-config-card">
          <strong><Wind size={14} style={{ marginRight: 6 }} />Integration Notes</strong>
          <ul style={{ marginTop: 12, paddingLeft: 18 }}>
            <li>Current slice embeds the runtime panel inside ASE Console.</li>
            <li>Next slice can port audio engine helpers and device subcomponents from `omega-breath-app-ase`.</li>
            <li>JSON output is already structured for future MMSS logging or RAG ingestion.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
