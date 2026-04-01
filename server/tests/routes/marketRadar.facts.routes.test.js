/**
 * Tests for Market Radar - Facts routes
 * GET /facts/all, GET /facts/filters, GET /facts/summary,
 * POST /facts/cache/refresh, GET /facts,
 * GET /latest/:type, GET /trend/:keyword, GET /regional
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock marketFacts service
const mockGetFactsByDateRange = vi.fn();
const mockGetLatestFacts = vi.fn();
const mockGetKeywordTrend = vi.fn();
const mockGetRegionalComparison = vi.fn();
const mockInvalidateFactsCache = vi.fn();
const mockLoadFactsCache = vi.fn();
const mockGetFactsFilterOptions = vi.fn();
const mockGetFactsSummary = vi.fn();
vi.mock('../../services/marketFacts.service.js', () => ({
    getFactsByDateRange: (...args) => mockGetFactsByDateRange(...args),
    getLatestFacts: (...args) => mockGetLatestFacts(...args),
    getKeywordTrend: (...args) => mockGetKeywordTrend(...args),
    getRegionalComparison: (...args) => mockGetRegionalComparison(...args),
    invalidateFactsCache: (...args) => mockInvalidateFactsCache(...args),
    loadFactsCache: (...args) => mockLoadFactsCache(...args),
    getFactsFilterOptions: (...args) => mockGetFactsFilterOptions(...args),
    getFactsSummary: (...args) => mockGetFactsSummary(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                role: req.headers['x-test-role'] || 'admin'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role?.toLowerCase() === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import factsRoutes from '../../routes/marketRadar/facts.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/market-radar', factsRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

const sampleFact = {
    id: 'fact-1',
    date: '2026-01-15',
    source: 'france_travail',
    type: 'employment',
    region: 'Île-de-France',
    keyword: 'developer',
    value: 42.5,
    title: 'Employment rate',
    description: 'Description here'
};

describe('Market Radar - Facts Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // GET /facts/all
    // ==========================================
    describe('GET /facts/all', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/market-radar/facts/all');
            expect(res.status).toBe(401);
        });

        it('should return all facts', async () => {
            mockGetFactsByDateRange.mockResolvedValueOnce({
                facts: [sampleFact, { ...sampleFact, id: 'fact-2' }],
                pagination: { totalCount: 2 }
            });

            const res = await request(app)
                .get('/api/market-radar/facts/all')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.facts).toHaveLength(2);
            expect(res.body.totalCount).toBe(2);
            expect(res.body.returnedCount).toBe(2);
            expect(res.body.truncated).toBe(false);
            expect(res.body.duration).toBeDefined();
            expect(mockGetFactsByDateRange).toHaveBeenCalledWith(null, null, {
                page: 1,
                pageSize: 2000
            });
        });

        it('should mark response as truncated when capped', async () => {
            mockGetFactsByDateRange.mockResolvedValueOnce({
                facts: [sampleFact],
                pagination: { totalCount: 2500 }
            });

            const res = await request(app)
                .get('/api/market-radar/facts/all')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.totalCount).toBe(2500);
            expect(res.body.returnedCount).toBe(1);
            expect(res.body.truncated).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockGetFactsByDateRange.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/market-radar/facts/all')
                .set(AUTH);

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed');
        });
    });

    // ==========================================
    // GET /facts/filters
    // ==========================================
    describe('GET /facts/filters', () => {
        it('should return filter options', async () => {
            mockGetFactsFilterOptions.mockResolvedValueOnce({
                sources: ['france_travail', 'insee'],
                types: ['employment', 'salary'],
                regions: ['Île-de-France', 'Nouvelle-Aquitaine']
            });

            const res = await request(app)
                .get('/api/market-radar/facts/filters')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.filters.sources).toHaveLength(2);
            expect(res.body.filters.types).toHaveLength(2);
        });

        it('should return 500 on error', async () => {
            mockGetFactsFilterOptions.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/facts/filters')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /facts/summary
    // ==========================================
    describe('GET /facts/summary', () => {
        it('should return facts summary', async () => {
            mockGetFactsSummary.mockResolvedValueOnce({
                totalFacts: 1000,
                bySource: { france_travail: 600, insee: 400 }
            });

            const res = await request(app)
                .get('/api/market-radar/facts/summary')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.summary.totalFacts).toBe(1000);
        });

        it('should return 500 on error', async () => {
            mockGetFactsSummary.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/facts/summary')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /facts/cache/refresh (admin)
    // ==========================================
    describe('POST /facts/cache/refresh', () => {
        it('should refresh cache as admin', async () => {
            mockLoadFactsCache.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/market-radar/facts/cache/refresh')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('refreshed');
            expect(mockInvalidateFactsCache).toHaveBeenCalled();
            expect(mockLoadFactsCache).toHaveBeenCalled();
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/market-radar/facts/cache/refresh')
                .set({ ...AUTH, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on error', async () => {
            mockLoadFactsCache.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/market-radar/facts/cache/refresh')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /facts (with filters and pagination)
    // ==========================================
    describe('GET /facts', () => {
        it('should return facts with default date range', async () => {
            mockGetFactsByDateRange.mockResolvedValueOnce({
                facts: [sampleFact],
                pagination: { page: 1, pageSize: 20, totalPages: 1 }
            });

            const res = await request(app)
                .get('/api/market-radar/facts')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.facts).toHaveLength(1);
            expect(res.body.dateRange).toBeDefined();
            expect(res.body.pagination).toBeDefined();
        });

        it('should pass filter params to service', async () => {
            mockGetFactsByDateRange.mockResolvedValueOnce({
                facts: [],
                pagination: {}
            });

            await request(app)
                .get('/api/market-radar/facts?startDate=2026-01-01&endDate=2026-01-31&source=insee&type=salary&region=IDF&keyword=dev&romeCode=M1805&page=2&pageSize=10')
                .set(AUTH);

            expect(mockGetFactsByDateRange).toHaveBeenCalledWith(
                '2026-01-01',
                '2026-01-31',
                expect.objectContaining({
                    source: 'insee',
                    type: 'salary',
                    region: 'IDF',
                    keyword: 'dev',
                    romeCode: 'M1805',
                    page: 2,
                    pageSize: 10
                })
            );
        });

        it('should return 500 on error', async () => {
            mockGetFactsByDateRange.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/facts')
                .set(AUTH);

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed');
        });

        it('should return 400 for invalid page', async () => {
            const res = await request(app)
                .get('/api/market-radar/facts?page=-1')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('page');
        });
    });

    // ==========================================
    // GET /latest/:type
    // ==========================================
    describe('GET /latest/:type', () => {
        it('should return latest facts for type', async () => {
            mockGetLatestFacts.mockResolvedValueOnce([sampleFact]);

            const res = await request(app)
                .get('/api/market-radar/latest/employment')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.type).toBe('employment');
            expect(res.body.count).toBe(1);
            expect(mockGetLatestFacts).toHaveBeenCalledWith('employment', undefined);
        });

        it('should pass source filter', async () => {
            mockGetLatestFacts.mockResolvedValueOnce([]);

            await request(app)
                .get('/api/market-radar/latest/salary?source=insee')
                .set(AUTH);

            expect(mockGetLatestFacts).toHaveBeenCalledWith('salary', 'insee');
        });

        it('should return 500 on error', async () => {
            mockGetLatestFacts.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/latest/employment')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /trend/:keyword
    // ==========================================
    describe('GET /trend/:keyword', () => {
        it('should return trend for keyword', async () => {
            mockGetKeywordTrend.mockResolvedValueOnce({
                keyword: 'developer',
                dataPoints: [{ date: '2026-01-15', value: 42 }],
                trend: 'up'
            });

            const res = await request(app)
                .get('/api/market-radar/trend/developer')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.keyword).toBe('developer');
            expect(mockGetKeywordTrend).toHaveBeenCalledWith('developer', 30);
        });

        it('should respect days parameter', async () => {
            mockGetKeywordTrend.mockResolvedValueOnce({ keyword: 'dev', dataPoints: [] });

            await request(app)
                .get('/api/market-radar/trend/dev?days=90')
                .set(AUTH);

            expect(mockGetKeywordTrend).toHaveBeenCalledWith('dev', 90);
        });

        it('should return 500 on error', async () => {
            mockGetKeywordTrend.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/trend/developer')
                .set(AUTH);

            expect(res.status).toBe(500);
        });

        it('should return 400 for invalid days', async () => {
            const res = await request(app)
                .get('/api/market-radar/trend/developer?days=0')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('days');
        });
    });

    // ==========================================
    // GET /regional
    // ==========================================
    describe('GET /regional', () => {
        it('should return regional comparison data', async () => {
            mockGetRegionalComparison.mockResolvedValueOnce([
                { region: 'IDF', value: 42 },
                { region: 'NAQ', value: 38 }
            ]);

            const res = await request(app)
                .get('/api/market-radar/regional')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(2);
            expect(res.body.regions).toHaveLength(2);
        });

        it('should pass date and source params', async () => {
            mockGetRegionalComparison.mockResolvedValueOnce([]);

            await request(app)
                .get('/api/market-radar/regional?date=2026-01-15&source=insee')
                .set(AUTH);

            expect(mockGetRegionalComparison).toHaveBeenCalledWith('2026-01-15', 'insee');
        });

        it('should return 500 on error', async () => {
            mockGetRegionalComparison.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/regional')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
