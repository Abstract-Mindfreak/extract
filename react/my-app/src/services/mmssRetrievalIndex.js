const { rerankCandidates } = require('./mmssRetrievalReranker.js');

function collectKeys(value, prefix = '', seen = new Set()) {
  if (!value || typeof value !== 'object') return [];
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
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map((item) => getJsonDepth(item)));
  }
  return 1 + Math.max(0, ...Object.values(value).map((item) => getJsonDepth(item)));
}

function getStructuralWidth(value) {
  if (!value || typeof value !== 'object') return 0;
  if (Array.isArray(value)) {
    return value.length;
  }
  return Object.keys(value).length;
}

function extractMetricSet(payloadText) {
  const metrics = ['V', 'N', 'S', 'D_f', 'G_S', 'R_T'];
  return metrics.filter((metric) => payloadText.includes(metric.toLowerCase()));
}

function extractOperatorSet(payloadText) {
  return ['operator', 'formula', 'projection', 'constraint', 'relation', 'transformation'].filter((operator) =>
    payloadText.includes(operator.toLowerCase()),
  );
}

function inferBlockRoleHints(block, payloadKeys, payloadText) {
  const haystack = [block.name, block.description, ...(block.tags || []), ...payloadKeys, payloadText]
    .join(' ')
    .toLowerCase();

  const roleMatchers = {
    schema: ['schema', 'structure', 'skeleton'],
    principle: ['principle', 'rule', 'logic'],
    operator: ['operator', 'formula', 'projection', 'constraint', 'relation'],
    example: ['example', 'sample', 'demo'],
    metrics: ['metric', 'metrics', 'v', 'd_f', 'g_s', 'r_t'],
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
    description: block.description || '',
    category: block.category || 'unknown',
    tags: Array.isArray(block.tags) ? block.tags : [],
    blockRoleHints: inferBlockRoleHints(block, keyPathSet, payloadText),
    operatorSet: extractOperatorSet(payloadText),
    metricSet: extractMetricSet(payloadText),
    keyPathSet,
    structuralDepth: getJsonDepth(payload),
    structuralWidth: getStructuralWidth(payload),
    sourcePath: 'promptLibrary.blocks[].payload.data',
    payload,
  };
}

function buildRetrievalIndex(promptLibrary) {
  const blocks = Array.isArray(promptLibrary?.blocks) ? promptLibrary.blocks : [];
  return blocks.map(buildRetrievalCandidate);
}

function searchRetrievalIndex(index, query, options = {}) {
  return rerankCandidates(index, query, options);
}

module.exports = {
  buildRetrievalCandidate,
  buildRetrievalIndex,
  searchRetrievalIndex,
};
