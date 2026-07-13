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

export function useMMSSThemeAlbumGroupsWorkspaceService() {
  return useMemo(() => ({
    listGroups(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups?database=${encodeURIComponent(database)}`,
        {},
        "theme album groups list",
      );
    },
    getGroup(database, groupId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(groupId)}?database=${encodeURIComponent(database)}`,
        {},
        "theme album group details",
      );
    },
    createGroup(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups`,
        jsonOptions("POST", payload),
        "theme album group create",
      );
    },
    updateGroup(groupId, payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(groupId)}`,
        jsonOptions("PUT", payload),
        "theme album group update",
      );
    },
    deleteGroup(database, groupId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(groupId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "theme album group delete",
      );
    },
    generateGroup(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/generate`,
        jsonOptions("POST", payload),
        "theme album group generate",
      );
    },
    searchCandidates(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/candidates/search`,
        jsonOptions("POST", payload),
        "theme album group candidate search",
      );
    },
    listMemberships(database, trackIds) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/memberships`,
        jsonOptions("POST", { database, track_ids: trackIds }),
        "theme album group memberships",
      );
    },
    addTrackToGroup(groupId, payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(groupId)}/tracks`,
        jsonOptions("POST", payload),
        "theme album group track add",
      );
    },
    deleteTrackFromGroup(database, groupId, trackId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(groupId)}/tracks/${encodeURIComponent(trackId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "theme album group track delete",
      );
    },
    validateLinks(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/${encodeURIComponent(payload.group_id || payload.groupId)}/validate-links`,
        jsonOptions("POST", payload),
        "theme album group validate links",
      );
    },
    listJobs(database = "abstract-mind-lab") {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-group-jobs?database=${encodeURIComponent(database)}`,
        {},
        "theme album group jobs list",
      );
    },
    deleteJob(database, jobId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-group-jobs/${encodeURIComponent(jobId)}?database=${encodeURIComponent(database)}`,
        {
          method: "DELETE",
          headers: {
            Accept: "application/json",
          },
        },
        "theme album group job delete",
      );
    },
    clearJobs(database, statuses) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-group-jobs/clear`,
        jsonOptions("POST", { database, statuses }),
        "theme album group jobs clear",
      );
    },
    startPipeline(payload) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/pipeline/start`,
        jsonOptions("POST", payload),
        "theme album group pipeline start",
      );
    },
    getPipelineJob(jobId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/pipeline/job/${encodeURIComponent(jobId)}`,
        {},
        "theme album group pipeline job",
      );
    },
    cancelPipeline(database, jobId) {
      return requestJson(
        `${ARCHIVER_PROXY_BASE}/api/mmss/theme-album-groups/pipeline/job/${encodeURIComponent(jobId)}/cancel`,
        jsonOptions("POST", { database }),
        "theme album group pipeline cancel",
      );
    },
  }), []);
}

export default useMMSSThemeAlbumGroupsWorkspaceService;
