import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { getPool, toPoolConfig, toTenantPoolConfig } from './tenant.service.js';

// Local keys — kept in lockstep with tenant.service.js cache layout.
const ENV_POOL_KEY = 'env';
const TENANT_POOL_KEY = 'tenant';

// Resolve a tenant row from an environment's tenant_connection_info table.
// `environment` may be the Prisma row OR a plain env-shaped config object
// (e.g. when used in dry-run for an arbitrary target env).
const resolveTenantRow = async (environment, tenantCode) => {
  const envPool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));
  const { rows } = await envPool.query(
    'SELECT id, tenant_code, db_details FROM tenant_connection_info WHERE tenant_code = $1 AND deleted = false LIMIT 1',
    [tenantCode],
  );
  if (rows.length === 0) {
    throw new AppError(
      `Tenant '${tenantCode}' not found in environment '${environment.name ?? environment.id}'`,
      404,
    );
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

const CHUNK = 1000;

// Dry run: count rows per table on the source and report what WOULD happen
// on the destination. Never TRUNCATEs or INSERTs.
const previewTable = async (srcPool, table) => {
  const ident = quoteIdent(table);
  const { rows } = await srcPool.query(`SELECT COUNT(*)::bigint AS n FROM ${ident}`);
  return Number(rows[0].n);
};

// Real copy: chunked SELECT/INSERT with TRUNCATE-before and ON CONFLICT
// behaviour matching the original implementation.
const copyTable = async (srcPool, dstPool, qualified, { truncateFirst, onConflictSkip }) => {
  const ident = quoteIdent(qualified);
  if (truncateFirst) {
    await dstPool.query(`TRUNCATE TABLE ${ident} RESTART IDENTITY CASCADE`);
  }
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

// Resolve an environment row from Prisma.
const fetchEnvironment = async (environmentId) => {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
  if (!environment) {
    throw new AppError(`Environment ${environmentId} not found`, 404);
  }
  return environment;
};

// Filter source tables to the requested subset (matched on unqualified name).
const selectTables = (allTables, requested) => {
  if (!requested || requested.length === 0) return allTables;
  return allTables.filter((t) => {
    const tableName = t.replace(/"/g, '').split('.').pop();
    return requested.includes(tableName);
  });
};

// Build the dry-run report shape. Same envelope as the real run so callers
// can render both without branching.
const buildReport = ({ source, destination, tables, results, totalRows, dryRun }) => ({
  source,
  destination,
  dryRun,
  tables: results,
  totalRows,
  // Echo the resolved table list so the caller can sanity-check the filter.
  resolvedTables: tables,
});

// Core worker. Accepts two environment rows (possibly the same one) and the
// fully-validated payload. Used by both the same-env and cross-env entry
// points in this service.
const runMigration = async ({ sourceEnvironment, destinationEnvironment, payload }) => {
  if (payload.sourceTenantCode === payload.destinationTenantCode) {
    throw new AppError('sourceTenantCode and destinationTenantCode must differ', 400);
  }

  const [sourceRow, destRow] = await Promise.all([
    resolveTenantRow(sourceEnvironment, payload.sourceTenantCode),
    resolveTenantRow(destinationEnvironment, payload.destinationTenantCode),
  ]);

  const sourcePool = getPool(
    `${TENANT_POOL_KEY}:${sourceEnvironment.id}:${sourceRow.id}`,
    toTenantPoolConfig(sourceRow.db_details, sourceEnvironment.ssl_mode),
  );
  const destPool = getPool(
    `${TENANT_POOL_KEY}:${destinationEnvironment.id}:${destRow.id}`,
    toTenantPoolConfig(destRow.db_details, destinationEnvironment.ssl_mode),
  );

  // Confirm both DBs are reachable before we touch anything.
  await sourcePool.query('SELECT 1');
  await destPool.query('SELECT 1');

  const allTables = await listUserTables(sourcePool);
  const tables = selectTables(allTables, payload.tables);

  if (tables.length === 0) {
    throw new AppError('No tables found to migrate', 400);
  }

  await assertDestinationHasTables(destPool, tables);

  // Disable FK triggers/triggers on destination so we can load in any order.
  await destPool.query('SET session_replication_role = replica;');

  const results = [];
  let totalRows = 0;

  try {
    // ponytail: per-table copy, no single transaction across all tables.
    // FK ordering is non-trivial to derive generically. TRUNCATE ... CASCADE
    // handles FKs on the destination side; the schema is already correct.
    for (const table of tables) {
      const rows = payload.dryRun
        ? await previewTable(sourcePool, table)
        : await copyTable(sourcePool, destPool, table, {
            truncateFirst: payload.truncateFirst,
            onConflictSkip: payload.onConflictSkip,
          });
      totalRows += rows;
      results.push({ table, rows });
    }
  } finally {
    // Always reset replication role, even if we errored.
    await destPool.query('SET session_replication_role = DEFAULT;');
  }

  return buildReport({
    source: payload.sourceTenantCode,
    destination: payload.destinationTenantCode,
    tables,
    results,
    totalRows,
    dryRun: payload.dryRun,
  });
};

// Same-environment entry point. Source and destination tenants both live
// under the environment identified by :id.
export const migrateTenant = async (environmentId, payload) => {
  const environment = await fetchEnvironment(environmentId);
  return runMigration({
    sourceEnvironment: environment,
    destinationEnvironment: environment,
    payload,
  });
};

// Cross-environment entry point. Source tenant lives under sourceEnvironmentId;
// destination tenant lives under destinationEnvironmentId (or, when omitted,
// the same env as the source — i.e. same-env behaviour).
export const migrateCrossEnvironment = async (payload) => {
  const sourceEnvironment = await fetchEnvironment(payload.sourceEnvironmentId);
  const destinationEnvironment = payload.destinationEnvironmentId
    ? await fetchEnvironment(payload.destinationEnvironmentId)
    : sourceEnvironment;

  return runMigration({
    sourceEnvironment,
    destinationEnvironment,
    payload,
  });
};

// TRUNCATE every user table on a tenant. Schema is preserved — only the
// rows go. `tables` lets the caller scope which tables to truncate; when
// omitted, every user table in the tenant is wiped.
//
// ponytail: per-table TRUNCATE ... CASCADE so we don't have to derive FK
// ordering. The schema stays intact; only the rows change.
export const truncateTenant = async (environmentId, payload) => {
  const environment = await fetchEnvironment(environmentId);
  const tenantRow = await resolveTenantRow(environment, payload.tenantCode);
  const tenantPool = getPool(
    `${TENANT_POOL_KEY}:${environment.id}:${tenantRow.id}`,
    toTenantPoolConfig(tenantRow.db_details, environment.ssl_mode),
  );

  await tenantPool.query('SELECT 1');

  const allTables = await listUserTables(tenantPool);
  const tables = selectTables(allTables, payload.tables);

  if (tables.length === 0) {
    throw new AppError('No tables found to truncate', 400);
  }

  const results = [];
  for (const table of tables) {
    const ident = quoteIdent(table);
    await tenantPool.query(`TRUNCATE TABLE ${ident} RESTART IDENTITY CASCADE`);
    results.push({ table });
  }

  return {
    tenant: payload.tenantCode,
    dryRun: false,
    tables: results,
    truncatedCount: results.length,
  };
};