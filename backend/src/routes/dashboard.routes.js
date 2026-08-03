import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

/**
 * @openapi
 * /dashboard:
 *   get:
 *     summary: Aggregate dashboard metrics
 *     description: >-
 *       Aggregates environment and tenant metrics across all environments. For each
 *       environment it probes the database connection (SELECT 1) and queries its
 *       tenant_connection_info table for counts and recent tenants. Unreachable
 *       environments are reported in health.unreachable rather than failing the request.
 *     tags: [Dashboard]
 *     responses:
 *       200:
 *         description: Dashboard metrics
 *       401:
 *         description: Not authenticated
 */
router.get('/', asyncHandler(dashboardController.getDashboard));

export default router;
