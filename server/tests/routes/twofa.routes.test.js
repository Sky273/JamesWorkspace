/**
 * Tests for 2FA (Two-Factor Authentication) routes
 * GET /status, POST /setup, POST /verify, POST /disable, POST /backup-codes/regenerate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock TOTP service
const mockGenerateTotpSecret = vi.fn();
const mockVerifyAndEnable2FA = vi.fn();
const mockGet2FAStatus = vi.fn();
const mockDisable2FA = vi.fn();
const mockRegenerateBackupCodes = vi.fn();
vi.mock('../../services/totp.service.js', () => ({
    generateTotpSecret: (...args) => mockGenerateTotpSecret(...args),
    verifyAndEnable2FA: (...args) => mockVerifyAndEnable2FA(...args),
    get2FAStatus: (...args) => mockGet2FAStatus(...args),
    disable2FA: (...args) => mockDisable2FA(...args),
    regenerateBackupCodes: (...args) => mockRegenerateBackupCodes(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    totpCodeSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
                role: 'user'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import twofaRoutes from '../../routes/twofa.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/2fa', twofaRoutes);
    return app;
}

describe('2FA Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // GET /api/2fa/status
    // ==========================================
    describe('GET /status', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/2fa/status');
            expect(res.status).toBe(401);
        });

        it('should return 2FA status', async () => {
            mockGet2FAStatus.mockResolvedValueOnce({
                enabled: true,
                hasBackupCodes: true,
                backupCodesRemaining: 8
            });

            const res = await request(app)
                .get('/api/2fa/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.enabled).toBe(true);
            expect(res.body.hasBackupCodes).toBe(true);
            expect(mockGet2FAStatus).toHaveBeenCalledWith('user-123');
        });

        it('should return 500 on error', async () => {
            mockGet2FAStatus.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/2fa/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to get 2FA status');
        });
    });

    // ==========================================
    // POST /api/2fa/setup
    // ==========================================
    describe('POST /setup', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/2fa/setup');
            expect(res.status).toBe(401);
        });

        it('should generate TOTP secret and QR code', async () => {
            mockGenerateTotpSecret.mockResolvedValueOnce({
                secret: 'JBSWY3DPEHPK3PXP',
                qrCodeDataUrl: 'data:image/png;base64,abc123',
                backupCodes: ['CODE1', 'CODE2', 'CODE3']
            });

            const res = await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.secret).toBeDefined();
            expect(res.body.qrCodeDataUrl).toContain('data:image');
            expect(res.body.backupCodes).toHaveLength(3);
            expect(res.body.message).toBeDefined();
            expect(mockGenerateTotpSecret).toHaveBeenCalledWith('user-123', 'user@test.com');
        });

        it('should return 500 on error', async () => {
            mockGenerateTotpSecret.mockRejectedValueOnce(new Error('Crypto error'));

            const res = await request(app)
                .post('/api/2fa/setup')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to setup 2FA');
        });
    });

    // ==========================================
    // POST /api/2fa/verify
    // ==========================================
    describe('POST /verify', () => {
        it('should verify and enable 2FA with valid code', async () => {
            mockVerifyAndEnable2FA.mockResolvedValueOnce({
                success: true,
                message: '2FA activé avec succès'
            });

            const res = await request(app)
                .post('/api/2fa/verify')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockVerifyAndEnable2FA).toHaveBeenCalledWith('user-123', '123456');
        });

        it('should return 400 for invalid code', async () => {
            mockVerifyAndEnable2FA.mockResolvedValueOnce({
                success: false,
                message: 'Code invalide'
            });

            const res = await request(app)
                .post('/api/2fa/verify')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '000000' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should return 400 for too-short code', async () => {
            const res = await request(app)
                .post('/api/2fa/verify')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('6 chiffres');
        });

        it('should normalize code with spaces', async () => {
            mockVerifyAndEnable2FA.mockResolvedValueOnce({ success: true });

            const res = await request(app)
                .post('/api/2fa/verify')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123 456' });

            expect(res.status).toBe(200);
            expect(mockVerifyAndEnable2FA).toHaveBeenCalledWith('user-123', '123456');
        });

        it('should return 500 on service error', async () => {
            mockVerifyAndEnable2FA.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/2fa/verify')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to verify 2FA');
        });
    });

    // ==========================================
    // POST /api/2fa/disable
    // ==========================================
    describe('POST /disable', () => {
        it('should disable 2FA with valid code', async () => {
            mockDisable2FA.mockResolvedValueOnce({
                success: true,
                message: '2FA désactivé'
            });

            const res = await request(app)
                .post('/api/2fa/disable')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockDisable2FA).toHaveBeenCalledWith('user-123', '123456');
        });

        it('should return 400 without code', async () => {
            const res = await request(app)
                .post('/api/2fa/disable')
                .set('Authorization', 'Bearer valid-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Code requis');
        });

        it('should return 400 for invalid code', async () => {
            mockDisable2FA.mockResolvedValueOnce({
                success: false,
                message: 'Code invalide'
            });

            const res = await request(app)
                .post('/api/2fa/disable')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '000000' });

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it('should return 500 on service error', async () => {
            mockDisable2FA.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/2fa/disable')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to disable 2FA');
        });
    });

    // ==========================================
    // POST /api/2fa/backup-codes/regenerate
    // ==========================================
    describe('POST /backup-codes/regenerate', () => {
        it('should regenerate backup codes', async () => {
            mockRegenerateBackupCodes.mockResolvedValueOnce({
                success: true,
                backupCodes: ['NEW1', 'NEW2', 'NEW3']
            });

            const res = await request(app)
                .post('/api/2fa/backup-codes/regenerate')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.backupCodes).toHaveLength(3);
        });

        it('should return 400 without code', async () => {
            const res = await request(app)
                .post('/api/2fa/backup-codes/regenerate')
                .set('Authorization', 'Bearer valid-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Code requis');
        });

        it('should return 400 for invalid code', async () => {
            mockRegenerateBackupCodes.mockResolvedValueOnce({
                success: false,
                message: 'Code invalide'
            });

            const res = await request(app)
                .post('/api/2fa/backup-codes/regenerate')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '000000' });

            expect(res.status).toBe(400);
        });

        it('should return 500 on service error', async () => {
            mockRegenerateBackupCodes.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/2fa/backup-codes/regenerate')
                .set('Authorization', 'Bearer valid-token')
                .send({ code: '123456' });

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to regenerate backup codes');
        });
    });
});
