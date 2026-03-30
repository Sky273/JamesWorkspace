/**
 * Market Radar - Market Trends Routes
 * Endpoints for France Travail trends collection, retrieval, cache, audit
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { collectAllTrends, collectDynamicsOnly } from './trendsCollection.handlers.js';
import {
    getAllTrendsForMap,
    getTrendFilters,
    getTrendMetadataHandler,
    getTrends,
    getTrendsAudit,
    getTrendsSummaryHandler,
    refreshTrendsCache,
    verifyTrend
} from './trendsRead.handlers.js';

const router = express.Router();

router.post('/trends/collect', authenticateToken, requireAdmin, collectAllTrends);
router.post('/trends/collect-dynamics', authenticateToken, requireAdmin, collectDynamicsOnly);

router.get('/trends/all', authenticateToken, getAllTrendsForMap);
router.get('/trends', authenticateToken, getTrends);
router.get('/trends/summary', authenticateToken, getTrendsSummaryHandler);
router.get('/trends/:id/metadata', authenticateToken, getTrendMetadataHandler);
router.get('/trends/filters', authenticateToken, getTrendFilters);
router.post('/trends/cache/refresh', authenticateToken, requireAdmin, refreshTrendsCache);
router.get('/trends/verify/:type/:regionCode/:codeRome', authenticateToken, requireAdmin, verifyTrend);
router.get('/trends/audit', authenticateToken, requireAdmin, getTrendsAudit);

export default router;
