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
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/rag/status?database=${encodeURIComponent(database)}`,
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
    buildRagContext,
    cancelMmssSkillTreeDesignJob,
    getRagJob,
    getRagStatus,
    getMmssRuntimeHealth,
    getMmssSkillTreeDesignJob,
    cancelRagJob,
    searchLocalRag,
    startMmssSkillTreeDesignJob,
    startRagVectorization,
  };
}

export default useLocalRagOrchestrator;
