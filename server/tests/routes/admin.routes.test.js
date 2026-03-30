/**
 * Tests for Admin routes
 * GET /security-logs, GET /security-filters, GET /security-stats,
 * GET /cache-stats, GET /users
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock security service
const mockGetSecurityLogs = vi.fn();
const mockGetSecurityLogsCount = vi.fn();
vi.mock('../../services/security.service.js', () => ({
    getSecurityLogs: (...args) => mockGetSecurityLogs(...args),
    getSecurityLogsCount: (...args) => mockGetSecurityLogsCount(...args)
}));

// Mock logger
const mockGetProxyLogs = vi.fn();
const mockGetProxyLogsCount = vi.fn();
const mockGetProxyLogsStats = vi.fn();
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    getProxyLogs: (...args) => mockGetProxyLogs(...args),
    getProxyLogsCount: (...args) => mockGetProxyLogsCount(...args),
    getProxyLogsStats: (...args) => mockGetProxyLogsStats(...args)
}));

// Mock cache stats
vi.mock('../../services/tokenBlacklist.service.js', () => ({
    getBlacklistStats: () => ({ size: 5 })
}));
vi.mock('../../services/settings.service.js', () => ({
    getSettingsCacheStats: () => ({
        entries: 2,
        cache: {
            backend: 'redis',
            effectiveBackend: 'redis',
            connected: true,
            disabledReason: null
        }
    })
}));
vi.mock('../../services/marketFacts.service.js', () => ({
    getFactsCacheStats: () => ({ entries: 100 })
}));
vi.mock('../../services/marketTrends.service.js', () => ({
    getTrendsCacheStats: () => ({ entries: 500 })
}));
vi.mock('../../services/rome.service.js', () => ({
    getMetiersCacheStats: () => ({ entries: 50 })
}));
vi.mock('./../../routes/tags.routes.js', () => ({
    getTagsCacheStats: () => ({ entries: 30 })
}));
vi.mock('../../services/escoService.js', () => ({
    getEscoCacheStats: () => ({ entries: 200 })
}));
vi.mock('./../../routes/resumes/stats.routes.js', () => ({
    getStatsCacheStats: () => ({ entries: 10 })
}));

// Mock users service
const mockListAllUsers = vi.fn();
vi.mock('../../services/users.service.js', () => ({
    listAllUsers: (...args) => mockListAllUsers(...args)
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateQuery: () => (req, res, next) => next(),
    validators: {
        positiveInteger: vi.fn(),
        maxLength: () => vi.fn()
    }
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
        if (req.user?.role?.toLowerCase() === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import adminRoutes from '../../routes/admin.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

const sampleSecurityLog = {
    timestamp: '2026-01-15T10:00:00Z',
    level: 'WARN',
    event: 'login_failed',
    message: 'Failed login attempt'
};

const sampleProxyLog = {
    timestamp: '2026-01-15T09:00:00Z',
    level: 'INFO',
    source: 'proxy',
    message: 'Request proxied'
};

describe('Admin Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetSecurityLogs.mockReturnValue([sampleSecurityLog]);
        mockGetProxyLogs.mockReturnValue([sampleProxyLog]);
        mockGetSecurityLogsCount.mockReturnValue(1);
        mockGetProxyLogsCount.mockReturnValue(1);
        mockGetProxyLogsStats.mockReturnValue({
            byLevel: { INFO: 1 },
            recent: { last24h: 1, lastHour: 0 }
        });
    });

    describe('Auth', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/admin/security-logs');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /security-logs', () => {
        it('should return merged logs', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.logs).toBeInstanceOf(Array);
            expect(res.body.total).toBeDefined();
        });

        it('should filter by source=security', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs?source=security')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.logs.every(l => l.source === 'security')).toBe(true);
        });

        it('should filter by source=proxy', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs?source=proxy')
                .set(AUTH);

            expect(res.status).toBe(200);
        });

        it('should return empty for unknown source', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs?source=unknown')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(0);
        });

        it('should filter by level', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs?level=WARN')
                .set(AUTH);

            expect(res.status).toBe(200);
            // Only the security log has WARN level
            expect(res.body.total).toBe(1);
        });

        it('should support pagination via offset', async () => {
            const res = await request(app)
                .get('/api/admin/security-logs?offset=1&limit=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.offset).toBe(1);
        });
    });

    describe('GET /security-filters', () => {
        it('should return unique filter options', async () => {
            const res = await request(app)
                .get('/api/admin/security-filters')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.levels).toBeInstanceOf(Array);
            expect(res.body.events).toBeInstanceOf(Array);
            expect(res.body.sources).toBeInstanceOf(Array);
        });
    });

    describe('GET /security-stats', () => {
        it('should return combined stats', async () => {
            const res = await request(app)
                .get('/api/admin/security-stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.total).toBe(2);
            expect(res.body.byLevel).toBeDefined();
            expect(res.body.bySource).toEqual({ security: 1, proxy: 1 });
            expect(res.body.recent).toBeDefined();
        });
    });

    describe('GET /cache-stats', () => {
        it('should expose cache backend diagnostics', async () => {
            const res = await request(app)
                .get('/api/admin/cache-stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.cacheBackend).toEqual({
                backend: 'redis',
                connected: true,
                fallbackReason: null
            });
            expect(res.body.caches.settings.entries).toBe(2);
        });
    });

    describe('GET /cache-stats', () => {
        it('should return cache statistics', async () => {
            const res = await request(app)
                .get('/api/admin/cache-stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.timestamp).toBeDefined();
            expect(res.body.memory).toBeDefined();
            expect(res.body.memory.heapUsed).toBeGreaterThan(0);
            expect(res.body.cacheBackend).toEqual({
                backend: 'redis',
                connected: true,
                fallbackReason: null
            });
            expect(res.body.caches).toBeDefined();
            expect(res.body.caches.tokenBlacklist).toEqual({ size: 5 });
            expect(res.body.caches.settings).toEqual({
                entries: 2,
                cache: {
                    backend: 'redis',
                    effectiveBackend: 'redis',
                    connected: true,
                    disabledReason: null
                }
            });
        });
    });

    describe('GET /users', () => {
        it('should return mapped user list', async () => {
            mockListAllUsers.mockResolvedValueOnce([
                { id: 'u-1', name: 'John', email: 'john@test.com', firm_name: 'Acme', role: 'admin', status: 'active' },
                { id: 'u-2', name: 'Jane', email: 'jane@test.com', firm_name: 'Acme', role: 'user', status: 'active' }
            ]);

            const res = await request(app)
                .get('/api/admin/users')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(2);
            expect(res.body[0]).toEqual({
                id: 'u-1',
                name: 'John',
                email: 'john@test.com',
                firm: 'Acme',
                customer: 'Acme',
                role: 'admin',
                status: 'active'
            });
        });

        it('should default role and status for missing fields', async () => {
            mockListAllUsers.mockResolvedValueOnce([
                { id: 'u-3', name: 'No Role', email: 'nr@test.com', firm_name: null }
            ]);

            const res = await request(app)
                .get('/api/admin/users')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body[0].role).toBe('user');
            expect(res.body[0].status).toBe('active');
        });

        it('should return 500 on DB error', async () => {
            mockListAllUsers.mockRejectedValueOnce(new Error('DB fail'));

            const res = await request(app)
                .get('/api/admin/users')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
