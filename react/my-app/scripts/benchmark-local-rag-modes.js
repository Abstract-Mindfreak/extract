const fs = require("fs");
const path = require("path");
const { answerWithRag } = require("../server/localRagService");

async function loadPresetModule() {
  const presetPath = path.resolve(__dirname, "../src/config/mmssModePresets.js");
  const source = await fs.promises.readFile(presetPath, "utf8");
  const transformed = source
    .replace(/export function /g, "function ")
    .replace(/export const /g, "const ")
    .replace(/export\s*\{[\s\S]*?\};?/g, "")
    .concat("\nmodule.exports = { getLocalRagModePreset, LOCAL_RAG_PRESET_MODES, MODE_META, DEFAULT_MODEL, FINAL_JSON_MAX_CHARS };");
  const module = { exports: {} };
  const fn = new Function("module", "exports", transformed);
  fn(module, module.exports);
  return module.exports;
}

const CHECKPOINT_PATH = path.resolve(__dirname, "../../tmp/local-rag-mode-benchmark.checkpoint.json");
const REPORT_PATH = path.resolve(__dirname, "../../tmp/local-rag-mode-benchmark.report.json");

const JSON_HEAVY_MODES = new Set(["album_synthesis", "album_concept"]);

function toSourceScopes(scopeSelections = {}) {
  return Object.entries(scopeSelections)
    .map(([database, sourceTables]) => ({
      database,
      sourceTables: Array.isArray(sourceTables) ? sourceTables.filter(Boolean) : [],
    }))
    .filter((entry) => entry.sourceTables.length > 0);
}

function clampForSmoke(preset) {
  return {
    ...preset,
    topK: Math.max(2, Math.min(4, Number(preset.topK) || 4)),
    queryBudget: Math.max(1, Math.min(2, Number(preset.queryBudget) || 2)),
    responseMaxChars: JSON_HEAVY_MODES.has(preset.mode) ? 8000 : 1800,
  };
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function isJsonLike(text) {
  const value = String(text || "").trim();
  return value.startsWith("{") || value.startsWith("[");
}

function validateResult(mode, answerResult) {
  const answer = String(answerResult?.answer || "").trim();
  if (!answer) {
    throw new Error("Empty answer");
  }
  if ((mode === "album_synthesis" || mode === "album_concept") && !isJsonLike(answer)) {
    throw new Error("Expected JSON album response");
  }
  return {
    chars: answer.length,
    retrievedSources: Array.isArray(answerResult?.retrievedSources) ? answerResult.retrievedSources.length : 0,
    preview: answer.slice(0, 220),
  };
}

async function main() {
  const { getLocalRagModePreset, LOCAL_RAG_PRESET_MODES } = await loadPresetModule();
  const modeFilter = (process.argv.find((entry) => entry.startsWith("--modes=")) || "")
    .replace(/^--modes=/, "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const variantFilter = (process.argv.find((entry) => entry.startsWith("--variants=")) || "")
    .replace(/^--variants=/, "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const checkpoint = readJson(CHECKPOINT_PATH, { completed: [] });
  const completed = new Set(Array.isArray(checkpoint.completed) ? checkpoint.completed : []);
  const report = readJson(REPORT_PATH, {
    startedAt: new Date().toISOString(),
    database: process.argv[2] || process.env.PG_DATABASE || "abstract-mind-lab",
    model: process.argv[3] || "mmss-qwen2.5-3b:latest",
    results: [],
  });

  const variants = variantFilter.length ? variantFilter : ["quick", "deep"];
  const modes = modeFilter.length ? LOCAL_RAG_PRESET_MODES.filter((mode) => modeFilter.includes(mode)) : LOCAL_RAG_PRESET_MODES;
  for (const mode of modes) {
    for (const variant of variants) {
      const key = `${mode}:${variant}`;
      if (completed.has(key)) {
        continue;
      }

      const preset = clampForSmoke(getLocalRagModePreset(mode, variant));
      const sourceScopes = toSourceScopes(preset.scopeSelections);
      console.log(`\n[MODE] ${key}`);
      const startedAt = Date.now();
      try {
        const result = await answerWithRag({
          database: preset.database,
          query: preset.query,
          mode: preset.mode,
          model: report.model,
          topK: preset.topK,
          queryBudget: preset.queryBudget,
          sourceScopes,
          filterProfile: preset.filterProfile,
          includeRelationLayer: preset.includeRelationLayer,
          responseMaxChars: preset.responseMaxChars,
          enforceResponseMaxChars: true,
        });
        const validation = validateResult(mode, result);
        report.results.push({
          key,
          mode,
          variant,
          ok: true,
          tookMs: Date.now() - startedAt,
          model: result.model,
          topK: preset.topK,
          queryBudget: preset.queryBudget,
          sourceScopes,
          ...validation,
        });
        completed.add(key);
        writeJson(CHECKPOINT_PATH, { completed: Array.from(completed) });
        writeJson(REPORT_PATH, report);
        console.log(`[OK] ${key}`);
      } catch (error) {
        report.results.push({
          key,
          mode,
          variant,
          ok: false,
          tookMs: Date.now() - startedAt,
          error: error?.message || String(error),
        });
        writeJson(REPORT_PATH, report);
        console.error(`[FAIL] ${key}: ${error?.message || error}`);
        process.exit(1);
      }
    }
  }

  report.completedAt = new Date().toISOString();
  writeJson(REPORT_PATH, report);
  console.log(`\n[REPORT] ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
