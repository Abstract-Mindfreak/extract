function tokenize(input) {
  return String(input || "")
    .toLowerCase()
    .split(/[^a-zа-я0-9_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function dedupe(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function collectKeys(value, prefix = "", seen = new Set()) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => collectKeys(item, `${prefix}[${index}]`, seen));
  }

  const keys = [];
  Object.entries(value).forEach(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (!seen.has(path)) {
      seen.add(path);
      keys.push(path.toLowerCase());
    }
    keys.push(...collectKeys(child, path, seen));
  });
  return keys;
}

function getJsonDepth(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map((item) => getJsonDepth(item)));
  }
  return 1 + Math.max(0, ...Object.values(value).map((item) => getJsonDepth(item)));
}

function getStructuralWidth(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) {
    return value.length;
  }
  return Object.keys(value).length;
}

function extractMetricSet(payloadText) {
  const metrics = ["V", "N", "S", "D_f", "G_S", "R_T"];
  return metrics.filter((metric) => payloadText.includes(metric.toLowerCase()));
}

function extractOperatorSet(payloadText) {
  return ["⇛ᶠ", "↦ₚ", "⊢ᵠ", "⧴ᵗ", "operator", "formula"].filter((operator) =>
    payloadText.includes(operator.toLowerCase()),
  );
}

function inferBlockRoleHints(block, payloadKeys, payloadText) {
  const haystack = [block.name, block.description, ...(block.tags || []), ...payloadKeys, payloadText]
    .join(" ")
    .toLowerCase();

  const roleMatchers = {
    schema: ["schema", "structure", "skeleton"],
    principle: ["principle", "rule", "logic"],
    operator: ["operator", "formula", "projection"],
    example: ["example", "sample", "demo"],
    metrics: ["metric", "metrics", "v", "d_f", "g_s"],
  };

  return Object.entries(roleMatchers)
    .filter(([, tokens]) => tokens.some((token) => haystack.includes(token)))
    .map(([role]) => role);
}

function buildRetrievalCandidate(block) {
  const payload = block?.payload?.data || {};
  const payloadText = JSON.stringify(payload).toLowerCase();
  const keyPathSet = collectKeys(payload);

  return {
    id: block.id,
    name: block.name || block.id,
    description: block.description || "",
    category: block.category || "unknown",
    tags: Array.isArray(block.tags) ? block.tags : [],
    blockRoleHints: inferBlockRoleHints(block, keyPathSet, payloadText),
    operatorSet: extractOperatorSet(payloadText),
    metricSet: extractMetricSet(payloadText),
    keyPathSet,
    structuralDepth: getJsonDepth(payload),
    structuralWidth: getStructuralWidth(payload),
    sourcePath: "promptLibrary.blocks[].payload.data",
    payload,
  };
}

function buildRetrievalIndex(promptLibrary) {
  const blocks = Array.isArray(promptLibrary?.blocks) ? promptLibrary.blocks : [];
  return blocks.map(buildRetrievalCandidate);
}

function scoreCandidate(candidate, query, options = {}) {
  const tokens = dedupe([
    ...tokenize(query?.prompt || ""),
    ...(query?.queries || []).flatMap(tokenize),
    ...(query?.blockRoles || []).flatMap(tokenize),
  ]);

  const roleSet = (query?.blockRoles || []).map((role) => String(role).toLowerCase());
  const haystackText = [
    candidate.name,
    candidate.description,
    ...(candidate.tags || []),
    ...(candidate.keyPathSet || []),
    ...(candidate.operatorSet || []),
    ...(candidate.metricSet || []),
  ]
    .join(" ")
    .toLowerCase();

  let lexical = 0;
  let structural = 0;
  let role = 0;
  let mmss = 0;
  let manual = 0;
  const reasons = [];

  tokens.forEach((token) => {
    let score = 0;
    if (String(candidate.name).toLowerCase().includes(token)) score += 7;
    if (String(candidate.description).toLowerCase().includes(token)) score += 4;
    if ((candidate.tags || []).some((tag) => String(tag).toLowerCase().includes(token))) score += 5;
    if ((candidate.keyPathSet || []).some((key) => key.includes(token))) score += 4;
    if (haystackText.includes(token)) score += 2;
    lexical += score;
    if (score > 0) reasons.push(`${token}:${score}`);
  });

  if (candidate.structuralDepth >= 4) structural += 2;
  if (candidate.structuralWidth >= 6) structural += 2;
  if ((candidate.metricSet || []).length) mmss += 3;
  if ((candidate.operatorSet || []).length) mmss += 3;

  roleSet.forEach((roleHint) => {
    if ((candidate.blockRoleHints || []).some((entry) => entry.toLowerCase().includes(roleHint))) {
      role += 6;
    }
  });

  if ((options.pinnedIds || []).includes(candidate.id)) {
    manual += 50;
    reasons.push("pinned");
  }

  return {
    ...candidate,
    score: lexical + structural + role + mmss + manual,
    scoreBreakdown: { lexical, structural, role, mmss, manual },
    reasons,
    roleMatches: (candidate.blockRoleHints || []).filter((entry) => roleSet.includes(entry.toLowerCase())),
  };
}

function searchRetrievalIndex(index, query, options = {}) {
  return index
    .map((candidate) => scoreCandidate(candidate, query, options))
    .filter((candidate) => candidate.score > 0 || (options.pinnedIds || []).includes(candidate.id))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, Math.max(1, Number(query?.limit) || 8));
}

module.exports = {
  buildRetrievalCandidate,
  buildRetrievalIndex,
  searchRetrievalIndex,
};
