import { Router } from 'express';
import * as migrationController from '../controllers/migration.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  migrateTenantSchema,
  crossEnvironmentMigrateSchema,
} from '../validators/migration.validator.js';

const router = Router({ mergeParams: true });

/**
 * @openapi
 * /environments/{id}/migrations:
 *   post:
 *     summary: Migrate a tenant database into another tenant (same environment)
 *     description: >-
 *       Copies all user tables from the source tenant's database into the
 *       destination tenant's database. The destination must already have
 *       the schema; this endpoint only moves data. Default behaviour:
 *       TRUNCATE destination tables first, then INSERT with ON CONFLICT
 *       DO NOTHING to skip rows that violate unique constraints.
 *       dryRun defaults to true — only counts + per-table plan are returned.
 *       Set dryRun=false to actually write.
 *     tags: [Migrations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceTenantCode, destinationTenantCode]
 *             properties:
 *               sourceTenantCode:
 *                 type: string
 *               destinationTenantCode:
 *                 type: string
 *               tables:
 *                 type: array
 *                 items: { type: string }
 *                 description: Optional subset of source tables to migrate.
 *               truncateFirst:
 *                 type: boolean
 *                 default: true
 *               onConflictSkip:
 *                 type: boolean
 *                 default: true
 *               dryRun:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Migration complete or dry-run plan returned — per-table row counts included
 *       400:
 *         description: Validation error or destination schema mismatch
 *       404:
 *         description: Environment or tenant not found
 *       502:
 *         description: Unable to reach source/destination database
 */
router.post(
  '/',
  validate(migrateTenantSchema),
  asyncHandler(migrationController.migrate),
);

/**
 * @openapi
 * /migrations/cross-environment:
 *   post:
 *     summary: Migrate a tenant database into another tenant across environments
 *     description: >-
 *       Copies all user tables from a source tenant in sourceEnvironmentId to
 *       a destination tenant in destinationEnvironmentId. When
 *       destinationEnvironmentId is omitted, both tenants are assumed to live
 *       in sourceEnvironmentId. The destination must already have the schema.
 *       dryRun defaults to true — only counts + per-table plan are returned.
 *       Set dryRun=false to actually write.
 *     tags: [Migrations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sourceEnvironmentId, sourceTenantCode, destinationTenantCode]
 *             properties:
 *               sourceEnvironmentId:
 *                 type: string
 *               destinationEnvironmentId:
 *                 type: string
 *               sourceTenantCode:
 *                 type: string
 *               destinationTenantCode:
 *                 type: string
 *               tables:
 *                 type: array
 *                 items: { type: string }
 *               truncateFirst:
 *                 type: boolean
 *                 default: true
 *               onConflictSkip:
 *                 type: boolean
 *                 default: true
 *               dryRun:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Migration complete or dry-run plan returned — per-table row counts included
 *       400:
 *         description: Validation error or destination schema mismatch
 *       404:
 *         description: Environment or tenant not found
 *       502:
 *         description: Unable to reach source/destination database
 */
router.post(
  '/cross-environment',
  validate(crossEnvironmentMigrateSchema),
  asyncHandler(migrationController.migrateCrossEnvironment),
);

export default router;