/**
 * Resume Routes - Main Router
 * Aggregates all resume-related route modules
 * 
 * Structure:
 * - crud.routes.js     : GET /, GET /:id, PUT /:id, DELETE /:id, GET /:id/download
 * - upload.routes.js   : POST /extract-doc, POST /extract-pdf
 * - stats.routes.js    : GET /stats, GET /grouped-by-deal
 * - aiModify.handler.js: AI-powered resume modification
 * - versions.routes.js : Version management routes
 * - helpers.js         : Shared utility functions
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, aiModifySchema } from '../../utils/validation.js';

// Import sub-routers
import crudRouter from './crud.routes.js';
import uploadRouter from './upload.routes.js';
import statsRouter from './stats.routes.js';
import versionsRouter from './versions.routes.js';

// Import LLM handlers
import { aiModifyHandler } from './aiModify.handler.js';

const router = express.Router();

// ============================================
// STATISTICS ROUTES (must be before /:id routes)
// ============================================
router.use('/', statsRouter);

// ============================================
// EXTRACTION ROUTES
// ============================================
router.use('/', uploadRouter);

// POST /api/resumes/:id/ai-modify - AI-powered resume modification
router.post('/:id/ai-modify', authenticateToken, validateParams('id'), userRateLimit(), validateBody(aiModifySchema), aiModifyHandler);

// ============================================
// VERSION ROUTES
// ============================================
router.use('/', versionsRouter);

// ============================================
// CRUD ROUTES (must be last due to /:id pattern)
// ============================================
router.use('/', crudRouter);

export default router;
