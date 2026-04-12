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
const mockFindFirmById = vi.fn();
const mockCreateAdminUser = vi.fn();
const mockFindUserById = vi.fn();
const mockUpdateAdminUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockRequestPasswordReset = vi.fn();
vi.mock('../../services/users.service.js', () => ({
    findUserByEmail: (...args) => mockFindUserByEmail(...args),
    findFirmById: (...args) => mockFindFirmById(...args),
    createAdminUser: (...args) => mockCreateAdminUser(...args),
    findUserById: (...args) => mockFindUserById(...args),
    updateAdminUser: (...args) => mockUpdateAdminUser(...args),
    deleteUser: (...args) => mockDeleteUser(...args)
}));
vi.mock('../../services/passwordReset.service.js', () => ({
    PASSWORD_RESET_EMAIL_TYPES: {
        INVITE: 'invite',
        FORCE_CHANGE: 'force_change'
    },
    requestPasswordReset: (...args) => mockRequestPasswordReset(...args)
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
    updateAdminUserSchema: {},
    normalizeRequestBodyAliases: (payload = {}) => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return payload;
        }

        const normalized = { ...payload };

        if (normalized.firm_id !== undefined && normalized.firmId === undefined) {
            normalized.firmId = normalized.firm_id;
        }
        if (normalized.job_title !== undefined && normalized.jobTitle === undefined) {
            normalized.jobTitle = normalized.job_title;
        }

        return normalized;
    }
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'admin-123',
                email: 'admin@example.com',
                role: req.headers['x-test-role'] || 'admin',
                firm: 'Test Firm',
                firm_id: 'firm-123'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireUserManager: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'local_admin') {
            next();
        } else {
            res.status(403).json({ error: 'User manager access required' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') {
            next();
        } else {
            res.status(403).json({ error: 'Admin access required' });
        }
    },
    isUserAdmin: (req) => req.user?.role === 'admin',
    isUserLocalAdmin: (req) => req.user?.role === 'local_admin'
}));

vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmIdFromUser: (user) => user?.firm_id || user?.firmId || null
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
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockCreateAdminUser.mockResolvedValue({
                id: 'u-new',
                email: 'new@example.com',
                name: 'New User',
                role: 'user',
                status: 'active',
                firm_id: 'f-1',
                firm_name: 'Acme Corp'
            });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', name: 'New User', firmId: 'f-1' });

            expect(res.status).toBe(201);
            expect(res.body.email).toBe('new@example.com');
            expect(res.body.firmId).toBe('f-1');
            expect(res.body.firmName).toBe('Acme Corp');
            expect(res.body.invitationSent).toBe(true);
            expect(mockRequestPasswordReset).toHaveBeenCalledWith('new@example.com', expect.objectContaining({
                emailType: 'invite',
                markUserAsMustChangePassword: true
            }));
        });

        it('should create the user even if the invitation email fails', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockCreateAdminUser.mockResolvedValue({
                id: 'u-new',
                email: 'new@example.com',
                name: 'New User',
                role: 'user',
                status: 'active',
                firm_id: 'f-1',
                firm_name: 'Acme Corp'
            });
            mockRequestPasswordReset.mockRejectedValueOnce(new Error('SMTP down'));

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', name: 'New User', firmId: 'f-1' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('u-new');
            expect(res.body.invitationSent).toBe(false);
            expect(mockCreateAdminUser).toHaveBeenCalledTimes(1);
        });

        it('should return 409 if user already exists', async () => {
            mockFindUserByEmail.mockResolvedValueOnce({ id: 'u-existing' });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'existing@example.com', name: 'Existing', firmId: 'f-1' });

            expect(res.status).toBe(409);
            expect(res.body.error).toContain('already exists');
        });

        it('should return 400 if firm is missing on create', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', name: 'New User' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Firm ID selection is required');
        });

        it('should create user with firm association', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null); // no existing user
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' }); // firm lookup
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
                .send({ email: 'new@example.com', name: 'New User', firmId: 'f-1' });

            expect(res.status).toBe(201);
        });

        it('should normalize email, role, status and legacy firm_id on create', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockCreateAdminUser.mockResolvedValue({
                id: 'u-new',
                email: 'new@example.com',
                name: 'New User',
                role: 'admin',
                status: 'active'
            });

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({
                    email: 'NEW@Example.com',
                    name: 'New User',
                    firm_id: 'f-1',
                    role: 'Admin',
                    status: 'Active'
                });

            expect(res.status).toBe(201);
            expect(mockCreateAdminUser).toHaveBeenCalledWith(expect.objectContaining({
                email: 'new@example.com',
                role: 'admin',
                status: 'active',
                must_change_password: true,
                firm_id: 'f-1',
                firm_name: 'Acme Corp'
            }));
        });

        it('should return 400 if firm not found', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null); // no existing user
            mockFindFirmById.mockResolvedValueOnce(null); // firm not found

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', name: 'New User', firmId: 'firm-missing' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('not found');
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/auth/users')
                .set({ ...authHeader, 'x-test-role': 'user' })
                .send({ email: 'new@example.com', name: 'New User' });

            expect(res.status).toBe(403);
        });

        it('should return 500 on DB error', async () => {
            mockFindUserByEmail.mockResolvedValueOnce(null);
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockCreateAdminUser.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/auth/users')
                .set(authHeader)
                .send({ email: 'new@example.com', name: 'New User', firmId: 'f-1' });

            expect(res.status).toBe(500);
        });
    });

    describe('POST /api/auth/users/:id/force-password-reset', () => {
        it('should force password replacement and send email', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1',
                email: 'user@example.com',
                name: 'User'
            });

            const res = await request(app)
                .post('/api/auth/users/u-1/force-password-reset')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(200);
            expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@example.com', expect.objectContaining({
                emailType: 'force_change',
                markUserAsMustChangePassword: true
            }));
        });

        it('should return 404 when forcing password replacement on unknown user', async () => {
            mockFindUserById.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/auth/users/missing/force-password-reset')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(404);
        });
    });

    describe('PUT /api/auth/users/:id', () => {
        it('should update a user', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'old@example.com', name: 'Old Name', role: 'user', status: 'active'
            });
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockUpdateAdminUser.mockResolvedValue({
                id: 'u-1', email: 'old@example.com', name: 'New Name', role: 'user', status: 'active', firm_id: 'f-1', firm_name: 'Acme Corp'
            });

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({ name: 'New Name', firmId: 'f-1' });

            expect(res.status).toBe(200);
            expect(res.body.name).toBe('New Name');
            expect(res.body.firmId).toBe('f-1');
            expect(res.body.firmName).toBe('Acme Corp');
            expect(mockFindUserById).toHaveBeenCalledWith('u-1', { useCache: false });
        });

        it('should normalize updated email, role and status on update', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'old@example.com', name: 'Old Name', role: 'user', status: 'active'
            });
            mockFindFirmById.mockResolvedValueOnce({ id: 'f-1', name: 'Acme Corp' });
            mockUpdateAdminUser.mockResolvedValue({
                id: 'u-1', email: 'next@example.com', name: 'Old Name', role: 'admin', status: 'inactive'
            });

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({
                    email: 'NEXT@Example.com',
                    role: 'Admin',
                    status: 'Inactive',
                    firm_id: 'f-1'
                });

            expect(res.status).toBe(200);
            expect(mockUpdateAdminUser).toHaveBeenCalledWith('u-1', expect.objectContaining({
                email: 'next@example.com',
                role: 'admin',
                status: 'inactive',
                firm_id: 'f-1',
                firm_name: 'Acme Corp'
            }));
        });

        it('should return 404 if user not found', async () => {
            mockFindUserById.mockResolvedValueOnce(null);

            const res = await request(app)
                .put('/api/auth/users/nonexistent')
                .set(authHeader)
                .send({ name: 'Test' });

            expect(res.status).toBe(404);
        });

        it('should return 400 if firm is missing on update', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'test@example.com', name: 'Test', role: 'user', status: 'active'
            });

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({ name: 'New Name' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Firm ID selection is required');
        });

        it('should return 400 if selected firm does not exist on update', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1', email: 'test@example.com', name: 'Test', role: 'user', status: 'active'
            });
            mockFindFirmById.mockResolvedValueOnce(null);

            const res = await request(app)
                .put('/api/auth/users/u-1')
                .set(authHeader)
                .send({ firmId: 'firm-missing' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('not found');
        });
    });

    describe('DELETE /api/auth/users/:id', () => {
        it('should delete a user', async () => {
            mockFindUserById.mockResolvedValueOnce({
                id: 'u-1',
                email: 'user@example.com',
                role: 'user',
                firm_id: 'firm-123'
            });
            mockDeleteUser.mockResolvedValue(['u-1']);

            const res = await request(app)
                .delete('/api/auth/users/u-1')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.message).toContain('deleted');
            expect(mockFindUserById).toHaveBeenCalledWith('u-1', { useCache: false });
        });

        it('should prevent self-deletion', async () => {
            const res = await request(app)
                .delete('/api/auth/users/admin-123')
                .set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('own account');
        });

        it('should return 404 if user not found', async () => {
            mockFindUserById.mockResolvedValueOnce(null);

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
