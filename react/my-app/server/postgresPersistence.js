const { Pool } = require('pg');

const PG_DATABASE = process.env.PG_DATABASE || 'abstract-mind-lab';
const DATABASE_URL =
  `postgresql://${process.env.PG_USER || 'mind_user'}:${process.env.PG_PASSWORD || 'mindfreak'}@${process.env.PG_HOST || 'localhost'}:${process.env.PG_PORT || '5432'}/${PG_DATABASE}`;

let pool = null;
let schemaPromise = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
    });
  }
  return pool;
}

async function ensureSchema() {
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    const client = await getPool().connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_entity_store (
          scope TEXT NOT NULL,
          entity_key TEXT NOT NULL,
          payload JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (scope, entity_key)
        );
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_setting_store (
          scope TEXT NOT NULL,
          setting_key TEXT NOT NULL,
          value JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (scope, setting_key)
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_app_entity_scope_updated
        ON app_entity_store (scope, updated_at DESC);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_app_setting_scope_updated
        ON app_setting_store (scope, updated_at DESC);
      `);

      const entityPk = await client.query(`
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.app_entity_store'::regclass
          AND contype = 'p'
        LIMIT 1
      `);
      if (!entityPk.rowCount) {
        await client.query(`
          ALTER TABLE app_entity_store
          ADD CONSTRAINT app_entity_store_pkey PRIMARY KEY (scope, entity_key)
        `);
      }

      const settingPk = await client.query(`
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.app_setting_store'::regclass
          AND contype = 'p'
        LIMIT 1
      `);
      if (!settingPk.rowCount) {
        await client.query(`
          ALTER TABLE app_setting_store
          ADD CONSTRAINT app_setting_store_pkey PRIMARY KEY (scope, setting_key)
        `);
      }
    } finally {
      client.release();
    }
  })();

  return schemaPromise;
}

async function getStatus() {
  await ensureSchema();
  const result = await getPool().query('SELECT NOW() AS now');
  return {
    available: true,
    databaseUrl: DATABASE_URL,
    now: result.rows[0]?.now || null,
  };
}

async function listEntities(scope) {
  await ensureSchema();
  const result = await getPool().query(
    `
      SELECT entity_key, payload, created_at, updated_at
      FROM app_entity_store
      WHERE scope = $1
      ORDER BY updated_at DESC, entity_key ASC
    `,
    [scope],
  );
  return result.rows.map((row) => ({
    key: row.entity_key,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function getEntity(scope, entityKey) {
  await ensureSchema();
  const result = await getPool().query(
    `
      SELECT entity_key, payload, created_at, updated_at
      FROM app_entity_store
      WHERE scope = $1 AND entity_key = $2
      LIMIT 1
    `,
    [scope, entityKey],
  );
  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    key: row.entity_key,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertEntity(scope, entityKey, payload) {
  await ensureSchema();
  const result = await getPool().query(
    `
      INSERT INTO app_entity_store (scope, entity_key, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (scope, entity_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
      RETURNING entity_key, payload, created_at, updated_at
    `,
    [scope, entityKey, JSON.stringify(payload ?? {})],
  );
  const row = result.rows[0];
  return {
    key: row.entity_key,
    payload: row.payload,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsertEntities(scope, items, keyField = 'id') {
  await ensureSchema();
  const normalized = (Array.isArray(items) ? items : [])
    .filter(Boolean)
    .map((item, index) => {
      const entityKey = item?.[keyField] ?? item?.id ?? item?.key ?? `${scope}_${index}`;
      return {
        entityKey: String(entityKey),
        payload: item,
      };
    });

  if (!normalized.length) return [];

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const item of normalized) {
      const response = await client.query(
        `
          INSERT INTO app_entity_store (scope, entity_key, payload)
          VALUES ($1, $2, $3::jsonb)
          ON CONFLICT (scope, entity_key)
          DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()
          RETURNING entity_key, payload, created_at, updated_at
        `,
        [scope, item.entityKey, JSON.stringify(item.payload ?? {})],
      );
      const row = response.rows[0];
      results.push({
        key: row.entity_key,
        payload: row.payload,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteEntity(scope, entityKey) {
  await ensureSchema();
  await getPool().query(
    `
      DELETE FROM app_entity_store
      WHERE scope = $1 AND entity_key = $2
    `,
    [scope, entityKey],
  );
}

async function clearEntities(scope) {
  await ensureSchema();
  await getPool().query('DELETE FROM app_entity_store WHERE scope = $1', [scope]);
}

async function countEntities(scope) {
  await ensureSchema();
  const result = await getPool().query('SELECT COUNT(*)::int AS count FROM app_entity_store WHERE scope = $1', [scope]);
  return result.rows[0]?.count || 0;
}

async function listSettings(scope) {
  await ensureSchema();
  const result = await getPool().query(
    `
      SELECT setting_key, value, created_at, updated_at
      FROM app_setting_store
      WHERE scope = $1
      ORDER BY setting_key ASC
    `,
    [scope],
  );

  const values = {};
  for (const row of result.rows) {
    values[row.setting_key] = row.value;
  }
  return values;
}

async function getSetting(scope, settingKey) {
  await ensureSchema();
  const result = await getPool().query(
    `
      SELECT value, created_at, updated_at
      FROM app_setting_store
      WHERE scope = $1 AND setting_key = $2
      LIMIT 1
    `,
    [scope, settingKey],
  );
  if (!result.rowCount) return null;
  return {
    value: result.rows[0].value,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

async function setSetting(scope, settingKey, value) {
  await ensureSchema();
  const result = await getPool().query(
    `
      INSERT INTO app_setting_store (scope, setting_key, value)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (scope, setting_key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING value, created_at, updated_at
    `,
    [scope, settingKey, JSON.stringify(value)],
  );
  return {
    value: result.rows[0].value,
    createdAt: result.rows[0].created_at,
    updatedAt: result.rows[0].updated_at,
  };
}

async function setSettings(scope, values) {
  await ensureSchema();
  const entries = Object.entries(values || {});
  if (!entries.length) return {};

  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    for (const [settingKey, value] of entries) {
      await client.query(
        `
          INSERT INTO app_setting_store (scope, setting_key, value)
          VALUES ($1, $2, $3::jsonb)
          ON CONFLICT (scope, setting_key)
          DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `,
        [scope, settingKey, JSON.stringify(value)],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return listSettings(scope);
}

async function deleteSetting(scope, settingKey) {
  await ensureSchema();
  await getPool().query(
    `
      DELETE FROM app_setting_store
      WHERE scope = $1 AND setting_key = $2
    `,
    [scope, settingKey],
  );
}

async function clearSettings(scope) {
  await ensureSchema();
  await getPool().query('DELETE FROM app_setting_store WHERE scope = $1', [scope]);
}

module.exports = {
  DATABASE_URL,
  clearSettings,
  clearEntities,
  countEntities,
  deleteEntity,
  deleteSetting,
  ensureSchema,
  getEntity,
  getSetting,
  getStatus,
  listEntities,
  listSettings,
  setSetting,
  setSettings,
  upsertEntities,
  upsertEntity,
};
