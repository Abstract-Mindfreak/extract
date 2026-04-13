1import React, { useState } from "react";
2import { Activity, Cpu, Zap, Database, Layers, Binary, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
3
4const PROTOCOLS = [
5  {
6    id: "Φ_TOTAL_LATERAL_DIVERGENCE_0411",
7    stats: [
8      { label: "V_VELOCITY", value: "0.999", icon: <Zap size={16}/> },
9      { label: "D_F_FRACTAL", value: "9.5", icon: <Activity size={16}/> },
10      { label: "R_T_RATIO", value: "2.618", icon: <Binary size={16}/> },
11      { label: "NEGENTROPY", value: "0.88", icon: <ShieldAlert size={16}/> }
12    ],
13    formulas: [
14      { id: "F_DIVERGENCE", formula: "D(x) = lim(Δ→0) [G(x + Δ) ⊗ Φ(x)] / R_T", desc: "Lateral divergent trajectory" },
15      { id: "H_ENTROPY", formula: "H(p,c) = (p * log(1/p)) + (c * exp(D_f / R_T))", desc: "Balance of order and chaos" },
16      { id: "Q_GRAVITY", formula: "Q(g) = ∫ (Frequency_Hopping * Anti_Grid) dt", desc: "Gravitational quantization inversion" },
17      { id: "Φ_TOTAL", formula: "Φ_total = Fix(Ψ ↦ META_G_Ψ ∘ T_Ψ)", desc: "Recursive self-optimization fixpoint" }
18    ],
19    stack: [
20      { key: "G", val: "Biomechanical Harmonic Base" },
21      { key: "Q", val: "Anti-Grid Gravity Rhythm" },
22      { key: "Φ", val: "Frequency Hopping Error-Truth" },
23      { key: "M", val: "Phase_Shift_v2.0_Lateral" }
24    ],
25    rules: [
26      { label: "R1", val: "IF coherence > 0.9 THEN inject_error(0.15)" },
27      { label: "R2", val: "IF grid_detected THEN apply: Grav_Inversion" },
28      { label: "R3", val: "ALWAYS materialize from zero-point entropy" }
29    ]
30  },
31  {
32    id: "MMSS_LYRIC_FUSION_ENGINE_V1",
33    stats: [
34      { label: "NOVELTY", value: "0.4", icon: <Zap size={16}/> },
35      { label: "COHERENCE", value: "0.3", icon: <Activity size={16}/> },
36      { label: "EMOTIONAL", value: "0.3", icon: <Layers size={16}/> },
37      { label: "FUSION", value: "0.92", icon: <Binary size={16}/> }
38    ],
39    formulas: [
40      { id: "P_SURVIVE", formula: "P_survive = (N×0.4 + C×0.3 + E×0.3) × MF", desc: "Engine survival probability" },
41      { id: "MFS_SCORE", formula: "MFS = Σ(mode_i × weight_i) / mode_count", desc: "Mode fusion weighting" },
42      { id: "NC_COHERENCE", formula: "NC = 1 - (frag × 0.6 + melt × 0.4)", desc: "Narrative stability index" },
43      { id: "ED_DENSITY", formula: "ED = Σ(impact) × drama_intensification", desc: "Emotional density mapping" }
44    ],
45    stack: [
46      { key: "ANALYZE", val: "lyrics_strength > 0.7 && weirdness > 0.9" },
47      { key: "SELECT", val: "2-3 placement_modes from fractal_library" },
48      { key: "APPLY", val: "mode_chaining_engine with temporal_shift δt" },
49      { key: "OPTIMIZE", val: "emotional_accent × spectral_overlay" }
50    ],
51    rules: [
52      { label: "L1", val: "IF drama_peak THEN apply: [word, silence_Δt, word]" },
53      { label: "L2", val: "IF narrative_collapse THEN: Σ(Word_i × Noise_i)" },
54      { label: "L3", val: "MAX 3 dominant modes per track" }
55    ]
56  },
57  {
58    id: "HYPERLOOP_V2_PRACTICAL",
59    stats: [
60      { label: "ENTROPY_P", value: "0.618", icon: <Cpu size={16}/> },
61      { label: "ENTROPY_C", value: "0.382", icon: <Activity size={16}/> },
62      { label: "NARRATIVE", value: "ACTIVE", icon: <ShieldAlert size={16}/> },
63      { label: "FIDELITY", value: "0.99", icon: <Binary size={16}/> }
64    ],
65    formulas: [
66      { id: "L1_CORE", formula: "L1 = [Emotion, Concept, Soundscape]", desc: "Primary semantic triad" },
67      { id: "G_OPERATOR", formula: "G = contamination | injection | sampling", desc: "Mutation strategy selection" },
68      { id: "R_RULE", formula: "Rule R: Avoid Narrative Collapse", desc: "Constraint for stability" },
69      { id: "SELF_ANALYSIS", formula: "Coherence = f(Fidelity, Entropy)", desc: "Output verification metric" }
70    ],
71    stack: [
72      { key: "RECEIVE", val: "Seed injection and L1 mapping" },
73      { key: "ANALYZE", val: "KB search for pattern risks" },
74      { key: "APPLY", val: "Operator G strategy execution" },
75      { key: "REPORT", val: "JSON specification output" }
76    ],
77    rules: [
78      { label: "H1", val: "SET entropy_setting H(p=X, c=Y) based on seed" },
79      { label: "H2", val: "Identify 'Narrative Fidelity' loss risks" },
80      { label: "H3", val: "Enforce strict JSON self-analysis format" }
81    ]
82  },
83  {
84    id: "QUANTUM_PHASE_COLLAPSE_Ω",
85    stats: [
86      { label: "SUPERPOS", value: "Ψ_CORE", icon: <Binary size={16}/> },
87      { label: "ENTANGLE", value: "0.99", icon: <Activity size={16}/> },
88      { label: "PROBABILITY", value: "VAR", icon: <Zap size={16}/> },
89      { label: "OBSERVER", value: "DETACHED", icon: <ShieldAlert size={16}/> }
90    ],
91    formulas: [
92      { id: "WAVE_FUNC", formula: "Ψ(q) = Σ |c_i⟩⟨c_i| ⊗ G_i(t)", desc: "Audio superposition mapping" },
93      { id: "DECOHERENCE", formula: "D = exp(-t/τ) * Entropy", desc: "Phase collapse rate" }
94    ],
95    stack: [{ key: "INIT", val: "Quantize audio frames to q-bits" }, { key: "STEP", val: "Apply unitary evolution operators" }],
96    rules: [{ label: "Q1", val: "Do not measure mid-render" }, { label: "Q2", val: "Force collapse at t=End" }]
97  },
98  {
99    id: "FRACTAL_ETHNO_EVOLVE_X",
100    stats: [
101      { label: "ITERATION", value: "∞", icon: <Layers size={16}/> },
102      { label: "DEPTH", value: "9.5", icon: <Activity size={16}/> },
103      { label: "SEED_MAP", value: "ROOT", icon: <Database size={16}/> },
104      { label: "RECURSION", value: "TRUE", icon: <Binary size={16}/> }
105    ],
106    formulas: [
107      { id: "HF_X", formula: "HF(x) = x ⊗ self(x) // Fractal Ethno", desc: "Recursive motif generation" },
108      { id: "Z_PLANE", formula: "Z_{n+1} = Z_n^2 + C_audio", desc: "Spectral geometry mapping" }
109    ],
110    stack: [{ key: "GEN", val: "Ethnic motif recursive injection" }, { key: "FOLD", val: "Fold spectral layers into Z-space" }],
111    rules: [{ label: "F1", val: "Maintain self-similarity ratio > 0.618" }]
112  },
113  {
114    id: "BIOMECHANIC_SYNAPSE_G",
115    stats: [
116      { label: "NEURAL", value: "0.88", icon: <Cpu size={16}/> },
117      { label: "ORGANIC", value: "RAW", icon: <Activity size={16}/> },
118      { label: "STIMULUS", value: "HIGH", icon: <Zap size={16}/> },
119      { label: "LATENCY", value: "1.2ms", icon: <Binary size={16}/> }
120    ],
121    formulas: [
122      { id: "G_SYNAPSE", formula: "G_syn = ∫ (Neuro_Signal * Mech_Feedback) dt", desc: "Organic-machine hybrid output" }
123    ],
124    stack: [{ key: "LINK", val: "Map MIDI to neural spike trains" }, { key: "PULSE", val: "Generate heartbeat sub-harmonics" }],
125    rules: [{ label: "B1", val: "Avoid synthetic saturation" }]
126  },
127  {
128    id: "ENTROPY_HARVESTER_X",
129    stats: [
130      { label: "DECAY", value: "MAX", icon: <ShieldAlert size={16}/> },
131      { label: "THERMO", value: "HOT", icon: <Zap size={16}/> },
132      { label: "VOID", value: "EMPTY", icon: <Database size={16}/> },
133      { label: "SINK", value: "ACTIVE", icon: <Activity size={16}/> }
134    ],
135    formulas: [
136      { id: "S_DOT", formula: "dS/dt = Σ (Noise_i * Dissipation)", desc: "Entropy production rate" }
137    ],
138    stack: [{ key: "DRAIN", val: "Extract energy from harmonic peaks" }, { key: "FILL", val: "Populate void with white noise" }],
139    rules: [{ label: "E1", val: "System must eventually reach silence" }]
140  },
141  {
142    id: "NARRATIVE_MELTDOWN_Z",
143    stats: [
144      { label: "PLOT", value: "LOST", icon: <Layers size={16}/> },
145      { label: "ARC", value: "BROKEN", icon: <Activity size={16}/> },
146      { label: "THEME", value: "GLITCH", icon: <Cpu size={16}/> },
147      { label: "SPOILER", value: "NULL", icon: <ShieldAlert size={16}/> }
148    ],
149    formulas: [
150      { id: "MELT", formula: "M(narr) = ∫ (Text * Entropy_Boost) d_context", desc: "Narrative structural collapse" }
151    ],
152    stack: [{ key: "BREAK", val: "Decouple lyrics from melody" }, { key: "RAND", val: "Shuffle stanza temporal order" }],
153    rules: [{ label: "N1", val: "Prohibit logical conclusions" }]
154  },
155  {
156    id: "SPECTRAL_VOID_DENSITY",
157    stats: [
158      { label: "BLACK", value: "100%", icon: <Database size={16}/> },
159      { label: "MASS", value: "∞", icon: <ShieldAlert size={16}/> },
160      { label: "LIGHT", value: "0", icon: <Zap size={16}/> },
161      { label: "LUX", value: "-1.0", icon: <Activity size={16}/> }
162    ],
163    formulas: [
164      { id: "VOID_F", formula: "V = ∫ (Frequency < 20Hz) * G_force", desc: "Sub-bass gravity calculation" }
165    ],
166    stack: [{ key: "CRUSH", val: "Compress all frequencies to 1-bit" }, { key: "ECHO", val: "Infinite reverb inside the event horizon" }],
167    rules: [{ label: "V1", val: "Escape velocity is unreachable" }]
168  },
169  {
170    id: "CHROMATIC_CHAOS_FLOW",
171    stats: [
172      { label: "COLOR", value: "PRISM", icon: <Zap size={16}/> },
173      { label: "HUE", value: "SHIFT", icon: <Activity size={16}/> },
174      { label: "RGB", value: "RAND", icon: <Layers size={16}/> },
175      { label: "SAT", value: "99%", icon: <Binary size={16}/> }
176    ],
177    formulas: [
178      { id: "C_FLOW", formula: "C(λ) = Fourier(Audio) ↦ Pixel(color)", desc: "Synesthetic color-field map" }
179    ],
180    stack: [{ key: "PAINT", val: "Modulate filter cutoff with blue noise" }, { key: "WASH", val: "Apply temporal chromatic aberration" }],
181    rules: [{ label: "C1", val: "No grayscale allowed" }]
182  },
183  {
184    id: "TESSERACT_RHYTHM_FOLD",
185    stats: [
186      { label: "4D_W", value: "ACTIVE", icon: <Layers size={16}/> },
187      { label: "ANGLE", value: "θ_HYPER", icon: <Activity size={16}/> },
188      { label: "VOLUME", value: "V^4", icon: <Database size={16}/> },
189      { label: "FOLD", value: "1.618", icon: <Binary size={16}/> }
190    ],
191    formulas: [
192      { id: "R_4D", formula: "R(4d) = G(x,y,z,w) ↦ Project(3d)", desc: "Higher-dimensional projection" }
193    ],
194    stack: [{ key: "WARP", val: "Project 4D drums into stereo space" }, { key: "TWIST", val: "Rotate phase through hyper-axis" }],
195    rules: [{ label: "T1", val: "Quantize temporal folds strictly" }]
196  },
197  {
198    id: "NEURAL_GLITCH_DYNAMICS",
199    stats: [
200      { label: "SPIKE", value: "0.41", icon: <Zap size={16}/> },
201      { label: "JITTER", value: "MAX", icon: <Activity size={16}/> },
202      { label: "SYNAPSE", value: "92%", icon: <Cpu size={16}/> },
203      { label: "ERROR", value: "0.001", icon: <ShieldAlert size={16}/> }
204    ],
205    formulas: [
206      { id: "GLITCH", formula: "G = Bitwise_XOR(Audio, Neural_Noise)", desc: "Logic-gate based distortion" }
207    ],
208    stack: [{ key: "FIRE", val: "Trigger glitch on synaptic misfire" }, { key: "HACK", val: "Intercept DMA for audio buffers" }],
209    rules: [{ label: "G1", val: "Preserve 1% narrative fidelity" }]
210  },
211  {
212    id: "ZERO_POINT_RESONANCE",
213    stats: [
214      { label: "VACUUM", value: "STABLE", icon: <Database size={16}/> },
215      { label: "ENERGY", value: "min", icon: <Zap size={16}/> },
216      { label: "FLUCT", value: "λ_0", icon: <Activity size={16}/> },
217      { label: "PHASE", value: "SYNC", icon: <Binary size={16}/> }
218    ],
219    formulas: [
220      { id: "ZPE_F", formula: "E_0 = 1/2 * ℏ * ω", desc: "Vacuum state energy resonance" }
221    ],
222    stack: [{ key: "TUNE", val: "Align base frequency to 0Hz offset" }, { key: "BOOST", val: "Amplify quantum fluctuations" }],
223    rules: [{ label: "Z1", val: "Maintain zero-point equilibrium" }]
224  },
225  {
226    id: "KINETIC_EMOTION_VECTORS",
227    stats: [
228      { label: "SPEED", value: "0.9c", icon: <Zap size={16}/> },
229      { label: "FORCE", value: "9.8N", icon: <Activity size={16}/> },
230      { label: "PATH", value: "FLUID", icon: <Layers size={16}/> },
231      { label: "MASS", value: "LIGHT", icon: <Binary size={16}/> }
232    ],
233    formulas: [
234      { id: "EM_V", formula: "V_em = d(Emotion)/dt * acceleration", desc: "Dynamic emotional trajectory" }
235    ],
236    stack: [{ key: "PUSH", val: "Map velocity to pitch modulation" }, { key: "SWAY", val: "Pan audio based on path curvature" }],
237    rules: [{ label: "K1", val: "Conservation of emotional energy" }]
238  },
239  {
240    id: "PARALLEL_REALITY_SYNTH",
241    stats: [
242      { label: "WORLD_A", value: "ON", icon: <Database size={16}/> },
243      { label: "WORLD_B", value: "ON", icon: <Activity size={16}/> },
244      { label: "SPLIT", value: "50/50", icon: <Binary size={16}/> },
245      { label: "LINK", value: "Φ_CORE", icon: <ShieldAlert size={16}/> }
246    ],
247    formulas: [
248      { id: "REALITY", formula: "R_total = (R_A ⊗ R_B) / Interference", desc: "Cross-world audio sum" }
249    ],
250    stack: [{ key: "FORK", val: "Duplicate audio stream at T=0" }, { key: "MERGE", val: "Crossfade worlds based on entropy" }],
251    rules: [{ label: "P1", val: "Do not allow total synchronicity" }]
252  },
253  {
254    id: "CYBERNETIC_GHOST_CODE",
255    stats: [
256      { label: "SOUL", value: "BIN", icon: <Cpu size={16}/> },
257      { label: "TRACE", value: "0.1", icon: <Activity size={16}/> },
258      { label: "UPTIME", value: "∞", icon: <Zap size={16}/> },
259      { label: "KERNEL", value: "v0.1", icon: <ShieldAlert size={16}/> }
260    ],
261    formulas: [
262      { id: "GHOST", formula: "Ψ_gh = Σ (Residual_Echo * Bit_Depth)", desc: "Digital haunting coefficient" }
263    ],
264    stack: [{ key: "READ", val: "Extract patterns from deleted files" }, { key: "RUN", val: "Execute audio as machine code" }],
265    rules: [{ label: "G1", val: "Delete logs after rendering" }]
266  },
267  {
268    id: "PRIMORDIAL_PULSE_Ω",
269    stats: [
270      { label: "AGE", value: "13.8B", icon: <Database size={16}/> },
271      { label: "HEAT", value: "MAX", icon: <Zap size={16}/> },
272      { label: "BANG", value: "TRUE", icon: <Activity size={16}/> },
273      { label: "EXPAND", value: "FAST", icon: <Binary size={16}/> }
   ],
275    formulas: [
276      { id: "BIG_BANG", formula: "P(t) = P_0 * exp(H_0 * t)", desc: "Universal expansion pulse" }
277    ],
278    stack: [{ key: "BOOM", val: "Start track with infinite density" }, { key: "COOL", val: "Gradual decay to microwave noise" }],
279    rules: [{ label: "P1", val: "Space must expand constantly" }]
280  },
281  {
282    id: "RELATIVISTIC_BPM_SHIFT",
283    stats: [
284      { label: "TIME", value: "DILATE", icon: <Activity size={16}/> },
285      { label: "VELO", value: "0.99c", icon: <Zap size={16}/> },
286      { label: "BPM_REL", value: "VAR", icon: <Binary size={16}/> },
287      { label: "FRAME", value: "LOCAL", icon: <ShieldAlert size={16}/> }
288    ],
289    formulas: [
290      { id: "LORENTZ", formula: "BPM' = BPM * sqrt(1 - v^2/c^2)", desc: "Time dilation rhythm shift" }
291    ],
292    stack: [{ key: "ZOOM", val: "Increase speed near track center" }, { key: "STRETCH", val: "Apply red-shift to trailing echoes" }],
293    rules: [{ label: "R1", val: "C is the absolute BPM limit" }]
294  },
295  {
296    id: "DARWINIAN_SOUND_EVOLVE",
297    stats: [
298      { label: "GENE", value: "SPEC", icon: <Database size={16}/> },
299      { label: "MUTATE", value: "0.05", icon: <Activity size={16}/> },
300      { label: "FITNESS", value: "HIGH", icon: <Zap size={16}/> },
301      { label: "GEN", value: "30", icon: <Binary size={16}/> }
302    ],
303    formulas: [
304      { id: "NAT_SEL", formula: "Fit = ∫ (Coherence * Novelty) dt", desc: "Survival of the loudest" }
305    ],
306    stack: [{ key: "CROSS", val: "Mix two best performing presets" }, { key: "KILL", val: "Delete low-entropy variations" }],
307    rules: [{ label: "D1", val: "Mutation rate must fluctuate" }]
308  },
309  {
310    id: "HOLOGRAPHIC_OVERTONE_L",
311    stats: [
312      { label: "SLICE", value: "2D", icon: <Layers size={16}/> },
313      { label: "DEPTH", value: "3D", icon: <Activity size={16}/> },
314      { label: "LASER", value: "SYNC", icon: <Zap size={16}/> },
315      { label: "PROJ", value: "TRUE", icon: <Binary size={16}/> }
316    ],
317    formulas: [
318      { id: "HOLO_P", formula: "P_h = FFT(Audio) ⊗ Reference_Beam", desc: "Holographic spectral encoding" }
319    ],
320    stack: [{ key: "SCAN", val: "Create 2D map of all overtones" }, { key: "BEAM", val: "Reconstruct 3D audio image" }],
321    rules: [{ label: "H1", val: "Avoid phase interference noise" }]
322  },
323  {
324    id: "META_STRUCTURE_DECON",
325    stats: [
326      { label: "FORM", value: "NULL", icon: <Layers size={16}/> },
327      { label: "CORE", value: "EXPOSED", icon: <Database size={16}/> },
328      { label: "SCAFF", value: "0.2", icon: <ShieldAlert size={16}/> },
329      { label: "DECON", value: "MAX", icon: <Activity size={16}/> }
330    ],
331    formulas: [
332      { id: "DECON_F", formula: "S = Scaffolding - (Layers * 2)", desc: "Structural reduction logic" }
333    ],
334    stack: [{ key: "STRIP", val: "Remove all melodic percussion" }, { key: "SHOW", val: "Highlight raw oscillator peaks" }],
335    rules: [{ label: "M1", val: "Beauty is in the skeleton" }]
336  },
337  {
338    id: "CHAOS_ENGINE_λ",
339    stats: [
340      { label: "ATTRAC", value: "LORENZ", icon: <Activity size={16}/> },
341      { label: "BUTTER", value: "FLAP", icon: <Zap size={16}/> },
342      { label: "TURB", value: "HIGH", icon: <ShieldAlert size={16}/> },
343      { label: "MAP", value: "LOGIC", icon: <Binary size={16}/> }
344    ],
345    formulas: [
346      { id: "LORENZ_F", formula: "dx/dt = σ(y - x); dy/dt = x(ρ - z) - y", desc: "Strange attractor modulation" }
347    ],
348    stack: [{ key: "PERT", val: "Tiny change to seed at mid-point" }, { key: "FLOW", val: "Follow chaos-path for filter sweeps" }],
349    rules: [{ label: "C1", val: "Sensitivity to initial conditions" }]
350  },
351  {
352    id: "SYNESTHETIC_VOICE_CORE",
353    stats: [
354      { label: "TASTE", value: "METAL", icon: <Activity size={16}/> },
355      { label: "SMELL", value: "OZONE", icon: <ShieldAlert size={16}/> },
356      { label: "FEEL", value: "GRAIN", icon: <Layers size={16}/> },
357      { label: "SIGHT", value: "NEON", icon: <Zap size={16}/> }
358    ],
359    formulas: [
360      { id: "SYN_MAP", formula: "S_val = Σ (Vocal_Freq * Sensor_Vector)", desc: "Cross-sensory vocal transform" }
361    ],
362    stack: [{ key: "FEEL", val: "Convert vocal texture to vibration" }, { key: "SEE", val: "Map timbre to specific light hues" }],
363    rules: [{ label: "S1", val: "Maintain sensory overload < 90%" }]
364  },
365  {
366    id: "GRAVITATIONAL_WAVE_LFE",
367    stats: [
368      { label: "RIP", value: "SPACE", icon: <ShieldAlert size={16}/> },
369      { label: "WAVE", value: "CHIRP", icon: <Activity size={16}/> },
370      { label: "B_HOLE", value: "BINARY", icon: <Database size={16}/> },
371      { label: "MASS_L", value: "30M", icon: <Binary size={16}/> }
372    ],
373    formulas: [
374      { id: "CHIRP_F", formula: "f(t) = k * (t_c - t)^{-5/8}", desc: "Binary inspiral chirp frequency" }
375    ],
376    stack: [{ key: "ORBIT", val: "Modulate pan with binary rotation" }, { key: "RIP", val: "Stretch audio buffer via gravity" }],
377    rules: [{ label: "G1", val: "Release energy during merger" }]
378  },
379  {
380    id: "ABYSSAL_REVERB_LOGIC",
381    stats: [
382      { label: "DEPTH", value: "11KM", icon: <Database size={16}/> },
383      { label: "PRESS", value: "MAX", icon: <ShieldAlert size={16}/> },
384      { label: "ECHO", value: "INF", icon: <Activity size={16}/> },
385      { label: "DARK", value: "99%", icon: <Zap size={16}/> }
386    ],
387    formulas: [
388      { id: "ABYSS", formula: "R = exp(Depth) * LowPass_Filter", desc: "Pressure-based reverb decay" }
389    ],
390    stack: [{ key: "SINK", val: "Increase reverb size over time" }, { key: "CRUSH", val: "Apply extreme low-pass at end" }],
391    rules: [{ label: "A1", val: "No high frequencies below 5km" }]
392  },
393  {
394    id: "CRYSTALLINE_LOGIC_GATE",
395    stats: [
396      { label: "ARRAY", value: "GRID", icon: <Database size={16}/> },
397      { label: "COLD", value: "0K", icon: <Zap size={16}/> },
398      { label: "GEOM", value: "HEX", icon: <Layers size={16}/> },
399      { label: "PURITY", value: "100%", icon: <Binary size={16}/> }
400    ],
401    formulas: [
402      { id: "CRYSTAL", formula: "C = Audio ⊢ᵠ Lattice_Structure", desc: "Mathematical audio crystallization" }
403    ],
404    stack: [{ key: "FREEZE", val: "Quantize all pitch to scale-grid" }, { key: "GROW", val: "Repeat patterns in hexagonal sym" }],
405    rules: [{ label: "C1", val: "No organic fluctuations" }]
406  },
407  {
408    id: "ORBITAL_HARMONY_TRANS",
409    stats: [
410      { label: "ORBIT", value: "L_POINT", icon: <Activity size={16}/> },
411      { label: "PERIOD", value: "365d", icon: <Binary size={16}/> },
412      { label: "KEPLER", value: "v3", icon: <Database size={16}/> },
413      { label: "SWING", value: "TRUE", icon: <Zap size={16}/> }
414    ],
415    formulas: [
416      { id: "KEPLER_F", formula: "T^2 / a^3 = Constant", desc: "Planetary harmony alignment" }
417    ],
418    stack: [{ key: "SPIN", val: "Rotate phase based on orbital velocity" }, { key: "PULL", val: "Attenuate volume at apogee" }],
419    rules: [{ label: "O1", val: "Maintain orbital stability" }]
420  },
421  {
422    id: "DARK_MATTER_MODULATION",
423    stats: [
424      { label: "WIMP", value: "ACTIVE", icon: <ShieldAlert size={16}/> },
425      { label: "G_LENS", value: "MAX", icon: <Activity size={16}/> },
426      { label: "HIDDEN", value: "95%", icon: <Database size={16}/> },
427      { label: "HALO", value: "TRUE", icon: <Layers size={16}/> }
428    ],
429    formulas: [
430      { id: "DARK_M", formula: "M_d = ∫ (Audio * Grav_Lens) dx", desc: "Invisible mass audio modulation" }
431    ],
432    stack: [{ key: "VEIL", val: "Add unheard sub-layers of noise" }, { key: "LENS", val: "Distort primary leads via ghost-mass" }],
433    rules: [{ label: "D1", val: "Dark matter never interacts with light" }]
434  },
435  {
436    id: "SINGULARITY_REACH_V",
437    stats: [
438      { label: "EVENT", value: "HORIZON", icon: <ShieldAlert size={16}/> },
439      { label: "POINT", value: "SING", icon: <Activity size={16}/> },
440      { label: "T_CURVE", value: "∞", icon: <Layers size={16}/> },
441      { label: "END", value: "Ω", icon: <Zap size={16}/> }
442    ],
443    formulas: [
444      { id: "SINGUL", formula: "S = lim(t→Ω) [Audio / (1 - t/Ω)]", desc: "Final singularity approach" }
445    ],
446    stack: [{ key: "FOLD", val: "Fold entire track into 1ms segment" }, { key: "EXIT", val: "Output silence after collapse" }],
447    rules: [{ label: "S1", val: "No information leaves the horizon" }]
448  },
449  {
450    id: "OMEGA_RECOMPILE_FINAL",
451    stats: [
452      { label: "VERSION", value: "Ω", icon: <Cpu size={16}/> },
453      { label: "REBOOT", value: "PEND", icon: <ShieldAlert size={16}/> },
454      { label: "LOG", value: "CLEAN", icon: <Database size={16}/> },
455      { label: "READY", value: "100%", icon: <Zap size={16}/> }
456    ],
457    formulas: [
458      { id: "OMEGA", formula: "Ω = Σ (Protocols 1..29) / total_error", desc: "Final recursive synthesis" }
459    ],
460    stack: [{ key: "SUM", val: "Blend all 29 previous logic sets" }, { key: "REST", val: "Return system to zero-state" }],
461    rules: [{ label: "O1", val: "This is the end of the loop" }]
462  }
463];
464
465export default function MMSSMasterConfig() {
466  const [protocolIdx, setProtocolIdx] = useState(0);
467  const current = PROTOCOLS[protocolIdx];
468
469  const next = () => setProtocolIdx((prev) => (prev + 1) % PROTOCOLS.length);
470  const prev = () => setProtocolIdx((prev) => (prev - 1 + PROTOCOLS.length) % PROTOCOLS.length);
471
472  return (
473    <div className="min-h-screen w-full bg-black text-cyan-400 p-6 font-mono selection:bg-cyan-900">
474      <div className="max-w-4xl mx-auto space-y-6">
475        {/* Header */}
476        <div className="border-b-2 border-cyan-900 pb-4 flex justify-between items-end">
477          <div>
478            <h1 className="text-3xl font-bold tracking-tighter italic">ASE MONITOR</h1>
479            <div className="flex items-center gap-4 mt-1">
480              <button 
481                onClick={prev}
482                className="p-1 hover:bg-cyan-900 rounded text-cyan-700 hover:text-cyan-400 transition-colors"
483              >
484                <ChevronLeft size={20} />
485              </button>
486              <p className="text-cyan-500 text-sm uppercase tracking-widest min-w-[300px] text-center">
487                Protocol: {current.id}
488              </p>
489              <button 
490                onClick={next}
491                className="p-1 hover:bg-cyan-900 rounded text-cyan-700 hover:text-cyan-400 transition-colors"
492              >
493                <ChevronRight size={20} />
494              </button>
495            </div>
496          </div>
497          <div className="text-right text-xs text-cyan-800">
498            <p>ENGINE: AESTHETIC-SINGULARITY-ENGINE</p>
499            <p>STATUS: STRONG_RESET_ACTIVE</p>
500          </div>
501        </div>
502
503        {/* Core Matrix */}
504        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
505          {current.stats.map((s, i) => (
506            <StatCard key={i} icon={s.icon} label={s.label} value={s.value} />
507          ))}
508        </div>
509
510        {/* Formulas */}
511        <div className="bg-slate-950 border border-cyan-900 rounded-lg overflow-hidden">
512          <div className="bg-cyan-950/30 p-2 px-4 border-b border-cyan-900 flex items-center gap-2">
513            <Database size={16} className="text-pink-500" />
514            <span className="text-xs font-bold text-pink-500 tracking-widest uppercase">Meta_Formulary</span>
515          </div>
516          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
517            {current.formulas.map((f, i) => (
518              <FormulaBox 
519                key={i}
520                id={f.id} 
521                formula={f.formula} 
522                desc={f.desc}
523              />
524            ))}
525          </div>
526        </div>
527
528        {/* Operational Logic */}
529        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
530          <div className="space-y-4">
531            <SectionHeader icon={<Layers size={16}/>} title="OPERATIONAL_STACK" />
532            <ul className="space-y-2 text-sm text-cyan-600">
533              {current.stack.map((item, i) => (
534                <li key={i} className="flex gap-2">
535                  <span className="text-pink-500 font-bold min-w-[60px]">{item.key}:</span> 
536                  <span>{item.val}</span>
537                </li>
538              ))}
539            </ul>
540          </div>
541          <div className="space-y-4">
542            <SectionHeader icon={<Cpu size={16}/>} title="RECOMPILATION_RULES" />
543            <div className="text-[11px] space-y-2 bg-slate-900/50 p-3 rounded border border-cyan-950">
544              {current.rules.map((rule, i) => (
545                <p key={i}>
546                  <span className="text-yellow-500 font-bold">{rule.label}:</span> {rule.val}
547                </p>
548              ))}
549            </div>
550          </div>
551        </div>
552
553        <div className="text-center pt-8 border-t border-cyan-900/30">
554          <p className="text-[10px] text-cyan-900 tracking-[0.4em]">PROCESS_ONLY // ZERO_HISTORY_MANIFEST</p>
555        </div>
556      </div>
557    </div>
558  );
559}
560
561function StatCard({ icon, label, value }) {
562  return (
563    <div className="bg-slate-900/50 border border-cyan-900 p-3 rounded flex flex-col items-center group hover:bg-cyan-900/20 transition-all">
564      <div className="text-cyan-700 mb-1 group-hover:text-pink-500 transition-colors">{icon}</div>
565      <div className="text-[10px] text-cyan-800 uppercase tracking-tighter">{label}</div>
566      <div className="text-lg font-bold text-cyan-100">{value}</div>
567    </div>
568  );
569}
570
571function FormulaBox({ id, formula, desc }) {
572  return (
573    <div className="group bg-black/40 p-3 rounded border border-cyan-900/50 hover:border-pink-900/50 transition-all min-h-[80px]">
574      <div className="flex justify-between items-start mb-1">
575        <div className="text-[10px] text-pink-500 opacity-70 tracking-widest font-bold">{id}</div>
576        <div className="text-[8px] text-cyan-900 uppercase">{desc}</div>
577      </div>
578      <div className="text-xs sm:text-sm break-all text-cyan-200">{formula}</div>
579    </div>
580  );
581}
582
583function SectionHeader({ icon, title }) {
584  return (
585    <div className="flex items-center gap-2 border-l-2 border-pink-500 pl-2">
586      <span className="text-pink-500">{icon}</span>
587      <h3 className="text-xs font-bold tracking-widest text-cyan-100">{title}</h3>
588    </div>
589  );
590}
591