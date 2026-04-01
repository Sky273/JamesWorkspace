/**
 * Tests for Mail routes
 * GET /status, GET /auth/gmail, GET /callback/gmail,
 * POST /draft, DELETE /disconnect
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock mail service
const mockGetConnectionStatus = vi.fn();
const mockGetAuthUrl = vi.fn();
const mockHandleOAuthCallback = vi.fn();
const mockCreateDraft = vi.fn();
const mockDisconnect = vi.fn();
const mockGetUserWithFirmData = vi.fn();
const mockGetResumeCurrentVersion = vi.fn();
const mockRecordSubmission = vi.fn();
vi.mock('../../services/mail/mailService.js', () => ({
    getConnectionStatus: (...args) => mockGetConnectionStatus(...args),
    getAuthUrl: (...args) => mockGetAuthUrl(...args),
    handleOAuthCallback: (...args) => mockHandleOAuthCallback(...args),
    createDraft: (...args) => mockCreateDraft(...args),
    disconnect: (...args) => mockDisconnect(...args),
    getUserWithFirmData: (...args) => mockGetUserWithFirmData(...args),
    getResumeCurrentVersion: (...args) => mockGetResumeCurrentVersion(...args),
    recordSubmission: (...args) => mockRecordSubmission(...args)
}));

// Mock email templates service
const mockGetTemplate = vi.fn();
const mockRenderTemplate = vi.fn();
vi.mock('../../services/emailTemplates.service.js', () => ({
    getTemplate: (...args) => mockGetTemplate(...args),
    renderTemplate: (...args) => mockRenderTemplate(...args)
}));

const mockValidateResume = vi.fn();
const mockValidateClient = vi.fn();
const mockValidateContact = vi.fn();
const mockValidateMission = vi.fn();
vi.mock('../../services/resumeSubmissions.service.js', () => ({
    validateResume: (...args) => mockValidateResume(...args),
    validateClient: (...args) => mockValidateClient(...args),
    validateContact: (...args) => mockValidateContact(...args),
    validateMission: (...args) => mockValidateMission(...args)
}));

const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    createMailDraftSchema: {}
}));

// Mock crypto
vi.mock('crypto', () => ({
    default: { randomBytes: () => ({ toString: () => 'state-token-abc' }) },
    randomBytes: () => ({ toString: () => 'state-token-abc' })
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
                role: 'user',
                firm: 'Test Firm',
                customer: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import mailRoutes from '../../routes/mail.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/mail', mailRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Mail Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        mockGetTemplate.mockResolvedValue({ id: 'tpl-1', firm_id: 'firm-123', is_system: false });
        mockRenderTemplate.mockResolvedValue({ subject: 'Rendered', html: '<p>Rendered</p>' });
        mockValidateResume.mockResolvedValue({ exists: true, firmMatch: true });
        mockValidateClient.mockResolvedValue({ exists: true, firmMatch: true });
        mockValidateContact.mockResolvedValue(true);
        mockValidateMission.mockResolvedValue({ exists: true, firmMatch: true });
        app = createTestApp();
    });

    // ==========================================
    // GET /status
    // ==========================================
    describe('GET /status', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/mail/status');
            expect(res.status).toBe(401);
        });

        it('should return connection status', async () => {
            mockGetConnectionStatus.mockResolvedValueOnce({
                connected: true,
                provider: 'gmail',
                email: 'user@gmail.com'
            });

            const res = await request(app).get('/api/mail/status').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.connected).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockGetConnectionStatus.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app).get('/api/mail/status').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /auth/gmail
    // ==========================================
    describe('GET /auth/gmail', () => {
        it('should return auth URL', async () => {
            mockGetAuthUrl.mockResolvedValueOnce('https://accounts.google.com/...');

            const res = await request(app).get('/api/mail/auth/gmail').set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.authUrl).toBeDefined();
        });

        it('should return 500 on error', async () => {
            mockGetAuthUrl.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app).get('/api/mail/auth/gmail').set(AUTH);
            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /callback/gmail (PUBLIC)
    // ==========================================
    describe('GET /callback/gmail', () => {
        it('should redirect on OAuth error', async () => {
            const res = await request(app)
                .get('/api/mail/callback/gmail?error=access_denied');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('mail_error');
        });

        it('should redirect on invalid state', async () => {
            const res = await request(app)
                .get('/api/mail/callback/gmail?code=abc&state=invalid');
            expect(res.status).toBe(302);
            expect(res.headers.location).toContain('invalid_state');
        });
    });

    // ==========================================
    // POST /draft
    // ==========================================
    describe('POST /draft', () => {
        it('should return 400 without recipient', async () => {
            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({ subject: 'Test' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('to');
        });

        it('should return 400 without subject', async () => {
            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({ to: 'test@test.com' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Subject');
        });

        it('should create draft successfully', async () => {
            mockCreateDraft.mockResolvedValueOnce({
                draftId: 'draft-123',
                webLink: 'https://mail.google.com/draft/123'
            });

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({ to: 'client@test.com', subject: 'CV Submission', body: '<p>Hello</p>' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.draftId).toBe('draft-123');
        });

        it('should record submission if resumeId/clientId/contactId provided', async () => {
            mockCreateDraft.mockResolvedValueOnce({ draftId: 'd-1', webLink: 'link' });
            mockGetResumeCurrentVersion.mockResolvedValueOnce(3);
            mockRecordSubmission.mockResolvedValueOnce('sub-1');

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'CV',
                    body: 'Hi',
                    resumeId: '00000000-0000-0000-0000-000000000001',
                    clientId: '00000000-0000-0000-0000-000000000002',
                    contactId: '00000000-0000-0000-0000-000000000003'
                });

            expect(res.status).toBe(200);
            expect(res.body.submissionId).toBe('sub-1');
            expect(mockRecordSubmission).toHaveBeenCalledWith(
                expect.objectContaining({
                    resumeId: '00000000-0000-0000-0000-000000000001',
                    clientId: '00000000-0000-0000-0000-000000000002',
                    contactId: '00000000-0000-0000-0000-000000000003',
                    firmId: 'firm-123'
                })
            );
        });

        it('should reject submission tracking without firm association', async () => {
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'CV',
                    body: 'Hi',
                    resumeId: '00000000-0000-0000-0000-000000000001'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('No firm association');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should reject tracking when linked resume belongs to another firm', async () => {
            mockValidateResume.mockResolvedValueOnce({ exists: true, firmMatch: false });

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'CV',
                    body: 'Hi',
                    resumeId: '00000000-0000-0000-0000-000000000001',
                    clientId: '00000000-0000-0000-0000-000000000002',
                    contactId: '00000000-0000-0000-0000-000000000003'
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Resume does not belong to your firm');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should reject tracking when contact does not belong to client', async () => {
            mockValidateContact.mockResolvedValueOnce(false);

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'CV',
                    body: 'Hi',
                    resumeId: '00000000-0000-0000-0000-000000000001',
                    clientId: '00000000-0000-0000-0000-000000000002',
                    contactId: '00000000-0000-0000-0000-000000000003'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Contact not found');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should reject foreign-firm template access', async () => {
            mockGetTemplate.mockResolvedValueOnce({ id: 'tpl-2', firm_id: 'other-firm', is_system: false });

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'Fallback',
                    templateId: 'tpl-2',
                    templateContext: { user: {}, firm: {} }
                });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Template does not belong to your firm');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should reject missing template context', async () => {
            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'Fallback',
                    templateId: 'tpl-1'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Template context is required when templateId is provided');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should stop on template rendering error', async () => {
            mockRenderTemplate.mockRejectedValueOnce(new Error('MJML failed'));

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'Fallback',
                    templateId: 'tpl-1',
                    templateContext: { user: {}, firm: {} }
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Failed to render template');
            expect(mockCreateDraft).not.toHaveBeenCalled();
        });

        it('should render accessible template before draft creation', async () => {
            mockGetUserWithFirmData.mockResolvedValueOnce({
                name: 'User',
                email: 'user@test.com',
                job_title: 'Consultant',
                phone: '123',
                firm_name: 'Test Firm',
                firm_logo: '/logo.png'
            });
            mockCreateDraft.mockResolvedValueOnce({ draftId: 'draft-123', webLink: 'https://mail.google.com/draft/123' });

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    templateId: 'tpl-1',
                    templateContext: { user: {}, firm: {} }
                });

            expect(res.status).toBe(200);
            expect(mockRenderTemplate).toHaveBeenCalledWith('tpl-1', expect.objectContaining({
                user: expect.objectContaining({ name: 'User' }),
                firm: expect.objectContaining({ name: 'Test Firm' })
            }));
        });

        it('should return 401 on auth error from provider', async () => {
            mockCreateDraft.mockRejectedValueOnce(new Error('Invalid token'));

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({ to: 'test@test.com', subject: 'Test', body: 'Hi' });

            expect(res.status).toBe(401);
            expect(res.body.needsReauth).toBe(true);
        });

        it('should return 500 on general error', async () => {
            mockCreateDraft.mockRejectedValueOnce(new Error('Unknown error'));

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({ to: 'test@test.com', subject: 'Test', body: 'Hi' });

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // DELETE /disconnect
    // ==========================================
    describe('DELETE /disconnect', () => {
        it('should disconnect provider', async () => {
            mockDisconnect.mockResolvedValueOnce();

            const res = await request(app)
                .delete('/api/mail/disconnect')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 500 on error', async () => {
            mockDisconnect.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .delete('/api/mail/disconnect')
                .set(AUTH);
            expect(res.status).toBe(500);
        });
    });
});
