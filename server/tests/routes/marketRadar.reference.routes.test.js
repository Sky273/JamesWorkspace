/**
 * Tests for Market Radar Reference routes
 * GET /referentiel/:type, GET /categories, GET /config
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock franceTravail service
const mockGetReferentiel = vi.fn();
vi.mock('../../services/franceTravail.service.js', () => ({
    getReferentiel: (...args) => mockGetReferentiel(...args),
    IT_ROME_CODES: ['M1805', 'M1810'],
    FRENCH_REGIONS: [{ code: '11', name: 'Île-de-France' }],
    IT_KEYWORDS: ['développeur', 'devops']
}));

// Mock adzuna service
const mockGetCategories = vi.fn();
vi.mock('../../services/adzuna.service.js', () => ({
    getCategories: (...args) => mockGetCategories(...args),
    IT_KEYWORDS: ['developer', 'engineer']
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import referenceRoutes from '../../routes/marketRadar/reference.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/market-radar', referenceRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Market Radar Reference Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /referentiel/:type', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/market-radar/referentiel/metiers');
            expect(res.status).toBe(401);
        });

        it('should return reference data', async () => {
            mockGetReferentiel.mockResolvedValueOnce([
                { code: 'M1805', libelle: 'Développeur' }
            ]);

            const res = await request(app)
                .get('/api/market-radar/referentiel/metiers')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.type).toBe('metiers');
            expect(res.body.count).toBe(1);
        });

        it('should return 500 on error', async () => {
            mockGetReferentiel.mockRejectedValueOnce(new Error('API fail'));

            const res = await request(app)
                .get('/api/market-radar/referentiel/metiers')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    describe('GET /categories', () => {
        it('should return Adzuna categories', async () => {
            mockGetCategories.mockResolvedValueOnce([
                { tag: 'it-jobs', label: 'IT Jobs' }
            ]);

            const res = await request(app)
                .get('/api/market-radar/categories')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('adzuna');
            expect(res.body.count).toBe(1);
        });

        it('should return 500 on error', async () => {
            mockGetCategories.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/categories')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    describe('GET /config', () => {
        it('should return radar configuration', async () => {
            const res = await request(app)
                .get('/api/market-radar/config')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.config.romeCodes).toEqual(['M1805', 'M1810']);
            expect(res.body.config.regions).toHaveLength(1);
            expect(res.body.config.keywords.franceTravail).toBeDefined();
            expect(res.body.config.keywords.adzuna).toBeDefined();
        });
    });
});
