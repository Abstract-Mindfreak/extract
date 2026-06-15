/**
 * Python Generation Layer
 * Browser-based port of prompt-db-local Python generation system
 * Includes: builder, builder_v3, mutation_engine, crossover_engine, memory_v3, self_rule_engine
 */

import { callMistral } from './MistralOrchestrator';
import appPersistenceService from './AppPersistenceService';

// =========================
// MEMORY SYSTEM (memory_v3.py)
// =========================
const MEMORY_KEY = 'mmss.generation.memory_v3';
let memoryCache = null;
let memoryHydrationStarted = false;
const DEFAULT_MEMORY = {
  block_stats: {},
  intent_stats: {},
  generation_stats: {}
};

async function hydrateMemoryFromDatabase() {
  if (memoryHydrationStarted) return;
  memoryHydrationStarted = true;
  try {
    const stored = await appPersistenceService.getSetting('generation', MEMORY_KEY, null);
    if (stored && typeof stored === 'object') {
      memoryCache = stored;
    }
  } catch (e) {
    console.warn('Failed to hydrate generation memory from database:', e);
  }
}

export function loadMemory() {
  if (!memoryHydrationStarted) {
    void hydrateMemoryFromDatabase();
  }
  if (memoryCache) {
    return memoryCache;
  }
  memoryCache = { ...DEFAULT_MEMORY };
  return memoryCache;
}

export function saveMemory(memory) {
  memoryCache = memory;
  void appPersistenceService.setSetting('generation', MEMORY_KEY, memory);
}

export function updateMemory(blocks, intent) {
  const memory = loadMemory();
  
  // Update block usage
  for (const b of blocks) {
    const bid = b.id;
    const stats = memory.block_stats[bid] || {
      usage_count: 0,
      success_score: 0.5,
      penalty_score: 0.0,
      novelty_score: 0.5,
      lineage_score: 0.5
    };
    stats.usage_count += 1;
    memory.block_stats[bid] = stats;
    
    // Lineage update
    if (b.origin) {
      const genId = b.id;
      memory.generation_stats[genId] = {
        parent_ids: b.origin.parents || [],
        stability_score: 0.7
      };
    }
  }
  
  // Intent signature
  const sig = intent.toLowerCase().slice(0, 50);
  if (!memory.intent_stats[sig]) {
    memory.intent_stats[sig] = {};
  }
  
  for (const b of blocks) {
    const bid = b.id;
    memory.intent_stats[sig][bid] = (memory.intent_stats[sig][bid] || 0) + 0.1;
  }
  
  saveMemory(memory);
  return memory;
}

export function normalizePromptLibraryBlock(block, index = 0) {
  const payload = block?.payload?.data || {};
  const tags = Array.isArray(block?.tags) ? block.tags.filter(Boolean) : [];
  const keyPaths = Object.keys(payload || {});
  const serialized = JSON.stringify(payload).toLowerCase();
  const lowerCategory = String(block?.category || '').toLowerCase();
  const lowerTags = tags.map((tag) => String(tag).toLowerCase());
  const lowerName = String(block?.name || '').toLowerCase();
  const domain = inferDomainFromPromptBlock({ lowerCategory, lowerTags, lowerName, serialized });
  const layer = inferLayerFromPromptBlock(payload, lowerTags, index);
  const priority = clampNumber(
    payload?.priority ??
      payload?.metrics?.V ??
      payload?.V ??
      payload?.weight ??
      0.55,
    0.1,
    1,
  );
  const confidence = clampNumber(
    payload?.confidence ??
      payload?.metrics?.N ??
      payload?.N ??
      0.68,
    0.1,
    1,
  );
  const phase =
    payload?.phase ||
    lowerTags.find((tag) => ["emergence", "stabilization", "shift", "collapse"].includes(tag)) ||
    "stabilization";

  return {
    id: block?.id || `prompt_block_${index}`,
    domain,
    layer,
    priority,
    confidence,
    phase,
    tags: Array.from(new Set([...tags, block?.category, ...keyPaths].filter(Boolean))),
    mutation_ready: true,
    crossover_ready: true,
    params: payload?.params || payload?.metrics || {},
    intent: block?.description || block?.name || `Prompt Library ${domain} block`,
    payload,
    sourcePromptBlock: block,
  };
}

