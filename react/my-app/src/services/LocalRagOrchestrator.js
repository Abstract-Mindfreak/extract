const ARCHIVER_PROXY_BASE = "http://localhost:3456";

async function parseJson(response) {
  return response.json().catch(() => null);
}

async function requestJson(url, options = {}, actionLabel = "Request") {
  let response;
  try {
    response = await fetch(url, options);
  } catch (error) {
    throw new Error(`${actionLabel} fetch failed. endpoint=${url}. reason=${error?.message || error}`);
  }

  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `${actionLabel} failed: HTTP ${response.status}. endpoint=${url}`);
  }
  return payload.data;
}

async function getRagStatus(database = "abstract-mind-lab") {
  // Convert legacy to actual database name
  const dbTarget = database === "legacy" ? "abstract_mind_db" : database;
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/status?database=${encodeURIComponent(dbTarget)}`,
    {},
    "RAG status",
  );
}

async function getRagJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/job/${encodeURIComponent(jobId)}`,
    {},
    "RAG job",
  );
}

async function cancelRagJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/job/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "RAG cancel",
  );
}

async function startRagVectorization(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/vectorize`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "RAG vectorization",
  );
}

async function searchLocalRag(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "RAG search",
  );
}

async function buildRagContext(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/context`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "RAG context",
  );
}

async function answerWithLocalRag(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/answer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "RAG answer",
  );
}

async function getMmssRuntimeHealth(database = "abstract-mind-lab") {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/runtime/health?database=${encodeURIComponent(database)}`,
    {},
    "MMSS runtime health",
  );
}

async function listMmssCustomInstructions(database = "abstract-mind-lab", limit = 100) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/custom-instructions?database=${encodeURIComponent(database)}&limit=${encodeURIComponent(limit)}`,
    {},
    "MMSS custom instructions",
  );
}

async function saveMmssCustomInstruction(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/custom-instructions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS custom instruction save",
  );
}

async function saveGeneratedMmssAlbum(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/albums/save-generated`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS album save",
  );
}

async function buildGeneratedMmssAlbumFlowmusicPayload(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/albums/build-flowmusic-payload`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS album Flowmusic payload",
  );
}

async function startRagChunksRefreshJob() {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag-chunks/refresh`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "rag_chunks refresh",
  );
}

async function getRagChunksRefreshJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag-chunks/refresh/${encodeURIComponent(jobId)}`,
    {},
    "rag_chunks refresh status",
  );
}

async function cancelRagChunksRefreshJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag-chunks/refresh/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "rag_chunks refresh cancel",
  );
}

async function syncMmssTrackPrompts(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/tracks-prompts/sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS track prompt sync",
  );
}

async function syncMmssFiltered(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/filtered/sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS filtered sync",
  );
}

async function syncMmssCollectionFromFiltered(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/collection/sync-from-filtered`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS collection sync from filtered",
  );
}

async function startMmssSkillTreeDesignJob(request) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/skill-tree/design/async`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(request || {}),
    },
    "MMSS skill tree design job",
  );
}

async function getMmssSkillTreeDesignJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/skill-tree/design/job/${encodeURIComponent(jobId)}`,
    {},
    "MMSS skill tree design status",
  );
}

async function cancelMmssSkillTreeDesignJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss/skill-tree/design/job/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "MMSS skill tree design cancel",
  );
}

export function useLocalRagOrchestrator() {
  return {
    answerWithLocalRag,
    buildGeneratedMmssAlbumFlowmusicPayload,
    buildRagContext,
    cancelRagChunksRefreshJob,
    cancelMmssSkillTreeDesignJob,
    getRagJob,
    getRagStatus,
    listMmssCustomInstructions,
    getMmssRuntimeHealth,
    getMmssSkillTreeDesignJob,
    cancelRagJob,
    getRagChunksRefreshJob,
    saveGeneratedMmssAlbum,
    searchLocalRag,
    saveMmssCustomInstruction,
    startRagChunksRefreshJob,
    startMmssSkillTreeDesignJob,
    syncMmssCollectionFromFiltered,
    startRagVectorization,
    syncMmssFiltered,
    syncMmssTrackPrompts,
  };
}

export default useLocalRagOrchestrator;
