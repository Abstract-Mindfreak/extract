const AGENT_PROXY_BASE = "http://localhost:8766";

export async function getFlowmusicAgentStatus() {
  const response = await fetch(`${AGENT_PROXY_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Agent status failed: HTTP ${response.status}`);
  }
  return response.json();
}

export async function getMistralStatus() {
  const response = await fetch(`${AGENT_PROXY_BASE}/health`);
  if (!response.ok) {
    throw new Error(`Mistral status failed: HTTP ${response.status}`);
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
    generateFlowmusicPrompt,
  };
}

export default useFlowmusicAgentOrchestrator;
