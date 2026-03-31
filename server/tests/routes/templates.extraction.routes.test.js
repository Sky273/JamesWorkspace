/**
 * Tests for Templates Extraction routes
 * POST /extract-from-cv
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const { mockUserRateLimit } = vi.hoisted(() => ({
    mockUserRateLimit: vi.fn(() => (req, _res, next) => next())
}));

const mockExtractTemplateFromHTML = vi.fn();
const mockExtractTemplateFromImage = vi.fn();
const mockExtractTemplateFromCV = vi.fn();
vi.mock('../../services/templateExtraction.service.js', () => ({
    extractTemplateFromHTML: (...args) => mockExtractTemplateFromHTML(...args),
    extractTemplateFromImage: (...args) => mockExtractTemplateFromImage(...args),
    extractTemplateFromCV: (...args) => mockExtractTemplateFromCV(...args)
}));

const mockExtractTextFromPDFBuffer = vi.fn();
vi.mock('../../services/batchJobsWorker/textExtraction.js', () => ({
    extractTextFromPDFBuffer: (...args) => mockExtractTextFromPDFBuffer(...args)
}));

const mockExtractFromDOCX = vi.fn();
const mockExtractFromPDF = vi.fn();

function getTemplateFileBuffer(filename) {
    if (filename.endsWith('.pdf')) {
        return Buffer.from('%PDF-1.7 template');
    }
    if (filename.endsWith('.docx')) {
        return Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
    }
    if (filename.endsWith('.doc')) {
        return Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    }
    return Buffer.from('invalid');
}

vi.mock('../../routes/templates/extraction/extractors.js', () => ({
    upload: {
        single: () => (req, _res, next) => {
            if (req.headers['x-test-no-file'] === 'true') {
                req.file = null;
            } else if (req.headers['x-test-mimetype']) {
                const filename = req.headers['x-test-filename'] || 'template.pdf';
                req.file = {
                    buffer: req.headers['x-test-invalid-signature'] === 'true'
                        ? Buffer.from('not-a-real-file')
                        : getTemplateFileBuffer(filename),
                    originalname: filename,
                    mimetype: req.headers['x-test-mimetype']
                };
            } else {
                req.file = {
                    buffer: getTemplateFileBuffer('template.docx'),
                    originalname: 'template.docx',
                    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                };
            }
            next();
        }
    },
    extractFromDOCX: (...args) => mockExtractFromDOCX(...args),
    extractFromPDF: (...args) => mockExtractFromPDF(...args)
}));

const mockPuppeteerLaunch = vi.fn();
vi.mock('puppeteer', () => ({
    default: { launch: (...args) => mockPuppeteerLaunch(...args) }
}));

const mockPdfParse = vi.fn();
vi.mock('pdf-parse', () => ({
    default: (...args) => mockPdfParse(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: (...args) => mockUserRateLimit(...args)
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'admin-1',
                role: req.headers['x-test-role'] || 'admin'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Admin access required' });
    }
}));

import extractionRoutes from '../../routes/templates/extraction.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/templates', extractionRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Templates Extraction Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockExtractFromDOCX.mockResolvedValue({
            template: { name: 'DOCX Template' },
            model: 'test-model',
            usage: { total_tokens: 1 },
            extractionMethod: 'docx-html'
        });
        mockExtractFromPDF.mockResolvedValue({
            template: { name: 'PDF Template' },
            model: 'test-model',
            usage: { total_tokens: 1 },
            extractionMethod: 'pdf-text'
        });
        app = createTestApp();
    });

    describe('POST /extract-from-cv', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/templates/extract-from-cv');
            expect(res.status).toBe(401);
        });

        it('should return 403 for non-admin', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-role': 'user' });
            expect(res.status).toBe(403);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });

        it('should return 400 for old .doc format', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-mimetype': 'application/msword', 'x-test-filename': 'template.doc' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('.doc format');
        });

        it('should trust the file extension over a generic mimetype for docx uploads', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/octet-stream'
                });

            expect(res.status).toBe(200);
            expect(mockExtractFromDOCX).toHaveBeenCalled();
            expect(mockExtractFromPDF).not.toHaveBeenCalled();
        });

        it('should reject invalid binary contents even with an allowed file type', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.pdf',
                    'x-test-mimetype': 'application/pdf',
                    'x-test-invalid-signature': 'true'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file contents');
        });

        it('falls back to pdfjs text extraction when pdf-parse is not callable', async () => {
            mockPdfParse.mockRejectedValue(new TypeError('pdfParse is not a function'));
            mockExtractTextFromPDFBuffer.mockResolvedValue('A'.repeat(80));
            mockPuppeteerLaunch.mockRejectedValueOnce(new Error('vision unavailable'));
            mockExtractFromPDF.mockResolvedValueOnce({
                template: { name: 'Fallback Template' },
                model: 'test-model',
                usage: { total_tokens: 10 },
                extractionMethod: 'pdf-text-fallback'
            });

            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-mimetype': 'application/pdf' });

            expect(res.status).toBe(200);
            expect(mockExtractFromPDF).toHaveBeenCalledWith(expect.any(Buffer), 'template.pdf');
            expect(res.body.extractionMethod).toBe('pdf-text-fallback');
        });

        it('should reject concurrent template extractions above the per-user limit', async () => {
            let releaseFirst;
            let releaseSecond;
            mockExtractFromDOCX
                .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
                .mockImplementationOnce(() => new Promise((resolve) => { releaseSecond = resolve; }));

            const firstRequest = request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                })
                .then((response) => response);
            const secondRequest = request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                })
                .then((response) => response);

            await vi.waitFor(() => {
                expect(mockExtractFromDOCX).toHaveBeenCalledTimes(2);
            });

            const thirdResponse = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });

            expect(thirdResponse.status).toBe(429);
            expect(thirdResponse.body.error).toContain('in progress');

            releaseFirst({
                template: { name: 'Template 1' },
                model: 'test-model',
                usage: { total_tokens: 1 },
                extractionMethod: 'docx-html'
            });
            releaseSecond({
                template: { name: 'Template 2' },
                model: 'test-model',
                usage: { total_tokens: 1 },
                extractionMethod: 'docx-html'
            });

            const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);
            expect(firstResponse.status).toBe(200);
            expect(secondResponse.status).toBe(200);
        });
    });
});


