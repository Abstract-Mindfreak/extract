const AGENT_PROXY_BASE = "http://localhost:8766";
const ARCHIVER_PROXY_BASE = "http://localhost:3456";

export async function getFlowmusicAgentStatus() {
  const response = await fetch(`${AGENT_PROXY_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Agent status failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function getMistralStatus() {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/mistral/status`);
  if (!response.ok) {
    throw new Error(`Mistral status failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function getOllamaStatus() {
  const response = await fetch(`${ARCHIVER_PROXY_BASE}/api/ollama/status`);
  if (!response.ok) {
    throw new Error(`Ollama status failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function generateFlowmusicPrompt(request) {
  const response = await fetch(`${AGENT_PROXY_BASE}/generate-flowmusic`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.detail || payload?.error || `HTTP ${response.status}`);
  }
  return payload;
}

export function useFlowmusicAgentOrchestrator() {
  return {
    getFlowmusicAgentStatus,
    getMistralStatus,
    getOllamaStatus,
    generateFlowmusicPrompt,
  };
}

export default useFlowmusicAgentOrchestrator;
