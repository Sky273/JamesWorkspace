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
    GOOGLE_AUTH_DB_ERROR_CODE: 'GOOGLE_AUTH_DB_ERROR',
    GOOGLE_AUTH_UPSTREAM_ERROR_CODE: 'GOOGLE_AUTH_UPSTREAM_ERROR',
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
const mockVerifyToken = vi.fn();
vi.mock('../../services/jwt.service.js', () => ({
    generateAccessToken: () => 'mock-access-token',
    generateRefreshToken: () => 'mock-refresh-token',
    verifyToken: (...args) => mockVerifyToken(...args)
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

// Mock auth service
const mockUpdateLastLogin = vi.fn();
const mockRegisterSelfServiceUser = vi.fn();
const mockFindUserWithFirmById = vi.fn();
vi.mock('../../services/auth.service.js', () => ({
    updateLastLogin: (...args) => mockUpdateLastLogin(...args),
    registerSelfServiceUser: (...args) => mockRegisterSelfServiceUser(...args),
    findUserWithFirmById: (...args) => mockFindUserWithFirmById(...args)
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
        mockVerifyToken.mockReset();
        mockFindUserWithFirmById.mockResolvedValue({ id: 'user-123', status: 'active', firm_id: 'f-1', firm_name: 'Acme' });
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

        it('should resolve link action user from access token cookie', async () => {
            mockVerifyToken.mockReturnValueOnce({ id: 'user-123' });
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            const res = await request(app)
                .get('/api/auth/google?action=link&returnUrl=/settings')
                .set('Cookie', ['accessToken=valid-access-token']);

            expect(res.status).toBe(200);
            expect(mockVerifyToken).toHaveBeenCalledWith('valid-access-token');
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

        it('should redirect when callback code is missing', async () => {
            const res = await request(app)
                .get('/api/auth/google/callback?state=missing-code');

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('missing_code');
        });

        it('should create a pending account during Google register flow', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');
            await request(app).get('/api/auth/google?action=register');

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'newuser@test.com',
                name: 'New User'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce(null);
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockRegisterSelfServiceUser.mockResolvedValueOnce({
                autoApproved: false,
                user: {
                    id: 'u-new',
                    status: 'pending'
                }
            });

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/signin?success=registered_pending');
            expect(mockRegisterSelfServiceUser).toHaveBeenCalledWith({
                email: 'newuser@test.com',
                name: 'New User',
                googleId: 'g-123',
                googleEmail: 'newuser@test.com'
            });
        });

        it('should auto-approve a Google self-registration when enabled', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');
            await request(app).get('/api/auth/google?action=register');

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-789',
                email: 'activegoogle@test.com',
                name: 'Google Active User'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce(null);
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockRegisterSelfServiceUser.mockResolvedValueOnce({
                autoApproved: true,
                user: {
                    id: 'u-new-active',
                    status: 'active'
                }
            });

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/signin?success=registered_active_test');
        });

        it('should block Google callback sign-in when existing user has no firm assignment', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');
            await request(app).get('/api/auth/google?action=signin');

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'orphan@test.com',
                name: 'Orphan User'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce({
                id: 'u-4',
                email: 'orphan@test.com',
                status: 'active',
                role: 'user',
                firm_id: null,
                firm_name: null
            });

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/signin?error=firm_assignment_required');
        });

        it('should link the Google account for a valid link callback', async () => {
            mockVerifyToken.mockReturnValueOnce({ id: 'user-123' });
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            await request(app)
                .get('/api/auth/google?action=link&returnUrl=/settings')
                .set('Cookie', ['accessToken=valid-access-token']);

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-linked',
                email: 'linked@test.com',
                name: 'Linked User'
            });
            mockLinkGoogleAccount.mockResolvedValueOnce(true);

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/settings?success=google_linked');
            expect(mockFindUserWithFirmById).toHaveBeenCalledWith('user-123');
            expect(mockLinkGoogleAccount).toHaveBeenCalledWith('user-123', 'g-linked', 'linked@test.com');
        });

        it('should reject link callback when the original user no longer exists', async () => {
            mockVerifyToken.mockReturnValueOnce({ id: 'user-123' });
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');

            await request(app)
                .get('/api/auth/google?action=link&returnUrl=/settings')
                .set('Cookie', ['accessToken=valid-access-token']);

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-linked',
                email: 'linked@test.com',
                name: 'Linked User'
            });
            mockFindUserWithFirmById.mockResolvedValueOnce(null);

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/settings?error=not_authenticated');
            expect(mockLinkGoogleAccount).not.toHaveBeenCalled();
        });

        it('should redirect to service unavailable when Google DB lookup fails', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');
            await request(app).get('/api/auth/google?action=signin');

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'db-failure@test.com',
                name: 'DB Failure'
            });
            mockFindUserByGoogleId.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_DB_ERROR',
                message: 'db offline'
            });

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/signin?error=service_unavailable');
        });

        it('should redirect to service unavailable when Google upstream fails', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/o/oauth2/auth?...');
            await request(app).get('/api/auth/google?action=signin');

            const state = mockGetAuthUrl.mock.calls[0][0];

            mockExchangeCodeForUserInfo.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_UPSTREAM_ERROR',
                message: 'Google upstream unavailable'
            });

            const res = await request(app)
                .get(`/api/auth/google/callback?code=abc&state=${state}`);

            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('/signin?error=service_unavailable');
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
            expect(res.body.error).toBe('Validation failed');
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
            mockUpdateLastLogin.mockResolvedValueOnce();

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
                role: 'user',
                firm_id: 'f-2',
                firm_name: 'Acme'
            });
            mockLinkGoogleAccount.mockResolvedValueOnce();
            mockUpdateLastLogin.mockResolvedValueOnce();

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

        it('should return 403 for user without firm assignment', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-123',
                email: 'orphan@test.com'
            });
            mockFindUserByGoogleId.mockResolvedValueOnce({
                id: 'u-4',
                email: 'orphan@test.com',
                status: 'active',
                role: 'user',
                firm_id: null,
                firm_name: null
            });

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-token' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('firm');
        });

        it('should return 401 on invalid token', async () => {
            mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'bad-token' });

            expect(res.status).toBe(401);
        });

        it('should return 503 when Google DB lookup fails', async () => {
            mockVerifyIdToken.mockResolvedValueOnce({
                googleId: 'g-db',
                email: 'db@test.com',
                name: 'DB User'
            });
            mockFindUserByGoogleId.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_DB_ERROR',
                message: 'db offline'
            });

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-token' });

            expect(res.status).toBe(503);
            expect(res.body.error).toBe('Authentication service temporarily unavailable');
        });

        it('should return 503 when Google upstream fails', async () => {
            mockVerifyIdToken.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_UPSTREAM_ERROR',
                message: 'Google upstream unavailable'
            });

            const res = await request(app)
                .post('/api/auth/google/token')
                .send({ idToken: 'valid-id-token' });

            expect(res.status).toBe(503);
            expect(res.body.error).toBe('Authentication service temporarily unavailable');
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

        it('should return 503 when Google DB lookup fails', async () => {
            mockGetGoogleLinkStatus.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_DB_ERROR',
                message: 'db offline'
            });

            const res = await request(app)
                .get('/api/auth/google/status')
                .set(AUTH);

            expect(res.status).toBe(503);
            expect(res.body.error).toBe('Failed to get Google status');
        });

        it('should return 503 when Google upstream fails', async () => {
            mockGetGoogleLinkStatus.mockRejectedValueOnce({
                code: 'GOOGLE_AUTH_UPSTREAM_ERROR',
                message: 'Google upstream unavailable'
            });

            const res = await request(app)
                .get('/api/auth/google/status')
                .set(AUTH);

            expect(res.status).toBe(503);
            expect(res.body.error).toBe('Failed to get Google status');
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
