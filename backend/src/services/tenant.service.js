import pg from 'pg';
import crypto from 'crypto';
import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { parseJdbcUrl } from '../utils/jdbcUrl.js';
import { decryptPassword } from '../utils/crypto.js';
import { resolveDbHost } from '../utils/dbHost.js';

const { Pool } = pg;

const MAX_CACHED_POOLS = 100;
const poolCache = new Map();

const ENV_POOL_KEY = 'env';
const TENANT_POOL_KEY = 'tenant';

export const toPoolConfig = (environment) => ({
  host: resolveDbHost(environment.host),
  port: environment.port,
  database: environment.db,
  user: environment.user,
  password: environment.password || undefined,
  ssl: environment.ssl_mode !== 'disable' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000,
});

export const toTenantPoolConfig = (dbDetails, environmentSslMode = 'disable') => {
  const { host, port, database, ssl: jdbcSsl } = parseJdbcUrl(dbDetails.url);
  // Prefer JDBC URL SSL setting, fallback to environment's ssl_mode.
  const useSsl = jdbcSsl !== undefined ? jdbcSsl : environmentSslMode !== 'disable';
  return {
    host: resolveDbHost(host),
    port,
    database,
    user: dbDetails.username,
    password: dbDetails.password ? decryptPassword(dbDetails.password) : undefined,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 30000,
  };
};

const evictLeastRecentlyUsed = () => {
  if (poolCache.size < MAX_CACHED_POOLS) {
    return;
  }
  let lruKey = null;
  let lruUsedAt = Infinity;
  for (const [key, entry] of poolCache) {
    if (entry.lastUsedAt < lruUsedAt) {
      lruUsedAt = entry.lastUsedAt;
      lruKey = key;
    }
  }
  if (lruKey) {
    poolCache.get(lruKey).pool.end().catch(() => {});
    poolCache.delete(lruKey);
  }
};

export const getPool = (key, config) => {
  evictLeastRecentlyUsed();
  const cached = poolCache.get(key);
  if (cached) {
    cached.lastUsedAt = Date.now();
    return cached.pool;
  }
  const pool = new Pool(config);
  poolCache.set(key, { pool, lastUsedAt: Date.now() });
  return pool;
};

export const closePool = (key) => {
  const entry = poolCache.get(key);
  if (entry) {
    poolCache.delete(key);
    entry.pool.end().catch(() => {});
  }
};

const redactDbDetails = (tenant) => {
  const { db_details: dbDetails, ...rest } = tenant;
  if (!dbDetails || typeof dbDetails !== 'object') {
    return { ...rest, db_details: dbDetails ?? null };
  }
  const { password: _password, ...safeDetails } = dbDetails;
  return { ...rest, db_details: safeDetails };
};

const getEnvironmentOrThrow = async (environmentId) => {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
  if (!environment) {
    throw new AppError('Environment not found', 404);
  }
  return environment;
};

const getTenantRowOrThrow = async (environment, tenantCode) => {
  const pool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));
  try {
    const { rows } = await pool.query(
      'SELECT * FROM tenant_connection_info WHERE tenant_code = $1 AND deleted = false LIMIT 1',
      [tenantCode],
    );
    if (rows.length === 0) {
      throw new AppError('Tenant not found', 404);
    }
    return rows[0];
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    closePool(`${ENV_POOL_KEY}:${environment.id}`);
    throw new AppError(`Unable to query environment database: ${err.message}`, 502);
  }
};

export const getTenantsByEnvironmentId = async (environmentId) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const pool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));

  try {
    const { rows } = await pool.query(
      'SELECT * FROM tenant_connection_info WHERE deleted = false ORDER BY created_date ASC',
    );
    return rows.map(redactDbDetails);
  } catch (err) {
    closePool(`${ENV_POOL_KEY}:${environment.id}`);
    throw new AppError(`Unable to query environment database: ${err.message}`, 502);
  }
};

export const testEnvironmentConnection = async (environmentId) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const pool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));

  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    closePool(`${ENV_POOL_KEY}:${environment.id}`);
    return { connected: false, latencyMs: null, error: err.message };
  }
};

// Probe an arbitrary environment connection config without persisting it. Used
// to test a connection before creating the environment record.
export const testEnvironmentCredentials = async (config) => {
  const probeKey = `probe:${crypto.randomUUID()}`;
  const pool = getPool(probeKey, toPoolConfig(config));

  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    closePool(probeKey);
    return { connected: false, latencyMs: null, error: err.message };
  }
};

