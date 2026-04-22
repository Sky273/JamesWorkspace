/**
 * Templates Routes - Main Entry Point
 * Mounts all sub-routers for backward compatibility
 * 
 * Structure:
 * - crud.routes.js       : GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 */

import express from 'express';
import crudRoutes from './crud.routes.js';

const router = express.Router();

router.use('/', crudRoutes);

export default router;
