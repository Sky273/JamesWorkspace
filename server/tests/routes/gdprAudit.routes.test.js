/**
 * Tests for GDPR Audit routes
 * GET /logs, GET /stats, GET /firms, GET /actions, GET /export/:email
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock gdprAudit service
const mockGetGdprAuditLogs = vi.fn();
const mockGetGdprAuditStats = vi.fn();
const mockGetGdprFirms = vi.fn();
const mockExportTargetLogs = vi.fn();
vi.mock('../../services/gdprAudit.service.js', () => ({
    getGdprAuditLogs: (...args) => mockGetGdprAuditLogs(...args),
    getGdprAuditStats: (...args) => mockGetGdprAuditStats(...args),
    getGdprFirms: (...args) => mockGetGdprFirms(...args),
    exportTargetLogs: (...args) => mockExportTargetLogs(...args),
    GDPR_ACTIONS: {
        CONSENT_SENT: 'consent_sent',
        CONSENT_ACCEPTED: 'consent_accepted',
        CONSENT_REFUSED: 'consent_refused',
        CV_PURGED: 'cv_purged'
    },
    GDPR_CATEGORIES: {
        CONSENT: 'consent',
        DATA: 'data',
        PURGE: 'purge'
    }
}));

// Mock asyncHandler
vi.mock('../../middleware/asyncHandler.middleware.js', () => ({
    asyncHandler: (fn) => (req, res, next) => fn(req, res, next).catch(next)
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
        if (req.user?.role?.toLowerCase() === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import gdprAuditRoutes from '../../routes/gdprAudit.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/gdpr-audit', gdprAuditRoutes);
    app.use((err, req, res, _next) => {
        res.status(500).json({ error: err.message || 'Internal server error' });
    });
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('GDPR Audit Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('Auth', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/gdpr-audit/logs');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/gdpr-audit/logs')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /logs', () => {
        it('should return paginated audit logs', async () => {
            mockGetGdprAuditLogs.mockResolvedValueOnce({
                logs: [{ id: 'log-1', action: 'consent_sent' }],
                total: 1,
                page: 1,
                limit: 50
            });

            const res = await request(app)
                .get('/api/gdpr-audit/logs')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.logs).toHaveLength(1);
        });

        it('should pass filter params to service', async () => {
            mockGetGdprAuditLogs.mockResolvedValueOnce({ logs: [], total: 0 });

            await request(app)
                .get('/api/gdpr-audit/logs?firmId=f-1&action=consent_sent&category=consent&isAutomated=true&page=2&limit=25&sortBy=action&sortOrder=asc')
                .set(AUTH);

            expect(mockGetGdprAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
                firmId: 'f-1',
                action: 'consent_sent',
                category: 'consent',
                isAutomated: true,
                page: 2,
                limit: 25,
                sortBy: 'action',
                sortOrder: 'asc'
            }));
        });

        it('should cap limit at 100', async () => {
            mockGetGdprAuditLogs.mockResolvedValueOnce({ logs: [], total: 0 });

            await request(app)
                .get('/api/gdpr-audit/logs?limit=500')
                .set(AUTH);

            expect(mockGetGdprAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
                limit: 100
            }));
        });

        it('should handle isAutomated=false', async () => {
            mockGetGdprAuditLogs.mockResolvedValueOnce({ logs: [], total: 0 });

            await request(app)
                .get('/api/gdpr-audit/logs?isAutomated=false')
                .set(AUTH);

            expect(mockGetGdprAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
                isAutomated: false
            }));
        });

        it('should bypass cache on logs read when refresh=1 is provided', async () => {
            mockGetGdprAuditLogs.mockResolvedValueOnce({ logs: [], total: 0 });

            const res = await request(app)
                .get('/api/gdpr-audit/logs?refresh=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(mockGetGdprAuditLogs).toHaveBeenCalledWith(expect.objectContaining({
                bypassCache: true
            }));
        });

        it('should return 500 on error', async () => {
            mockGetGdprAuditLogs.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/gdpr-audit/logs')
                .set(AUTH);

            expect(res.status).toBe(500);
        });

        it('should return 400 for invalid page', async () => {
            const res = await request(app)
                .get('/api/gdpr-audit/logs?page=0')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('page');
        });

        it('should return 400 for invalid limit', async () => {
            const res = await request(app)
                .get('/api/gdpr-audit/logs?limit=-5')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('limit');
        });
    });

    describe('GET /stats', () => {
        it('should return audit stats', async () => {
            mockGetGdprAuditStats.mockResolvedValueOnce({
                totalActions: 500,
                byAction: { consent_sent: 200 }
            });

            const res = await request(app)
                .get('/api/gdpr-audit/stats')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.totalActions).toBe(500);
        });

        it('should pass firmId and days', async () => {
            mockGetGdprAuditStats.mockResolvedValueOnce({});

            await request(app)
                .get('/api/gdpr-audit/stats?firmId=f-1&days=90')
                .set(AUTH);

            expect(mockGetGdprAuditStats).toHaveBeenCalledWith('f-1', 90, { bypassCache: false });
        });

        it('should default to 30 days', async () => {
            mockGetGdprAuditStats.mockResolvedValueOnce({});

            await request(app)
                .get('/api/gdpr-audit/stats')
                .set(AUTH);

            expect(mockGetGdprAuditStats).toHaveBeenCalledWith(null, 30, { bypassCache: false });
        });

        it('should bypass cache on stats read when refresh=1 is provided', async () => {
            mockGetGdprAuditStats.mockResolvedValueOnce({});

            const res = await request(app)
                .get('/api/gdpr-audit/stats?refresh=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(mockGetGdprAuditStats).toHaveBeenCalledWith(null, 30, { bypassCache: true });
        });

        it('should return 500 on error', async () => {
            mockGetGdprAuditStats.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/gdpr-audit/stats')
                .set(AUTH);

            expect(res.status).toBe(500);
        });

        it('should return 400 for invalid days', async () => {
            const res = await request(app)
                .get('/api/gdpr-audit/stats?days=0')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('days');
        });
    });

    describe('GET /firms', () => {
        it('should return firms with GDPR activity', async () => {
            mockGetGdprFirms.mockResolvedValueOnce([
                { id: 'f-1', name: 'Firm A', actionCount: 50 }
            ]);

            const res = await request(app)
                .get('/api/gdpr-audit/firms')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body).toHaveLength(1);
            expect(res.body[0].name).toBe('Firm A');
        });

        it('should bypass cache on firms read when refresh=1 is provided', async () => {
            mockGetGdprFirms.mockResolvedValueOnce([]);

            const res = await request(app)
                .get('/api/gdpr-audit/firms?refresh=1')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(mockGetGdprFirms).toHaveBeenCalledWith({ bypassCache: true });
        });

        it('should return 500 on error', async () => {
            mockGetGdprFirms.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/gdpr-audit/firms')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    describe('GET /actions', () => {
        it('should return available action types and categories', async () => {
            const res = await request(app)
                .get('/api/gdpr-audit/actions')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.actions).toBeInstanceOf(Array);
            expect(res.body.categories).toBeInstanceOf(Array);
            expect(res.body.actions.length).toBeGreaterThan(0);
            expect(res.body.actions[0]).toHaveProperty('key');
            expect(res.body.actions[0]).toHaveProperty('value');
            expect(res.body.actions[0]).toHaveProperty('label');
        });
    });

    describe('GET /export/:email', () => {
        it('should export logs for a target email', async () => {
            mockExportTargetLogs.mockResolvedValueOnce([
                { id: 'log-1', action: 'consent_sent', target_email: 'john@test.com' }
            ]);

            const res = await request(app)
                .get('/api/gdpr-audit/export/john@test.com')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.targetEmail).toBe('john@test.com');
            expect(res.body.totalLogs).toBe(1);
            expect(res.body.exportDate).toBeDefined();
            expect(mockExportTargetLogs).toHaveBeenCalledWith('john@test.com');
        });

        it('should return empty array if no logs', async () => {
            mockExportTargetLogs.mockResolvedValueOnce([]);

            const res = await request(app)
                .get('/api/gdpr-audit/export/nobody@test.com')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.totalLogs).toBe(0);
        });

        it('should return 500 on error', async () => {
            mockExportTargetLogs.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/gdpr-audit/export/john@test.com')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
