const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const TRACK_ID = process.argv[2] || '5c293123-4a7e-43cc-ae16-8583eced8694';
const DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const connectionString = process.env.DATABASE_URL
  || `postgresql://${process.env.PG_USER || 'mind_user'}:${process.env.PG_PASSWORD || 'mindfreak'}@${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}/${DATABASE}`;

function preview(value, limit = 1600) {
  if (value == null) return null;
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

async function main() {
  const pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  try {
    const payload = {};

    payload.track = (await pool.query(`
      SELECT id, title, prompt, session_id, created_at, raw_data, conditions, lyrics_timestamped
      FROM tracks
      WHERE id = $1
    `, [TRACK_ID])).rows.map((row) => ({
      ...row,
      raw_data: preview(row.raw_data, 5000),
      conditions: preview(row.conditions, 1200),
      lyrics_timestamped: preview(row.lyrics_timestamped, 1200),
    }));

    payload.session = (await pool.query(`
      SELECT s.id, s.title, s.created_at, s.updated_at, s.ai_snapshot, s.config
      FROM sessions s
      JOIN tracks t ON t.session_id = s.id
      WHERE t.id = $1
    `, [TRACK_ID])).rows.map((row) => ({
      ...row,
      ai_snapshot: preview(row.ai_snapshot, 5000),
      config: preview(row.config, 1600),
    }));

    payload.mmss_tracks_prompts = (await pool.query(`
      SELECT *
      FROM mmss_tracks_prompts
      WHERE track_id = $1
      ORDER BY id DESC
    `, [TRACK_ID])).rows;

    payload.mmss_filtered = (await pool.query(`
      SELECT *
      FROM mmss_filtered
      WHERE track_id = $1
         OR raw_payload::text ILIKE '%' || $1 || '%'
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [TRACK_ID])).rows.map((row) => ({
      ...row,
      raw_payload: preview(row.raw_payload, 2500),
      metadata: preview(row.metadata, 1200),
    }));

    payload.mmss_collection = (await pool.query(`
      SELECT *
      FROM mmss_collection
      WHERE payload::text ILIKE '%' || $1 || '%'
         OR content ILIKE '%' || $1 || '%'
         OR source_ref ILIKE '%' || $1 || '%'
      ORDER BY updated_at DESC NULLS LAST, id DESC
    `, [TRACK_ID])).rows.map((row) => ({
      ...row,
      payload: preview(row.payload, 2500),
      metadata: preview(row.metadata, 1200),
      content: preview(row.content, 1200),
    }));

    payload.rag_chunks = (await pool.query(`
      SELECT id, source_table, source_id, source_database, title, description, chunk_hash, chunk_text
      FROM rag_chunks
      WHERE source_id = $1
         OR chunk_text ILIKE '%' || $1 || '%'
         OR description ILIKE '%' || $1 || '%'
         OR title ILIKE '%' || $1 || '%'
      ORDER BY source_table, source_database, source_id
    `, [TRACK_ID])).rows.map((row) => ({
      ...row,
      chunk_text: preview(row.chunk_text, 2400),
    }));

    payload.rag_stats = {
      by_source_table: (await pool.query(`
        SELECT source_table, COUNT(*)::int AS count
        FROM rag_chunks
        GROUP BY source_table
        ORDER BY count DESC, source_table
      `)).rows,
      by_source_database_table: (await pool.query(`
        SELECT source_database, source_table, COUNT(*)::int AS count
        FROM rag_chunks
        GROUP BY source_database, source_table
        ORDER BY source_table, source_database
      `)).rows,
      track_duplicates: (await pool.query(`
        SELECT COUNT(*)::int AS total_rows,
               COUNT(DISTINCT source_id)::int AS distinct_source_ids,
               COUNT(*)::int - COUNT(DISTINCT source_id)::int AS duplicate_rows
        FROM rag_chunks
        WHERE source_table = 'tracks'
      `)).rows[0],
      session_duplicates: (await pool.query(`
        SELECT COUNT(*)::int AS total_rows,
               COUNT(DISTINCT source_id)::int AS distinct_source_ids,
               COUNT(*)::int - COUNT(DISTINCT source_id)::int AS duplicate_rows
        FROM rag_chunks
        WHERE source_table = 'sessions'
      `)).rows[0],
    };

    const outputPath = path.join(__dirname, '..', '..', '..', 'rag_track_lineage.json');
    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(JSON.stringify({ trackId: TRACK_ID, outputPath }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