export function buildGenerationRuntimeFromPromptLibrary(promptBlocks = []) {
  const normalizedBlocks = promptBlocks.map((block, index) => normalizePromptLibraryBlock(block, index));
  const blocks = {};
  const embeddings = { blocks: {} };
  const edges = {};

  for (const block of normalizedBlocks) {
    blocks[block.id] = block;
    embeddings.blocks[block.id] = {
      vector: buildQueryVector(
        [
          block.intent,
          block.domain,
          block.phase,
          ...(block.tags || []),
          JSON.stringify(block.payload || {}),
        ].join(" "),
      ),
    };
  }

  for (const block of normalizedBlocks) {
    const neighbors = normalizedBlocks
      .filter((candidate) => candidate.id !== block.id)
      .map((candidate) => ({
        target: candidate.id,
        weight: scorePromptLibraryNeighbor(block, candidate),
      }))
      .filter((candidate) => candidate.weight > 0.18)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 4);
    edges[block.id] = neighbors;
  }

  return {
    blockIndex: { blocks },
    graph: { edges },
    embeddings,
    stats: {
      blockCount: normalizedBlocks.length,
      domains: Array.from(new Set(normalizedBlocks.map((block) => block.domain))),
      layers: Array.from(new Set(normalizedBlocks.map((block) => block.layer))).sort((a, b) => a - b),
    },
  };
}

function inferDomainFromPromptBlock({ lowerCategory, lowerTags, lowerName, serialized }) {
  if (hasAnyToken([lowerCategory, lowerName, serialized, ...lowerTags], ["rhythm", "tempo", "beat", "groove"])) {
    return "Rhythm";
  }
  if (hasAnyToken([lowerCategory, lowerName, serialized, ...lowerTags], ["timbre", "texture", "tone", "harmonic"])) {
    return "Timbre";
  }
  if (hasAnyToken([lowerCategory, lowerName, serialized, ...lowerTags], ["space", "stereo", "field", "ambient"])) {
    return "Space";
  }
  if (hasAnyToken([lowerCategory, lowerName, serialized, ...lowerTags], ["logic", "rule", "operator", "schema"])) {
    return "Logic";
  }
  return "Math";
}

function inferLayerFromPromptBlock(payload, lowerTags, index) {
  const directLayer = Number(payload?.layer ?? payload?.meta?.layer);
  if (Number.isFinite(directLayer) && directLayer >= 1 && directLayer <= 5) {
    return directLayer;
  }
  const taggedLayer = lowerTags.find((tag) => /^layer[1-5]$/.test(tag));
  if (taggedLayer) {
    return Number(taggedLayer.replace("layer", ""));
  }
  return (index % 5) + 1;
}

function scorePromptLibraryNeighbor(source, target) {
  let score = 0;
  if (source.domain === target.domain) score += 0.4;
  if (Math.abs(source.layer - target.layer) <= 1) score += 0.25;
  const sourceTags = new Set((source.tags || []).map((tag) => String(tag).toLowerCase()));
  const targetTags = new Set((target.tags || []).map((tag) => String(tag).toLowerCase()));
  const overlap = [...sourceTags].filter((tag) => targetTags.has(tag)).length;
  score += Math.min(overlap / 6, 0.35);
  return Number(score.toFixed(3));
}

function hasAnyToken(haystack, needles) {
  return haystack.some((item) => needles.some((needle) => String(item).includes(needle)));
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.min(max, Math.max(min, numeric));
}

// =========================
// TEXT UTILS (builder.py)
// =========================
export function normalizeText(text) {
  return new Set(text.toLowerCase().match(/\w+/g) || []);
}

