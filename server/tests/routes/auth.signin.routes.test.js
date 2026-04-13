/**
 * Comprehensive tests for authentication routes (signin, register, refresh, logout, me)
 * Uses supertest for HTTP integration testing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants module FIRST (before any imports that use it)
vi.mock('../../config/constants.js', async (_importOriginal) => {
    return {
        JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
        REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
        CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
        SALT_ROUNDS: 10,
        useSecureCookies: false,
        JWT_EXPIRES_IN: '1h',
        REFRESH_TOKEN_EXPIRES_IN: '7d',
        MAX_TEXT_LENGTH: 50000,
        MAX_PROMPT_LENGTH: 100000,
        MAX_STRING_FIELD_LENGTH: 1000,
        MAX_FILE_SIZE: 50 * 1024 * 1024,
        RATE_LIMIT: {
            GLOBAL: { windowMs: 15 * 60 * 1000, max: 1000 },
            AUTH: { windowMs: 15 * 60 * 1000, max: 20 },
            USER: { windowMs: 15 * 60 * 1000, max: 50 }
        },
        ALLOWED_ORIGINS: ['http://localhost:5173'],
        CACHE_TTL: { SETTINGS: 600000, TEMPLATES: 600000, FIRMS: 900000 },
        PORT: 3001
    };
});

// Mock auth service
const mockFindUserWithFirmByEmail = vi.fn();
const mockFindUserWithFirmById = vi.fn();
const mockUpdateLastLogin = vi.fn();
const mockFindExistingUserByEmail = vi.fn();
const mockRegisterSelfServiceUser = vi.fn();
vi.mock('../../services/auth.service.js', () => ({
    findUserWithFirmByEmail: (...args) => mockFindUserWithFirmByEmail(...args),
    findUserWithFirmById: (...args) => mockFindUserWithFirmById(...args),
    updateLastLogin: (...args) => mockUpdateLastLogin(...args),
    findExistingUserByEmail: (...args) => mockFindExistingUserByEmail(...args),
    registerSelfServiceUser: (...args) => mockRegisterSelfServiceUser(...args)
}));

const mockSendVerificationEmail = vi.fn();
const mockVerifyEmailToken = vi.fn();
const mockGetEmailVerificationRedirectUrl = vi.fn();
vi.mock('../../services/emailVerification.service.js', () => ({
    sendVerificationEmail: (...args) => mockSendVerificationEmail(...args),
    verifyEmailToken: (...args) => mockVerifyEmailToken(...args),
    getEmailVerificationRedirectUrl: (...args) => mockGetEmailVerificationRedirectUrl(...args)
}));

const mockEnforceRegistrationProtection = vi.fn((req, res, next) => next());
vi.mock('../../services/registrationProtection.service.js', () => ({
    enforceRegistrationProtection: (...args) => mockEnforceRegistrationProtection(...args)
}));

// Mock bcrypt
const mockBcryptCompare = vi.fn();
const mockBcryptHash = vi.fn();
vi.mock('bcryptjs', () => ({
    default: {
        compare: (...args) => mockBcryptCompare(...args),
        hash: (...args) => mockBcryptHash(...args)
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock security service
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1', userAgent: 'test' })),
    LOG_LEVELS: { INFO: 'info', WARN: 'warn', ERROR: 'error', SECURITY: 'security', WARNING: 'warning' },
    SECURITY_EVENTS: { 
        AUTH_SUCCESS: 'AUTH_SUCCESS', 
        AUTH_FAILURE: 'AUTH_FAILURE',
        AUTH_BLOCKED: 'AUTH_BLOCKED',
        AUTH_LOGOUT: 'AUTH_LOGOUT',
        USER_CREATED: 'USER_CREATED'
    }
}));

// Mock TOTP service
vi.mock('../../services/totp.service.js', () => ({
    is2FAEnabled: vi.fn(() => Promise.resolve(false)),
    verifyTotpCode: vi.fn(() => Promise.resolve({ valid: true }))
}));

// Mock JWT service
const mockGenerateAccessToken = vi.fn(() => 'mock-access-token');
const mockGenerateRefreshToken = vi.fn(() => 'mock-refresh-token');
const mockConsumeRefreshToken = vi.fn();
const mockVerifyRefreshToken = vi.fn();
const mockVerifyToken = vi.fn();
const mockRevokeToken = vi.fn();
vi.mock('../../services/jwt.service.js', () => ({
    consumeRefreshToken: (...args) => mockConsumeRefreshToken(...args),
    generateAccessToken: (...args) => mockGenerateAccessToken(...args),
    generateRefreshToken: (...args) => mockGenerateRefreshToken(...args),
    verifyRefreshToken: (...args) => mockVerifyRefreshToken(...args),
    verifyToken: (...args) => mockVerifyToken(...args),
    revokeToken: (...args) => mockRevokeToken(...args)
}));

// Mock rate limiter
const mockAuthLimiter = vi.fn((req, res, next) => next());
const mockRegistrationLimiter = vi.fn((req, res, next) => next());
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    authLimiter: (...args) => mockAuthLimiter(...args),
    registrationLimiter: (...args) => mockRegistrationLimiter(...args)
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.cookies?.accessToken === 'valid-token') {
            req.user = { id: 'user-123', email: 'test@example.com', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Import routes after mocks
import signinRoutes from '../../routes/auth/signin.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', signinRoutes);
    return app;
}

describe('Auth Routes - POST /api/auth/signin', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('Input Validation', () => {
        it('should reject request without email', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ password: 'password123' });

            expect(res.status).toBe(400);
        });

        it('should reject request without password', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com' });

            expect(res.status).toBe(400);
        });

        it('should reject invalid email format', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'not-an-email', password: 'password123' });

            expect(res.status).toBe(400);
        });

        it('should reject password shorter than minimum length', async () => {
            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'short' });

            expect(res.status).toBe(400);
        });
    });

    describe('Authentication Flow', () => {
        it('should return 401 for non-existent user', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'nonexistent@example.com', password: 'password123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should return 401 for wrong password', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user'
            });
            mockBcryptCompare.mockResolvedValueOnce(false);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should return 403 for inactive user', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'inactive@example.com',
                password: '$2a$10$hashedpassword',
                status: 'inactive',
                role: 'user'
            });
            mockBcryptCompare.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'inactive@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('inactive');
        });

        it('should return 403 when password replacement is required', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user',
                firm_id: 'firm-123',
                firm_name: 'Test Firm',
                must_change_password: true,
                email_verified_at: '2026-01-01T00:00:00.000Z'
            });
            mockBcryptCompare.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('password_change_required');
        });

        it('should return 403 when email verification is required', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user',
                firm_id: 'firm-123',
                firm_name: 'Test Firm',
                email_verified_at: null
            });
            mockBcryptCompare.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.code).toBe('email_verification_required');
        });

        it('should return 403 for active user without firm assignment', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'orphan@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user',
                firm_id: null,
                firm_name: null,
                email_verified_at: '2026-01-01T00:00:00.000Z'
            });
            mockBcryptCompare.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'orphan@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('firm');
        });

        it('should return user data and set cookies on successful login', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                name: 'Test User',
                status: 'active',
                role: 'user',
                firm_id: 'firm-123',
                firm_name: 'Test Firm',
                email_verified_at: '2026-01-01T00:00:00.000Z'
            });
            mockBcryptCompare.mockResolvedValueOnce(true);
            mockUpdateLastLogin.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'password123' });

            expect(res.status).toBe(200);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('test@example.com');
            expect(res.body.user.id).toBe('user-123');
            
            // Check cookies are set
            const cookies = res.headers['set-cookie'];
            expect(cookies).toBeDefined();
            expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
            expect(cookies.some(c => c.includes('refreshToken'))).toBe(true);
        });

        it('should normalize email to lowercase', async () => {
            mockFindUserWithFirmByEmail.mockResolvedValueOnce({
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user',
                email_verified_at: '2026-01-01T00:00:00.000Z'
            });
            mockBcryptCompare.mockResolvedValueOnce(true);
            mockUpdateLastLogin.mockResolvedValueOnce();

            await request(app)
                .post('/api/auth/signin')
                .send({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

            // Check that findUserWithFirmByEmail was called with lowercase email
            expect(mockFindUserWithFirmByEmail).toHaveBeenCalledWith('test@example.com');
        });
    });
});

describe('Auth Routes - POST /api/auth/register', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should create a pending user on self-service registration', async () => {
        mockFindExistingUserByEmail.mockResolvedValueOnce(null);
        mockBcryptHash.mockResolvedValueOnce('hashed-password');
        mockSendVerificationEmail.mockResolvedValueOnce({ success: true });
        mockRegisterSelfServiceUser.mockResolvedValueOnce({
            autoApproved: false,
            user: {
                id: 'user-123',
                email: 'newuser@example.com',
                role: 'user',
                status: 'pending',
                firm_name: 'Public Registration'
            }
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'newuser@example.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: Date.now() - 5000
            });

        expect(res.status).toBe(201);
        expect(res.body.message).toContain('Registration successful');
        expect(mockFindExistingUserByEmail).toHaveBeenCalledWith('newuser@example.com');
        expect(mockBcryptHash).toHaveBeenCalledWith('password123', 10);
        expect(mockRegisterSelfServiceUser).toHaveBeenCalledWith({
            email: 'newuser@example.com',
            password: 'hashed-password',
            name: 'New User'
        });
        expect(mockSendVerificationEmail).toHaveBeenCalledWith({
            userId: 'user-123',
            email: 'newuser@example.com',
            name: 'New User'
        });
    });

    it('should auto-approve self-service registration when enabled', async () => {
        mockFindExistingUserByEmail.mockResolvedValueOnce(null);
        mockBcryptHash.mockResolvedValueOnce('hashed-password');
        mockSendVerificationEmail.mockResolvedValueOnce({ success: true });
        mockRegisterSelfServiceUser.mockResolvedValueOnce({
            autoApproved: true,
            user: {
                id: 'user-456',
                email: 'activeuser@example.com',
                role: 'user',
                status: 'active',
                firm_name: 'Cabinet test'
            }
        });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'activeuser@example.com',
                password: 'password123',
                name: 'Active User',
                website: '',
                formRenderedAt: Date.now() - 5000
            });

        expect(res.status).toBe(201);
        expect(res.body.registrationStatus).toBe('active');
        expect(res.body.autoApproved).toBe(true);
        expect(mockRegisterSelfServiceUser).toHaveBeenCalledWith({
            email: 'activeuser@example.com',
            password: 'hashed-password',
            name: 'Active User'
        });
        expect(mockSendVerificationEmail).toHaveBeenCalledWith({
            userId: 'user-456',
            email: 'activeuser@example.com',
            name: 'Active User'
        });
    });

    it('should reject duplicate emails', async () => {
        mockFindExistingUserByEmail.mockResolvedValueOnce({ id: 'user-1' });

        const res = await request(app)
            .post('/api/auth/register')
            .send({
                email: 'newuser@example.com',
                password: 'password123',
                name: 'New User',
                website: '',
                formRenderedAt: Date.now() - 5000
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already exists');
        expect(mockRegisterSelfServiceUser).not.toHaveBeenCalled();
    });

    it('should reject weak password', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ 
                email: 'newuser@example.com', 
                password: '123',
                name: 'New User'
            });

        expect(res.status).toBe(400);
    });
});

describe('Auth Routes - POST /api/auth/refresh', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without refresh token cookie', async () => {
        const res = await request(app)
            .post('/api/auth/refresh');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Refresh token not found');
    });

    it('should return 401 for invalid refresh token', async () => {
        mockConsumeRefreshToken.mockReturnValueOnce(null);

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=invalid-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Invalid refresh token');
    });

    it('should return 401 for inactive user', async () => {
        mockConsumeRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindUserWithFirmById.mockResolvedValueOnce({ 
            id: 'user-123', 
            status: 'inactive' 
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=valid-refresh-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('inactive');
    });

    it('should return 403 when refreshed user has no firm assignment', async () => {
        mockConsumeRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindUserWithFirmById.mockResolvedValueOnce({
            id: 'user-123',
            email: 'orphan@example.com',
            status: 'active',
            role: 'user',
            firm_id: null,
            firm_name: null
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=valid-refresh-token');

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('firm');
    });

    it('should apply auth rate limiting to refresh', async () => {
        mockConsumeRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindUserWithFirmById.mockResolvedValueOnce({ 
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            status: 'active',
            role: 'user',
            firm_id: 'firm-123',
            firm_name: 'Test Firm'
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=valid-refresh-token');

        expect(res.status).toBe(200);
        expect(mockAuthLimiter).toHaveBeenCalled();
    });

    it('should issue new access token and rotate refresh token', async () => {
        mockConsumeRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindUserWithFirmById.mockResolvedValueOnce({ 
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            status: 'active',
            role: 'user',
            firm_id: 'firm-123',
            firm_name: 'Test Firm'
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=valid-refresh-token');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        expect(res.body.user).toBeDefined();
        expect(res.body.user.id).toBe('user-123');
        
        // Verify both cookies are set (token rotation)
        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
        expect(cookies.some(c => c.includes('refreshToken'))).toBe(true);
        expect(mockConsumeRefreshToken).toHaveBeenCalledWith('valid-refresh-token');
        expect(mockGenerateRefreshToken).toHaveBeenCalled();
    });
});

describe('Auth Routes - GET /api/auth/verify-email', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockGetEmailVerificationRedirectUrl.mockImplementation((result) => {
            if (result?.success) {
                return '/signin?success=email_verified';
            }
            return `/signin?error=${result?.error || 'email_verification_failed'}`;
        });
    });

    it('should redirect to signin success after verification', async () => {
        mockVerifyEmailToken.mockResolvedValueOnce({ success: true });

        const res = await request(app)
            .get('/api/auth/verify-email?token=valid-token');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/signin?success=email_verified');
    });

    it('should redirect to signin with error when token is missing', async () => {
        const res = await request(app)
            .get('/api/auth/verify-email');

        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/signin?error=invalid_token');
        expect(mockVerifyEmailToken).not.toHaveBeenCalled();
    });
});

describe('Auth Routes - POST /api/auth/logout', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should clear cookies even without valid access token', async () => {
        mockVerifyToken.mockReturnValueOnce(null);

        const res = await request(app)
            .post('/api/auth/logout');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Signed out');
        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.includes('accessToken=;'))).toBe(true);
        expect(cookies.some(c => c.includes('refreshToken=;'))).toBe(true);
    });

    it('should clear cookies and revoke tokens on logout', async () => {
        mockVerifyToken.mockReturnValueOnce({ id: 'user-123', email: 'test@example.com' });
        mockRevokeToken.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', 'accessToken=valid-token; refreshToken=valid-refresh');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Signed out');
        expect(mockRevokeToken).toHaveBeenCalledWith('valid-token');
        expect(mockRevokeToken).toHaveBeenCalledWith('valid-refresh');

        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.includes('accessToken=;'))).toBe(true);
        expect(cookies.some(c => c.includes('refreshToken=;'))).toBe(true);
    });

    it('should logout with only a valid refresh token when access token is expired', async () => {
        mockVerifyToken.mockReturnValueOnce(null);
        mockVerifyRefreshToken.mockReturnValueOnce({ id: 'user-123', email: 'test@example.com' });
        mockRevokeToken.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', 'refreshToken=valid-refresh');

        expect(res.status).toBe(200);
        expect(mockRevokeToken).toHaveBeenCalledWith('valid-refresh');
    });
});

describe('Auth Routes - GET /api/auth/me', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/auth/me');

        expect(res.status).toBe(401);
    });

    it('should return current user data', async () => {
        mockFindUserWithFirmById.mockResolvedValueOnce({
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            job_title: 'Developer',
            phone: '123456789',
            status: 'active',
            role: 'user',
            firm_id: 'firm-123',
            firm_name: 'Test Firm',
            firm_logo: 'logo.png'
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'accessToken=valid-token');

        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toBe('private, no-cache, max-age=0, must-revalidate');
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe('test@example.com');
        expect(res.body.user.name).toBe('Test User');
        expect(res.body.user.role).toBe('user');
    });

    it('should return 404 if user not found', async () => {
        mockFindUserWithFirmById.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'accessToken=valid-token');

        expect(res.status).toBe(404);
    });

    it('should return 403 if current user has no firm assignment', async () => {
        mockFindUserWithFirmById.mockResolvedValueOnce({
            id: 'user-123',
            email: 'orphan@example.com',
            status: 'active',
            role: 'user',
            firm_id: null,
            firm_name: null
        });

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'accessToken=valid-token');

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('firm');
    });
});


