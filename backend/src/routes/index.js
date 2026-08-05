import { Router } from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import environmentRoutes from './environment.routes.js';
import tenantRoutes from './tenant.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import migrationRoutes from './migration.routes.js';
import migrationRunRoutes from './migration-run.routes.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as migrationController from '../controllers/migration.controller.js';
import { crossEnvironmentMigrateSchema } from '../validators/migration.validator.js';

const router = Router();

// Mount all feature routes here. Add new ones as you build new POCs.
router.use('/', healthRoutes);
router.use('/users', userRoutes);
router.use('/environments', environmentRoutes);
router.use('/environments/:id/tenants', tenantRoutes);
router.use('/environments/:id/migrations', migrationRoutes);
router.use('/dashboard', dashboardRoutes);

// Top-level cross-environment migration route (chunk-copy). Must be registered
// before the pg_dump/pg_restore run router so /migrations/cross-environment
// wins over /migrations/:id.
router.post(
  '/migrations/cross-environment',
  validate(crossEnvironmentMigrateSchema),
  asyncHandler(migrationController.migrateCrossEnvironment),
);

// Reference-style pg_dump/pg_restore migration runs, tracked by MigrationRun:
// POST /migrations (trigger), GET /migrations (list), GET /migrations/:id (one).
router.use('/migrations', migrationRunRoutes);

export default router;
