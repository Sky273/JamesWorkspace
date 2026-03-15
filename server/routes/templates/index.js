/**
 * Templates Routes - Main Entry Point
 * Mounts all sub-routers for backward compatibility
 * 
 * Structure:
 * - crud.routes.js       : GET /, GET /:id, POST /, PUT /:id, DELETE /:id
 * - extraction.routes.js : POST /extract-from-cv (DOCX/PDF template extraction)
 */

import express from 'express';
import crudRoutes from './crud.routes.js';
import extractionRoutes from './extraction.routes.js';

const router = express.Router();

// Mount extraction routes first (more specific paths before /:id catch-all)
router.use('/', extractionRoutes);
router.use('/', crudRoutes);

export default router;
