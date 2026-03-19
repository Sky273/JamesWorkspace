/**
 * Market Radar - Data Collection Routes
 * Admin-only endpoints for triggering data collection
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    runFullCollection,
    runSourceCollection,
    invalidateFactsCache
} from '../../services/marketFacts.service.js';

const router = express.Router();

/**
 * POST /api/market-radar/collect
 * Run full data collection from all sources
 * Admin only - this is a heavy operation
 */
router.post('/collect', authenticateToken, requireAdmin, async (req, res) => {
    try {
        safeLog('info', 'Market Radar: Full collection triggered', { 
            userId: req.user.id 
        });

        const options = req.body.options || {};
        const summary = await runFullCollection(options);

        // Invalidate facts cache after collection
        invalidateFactsCache();
        safeLog('info', 'Market Radar: Facts cache invalidated after collection');

        res.json({
            success: true,
            message: 'Data collection completed',
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Collection failed', { error: error.message });
        res.status(500).json({ 
            error: 'Collection failed' 
        });
    }
});

/**
 * POST /api/market-radar/collect/:source
 * Run data collection for a specific source
 * @param source - 'france_travail' or 'adzuna'
 */
router.post('/collect/:source', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { source } = req.params;
        
        if (!['france_travail', 'adzuna'].includes(source)) {
            return res.status(400).json({ 
                error: 'Invalid source',
                message: 'Source must be "france_travail" or "adzuna"'
            });
        }

        safeLog('info', `Market Radar: ${source} collection triggered`, { 
            userId: req.user.id 
        });

        const options = req.body.options || {};
        const summary = await runSourceCollection(source, options);

        // Invalidate facts cache after collection
        invalidateFactsCache();
        safeLog('info', 'Market Radar: Facts cache invalidated after source collection');

        res.json({
            success: true,
            message: `${source} collection completed`,
            summary
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Source collection failed', { 
            source: req.params.source,
            error: error.message 
        });
        res.status(500).json({ 
            error: 'Collection failed' 
        });
    }
});

export default router;
