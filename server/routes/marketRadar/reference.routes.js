/**
 * Market Radar - Reference Data Routes
 * Endpoints for reference data (ROME codes, regions, categories, config)
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    getReferentiel,
    IT_ROME_CODES,
    FRENCH_REGIONS,
    IT_KEYWORDS as FT_KEYWORDS
} from '../../services/franceTravail.service.js';
import {
    getCategories as getAdzunaCategories,
    IT_KEYWORDS as ADZUNA_KEYWORDS
} from '../../services/adzuna.service.js';

const router = express.Router();

/**
 * GET /api/market-radar/referentiel/:type
 * Get reference data from France Travail
 * Types: metiers, appellations, domaines, etc.
 */
router.get('/referentiel/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const data = await getReferentiel(type);

        res.json({
            success: true,
            type,
            count: data.length,
            data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Referentiel failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get reference data', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/categories
 * Get job categories from Adzuna
 */
router.get('/categories', authenticateToken, async (req, res) => {
    try {
        const categories = await getAdzunaCategories();

        res.json({
            success: true,
            source: 'adzuna',
            count: categories.length,
            categories
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Categories failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get categories', 
            message: error.message 
        });
    }
});

/**
 * GET /api/market-radar/config
 * Get radar configuration (ROME codes, regions, keywords)
 */
router.get('/config', authenticateToken, async (req, res) => {
    res.json({
        success: true,
        config: {
            romeCodes: IT_ROME_CODES,
            regions: FRENCH_REGIONS,
            keywords: {
                franceTravail: FT_KEYWORDS,
                adzuna: ADZUNA_KEYWORDS
            }
        }
    });
});

export default router;
