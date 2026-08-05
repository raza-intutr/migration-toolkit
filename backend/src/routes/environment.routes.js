import { Router } from 'express';
import * as environmentController from '../controllers/environment.controller.js';
import * as tenantController from '../controllers/tenant.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  createEnvironmentSchema,
  testEnvironmentConnectionSchema,
  updateEnvironmentSchema,
} from '../validators/environment.validator.js';

const router = Router();

/**
 * @openapi
 * /environments:
 *   post:
 *     summary: Create a new environment
 *     tags: [Environments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, host, db, user]
 *             properties:
 *               name:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *                 default: 5432
 *               db:
 *                 type: string
 *               user:
 *                 type: string
 *               password:
 *                 type: string
 *               ssl_mode:
 *                 type: string
 *                 default: require
 *               is_active:
 *                 type: boolean
 *                 default: true
 *               ismultitenant:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       201:
 *         description: Environment created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       409:
 *         description: Environment name already in use
 */
router.post('/', validate(createEnvironmentSchema), asyncHandler(environmentController.create));

/**
 * @openapi
 * /environments/test-connection:
 *   post:
 *     summary: Test a connection without saving the environment
 *     description: >-
 *       Probes a candidate environment connection (host, port, db, user,
 *       password, ssl_mode) with SELECT 1 without persisting a record. Used to
 *       validate credentials before creating an environment.
 *     tags: [Environments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [host, db, user]
 *             properties:
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *                 default: 5432
 *               db:
 *                 type: string
 *               user:
 *                 type: string
 *               password:
 *                 type: string
 *               ssl_mode:
 *                 type: string
 *                 default: require
 *     responses:
 *       200:
 *         description: Connection test result
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.post(
  '/test-connection',
  validate(testEnvironmentConnectionSchema),
  asyncHandler(tenantController.testConnectionCredentials),
);

/**
 * @openapi
 * /environments:
 *   get:
 *     summary: List all environments
 *     tags: [Environments]
 *     responses:
 *       200:
 *         description: List of environments
 *       401:
 *         description: Not authenticated
 */
router.get('/', asyncHandler(environmentController.getAll));

/**
 * @openapi
 * /environments/health:
 *   get:
 *     summary: Connection health for all environments
 *     description: >-
 *       Probes each environment database (SELECT 1) and returns its connection
 *       status and latency. Used by the status column on the environments page.
 *       Unreachable environments are reported with connected=false rather than
 *       failing the request.
 *     tags: [Environments]
 *     responses:
 *       200:
 *         description: Per-environment connection status
 *       401:
 *         description: Not authenticated
 */
router.get('/health', asyncHandler(tenantController.getEnvironmentHealth));

/**
 * @openapi
 * /environments/{id}:
 *   get:
 *     summary: Get an environment by id
 *     tags: [Environments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Environment data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 */
router.get('/:id', asyncHandler(environmentController.getById));

/**
 * @openapi
 * /environments/{id}/tables:
 *   get:
 *     summary: List tables in the environment database
 *     description: >-
 *       Connects to the environment's own database and returns its user tables
 *       (excluding Postgres system schemas) with an estimated row count.
 *     tags: [Environments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tables in the environment database
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 *       502:
 *         description: Unable to query environment database
 */
router.get('/:id/tables', asyncHandler(tenantController.listTables));

/**
 * @openapi
 * /environments/{id}/test-connection:
 *   get:
 *     summary: Test the environment database connection
 *     description: >-
 *       Runs SELECT 1 against the environment's own database and reports whether it
 *       is reachable. Always returns HTTP 200; the connected flag in the response
 *       indicates success or failure.
 *     tags: [Environments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection test result
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 */
router.get('/:id/test-connection', asyncHandler(tenantController.testConnection));

/**
 * @openapi
 * /environments/{id}:
 *   patch:
 *     summary: Update an environment
 *     tags: [Environments]
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
 *             properties:
 *               name:
 *                 type: string
 *               host:
 *                 type: string
 *               port:
 *                 type: integer
 *               db:
 *                 type: string
 *               user:
 *                 type: string
 *               password:
 *                 type: string
 *               ssl_mode:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *               ismultitenant:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Environment updated
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 *       409:
 *         description: Environment name already in use
 */
router.patch('/:id', validate(updateEnvironmentSchema), asyncHandler(environmentController.update));

/**
 * @openapi
 * /environments/{id}:
 *   delete:
 *     summary: Delete an environment
 *     tags: [Environments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Environment deleted
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 */
router.delete('/:id', asyncHandler(environmentController.remove));

export default router;