// Lightweight health probe for all environments — SELECT 1 against each DB,
// never fails the request. Used by the status column on the environments page.
export const getEnvironmentHealth = async () => {
  const environments = await prisma.environment.findMany({ orderBy: { created_at: 'asc' } });

  const probe = async (environment) => {
    const pool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));
    const startedAt = Date.now();
    try {
      await pool.query('SELECT 1');
      return {
        environmentId: environment.id,
        name: environment.name,
        isActive: environment.is_active,
        connected: true,
        latencyMs: Date.now() - startedAt,
      };
    } catch {
      closePool(`${ENV_POOL_KEY}:${environment.id}`);
      return {
        environmentId: environment.id,
        name: environment.name,
        isActive: environment.is_active,
        connected: false,
        latencyMs: null,
      };
    }
  };

  const results = await Promise.all(environments.map(probe));
  return results;
};

// Resolve a tenant's database connection as a plain object usable by both
// `pg` pools and the pg_dump/pg_restore env builder. The registry password is
// encrypted on disk, so it must be decrypted here.
export const resolveTenantConnection = async (environment, tenantCode) => {
  const tenant = await getTenantRowOrThrow(environment, tenantCode);
  const dbDetails = tenant.db_details;
  if (!dbDetails || typeof dbDetails !== 'object' || !dbDetails.url) {
    throw new AppError(`Tenant '${tenantCode}' has no db_details.url configured`, 400);
  }
  const { host, port, database } = parseJdbcUrl(dbDetails.url);
  return {
    host: resolveDbHost(host),
    port,
    db: database,
    user: dbDetails.username,
    password: dbDetails.password ? decryptPassword(dbDetails.password) : null,
    ssl_mode: environment.ssl_mode,
  };
};

// Whether a tenant database already contains user tables. Used as an
// overwrite guard before a destructive migration.
export const envHasData = async (connection) => {
  const pool = new Pool(toPoolConfig(connection));
  try {
    const { rows } = await pool.query(
      `SELECT schemaname, tablename FROM pg_tables
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
       AND schemaname NOT LIKE 'pg\\_%' ESCAPE '\\'`,
    );
    return rows.length > 0;
  } finally {
    await pool.end();
  }
};

export const getTenantByTenantCode = async (environmentId, tenantCode) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const tenant = await getTenantRowOrThrow(environment, tenantCode);
  return redactDbDetails(tenant);
};

export const testTenantConnection = async (environmentId, tenantCode) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const tenant = await getTenantRowOrThrow(environment, tenantCode);
  const dbDetails = tenant.db_details;
  if (!dbDetails || typeof dbDetails !== 'object' || !dbDetails.url) {
    throw new AppError('Tenant has no db_details.url configured', 400);
  }

  const key = `${TENANT_POOL_KEY}:${tenant.id}`;
  const pool = getPool(key, toTenantPoolConfig(dbDetails, environment.ssl_mode));

  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    closePool(key);
    return { connected: false, latencyMs: null, error: err.message };
  }
};

// List user tables with an exact row count, excluding PG system schemas and
// tables that start with `pg_` (pg_type, pg_class, etc).
//
// `pg_class.reltuples` is only an optimizer estimate and stays -1 until the
// table has been ANALYZE'd or VACUUMed, so it cannot be trusted. Instead each
// table gets a real COUNT(*) via query_to_xml in a single round trip.
const listTablesFromPool = async (pool) => {
  const { rows } = await pool.query(
    `SELECT n.nspname AS table_schema,
            c.relname AS table_name,
            COALESCE(
              (xpath('/row/cnt/text()',
                     query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::bigint,
              0
            ) AS rows
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
        AND c.relname NOT LIKE 'pg\\_%' ESCAPE '\\'
      ORDER BY n.nspname, c.relname`,
  );
  return rows.map((r) => ({
    schema: r.table_schema,
    name: r.table_name,
    qualified: `"${r.table_schema}"."${r.table_name}"`,
    estimatedRows: r.rows,
  }));
};

export const listEnvironmentTables = async (environmentId) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const pool = getPool(`${ENV_POOL_KEY}:${environment.id}`, toPoolConfig(environment));

  try {
    return await listTablesFromPool(pool);
  } catch (err) {
    closePool(`${ENV_POOL_KEY}:${environment.id}`);
    throw new AppError(`Unable to query environment database: ${err.message}`, 502);
  }
};

export const listTenantTables = async (environmentId, tenantCode) => {
  const environment = await getEnvironmentOrThrow(environmentId);
  const tenant = await getTenantRowOrThrow(environment, tenantCode);
  const dbDetails = tenant.db_details;
  if (!dbDetails || typeof dbDetails !== 'object' || !dbDetails.url) {
    throw new AppError('Tenant has no db_details.url configured', 400);
  }

  const key = `${TENANT_POOL_KEY}:${tenant.id}`;
  const pool = getPool(key, toTenantPoolConfig(dbDetails, environment.ssl_mode));

  try {
    return await listTablesFromPool(pool);
  } catch (err) {
    closePool(key);
    throw new AppError(`Unable to query tenant database: ${err.message}`, 502);
  }
};