export function tokenize(text) {
  return text.toLowerCase().match(/\w+/g) || [];
}

export function cosineSimilarity(v1, v2) {
  const commonTerms = new Set([...Object.keys(v1)].filter(x => x in v2));
  let dotProduct = 0;
  for (const t of commonTerms) {
    dotProduct += (v1[t] || 0) * (v2[t] || 0);
  }
  return dotProduct;
}

export function buildQueryVector(text, idf = {}) {
  const tokens = tokenize(text);
  const tf = {};
  for (const t of tokens) {
    tf[t] = (tf[t] || 0) + 1;
  }
  const vector = {};
  for (const [t, count] of Object.entries(tf)) {
    vector[t] = count * (idf[t] || 1.0);
  }
  return vector;
}

// =========================
// SCORING (builder.py)
// =========================
export function calculateScore(blockMeta, intentKeywords, memoryScore, queryVector = null, blockVector = null) {
  const priority = blockMeta.priority || 0.5;
  const confidence = blockMeta.confidence || 0.7;
  
  let intentMatch = 0;
  if (intentKeywords && intentKeywords.size > 0) {
    const blockTags = new Set(blockMeta.tags || []);
    const overlap = new Set([...intentKeywords].filter(x => blockTags.has(x)));
    intentMatch = overlap.size / intentKeywords.size;
  }
  
  let semanticScore = 0;
  if (queryVector && blockVector) {
    semanticScore = cosineSimilarity(queryVector, blockVector);
  }
  
  // V1 scoring (simple)
  if (!queryVector) {
    return (
      priority * 0.25 +
      confidence * 0.2 +
      intentMatch * 0.3 +
      memoryScore * 0.25
    );
  }
  
  // V3 scoring (with semantic)
  return (
    priority * 0.3 +
    confidence * 0.2 +
    semanticScore * 0.4 +
    memoryScore * 0.1
  );
}

// =========================
// BASIC BUILDER (builder.py)
// =========================
export async function build(config) {
  const {
    intent = "",
    domains = ["Rhythm", "Timbre", "Space", "Logic"],
    layers = [1, 2, 3],
    max_blocks = 12,
    temperature = 0.7,
    blockIndex = null,
    graph = null,
    rules = null
  } = config;
  
  const targetDomains = new Set(domains);
  const targetLayers = new Set(layers);
  const memory = loadMemory();
  const intentKeywords = normalizeText(intent);
  
  // Step 1: Filter + Score
  const candidates = [];
  
  if (!blockIndex || !blockIndex.blocks) {
    return { error: "No block index provided" };
  }
  
  for (const [bid, meta] of Object.entries(blockIndex.blocks)) {
    if (targetDomains.has(meta.domain) && targetLayers.has(meta.layer)) {
      if (meta.confidence > 0.3) {
        const memStats = memory.block_stats[bid] || { usage_count: 1, success_score: 0.5 };
        const usageFactor = Math.min(1.0, memStats.usage_count / 10);
        const memoryScore = (memStats.success_score * 0.7) + (usageFactor * 0.3);
        
        const score = calculateScore(meta, intentKeywords, memoryScore);
        candidates.push([bid, score, meta]);
      }
    }
  }
  
  if (candidates.length === 0) {
    return { error: "No blocks found matching criteria" };
  }
  
  candidates.sort((a, b) => b[1] - a[1]);
  
  // Step 2: Selection
  const topK = candidates.slice(0, max_blocks * 2);
  const selectedIds = new Set();
  
  while (selectedIds.size < Math.min(max_blocks, topK.length)) {
    if (Math.random() > temperature) {
      for (const [bid] of topK) {
        if (!selectedIds.has(bid)) {
          selectedIds.add(bid);
          break;
        }
      }
    } else {
      const pick = topK[Math.floor(Math.random() * topK.length)];
      selectedIds.add(pick[0]);
    }
  }
  
  // Step 3: Graph Expansion
  const expandedIds = new Set(selectedIds);
  if (graph && graph.edges) {
    for (const bid of selectedIds) {
      const links = graph.edges[bid] || [];
      for (const link of links) {
        if (expandedIds.size >= max_blocks + 4) break;
        expandedIds.add(typeof link === 'object' ? link.target : link);
      }
    }
  }
  
  // Step 4: Load blocks
  const finalBlocks = [];
  for (const bid of Array.from(expandedIds).slice(0, max_blocks)) {
    const blockMeta = blockIndex.blocks[bid];
    if (blockMeta) {
      finalBlocks.push({
        id: bid,
        ...blockMeta,
        loaded: true
      });
    }
  }
  
  // Validation
  const validation = validateSelection(finalBlocks, rules);
  
  const result = {
    meta: {
      intent,
      block_count: finalBlocks.length,
      validation
    },
    blocks: finalBlocks
  };
  
  // Step 5: Memory Update
  updateMemory(finalBlocks, intent);
  
  return result;
}

