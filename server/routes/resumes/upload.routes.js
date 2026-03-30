/**
 * Resume Routes - Upload & File Extraction
 * POST /upload, POST /extract-doc, POST /extract-pdf
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { uploadLimiter } from '../../middleware/rateLimit.middleware.js';
import {
    createExtractDocHandler,
    createExtractPdfHandler,
    createUploadResumeHandler
} from './upload/handlers.js';
import {
    uploadDocFile,
    uploadPdfFile,
    uploadResumeFile
} from './upload/helpers.js';

const router = express.Router();

router.post('/extract-doc', authenticateToken, uploadLimiter, uploadDocFile, createExtractDocHandler());
router.post('/extract-pdf', authenticateToken, uploadLimiter, uploadPdfFile, createExtractPdfHandler());
router.post('/upload', authenticateToken, uploadLimiter, uploadResumeFile, createUploadResumeHandler());

export default router;
