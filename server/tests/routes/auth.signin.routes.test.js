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

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock postgresHelpers
const mockSelectWithTimeout = vi.fn();
const mockFindWithTimeout = vi.fn();
const mockCreateWithTimeout = vi.fn();
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    findWithTimeout: (...args) => mockFindWithTimeout(...args),
    createWithTimeout: (...args) => mockCreateWithTimeout(...args),
    validatePromptSize: vi.fn(() => true)
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
const mockVerifyRefreshToken = vi.fn();
const mockRevokeToken = vi.fn();
vi.mock('../../services/jwt.service.js', () => ({
    generateAccessToken: (...args) => mockGenerateAccessToken(...args),
    generateRefreshToken: (...args) => mockGenerateRefreshToken(...args),
    verifyRefreshToken: (...args) => mockVerifyRefreshToken(...args),
    revokeToken: (...args) => mockRevokeToken(...args),
    verifyToken: vi.fn()
}));

// Mock rate limiter
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    authLimiter: (req, res, next) => next()
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
            mockSelectWithTimeout.mockResolvedValueOnce([]);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'nonexistent@example.com', password: 'password123' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should return 401 for wrong password', async () => {
            mockSelectWithTimeout.mockResolvedValueOnce([{
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user'
            }]);
            mockBcryptCompare.mockResolvedValueOnce(false);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'test@example.com', password: 'wrongpassword' });

            expect(res.status).toBe(401);
            expect(res.body.error).toBe('Invalid email or password');
        });

        it('should return 403 for inactive user', async () => {
            mockSelectWithTimeout.mockResolvedValueOnce([{
                id: 'user-123',
                email: 'inactive@example.com',
                password: '$2a$10$hashedpassword',
                status: 'inactive',
                role: 'user'
            }]);
            mockBcryptCompare.mockResolvedValueOnce(true);

            const res = await request(app)
                .post('/api/auth/signin')
                .send({ email: 'inactive@example.com', password: 'password123' });

            expect(res.status).toBe(403);
            expect(res.body.error).toContain('inactive');
        });

        it('should return user data and set cookies on successful login', async () => {
            mockSelectWithTimeout.mockResolvedValueOnce([{
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                name: 'Test User',
                status: 'active',
                role: 'user',
                firm_id: 'firm-123',
                firm_name: 'Test Firm'
            }]);
            mockBcryptCompare.mockResolvedValueOnce(true);
            mockQuery.mockResolvedValueOnce({ rows: [] }); // UPDATE last_login

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
            mockSelectWithTimeout.mockResolvedValueOnce([{
                id: 'user-123',
                email: 'test@example.com',
                password: '$2a$10$hashedpassword',
                status: 'active',
                role: 'user'
            }]);
            mockBcryptCompare.mockResolvedValueOnce(true);
            mockQuery.mockResolvedValueOnce({ rows: [] });

            await request(app)
                .post('/api/auth/signin')
                .send({ email: 'TEST@EXAMPLE.COM', password: 'password123' });

            // Check that selectWithTimeout was called with lowercase email
            expect(mockSelectWithTimeout).toHaveBeenCalled();
            const callArgs = mockSelectWithTimeout.mock.calls[0];
            expect(callArgs[1].rawParams[0]).toBe('test@example.com');
        });
    });
});

describe('Auth Routes - POST /api/auth/register', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should reject registration with existing email', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([{ id: 'existing-user' }]);

        const res = await request(app)
            .post('/api/auth/register')
            .send({ 
                email: 'existing@example.com', 
                password: 'password123',
                name: 'Test User'
            });

        expect(res.status).toBe(409);
        expect(res.body.error).toContain('already exists');
    });

    it('should create new user with valid data', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([]); // No existing user
        mockBcryptHash.mockResolvedValueOnce('$2a$10$hashedpassword');
        mockCreateWithTimeout.mockResolvedValueOnce([{
            id: 'new-user-123',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'user',
            status: 'pending'
        }]);

        const res = await request(app)
            .post('/api/auth/register')
            .send({ 
                email: 'newuser@example.com', 
                password: 'password123',
                name: 'New User'
            });

        expect(res.status).toBe(201);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe('newuser@example.com');
        expect(res.body.message).toContain('registered successfully');
    });

    it('should hash password before storing', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([]);
        mockBcryptHash.mockResolvedValueOnce('$2a$10$hashedpassword');
        mockCreateWithTimeout.mockResolvedValueOnce([{
            id: 'new-user-123',
            email: 'newuser@example.com',
            name: 'New User',
            role: 'user'
        }]);

        await request(app)
            .post('/api/auth/register')
            .send({ 
                email: 'newuser@example.com', 
                password: 'password123',
                name: 'New User'
            });

        expect(mockBcryptHash).toHaveBeenCalledWith('password123', expect.any(Number));
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
        mockVerifyRefreshToken.mockReturnValueOnce(null);

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=invalid-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('Invalid refresh token');
    });

    it('should return 401 for inactive user', async () => {
        mockVerifyRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'user-123', 
            status: 'inactive' 
        });

        const res = await request(app)
            .post('/api/auth/refresh')
            .set('Cookie', 'refreshToken=valid-refresh-token');

        expect(res.status).toBe(401);
        expect(res.body.error).toContain('inactive');
    });

    it('should issue new access token for valid refresh', async () => {
        mockVerifyRefreshToken.mockReturnValueOnce({ id: 'user-123' });
        mockFindWithTimeout.mockResolvedValueOnce({ 
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
        expect(res.body.message).toContain('refreshed');
        
        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.includes('accessToken'))).toBe(true);
    });
});

describe('Auth Routes - POST /api/auth/logout', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without valid access token', async () => {
        const res = await request(app)
            .post('/api/auth/logout');

        expect(res.status).toBe(401);
    });

    it('should clear cookies and revoke tokens on logout', async () => {
        mockRevokeToken.mockResolvedValue(undefined);

        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', 'accessToken=valid-token; refreshToken=valid-refresh');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Signed out');
        
        // Check cookies are cleared
        const cookies = res.headers['set-cookie'];
        expect(cookies.some(c => c.includes('accessToken=;'))).toBe(true);
        expect(cookies.some(c => c.includes('refreshToken=;'))).toBe(true);
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
        mockSelectWithTimeout.mockResolvedValueOnce([{
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
        }]);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'accessToken=valid-token');

        expect(res.status).toBe(200);
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe('test@example.com');
        expect(res.body.user.name).toBe('Test User');
        expect(res.body.user.role).toBe('user');
    });

    it('should return 404 if user not found', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', 'accessToken=valid-token');

        expect(res.status).toBe(404);
    });
});
