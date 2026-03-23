/**
 * Tests for Consent routes
 * Authenticated: POST /initialize, POST /:resumeId/send, POST /:resumeId/resend,
 *                GET /:resumeId/status, POST /run-checks
 * Public: GET /respond/:token, POST /respond/:token
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock consent service
const mockInitializeConsent = vi.fn();
const mockSendConsentRequest = vi.fn();
const mockValidateConsentToken = vi.fn();
const mockRecordConsentResponse = vi.fn();
const mockGetConsentStatus = vi.fn();
const mockResendConsentRequest = vi.fn();
const mockMarkConsentError = vi.fn();
vi.mock('../../services/consent.service.js', () => ({
    initializeConsent: (...args) => mockInitializeConsent(...args),
    sendConsentRequest: (...args) => mockSendConsentRequest(...args),
    validateConsentToken: (...args) => mockValidateConsentToken(...args),
    recordConsentResponse: (...args) => mockRecordConsentResponse(...args),
    getConsentStatus: (...args) => mockGetConsentStatus(...args),
    resendConsentRequest: (...args) => mockResendConsentRequest(...args),
    markConsentError: (...args) => mockMarkConsentError(...args)
}));

// Mock scheduler service
const mockRunAllChecks = vi.fn();
vi.mock('../../services/scheduler.service.js', () => ({
    runAllChecks: (...args) => mockRunAllChecks(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    initializeConsentSchema: {},
    respondConsentSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
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

import consentRoutes from '../../routes/consent.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/consent', consentRoutes);
    return app;
}

describe('Consent Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // POST /api/consent/initialize
    // ==========================================
    describe('POST /initialize', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/consent/initialize')
                .send({ resumeId: 'res-1' });
            expect(res.status).toBe(401);
        });

        it('should initialize consent', async () => {
            mockInitializeConsent.mockResolvedValueOnce({
                resumeId: 'res-1',
                consentStatus: 'pending_consent',
                token: 'tok-abc'
            });

            const res = await request(app)
                .post('/api/consent/initialize')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    resumeId: 'res-1',
                    profileType: 'nominative',
                    candidateName: 'John Doe',
                    candidateEmail: 'john@example.com'
                });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.consent).toBeDefined();
        });

        it('should initialize consent with snake_case payload', async () => {
            mockInitializeConsent.mockResolvedValueOnce({
                resumeId: 'res-legacy',
                consentStatus: 'pending_consent',
                token: 'tok-legacy'
            });

            const res = await request(app)
                .post('/api/consent/initialize')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    resume_id: 'res-legacy',
                    profile_type: 'nominative',
                    candidate_name: 'John Doe',
                    candidate_email: 'john@example.com'
                });

            expect(res.status).toBe(200);
            expect(mockInitializeConsent).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'res-legacy',
                profileType: 'nominative',
                candidateName: 'John Doe',
                candidateEmail: 'john@example.com'
            }));
        });

        it('should return 400 if resumeId missing', async () => {
            const res = await request(app)
                .post('/api/consent/initialize')
                .set('Authorization', 'Bearer valid-token')
                .send({ profileType: 'nominative', candidateName: 'John' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Resume ID is required');
        });

        it('should return 400 if profileType missing', async () => {
            const res = await request(app)
                .post('/api/consent/initialize')
                .set('Authorization', 'Bearer valid-token')
                .send({ resumeId: 'res-1', candidateName: 'John' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Profile type is required');
        });

        it('should return 400 if candidateName missing', async () => {
            const res = await request(app)
                .post('/api/consent/initialize')
                .set('Authorization', 'Bearer valid-token')
                .send({ resumeId: 'res-1', profileType: 'nominative' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Candidate name is required');
        });
    });

    // ==========================================
    // POST /api/consent/:resumeId/send
    // ==========================================
    describe('POST /:resumeId/send', () => {
        it('should send consent request email', async () => {
            mockSendConsentRequest.mockResolvedValueOnce({ sentTo: 'john@example.com' });

            const res = await request(app)
                .post('/api/consent/res-1/send')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.sentTo).toBe('john@example.com');
        });

        it('should return 400 on send failure', async () => {
            mockSendConsentRequest.mockRejectedValueOnce(new Error('No email configured'));

            const res = await request(app)
                .post('/api/consent/res-1/send')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // POST /api/consent/:resumeId/resend
    // ==========================================
    describe('POST /:resumeId/resend', () => {
        it('should resend consent request', async () => {
            mockResendConsentRequest.mockResolvedValueOnce({ sentTo: 'john@example.com' });

            const res = await request(app)
                .post('/api/consent/res-1/resend')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('resent');
        });

        it('should return 400 on failure', async () => {
            mockResendConsentRequest.mockRejectedValueOnce(new Error('Resume not found'));

            const res = await request(app)
                .post('/api/consent/res-1/resend')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // GET /api/consent/:resumeId/status
    // ==========================================
    describe('GET /:resumeId/status', () => {
        it('should return consent status', async () => {
            mockGetConsentStatus.mockResolvedValueOnce({
                consentStatus: 'active',
                retentionUntil: '2027-01-15T10:00:00Z'
            });

            const res = await request(app)
                .get('/api/consent/res-1/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.consent.consentStatus).toBe('active');
        });

        it('should return 400 on error', async () => {
            mockGetConsentStatus.mockRejectedValueOnce(new Error('Resume not found'));

            const res = await request(app)
                .get('/api/consent/res-1/status')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // POST /api/consent/run-checks (admin only)
    // ==========================================
    describe('POST /run-checks', () => {
        it('should run checks as admin', async () => {
            mockRunAllChecks.mockResolvedValueOnce({ expired: 2, purged: 1 });

            const res = await request(app)
                .post('/api/consent/run-checks')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.results).toBeDefined();
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/consent/run-checks')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user');

            expect(res.status).toBe(403);
        });

        it('should return 500 on error', async () => {
            mockRunAllChecks.mockRejectedValueOnce(new Error('Scheduler error'));

            const res = await request(app)
                .post('/api/consent/run-checks')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to run consent checks');
        });
    });

    // ==========================================
    // GET /api/consent/respond/:token (PUBLIC)
    // ==========================================
    describe('GET /respond/:token', () => {
        it('should return consent info for valid token', async () => {
            mockValidateConsentToken.mockResolvedValueOnce({
                candidate_name: 'John Doe',
                firm_name: 'Test Firm',
                firm_logo: 'https://example.com/logo.png'
            });

            const res = await request(app)
                .get('/api/consent/respond/valid-token-123');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.candidateName).toBe('John Doe');
            expect(res.body.firmName).toBe('Test Firm');
        });

        it('should return 404 for invalid token', async () => {
            mockValidateConsentToken.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/consent/respond/invalid-token');

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('INVALID_TOKEN');
        });

        it('should return 410 for expired token', async () => {
            mockValidateConsentToken.mockResolvedValueOnce({ expired: true });

            const res = await request(app)
                .get('/api/consent/respond/expired-token');

            expect(res.status).toBe(410);
            expect(res.body.code).toBe('TOKEN_EXPIRED');
        });

        it('should return 409 for already processed token', async () => {
            mockValidateConsentToken.mockResolvedValueOnce({
                alreadyProcessed: true,
                consent_status: 'active'
            });

            const res = await request(app)
                .get('/api/consent/respond/processed-token');

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ALREADY_PROCESSED');
        });
    });

    // ==========================================
    // POST /api/consent/respond/:token (PUBLIC)
    // ==========================================
    describe('POST /respond/:token', () => {
        it('should accept consent', async () => {
            mockRecordConsentResponse.mockResolvedValueOnce({
                consent_status: 'active',
                retention_until: '2027-01-15T10:00:00Z'
            });

            const res = await request(app)
                .post('/api/consent/respond/valid-token')
                .send({ action: 'accept' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.status).toBe('active');
            expect(mockRecordConsentResponse).toHaveBeenCalledWith('valid-token', true);
        });

        it('should refuse consent', async () => {
            mockRecordConsentResponse.mockResolvedValueOnce({
                consent_status: 'refused',
                retention_until: null
            });

            const res = await request(app)
                .post('/api/consent/respond/valid-token')
                .send({ action: 'refuse' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('refused');
            expect(mockRecordConsentResponse).toHaveBeenCalledWith('valid-token', false);
        });

        it('should return 400 for invalid action', async () => {
            const res = await request(app)
                .post('/api/consent/respond/valid-token')
                .send({ action: 'invalid' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('accept');
        });

        it('should return 400 for missing action', async () => {
            const res = await request(app)
                .post('/api/consent/respond/valid-token')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 410 for expired token error', async () => {
            mockRecordConsentResponse.mockRejectedValueOnce(new Error('Consent token has expired'));

            const res = await request(app)
                .post('/api/consent/respond/expired-token')
                .send({ action: 'accept' });

            expect(res.status).toBe(410);
            expect(res.body.code).toBe('TOKEN_EXPIRED');
        });

        it('should return 409 for already processed error', async () => {
            mockRecordConsentResponse.mockRejectedValueOnce(
                new Error('Consent has already been processed')
            );

            const res = await request(app)
                .post('/api/consent/respond/processed-token')
                .send({ action: 'accept' });

            expect(res.status).toBe(409);
            expect(res.body.code).toBe('ALREADY_PROCESSED');
        });

        it('should return 404 for invalid token error', async () => {
            // Use a message that contains 'Invalid' but NOT 'expired'
            // (the route checks 'expired' first, so 'Invalid or expired' would match 410)
            mockRecordConsentResponse.mockRejectedValueOnce(
                new Error('Invalid consent token')
            );

            const res = await request(app)
                .post('/api/consent/respond/bad-token')
                .send({ action: 'accept' });

            expect(res.status).toBe(404);
            expect(res.body.code).toBe('INVALID_TOKEN');
        });
    });
});
