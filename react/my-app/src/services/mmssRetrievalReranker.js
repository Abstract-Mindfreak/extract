function tokenize(input) {
  return String(input || '')
    .toLowerCase()
    .split(/[^a-zа-я0-9_]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function dedupe(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function normalizeRetrievalQuery(query = {}) {
  const queries = Array.isArray(query.queries) ? query.queries.filter(Boolean) : [];
  const blockRoles = Array.isArray(query.blockRoles) ? query.blockRoles.filter(Boolean) : [];
  const prompt = String(query.prompt || '');
  const limit = Math.max(1, Number(query.limit) || 8);
  const tokens = dedupe([
    ...tokenize(prompt),
    ...queries.flatMap(tokenize),
    ...blockRoles.flatMap(tokenize),
  ]);

  return {
    prompt,
    queries,
    blockRoles,
    limit,
    tokens,
  };
}

function scoreCandidate(candidate, normalizedQuery, options = {}) {
  const roleSet = normalizedQuery.blockRoles.map((role) => String(role).toLowerCase());
  const haystackText = [
    candidate.name,
    candidate.description,
    ...(candidate.tags || []),
    ...(candidate.keyPathSet || []),
    ...(candidate.operatorSet || []),
    ...(candidate.metricSet || []),
  ]
    .join(' ')
    .toLowerCase();

  let lexical = 0;
  let structural = 0;
  let role = 0;
  let mmss = 0;
  let manual = 0;
  const reasons = [];

  normalizedQuery.tokens.forEach((token) => {
    let tokenScore = 0;
    if (String(candidate.name).toLowerCase().includes(token)) tokenScore += 7;
    if (String(candidate.description).toLowerCase().includes(token)) tokenScore += 4;
    if ((candidate.tags || []).some((tag) => String(tag).toLowerCase().includes(token))) tokenScore += 5;
    if ((candidate.keyPathSet || []).some((key) => key.includes(token))) tokenScore += 4;
    if (haystackText.includes(token)) tokenScore += 2;
    if (tokenScore > 0) {
      lexical += tokenScore;
      reasons.push(`${token}:${tokenScore}`);
    }
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
    reasons.push('pinned');
  }

  return {
    ...candidate,
    score: lexical + structural + role + mmss + manual,
    scoreBreakdown: { lexical, structural, role, mmss, manual },
    reasons,
    roleMatches: (candidate.blockRoleHints || []).filter((entry) => roleSet.includes(entry.toLowerCase())),
  };
}

function rerankCandidates(index, query, options = {}) {
  const normalizedQuery = normalizeRetrievalQuery(query);
  const pinnedIds = Array.isArray(options.pinnedIds) ? options.pinnedIds : [];
  const items = (Array.isArray(index) ? index : [])
    .map((candidate) => scoreCandidate(candidate, normalizedQuery, { pinnedIds }))
    .filter((candidate) => candidate.score > 0 || pinnedIds.includes(candidate.id))
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, normalizedQuery.limit);

  return {
    items,
    meta: {
      prompt: normalizedQuery.prompt,
      queries: normalizedQuery.queries,
      blockRoles: normalizedQuery.blockRoles,
      tokens: normalizedQuery.tokens,
      limit: normalizedQuery.limit,
      pinnedIds,
      totalMatches: items.length,
    },
  };
}

module.exports = {
  normalizeRetrievalQuery,
  rerankCandidates,
};
