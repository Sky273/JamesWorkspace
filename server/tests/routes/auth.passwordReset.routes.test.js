/**
 * Tests for Password Reset routes
 * POST /forgot-password, POST /reset-password
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock password reset service
const mockRequestPasswordReset = vi.fn();
const mockResetPassword = vi.fn();
vi.mock('../../services/passwordReset.service.js', () => ({
    requestPasswordReset: (...args) => mockRequestPasswordReset(...args),
    resetPassword: (...args) => mockResetPassword(...args)
}));

// Mock security
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: () => ({ ip: '127.0.0.1' }),
    LOG_LEVELS: { INFO: 'info', WARNING: 'warning', SECURITY: 'security' },
    SECURITY_EVENTS: { AUTH_SUCCESS: 'auth_success', AUTH_FAILURE: 'auth_failure' }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock rate limit
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    authLimiter: (req, res, next) => next()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    forgotPasswordSchema: {},
    resetPasswordSchema: {}
}));

import passwordResetRoutes from '../../routes/auth/passwordReset.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/auth', passwordResetRoutes);
    return app;
}

describe('Password Reset Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // POST /forgot-password
    // ==========================================
    describe('POST /forgot-password', () => {
        it('should always return 200 (prevent email enumeration)', async () => {
            mockRequestPasswordReset.mockResolvedValueOnce();

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'user@test.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@test.com');
        });

        it('should return 200 even on error (prevent enumeration)', async () => {
            mockRequestPasswordReset.mockRejectedValueOnce(new Error('User not found'));

            const res = await request(app)
                .post('/api/auth/forgot-password')
                .send({ email: 'nonexistent@test.com' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    // ==========================================
    // POST /reset-password
    // ==========================================
    describe('POST /reset-password', () => {
        it('should reset password successfully', async () => {
            mockResetPassword.mockResolvedValueOnce({ success: true });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'valid-token', password: 'NewPassword123!' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 400 for invalid token', async () => {
            mockResetPassword.mockResolvedValueOnce({
                success: false,
                error: 'invalid_token'
            });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'bad-token', password: 'NewPassword123!' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.code).toBe('invalid_token');
        });

        it('should return 400 for used token', async () => {
            mockResetPassword.mockResolvedValueOnce({
                success: false,
                error: 'token_used'
            });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'used-token', password: 'NewPassword123!' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('token_used');
        });

        it('should return 400 for expired token', async () => {
            mockResetPassword.mockResolvedValueOnce({
                success: false,
                error: 'token_expired'
            });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'expired-token', password: 'NewPassword123!' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('token_expired');
        });

        it('should return 400 for inactive account', async () => {
            mockResetPassword.mockResolvedValueOnce({
                success: false,
                error: 'account_inactive'
            });

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'valid-token', password: 'NewPassword123!' });

            expect(res.status).toBe(400);
            expect(res.body.code).toBe('account_inactive');
        });

        it('should return 500 on server error', async () => {
            mockResetPassword.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/auth/reset-password')
                .send({ token: 'valid-token', password: 'NewPassword123!' });

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
        });
    });
});
