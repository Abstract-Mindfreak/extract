/**
 * Python Bridge Service
 * Provides browser-based rule engine and Python-like processing
 * Simulates prompt-db-local Python functionality in browser
 */

import { generateRulesStructured } from './MistralOrchestrator';

// Default rules from prompt-db-local/system/rule_engine.py
export const DEFAULT_RULES = {
  composition_rules: [
    {
      name: "layer_balance",
      logic: "must_include_layers",
      value: [1, 2, 3]
    },
    {
      name: "domain_spread",
      logic: "min_domains",
      value: 2
    },
    {
      name: "logic_anchor",
      logic: "conditional_requirement",
      if: { domain: "Logic" },
      then: { min_count: 1 }
    },
    {
      name: "negentropy_threshold",
      logic: "min_value",
      target: "negentropy",
      value: 0.5
    },
    {
      name: "phi_resonance",
      logic: "approximate_value",
      target: "divergence",
      value: 1.618,
      tolerance: 0.1
    }
  ],
  validation_rules: [
    {
      name: "recursion_limit",
      logic: "max_value",
      target: "recursion",
      value: 128
    },
    {
      name: "entropy_bounds",
      logic: "range_constraint",
      target: "entropy.p",
      min: 0,
      max: 1
    }
  ],
  optimization_rules: [
    {
      name: "spectral_flatness",
      logic: "maximize",
      target: "spectralDensity"
    },
    {
      name: "phase_coherence",
      logic: "minimize",
      target: "phaseNoise"
    }
  ]
};

/**
 * Validate selection against rules
 * Ported from rule_engine.py
 */
export function validateSelection(blocks, rules = DEFAULT_RULES) {
  const report = { valid: true, errors: [], warnings: [] };
  
  // Extract properties from blocks
  const layersPresent = new Set(blocks.map(b => b.attr?.layer).filter(Boolean));
  const domainsPresent = new Set(blocks.map(b => b.attr?.domain).filter(Boolean));
  
  // Check composition rules
  for (const rule of rules.composition_rules || []) {
    switch (rule.logic) {
      case "must_include_layers":
        const required = new Set(rule.value);
        const missing = [...required].filter(x => !layersPresent.has(x));
        if (missing.length > 0) {
          report.valid = false;
          report.errors.push(`Missing layers: ${missing.join(", ")}`);
        }
        break;
        
      case "min_domains":
        if (domainsPresent.size < rule.value) {
          report.valid = false;
          report.errors.push(`Not enough domains: ${domainsPresent.size} < ${rule.value}`);
        }
        break;
        
      case "conditional_requirement":
        if (rule.if?.domain === "Logic") {
          const logicBlocks = blocks.filter(b => b.attr?.domain === "Logic");
          if (logicBlocks.length < (rule.then?.min_count || 0)) {
            report.valid = false;
            report.errors.push("Logic anchor requirement not met");
          }
        }
        break;
        
      case "min_value":
        // Check hyperparams
        if (rule.target && blocks.length > 0) {
          const vals = blocks.map(b => getNestedValue(b, rule.target)).filter(v => v !== undefined);
          const min = Math.min(...vals);
          if (min < rule.value) {
            report.warnings.push(`${rule.target} below threshold: ${min.toFixed(3)} < ${rule.value}`);
          }
        }
        break;
        
      case "approximate_value":
        if (rule.target) {
          const vals = blocks.map(b => getNestedValue(b, rule.target)).filter(v => v !== undefined);
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          const diff = Math.abs(avg - rule.value);
          if (diff > (rule.tolerance || 0.1)) {
            report.warnings.push(`${rule.target} not at φ: ${avg.toFixed(3)} vs ${rule.value} (±${rule.tolerance})`);
          }
        }
        break;
    }
  }
  
  return report;
}

/**
 * Enforce rules by suggesting corrections
 */
export function enforceRules(blocks, rules = DEFAULT_RULES) {
  const validation = validateSelection(blocks, rules);
  
  return {
    ...validation,
    suggestions: generateSuggestions(blocks, validation.errors, rules),
    optimized: false
  };
}

/**
 * Generate suggestions based on errors
 */
