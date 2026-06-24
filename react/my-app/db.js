const { Pool } = require('pg');

// Primary database is now abstract-mind-lab
const PG_DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = process.env.PG_PORT || '5432';
const PG_USER = process.env.PG_USER || 'mind_user';
const PG_PASSWORD = process.env.PG_PASSWORD || 'mindfreak';

// Legacy database for read-only access to old data
const LEGACY_DATABASE = process.env.DB_NAME_V1 || 'abstract_mind_db';

function buildDatabaseUrl(databaseName) {
  return `postgresql://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${databaseName}`;
}

const DATABASE_URL = buildDatabaseUrl(PG_DATABASE);
const poolCache = new Map();

function getPool(databaseName = PG_DATABASE) {
  if (!poolCache.has(databaseName)) {
    poolCache.set(
      databaseName,
      new Pool({
        connectionString: buildDatabaseUrl(databaseName),
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 30000,
      }),
    );
  }

  return poolCache.get(databaseName);
}

function normalizeSql(sql) {
  return String(sql || '')
    .replace(/^```sql\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function validateReadOnlySql(sql) {
  const normalizedSql = normalizeSql(sql);
  const compactUpper = normalizedSql.replace(/\s+/g, ' ').trim().toUpperCase();

  if (!normalizedSql) {
    throw new Error('SQL query required');
  }

  if (!compactUpper.startsWith('SELECT')) {
    throw new Error('Only SELECT queries are allowed');
  }

  const forbidden = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
  for (const keyword of forbidden) {
    const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
    if (pattern.test(compactUpper)) {
      throw new Error(`Forbidden SQL operation: ${keyword}. Only SELECT allowed.`);
    }
  }

  const statementParts = normalizedSql.split(';').map((part) => part.trim()).filter(Boolean);
  if (statementParts.length > 1) {
    throw new Error('Multiple SQL statements are not allowed');
  }

  return statementParts[0] || normalizedSql;
}

function resolveDatabaseName(databaseName) {
  const normalized = String(databaseName || '').trim();
  
  // Default to primary database
  if (!normalized || normalized === 'default' || normalized === 'abstract-mind-lab') {
    return PG_DATABASE;
  }

  // Legacy database access (with renamed tables)
  if (normalized === 'abstract_mind_db' || normalized === 'legacy') {
    return LEGACY_DATABASE;
  }

  throw new Error(`Unsupported database target: ${normalized}. Use 'abstract-mind-lab' or 'legacy'`);
}

async function executeReadOnlyQuery(sql, databaseName) {
  const validatedSql = validateReadOnlySql(sql);
  const resolvedDatabase = resolveDatabaseName(databaseName);
  const client = await getPool(resolvedDatabase).connect();
  try {
    const result = await client.query({
      text: validatedSql,
      rowMode: 'array',
    });

    const columns = Array.isArray(result?.fields) ? result.fields.map((field) => field.name) : [];
    const rows = Array.isArray(result?.rows)
      ? result.rows.map((row) =>
          Object.fromEntries(columns.map((column, index) => [column, row[index]])),
        )
      : [];

    return rows;
  } finally {
    client.release();
  }
}

module.exports = {
  DATABASE_URL,
  executeReadOnlyQuery,
  getPool,
  validateReadOnlySql,
};
