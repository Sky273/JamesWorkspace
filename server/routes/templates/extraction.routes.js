/**
 * Templates - Extraction Routes
 * Endpoint and helpers for extracting templates from uploaded CV files (DOCX/PDF)
 */

import express from 'express';
import { authenticateToken, requireUserManager } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { createExtractFromCvHandler } from './extraction/handlers.js';
import { upload } from './extraction/extractors.js';

const router = express.Router();
const TEMPLATE_EXTRACTION_MAX_CONCURRENCY = 2;
const activeTemplateExtractionsByUser = new Map();

function templateExtractionConcurrencyLimit(req, res, next) {
    const userId = req.user?.id || 'anonymous';
    const activeCount = activeTemplateExtractionsByUser.get(userId) || 0;

    if (activeCount >= TEMPLATE_EXTRACTION_MAX_CONCURRENCY) {
        return res.status(429).json({
            error: 'Too many template extraction requests in progress. Please wait for an active extraction to finish.'
        });
    }

    activeTemplateExtractionsByUser.set(userId, activeCount + 1);

    const release = () => {
        const currentCount = activeTemplateExtractionsByUser.get(userId) || 0;
        if (currentCount <= 1) {
            activeTemplateExtractionsByUser.delete(userId);
        } else {
            activeTemplateExtractionsByUser.set(userId, currentCount - 1);
        }
        res.removeListener('finish', release);
        res.removeListener('close', release);
    };

    res.on('finish', release);
    res.on('close', release);
    next();
}

router.post(
    '/extract-from-cv',
    authenticateToken,
    requireUserManager,
    userRateLimit(10, 15 * 60 * 1000),
    templateExtractionConcurrencyLimit,
    upload.single('file'),
    createExtractFromCvHandler()
);

export default router;
