import React from "react";

const TEXTURES = [
  "Phonetic-Breath-Arc (Ω-Protocol Mapping)",
  "Liquid-Scratch-Flow (Time-Stretch Core)",
  "Viscous-Gel-Emergence",
  "Luminous-Ether-Consciousness",
  "Temple-Haveli-Acoustic",
  "Rupak-Tal-Raga-Field",
  "Microtonal-Śruti-Network",
  "Spectral-Morphing-Stream"
];

const MATERIALS = [
  "Viscous Gel", "Luminous Ether", "Liquid Mercury", "Molten Glass", "Plasma-Field", "Diamond-Hard"
];

const LAYERS = {
  wave: ["Time-Stretched_Scratch_Primary", "Harmonic_Pad_Foundation", "Primary_Melodic_Theme"],
  resonant: ["Handpan_Sustained_Tones", "Timpani_Resonant_Rolls", "China_Cymbal_Swells"],
  sub: ["Cajon_Bass_Tones", "Sub-Harmonic_Fundamental", "Didgeridoo_Drone_Bass"],
  texture: ["Granular_Freeze_Spectral_Blur", "Spectral_Delay_Pitch_Feedback", "High_Diffusion_Reverb"]
};

export function JsonOutput({ state }: { state: any }) {
  const getVal = (arr: any[], seed: number) => arr[seed % arr.length];

  const json = {
    generation_insights: `Φ-Total recursion cycle R=${state.recursionDepth} initiated. ${state.phase} operator stabilization at ${state.vVelocity.toFixed(6)} velocity. Liquid scratch texture emerged through stretched vinyl carriers.`,
    operator_trajectory: "G→Q→Φ→M execution path. Operator fusion: ACTIVE.",
    temporal_phases: state.trajectory.join("→"),
    metric_snapshot: {
      V: state.vVelocity,
      S: 0.0000001,
      D_f: state.dfDimension,
      R_T: 2.618,
      G_S: 4921.07,
      D_metric: state.dMetric
    },
    creative_choices: {
      texture: getVal(TEXTURES, state.seed),
      material: getVal(MATERIALS, state.seed + 1),
      spatial_charge: `Vector(${state.xy.x.toFixed(2)}, ${state.xy.y.toFixed(2)})`,
      sruti_drift: (0.185 + (state.seed % 10) * 0.1).toFixed(3),
      domain: "Phonetic-Breath-Arc (Ω-Protocol Mapping)",
      time_stretch: `${300 + state.recursionDepth * 150}%`,
      attack_time: "150ms",
      reverb_wet: "75%"
    },
    layer_architecture: {
      wave: { type: getVal(LAYERS.wave, state.seed), priority: 1, attack: "150ms", wet: "70%" },
      resonant_percussion: { type: getVal(LAYERS.resonant, state.seed + 1), priority: 2, attack: "200ms", wet: "60%" },
      sub_foundation: { type: getVal(LAYERS.sub, state.seed + 2), priority: 3, attack: "300ms", wet: "50%", lowpass: "<200Hz" },
      texture_elements: { type: getVal(LAYERS.texture, state.seed + 3), priority: 4, wet: "80%" }
    },
    emergence_moments: [
      "Harmonic resonance at 2.5kHz detected.",
      "Unexpected microtonal convergence at 0.3 śruti",
      state.dMetric < 0.01 ? "Singularity threshold approached." : "State stabilization in progress."
    ],
    next_vector_suggestions: [
      "Explore microtonal drift ±0.3 śruti",
      `Modulate X-Vector for ${state.xy.x > 0.5 ? "High Resonance" : "Low Density"}`,
      "Shift recursion density ρ via Sigmoid interpolation"
    ],
    stability_flag: state.dMetric < 0.05 ? "STABLE" : "SINGULARITY",
    seed: state.seed,
    recursion_depth: state.recursionDepth,
    process_state: "happening_in_observers_timeframe",
    mmss_enrichment: true
  };

  return (
    <div className="flex-1 p-4 overflow-y-auto custom-scrollbar bg-[#050505]">
      <pre className="text-[10px] text-[#00ff41] font-mono leading-[1.4] whitespace-pre-wrap">
        {JSON.stringify(json, null, 2)}
      </pre>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #000;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 0;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #00ff41;
        }
      `}</style>
    </div>
  );
}