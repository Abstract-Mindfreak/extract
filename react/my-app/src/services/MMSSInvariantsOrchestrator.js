import { useLocalRagOrchestrator } from "./LocalRagOrchestrator";

const DEFAULT_MODE = "mmss_invariants";
const DEFAULT_DATABASE = "abstract-mind-lab";
const ARCHIVER_PROXY_BASE = "http://localhost:3456";
const DEFAULT_SOURCE_SCOPES = [
  {
    database: "abstract-mind-lab",
    sourceTables: ["mmss_invariants", "tracks", "sessions"],
  },
  {
    database: "abstract_mind_db",
    sourceTables: ["music_blocks"],
  },
];

function withDefaults(request = {}) {
  return {
    database: request.database || DEFAULT_DATABASE,
    mode: request.mode || DEFAULT_MODE,
    sourceScopes: Array.isArray(request.sourceScopes) && request.sourceScopes.length
      ? request.sourceScopes
      : DEFAULT_SOURCE_SCOPES,
    ...request,
  };
}

async function parseJson(response) {
  return response.json().catch(() => null);
}

async function requestJson(url, options = {}, actionLabel = "MMSS request") {
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

async function getInvariantStatus(database = DEFAULT_DATABASE) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss-invariants/status?database=${encodeURIComponent(database)}`,
    {},
    "MMSS invariant status",
  );
}

async function syncInvariantSeed(request = {}) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss-invariants/seed/sync`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(withDefaults(request)),
    },
    "MMSS seed sync",
  );
}

async function startInvariantExtraction(request = {}) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss-invariants/extract`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(withDefaults(request)),
    },
    "MMSS extraction",
  );
}

async function getInvariantJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss-invariants/job/${encodeURIComponent(jobId)}`,
    {},
    "MMSS job",
  );
}

async function cancelInvariantJob(jobId) {
  return requestJson(
    `${ARCHIVER_PROXY_BASE}/api/mmss-invariants/job/${encodeURIComponent(jobId)}/cancel`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    },
    "MMSS cancel",
  );
}

export function useMMSSInvariantsOrchestrator() {
  const orchestrator = useLocalRagOrchestrator();

  return {
    getInvariantStatus,
    syncInvariantSeed,
    startInvariantExtraction,
    getInvariantJob,
    cancelInvariantJob,
    getStatus: orchestrator.getRagStatus,
    searchInvariants: (request) => orchestrator.searchLocalRag(withDefaults(request)),
    buildInvariantContext: (request) => orchestrator.buildRagContext(withDefaults(request)),
    generateInvariantAnswer: (request) => orchestrator.answerWithLocalRag(withDefaults(request)),
  };
}

export {
  DEFAULT_DATABASE as MMSS_INVARIANTS_DEFAULT_DATABASE,
  DEFAULT_MODE as MMSS_INVARIANTS_DEFAULT_MODE,
  DEFAULT_SOURCE_SCOPES as MMSS_INVARIANTS_DEFAULT_SOURCE_SCOPES,
};
