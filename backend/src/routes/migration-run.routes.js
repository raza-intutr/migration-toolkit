import { Router } from 'express';
import * as migrationRunController from '../controllers/migration-run.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { triggerMigrationSchema } from '../validators/migration-run.validator.js';

const router = Router();

/**
 * @openapi
 * /migrations:
 *   post:
 *     summary: Trigger a pg_dump/pg_restore tenant migration across environments
 *     description: >-
 *       Copies the source tenant's database into the target tenant's database
 *       using pg_dump → pg_restore. Runs asynchronously and is tracked by a
 *       MigrationRun record; poll GET /migrations/:id for status. If the target
 *       already has data and confirm_overwrite is false, the request is
 *       rejected with 409 TARGET_HAS_DATA.
 *     tags: [Migration Runs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [source_env_id, source_tenant_code, target_env_id, target_tenant_code]
 *             properties:
 *               source_env_id: { type: string }
 *               source_tenant_code: { type: string }
 *               target_env_id: { type: string }
 *               target_tenant_code: { type: string }
 *               confirm_overwrite: { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Migration started
 *       400:
 *         description: Validation error or inactive environment
 *       404:
 *         description: Environment or tenant not found
 *       409:
 *         description: Target has data — requires confirm_overwrite
 *   get:
 *     summary: List migration runs
 *     tags: [Migration Runs]
 *     responses:
 *       200:
 *         description: List of runs
 * /migrations/{id}:
 *   get:
 *     summary: Get a migration run status
 *     tags: [Migration Runs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Migration run with status, row counts and error message
 *       404:
 *         description: Run not found
 */
router.post('/', validate(triggerMigrationSchema), asyncHandler(migrationRunController.trigger));
router.get('/', asyncHandler(migrationRunController.list));
router.get('/:id', asyncHandler(migrationRunController.getOne));

export default router;