import prisma from '../config/db.js';
import { AppError } from '../utils/AppError.js';
import { getEnvironmentById } from './environment.service.js';
import { envHasData, resolveTenantConnection } from './tenant.service.js';
import { runMigration } from './migration.executor.js';

const sanitizeEnvironment = (env) => {
  if (!env) return null;
  const { password: _, ...rest } = env;
  return rest;
};

export const sanitizeMigrationRun = (run) => ({
  ...run,
  source_env: run.source_env ? sanitizeEnvironment(run.source_env) : null,
  target_env: run.target_env ? sanitizeEnvironment(run.target_env) : null,
});

export const triggerMigration = async ({
  source_env_id,
  source_tenant_code,
  target_env_id,
  target_tenant_code,
  confirm_overwrite = false,
}) => {
  const sourceEnv = await getEnvironmentById(source_env_id);
  const targetEnv = await getEnvironmentById(target_env_id);

  if (!sourceEnv.is_active) throw new AppError('Source environment is inactive', 400);
  if (!targetEnv.is_active) throw new AppError('Target environment is inactive', 400);

  const sourceConn = await resolveTenantConnection(sourceEnv, source_tenant_code);
  const targetConn = await resolveTenantConnection(targetEnv, target_tenant_code);

  const targetHasData = await envHasData(targetConn);
  if (targetHasData && !confirm_overwrite) {
    const err = new AppError('Target tenant database already contains data', 409);
    err.code = 'TARGET_HAS_DATA';
    throw err;
  }

  const run = await prisma.migrationRun.create({
    data: {
      source_env_id,
      target_env_id,
      source_tenant_code,
      target_tenant_code,
      tenant_schema: targetConn.db,
      overwrite_confirmed: confirm_overwrite,
      status: 'running',
    },
  });

  runMigration(run.id).catch((e) => {
    prisma.migrationRun
      .update({
        where: { id: run.id },
        data: { status: 'failed', error_message: e.message, completed_at: new Date() },
      })
      .catch(() => {});
  });

  return run;
};

export const listMigrations = () =>
  prisma.migrationRun.findMany({
    orderBy: { started_at: 'desc' },
    include: { source_env: true, target_env: true },
  });

export const getMigration = async (id) => {
  const run = await prisma.migrationRun.findUnique({
    where: { id },
    include: { source_env: true, target_env: true },
  });
  if (!run) throw new AppError('Migration run not found', 404);
  return run;
};
