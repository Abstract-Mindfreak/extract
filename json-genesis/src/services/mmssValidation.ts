import type { MmssMetricsContract } from './mmssMetaInjector';

export type MmssQualityReport = {
  valid: boolean;
  score: number;
  summary: string;
  issues: string[];
  detectedMetrics: string[];
  missingMetrics: string[];
  detectedOperatorFamilies: string[];
  structural: {
    depth: number;
    nodeCount: number;
    explicitHierarchy: boolean;
    measurableOutputFields: boolean;
    operatorTraceability: boolean;
  };
};

export function buildMmssQualityReport(
  payload: unknown,
  contract: MmssMetricsContract,
): MmssQualityReport {
  const detectedMetrics = detectMetrics(payload, contract.requiredMetrics);
  const detectedOperatorFamilies = detectOperatorFamilies(payload, contract.operatorFamilies);
  const depth = getDepth(payload);
  const nodeCount = countNodes(payload);
  const explicitHierarchy = depth >= 3;
  const measurableOutputFields = detectedMetrics.length > 0;
  const operatorTraceability = detectedOperatorFamilies.length > 0;
  const missingMetrics = contract.requiredMetrics.filter((metric) => !detectedMetrics.includes(metric));
  const issues: string[] = [];

  if (!explicitHierarchy) {
    issues.push('Hierarchy is too shallow for a strong MMSS composition.');
  }
  if (!measurableOutputFields) {
    issues.push('No MMSS metrics were detected in the generated JSON.');
  }
  if (!operatorTraceability) {
    issues.push('No MMSS operator families were detected in the generated JSON.');
  }
  if (missingMetrics.length === contract.requiredMetrics.length) {
    issues.push('Required MMSS metric contract is completely missing.');
  } else if (missingMetrics.length > 0) {
    issues.push(`Missing MMSS metrics: ${missingMetrics.join(', ')}.`);
  }

  let score = 40;
  score += Math.min(25, detectedMetrics.length * 4);
  score += Math.min(20, detectedOperatorFamilies.length * 6);
  score += explicitHierarchy ? 15 : 0;
  score = Math.max(0, Math.min(100, score));

  const valid = issues.length <= 1 && measurableOutputFields;
  const summary = valid
    ? `MMSS quality looks usable: score ${score}, metrics ${detectedMetrics.length}, operator families ${detectedOperatorFamilies.length}.`
    : `MMSS quality needs review: score ${score}, ${issues.length} issue(s) detected.`;

  return {
    valid,
    score,
    summary,
    issues,
    detectedMetrics,
    missingMetrics,
    detectedOperatorFamilies,
    structural: {
      depth,
      nodeCount,
      explicitHierarchy,
      measurableOutputFields,
      operatorTraceability,
    },
  };
}

function detectMetrics(payload: unknown, requiredMetrics: string[]) {
  const found = new Set<string>();
  walkPayload(payload, (key) => {
    if (requiredMetrics.includes(key)) {
      found.add(key);
    }
  });
  return Array.from(found);
}

function detectOperatorFamilies(payload: unknown, operatorFamilies: string[]) {
  const found = new Set<string>();
  walkPayload(payload, (key, value) => {
    const keyText = String(key || '').toLowerCase();
    const valueText = typeof value === 'string' ? value.toLowerCase() : '';
    for (const family of operatorFamilies) {
      const needle = family.toLowerCase();
      if (keyText.includes(needle) || valueText.includes(needle)) {
        found.add(family);
      }
    }
  });
  return Array.from(found);
}

function walkPayload(
  value: unknown,
  visitor: (key: string, node: unknown) => void,
  currentKey = 'root',
) {
  visitor(currentKey, value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkPayload(item, visitor, `${currentKey}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') {
    return;
  }
  Object.entries(value).forEach(([key, nested]) => {
    visitor(key, nested);
    walkPayload(nested, visitor, key);
  });
}

function getDepth(value: unknown): number {
  if (Array.isArray(value)) {
    return 1 + Math.max(0, ...value.map(getDepth));
  }
  if (value && typeof value === 'object') {
    return 1 + Math.max(0, ...Object.values(value).map(getDepth));
  }
  return 1;
}

function countNodes(value: unknown): number {
  if (Array.isArray(value)) {
    return 1 + value.reduce((sum, item) => sum + countNodes(item), 0);
  }
  if (value && typeof value === 'object') {
    return 1 + Object.values(value).reduce((sum, item) => sum + countNodes(item), 0);
  }
  return 1;
}
