/**
 * Tests for Rome routes
 * GET /metiers, GET /metiers/stats, GET /metiers/:codeRome,
 * GET /api/grands-domaines, GET /api/domaines, GET /api/metiers,
 * GET /api/metiers/it, GET /api/metiers/:codeRome,
 * GET /api/metiers/:codeRome/competences, GET /api/search,
 * POST /collect
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock rome service
const mockGetStoredMetiers = vi.fn();
const mockGetMetiersStats = vi.fn();
const mockGetMetiers = vi.fn();
const mockGetMetierByCode = vi.fn();
const mockGetCompetencesByMetier = vi.fn();
const mockGetGrandsDomaines = vi.fn();
const mockGetDomaines = vi.fn();
const mockSearchMetiers = vi.fn();
const mockGetITMetiers = vi.fn();
const mockCollectITMetiers = vi.fn();
vi.mock('../../services/rome.service.js', () => ({
    getStoredMetiers: (...args) => mockGetStoredMetiers(...args),
    getMetiersStats: (...args) => mockGetMetiersStats(...args),
    getMetiers: (...args) => mockGetMetiers(...args),
    getMetierByCode: (...args) => mockGetMetierByCode(...args),
    getCompetencesByMetier: (...args) => mockGetCompetencesByMetier(...args),
    getGrandsDomaines: (...args) => mockGetGrandsDomaines(...args),
    getDomaines: (...args) => mockGetDomaines(...args),
    searchMetiers: (...args) => mockSearchMetiers(...args),
    getITMetiers: (...args) => mockGetITMetiers(...args),
    collectITMetiers: (...args) => mockCollectITMetiers(...args)
}));

// Mock batchJobs service (needed since collection route now creates tracked jobs)
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

// Mock errors
vi.mock('../../utils/errors.js', () => ({
    sanitizeErrorMessage: (err, fallback) => fallback
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                role: req.headers['x-test-role'] || 'user'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Admin access required' });
    }
}));

import romeRoutes from '../../routes/rome.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/rome', romeRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Rome Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateJob.mockResolvedValue({ id: 'job-test-1' });
        mockUpdateJobStatus.mockResolvedValue({});
        mockUpdateCollectionJobProgress.mockResolvedValue({});
        app = createTestApp();
    });

    describe('GET /metiers', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/rome/metiers');
            expect(res.status).toBe(401);
        });

        it('should return array result', async () => {
            mockGetStoredMetiers.mockResolvedValueOnce([
                { code_rome: 'M1805', libelle: 'Développeur' }
            ]);

            const res = await request(app).get('/api/rome/metiers').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(1);
            expect(res.body.data).toHaveLength(1);
        });

        it('should return paginated result', async () => {
            mockGetStoredMetiers.mockResolvedValueOnce({
                metiers: [{ code_rome: 'M1805', libelle: 'Dev' }],
                totalCount: 50,
                pagination: { page: 1, pageSize: 20 }
            });

            const res = await request(app)
                .get('/api/rome/metiers?page=1&pageSize=20')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.totalCount).toBe(50);
            expect(res.body.pagination).toBeDefined();
        });

        it('should return 500 on error', async () => {
            mockGetStoredMetiers.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app).get('/api/rome/metiers').set(AUTH);
            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });

    describe('GET /metiers/stats', () => {
        it('should return stats', async () => {
            mockGetMetiersStats.mockResolvedValueOnce({
                totalMetiers: 100,
                totalCompetences: 500
            });

            const res = await request(app).get('/api/rome/metiers/stats').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.totalMetiers).toBe(100);
        });

        it('should return 500 on error', async () => {
            mockGetMetiersStats.mockRejectedValueOnce(new Error('fail'));
            const res = await request(app).get('/api/rome/metiers/stats').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /metiers/:codeRome', () => {
        it('should return specific metier', async () => {
            mockGetStoredMetiers.mockResolvedValueOnce([{ code_rome: 'M1805', libelle: 'Dev' }]);

            const res = await request(app).get('/api/rome/metiers/M1805').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data.code_rome).toBe('M1805');
        });

        it('should return 404 if not found', async () => {
            mockGetStoredMetiers.mockResolvedValueOnce([]);

            const res = await request(app).get('/api/rome/metiers/XXXXX').set(AUTH);
            expect(res.status).toBe(404);
        });

        it('should return 500 on error', async () => {
            mockGetStoredMetiers.mockRejectedValueOnce(new Error('fail'));
            const res = await request(app).get('/api/rome/metiers/M1805').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/grands-domaines', () => {
        it('should return grands domaines', async () => {
            mockGetGrandsDomaines.mockResolvedValueOnce([{ code: 'A', libelle: 'Agriculture' }]);

            const res = await request(app).get('/api/rome/api/grands-domaines').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.count).toBe(1);
        });

        it('should return 500 on error', async () => {
            mockGetGrandsDomaines.mockRejectedValueOnce(new Error('API fail'));
            const res = await request(app).get('/api/rome/api/grands-domaines').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/domaines', () => {
        it('should return domaines', async () => {
            mockGetDomaines.mockResolvedValueOnce([{ code: 'A1', libelle: 'Engins' }]);

            const res = await request(app).get('/api/rome/api/domaines').set(AUTH);
            expect(res.status).toBe(200);
            expect(res.body.count).toBe(1);
        });
    });

    describe('GET /api/metiers', () => {
        it('should return live API metiers', async () => {
            mockGetMetiers.mockResolvedValueOnce([{ code: 'M1805' }]);

            const res = await request(app).get('/api/rome/api/metiers').set(AUTH);
            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/metiers/it', () => {
        it('should return IT metiers', async () => {
            mockGetITMetiers.mockResolvedValueOnce([{ code: 'M1805' }]);

            const res = await request(app).get('/api/rome/api/metiers/it').set(AUTH);
            expect(res.status).toBe(200);
        });

        it('should return 500 on error', async () => {
            mockGetITMetiers.mockRejectedValueOnce(new Error('fail'));
            const res = await request(app).get('/api/rome/api/metiers/it').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/metiers/:codeRome', () => {
        it('should return metier details from API', async () => {
            mockGetMetierByCode.mockResolvedValueOnce({ code: 'M1805', libelle: 'Dev' });

            const res = await request(app).get('/api/rome/api/metiers/M1805').set(AUTH);
            expect(res.status).toBe(200);
            expect(res.body.data.code).toBe('M1805');
        });
    });

    describe('GET /api/metiers/:codeRome/competences', () => {
        it('should return competences', async () => {
            mockGetCompetencesByMetier.mockResolvedValueOnce([{ id: 'c1', libelle: 'JavaScript' }]);

            const res = await request(app).get('/api/rome/api/metiers/M1805/competences').set(AUTH);
            expect(res.status).toBe(200);
            expect(res.body.count).toBe(1);
        });
    });

    describe('GET /api/search', () => {
        it('should return 400 without query', async () => {
            const res = await request(app).get('/api/rome/api/search').set(AUTH);
            expect(res.status).toBe(400);
        });

        it('should return search results', async () => {
            mockSearchMetiers.mockResolvedValueOnce([{ code: 'M1805', libelle: 'Dev' }]);

            const res = await request(app).get('/api/rome/api/search?q=developpeur').set(AUTH);
            expect(res.status).toBe(200);
            expect(res.body.count).toBe(1);
        });

        it('should return 500 on error', async () => {
            mockSearchMetiers.mockRejectedValueOnce(new Error('fail'));
            const res = await request(app).get('/api/rome/api/search?q=test').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('POST /collect', () => {
        it('should return 403 for non-admin', async () => {
            const res = await request(app).post('/api/rome/collect').set(AUTH);
            expect(res.status).toBe(403);
        });

        it('should start collection and return jobId for admin', async () => {
            const res = await request(app)
                .post('/api/rome/collect')
                .set({ ...AUTH, 'x-test-role': 'admin' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.jobId).toBe('job-test-1');
            expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
                jobType: 'collect-metiers'
            }));
        });

        it('should return 500 when job creation fails', async () => {
            mockCreateJob.mockRejectedValueOnce(new Error('DB fail'));

            const res = await request(app)
                .post('/api/rome/collect')
                .set({ ...AUTH, 'x-test-role': 'admin' });

            expect(res.status).toBe(500);
        });
    });
});
