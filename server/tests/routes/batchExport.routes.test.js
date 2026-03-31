/**
 * Tests for Batch Export routes
 * POST /
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock batchExport service
const mockGetTemplateById = vi.fn();
const mockGetResumeById = vi.fn();
vi.mock('../../services/batchExport.service.js', () => ({
    getTemplateById: (...args) => mockGetTemplateById(...args),
    getResumeById: (...args) => mockGetResumeById(...args)
}));

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateAsync = vi.fn();
vi.mock('jszip', () => ({
    default: class MockJSZip {
        constructor() {
            this.files = {};
        }
        file(name, data) {
            this.files[name] = data;
            mockFile(name, data);
        }
        generateAsync(opts) { return mockGenerateAsync(opts); }
    }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    batchExportSchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import batchExportRoutes from '../../routes/batchExport.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/batch-export', batchExportRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };
const RESUME_UUID = '00000000-0000-0000-0000-000000000001';
const TEMPLATE_UUID = '00000000-0000-0000-0000-000000000002';

describe('Batch Export Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('POST /', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });
            expect(res.status).toBe(401);
        });

        it('should return 400 if no resumeIds', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ templateId: TEMPLATE_UUID });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Resume IDs');
        });

        it('should return 400 if resumeIds is empty array', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [], templateId: TEMPLATE_UUID });
            expect(res.status).toBe(400);
        });

        it('should accept snake_case batch export payload', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            mockGetTemplateById.mockResolvedValueOnce({ id: TEMPLATE_UUID, template_content: '<div></div>' });
            mockGetResumeById.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resume_ids: [RESUME_UUID], template_id: TEMPLATE_UUID, export_format: 'pdf' });

            expect([404, 500]).toContain(res.status);
        });

        it('should return 400 if no templateId', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID] });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Template ID');
        });

        it('should return 400 if too many resumes are requested', async () => {
            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({
                    resumeIds: Array.from({ length: 101 }, (_, index) => `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`),
                    templateId: TEMPLATE_UUID
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('100 resumes');
        });

        it('should return 503 if PDF server is not reachable', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(503);
            expect(res.body.error).toContain('PDF server');
        });

        it('should return 404 if template not found', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health check
            mockGetTemplateById.mockResolvedValueOnce(null); // template not found

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('Template not found');
        });

        it('should generate ZIP with PDFs', async () => {
            // Health check
            mockFetch.mockResolvedValueOnce({ ok: true });
            // Template
            mockGetTemplateById.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div>-content-</div>', header_content: '', footer_content: '', stylesheet: '', footer_height: 25 }
            );
            // Resume
            mockGetResumeById.mockResolvedValueOnce(
                { id: RESUME_UUID, name: 'John Doe', title: 'Dev', improved_text: 'CV content' }
            );
            // PDF generation
            mockFetch.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(100))
            });
            // ZIP generation
            mockGenerateAsync.mockResolvedValueOnce(Buffer.from('fake-zip'));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/zip');
            expect(res.headers['content-disposition']).toContain('attachment');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
        });

        it('should return 500 if no files generated', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health
            mockGetTemplateById.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div></div>' }
            );
            // Resume not found
            mockGetResumeById.mockResolvedValueOnce(null);
            // ZIP has no files - mockFile is never called, so files is empty

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('No files');
        });

        it('should handle PDF generation failure gracefully', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health
            mockGetTemplateById.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div>-content-</div>' }
            );
            // Resume found
            mockGetResumeById.mockResolvedValueOnce(
                { id: RESUME_UUID, name: 'John', title: 'Dev', improved_text: 'text' }
            );
            // PDF generation fails
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                text: () => Promise.resolve('PDF error')
            });

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            // No files generated -> 500
            expect(res.status).toBe(500);
        });
    });
});
