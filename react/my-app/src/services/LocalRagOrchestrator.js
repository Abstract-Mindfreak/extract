const ARCHIVER_PROXY_BASE = "http://localhost:3456";

async function parseJson(response) {
  return response.json().catch(() => null);
}

async function getRagStatus(database = "abstract-mind-lab") {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/status?database=${encodeURIComponent(database)}`);
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG status failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function getRagJob(jobId) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/job/${encodeURIComponent(jobId)}`);
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG job failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function cancelRagJob(jobId) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/job/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG cancel failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function startRagVectorization(request) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/vectorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request || {}),
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG vectorization failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function searchLocalRag(request) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request || {}),
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG search failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function buildRagContext(request) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/context`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request || {}),
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG context failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function answerWithLocalRag(request) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/answer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request || {}),
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG answer failed: HTTP ${response.status}`);
  }
  return payload.data;
}

async function vectorizeLocalRagArtifact(request) {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/rag/artifact/vectorize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(request || {}),
  });
  const payload = await parseJson(response);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `RAG artifact vectorization failed: HTTP ${response.status}`);
  }
  return payload.data;
}

export function useLocalRagOrchestrator() {
  return {
    answerWithLocalRag,
    buildRagContext,
    getRagJob,
    getRagStatus,
    cancelRagJob,
    searchLocalRag,
    startRagVectorization,
    vectorizeLocalRagArtifact,
  };
}

export default useLocalRagOrchestrator;
