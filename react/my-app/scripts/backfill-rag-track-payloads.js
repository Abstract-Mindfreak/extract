const { Pool } = require('pg');

const DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const connectionString = process.env.DATABASE_URL
  || `postgresql://${process.env.PG_USER || 'mind_user'}:${process.env.PG_PASSWORD || 'mindfreak'}@${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}/${DATABASE}`;

function extractPromptText(part) {
  const content = part?.content;
  if (typeof content === 'string') return content.trim();
  if (content && typeof content === 'object') {
    if (typeof content.prompt === 'string' && content.prompt.trim()) return content.prompt.trim();
    if (typeof content.sound_prompt === 'string' && content.sound_prompt.trim()) return content.sound_prompt.trim();
    if (typeof content.text === 'string' && content.text.trim()) return content.text.trim();
    return JSON.stringify(content).slice(0, 2000);
  }
  return '';
}

function matchesTrackGenerationMessage(message, trackId, trackTitle) {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  return parts.some((part) => {
    const args = part?.args || {};
    const content = part?.content || {};
    return args?.title === trackTitle
      || args?.output_title === trackTitle
      || args?.track_id === trackId
      || args?.result_clip_id === trackId
      || content?.track_id === trackId
      || content?.result_clip_id === trackId;
  });
}

function extractGenerationTail(rawData, trackId, trackTitle) {
  const messages = Array.isArray(rawData?.session_snapshot?.messages)
    ? rawData.session_snapshot.messages
    : [];
  const tail = {
    operation: rawData?.raw_track?.operation || rawData?.operation || null,
    user_prompt: null,
    tool_call: null,
    tool_result: null,
  };

  let matchIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (matchesTrackGenerationMessage(messages[index], trackId, trackTitle)) {
      matchIndex = index;
      break;
    }
  }

  if (matchIndex === -1) return tail;

  for (let index = matchIndex; index >= 0; index -= 1) {
    const message = messages[index];
    const parts = Array.isArray(message?.parts) ? message.parts : [];
    for (const part of parts) {
      if (!tail.tool_result && message?.kind === 'request' && part?.part_kind === 'tool-return') {
        const resultClipId = part?.content?.result_clip_id || part?.content?.track_id || null;
        if (!resultClipId || String(resultClipId) === String(trackId)) {
          tail.tool_result = part.content;
        }
      }

      if (!tail.tool_call && message?.kind === 'response' && part?.part_kind === 'tool-call') {
        const args = part?.args || {};
        if (
          args?.title === trackTitle
          || args?.output_title === trackTitle
          || args?.track_id === trackId
          || part?.tool_name === 'audio__create_song'
          || part?.tool_name === 'audio__apply_effect'
        ) {
          tail.tool_call = {
            tool_name: part.tool_name,
            args,
          };
        }
      }

      if (!tail.user_prompt && message?.kind === 'request' && part?.part_kind === 'user-prompt') {
        const promptText = extractPromptText(part);
        if (promptText && promptText !== '<ui-hidden>Conversation started</ui-hidden>') {
          tail.user_prompt = promptText;
        }
      }
    }

    if (tail.user_prompt && tail.tool_call && tail.tool_result) {
      break;
    }
  }

  return tail;
}

function compactFilteredEntry(row) {
  return {
    filtered_id: row.filtered_id,
    source_ref: row.source_ref,
    generation_insights: row.generation_insights,
    operator_trajectory: row.operator_trajectory,
    temporal_phases: row.temporal_phases,
    metric_v: row.metric_v,
    metric_s: row.metric_s,
    metric_d_f: row.metric_d_f,
    metric_r_t: row.metric_r_t,
    creative_choices: row.creative_choices,
    emergence_moments: row.emergence_moments,
    next_vector_suggestions: row.next_vector_suggestions,
    domain: row.domain,
    recursion_depth: row.recursion_depth,
    stability_flag: row.stability_flag,
    raw_payload: row.raw_payload || null,
  };
}

