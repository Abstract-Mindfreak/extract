const { answerWithRag, searchRag } = require("../server/localRagService");
const {
  generateSkills,
  saveGeneratedSkills,
  executeSkill,
  listSkills,
} = require("../server/mmssSkillsService");
const { designSkillTree } = require("../server/mmssSkillTreeService");
const {
  getRuntimeHealth,
  buildGeneratedAlbumFlowmusicPayload,
  saveGeneratedAlbum,
} = require("../server/mmssRuntimePersistenceService");

const DATABASE = process.argv[2] || process.env.PG_DATABASE || "abstract-mind-lab";
const MODEL = process.argv[3] || "mmss-qwen2.5-3b:latest";
const VERIFIED_FALLBACK = "mmss-gemma4-q4:latest";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function safeJsonParse(text) {
  const source = String(text || "").trim();
  if (!source) {
    throw new Error("Empty JSON text");
  }

  try {
    return JSON.parse(source);
  } catch (_error) {
    const fenced = source.match(/```json\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(source.slice(start, end + 1));
    }
    throw new Error("Failed to parse JSON response");
  }
}

function normalizeTopResult(result) {
  const top = Array.isArray(result?.results) ? result.results[0] : null;
  return top
    ? {
        sourceTable: top.sourceTable,
        sourceId: top.sourceId,
        sourceTitle: top.sourceTitle,
        similarity: top.similarity,
      }
    : null;
}

async function runStep(label, fn) {
  const startedAt = Date.now();
  console.log(`\n[STEP] ${label}`);
  const value = await fn();
  const tookMs = Date.now() - startedAt;
  console.log(`[OK] ${label} (${tookMs}ms)`);
  return { value, tookMs };
}

async function main() {
  const report = {
    database: DATABASE,
    priorityModel: MODEL,
    fallbackModel: VERIFIED_FALLBACK,
    startedAt: new Date().toISOString(),
    steps: [],
  };

  const healthStep = await runStep("Runtime health + skill vectorization", async () => {
    const health = await getRuntimeHealth(DATABASE);
    assert(health?.skill_rag_vectorization?.summary === "3/3 ready", "Skill RAG vectorization is not fully ready");
    return {
      vectorization: health.skill_rag_vectorization,
      tables: health.tables,
    };
  });
  report.steps.push({ step: "health", ...healthStep.value, tookMs: healthStep.tookMs });

  const retrievalScopes = [
    {
      database: DATABASE,
      sourceTables: ["mmss_skills", "mmss_skill_sets", "mmss_skill_trees"],
    },
  ];

  const retrievalCases = [
    {
      name: "skill_tree_pathfinding",
      query: "Find the best MMSS runtime path for album creation and autonomous skill growth.",
      mode: "skill_tree_pathfinding",
      expectOneOf: ["mmss_skill_trees", "mmss_skill_sets", "mmss_skills"],
    },
    {
      name: "skill_chain_orchestration",
      query: "Which skill chain should orchestrate evidence retrieval, operator mapping, and album prompt assembly?",
      mode: "skill_chain_orchestration",
      expectOneOf: ["mmss_skill_sets", "mmss_skills"],
    },
    {
      name: "skill_gap_analysis",
      query: "What MMSS runtime gaps remain if the system must create albums and invent missing skills?",
      mode: "skill_gap_analysis",
      expectOneOf: ["mmss_skill_trees", "mmss_skills"],
    },
  ];

  const retrievalBench = [];
  for (const testCase of retrievalCases) {
    const step = await runStep(`Retrieval benchmark: ${testCase.name}`, async () => {
      const search = await searchRag({
        database: DATABASE,
        query: testCase.query,
        mode: testCase.mode,
        topK: 6,
        queryBudget: 3,
        sourceScopes: retrievalScopes,
      });
      const top = normalizeTopResult(search);
      assert(top, `No retrieval results for ${testCase.name}`);
      assert(testCase.expectOneOf.includes(top.sourceTable), `Unexpected top source table for ${testCase.name}: ${top.sourceTable}`);

      const answer = await answerWithRag({
        database: DATABASE,
        query: testCase.query,
        mode: testCase.mode,
        model: MODEL,
        topK: 6,
        queryBudget: 3,
        sourceScopes: retrievalScopes,
        responseMaxChars: 6000,
      });
      assert(String(answer?.model || "").includes("qwen2.5-3b"), `Unexpected answer model for ${testCase.name}: ${answer?.model}`);
      assert(String(answer?.answer || "").trim().length > 80, `Short or empty answer for ${testCase.name}`);
      return {
        mode: testCase.mode,
        top,
        answerModel: answer.model,
        retrievedCount: Array.isArray(answer.retrievedSources) ? answer.retrievedSources.length : 0,
        answerPreview: String(answer.answer || "").slice(0, 240),
      };
    });
    retrievalBench.push({ name: testCase.name, ...step.value, tookMs: step.tookMs });
  }
  report.steps.push({ step: "retrieval_benchmark", cases: retrievalBench });

  const runSkillStep = await runStep("Run Skill with qwen", async () => {
    const run = await executeSkill(DATABASE, {
      skill_id: "mmss_skill_gap_detect",
      query: "Analyze the current MMSS runtime and describe which skills are still missing for reliable album generation plus self-extension.",
      model: MODEL,
      inputs: {
        target_scope: "benchmark_qwen_skill_rag",
      },
      topK: 6,
      queryBudget: 4,
    });
    assert(run?.run?.success === true, "Run Skill did not report success");
    assert(String(run?.run?.metadata?.model || "").includes("qwen2.5-3b"), `Run Skill used unexpected model: ${run?.run?.metadata?.model}`);
    assert(String(run?.run?.answer || "").trim().length > 120, "Run Skill answer is too short");
    return {
      skillId: run.run.skill_id,
      model: run.run.metadata.model,
      qualityScore: run.run.quality_score,
      answerPreview: String(run.run.answer || "").slice(0, 260),
    };
  });
  report.steps.push({ step: "run_skill", ...runSkillStep.value, tookMs: runSkillStep.tookMs });

  const generateSkillStep = await runStep("Generate Skill with qwen", async () => {
    const generated = await generateSkills(DATABASE, {
      goal: "Create reusable MMSS skills for building album-ready prompts, validating album JSON, and detecting missing runtime capabilities.",
      context_hint: "The system must support MMSS albums, self-generated skills, and operator-aware retrieval.",
      owner_scope: "benchmark_qwen_skill_rag",
      max_skills: 3,
      model: MODEL,
      topK: 6,
      queryBudget: 4,
    });
    assert(Array.isArray(generated?.proposed_skills) && generated.proposed_skills.length > 0, "Generate Skill returned no proposals");
    generated.proposed_skills.forEach((skill, index) => {
      assert(skill.name && skill.description, `Generated skill ${index + 1} is incomplete`);
    });
    const saved = await saveGeneratedSkills(DATABASE, {
      owner_scope: "benchmark_qwen_skill_rag",
      proposals: generated.proposed_skills.slice(0, 2),
    });
    assert(Array.isArray(saved) && saved.length >= 1, "Generated skills were not saved");
    return {
      proposedCount: generated.proposed_skills.length,
      savedSkillIds: saved.map((entry) => entry.skill_id),
      skillSetName: generated?.proposed_skill_set?.name || null,
    };
  });
  report.steps.push({ step: "generate_skill", ...generateSkillStep.value, tookMs: generateSkillStep.tookMs });

  const designTreeStep = await runStep("Create skill + skill set + skill tree with qwen", async () => {
    const designed = await designSkillTree({
      database: DATABASE,
      goal: "Build a reusable MMSS runtime branch that can create albums, validate album JSON, and extend itself with newly generated skills.",
      ownerScope: "benchmark_qwen_skill_rag",
      contextHint: "Prefer rag_chunks-grounded album generation, skill gap detection, and explicit persistence artifacts.",
      sourceScopes: retrievalScopes,
      topK: 6,
      queryBudget: 4,
      mode: "skill_tree_pathfinding",
      model: MODEL,
      responseMaxChars: 20000,
    });
    const design = designed?.design || {};
    assert(Array.isArray(design.skills) && design.skills.length > 0, "Skill tree design produced no skills");
    assert(design.skill_set_id || design.skill_set?.skill_set_id, "Skill tree design produced no persisted skill set");
    assert(design.tree_id || design.skill_tree?.tree_id, "Skill tree design produced no persisted skill tree");
    return {
      model: designed?.rag?.model,
      generatedSkillCount: design.skills.length,
      skillSetId: design.skill_set_id || design.skill_set?.skill_set_id || null,
      treeId: design.tree_id || design.skill_tree?.tree_id || null,
    };
  });
  report.steps.push({ step: "design_skill_tree", ...designTreeStep.value, tookMs: designTreeStep.tookMs });

  const albumStep = await runStep("Create album with qwen", async () => {
    const answer = await answerWithRag({
      database: DATABASE,
      query: "Create a new MMSS album about self-evolving industrial memory systems with 8 distinct tracks and strict generation-ready JSON.",
      mode: "album_concept",
      model: MODEL,
      topK: 6,
      queryBudget: 4,
      sourceScopes: [
        { database: "rag_chunks_db", sourceTables: ["rag_chunks"] },
        {
          database: DATABASE,
          sourceTables: ["mmss_albums", "mmss_collection", "mmss_custom_instructions", "mmss_tracks_prompts", "mmss_skill_trees", "mmss_skill_sets", "mmss_skills"],
        },
      ],
      responseMaxChars: 20000,
    });
    assert(String(answer?.model || "").includes("qwen2.5-3b"), `Album mode used unexpected model: ${answer?.model}`);
    const parsed = safeJsonParse(answer.answer);
    const album = parsed?.album;
    assert(album && typeof album === "object", "Album JSON does not contain album object");
    assert(typeof album.title === "string" && album.title.trim(), "Album JSON missing title");
    assert(Array.isArray(album.tracks) && album.tracks.length >= 6, "Album JSON has too few tracks");

    const persisted = await saveGeneratedAlbum(DATABASE, {
      answerResult: answer,
      answer: answer.answer,
      query: answer.query,
      mode: answer.mode,
      retrievedSources: answer.retrievedSources,
      score: 0.91,
    });
    const flowmusic = await buildGeneratedAlbumFlowmusicPayload(DATABASE, {
      answerResult: answer,
      answer: answer.answer,
      query: answer.query,
      mode: answer.mode,
      retrievedSources: answer.retrievedSources,
    });
    assert(Array.isArray(flowmusic?.tracks) && flowmusic.tracks.length >= 6, "Flowmusic payload is incomplete");
    return {
      model: answer.model,
      albumTitle: album.title,
      trackCount: album.tracks.length,
      albumId: persisted?.album?.album_id || null,
      collectionEntryId: persisted?.collectionEntry?.entry_id || null,
      flowmusicTrackCount: flowmusic.tracks.length,
    };
  });
  report.steps.push({ step: "album", ...albumStep.value, tookMs: albumStep.tookMs });

  const finalSkillsStep = await runStep("Post-run skill count check", async () => {
    const skills = await listSkills(DATABASE, { limit: 400 });
    return {
      totalSkills: skills.length,
      benchmarkSkills: skills.filter((entry) => String(entry.owner_scope || "").includes("benchmark_qwen_skill_rag")).map((entry) => entry.skill_id),
    };
  });
  report.steps.push({ step: "post_check", ...finalSkillsStep.value, tookMs: finalSkillsStep.tookMs });

  report.completedAt = new Date().toISOString();
  console.log("\n[REPORT]");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("\n[FAIL]");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
