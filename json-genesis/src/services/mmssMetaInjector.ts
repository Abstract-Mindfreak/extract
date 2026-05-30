export type MmssMetricsContract = {
  requiredMetrics: string[];
  operatorFamilies: string[];
  principleTags: string[];
  qualityExpectations?: Record<string, unknown>;
};

export type MmssMetaInjectorOptions = {
  includeMetaRules?: boolean;
  additionalRules?: string[];
  principles?: string[];
  directives?: string[];
};

const DEFAULT_MMSS_META_RULES = [
  'Include MMSS metrics when relevant: V, N, S, D_f, G_S, R_T.',
  'Preserve MMSS meta-formulas and relation operators when they match the selected context.',
  'Respect MMSS JSON construction rules: explicit hierarchy, reusable principles, operator traceability, and measurable output fields.',
];

export function injectMetaRules(
  context: Record<string, unknown>,
  metricsContract: MmssMetricsContract,
  options: MmssMetaInjectorOptions = {},
) {
  if (options.includeMetaRules === false) {
    return {
      ...context,
      mmssMeta: null,
    };
  }

  const mergedRules = [
    ...DEFAULT_MMSS_META_RULES,
    ...(options.additionalRules || []),
    ...(options.directives || []),
  ].filter(Boolean);

  return {
    ...context,
    mmssMeta: {
      metricsContract,
      injectedRules: mergedRules,
      principles: options.principles || [],
      directives: options.directives || [],
    },
  };
}
