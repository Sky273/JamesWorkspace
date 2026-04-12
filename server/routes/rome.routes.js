/**
 * Rome 4.0 API Routes
 * Endpoints for métiers and compétences management
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { sanitizeErrorMessage } from '../utils/errors.js';
import { shouldBypassCache } from '../utils/requestCacheControl.js';
import { createJob, updateJobStatus, updateCollectionJobProgress, JOB_STATUS } from '../services/batchJobs.service.js';
import {
    getMetiers,
    getMetierByCode,
    getCompetencesByMetier,
    getGrandsDomaines,
    getDomaines,
    searchMetiers,
    getITMetiers,
    collectITMetiers,
    getStoredMetiers,
    getMetiersStats
} from '../services/rome.service.js';

const router = express.Router();

function parsePositiveInteger(value, { field, maxValue = null } = {}) {
    if (value === undefined) {
        return undefined;
    }

    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        throw new Error(`${field} must be a positive integer`);
    }

    return maxValue ? Math.min(parsedValue, maxValue) : parsedValue;
}

// ============================================
// PUBLIC ENDPOINTS (authenticated)
// ============================================

/**
 * GET /api/rome/metiers
 * Get stored métiers from PostgreSQL
 * Query params: codeRome, grandDomaine, search, page, pageSize, includeDetails
 */
router.get('/metiers', authenticateToken, async (req, res) => {
    try {
        const { codeRome, grandDomaine, search, page, pageSize, includeDetails } = req.query;
        const bypassCache = shouldBypassCache(req);
        const parsedPage = parsePositiveInteger(page, { field: 'page' });
        const parsedPageSize = parsePositiveInteger(pageSize, { field: 'pageSize', maxValue: 100 });
        const result = await getStoredMetiers({
            codeRome,
            grandDomaine,
            search,
            page: parsedPage,
            pageSize: parsedPageSize,
            includeDetails: includeDetails === 'true' || includeDetails === true,
            bypassCache
        });

        if (Array.isArray(result)) {
            return res.json({
                success: true,
                count: result.length,
                data: result
            });
        }

        return res.json({
            success: true,
            count: result.metiers.length,
            totalCount: result.totalCount,
            pagination: result.pagination,
            data: result.metiers
        });
    } catch (error) {
        if (error.message?.includes('must be a positive integer')) {
            return res.status(400).json({
                success: false,
                error: error.message
            });
        }

        safeLog('error', 'Rome route: Failed to get métiers', { error: error.message });
        return res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch métiers')
        });
    }
});

/**
 * GET /api/rome/metiers/stats
 * Get global statistics for métiers (total count, total competences, last update)
 */
router.get('/metiers/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await getMetiersStats();
        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get métiers stats', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch métiers statistics')
        });
    }
});

/**
 * GET /api/rome/metiers/:codeRome
 * Get a specific métier by code ROME
 */
router.get('/metiers/:codeRome', authenticateToken, async (req, res) => {
    try {
        const { codeRome } = req.params;
        const metiers = await getStoredMetiers({ codeRome });

        if (metiers.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Métier not found'
            });
        }

        return res.json({
            success: true,
            data: metiers[0]
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get métier', { error: error.message });
        return res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch métier details')
        });
    }
});

// ============================================
// API PROXY ENDPOINTS (for direct API queries)
// ============================================

/**
 * GET /api/rome/api/grands-domaines
 * Get grands domaines from Rome API
 */
router.get('/api/grands-domaines', authenticateToken, async (req, res) => {
    try {
        const grandsDomaines = await getGrandsDomaines();
        res.json({
            success: true,
            count: grandsDomaines.length,
            data: grandsDomaines
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get grands domaines', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch grands domaines')
        });
    }
});

/**
 * GET /api/rome/api/domaines
 * Get domaines professionnels from Rome API
 */
router.get('/api/domaines', authenticateToken, async (req, res) => {
    try {
        const { codeGrandDomaine } = req.query;
        const domaines = await getDomaines(codeGrandDomaine);
        res.json({
            success: true,
            count: domaines.length,
            data: domaines
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get domaines', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch domaines')
        });
    }
});

/**
 * GET /api/rome/api/metiers
 * Get métiers from Rome API (live query)
 */
router.get('/api/metiers', authenticateToken, async (req, res) => {
    try {
        const metiers = await getMetiers();
        res.json({
            success: true,
            count: metiers.length,
            data: metiers
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get API métiers', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch métiers from API')
        });
    }
});

/**
 * GET /api/rome/api/metiers/it
 * Get IT métiers from Rome API (live query)
 */
router.get('/api/metiers/it', authenticateToken, async (req, res) => {
    try {
        const metiers = await getITMetiers();
        res.json({
            success: true,
            count: metiers.length,
            data: metiers
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get IT métiers', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch IT métiers')
        });
    }
});

/**
 * GET /api/rome/api/metiers/:codeRome
 * Get métier details from Rome API (live query)
 */
router.get('/api/metiers/:codeRome', authenticateToken, async (req, res) => {
    try {
        const { codeRome } = req.params;
        const metier = await getMetierByCode(codeRome);
        res.json({
            success: true,
            data: metier
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get API métier', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch métier from API')
        });
    }
});

/**
 * GET /api/rome/api/metiers/:codeRome/competences
 * Get compétences for a métier from Rome API
 */
router.get('/api/metiers/:codeRome/competences', authenticateToken, async (req, res) => {
    try {
        const { codeRome } = req.params;
        const competences = await getCompetencesByMetier(codeRome);
        res.json({
            success: true,
            count: competences.length,
            data: competences
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to get compétences', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to fetch compétences')
        });
    }
});

/**
 * GET /api/rome/api/search
 * Search métiers by keyword
 */
router.get('/api/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query (q) is required'
            });
        }

        const metiers = await searchMetiers(q);
        return res.json({
            success: true,
            count: metiers.length,
            data: metiers
        });
    } catch (error) {
        safeLog('error', 'Rome route: Search failed', { error: error.message });
        return res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Search failed')
        });
    }
});

// ============================================
// ADMIN ENDPOINTS
// ============================================

/**
 * POST /api/rome/collect
 * Collect IT métiers and store in PostgreSQL (admin only)
 */
router.post('/collect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Rome: IT métiers collection triggered (background)', {
            userId: req.user.id
        });

        const job = await createJob({
            firmId: null,
            userId: req.user.id,
            jobType: 'collect-metiers',
            options: { source: 'rome_api' }
        });
        await updateJobStatus(job.id, JOB_STATUS.PROCESSING);

        res.json({
            success: true,
            message: 'IT métiers collection started in background',
            jobId: job.id
        });

        setImmediate(async () => {
            try {
                const summary = await collectITMetiers({
                    onProgress: async (progress) => {
                        await updateCollectionJobProgress(job.id, {
                            total_items: progress.total || 0,
                            processed_items: (progress.created || 0) + (progress.updated || 0) + (progress.failed || 0),
                            success_count: (progress.created || 0) + (progress.updated || 0),
                            error_count: progress.failed || 0
                        });
                    }
                });

                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);
                safeLog('info', 'Rome: IT métiers collection completed', { jobId: job.id, summary });
            } catch (error) {
                safeLog('error', 'Rome: IT métiers collection failed', { error: error.message });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
            }
        });
    } catch (error) {
        safeLog('error', 'Rome route: Failed to start collection', { error: error.message });
        res.status(500).json({
            success: false,
            error: sanitizeErrorMessage(error, 'Failed to start collection')
        });
    }
});

export default router;