// =========================
// V3 BUILDER (builder_v3.py)
// =========================
export async function buildV3(config) {
  const {
    intent = "",
    domains = ["Rhythm", "Timbre", "Space", "Logic"],
    layers = [1, 2, 3],
    max_blocks = 10,
    temperature = 0.55,
    runs = 8,
    blockIndex = null,
    embeddings = null,
    graph = null
  } = config;
  
  const targetDomains = new Set(domains);
  const targetLayers = new Set(layers);
  const memory = loadMemory();
  
  // Build query vector
  const queryTokens = tokenize(intent);
  const queryVector = {};
  for (const t of queryTokens) {
    queryVector[t] = 1.0;
  }
  
  // Get all block IDs
  const allBids = blockIndex ? Object.keys(blockIndex.blocks) : [];
  
  let bestResult = null;
  let bestTotalScore = -1.0;
  
  for (let runIdx = 0; runIdx < runs; runIdx++) {
    const currentSelection = [];
    
    // Score candidates
    const scoredCandidates = [];
    for (const bid of allBids) {
      const meta = blockIndex.blocks[bid];
      if (!meta) continue;
      
      if (targetDomains.has(meta.domain) && targetLayers.has(meta.layer)) {
        const blockVector = embeddings?.blocks?.[bid]?.vector || {};
        const memStats = memory.block_stats[bid] || { usage_count: 0, success_score: 0.5 };
        const memScore = memStats.success_score * 0.2;
        
        const score = calculateScore(meta, null, memScore, queryVector, blockVector);
        scoredCandidates.push([bid, score]);
      }
    }
    
    scoredCandidates.sort((a, b) => b[1] - a[1]);
    
    // Selection with temperature
    const pool = scoredCandidates.slice(0, max_blocks * 3);
    if (pool.length === 0) continue;
    
    while (currentSelection.length < max_blocks && pool.length > 0) {
      if (Math.random() > temperature) {
        currentSelection.push(pool.shift());
      } else {
        const idx = Math.floor(Math.random() * pool.length);
        currentSelection.push(pool.splice(idx, 1)[0]);
      }
    }
    
    // Expand via graph
    const expanded = new Set(currentSelection.map(([bid]) => bid));
    for (const [bid] of currentSelection) {
      const edges = graph?.edges?.[bid] || [];
      for (const edge of edges) {
        if (expanded.size >= max_blocks + 2) break;
        expanded.add(typeof edge === 'object' ? edge.target : edge);
      }
    }
    
    // Load blocks
    const finalBlocks = [];
    for (const bid of Array.from(expanded).slice(0, max_blocks)) {
      const meta = blockIndex.blocks[bid];
      if (meta) {
        finalBlocks.push({
          id: bid,
          ...meta,
          loaded: true
        });
      }
    }
    
    // Score this run
    const runScore = currentSelection.length > 0
      ? currentSelection.reduce((sum, [, s]) => sum + s, 0) / currentSelection.length
      : 0;
    
    if (runScore > bestTotalScore) {
      bestTotalScore = runScore;
      bestResult = finalBlocks;
    }
  }
  
  if (bestResult) {
    updateMemory(bestResult, intent);
    
    return {
      meta: {
        intent,
        block_count: bestResult.length,
        run_score: Math.round(bestTotalScore * 1000) / 1000,
        validation: { valid: true }
      },
      blocks: bestResult
    };
  }
  
  return { error: "No blocks could be assembled" };
}

