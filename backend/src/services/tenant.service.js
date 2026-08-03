import pg from 'pg';
import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { parseJdbcUrl } from '../utils/jdbcUrl.js';

const { Pool } = pg;

const MAX_CACHED_POOLS = 100;
const poolCache = new Map();

const ENV_POOL_KEY = 'env';
const TENANT_POOL_KEY = 'tenant';

const toPoolConfig = (environment) => ({
  host: environment.host,
  port: environment.port,
  database: environment.db,
  user: environment.user,
  password: environment.password,
  ssl: environment.ssl_mode !== 'disable' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 30000,
});

const toTenantPoolConfig = (dbDetails) => {
  const { host, port, database } = parseJdbcUrl(dbDetails.url);
  return {
    host,
    port,
    database,
    user: dbDetails.username,
    password: dbDetails.password ?? undefined,
    ssl: { rejectUnauthorized: false },
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

const getPool = (key, config) => {
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

const closePool = (key) => {
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
  const pool = getPool(key, toTenantPoolConfig(dbDetails));

  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    return { connected: true, latencyMs: Date.now() - startedAt };
  } catch (err) {
    closePool(key);
    return { connected: false, latencyMs: null, error: err.message };
  }
};
