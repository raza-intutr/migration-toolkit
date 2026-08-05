import { Router } from 'express';
import * as tenantController from '../controllers/tenant.controller.js';
import * as migrationController from '../controllers/migration.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { truncateTenantSchema } from '../validators/migration.validator.js';

// mergeParams exposes the parent :id (environment id) via req.params.id
const router = Router({ mergeParams: true });

/**
 * @openapi
 * /environments/{id}/tenants:
 *   get:
 *     summary: List tenants for an environment
 *     description: >-
 *       Connects to the environment's own database and returns the rows from its
 *       tenant_connection_info table where deleted = false. The db_details.password
 *       field is redacted from every row.
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tenants from the environment database
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment not found
 *       502:
 *         description: Unable to query environment database
 */
router.get('/', asyncHandler(tenantController.getTenants));

/**
 * @openapi
 * /environments/{id}/tenants/{tenantCode}:
 *   get:
 *     summary: Get a tenant by tenant code
 *     description: >-
 *       Connects to the environment's own database and returns the tenant_connection_info
 *       row matching the given tenant code. The db_details.password field is redacted.
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tenantCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Tenant data
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment or tenant not found
 *       502:
 *         description: Unable to query environment database
 */
router.get('/:tenantCode', asyncHandler(tenantController.getTenantByCode));

/**
 * @openapi
 * /environments/{id}/tenants/{tenantCode}/tables:
 *   get:
 *     summary: List tables in a tenant database
 *     description: >-
 *       Connects to the tenant's own database (from its db_details.url) and
 *       returns its user tables (excluding Postgres system schemas) with an
 *       estimated row count.
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tenantCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of tables in the tenant database
 *       400:
 *         description: Tenant has no db_details.url configured
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Environment or tenant not found
 *       502:
 *         description: Unable to query tenant database
 */
router.get('/:tenantCode/tables', asyncHandler(tenantController.listTenantTables));

/**
 * @openapi
 * /environments/{id}/tenants/{tenantCode}/test-connection:
 *   get:
 *     summary: Test a tenant database connection
 *     description: >-
 *       Connects to the tenant's own database (from its db_details.url) and reports
 *       whether it is reachable. Always returns HTTP 200; the connected flag in the
 *       response indicates success or failure.
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tenantCode
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Connection test result
 *       400:
 *         description: Tenant has no db_details.url configured
 *       404:
 *         description: Environment or tenant not found
 */
router.get('/:tenantCode/test-connection', asyncHandler(tenantController.testTenantConnection));

/**
 * @openapi
 * /environments/{id}/tenants/{tenantCode}/truncate:
 *   post:
 *     summary: Truncate every user table in a tenant
 *     description: >-
 *       TRUNCATE all user tables (optionally scoped via `tables`) inside the
 *       tenant's database. Schema is preserved — only the rows are removed.
 *       Uses TRUNCATE ... RESTART IDENTITY CASCADE so FK ordering is a
 *       non-issue. Destructive: there is no dry-run for this endpoint.
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: tenantCode
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tables:
 *                 type: array
 *                 items: { type: string }
 *                 description: Optional subset of tables to truncate. Omit to clear every user table.
 *     responses:
 *       200:
 *         description: Truncate complete — list of affected tables returned
 *       400:
 *         description: No tables found to truncate
 *       404:
 *         description: Environment or tenant not found
 *       502:
 *         description: Unable to reach tenant database
 */
router.post(
  '/:tenantCode/truncate',
  validate(truncateTenantSchema),
  asyncHandler(migrationController.truncate),
);

export default router;
