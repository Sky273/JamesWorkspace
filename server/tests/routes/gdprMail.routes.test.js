/**
 * Tests for GDPR Mail routes
 * GET /status, GET /auth-url, GET /callback, POST /disconnect, POST /test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock gdprMailService
const mockGetConnectionStatus = vi.fn();
const mockGetAuthUrl = vi.fn();
const mockHandleOAuthCallback = vi.fn();
const mockDisconnect = vi.fn();
const mockSendTestEmail = vi.fn();
vi.mock('../../services/mail/gdprMailService.js', () => ({
    gdprMailService: {
        getConnectionStatus: (...args) => mockGetConnectionStatus(...args),
        getAuthUrl: (...args) => mockGetAuthUrl(...args),
        handleOAuthCallback: (...args) => mockHandleOAuthCallback(...args),
        disconnect: (...args) => mockDisconnect(...args),
        sendTestEmail: (...args) => mockSendTestEmail(...args)
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock crypto
vi.mock('crypto', () => ({
    default: { randomBytes: () => ({ toString: () => 'a'.repeat(64) }) },
    randomBytes: () => ({ toString: () => 'a'.repeat(64) })
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

import gdprMailRoutes from '../../routes/gdprMail.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/gdpr/mail', gdprMailRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('GDPR Mail Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('Auth', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/gdpr/mail/status');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .get('/api/gdpr/mail/status')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });
    });

    describe('GET /status', () => {
        it('should return connection status', async () => {
            mockGetConnectionStatus.mockResolvedValueOnce({
                connected: true,
                email: 'gdpr@test.com'
            });

            const res = await request(app)
                .get('/api/gdpr/mail/status')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.connected).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockGetConnectionStatus.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/gdpr/mail/status')
                .set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /auth-url', () => {
        it('should return auth URL', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            const res = await request(app)
                .get('/api/gdpr/mail/auth-url')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.authUrl).toContain('accounts.google.com');
        });

        it('should return 500 on error', async () => {
            mockGetAuthUrl.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/gdpr/mail/auth-url')
                .set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('GET /callback', () => {
        it('should return 400 if missing code or state', async () => {
            const res = await request(app).get('/api/gdpr/mail/callback');
            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid state', async () => {
            const res = await request(app)
                .get('/api/gdpr/mail/callback?code=abc&state=invalid-state');
            expect(res.status).toBe(400);
        });
    });

    describe('POST /disconnect', () => {
        it('should disconnect', async () => {
            mockDisconnect.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/gdpr/mail/disconnect')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockDisconnect.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/gdpr/mail/disconnect')
                .set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    describe('POST /test', () => {
        it('should return 400 without email', async () => {
            const res = await request(app)
                .post('/api/gdpr/mail/test')
                .set(AUTH)
                .send({});
            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid email', async () => {
            const res = await request(app)
                .post('/api/gdpr/mail/test')
                .set(AUTH)
                .send({ email: 'not-an-email' });
            expect(res.status).toBe(400);
        });

        it('should send test email', async () => {
            mockSendTestEmail.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/gdpr/mail/test')
                .set(AUTH)
                .send({ email: 'test@example.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sentTo).toBe('test@example.com');
        });

        it('should return 500 on error', async () => {
            mockSendTestEmail.mockRejectedValueOnce(new Error('SMTP error'));

            const res = await request(app)
                .post('/api/gdpr/mail/test')
                .set(AUTH)
                .send({ email: 'test@example.com' });
            expect(res.status).toBe(500);
        });
    });
});