function generateSuggestions(blocks, errors, rules) {
  const suggestions = [];
  
  for (const error of errors) {
    if (error.includes("Missing layers")) {
      suggestions.push("Add blocks from missing layers");
      suggestions.push("Consider layer morphing via Φ_DIV operator");
    }
    if (error.includes("domains")) {
      suggestions.push("Diversify domain selection");
      suggestions.push("Apply domain crossover mutation");
    }
    if (error.includes("Logic")) {
      suggestions.push("Include at least one Logic domain block");
    }
  }
  
  // Optimization suggestions
  for (const rule of rules.optimization_rules || []) {
    if (rule.logic === "maximize") {
      suggestions.push(`Maximize ${rule.target} for better coherence`);
    }
    if (rule.logic === "minimize") {
      suggestions.push(`Minimize ${rule.target} to reduce noise`);
    }
  }
  
  return [...new Set(suggestions)];
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

/**
 * Self-modifying rule engine
 * Ported from self_rule_engine.py concept
 */
export function selfModifyRules(currentRules, performanceMetrics) {
  const newRules = JSON.parse(JSON.stringify(currentRules));
  
  // Adapt based on performance
  if (performanceMetrics.successRate < 0.7) {
    // Relax constraints
    for (const rule of newRules.composition_rules) {
      if (rule.logic === "min_domains" && rule.value > 1) {
        rule.value -= 1;
      }
      if (rule.logic === "min_value" && rule.target === "negentropy") {
        rule.value = Math.max(0.3, rule.value - 0.1);
      }
    }
  }
  
  if (performanceMetrics.qualityScore > 0.9) {
    // Tighten constraints for high quality
    for (const rule of newRules.composition_rules) {
      if (rule.name === "phi_resonance") {
        rule.tolerance = Math.max(0.01, (rule.tolerance || 0.1) * 0.9);
      }
    }
  }
  
  return {
    rules: newRules,
    modified: JSON.stringify(newRules) !== JSON.stringify(currentRules),
    reason: performanceMetrics.successRate < 0.7 ? "performance_too_low" : 
            performanceMetrics.qualityScore > 0.9 ? "high_quality_achieved" : "no_change"
  };
}

/**
 * Mutate blocks using genetic algorithm approach
 * Ported from mutation_engine.py concept
 */
export function mutateBlocks(blocks, mutationRate = 0.1) {
  const mutated = blocks.map(block => {
    if (Math.random() > mutationRate) return block;
    
    const newBlock = { ...block, attr: { ...block.attr } };
    
    // Possible mutations
    const mutations = [
      () => { newBlock.attr.layer = Math.floor(Math.random() * 5) + 1; },
      () => { newBlock.attr.entropy = { p: Math.random(), c: Math.random() }; },
      () => { newBlock.attr.negentropy = 0.5 + Math.random() * 0.5; },
      () => { newBlock.attr.divergence = 1 + Math.random() * 3; }
    ];
    
    // Apply random mutation
    const mutation = mutations[Math.floor(Math.random() * mutations.length)];
    mutation();
    
    newBlock.mutated = true;
    return newBlock;
  });
  
  return mutated;
}

/**
 * Crossover between two block sets
 * Ported from crossover_engine.py concept
 */
export function crossoverBlocks(parentA, parentB, crossoverPoint = 0.5) {
  const splitA = Math.floor(parentA.length * crossoverPoint);
  const splitB = Math.floor(parentB.length * crossoverPoint);
  
  const child = [
    ...parentA.slice(0, splitA),
    ...parentB.slice(splitB)
  ];
  
  return child.map((b, i) => ({ ...b, id: `cross_${Date.now()}_${i}` }));
}

/**
 * Transform blocks using prompt-db-local transform logic
 */
export async function transformBlocks(blocks, transformType, options = {}) {
  switch (transformType) {
    case "mutation":
      return mutateBlocks(blocks, options.rate || 0.1);
      
    case "crossover":
      if (!options.partner) return blocks;
      return crossoverBlocks(blocks, options.partner, options.point || 0.5);
      
    case "optimize":
      // Use AI to optimize
      const { hasApiKey } = await import('./MistralOrchestrator');
      if (hasApiKey()) {
        const { generateRules } = await import('./MistralOrchestrator');
        const result = await generateRules(
          "optimize block composition",
          [...new Set(blocks.map(b => b.attr?.domain).filter(Boolean))],
          [...new Set(blocks.map(b => b.attr?.layer).filter(Boolean))]
        );
        if (result.ok) {
          return applyRulesToBlocks(blocks, result.data.rules);
        }
      }
      return blocks;
      
    case "validate":
      return enforceRules(blocks, options.rules || DEFAULT_RULES);
      
    default:
      return blocks;
  }
}

/**
 * Apply generated rules to blocks
 */
function applyRulesToBlocks(blocks, rules) {
  // Apply optimization suggestions
  return blocks.map(block => ({
    ...block,
    optimized: true,
    appliedRules: rules.composition_rules?.map(r => r.name) || []
  }));
}

/**
 * Export rules to JSON (Python-compatible format)
 */
export function exportRules(rules = DEFAULT_RULES, filename = "rules.json") {
  const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Import rules from file
 */
export async function importRules(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rules = JSON.parse(e.target.result);
        resolve({ ok: true, rules });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    };
    reader.onerror = () => resolve({ ok: false, error: "Failed to read file" });
    reader.readAsText(file);
  });
}

/**
 * Python Bridge Hook for React components
 */
export function usePythonBridge() {
  return {
    // Constants
    DEFAULT_RULES,
    
    // Validation
    validateSelection,
    enforceRules,
    
    // Transformation
    mutateBlocks,
    crossoverBlocks,
    transformBlocks,
    selfModifyRules,
    
    // Import/Export
    exportRules,
    importRules,
    
    // Utilities
    generateSuggestions: (errors) => generateSuggestions([], errors, DEFAULT_RULES)
  };
}

export default usePythonBridge;
