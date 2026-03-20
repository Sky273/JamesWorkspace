/**
 * Resume Routes - Main Router
 * Aggregates all resume-related route modules
 * 
 * Structure:
 * - crud.routes.js     : GET /, GET /:id, PUT /:id, DELETE /:id, GET /:id/download
 * - upload.routes.js   : POST /upload, POST /extract-doc, POST /extract-pdf
 * - stats.routes.js    : GET /stats, GET /grouped-by-deal
 * - llm.handlers.js    : analyze, improve, match, adapt handlers
 * - aiModify.handler.js: AI-powered resume modification
 * - versions.routes.js : Version management routes
 * - helpers.js         : Shared utility functions
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, analyzeTextSchema, improveTextSchema, missionIdBodySchema, aiModifySchema } from '../../utils/validation.js';

// Import sub-routers
import crudRouter from './crud.routes.js';
import uploadRouter from './upload.routes.js';
import statsRouter from './stats.routes.js';
import versionsRouter from './versions.routes.js';

// Import LLM handlers
import { analyzeHandler, analyzeTextHandler, improveHandler, improveByIdHandler, matchHandler, adaptHandler } from './llm.handlers.js';
import { aiModifyHandler } from './aiModify.handler.js';

const router = express.Router();

// ============================================
// STATISTICS ROUTES (must be before /:id routes)
// ============================================
router.use('/', statsRouter);

// ============================================
// UPLOAD & EXTRACTION ROUTES
// ============================================
router.use('/', uploadRouter);

// ============================================
// LLM ROUTES (delegated to handlers)
// ============================================

// POST /api/resumes/analyze - Analyze resume text
router.post('/analyze', authenticateToken, userRateLimit(), analyzeHandler);

// POST /api/resumes/analyze-text - Analyze raw text
router.post('/analyze-text', authenticateToken, userRateLimit(), validateBody(analyzeTextSchema), analyzeTextHandler);

// POST /api/resumes/improve - Improve resume text
router.post('/improve', authenticateToken, userRateLimit(), validateBody(improveTextSchema), improveHandler);

// POST /api/resumes/:id/improve - Improve resume by ID
router.post('/:id/improve', authenticateToken, validateParams('id'), userRateLimit(), improveByIdHandler);

// POST /api/resumes/:id/match - Match resume with mission
router.post('/:id/match', authenticateToken, validateParams('id'), userRateLimit(), validateBody(missionIdBodySchema), matchHandler);

// POST /api/resumes/:id/adapt - Adapt resume for mission
router.post('/:id/adapt', authenticateToken, validateParams('id'), userRateLimit(), validateBody(missionIdBodySchema), adaptHandler);

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
