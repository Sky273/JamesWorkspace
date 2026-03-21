/**
 * Tests for Market Radar - Trends routes
 * POST /trends/collect, POST /trends/collect-dynamics,
 * GET /trends/all, GET /trends, GET /trends/summary,
 * GET /trends/:id/metadata, GET /trends/filters,
 * POST /trends/cache/refresh, GET /trends/verify/:type/:regionCode/:codeRome,
 * GET /trends/audit
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock marketTrends service
const mockCollectMarketTrends = vi.fn();
const mockGetStoredTrends = vi.fn();
const mockGetStoredTrendsLight = vi.fn();
const mockGetStoredTrendsGroupedByType = vi.fn();
const mockGetTrendMetadata = vi.fn();
const mockStoreTrend = vi.fn();
const mockGetTrendFilterOptions = vi.fn();
const mockGetTrendsSummary = vi.fn();
const mockInvalidateTrendsCache = vi.fn();
const mockLoadTrendsCache = vi.fn();
const mockGetStatDynamiqueEmploi = vi.fn();
const mockGetTrendsAuditReport = vi.fn();
vi.mock('../../services/marketTrends.service.js', () => ({
    collectMarketTrends: (...args) => mockCollectMarketTrends(...args),
    getStoredTrends: (...args) => mockGetStoredTrends(...args),
    getStoredTrendsLight: (...args) => mockGetStoredTrendsLight(...args),
    getStoredTrendsGroupedByType: (...args) => mockGetStoredTrendsGroupedByType(...args),
    getTrendMetadata: (...args) => mockGetTrendMetadata(...args),
    storeTrend: (...args) => mockStoreTrend(...args),
    getTrendFilterOptions: (...args) => mockGetTrendFilterOptions(...args),
    getTrendsSummary: (...args) => mockGetTrendsSummary(...args),
    invalidateTrendsCache: (...args) => mockInvalidateTrendsCache(...args),
    loadTrendsCache: (...args) => mockLoadTrendsCache(...args),
    getStatDynamiqueEmploi: (...args) => mockGetStatDynamiqueEmploi(...args),
    getTrendsAuditReport: (...args) => mockGetTrendsAuditReport(...args)
}));

// Mock franceTravail service
vi.mock('../../services/franceTravail.service.js', () => ({
    FRENCH_REGIONS: [
        { code: '11', name: 'Île-de-France' },
        { code: '75', name: 'Nouvelle-Aquitaine' }
    ]
}));

// Mock batchJobs service (needed since collection routes now create tracked jobs)
const mockCreateJob = vi.fn();
const mockUpdateJobStatus = vi.fn();
const mockUpdateCollectionJobProgress = vi.fn();
vi.mock('../../services/batchJobs.service.js', () => ({
    createJob: (...args) => mockCreateJob(...args),
    updateJobStatus: (...args) => mockUpdateJobStatus(...args),
    updateCollectionJobProgress: (...args) => mockUpdateCollectionJobProgress(...args),
    JOB_STATUS: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        FAILED: 'failed',
        CANCELLED: 'cancelled'
    }
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

import trendsRoutes from '../../routes/marketRadar/trends.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/market-radar', trendsRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Market Radar - Trends Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateJob.mockResolvedValue({ id: 'job-test-1' });
        mockUpdateJobStatus.mockResolvedValue({});
        mockUpdateCollectionJobProgress.mockResolvedValue({});
        app = createTestApp();
    });

    // ==========================================
    // POST /trends/collect
    // ==========================================
    describe('POST /trends/collect', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/market-radar/trends/collect');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/market-radar/trends/collect')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });

        it('should start collection and return jobId', async () => {
            const res = await request(app)
                .post('/api/market-radar/trends/collect')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.jobId).toBe('job-test-1');
            expect(res.body.message).toContain('background');
            expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
                jobType: 'collect-trends'
            }));
        });
    });

    // ==========================================
    // POST /trends/collect-dynamics
    // ==========================================
    describe('POST /trends/collect-dynamics', () => {
        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/market-radar/trends/collect-dynamics')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });

        it('should start dynamics collection and return jobId', async () => {
            const res = await request(app)
                .post('/api/market-radar/trends/collect-dynamics')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.jobId).toBe('job-test-1');
            expect(res.body.message).toContain('DYN_1');
        });
    });

    // ==========================================
    // GET /trends/all
    // ==========================================
    describe('GET /trends/all', () => {
        it('should return all trends for map view', async () => {
            mockGetStoredTrendsLight.mockResolvedValueOnce({
                trends: [
                    { Type: 'tension', Region: 'IDF', Value: 42 },
                    { Type: 'tension', Region: 'NAQ', Value: 38 },
                    { Type: 'dynamique_emploi', Region: 'IDF', Value: 5.2 }
                ],
                totalCount: 3
            });

            const res = await request(app)
                .get('/api/market-radar/trends/all')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.trends).toHaveLength(3);
            expect(res.body.byType).toBeDefined();
            expect(res.body.byType.tension).toHaveLength(2);
            expect(res.body.byType.dynamique_emploi).toHaveLength(1);
            expect(res.body.totalCount).toBe(3);
        });

        it('should filter by type', async () => {
            mockGetStoredTrendsLight.mockResolvedValueOnce({ trends: [], totalCount: 0 });

            await request(app)
                .get('/api/market-radar/trends/all?type=tension')
                .set(AUTH);

            expect(mockGetStoredTrendsLight).toHaveBeenCalledWith({ type: 'tension' });
        });

        it('should return 500 on error', async () => {
            mockGetStoredTrendsLight.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/market-radar/trends/all')
                .set(AUTH);

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed');
        });
    });

    // ==========================================
    // GET /trends (paginated / grouped)
    // ==========================================
    describe('GET /trends', () => {
        it('should return grouped trends when no type filter', async () => {
            mockGetStoredTrendsGroupedByType.mockResolvedValueOnce({
                groupedTrends: { tension: [{ Value: 1 }] },
                countsByType: { tension: 10 },
                totalCount: 10
            });

            const res = await request(app)
                .get('/api/market-radar/trends')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.grouped).toBe(true);
            expect(res.body.groupedTrends).toBeDefined();
            expect(res.body.countsByType).toBeDefined();
        });

        it('should return paginated trends with type filter', async () => {
            mockGetStoredTrends.mockResolvedValueOnce({
                trends: [{ Value: 42 }],
                totalCount: 1,
                pagination: { page: 1, pageSize: 20, totalPages: 1 }
            });

            const res = await request(app)
                .get('/api/market-radar/trends?type=tension&page=1&pageSize=20')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.grouped).toBe(false);
            expect(res.body.trends).toHaveLength(1);
            expect(res.body.pagination).toBeDefined();
        });

        it('should return 500 on error', async () => {
            mockGetStoredTrendsGroupedByType.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/trends')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /trends/summary
    // ==========================================
    describe('GET /trends/summary', () => {
        it('should return trends summary', async () => {
            mockGetTrendsSummary.mockResolvedValueOnce({
                totalRecords: 500,
                byType: { tension: 300, dynamique_emploi: 200 }
            });

            const res = await request(app)
                .get('/api/market-radar/trends/summary')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.summary.totalRecords).toBe(500);
        });

        it('should return 500 on error', async () => {
            mockGetTrendsSummary.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/trends/summary')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /trends/:id/metadata
    // ==========================================
    describe('GET /trends/:id/metadata', () => {
        it('should return trend metadata', async () => {
            mockGetTrendMetadata.mockResolvedValueOnce({
                id: 'trend-1',
                type: 'tension',
                metadata: { raw: 'data' }
            });

            const res = await request(app)
                .get('/api/market-radar/trends/trend-1/metadata')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.trend.id).toBe('trend-1');
        });

        it('should return 404 if trend not found', async () => {
            mockGetTrendMetadata.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/market-radar/trends/missing/metadata')
                .set(AUTH);

            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it('should return 500 on error', async () => {
            mockGetTrendMetadata.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/trends/trend-1/metadata')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /trends/filters
    // ==========================================
    describe('GET /trends/filters', () => {
        it('should return filter options', async () => {
            mockGetTrendFilterOptions.mockResolvedValueOnce({
                types: ['tension', 'dynamique_emploi'],
                regions: [{ code: '11', name: 'IDF' }],
                romeCodes: [{ code: 'M1805', label: 'Dev' }]
            });

            const res = await request(app)
                .get('/api/market-radar/trends/filters')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.filters.types).toHaveLength(2);
        });

        it('should return 500 on error', async () => {
            mockGetTrendFilterOptions.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/market-radar/trends/filters')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /trends/cache/refresh (admin)
    // ==========================================
    describe('POST /trends/cache/refresh', () => {
        it('should refresh cache as admin', async () => {
            mockLoadTrendsCache.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/market-radar/trends/cache/refresh')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockInvalidateTrendsCache).toHaveBeenCalled();
            expect(mockLoadTrendsCache).toHaveBeenCalled();
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/market-radar/trends/cache/refresh')
                .set({ ...AUTH, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on error', async () => {
            mockLoadTrendsCache.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/market-radar/trends/cache/refresh')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /trends/verify/:type/:regionCode/:codeRome (admin)
    // ==========================================
    describe('GET /trends/verify/:type/:regionCode/:codeRome', () => {
        it('should return verification data', async () => {
            mockGetStoredTrends.mockResolvedValueOnce({
                trends: [{
                    Value: 42,
                    collected_at: '2026-01-15',
                    quarter_period: 'Q1-2026',
                    api_endpoint: '/stat',
                    api_response_hash: 'abc123',
                    previous_value: 40,
                    updated_at: '2026-01-15'
                }]
            });

            const res = await request(app)
                .get('/api/market-radar/trends/verify/tension/11/M1805')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.verification.storedValue).toBe(42);
        });

        it('should return 404 if no stored trend', async () => {
            mockGetStoredTrends.mockResolvedValueOnce({ trends: [] });

            const res = await request(app)
                .get('/api/market-radar/trends/verify/tension/99/UNKNOWN')
                .set(AUTH);

            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/market-radar/trends/verify/tension/11/M1805')
                .set({ ...AUTH, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });
    });

    // ==========================================
    // GET /trends/audit (admin)
    // ==========================================
    describe('GET /trends/audit', () => {
        it('should return audit report', async () => {
            mockGetTrendsAuditReport.mockResolvedValueOnce({
                freshness: [{
                    type: 'tension',
                    total_records: '100',
                    oldest_collection: '2025-06-01',
                    newest_collection: '2026-01-15',
                    fresh_count: '80',
                    recent_count: '15',
                    stale_count: '5',
                    updated_records: '30',
                    avg_change_percent: '12.5'
                }],
                significantChanges: [],
                overall: {
                    total_records: '100',
                    total_types: '3',
                    total_regions: '13',
                    total_rome_codes: '50',
                    oldest_data: '2025-06-01',
                    newest_data: '2026-01-15'
                }
            });

            const res = await request(app)
                .get('/api/market-radar/trends/audit')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.audit.overall).toBeDefined();
            expect(res.body.audit.byType).toHaveLength(1);
            expect(res.body.audit.byType[0].totalRecords).toBe(100);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/market-radar/trends/audit')
                .set({ ...AUTH, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on error', async () => {
            mockGetTrendsAuditReport.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/market-radar/trends/audit')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