function compactCollectionEntry(row) {
  return {
    entry_id: row.entry_id,
    category: row.category,
    title: row.title,
    content: row.content,
    source_ref: row.source_ref,
    score: row.score,
    payload: row.payload || null,
  };
}

function buildTrackChunk(row, related = {}) {
  return JSON.stringify({
    track: {
      id: row.track_id,
      title: row.title || null,
      prompt: row.prompt || null,
      session_id: row.session_id || null,
      conditions: row.conditions || null,
      lyrics_timestamped: row.lyrics_timestamped || null,
    },
    generation_tail: extractGenerationTail(row.raw_data || {}, row.track_id, row.title),
    filtered: (related.filtered || []).map(compactFilteredEntry),
    collection: (related.collection || []).map(compactCollectionEntry),
  }, null, 2);
}

function buildDescription(row) {
  return [row.title, row.prompt].filter(Boolean).join(' ').trim();
}

function resolveTrackPromptText(row) {
  const directPrompt = typeof row?.prompt === 'string' ? row.prompt.trim() : '';
  if (directPrompt) return directPrompt;

  const generationTail = extractGenerationTail(row?.raw_data || {}, row?.track_id, row?.title);
  if (typeof generationTail?.user_prompt === 'string' && generationTail.user_prompt.trim()) {
    return generationTail.user_prompt.trim();
  }

  const operation = generationTail?.operation || {};
  for (const key of ['prompt', 'sound_prompt', 'text']) {
    if (typeof operation?.[key] === 'string' && operation[key].trim()) {
      return operation[key].trim();
    }
  }

  const args = generationTail?.tool_call?.args || {};
  for (const key of ['prompt', 'sound_prompt', 'title', 'output_title']) {
    if (typeof args?.[key] === 'string' && args[key].trim()) {
      return args[key].trim();
    }
  }

  return '';
}

async function main() {
  const pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  try {
    await pool.query(`
      ALTER TABLE rag_chunks
      ADD COLUMN IF NOT EXISTS prompt_text TEXT
    `);

    const tracks = await pool.query(`
      SELECT rc.id AS rag_id, t.id AS track_id, t.title, t.prompt, t.session_id, t.conditions, t.lyrics_timestamped, t.raw_data
      FROM rag_chunks rc
      JOIN tracks t ON t.id::text = rc.source_id
      WHERE rc.source_table = 'tracks'
        AND rc.source_database = 'abstract-mind-lab'
    `);

    const ids = tracks.rows.map((row) => row.track_id);
    const filtered = await pool.query(`
      SELECT *
      FROM mmss_filtered
      WHERE track_id = ANY($1)
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [ids]);
    const collection = await pool.query(`
      SELECT *
      FROM mmss_collection
      WHERE payload->>'track_id' = ANY($1)
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [ids]);

    const filteredMap = new Map();
    for (const row of filtered.rows) {
      const key = String(row.track_id || '');
      if (!filteredMap.has(key)) filteredMap.set(key, []);
      filteredMap.get(key).push(row);
    }

    const collectionMap = new Map();
    for (const row of collection.rows) {
      const key = String(row?.payload?.track_id || '');
      if (!collectionMap.has(key)) collectionMap.set(key, []);
      collectionMap.get(key).push(row);
    }

    let updated = 0;
    for (const row of tracks.rows) {
      const related = {
        filtered: filteredMap.get(String(row.track_id)) || [],
        collection: collectionMap.get(String(row.track_id)) || [],
      };
      const chunkText = buildTrackChunk(row, related);
      const description = buildDescription(row);
      const promptText = resolveTrackPromptText(row);
      await pool.query(`
        UPDATE rag_chunks
        SET chunk_text = $2,
            description = $3,
            prompt_text = $4
        WHERE id = $1
      `, [row.rag_id, chunkText, description, promptText || null]);
      updated += 1;
    }

    console.log(JSON.stringify({
      database: DATABASE,
      updatedTrackChunks: updated,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
