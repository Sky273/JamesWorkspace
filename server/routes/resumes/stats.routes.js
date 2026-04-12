/**
 * Resume Routes - Statistics & Grouped Views
 * GET /stats, GET /grouped-by-deal
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { getUserFirmId } from '../../utils/firmHelpers.js';
import * as resumeStatsService from '../../services/resumeStats.service.js';

const router = express.Router();
const applyResumeStatsReadHeaders = (_req, res, next) => {
    res.set({
        'Cache-Control': 'private, no-cache, max-age=0, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    });
    next();
};

// Re-export cache functions for external use
export const invalidateStatsCache = resumeStatsService.invalidateStatsCache;
export const getStatsCacheStats = resumeStatsService.getStatsCacheStats;

// GET /api/resumes/grouped-by-deal - Get resumes grouped by deal for the "Par affaire" view
// OPTIMIZED: Uses batch queries instead of N+1 pattern (reduced from ~150 queries to 5)
router.get('/grouped-by-deal', applyResumeStatsReadHeaders, authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = await getUserFirmId(req);
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';
        
        if (!userFirmId && !isAdmin) {
            return res.status(403).json({ error: 'No firm association' });
        }

        const result = await resumeStatsService.getResumesGroupedByDeal({ firmId: userFirmId, isAdmin, bypassCache });
        return res.json(result);
    } catch (error) {
        safeLog('error', 'Error fetching resumes grouped by deal', { error: error.message });
        return res.status(500).json({ error: 'Failed to fetch grouped resumes' });
    }
});

// GET /api/resumes/stats - Get statistics for dashboard KPIs
// OPTIMIZED: Uses 30s cache per firm to reduce DB load
router.get('/stats', applyResumeStatsReadHeaders, authenticateToken, async (req, res) => {
    try {
        const isAdmin = req.user?.role === 'admin';
        const userFirmId = isAdmin ? null : await getUserFirmId(req);
        const bypassCache = req.query.refresh === '1' || req.query.refresh === 'true';

        if (!isAdmin && !userFirmId) {
            return res.status(403).json({ error: 'No firm association' });
        }
        
        // Check cache first
        const cacheKey = isAdmin ? 'admin' : userFirmId;
        const cachedStats = bypassCache ? null : resumeStatsService.getCachedStats(cacheKey);
        if (cachedStats) {
            safeLog('debug', 'Stats cache hit', { cacheKey });
            return res.json(cachedStats);
        }

        // Determine firm filter params (null for admin)
        const firmFilter = isAdmin ? { userFirmId: null } : { userFirmId };

        // Fetch all stats in parallel
        const [resumeStats, missionStats, adaptationStats] = await Promise.all([
            resumeStatsService.getResumeStats(firmFilter),
            resumeStatsService.getMissionStats(firmFilter),
            resumeStatsService.getAdaptationStats(firmFilter)
        ]);

        const avgOriginal = parseFloat(resumeStats.avg_original_score) || 0;
        const avgImproved = parseFloat(resumeStats.avg_improved_score) || 0;
        
        const stats = {
            resumes: {
                total: parseInt(resumeStats.total) || 0,
                analyzed: parseInt(resumeStats.analyzed) || 0,
                improved: parseInt(resumeStats.improved) || 0,
                today: parseInt(resumeStats.today) || 0,
                thisWeek: parseInt(resumeStats.this_week) || 0,
                thisMonth: parseInt(resumeStats.this_month) || 0
            },
            missions: {
                total: parseInt(missionStats.total) || 0,
                active: parseInt(missionStats.active) || 0
            },
            adaptations: {
                total: parseInt(adaptationStats.total) || 0
            },
            scores: {
                averageOriginal: Math.round(avgOriginal),
                averageImproved: Math.round(avgImproved),
                // Improvement is the absolute difference in points (e.g., 62% -> 82% = +20 points)
                improvement: Math.round(avgImproved - avgOriginal)
            },
            firmId: isAdmin ? null : userFirmId
        };

        // Cache the stats
        resumeStatsService.setCachedStats(cacheKey, stats);
        safeLog('debug', 'Stats cached', { cacheKey });

        res.json(stats);
    } catch (error) {
        safeLog('error', 'Error fetching resume stats', { 
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

export default router;