// =========================
// MUTATION ENGINE (mutation_engine.py)
// =========================
export function mutateParams(params) {
  const newParams = JSON.parse(JSON.stringify(params));
  for (const [k, v] of Object.entries(newParams)) {
    if (typeof v === 'number') {
      const shift = 1.0 + (Math.random() * 0.2 - 0.1); // +/- 10%
      newParams[k] = Math.round(v * shift * 100) / 100;
    }
  }
  return newParams;
}

export function runMutationEngine(blockIndex, count = 20) {
  const mutations = [];
  const report = {
    generated_count: 0,
    mutations: []
  };
  
  if (!blockIndex || !blockIndex.blocks) return report;
  
  // Find mutation-ready blocks
  const candidates = Object.entries(blockIndex.blocks)
    .filter(([_, meta]) => meta.mutation_ready)
    .map(([bid]) => bid);
  
  const mutationTypes = ["param_shift", "phase_shift", "detail_amplification"];
  const phases = ["emergence", "stabilization", "shift", "collapse"];
  
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    const parentId = candidates[Math.floor(Math.random() * candidates.length)];
    const parentMeta = blockIndex.blocks[parentId];
    
    const mutationType = mutationTypes[Math.floor(Math.random() * mutationTypes.length)];
    const childId = `mut_${parentId}_${Math.floor(Math.random() * 65535).toString(16)}`;
    
    const childBlock = {
      id: childId,
      origin: {
        mode: "mutation",
        parents: [parentId],
        mutation_type: mutationType
      },
      // Inherit from parent
      domain: parentMeta.domain,
      layer: parentMeta.layer,
      confidence: parentMeta.confidence,
      priority: parentMeta.priority,
      tags: [...(parentMeta.tags || [])],
      mutation: true
    };
    
    // Apply mutation
    if (mutationType === "param_shift") {
      childBlock.params = mutateParams(parentMeta.params || {});
    } else if (mutationType === "phase_shift") {
      childBlock.phase = phases[Math.floor(Math.random() * phases.length)];
    } else if (mutationType === "detail_amplification") {
      childBlock.priority = Math.min((parentMeta.priority || 0.5) + 0.1, 1.0);
      childBlock.confidence = Math.max((parentMeta.confidence || 0.7) - 0.1, 0.1);
    }
    
    mutations.push(childBlock);
    
    report.generated_count += 1;
    report.mutations.push({
      id: childId,
      parent: parentId,
      type: mutationType
    });
  }
  
  return { report, mutations };
}

// =========================
// CROSSOVER ENGINE (crossover_engine.py)
// =========================
export function mergeParams(p1, p2) {
  const res = JSON.parse(JSON.stringify(p1));
  for (const [k, v] of Object.entries(p2)) {
    if (k in res) {
      res[k] = Math.round(((res[k] + v) / 2) * 100) / 100;
    } else {
      res[k] = v;
    }
  }
  return res;
}

