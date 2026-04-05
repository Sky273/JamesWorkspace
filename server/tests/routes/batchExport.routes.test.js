/**
 * Tests for Batch Export routes
 * POST /
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'stream';

process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';

// Mock batchExport service
const mockGetTemplateByIdForExport = vi.fn();
const mockGetResumesByIdsForExport = vi.fn();
vi.mock('../../services/batchExport.service.js', () => ({
    getTemplateByIdForExport: (...args) => mockGetTemplateByIdForExport(...args),
    getResumesByIdsForExport: (...args) => mockGetResumesByIdsForExport(...args)
}));

// Mock JSZip
const mockFile = vi.fn();
const mockGenerateNodeStream = vi.fn();
vi.mock('jszip', () => ({
    default: class MockJSZip {
        constructor() {
            this.files = {};
        }
        file(name, data) {
            this.files[name] = data;
            mockFile(name, data);
        }
        generateNodeStream(opts) { return mockGenerateNodeStream(opts); }
        generateAsync(opts) {
            return Promise.resolve(Buffer.from('fallback-zip'));
        }
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
            req.user = {
                id: 'user-123',
                role: req.headers['x-test-role'] || 'user',
                firm_id: '00000000-0000-0000-0000-000000000010'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const { default: batchExportRoutes } = await import('../../routes/batchExport.routes.js');

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
    const originalPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN;

    beforeEach(() => {
        mockGetTemplateByIdForExport.mockReset();
        mockGetResumesByIdsForExport.mockReset();
        mockFile.mockReset();
        mockGenerateNodeStream.mockReset();
        mockFetch.mockReset();
        process.env.PDF_SERVER_INTERNAL_TOKEN = 't'.repeat(32);
        mockGetUserFirmId.mockResolvedValue('00000000-0000-0000-0000-000000000010');
        app = createTestApp();
    });

    afterEach(() => {
        process.env.PDF_SERVER_INTERNAL_TOKEN = originalPdfToken;
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
            mockGetTemplateByIdForExport.mockResolvedValueOnce({ id: TEMPLATE_UUID, template_content: '<div></div>' });
            mockGetResumesByIdsForExport.mockResolvedValueOnce([]);

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
            mockGetTemplateByIdForExport.mockResolvedValueOnce({ id: TEMPLATE_UUID, template_content: '<div></div>' });
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
            mockGetTemplateByIdForExport.mockResolvedValueOnce(null); // template not found

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
            mockGetTemplateByIdForExport.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div>-content-</div>', header_content: '', footer_content: '', stylesheet: '', footer_height: 25 }
            );
            mockGetResumesByIdsForExport.mockResolvedValueOnce([
                {
                    id: RESUME_UUID,
                    name: 'John Doe',
                    title: 'Dev',
                    improved_text: 'CV content',
                    firm_id: '00000000-0000-0000-0000-000000000010'
                }
            ]);
            // PDF generation
            mockFetch.mockResolvedValueOnce({
                ok: true,
                body: Readable.from([Buffer.from('pdf-content')])
            });
            // ZIP generation
            mockGenerateNodeStream.mockReturnValueOnce(Readable.from([Buffer.from('fake-zip')]));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/zip');
            expect(res.headers['content-disposition']).toContain('attachment');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
            expect(mockGenerateNodeStream).toHaveBeenCalledWith(expect.objectContaining({
                streamFiles: true,
                compression: 'DEFLATE'
            }));
        });

        it('should return 500 if no files generated', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true }); // health
            mockGetTemplateByIdForExport.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div></div>' }
            );
            mockGetResumesByIdsForExport.mockResolvedValueOnce([]);
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
            mockGetTemplateByIdForExport.mockResolvedValueOnce(
                { id: TEMPLATE_UUID, template_content: '<div>-content-</div>' }
            );
            mockGetResumesByIdsForExport.mockResolvedValueOnce([
                {
                    id: RESUME_UUID,
                    name: 'John',
                    title: 'Dev',
                    improved_text: 'text',
                    firm_id: '00000000-0000-0000-0000-000000000010'
                }
            ]);
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

        it('should pass firm access context to export lookups', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            mockGetTemplateByIdForExport.mockResolvedValueOnce(null);

            await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(mockGetTemplateByIdForExport).toHaveBeenCalledWith(TEMPLATE_UUID, {
                isAdmin: false,
                userFirmId: '00000000-0000-0000-0000-000000000010'
            });
            expect(mockGetResumesByIdsForExport).not.toHaveBeenCalled();
        });

        it('should not leak PDF server URL when unreachable', async () => {
            mockGetTemplateByIdForExport.mockResolvedValueOnce({ id: TEMPLATE_UUID, template_content: '<div></div>' });
            mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

            const res = await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(res.status).toBe(503);
            expect(JSON.stringify(res.body)).not.toContain('127.0.0.1:3002');
            expect(res.body.details).toBeUndefined();
        });

        it('should pass firm access context to grouped resume export lookups', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });
            mockGetTemplateByIdForExport.mockResolvedValueOnce({ id: TEMPLATE_UUID, template_content: '<div>-content-</div>' });
            mockGetResumesByIdsForExport.mockResolvedValueOnce([]);

            await request(app)
                .post('/api/batch-export')
                .set(AUTH)
                .send({ resumeIds: [RESUME_UUID], templateId: TEMPLATE_UUID });

            expect(mockGetResumesByIdsForExport).toHaveBeenCalledWith([RESUME_UUID], {
                isAdmin: false,
                userFirmId: '00000000-0000-0000-0000-000000000010'
            });
        });
    });
});
