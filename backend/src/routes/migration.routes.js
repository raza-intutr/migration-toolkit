import { Router } from 'express';
import * as migrationController from '../controllers/migration.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { migrateTenantSchema } from '../validators/migration.validator.js';

const router = Router({ mergeParams: true });

/**
 * @openapi
 * /environments/{id}/migrations:
 *   post:
 *     summary: Migrate a tenant database into another tenant
 *     description: >-
 *       Copies all user tables from the source tenant's database into the
 *       destination tenant's database. The destination must already have
 *       the schema; this endpoint only moves data. Default behaviour:
 *       TRUNCATE destination tables first, then INSERT with ON CONFLICT
 *       DO NOTHING to skip rows that violate unique constraints.
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
 *     responses:
 *       200:
 *         description: Migration complete — per-table row counts returned
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

export default router;
