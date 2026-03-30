/**
 * Templates - Extraction Routes
 * Endpoint and helpers for extracting templates from uploaded CV files (DOCX/PDF)
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { createExtractFromCvHandler } from './extraction/handlers.js';
import { upload } from './extraction/extractors.js';

const router = express.Router();

router.post('/extract-from-cv', authenticateToken, requireAdmin, upload.single('file'), createExtractFromCvHandler());

export default router;