export function runCrossoverEngine(blockIndex, count = 10) {
  const crossovers = [];
  const report = {
    generated_count: 0,
    crossovers: []
  };
  
  if (!blockIndex || !blockIndex.blocks) return report;
  
  // Find crossover-ready blocks
  const candidates = Object.entries(blockIndex.blocks)
    .filter(([_, meta]) => meta.crossover_ready)
    .map(([bid, meta]) => ({ bid, meta }));
  
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    const p1 = candidates[Math.floor(Math.random() * candidates.length)];
    const p2 = candidates[Math.floor(Math.random() * candidates.length)];
    
    if (p1.bid === p2.bid) continue;
    
    // Compatibility check
    const sameDomain = p1.meta.domain === p2.meta.domain;
    const layerDiff = Math.abs(p1.meta.layer - p2.meta.layer);
    
    if (!sameDomain && layerDiff > 1) continue;
    
    const strategy = sameDomain ? "params_union" : "shared_domain_merge";
    const childId = `cross_${Math.floor(Math.random() * 65535).toString(16)}`;
    
    const childBlock = {
      id: childId,
      domain: p1.meta.domain,
      phase: p1.meta.phase || "emergence",
      layer: p1.meta.layer,
      priority: Math.round(((p1.meta.priority + p2.meta.priority) / 2) * 100) / 100,
      params: mergeParams(p1.meta.params || {}, p2.meta.params || {}),
      intent: `Hybrid: ${p1.meta.intent || ""} x ${p2.meta.intent || ""}`.slice(0, 100),
      confidence: Math.round(Math.min(p1.meta.confidence, p2.meta.confidence) * 0.9 * 100) / 100,
      origin: {
        mode: "crossover",
        parents: [p1.bid, p2.bid],
        strategy
      },
      crossover: true
    };
    
    crossovers.push(childBlock);
    
    report.generated_count += 1;
    report.crossovers.push({
      id: childId,
      parents: [p1.bid, p2.bid],
      strategy
    });
  }
  
  return { report, crossovers };
}

// =========================
// SELF RULE ENGINE (self_rule_engine.py)
// =========================
export function runSelfRuleEngine(blockIndex, graph) {
  if (!blockIndex || !blockIndex.blocks || !graph || !graph.edges) {
    return { version: "3.0", generated_rules: [] };
  }
  
  const rules = {
    version: "3.0",
    generated_rules: []
  };
  
  // Pattern 1: Domain Affinity
  const domainConnections = {};
  for (const [bid, edges] of Object.entries(graph.edges)) {
    const myDomain = blockIndex.blocks[bid]?.domain;
    if (!myDomain) continue;
    
    for (const edge of edges) {
      const targetId = typeof edge === 'object' ? edge.target : edge;
      const targetDomain = blockIndex.blocks[targetId]?.domain;
      if (targetDomain) {
        const pair = [myDomain, targetDomain].sort().join('_');
        domainConnections[pair] = (domainConnections[pair] || 0) + 1;
      }
    }
  }
  
  for (const [pair, count] of Object.entries(domainConnections)) {
    if (count > 20) {
      const domains = pair.split('_');
      rules.generated_rules.push({
        name: `affinity_${pair}`,
        type: "domain_affinity",
        weight: Math.round(Math.min(count / 100, 1.0) * 100) / 100,
        rule: { domains },
        evidence: { connection_count: count }
      });
    }
  }
  
  // Pattern 2: Layer Correlation
  const layerPairs = {};
  for (const [bid, edges] of Object.entries(graph.edges)) {
    const myLayer = blockIndex.blocks[bid]?.layer;
    if (myLayer === undefined) continue;
    
    for (const edge of edges) {
      const targetId = typeof edge === 'object' ? edge.target : edge;
      const targetLayer = blockIndex.blocks[targetId]?.layer;
      if (targetLayer !== undefined) {
        const pair = [myLayer, targetLayer].sort().join('_');
        layerPairs[pair] = (layerPairs[pair] || 0) + 1;
      }
    }
  }
  
  for (const [pair, count] of Object.entries(layerPairs)) {
    if (count > 15) {
      const layers = pair.split('_').map(Number);
      rules.generated_rules.push({
        name: `layer_correl_${pair}`,
        type: "layer_correlation",
        weight: Math.round(Math.min(count / 80, 1.0) * 100) / 100,
        rule: { layers },
        evidence: { connection_count: count }
      });
    }
  }
  
  return rules;
}

