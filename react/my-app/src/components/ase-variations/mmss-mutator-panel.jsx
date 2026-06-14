import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Brain,
  Database,
  Dna,
  GitMerge,
  RefreshCw,
  Sparkles,
  Target,
  Wand2,
} from "lucide-react";
import { usePythonGenerationLayer } from "../../services/PythonGenerationLayer";
import { DEFAULT_RULES } from "../../services/PythonBridge";
import mmssMutatorRuntimeService from "../../services/MMSSMutatorRuntimeService";

const DOMAIN_OPTIONS = ["Rhythm", "Timbre", "Space", "Logic", "Math"];
const LAYER_OPTIONS = [1, 2, 3, 4, 5];

function SectionCard({ title, meta, children, icon }) {
  return (
    <div className="rounded-2xl border border-cyan-900/40 bg-black/80 p-5 shadow-[0_0_0_1px_rgba(8,145,178,0.06)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">
            {icon}
            <span>{title}</span>
          </div>
          {meta ? <div className="mt-1 text-xs text-cyan-700">{meta}</div> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function JsonViewport({ value, emptyText }) {
  return (
    <pre className="max-h-[34rem] overflow-auto rounded-xl border border-cyan-950 bg-[#020617] p-4 text-[11px] leading-5 text-cyan-100">
      {value ? JSON.stringify(value, null, 2) : emptyText}
    </pre>
  );
}

export default function MMSSMutatorPanel({ onSaveToLibrary }) {
  const genLayer = usePythonGenerationLayer();
  const [includeLegacy, setIncludeLegacy] = useState(false);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(true);
  const [runtimeError, setRuntimeError] = useState("");
  const [runtime, setRuntime] = useState(null);
  const [intent, setIntent] = useState(
    "Layered MMSS mutation using Flowmusic sessions, tracks, JSON prompts, operator logic, and ontology-rich blocks",
  );
  const [domains, setDomains] = useState(DOMAIN_OPTIONS);
  const [layers, setLayers] = useState([1, 2, 3, 4, 5]);
  const [maxBlocks, setMaxBlocks] = useState(10);
  const [temperature, setTemperature] = useState(0.55);
  const [runs, setRuns] = useState(8);
  const [isBuilding, setIsBuilding] = useState(false);
  const [result, setResult] = useState(null);
  const [mutations, setMutations] = useState([]);
  const [crossovers, setCrossovers] = useState([]);
  const [selfRules, setSelfRules] = useState(null);
  const [activeTab, setActiveTab] = useState("builder");

  const loadRuntime = useCallback(async () => {
    setIsLoadingRuntime(true);
    setRuntimeError("");
    try {
      const payload = await mmssMutatorRuntimeService.loadRuntime({ includeLegacy });
      setRuntime(payload);
    } catch (error) {
      console.error("Failed to build MMSS runtime", error);
      setRuntime(null);
      setRuntimeError(error?.message || "MMSS runtime load failed");
    } finally {
      setIsLoadingRuntime(false);
    }
  }, [includeLegacy]);

  useEffect(() => {
    void loadRuntime();
  }, [loadRuntime]);

  const runtimeStats = useMemo(() => (
    runtime?.stats || {
      blockCount: 0,
      musicBlockCount: 0,
      trackPseudoBlockCount: 0,
      sessionPseudoBlockCount: 0,
      legacyBlockCount: 0,
      domains: [],
      phases: [],
    }
  ), [runtime]);

  const summaryCards = [
    { label: "Всего блоков", value: runtimeStats.blockCount },
    { label: "music_blocks", value: runtimeStats.musicBlockCount },
    { label: "Track pseudo-blocks", value: runtimeStats.trackPseudoBlockCount },
    { label: "Session pseudo-blocks", value: runtimeStats.sessionPseudoBlockCount },
    { label: "Legacy blocks", value: runtimeStats.legacyBlockCount },
  ];

  const toggleDomain = useCallback((domain) => {
    setDomains((current) =>
      current.includes(domain)
        ? current.filter((entry) => entry !== domain)
        : [...current, domain],
    );
  }, []);

  const toggleLayer = useCallback((layer) => {
    setLayers((current) =>
      current.includes(layer)
        ? current.filter((entry) => entry !== layer)
        : [...current, layer],
    );
  }, []);

  const handleBuild = useCallback(async (version = "v3") => {
    if (!runtime?.blockIndex || !domains.length || !layers.length) return;
    setIsBuilding(true);
    setResult(null);
    try {
      const config = {
        intent,
        domains,
        layers,
        max_blocks: maxBlocks,
        temperature,
        runs,
        blockIndex: runtime.blockIndex,
        embeddings: runtime.embeddings,
        graph: runtime.graph,
        rules: DEFAULT_RULES,
      };
      const nextResult = version === "v1"
        ? await genLayer.build(config)
        : await genLayer.buildV3(config);
      setResult(nextResult);
      setActiveTab("result");
    } finally {
      setIsBuilding(false);
    }
  }, [domains, genLayer, intent, layers, maxBlocks, runs, runtime, temperature]);

  const handleMutation = useCallback(() => {
    if (!runtime?.blockIndex) return;
    const payload = genLayer.runMutationEngine(runtime.blockIndex, 12);
    setMutations(payload.mutations || []);
    setActiveTab("mutation");
  }, [genLayer, runtime]);

  const handleCrossover = useCallback(() => {
    if (!runtime?.blockIndex) return;
    const payload = genLayer.runCrossoverEngine(runtime.blockIndex, 8);
    setCrossovers(payload.crossovers || []);
    setActiveTab("crossover");
  }, [genLayer, runtime]);

  const handleSelfRules = useCallback(() => {
    if (!runtime?.blockIndex || !runtime?.graph) return;
    const payload = genLayer.runSelfRuleEngine(runtime.blockIndex, runtime.graph);
    setSelfRules(payload);
    setActiveTab("rules");
  }, [genLayer, runtime]);

  const quickSave = useCallback((payload, category, name, color) => {
    if (!payload) return;
    onSaveToLibrary?.(payload, {
      name,
      description: "MMSS Mutator output",
      category,
      tags: ["mmss_mutator", category, ...domains.map((domain) => domain.toLowerCase())],
      color,
      icon: "builder",
    });
  }, [domains, onSaveToLibrary]);

  return (
    <div className="min-h-screen w-full bg-[#020202] p-4 font-mono text-cyan-500">
      <div className="mx-auto max-w-[1680px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-cyan-900/30 pb-4">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-cyan-950 p-3">
              <Dna size={20} className="text-cyan-300" />
            </div>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-black tracking-tight text-white">
                <Database size={16} className="text-emerald-400" />
                МУТАТОР MMSS
              </h1>
              <div className="mt-1 max-w-3xl text-sm text-cyan-700">
                Runtime собирается из `abstract-mind-lab`, дополнительно может подключать `abstract_mind_db`,
                после чего используется существующий Python Generation Layer для сборки, мутаций и crossover.
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] uppercase tracking-[0.28em] text-cyan-800">
                <span>Runtime: {isLoadingRuntime ? "LOADING" : runtimeError ? "ERROR" : "READY"}</span>
                <span>Blocks: {runtimeStats.blockCount}</span>
                <span>Domains: {runtimeStats.domains.join(", ") || "n/a"}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-2 text-xs text-emerald-200">
              <input
                checked={includeLegacy}
                onChange={(event) => setIncludeLegacy(event.target.checked)}
                type="checkbox"
              />
              Подключать `abstract_mind_db`
            </label>
            <button
              className="flex items-center gap-2 rounded-xl border border-cyan-700/40 px-3 py-2 text-xs font-semibold text-cyan-200"
              onClick={() => void loadRuntime()}
              type="button"
            >
              <RefreshCw size={14} />
              Пересобрать runtime
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {summaryCards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-cyan-900/30 bg-[#030712] p-4">
              <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-700">{card.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{card.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard
            title="Конфигурация"
            meta="Целевые домены и слои, с которыми будет работать Python Generation runtime"
            icon={<Target size={14} />}
          >
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-[10px] uppercase tracking-[0.22em] text-cyan-700">Intent</label>
                <textarea
                  className="h-24 w-full rounded-xl border border-cyan-900 bg-[#050505] p-3 text-sm text-cyan-100 outline-none focus:border-pink-500"
                  onChange={(event) => setIntent(event.target.value)}
                  value={intent}
                />
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-700">Domains</div>
                <div className="flex flex-wrap gap-2">
                  {DOMAIN_OPTIONS.map((domain) => (
                    <button
                      key={domain}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        domains.includes(domain)
                          ? "border-pink-500 bg-pink-500/10 text-pink-200"
                          : "border-cyan-900 text-cyan-700"
                      }`}
                      onClick={() => toggleDomain(domain)}
                      type="button"
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-cyan-700">Layers</div>
                <div className="flex flex-wrap gap-2">
                  {LAYER_OPTIONS.map((layer) => (
                    <button
                      key={layer}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        layers.includes(layer)
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                          : "border-cyan-900 text-cyan-700"
                      }`}
                      onClick={() => toggleLayer(layer)}
                      type="button"
                    >
                      Layer {layer}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <label className="text-xs text-cyan-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-cyan-700">Max blocks</span>
                  <input className="w-full rounded-xl border border-cyan-900 bg-[#050505] px-3 py-2" min="1" max="24" onChange={(event) => setMaxBlocks(Number(event.target.value) || 10)} type="number" value={maxBlocks} />
                </label>
                <label className="text-xs text-cyan-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-cyan-700">Temperature</span>
                  <input className="w-full rounded-xl border border-cyan-900 bg-[#050505] px-3 py-2" max="1" min="0" onChange={(event) => setTemperature(Number(event.target.value) || 0.55)} step="0.05" type="number" value={temperature} />
                </label>
                <label className="text-xs text-cyan-300">
                  <span className="mb-1 block text-[10px] uppercase tracking-[0.22em] text-cyan-700">Runs</span>
                  <input className="w-full rounded-xl border border-cyan-900 bg-[#050505] px-3 py-2" min="1" max="32" onChange={(event) => setRuns(Number(event.target.value) || 8)} type="number" value={runs} />
                </label>
                <div className="rounded-xl border border-cyan-900 bg-[#050505] px-3 py-2 text-xs text-cyan-300">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-cyan-700">Phases</div>
                  <div className="mt-1 break-words">{runtimeStats.phases.join(", ") || "n/a"}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="rounded-xl border border-pink-500/40 bg-pink-500/10 px-4 py-2 text-xs font-semibold text-pink-200" disabled={isBuilding || isLoadingRuntime} onClick={() => void handleBuild("v3")} type="button">
                  <Sparkles size={14} className="mr-2 inline" />
                  Build V3
                </button>
                <button className="rounded-xl border border-cyan-700/40 px-4 py-2 text-xs font-semibold text-cyan-200" disabled={isBuilding || isLoadingRuntime} onClick={() => void handleBuild("v1")} type="button">
                  Build V1
                </button>
                <button className="rounded-xl border border-emerald-600/40 px-4 py-2 text-xs font-semibold text-emerald-200" disabled={isLoadingRuntime} onClick={handleMutation} type="button">
                  <Wand2 size={14} className="mr-2 inline" />
                  Mutation
                </button>
                <button className="rounded-xl border border-violet-600/40 px-4 py-2 text-xs font-semibold text-violet-200" disabled={isLoadingRuntime} onClick={handleCrossover} type="button">
                  <GitMerge size={14} className="mr-2 inline" />
                  Crossover
                </button>
                <button className="rounded-xl border border-amber-500/40 px-4 py-2 text-xs font-semibold text-amber-200" disabled={isLoadingRuntime} onClick={handleSelfRules} type="button">
                  <Brain size={14} className="mr-2 inline" />
                  Self Rules
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Runtime Snapshot"
            meta={runtimeError || "Сводка по данным, собранным из БД для MMSS-мутации"}
            icon={<Database size={14} />}
          >
            <JsonViewport
              emptyText={isLoadingRuntime ? "Loading MMSS runtime..." : "Runtime unavailable"}
              value={runtime ? {
                stats: runtime.stats,
                sampleBlocks: Object.values(runtime.blockIndex?.blocks || {}).slice(0, 6),
              } : null}
            />
          </SectionCard>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["result", "Result"],
            ["mutation", "Mutation"],
            ["crossover", "Crossover"],
            ["rules", "Rules"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={`rounded-full border px-3 py-1 text-xs ${activeTab === key ? "border-cyan-400 bg-cyan-400/10 text-cyan-100" : "border-cyan-900 text-cyan-700"}`}
              onClick={() => setActiveTab(key)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab === "result" ? (
          <SectionCard
            title="Build Result"
            meta="Собранный MMSS-пакет на основе ontology-driven runtime"
            icon={<Sparkles size={14} />}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200" onClick={() => quickSave(result, "mmss_mutator_result", `MMSS Mutator ${new Date().toLocaleTimeString()}`, "#34d399")} type="button">
                Сохранить в библиотеку
              </button>
            </div>
            <JsonViewport emptyText={isBuilding ? "Building..." : "No build result yet"} value={result} />
          </SectionCard>
        ) : null}

        {activeTab === "mutation" ? (
          <SectionCard
            title="Mutation Output"
            meta="Новые блоки, созданные мутацией существующих runtime-блоков"
            icon={<Wand2 size={14} />}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200" onClick={() => quickSave({ meta: { type: "mmss_mutator.mutations" }, blocks: mutations }, "mmss_mutator_mutations", `MMSS Mutations ${new Date().toLocaleTimeString()}`, "#f59e0b")} type="button">
                Сохранить в библиотеку
              </button>
            </div>
            <JsonViewport emptyText="Run mutation first" value={mutations} />
          </SectionCard>
        ) : null}

        {activeTab === "crossover" ? (
          <SectionCard
            title="Crossover Output"
            meta="Скрещивание блоков со схожими доменами, слоями и связями"
            icon={<GitMerge size={14} />}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200" onClick={() => quickSave({ meta: { type: "mmss_mutator.crossovers" }, blocks: crossovers }, "mmss_mutator_crossovers", `MMSS Crossovers ${new Date().toLocaleTimeString()}`, "#8b5cf6")} type="button">
                Сохранить в библиотеку
              </button>
            </div>
            <JsonViewport emptyText="Run crossover first" value={crossovers} />
          </SectionCard>
        ) : null}

        {activeTab === "rules" ? (
          <SectionCard
            title="Self Rule Output"
            meta="Автогенерированные правила по доменным сочетаниям и графовым паттернам"
            icon={<Brain size={14} />}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <button className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs text-emerald-200" onClick={() => quickSave(selfRules, "mmss_mutator_rules", `MMSS Rules ${new Date().toLocaleTimeString()}`, "#fbbf24")} type="button">
                Сохранить в библиотеку
              </button>
            </div>
            <JsonViewport emptyText="Run self rules first" value={selfRules} />
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
