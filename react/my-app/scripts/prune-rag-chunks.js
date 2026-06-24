const { Pool } = require('pg');

const DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const connectionString = process.env.DATABASE_URL
  || `postgresql://${process.env.PG_USER || 'mind_user'}:${process.env.PG_PASSWORD || 'mindfreak'}@${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}/${DATABASE}`;

const EXCLUDED_SOURCE_TABLES = [
  'applied_flows',
  'applied_memories',
  'chat_sessions',
  'app_entity_store',
  'app_setting_store',
  'mmss_invariants',
  'mmss_tracks_prompts',
  'sessions',
];

const EXCLUDED_SOURCE_DATABASE_TABLES = [
  ['abstract_mind_db', 'tracks'],
  ['abstract_mind_db', 'sessions'],
  ['abstract_mind_db', 'mmss_domain_patterns'],
  ['abstract_mind_db', 'app_setting_store'],
];

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
      FROM rag_chunks
      GROUP BY source_table
      ORDER BY count DESC, source_table
    `);

    const removePreview = before.rows.filter((row) =>
      EXCLUDED_SOURCE_TABLES.includes(row.source_table)
      || EXCLUDED_SOURCE_DATABASE_TABLES.some(([db, table]) => row.source_table === table && row.source_database === db),
    );
    const deleteResult = await pool.query(`
      DELETE FROM rag_chunks
      WHERE source_table = ANY($1::text[])
         OR (source_database, source_table) IN (
           SELECT pair.source_database, pair.source_table
           FROM UNNEST($2::text[], $3::text[]) AS pair(source_database, source_table)
         )
    `, [
      EXCLUDED_SOURCE_TABLES,
      EXCLUDED_SOURCE_DATABASE_TABLES.map(([db]) => db),
      EXCLUDED_SOURCE_DATABASE_TABLES.map(([, table]) => table),
    ]);

    const after = await pool.query(`
      SELECT source_table, COUNT(*)::int AS count
      FROM rag_chunks
      GROUP BY source_table
      ORDER BY count DESC, source_table
    `);

    console.log(JSON.stringify({
      database: DATABASE,
      excludedSourceTables: EXCLUDED_SOURCE_TABLES,
      excludedSourceDatabaseTables: EXCLUDED_SOURCE_DATABASE_TABLES,
      removedRows: deleteResult.rowCount,
      removedBySourceTable: removePreview,
      remainingBySourceTable: after.rows,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
