// Central router that combines all route modules
import express from 'express';
import healthRoutes from './health.routes.js';

const router = express.Router();

// Mount health check routes
router.use('/health', healthRoutes);

// Note: Other routes will be added as we extract them
// This file will be updated incrementally

export default router;
