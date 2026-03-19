/**
 * Tests for Email Templates routes
 * GET /, GET /keywords, GET /default, GET /:id, POST /, PUT /:id, DELETE /:id,
 * POST /:id/duplicate, POST /:id/preview, POST /compile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock emailTemplates service
const mockGetTemplates = vi.fn();
const mockGetTemplate = vi.fn();
const mockGetDefaultTemplate = vi.fn();
const mockCreateTemplate = vi.fn();
const mockUpdateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockDuplicateTemplate = vi.fn();
const mockRenderTemplate = vi.fn();
const mockPreviewTemplate = vi.fn();
vi.mock('../../services/emailTemplates.service.js', () => ({
    getTemplates: (...args) => mockGetTemplates(...args),
    getTemplate: (...args) => mockGetTemplate(...args),
    getDefaultTemplate: (...args) => mockGetDefaultTemplate(...args),
    createTemplate: (...args) => mockCreateTemplate(...args),
    updateTemplate: (...args) => mockUpdateTemplate(...args),
    deleteTemplate: (...args) => mockDeleteTemplate(...args),
    duplicateTemplate: (...args) => mockDuplicateTemplate(...args),
    renderTemplate: (...args) => mockRenderTemplate(...args),
    previewTemplate: (...args) => mockPreviewTemplate(...args),
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    getFirmIdByName: (...args) => mockGetFirmIdByName(...args),
    TEMPLATE_KEYWORDS: [
        { key: '{{candidate_name}}', description: 'Candidate name' },
        { key: '{{firm_name}}', description: 'Firm name' }
    ]
}));

// Mock firm lookup helpers (declared after vi.mock references them)
const mockGetUserFirmId = vi.fn();
const mockGetFirmIdByName = vi.fn();

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateParams: () => (req, res, next) => next(),
    validateBody: () => (req, res, next) => next()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            const role = req.headers['x-test-role'] || 'admin';
            const noFirm = req.headers['x-test-no-firm'] === 'true';
            req.user = {
                id: 'user-123',
                email: 'user@test.com',
                role,
                ...(noFirm ? {} : { firm_id: 'firm-123', firm: 'Test Firm' })
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import emailTemplateRoutes from '../../routes/emailTemplates.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/email-templates', emailTemplateRoutes);
    return app;
}

const sampleTemplate = {
    id: 'et-123',
    name: 'Welcome Email',
    description: 'Welcome template',
    firm_id: 'firm-123',
    subject_template: 'Hello {{candidate_name}}',
    mjml_content: '<mjml><mj-body></mj-body></mjml>',
    html_content: '<html></html>',
    is_system: false,
    is_default: false
};

describe('Email Templates Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        // Default: getFirmIdForUser resolves via user.firm_id (no DB fallback needed)
        mockGetUserFirmId.mockResolvedValue(null);
        mockGetFirmIdByName.mockResolvedValue(null);
    });

    // ==========================================
    // GET /api/email-templates
    // ==========================================
    describe('GET /', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/email-templates');
            expect(res.status).toBe(401);
        });

        it('should return templates for authenticated user', async () => {
            mockGetTemplates.mockResolvedValueOnce([sampleTemplate]);

            const res = await request(app)
                .get('/api/email-templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.templates).toHaveLength(1);
            expect(res.body.templates[0].name).toBe('Welcome Email');
        });

        it('should return empty list for non-admin without firm', async () => {
            // Simulate no firm found for any DB lookup strategy
            mockGetUserFirmId.mockResolvedValueOnce(null);
            mockGetFirmIdByName.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/email-templates')
                .set('Authorization', 'Bearer valid-token')
                .set('x-test-role', 'user')
                .set('x-test-no-firm', 'true');

            expect(res.status).toBe(200);
            expect(res.body.templates).toEqual([]);
        });

        it('should return 500 on service error', async () => {
            mockGetTemplates.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/email-templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch email templates');
        });
    });

    // ==========================================
    // GET /api/email-templates/keywords
    // ==========================================
    describe('GET /keywords', () => {
        it('should return template keywords', async () => {
            const res = await request(app)
                .get('/api/email-templates/keywords')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.keywords).toBeInstanceOf(Array);
            expect(res.body.keywords.length).toBeGreaterThan(0);
        });
    });

    // ==========================================
    // GET /api/email-templates/default
    // ==========================================
    describe('GET /default', () => {
        it('should return default template', async () => {
            mockGetDefaultTemplate.mockResolvedValueOnce(sampleTemplate);

            const res = await request(app)
                .get('/api/email-templates/default')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.template).toBeDefined();
        });

        it('should return 404 if no default template', async () => {
            mockGetDefaultTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/email-templates/default')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('No default template found');
        });
    });

    // ==========================================
    // GET /api/email-templates/:id
    // ==========================================
    describe('GET /:id', () => {
        it('should return template by ID', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);

            const res = await request(app)
                .get('/api/email-templates/et-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.template.id).toBe('et-123');
        });

        it('should return 404 if not found', async () => {
            mockGetTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/email-templates/et-missing')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should return 403 if template belongs to another firm', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, firm_id: 'other-firm' });

            const res = await request(app)
                .get('/api/email-templates/et-other')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied to this template');
        });

        it('should allow access to system templates (firm_id null)', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, firm_id: null });

            const res = await request(app)
                .get('/api/email-templates/et-sys')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
        });
    });

    // ==========================================
    // POST /api/email-templates
    // ==========================================
    describe('POST /', () => {
        const newBody = {
            name: 'New Template',
            subjectTemplate: 'Subject {{candidate_name}}',
            mjmlContent: '<mjml><mj-body></mj-body></mjml>'
        };

        it('should create template', async () => {
            mockCreateTemplate.mockResolvedValueOnce({ ...sampleTemplate, id: 'et-new' });

            const res = await request(app)
                .post('/api/email-templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newBody);

            expect(res.status).toBe(201);
            expect(res.body.template).toBeDefined();
            expect(mockCreateTemplate).toHaveBeenCalledWith(
                'firm-123',
                expect.objectContaining({ name: 'New Template' }),
                'user-123'
            );
        });

        it('should return 400 if required fields missing', async () => {
            const res = await request(app)
                .post('/api/email-templates')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Missing fields' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('required');
        });

        it('should return 500 on service error', async () => {
            mockCreateTemplate.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .post('/api/email-templates')
                .set('Authorization', 'Bearer valid-token')
                .send(newBody);

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to create email template');
        });
    });

    // ==========================================
    // PUT /api/email-templates/:id
    // ==========================================
    describe('PUT /:id', () => {
        const updateBody = {
            name: 'Updated',
            subjectTemplate: 'Updated subject',
            mjmlContent: '<mjml><mj-body>updated</mj-body></mjml>'
        };

        it('should update template', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);
            mockUpdateTemplate.mockResolvedValueOnce({ ...sampleTemplate, name: 'Updated' });

            const res = await request(app)
                .put('/api/email-templates/et-123')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(200);
        });

        it('should return 404 if not found', async () => {
            mockGetTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .put('/api/email-templates/et-missing')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(404);
        });

        it('should return 403 for system template', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, is_system: true });

            const res = await request(app)
                .put('/api/email-templates/et-sys')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Cannot modify system template');
        });

        it('should return 403 for another firms template', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, firm_id: 'other-firm' });

            const res = await request(app)
                .put('/api/email-templates/et-other')
                .set('Authorization', 'Bearer valid-token')
                .send(updateBody);

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied to this template');
        });

        it('should return 400 if required fields missing', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);

            const res = await request(app)
                .put('/api/email-templates/et-123')
                .set('Authorization', 'Bearer valid-token')
                .send({ name: 'Missing fields' });

            expect(res.status).toBe(400);
        });
    });

    // ==========================================
    // DELETE /api/email-templates/:id
    // ==========================================
    describe('DELETE /:id', () => {
        it('should delete template', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);
            mockDeleteTemplate.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/email-templates/et-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it('should return 404 if not found', async () => {
            mockGetTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .delete('/api/email-templates/et-missing')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should allow admin to delete system template', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, is_system: true, is_default: true });
            mockDeleteTemplate.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/email-templates/et-sys')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(mockDeleteTemplate).toHaveBeenCalledWith('et-sys', { isAdmin: true });
        });

        it('should return 403 for non-admin deleting system template', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, is_system: true });

            const res = await request(app)
                .delete('/api/email-templates/et-sys')
                .set({ 'Authorization': 'Bearer valid-token', 'x-test-role': 'user' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Cannot delete system template');
        });

        it('should return 403 for another firms template', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, firm_id: 'other-firm' });

            const res = await request(app)
                .delete('/api/email-templates/et-other')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(403);
        });
    });

    // ==========================================
    // POST /api/email-templates/:id/duplicate
    // ==========================================
    describe('POST /:id/duplicate', () => {
        it('should duplicate template', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);
            mockDuplicateTemplate.mockResolvedValueOnce({ ...sampleTemplate, id: 'et-dup' });

            const res = await request(app)
                .post('/api/email-templates/et-123/duplicate')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(201);
            expect(mockDuplicateTemplate).toHaveBeenCalledWith('et-123', 'firm-123', 'user-123');
        });

        it('should return 404 if original not found', async () => {
            mockGetTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/email-templates/et-missing/duplicate')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
        });

        it('should return 403 if original belongs to another firm', async () => {
            mockGetTemplate.mockResolvedValueOnce({ ...sampleTemplate, firm_id: 'other-firm' });

            const res = await request(app)
                .post('/api/email-templates/et-other/duplicate')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(403);
        });
    });

    // ==========================================
    // POST /api/email-templates/:id/preview
    // ==========================================
    describe('POST /:id/preview', () => {
        it('should render template preview', async () => {
            mockGetTemplate.mockResolvedValueOnce(sampleTemplate);
            mockRenderTemplate.mockResolvedValueOnce({
                html: '<html>Rendered</html>',
                subject: 'Hello John'
            });

            const res = await request(app)
                .post('/api/email-templates/et-123/preview')
                .set('Authorization', 'Bearer valid-token')
                .send({ context: { candidate_name: 'John' } });

            expect(res.status).toBe(200);
            expect(res.body.html).toBeDefined();
        });

        it('should return 404 if template not found', async () => {
            mockGetTemplate.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/email-templates/et-missing/preview')
                .set('Authorization', 'Bearer valid-token')
                .send({ context: {} });

            expect(res.status).toBe(404);
        });
    });

    // ==========================================
    // POST /api/email-templates/compile
    // ==========================================
    describe('POST /compile', () => {
        it('should compile MJML to HTML', async () => {
            mockPreviewTemplate.mockResolvedValueOnce({
                html: '<html>compiled</html>',
                subject: 'Test'
            });

            const res = await request(app)
                .post('/api/email-templates/compile')
                .set('Authorization', 'Bearer valid-token')
                .send({
                    mjmlContent: '<mjml><mj-body></mj-body></mjml>',
                    subjectTemplate: 'Test subject'
                });

            expect(res.status).toBe(200);
            expect(res.body.html).toBeDefined();
        });

        it('should return 400 if mjmlContent missing', async () => {
            const res = await request(app)
                .post('/api/email-templates/compile')
                .set('Authorization', 'Bearer valid-token')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('MJML content is required');
        });
    });

    // ==========================================
    // Error message safety
    // ==========================================
    describe('Error message safety', () => {
        it('should not leak DB errors in GET list', async () => {
            mockGetTemplates.mockRejectedValueOnce(new Error('relation does not exist'));

            const res = await request(app)
                .get('/api/email-templates')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch email templates');
            expect(JSON.stringify(res.body)).not.toContain('relation');
        });
    });
});
