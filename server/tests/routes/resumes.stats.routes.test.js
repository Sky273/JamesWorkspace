/**
 * Tests for Resume Stats routes
 * GET /grouped-by-deal, GET /stats
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock resumeStats service
const mockGetResumesGroupedByDeal = vi.fn();
const mockGetCachedStats = vi.fn();
const mockSetCachedStats = vi.fn();
const mockGetResumeStats = vi.fn();
const mockGetMissionStats = vi.fn();
const mockGetAdaptationStats = vi.fn();
const mockInvalidateStatsCache = vi.fn();
const mockGetStatsCacheStats = vi.fn();

vi.mock('../../services/resumeStats.service.js', () => ({
    getResumesGroupedByDeal: (...args) => mockGetResumesGroupedByDeal(...args),
    getCachedStats: (...args) => mockGetCachedStats(...args),
    setCachedStats: (...args) => mockSetCachedStats(...args),
    getResumeStats: (...args) => mockGetResumeStats(...args),
    getMissionStats: (...args) => mockGetMissionStats(...args),
    getAdaptationStats: (...args) => mockGetAdaptationStats(...args),
    invalidateStatsCache: (...args) => mockInvalidateStatsCache(...args),
    getStatsCacheStats: (...args) => mockGetStatsCacheStats(...args)
}));

// Mock firmHelpers
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: vi.fn().mockResolvedValue('firm-1')
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
                role: req.headers['x-test-role'] || 'user',
                firm: 'Test Firm',
                customer: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import statsRoutes from '../../routes/resumes/stats.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/resumes', statsRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Resume Stats Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        // Default: no cache hit
        mockGetCachedStats.mockReturnValue(null);
    });

    describe('GET /grouped-by-deal', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/resumes/grouped-by-deal');
            expect(res.status).toBe(401);
        });

        it('should return deals with resumes', async () => {
            mockGetResumesGroupedByDeal.mockResolvedValueOnce({
                deals: [{
                    id: 'd-1',
                    title: 'Deal A',
                    status: 'active',
                    client_name: 'Client A',
                    resumes_count: '1',
                    resumes: [{ id: 'r-1', name: 'John', status: 'active' }],
                    missions: []
                }],
                unassigned: [],
                totalDeals: 1,
                totalAssigned: 1,
                totalUnassigned: 0
            });

            const res = await request(app)
                .get('/api/resumes/grouped-by-deal')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.deals).toHaveLength(1);
            expect(res.body.totalDeals).toBe(1);
            expect(res.body.unassigned).toBeDefined();
            expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        });

        it('should return empty deals and unassigned', async () => {
            mockGetResumesGroupedByDeal.mockResolvedValueOnce({
                deals: [],
                unassigned: [{ id: 'r-1', name: 'Orphan' }],
                totalDeals: 0,
                totalAssigned: 0,
                totalUnassigned: 1
            });

            const res = await request(app)
                .get('/api/resumes/grouped-by-deal')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.deals).toHaveLength(0);
            expect(res.body.totalUnassigned).toBe(1);
        });

        it('should return 500 on error', async () => {
            mockGetResumesGroupedByDeal.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/resumes/grouped-by-deal')
                .set(AUTH);

            expect(res.status).toBe(500);
        });

        it('should bypass cache on grouped view when refresh=1 is provided', async () => {
            mockGetResumesGroupedByDeal.mockResolvedValueOnce({
                deals: [],
                unassigned: [],
                totalDeals: 0,
                totalAssigned: 0,
                totalUnassigned: 0
            });

            const res = await request(app)
                .get('/api/resumes/grouped-by-deal?refresh=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(mockGetResumesGroupedByDeal).toHaveBeenCalledWith(expect.objectContaining({ bypassCache: true }));
        });
    });

    describe('GET /stats', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/resumes/stats');
            expect(res.status).toBe(401);
        });

        it('should return dashboard stats', async () => {
            mockGetResumeStats.mockResolvedValueOnce({
                total: '100',
                analyzed: '80',
                improved: '50',
                today: '5',
                this_week: '20',
                this_month: '60',
                avg_original_score: '62.5',
                avg_improved_score: '82.3'
            });
            mockGetMissionStats.mockResolvedValueOnce({ total: '10', active: '5' });
            mockGetAdaptationStats.mockResolvedValueOnce({ total: '30' });

            const res = await request(app)
                .get('/api/resumes/stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.resumes.total).toBe(100);
            expect(res.body.resumes.analyzed).toBe(80);
            expect(res.body.resumes.improved).toBe(50);
            expect(res.body.missions.total).toBe(10);
            expect(res.body.adaptations.total).toBe(30);
            expect(res.body.scores.averageOriginal).toBe(63);
            expect(res.body.scores.averageImproved).toBe(82);
            expect(res.body.scores.improvement).toBe(20);
            expect(mockSetCachedStats).toHaveBeenCalled();
            expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        });

        it('should return cached stats on cache hit', async () => {
            const cachedData = {
                resumes: { total: 50 },
                missions: { total: 5 },
                adaptations: { total: 10 },
                scores: { averageOriginal: 60, averageImproved: 80, improvement: 20 },
                customer: 'Test Firm'
            };
            mockGetCachedStats.mockReturnValueOnce(cachedData);

            const res = await request(app)
                .get('/api/resumes/stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body).toEqual(cachedData);
            // No DB service calls needed due to cache
            expect(mockGetResumeStats).not.toHaveBeenCalled();
            expect(mockGetMissionStats).not.toHaveBeenCalled();
            expect(mockGetAdaptationStats).not.toHaveBeenCalled();
        });

        it('should bypass stats cache when refresh=1 is provided', async () => {
            mockGetCachedStats.mockReturnValueOnce({ resumes: { total: 999 } });
            mockGetResumeStats.mockResolvedValueOnce({
                total: '10',
                analyzed: '5',
                improved: '2',
                today: '1',
                this_week: '2',
                this_month: '3',
                avg_original_score: '50',
                avg_improved_score: '70'
            });
            mockGetMissionStats.mockResolvedValueOnce({ total: '2', active: '1' });
            mockGetAdaptationStats.mockResolvedValueOnce({ total: '4' });

            const res = await request(app)
                .get('/api/resumes/stats?refresh=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(mockGetCachedStats).not.toHaveBeenCalled();
            expect(mockGetResumeStats).toHaveBeenCalled();
        });
    });
});
