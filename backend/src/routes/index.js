import { Router } from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import environmentRoutes from './environment.routes.js';

const router = Router();

// Mount all feature routes here. Add new ones as you build new POCs.
router.use('/', healthRoutes);
router.use('/users', userRoutes);
router.use('/environments', environmentRoutes);

export default router;
