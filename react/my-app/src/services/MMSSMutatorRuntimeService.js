const API_BASE = "http://localhost:3456/api";
const ONTOLOGY_ENDPOINT = `${API_BASE}/mmss/ontology`;

async function queryDatabase(sql, database = "default") {
  const response = await fetch(`${API_BASE}/db/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ sql, database }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  return Array.isArray(payload.data) ? payload.data : [];
}

let ontologyCache = null;

async function loadOntologySeed() {
  if (ontologyCache) return ontologyCache;

  const response = await fetch(ONTOLOGY_ENDPOINT, {
    headers: {
      Accept: "application/json",
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success || !payload?.data) {
    throw new Error(payload?.error || `HTTP ${response.status}`);
  }

  ontologyCache = payload.data;
  return ontologyCache;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .match(/[a-zа-я0-9_+-]+/gi) || [];
}

function buildSearchText(...parts) {
  return parts
    .flat()
    .filter(Boolean)
    .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
    .join(" ");
}

function countPatternHits(text, patterns = []) {
  const normalized = String(text || "").toLowerCase();
  if (!normalized) return 0;
  return patterns.reduce((score, pattern) => score + normalized.split(String(pattern).toLowerCase()).length - 1, 0);
}

function rankOntology(text, entries = []) {
  return entries
    .map((entry) => {
      const keywords = Array.isArray(entry.keywords) ? entry.keywords : [];
      const markers = Array.isArray(entry.markers) ? entry.markers : [];
      const aliases = Array.isArray(entry.aliases) ? entry.aliases : [];
      const score = countPatternHits(text, [...keywords, ...markers, ...aliases]);
      return {
        operatorId: entry.operator_id,
        displayName: entry.display_name || entry.operator_id,
        score,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);
}

function inferDomainFromText(text, ontology) {
  const matches = rankOntology(text, ontology.domain_patterns);
  const dominant = matches[0]?.operatorId || "logic";
  return {
    dominant: dominant.charAt(0).toUpperCase() + dominant.slice(1),
    hits: matches,
  };
}

function inferPhaseFromText(text, ontology) {
  const matches = rankOntology(text, ontology.phase_patterns);
  return {
    dominant: matches[0]?.operatorId || "init",
    hits: matches,
  };
}

function inferLayerFromSignals(index, text, sourceType) {
  const normalized = String(text || "").toLowerCase();
  if (sourceType === "music_block") {
    return (index % 5) + 1;
  }
  if (normalized.includes("final") || normalized.includes("focus") || normalized.includes("итог")) return 5;
  if (normalized.includes("merge") || normalized.includes("combine") || normalized.includes("layer")) return 4;
  if (normalized.includes("shift") || normalized.includes("vector") || normalized.includes("рост")) return 3;
  if (normalized.includes("stable") || normalized.includes("hold") || normalized.includes("стабил")) return 2;
  return 1;
}

function createPseudoBlock({
  id,
  sourceType,
  title,
  text,
  params,
  tags,
  ontology,
  index,
  priority = 0.55,
  confidence = 0.62,
  layer,
  extraMeta = {},
}) {
  const phase = inferPhaseFromText(text, ontology);
  const domain = inferDomainFromText(text, ontology);
  const resolvedLayer = layer || inferLayerFromSignals(index, text, sourceType);

  return {
    id,
    domain: domain.dominant,
    layer: resolvedLayer,
    priority,
    confidence,
    phase: phase.dominant,
    tags: Array.from(new Set([sourceType, domain.dominant, phase.dominant, ...(tags || [])].filter(Boolean))),
    mutation_ready: true,
    crossover_ready: true,
    params: params || {},
    intent: title || text.slice(0, 120) || id,
    payload: params || {},
    mmss_meta: {
      source_type: sourceType,
      phase_operator_id: phase.dominant,
      phase_hits: phase.hits,
      domain_operator_id: domain.dominant,
      domain_hits: domain.hits,
      ontology_source: "seed+runtime",
      ...extraMeta,
    },
  };
}

function buildGraphEdges(blocks) {
  const entries = Object.values(blocks);
  const edges = {};

  for (const source of entries) {
    const neighbors = entries
      .filter((candidate) => candidate.id !== source.id)
      .map((candidate) => {
        let score = 0;
        if (candidate.domain === source.domain) score += 0.35;
        if (candidate.phase === source.phase) score += 0.25;
        if (Math.abs((candidate.layer || 0) - (source.layer || 0)) <= 1) score += 0.2;
        const overlap = (source.tags || []).filter((tag) => (candidate.tags || []).includes(tag)).length;
        score += Math.min(overlap * 0.05, 0.2);
        return { target: candidate.id, weight: Number(score.toFixed(3)) };
      })
      .filter((candidate) => candidate.weight >= 0.25)
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 6);

    edges[source.id] = neighbors;
  }

  return edges;
}

class MMSSMutatorRuntimeService {
  constructor() {
    this.ontology = null;
  }

  async safeQuery(sql, database) {
    try {
      return await queryDatabase(sql, database);
    } catch {
      return [];
    }
  }

  async ensureOntology() {
    if (!this.ontology) {
      this.ontology = await loadOntologySeed();
    }
    return this.ontology;
  }

  async loadSourceRows(database) {
    const [musicBlocks, tracks, sessions] = await Promise.all([
      this.safeQuery(
        `
          select id::text as id, block_type, layer, slug, name, content
          from music_blocks
          order by layer asc nulls last, slug asc
          limit 2000
        `,
        database,
      ),
      this.safeQuery(
        `
          select
            id::text as id,
            title,
            prompt,
            model_name,
            generation_mode,
            transform_type,
            duration_s,
            play_count,
            favorite_count,
            raw_data
          from tracks
          order by created_at desc nulls last
          limit 1200
        `,
        database,
      ),
      this.safeQuery(
        `
          select
            id::text as id,
            title,
            ai_snapshot,
            config,
            created_at,
            updated_at
          from sessions
          order by updated_at desc nulls last
          limit 600
        `,
        database,
      ),
    ]);

    return { musicBlocks, tracks, sessions };
  }

  mapMusicBlocks(rows, database) {
    return rows.map((row, index) => {
      const content = row.content || {};
      const text = buildSearchText(row.name, row.slug, row.block_type, content);
      const domain = inferDomainFromText(text, this.ontology);
      const phase = inferPhaseFromText(text, this.ontology);

      return {
        id: row.id || row.slug || `music_block_${index}`,
        domain: domain.dominant,
        layer: Number(row.layer || inferLayerFromSignals(index, text, "music_block")),
        priority: Math.min(1, 0.55 + Number(content?.weight || 0) * 0.15),
        confidence: 0.82,
        phase: phase.dominant,
        tags: Array.from(new Set([row.block_type, row.slug, domain.dominant, phase.dominant].filter(Boolean))),
        mutation_ready: true,
        crossover_ready: true,
        params: content,
        intent: row.name || row.slug || row.id,
        payload: content,
        mmss_meta: {
          source_type: "music_block",
          source_db: database,
          block_type: row.block_type,
          phase_operator_id: phase.dominant,
          phase_hits: phase.hits,
          domain_operator_id: domain.dominant,
          domain_hits: domain.hits,
          ontology_source: "seed+runtime",
        },
      };
    });
  }

  mapTracks(rows, database) {
    return rows.map((row, index) => {
      const rawTrack = row.raw_data?.raw_track || row.raw_data || {};
      const text = buildSearchText(
        row.title,
        row.prompt,
        row.generation_mode,
        row.transform_type,
        row.model_name,
        rawTrack?.operation?.sound_prompt,
        rawTrack,
      );

      return createPseudoBlock({
        id: `track_${row.id}`,
        sourceType: "track",
        title: row.title || row.id,
        text,
        params: {
          prompt: row.prompt,
          generation_mode: row.generation_mode,
          transform_type: row.transform_type,
          model_name: row.model_name,
          duration_s: row.duration_s,
          play_count: row.play_count,
          favorite_count: row.favorite_count,
        },
        tags: tokenize(`${row.generation_mode || ""} ${row.transform_type || ""} ${row.model_name || ""}`).slice(0, 16),
        ontology: this.ontology,
        index,
        priority: Math.min(1, 0.45 + Number(row.favorite_count || 0) * 0.015 + Number(row.play_count || 0) * 0.002),
        confidence: row.prompt ? 0.74 : 0.58,
        extraMeta: {
          source_db: database,
          record_id: row.id,
        },
      });
    });
  }

  mapSessions(rows, database) {
    return rows.map((row, index) => {
      const snapshot = row.ai_snapshot || {};
      const messages = Array.isArray(snapshot?.payload?.messages) ? snapshot.payload.messages : [];
      const messageText = messages
        .flatMap((message) => Array.isArray(message.parts) ? message.parts : [])
        .map((part) => (typeof part.content === "string" ? part.content : JSON.stringify(part.content || part.args || {})))
        .join("\n");

      const text = buildSearchText(row.title, row.config, messageText);

      return createPseudoBlock({
        id: `session_${row.id}`,
        sourceType: "session",
        title: row.title || row.id,
        text,
        params: {
          title: row.title,
          config: row.config,
          message_count: messages.length,
        },
        tags: [
          ...new Set(
            messages
              .flatMap((message) => Array.isArray(message.parts) ? message.parts : [])
              .flatMap((part) => [part.part_kind, part.tool_name])
              .filter(Boolean),
          ),
        ].slice(0, 24),
        ontology: this.ontology,
        index,
        priority: Math.min(1, 0.5 + messages.length * 0.01),
        confidence: messages.length > 4 ? 0.78 : 0.63,
        extraMeta: {
          source_db: database,
          record_id: row.id,
        },
      });
    });
  }

  mergeBlocks(primaryBlocks, legacyBlocks = []) {
    const merged = {};
    for (const block of [...primaryBlocks, ...legacyBlocks]) {
      if (!merged[block.id]) {
        merged[block.id] = block;
        continue;
      }

      if (block.mmss_meta?.source_db === "abstract-mind-lab") {
        merged[block.id] = block;
      }
    }
    return merged;
  }

  async loadRuntime({ includeLegacy = false } = {}) {
    await this.ensureOntology();
    const primaryDb = "abstract-mind-lab";
    const [primaryRows, legacyRows] = await Promise.all([
      this.loadSourceRows(primaryDb),
      includeLegacy ? this.loadSourceRows("abstract_mind_db") : Promise.resolve({ musicBlocks: [], tracks: [], sessions: [] }),
    ]);

    const primaryBlocks = [
      ...this.mapMusicBlocks(primaryRows.musicBlocks, primaryDb),
      ...this.mapTracks(primaryRows.tracks, primaryDb),
      ...this.mapSessions(primaryRows.sessions, primaryDb),
    ];

    const legacyBlocks = includeLegacy
      ? [
          ...this.mapMusicBlocks(legacyRows.musicBlocks, "abstract_mind_db"),
          ...this.mapTracks(legacyRows.tracks, "abstract_mind_db"),
          ...this.mapSessions(legacyRows.sessions, "abstract_mind_db"),
        ]
      : [];

    const blocks = this.mergeBlocks(primaryBlocks, legacyBlocks);
    const edges = buildGraphEdges(blocks);
    const embeddings = {
      blocks: Object.fromEntries(
        Object.values(blocks).map((block) => [
          block.id,
          {
            vector: Object.fromEntries(
              tokenize(buildSearchText(block.intent, block.tags, block.params))
                .slice(0, 64)
                .map((token) => [token, 1]),
            ),
          },
        ]),
      ),
    };

    return {
      blockIndex: { blocks },
      graph: { edges },
      embeddings,
      stats: {
        blockCount: Object.keys(blocks).length,
        musicBlockCount: primaryRows.musicBlocks.length,
        trackPseudoBlockCount: primaryRows.tracks.length,
        sessionPseudoBlockCount: primaryRows.sessions.length,
        legacyBlockCount: legacyBlocks.length,
        domains: Array.from(new Set(Object.values(blocks).map((block) => block.domain))).sort(),
        phases: Array.from(new Set(Object.values(blocks).map((block) => block.phase))).sort(),
      },
    };
  }
}

const mmssMutatorRuntimeService = new MMSSMutatorRuntimeService();

export default mmssMutatorRuntimeService;
