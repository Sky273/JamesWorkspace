/**
 * Market Radar - Live Search Routes
 * Direct API calls to France Travail and Adzuna for live job searches
 */

import express from 'express';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { safeLog } from '../../utils/logger.backend.js';
import { searchOffers as searchFranceTravail } from '../../services/franceTravail.service.js';
import {
    searchJobs as searchAdzuna,
    getSalaryHistogram,
    getTopCompanies
} from '../../services/adzuna.service.js';

const router = express.Router();

/**
 * GET /api/market-radar/search/france-travail
 * Live search on France Travail API
 */
router.get('/search/france-travail', authenticateToken, async (req, res) => {
    try {
        const { motsCles, codeROME, departement, region, typeContrat, range } = req.query;

        const results = await searchFranceTravail({
            motsCles,
            codeROME,
            departement,
            region,
            typeContrat,
            range: range || '0-49'
        });

        res.json({
            success: true,
            source: 'france_travail',
            ...results
        });
    } catch (error) {
        safeLog('error', 'Market Radar: France Travail search failed', { error: error.message });
        res.status(500).json({ 
            error: 'Search failed' 
        });
    }
});

/**
 * GET /api/market-radar/search/adzuna
 * Live search on Adzuna API
 */
router.get('/search/adzuna', authenticateToken, async (req, res) => {
    try {
        const { what, where, category, salary_min, salary_max, page } = req.query;

        const results = await searchAdzuna({
            what,
            where,
            category,
            salary_min: salary_min ? parseInt(salary_min) : undefined,
            salary_max: salary_max ? parseInt(salary_max) : undefined,
            page: page ? parseInt(page) : 1,
            results_per_page: 20
        });

        res.json({
            success: true,
            source: 'adzuna',
            ...results
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Adzuna search failed', { error: error.message });
        res.status(500).json({ 
            error: 'Search failed' 
        });
    }
});

/**
 * GET /api/market-radar/salary-histogram
 * Get salary histogram from Adzuna
 */
router.get('/salary-histogram', authenticateToken, async (req, res) => {
    try {
        const { what, where, category } = req.query;

        const data = await getSalaryHistogram({ what, where, category });

        res.json({
            success: true,
            source: 'adzuna',
            ...data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Salary histogram failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get salary data' 
        });
    }
});

/**
 * GET /api/market-radar/top-companies
 * Get top hiring companies from Adzuna
 */
router.get('/top-companies', authenticateToken, async (req, res) => {
    try {
        const { what, where } = req.query;

        const data = await getTopCompanies({ what, where });

        res.json({
            success: true,
            source: 'adzuna',
            ...data
        });
    } catch (error) {
        safeLog('error', 'Market Radar: Top companies failed', { error: error.message });
        res.status(500).json({ 
            error: 'Failed to get company data' 
        });
    }
});

export default router;
