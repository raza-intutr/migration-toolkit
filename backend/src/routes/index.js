import { Router } from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import environmentRoutes from './environment.routes.js';
import tenantRoutes from './tenant.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import migrationRoutes from './migration.routes.js';

const router = Router();

// Mount all feature routes here. Add new ones as you build new POCs.
router.use('/', healthRoutes);
router.use('/users', userRoutes);
router.use('/environments', environmentRoutes);
router.use('/environments/:id/tenants', tenantRoutes);
router.use('/environments/:id/migrations', migrationRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
