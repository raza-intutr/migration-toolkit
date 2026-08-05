import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { getPool, toPoolConfig, toTenantPoolConfig } from './tenant.service.js';

// Local keys — kept in lockstep with tenant.service.js cache layout.
const ENV_POOL_KEY = 'env';
const TENANT_POOL_KEY = 'tenant';

// Resolve a tenant row from the environment's tenant_connection_info table.
const resolveTenantRow = async (environment, tenantCode) => {
  const envPool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));
  const { rows } = await envPool.query(
    'SELECT id, tenant_code, db_details FROM tenant_connection_info WHERE tenant_code = $1 AND deleted = false LIMIT 1',
    [tenantCode],
  );
  if (rows.length === 0) {
    throw new AppError(`Tenant '${tenantCode}' not found in environment`, 404);
  }
  return rows[0];
};

// Discover user tables on a tenant DB, excluding PG system schemas and
// tables that start with `pg_` (pg_type, pg_class, etc).
const listUserTables = async (pool) => {
  const { rows } = await pool.query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
        AND table_name NOT LIKE 'pg\\_%' ESCAPE '\\'`,
  );
  return rows.map((r) => `"${r.table_schema}"."${r.table_name}"`);
};

// Verify the destination has every table the source wants to copy to.
// Destination already has the schema — if a table is missing, the migration
// cannot proceed (DDL is not the job of this endpoint).
const assertDestinationHasTables = async (pool, tables) => {
  const { rows } = await pool.query(
    `SELECT table_schema, table_name
       FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')`,
  );
  const have = new Set(rows.map((r) => `"${r.table_schema}"."${r.table_name}"`));
  const missing = tables.filter((t) => !have.has(t));
  if (missing.length > 0) {
    throw new AppError(
      `Destination schema is missing tables required by source: ${missing.join(', ')}`,
      400,
    );
  }
};

const quoteIdent = (qualified) => {
  const [schema, name] = qualified.replace(/"/g, '').split('.');
  return `"${schema}"."${name}"`;
};

const copyTable = async (srcPool, dstPool, qualified, { truncateFirst, onConflictSkip }) => {
  const ident = quoteIdent(qualified);
  if (truncateFirst) {
    await dstPool.query(`TRUNCATE TABLE ${ident} RESTART IDENTITY CASCADE`);
  }
  // Stream rows in chunks to avoid OOM on large tables.
  const CHUNK = 1000;
  let totalCopied = 0;
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { rows } = await srcPool.query(`SELECT * FROM ${ident} LIMIT $1 OFFSET $2`, [
      CHUNK,
      offset,
    ]);
    if (rows.length === 0) break;

    const cols = Object.keys(rows[0]);
    const valuesSql = rows
      .map((_, i) => `(${cols.map((__, j) => `$${i * cols.length + j + 1}`).join(', ')})`)
      .join(', ');
    const flat = rows.flatMap((r) => cols.map((c) => r[c]));
    const colList = cols.map((c) => `"${c}"`).join(', ');
    const sql = onConflictSkip
      ? `INSERT INTO ${ident} (${colList}) VALUES ${valuesSql} ON CONFLICT DO NOTHING`
      : `INSERT INTO ${ident} (${colList}) VALUES ${valuesSql}`;

    await dstPool.query(sql, flat);
    totalCopied += rows.length;
    if (rows.length < CHUNK) break;
    offset += CHUNK;
  }
  return totalCopied;
};

export const migrateTenant = async (environmentId, payload) => {
  if (payload.sourceTenantCode === payload.destinationTenantCode) {
    throw new AppError('sourceTenantCode and destinationTenantCode must differ', 400);
  }

  const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
  if (!environment) {
    throw new AppError('Environment not found', 404);
  }

  const [sourceRow, destRow] = await Promise.all([
    resolveTenantRow(environment, payload.sourceTenantCode),
    resolveTenantRow(environment, payload.destinationTenantCode),
  ]);

  const sourcePool = getPool(`${TENANT_POOL_KEY}:${sourceRow.id}`, toTenantPoolConfig(sourceRow.db_details, environment.ssl_mode));
  const destPool = getPool(`${TENANT_POOL_KEY}:${destRow.id}`, toTenantPoolConfig(destRow.db_details, environment.ssl_mode));

  // Confirm both DBs are reachable before we touch anything.
  await sourcePool.query('SELECT 1');
  await destPool.query('SELECT 1');

  // Discover tables on the source — destination must have the same ones.
  const allTables = await listUserTables(sourcePool);
  const tables =
    payload.tables && payload.tables.length > 0
      ? allTables.filter((t) => {
          // Extract table name from "schema"."table"
          const tableName = t.replace(/"/g, '').split('.').pop();
          return payload.tables.includes(tableName);
        })
      : allTables;

  if (tables.length === 0) {
    throw new AppError('No tables found to migrate', 400);
  }

  await assertDestinationHasTables(destPool, tables);

  const results = [];
  // ponytail: per-table copy, no single transaction across all tables.
  // FK ordering is non-trivial to derive generically. TRUNCATE ... CASCADE
  // handles FKs on the destination side; the schema is already correct.
  for (const table of tables) {
    const rows = await copyTable(sourcePool, destPool, table, {
      truncateFirst: payload.truncateFirst,
      onConflictSkip: payload.onConflictSkip,
    });
    results.push({ table, rows });
  }

  return {
    source: payload.sourceTenantCode,
    destination: payload.destinationTenantCode,
    tables: results,
    totalRows: results.reduce((sum, r) => sum + r.rows, 0),
  };
};
