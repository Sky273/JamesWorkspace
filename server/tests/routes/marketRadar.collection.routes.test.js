/**
 * Tests for Market Radar Collection routes
 * POST /collect, POST /collect/:source
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock marketFacts service
const mockRunFullCollection = vi.fn();
const mockRunSourceCollection = vi.fn();
const mockInvalidateFactsCache = vi.fn();
vi.mock('../../services/marketFacts.service.js', () => ({
    runFullCollection: (...args) => mockRunFullCollection(...args),
    runSourceCollection: (...args) => mockRunSourceCollection(...args),
    invalidateFactsCache: (...args) => mockInvalidateFactsCache(...args)
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
                id: 'admin-1',
                role: req.headers['x-test-role'] || 'admin'
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

import collectionRoutes from '../../routes/marketRadar/collection.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/market-radar', collectionRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Market Radar Collection Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('POST /collect', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/market-radar/collect').send({});
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/market-radar/collect')
                .set({ ...AUTH, 'x-test-role': 'user' })
                .send({});
            expect(res.status).toBe(403);
        });

        it('should run full collection', async () => {
            mockRunFullCollection.mockResolvedValueOnce({ sources: 2, totalRecords: 500 });

            const res = await request(app)
                .post('/api/market-radar/collect')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.summary.totalRecords).toBe(500);
            expect(mockInvalidateFactsCache).toHaveBeenCalled();
        });

        it('should pass options from body', async () => {
            mockRunFullCollection.mockResolvedValueOnce({});

            await request(app)
                .post('/api/market-radar/collect')
                .set(AUTH)
                .send({ options: { force: true } });

            expect(mockRunFullCollection).toHaveBeenCalledWith({ force: true });
        });

        it('should return 500 on error', async () => {
            mockRunFullCollection.mockRejectedValueOnce(new Error('API fail'));

            const res = await request(app)
                .post('/api/market-radar/collect')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(500);
        });
    });

    describe('POST /collect/:source', () => {
        it('should return 400 for invalid source', async () => {
            const res = await request(app)
                .post('/api/market-radar/collect/invalid_source')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid source');
        });

        it('should collect from france_travail', async () => {
            mockRunSourceCollection.mockResolvedValueOnce({ records: 200 });

            const res = await request(app)
                .post('/api/market-radar/collect/france_travail')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockRunSourceCollection).toHaveBeenCalledWith('france_travail', {});
            expect(mockInvalidateFactsCache).toHaveBeenCalled();
        });

        it('should collect from adzuna', async () => {
            mockRunSourceCollection.mockResolvedValueOnce({ records: 300 });

            const res = await request(app)
                .post('/api/market-radar/collect/adzuna')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockRunSourceCollection.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/market-radar/collect/france_travail')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(500);
        });
    });
});
