import prisma from '../config/db.js';
import { toPoolConfig, getPool, closePool } from './tenant.service.js';

const aggregateTenantStats = async (pool) => {
  const { rows: countRows } = await pool.query(
    'SELECT count(*)::int AS count FROM tenant_connection_info WHERE deleted = false',
  );
  const { rows: typeRows } = await pool.query(
    `SELECT tenant_type, count(*)::int AS count
     FROM tenant_connection_info
     WHERE deleted = false
     GROUP BY tenant_type`,
  );
  const { rows: recentRows } = await pool.query(
    `SELECT id, tenant_code, tenant_name, tenant_type, created_date
     FROM tenant_connection_info
     WHERE deleted = false
     ORDER BY created_date DESC
     LIMIT 5`,
  );

  const byType = typeRows.reduce((acc, row) => ({ ...acc, [row.tenant_type]: row.count }), {});
  return {
    tenantCount: countRows[0]?.count ?? 0,
    b2b: byType.B2B ?? 0,
    b2c: byType.B2C ?? 0,
    recent: recentRows,
  };
};

const inspectEnvironment = async (environment) => {
  const pool = getPool(`env:${environment.id}`, toPoolConfig(environment));
  const startedAt = Date.now();
  try {
    await pool.query('SELECT 1');
    const stats = await aggregateTenantStats(pool);
    return {
      environmentId: environment.id,
      name: environment.name,
      isActive: environment.is_active,
      connected: true,
      latencyMs: Date.now() - startedAt,
      ...stats,
    };
  } catch {
    closePool(`env:${environment.id}`);
    return {
      environmentId: environment.id,
      name: environment.name,
      isActive: environment.is_active,
      connected: false,
      latencyMs: null,
      tenantCount: 0,
      b2b: 0,
      b2c: 0,
      recent: [],
    };
  }
};

export const getDashboard = async () => {
  const environments = await prisma.environment.findMany({ orderBy: { created_at: 'asc' } });

  const results = await Promise.allSettled(environments.map(inspectEnvironment));
  const envStats = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);

  return {
    environments: {
      total: environments.length,
      active: environments.filter((e) => e.is_active).length,
    },
    tenants: {
      total: envStats.reduce((sum, e) => sum + e.tenantCount, 0),
      b2b: envStats.reduce((sum, e) => sum + e.b2b, 0),
      b2c: envStats.reduce((sum, e) => sum + e.b2c, 0),
    },
    health: {
      connected: envStats.filter((e) => e.connected).length,
      unreachable: envStats.filter((e) => !e.connected).length,
    },
    tenantsByEnvironment: envStats.map((e) => ({
      environmentId: e.environmentId,
      name: e.name,
      tenantCount: e.tenantCount,
    })),
    environmentHealth: envStats.map((e) => ({
      environmentId: e.environmentId,
      name: e.name,
      isActive: e.isActive,
      tenantCount: e.tenantCount,
      connected: e.connected,
      latencyMs: e.latencyMs,
    })),
    recentTenants: envStats
      .flatMap((e) =>
        e.recent.map((t) => ({
          id: t.id,
          tenantCode: t.tenant_code,
          tenantName: t.tenant_name,
          tenantType: t.tenant_type,
          createdAt: t.created_date,
          environmentName: e.name,
        })),
      )
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10),
  };
};
