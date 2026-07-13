import { useMemo } from "react";

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

function jsonOptions(method, body) {
  return {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body || {}),
  };
}

export function useMMSSSkillsWorkspaceService() {
  return useMemo(() => ({
    getRuntimeHealth(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/runtime/health?database=${encodeURIComponent(database)}`,
        {},
        "MMSS runtime health",
      );
    },
    listSkills(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills?database=${encodeURIComponent(database)}`,
        {},
        "skills list",
      );
    },
    createSkill(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills`,
        jsonOptions("POST", payload),
        "skill create",
      );
    },
    updateSkill(skillId, payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills/${encodeURIComponent(skillId)}`,
        jsonOptions("PUT", payload),
        "skill update",
      );
    },
    deleteSkill(database, skillId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills/${encodeURIComponent(skillId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "skill delete",
      );
    },
    listSkillSets(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-sets?database=${encodeURIComponent(database)}`,
        {},
        "skill sets list",
      );
    },
    createSkillSet(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-sets`,
        jsonOptions("POST", payload),
        "skill set create",
      );
    },
    updateSkillSet(skillSetId, payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-sets/${encodeURIComponent(skillSetId)}`,
        jsonOptions("PUT", payload),
        "skill set update",
      );
    },
    deleteSkillSet(database, skillSetId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-sets/${encodeURIComponent(skillSetId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "skill set delete",
      );
    },
    listSkillTrees(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-trees?database=${encodeURIComponent(database)}`,
        {},
        "skill trees list",
      );
    },
    createSkillTree(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-trees`,
        jsonOptions("POST", payload),
        "skill tree create",
      );
    },
    updateSkillTree(treeId, payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-trees/${encodeURIComponent(treeId)}`,
        jsonOptions("PUT", payload),
        "skill tree update",
      );
    },
    deleteSkillTree(database, treeId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-trees/${encodeURIComponent(treeId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "skill tree delete",
      );
    },
    generateSkills(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills/generate`,
        jsonOptions("POST", payload),
        "skills generate",
      );
    },
    saveGeneratedSkills(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills/save-generated`,
        jsonOptions("POST", payload),
        "skills save generated",
      );
    },
    executeSkill(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skills/execute`,
        jsonOptions("POST", payload),
        "skill execute",
      );
    },
    listSkillRuns(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/skill-runs?database=${encodeURIComponent(database)}`,
        {},
        "skill runs list",
      );
    },
    listGenerations(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/generations?database=${encodeURIComponent(database)}`,
        {},
        "generation results list",
      );
    },
  }), []);
}

export default useMMSSSkillsWorkspaceService;
