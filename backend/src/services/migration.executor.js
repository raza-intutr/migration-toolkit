import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import prisma from '../config/db.js';
import { logger } from '../utils/logger.js';
import {
  buildPgDumpCommand,
  buildPgRestoreCommand,
  buildPoolConfig,
} from '../utils/tenantConnection.js';
import { resolveTenantConnection } from './tenant.service.js';

const DUMPS_DIR = path.join(process.cwd(), 'dumps');

export const quoteIdent = (name) => `"${String(name).replace(/"/g, '""')}"`;

const runCmd = (bin, { args, env }) =>
  new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      env: { ...process.env, ...env },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (d) => {
      stderr += d;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${bin} failed (exit ${code}): ${stderr}`));
    });
  });

// Deterministically reset the target before an overwrite restore. `pg_restore
// --clean` drops objects without CASCADE, so FK dependencies (e.g. a table
// referenced by another table's FK constraint) make those drops fail
// non-deterministically and leave the target half-cleaned. DROP OWNED BY removes
// every object the connected user owns (tables, constraints, sequences,
// functions, views) with dependency ordering handled by CASCADE, so the
// subsequent restore starts from a guaranteed-empty state. It does not require
// schema ownership, which the tenant user typically lacks.
export const dropTargetSchema = async (conn) => {
  const pool = new Pool(buildPoolConfig(conn));
  try {
    await pool.query('DROP OWNED BY CURRENT_USER CASCADE');
  } finally {
    await pool.end();
  }
};

export const countRows = async (conn) => {
  const pool = new Pool(buildPoolConfig(conn));
  try {
    const { rows } = await pool.query(
      `SELECT schemaname, tablename FROM pg_tables
       WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         AND schemaname NOT LIKE 'pg\\_%' ESCAPE '\\'
       ORDER BY schemaname, tablename`,
    );
    const counts = {};
    for (const t of rows) {
      const q = `${quoteIdent(t.schemaname)}.${quoteIdent(t.tablename)}`;
      const { rows: [{ n }] } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${q}`);
      counts[`${t.schemaname}.${t.tablename}`] = n;
    }
    return counts;
  } finally {
    await pool.end();
  }
};

export const runMigration = async (runId) => {
  try {
    const run = await prisma.migrationRun.findUnique({
      where: { id: runId },
      include: { source_env: true, target_env: true },
    });
    if (!run) throw new Error(`MigrationRun ${runId} not found`);

    const sourceConn = await resolveTenantConnection(run.source_env, run.source_tenant_code);
    const targetConn = await resolveTenantConnection(run.target_env, run.target_tenant_code);

    const dumpPath = path.join(DUMPS_DIR, `${run.id}.dump`);
    fs.mkdirSync(DUMPS_DIR, { recursive: true });

    await prisma.migrationRun.update({
      where: { id: run.id },
      data: { status: 'running', dump_file_path: dumpPath },
    });

    logger.info(`migration.run ${run.id}: dumping source`);
    await runCmd('pg_dump', buildPgDumpCommand(sourceConn, dumpPath));

    if (run.overwrite_confirmed) {
      logger.info(`migration.run ${run.id}: resetting target schema`);
      await dropTargetSchema(targetConn);
    }

    logger.info(`migration.run ${run.id}: restoring to target`);
    await runCmd(
      'pg_restore',
      buildPgRestoreCommand(targetConn, dumpPath, { clean: run.overwrite_confirmed }),
    );

    let row_counts = null;
    try {
      row_counts = await countRows(targetConn);
    } catch (e) {
      logger.warn(`migration.run ${run.id}: row count failed (best-effort): ${e.message}`);
    }

    await prisma.migrationRun.update({
      where: { id: run.id },
      data: { status: 'succeeded', row_counts, completed_at: new Date() },
    });
    logger.info(`migration.run ${run.id}: succeeded`);
  } catch (e) {
    logger.error(`migration.run ${runId} failed`, e);
    await prisma.migrationRun
      .update({
        where: { id: runId },
        data: { status: 'failed', error_message: e.message, completed_at: new Date() },
      })
      .catch(() => {});
  }
};
