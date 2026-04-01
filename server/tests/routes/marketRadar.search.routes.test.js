/**
 * Tests for Market Radar Search routes
 * GET /search/france-travail, GET /search/adzuna,
 * GET /salary-histogram, GET /top-companies
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock franceTravail service
const mockSearchFranceTravail = vi.fn();
vi.mock('../../services/franceTravail.service.js', () => ({
    searchOffers: (...args) => mockSearchFranceTravail(...args)
}));

// Mock adzuna service
const mockSearchAdzuna = vi.fn();
const mockGetSalaryHistogram = vi.fn();
const mockGetTopCompanies = vi.fn();
vi.mock('../../services/adzuna.service.js', () => ({
    searchJobs: (...args) => mockSearchAdzuna(...args),
    getSalaryHistogram: (...args) => mockGetSalaryHistogram(...args),
    getTopCompanies: (...args) => mockGetTopCompanies(...args)
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

import searchRoutes from '../../routes/marketRadar/search.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/market-radar', searchRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Market Radar Search Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /search/france-travail', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/market-radar/search/france-travail');
            expect(res.status).toBe(401);
        });

        it('should return search results', async () => {
            mockSearchFranceTravail.mockResolvedValueOnce({
                resultats: [{ id: '1', intitule: 'Dev Java' }],
                contentRange: { total: 100 }
            });

            const res = await request(app)
                .get('/api/market-radar/search/france-travail?motsCles=java')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('france_travail');
        });

        it('should pass query params to service', async () => {
            mockSearchFranceTravail.mockResolvedValueOnce({ resultats: [] });

            await request(app)
                .get('/api/market-radar/search/france-travail?motsCles=java&codeROME=M1805&region=11')
                .set(AUTH);

            expect(mockSearchFranceTravail).toHaveBeenCalledWith(expect.objectContaining({
                motsCles: 'java',
                codeROME: 'M1805',
                region: '11',
                range: '0-49'
            }));
        });

        it('should return 500 on error', async () => {
            mockSearchFranceTravail.mockRejectedValueOnce(new Error('API fail'));

            const res = await request(app)
                .get('/api/market-radar/search/france-travail?motsCles=java')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    describe('GET /search/adzuna', () => {
        it('should return search results', async () => {
            mockSearchAdzuna.mockResolvedValueOnce({
                results: [{ id: '1', title: 'Java Developer' }],
                count: 50
            });

            const res = await request(app)
                .get('/api/market-radar/search/adzuna?what=java')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('adzuna');
        });

        it('should parse salary params as integers', async () => {
            mockSearchAdzuna.mockResolvedValueOnce({ results: [] });

            await request(app)
                .get('/api/market-radar/search/adzuna?what=java&salary_min=30000&salary_max=60000&page=2')
                .set(AUTH);

            expect(mockSearchAdzuna).toHaveBeenCalledWith(expect.objectContaining({
                salary_min: 30000,
                salary_max: 60000,
                page: 2,
                results_per_page: 20
            }));
        });

        it('should return 500 on error', async () => {
            mockSearchAdzuna.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/search/adzuna?what=java')
                .set(AUTH);

            expect(res.status).toBe(500);
        });

        it('should return 400 for invalid page', async () => {
            const res = await request(app)
                .get('/api/market-radar/search/adzuna?page=-1')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('page');
        });

        it('should return 400 for invalid salary_min', async () => {
            const res = await request(app)
                .get('/api/market-radar/search/adzuna?salary_min=0')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('salary_min');
        });
    });

    describe('GET /salary-histogram', () => {
        it('should return salary histogram', async () => {
            mockGetSalaryHistogram.mockResolvedValueOnce({
                histogram: { '20000': 50, '30000': 100 }
            });

            const res = await request(app)
                .get('/api/market-radar/salary-histogram?what=developer')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('adzuna');
        });

        it('should return 500 on error', async () => {
            mockGetSalaryHistogram.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/salary-histogram?what=dev')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    describe('GET /top-companies', () => {
        it('should return top companies', async () => {
            mockGetTopCompanies.mockResolvedValueOnce({
                leaderboard: [{ canonical_name: 'Acme', count: 50 }]
            });

            const res = await request(app)
                .get('/api/market-radar/top-companies?what=developer')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.source).toBe('adzuna');
        });

        it('should return 500 on error', async () => {
            mockGetTopCompanies.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/top-companies?what=dev')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
