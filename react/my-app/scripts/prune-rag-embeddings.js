const { Pool } = require('pg');

const DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const connectionString = process.env.DATABASE_URL
  || `postgresql://${process.env.PG_USER || 'mind_user'}:${process.env.PG_PASSWORD || 'mindfreak'}@${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}/${DATABASE}`;

const ALLOWED = new Set([
  'tracks',
  'mmss_collection',
  'mmss_albums',
  'mmss_domain_patterns',
  'mmss_custom_instructions',
  'music_blocks',
]);

async function main() {
  const pool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000,
  });

  try {
    const before = await pool.query(`
      SELECT source_table, COUNT(*)::int AS count
      FROM rag_document_embeddings
      GROUP BY source_table
      ORDER BY count DESC, source_table
    `);

    const deleted = await pool.query(`
      DELETE FROM rag_document_embeddings
      WHERE NOT (source_table = ANY($1::text[]))
    `, [Array.from(ALLOWED)]);

    const after = await pool.query(`
      SELECT source_table, COUNT(*)::int AS count
      FROM rag_document_embeddings
      GROUP BY source_table
      ORDER BY count DESC, source_table
    `);

    const size = await pool.query(`
      SELECT pg_size_pretty(pg_total_relation_size('public.rag_document_embeddings')) AS total_size,
             pg_total_relation_size('public.rag_document_embeddings') AS total_bytes
    `);

    console.log(JSON.stringify({
      database: DATABASE,
      allowedSourceTables: Array.from(ALLOWED),
      deletedRows: deleted.rowCount,
      before: before.rows,
      after: after.rows,
      size: size.rows[0],
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
