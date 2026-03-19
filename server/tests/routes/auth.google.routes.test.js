/**
 * Tests for Google OAuth routes
 * GET /google, GET /google/callback, POST /google/token,
 * GET /google/status, POST /google/unlink
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock google auth service
const mockGetAuthUrl = vi.fn();
const mockExchangeCodeForUserInfo = vi.fn();
const mockFindUserByGoogleId = vi.fn();
const mockFindUserByEmail = vi.fn();
const mockLinkGoogleAccount = vi.fn();
const mockVerifyIdToken = vi.fn();
const mockGetGoogleLinkStatus = vi.fn();
const mockUnlinkGoogleAccount = vi.fn();
const mockSaveGmailTokens = vi.fn();
vi.mock('../../services/googleAuth.service.js', () => ({
    getAuthUrl: (...args) => mockGetAuthUrl(...args),
    exchangeCodeForUserInfo: (...args) => mockExchangeCodeForUserInfo(...args),
    findUserByGoogleId: (...args) => mockFindUserByGoogleId(...args),
    findUserByEmail: (...args) => mockFindUserByEmail(...args),
    linkGoogleAccount: (...args) => mockLinkGoogleAccount(...args),
    verifyIdToken: (...args) => mockVerifyIdToken(...args),
    getGoogleLinkStatus: (...args) => mockGetGoogleLinkStatus(...args),
    unlinkGoogleAccount: (...args) => mockUnlinkGoogleAccount(...args),
    saveGmailTokens: (...args) => mockSaveGmailTokens(...args)
}));

// Mock JWT service
vi.mock('../../services/jwt.service.js', () => ({
    generateAccessToken: () => 'mock-access-token',
    generateRefreshToken: () => 'mock-refresh-token'
}));

// Mock security
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: () => ({ ip: '127.0.0.1' }),
    LOG_LEVELS: { INFO: 'info', WARNING: 'warning', SECURITY: 'security' },
    SECURITY_EVENTS: { AUTH_SUCCESS: 'auth_success', AUTH_FAILURE: 'auth_failure', AUTH_BLOCKED: 'auth_blocked', USER_CREATED: 'user_created' }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock auth config
vi.mock('../../routes/auth/config.js', () => ({
    useSecureCookies: false,
    ACCESS_TOKEN_COOKIE: { httpOnly: true, secure: false, sameSite: 'lax', path: '/', maxAge: 3600000 },
    REFRESH_TOKEN_COOKIE: { httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth', maxAge: 604800000 },
    CLEAR_ACCESS_TOKEN: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
    CLEAR_REFRESH_TOKEN: { httpOnly: true, secure: false, sameSite: 'lax', path: '/api/auth' }
}));

// Mock rate limit
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    authLimiter: (req, res, next) => next()
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

import googleRoutes from '../../routes/auth/google.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', googleRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Google OAuth Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // GET /google
    // ==========================================
    describe('GET /google', () => {
        it('should return auth URL', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            const res = await request(app).get('/api/auth/google');

            expect(res.status).toBe(200);
            expect(res.body.authUrl).toContain('accounts.google.com');
        });

        it('should return 500 on error', async () => {
            mockGetAuthUrl.mockRejectedValueOnce(new Error('Config error'));

            const res = await request(app).get('/api/auth/google');
            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /google/callback
    // ==========================================
    describe('GET /google/callback', () => {
        it('should redirect on OAuth error', async () => {
            const res = await request(app)
                .get('/api/auth/google/callback?error=access_denied');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('error=google_auth_failed');
        });

        it('should redirect on invalid state', async () => {
            const res = await request(app)
                .get('/api/auth/google/callback?code=abc&state=invalid');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('invalid_state');
        });
    });

    // ==========================================
    // POST /google/token
    // ==========================================
    describe('POST /google/token', () => {
        it('should return 400 without idToken', async () => {
            const res = await request(app)
                .post('/api/auth/google/token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('ID token');
        });

        it('should sign in existing user', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'user@test.com',
                name: 'Test User'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce({
                id: 'u-1',
                email: 'user@test.com',
                name: 'Test User',
                status: 'active',
                role: 'user',
                firm_id: 'f-1',
                firm_name: 'Acme'
            });
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE last_login

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-id-token' });

            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('user@test.com');
        });

        it('should auto-link if user found by email', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-new',
                email: 'existing@test.com',
                name: 'Existing'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce(null);
            mockFindUserByEmail.mockResolvedValueOnce({
                id: 'u-2',
                email: 'existing@test.com',
                name: 'Existing',
                status: 'active',
                role: 'user'
            });
            mockLinkGoogleAccount.mockResolvedValueOnce();
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-token' });

            expect(res.status).toBe(200);
            expect(mockLinkGoogleAccount).toHaveBeenCalled();
        });

        it('should return 401 if no account found', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-unknown',
                email: 'unknown@test.com'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce(null);
            mockFindUserByEmail.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-token' });

            expect(res.status).toBe(401);
            expect(res.body.error).toContain('No account');
        });

        it('should return 403 for inactive user', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'inactive@test.com'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce({
                id: 'u-3',
                email: 'inactive@test.com',
                status: 'inactive',
                role: 'user'
            });

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-token' });

            expect(res.status).toBe(403);
        });

        it('should return 401 on invalid token', async () => {
            mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'bad-token' });

            expect(res.status).toBe(401);
        });
    });

    // ==========================================
    // GET /google/status
    // ==========================================
    describe('GET /google/status', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/auth/google/status');
            expect(res.status).toBe(401);
        });

        it('should return link status', async () => {
            mockGetGoogleLinkStatus.mockResolvedValueOnce({
                linked: true,
                email: 'user@gmail.com'
            });

            const res = await request(app)
                .get('/api/auth/google/status')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.linked).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockGetGoogleLinkStatus.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/auth/google/status')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // POST /google/unlink
    // ==========================================
    describe('POST /google/unlink', () => {
        it('should unlink Google account', async () => {
            mockUnlinkGoogleAccount.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/auth/google/unlink')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockUnlinkGoogleAccount.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .post('/api/auth/google/unlink')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });
});
