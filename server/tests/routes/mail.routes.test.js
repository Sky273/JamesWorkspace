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
vi.mock('../../services/mail/mailService.js', () => ({
    getConnectionStatus: (...args) => mockGetConnectionStatus(...args),
    getAuthUrl: (...args) => mockGetAuthUrl(...args),
    handleOAuthCallback: (...args) => mockHandleOAuthCallback(...args),
    createDraft: (...args) => mockCreateDraft(...args),
    disconnect: (...args) => mockDisconnect(...args)
}));

// Mock email templates service
vi.mock('../../services/emailTemplates.service.js', () => ({
    renderTemplate: vi.fn().mockResolvedValue({ subject: 'Rendered', html: '<p>Rendered</p>' })
}));

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
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
            // User query for template enrichment is skipped (no templateId)
            // Client query
            mockQuery.mockResolvedValueOnce({ rows: [{ firm_id: 'f-1' }] });
            // Version query
            mockQuery.mockResolvedValueOnce({ rows: [{ max_version: 3 }] });
            // Insert submission
            mockQuery.mockResolvedValueOnce({ rows: [{ id: 'sub-1' }] });

            const res = await request(app)
                .post('/api/mail/draft')
                .set(AUTH)
                .send({
                    to: 'client@test.com',
                    subject: 'CV',
                    body: 'Hi',
                    resumeId: 'r-1',
                    clientId: 'c-1',
                    contactId: 'ct-1'
                });

            expect(res.status).toBe(200);
            expect(res.body.submissionId).toBe('sub-1');
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
