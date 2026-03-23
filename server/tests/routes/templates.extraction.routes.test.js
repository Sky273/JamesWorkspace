/**
 * Tests for Templates Extraction routes
 * POST /extract-from-cv
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

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

vi.mock('multer', () => {
    const multerMock = () => ({
        single: () => (req, res, next) => {
            if (req.headers['x-test-no-file'] === 'true') {
                req.file = null;
            } else if (req.headers['x-test-mimetype']) {
                req.file = {
                    buffer: Buffer.from('fake content'),
                    originalname: 'template.pdf',
                    mimetype: req.headers['x-test-mimetype']
                };
            } else {
                req.file = {
                    buffer: Buffer.from('fake content'),
                    originalname: 'template.docx',
                    mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                };
            }
            next();
        }
    });
    multerMock.memoryStorage = () => ({});
    return { default: multerMock };
});

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
                .set({ ...AUTH, 'x-test-mimetype': 'application/msword' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('.doc format');
        });

        it('falls back to pdfjs text extraction when pdf-parse is not callable', async () => {
            mockPdfParse.mockRejectedValue(new TypeError('pdfParse is not a function'));
            mockExtractTextFromPDFBuffer.mockResolvedValue('A'.repeat(80));
            mockPuppeteerLaunch.mockRejectedValueOnce(new Error('vision unavailable'));
            mockExtractTemplateFromCV.mockResolvedValueOnce({
                template: { name: 'Fallback Template' },
                model: 'test-model',
                usage: { total_tokens: 10 }
            });

            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-mimetype': 'application/pdf' });

            expect(res.status).toBe(200);
            expect(mockExtractTextFromPDFBuffer).toHaveBeenCalled();
            expect(mockExtractTemplateFromCV).toHaveBeenCalledWith('A'.repeat(80), 'template.pdf');
            expect(res.body.extractionMethod).toBe('pdf-text-fallback');
        });
    });
});


