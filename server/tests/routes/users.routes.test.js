/**
 * Tests for User Management routes (auth/users.routes.js)
 * POST /users, PUT /users/:id, DELETE /users/:id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed-password'),
        compare: vi.fn().mockResolvedValue(true)
    }
}));

// Mock users service
const mockFindUserByEmail = vi.fn();
const mockFindFirmByName = vi.fn();
const mockCreateAdminUser = vi.fn();
const mockFindUserById = vi.fn();
const mockUpdateAdminUser = vi.fn();
const mockDeleteUser = vi.fn();
vi.mock('../../services/users.service.js', () => ({
    findUserByEmail: (...args) => mockFindUserByEmail(...args),
    findFirmByName: (...args) => mockFindFirmByName(...args),
    createAdminUser: (...args) => mockCreateAdminUser(...args),
    findUserById: (...args) => mockFindUserById(...args),
    updateAdminUser: (...args) => mockUpdateAdminUser(...args),
    deleteUser: (...args) => mockDeleteUser(...args)
}));

// Mock security service
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({ ip: '127.0.0.1', userAgent: 'test' })),
    LOG_LEVELS: { SECURITY: 'security' },
    SECURITY_EVENTS: { USER_CREATED: 'USER_CREATED', USER_UPDATED: 'USER_UPDATED', USER_DELETED: 'USER_DELETED' }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createUserSchema: {},
    updateAdminUserSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'admin-123',
                email: 'admin@example.com',
                role: req.headers['x-test-role'] || 'admin',
                firm: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    }
}));

import usersRoutes from '../../routes/auth/users.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/auth', usersRoutes);
    return app;
}

describe('Users Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token' };

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('POST /api/auth/users', () => {
        it('should create a user', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null); // no existing user
            mockCreateAdminUser.mockResolvedValue({
                id: 'u-new',
                email: 'new@example.com',
                name: 'New User',
                role: 'user',
                status: 'active'
            });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', password: 'Password123!', name: 'New User' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBe('new@example.com');
        });

        it('should return 409 if user already exists', async () => {
            mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-existing' });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'existing@example.com', password: 'Password123!', name: 'Existing' });

            expect(res.status).toBe(409);
            expect(res.body.error).toContain('already exists');
        });

        it('should create user with firm association', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null); // no existing user
            mockFindFirmByName.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' }); // firm lookup
            mockCreateAdminUser.mockResolvedValue({
                id: 'u-new',
                email: 'new@example.com',
                name: 'New User',
                role: 'user',
                status: 'active'
            });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', password: 'Pass123!', name: 'New User', firm: 'Acme Corp' });

            expect(res.status).toBe(201);
        });

        it('should return 400 if firm not found', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null); // no existing user
            mockFindFirmByName.mockResolvedValueOnce(null); // firm not found

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', password: 'Pass123!', name: 'New User', firm: 'Nonexistent' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('not found');
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/auth/users')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ email: 'new@example.com', password: 'Pass123!', name: 'New User' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on DB error', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockCreateAdminUser.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', password: 'Pass123!', name: 'New User' });

            expect(res.status).toBe(500);
        });
    });

    describe('PUT /api/auth/users/:id', () => {
        it('should update a user', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'old@example.com', name: 'Old Name', role: 'user', status: 'active'
            });
            mockUpdateAdminUser.mockResolvedValue({
                id: 'u-1', email: 'old@example.com', name: 'New Name', role: 'user', status: 'active'
            });

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({ name: 'New Name' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Name');
        });

        it('should return 404 if user not found', async () => {
            mockFindUserById.mockResolvedValueOnce(null);

            const res = await request(app)
                .put('/api/auth/users/nonexistent')
                .set(authHeader)
                .send({ name: 'Test' });

            expect(res.status).toBe(404);
        });

        it('should return 400 if no fields to update', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'test@example.com', name: 'Test', role: 'user', status: 'active'
            });

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No fields');
        });
    });

    describe('DELETE /api/auth/users/:id', () => {
        it('should delete a user', async () => {
            mockDeleteUser.mockResolvedValue(['u-1']);

            const res = await request(app)
                .delete('/api/auth/users/u-1')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deleted');
        });

        it('should prevent self-deletion', async () => {
            const res = await request(app)
                .delete('/api/auth/users/admin-123')
                .set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('own account');
        });

        it('should return 404 if user not found', async () => {
            const err = new Error('Record not found');
            err.statusCode = 404;
            mockDeleteUser.mockRejectedValue(err);

            const res = await request(app)
                .delete('/api/auth/users/nonexistent')
                .set(authHeader);

            expect(res.status).toBe(404);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .delete('/api/auth/users/u-1')
                .set({ ...authHeader, 'x-test-role': 'user' });

            expect(res.status).toBe(403);
        });
    });
});