// =========================
// VALIDATION (rule_engine.py)
// =========================
export function validateSelection(blocks, rules) {
  const report = { valid: true, errors: [], warnings: [] };
  
  if (!rules || !rules.composition_rules) return report;
  
  const layersPresent = new Set(blocks.map(b => b.layer).filter(Boolean));
  const domainsPresent = new Set(blocks.map(b => b.domain).filter(Boolean));
  
  for (const rule of rules.composition_rules) {
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
          const logicBlocks = blocks.filter(b => b.domain === "Logic");
          if (logicBlocks.length < (rule.then?.min_count || 0)) {
            report.valid = false;
            report.errors.push("Logic anchor requirement not met");
          }
        }
        break;

      default:
        break;
    }
  }
  
  return report;
}

// =========================
// AI-POWERED GENERATION
// =========================
export async function generateBlocksWithAI(intent, domains, layers, options = {}) {
  const { count = 5, useMistral = true } = options;
  
  if (!useMistral) {
    // Fallback to random generation
    return generateBlocksRandom(intent, domains, layers, count);
  }
  
  // Use Mistral to generate block specifications
  const prompt = `Generate ${count} audio composition blocks for intent: "${intent}"
Domains: ${domains.join(", ")}
Layers: ${layers.join(", ")}

For each block, provide:
- domain (one of: ${domains.join(", ")})
- layer (one of: ${layers.join(", ")})
- priority (0.0-1.0)
- confidence (0.0-1.0)
- phase (emergence|stabilization|shift|collapse)
- brief description of function

Format as JSON array.`;

  try {
    const result = await callMistral([
      { role: "system", content: "You are a generative audio system. Output only valid JSON." },
      { role: "user", content: prompt }
    ], "mistral-large-latest", 0.8);
    
    if (!result.ok) {
      return generateBlocksRandom(intent, domains, layers, count);
    }
    
    const content = result.data?.choices?.[0]?.message?.content || "";
    // Try to extract JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const blocks = JSON.parse(jsonMatch[0]);
      return {
        meta: { intent, block_count: blocks.length, source: "mistral" },
        blocks: blocks.map((b, i) => ({
          id: `ai_gen_${Date.now()}_${i}`,
          ...b,
          origin: { mode: "ai_generation", parents: [] }
        }))
      };
    }
  } catch (e) {
    console.warn("AI generation failed, falling back to random:", e);
  }
  
  return generateBlocksRandom(intent, domains, layers, count);
}

function generateBlocksRandom(intent, domains, layers, count) {
  const phases = ["emergence", "stabilization", "shift", "collapse"];
  const blocks = [];
  
  for (let i = 0; i < count; i++) {
    blocks.push({
      id: `rand_${Date.now()}_${i}`,
      domain: domains[Math.floor(Math.random() * domains.length)],
      layer: layers[Math.floor(Math.random() * layers.length)],
      priority: Math.round(Math.random() * 100) / 100,
      confidence: 0.5 + Math.round(Math.random() * 50) / 100,
      phase: phases[Math.floor(Math.random() * phases.length)],
      params: { frequency: 440 + Math.random() * 880 },
      origin: { mode: "random", parents: [] }
    });
  }
  
  return {
    meta: { intent, block_count: count, source: "random" },
    blocks
  };
}

// =========================
// REACT HOOK
// =========================
export function usePythonGenerationLayer() {
  return {
    // Memory
    loadMemory,
    saveMemory,
    updateMemory,
    
    // Builders
    build,
    buildV3,
    
    // Engines
    runMutationEngine,
    runCrossoverEngine,
    runSelfRuleEngine,
    
    // Validation
    validateSelection,
    
    // AI Generation
    generateBlocksWithAI,

    // Prompt Library bridge
    buildGenerationRuntimeFromPromptLibrary,
    normalizePromptLibraryBlock,
    
    // Utils
    normalizeText,
    tokenize,
    cosineSimilarity,
    buildQueryVector,
    calculateScore,
    mutateParams,
    mergeParams
  };
}

export default usePythonGenerationLayer;
