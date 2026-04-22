/**
 * Tests for Templates Extraction routes
 * POST /extract-from-cv
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import JSZip from 'jszip';

const { mockUserRateLimit } = vi.hoisted(() => ({
    mockUserRateLimit: vi.fn(() => (req, _res, next) => next())
}));

const mockExtractFromDOCX = vi.fn();
const mockExtractFromPDF = vi.fn();
let validDocxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
let invalidDocxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);

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

async function buildValidDocxBuffer() {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml" />
    </Types>`);
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    zip.file('word/document.xml', '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Template</w:t></w:r></w:p></w:body></w:document>');
    return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

async function buildInvalidDocxBuffer() {
    const zip = new JSZip();
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Override PartName="/customXml/item1.xml" ContentType="application/xml" />
    </Types>`);
    zip.file('customXml/item1.xml', '<root><value>not a docx</value></root>');
    return Buffer.from(await zip.generateAsync({ type: 'nodebuffer' }));
}

vi.mock('../../routes/templates/extraction/extractors.js', () => ({
    upload: {
        single: () => (req, _res, next) => {
            if (req.headers['x-test-no-file'] === 'true') {
                req.file = null;
            } else if (req.headers['x-test-mimetype']) {
                const filename = req.headers['x-test-filename'] || 'template.pdf';
                let buffer;
                if (req.headers['x-test-docx-archive'] === 'valid') {
                    buffer = validDocxBuffer;
                } else if (req.headers['x-test-docx-archive'] === 'invalid') {
                    buffer = invalidDocxBuffer;
                } else {
                    buffer = req.headers['x-test-invalid-signature'] === 'true'
                        ? Buffer.from('not-a-real-file')
                        : getTemplateFileBuffer(filename);
                }
                req.file = {
                    buffer,
                    originalname: filename,
                    mimetype: req.headers['x-test-mimetype']
                };
            } else {
                req.file = {
                    buffer: validDocxBuffer,
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

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../services/aiCredits.service.js', () => ({
    executeAiWorkflowWithCredits: (_options, runner) => runner({ workflowReservation: null }),
    runAiActionWithCredits: (_options, action) => action(),
    workflowReservationCoversAction: () => false
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: (...args) => mockUserRateLimit(...args)
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: 'admin-1',
                role: req.headers['x-test-role'] || 'admin',
                firmId: 'firm-1'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    },
    requireAdmin: (req, res, next) => {
        if (req.user?.role === 'admin') next();
        else res.status(403).json({ error: 'Admin access required' });
    },
    requireUserManager: (req, res, next) => {
        if (req.user?.role === 'admin' || req.user?.role === 'manager') next();
        else res.status(403).json({ error: 'Manager access required' });
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

    beforeEach(async () => {
        vi.clearAllMocks();
        validDocxBuffer = await buildValidDocxBuffer();
        invalidDocxBuffer = await buildInvalidDocxBuffer();
        mockExtractFromDOCX.mockResolvedValue({
            template: { name: 'DOCX Template' },
            model: 'test-model',
            usage: { total_tokens: 1 },
            extractionMethod: 'office-pdf-layout-html'
        });
        mockExtractFromPDF.mockResolvedValue({
            template: { name: 'PDF Template' },
            model: 'test-model',
            usage: { total_tokens: 1 },
            extractionMethod: 'pdf-layout-html'
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

        it('should support legacy .doc uploads through the Office to PDF pipeline', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-mimetype': 'application/msword', 'x-test-filename': 'template.doc' });
            expect(res.status).toBe(200);
            expect(mockExtractFromDOCX).toHaveBeenCalledWith(
                expect.any(Buffer),
                'template.doc',
                { maxTokens: undefined }
            );
        });

        it('should trust the file extension over a generic mimetype for docx uploads', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/octet-stream',
                    'x-test-docx-archive': 'valid'
                });

            expect(res.status).toBe(200);
            expect(mockExtractFromDOCX).toHaveBeenCalled();
            expect(mockExtractFromPDF).not.toHaveBeenCalled();
        });

        it('should reject zip files renamed as docx', async () => {
            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'x-test-docx-archive': 'invalid'
                });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file contents');
            expect(mockExtractFromDOCX).not.toHaveBeenCalled();
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

        it('returns a clear extraction error payload when backend extraction fails without fallback', async () => {
            mockExtractFromPDF.mockRejectedValueOnce(Object.assign(
                new Error('Extraction du modele impossible : le layout PDF detecte seulement 12 caracteres exploitables sur la premiere page, minimum requis 80.'),
                {
                    code: 'TEMPLATE_LAYOUT_TOO_SPARSE',
                    statusCode: 422,
                    details: {
                        detectedTextCharacters: 12,
                        extractedPdfTextLength: 240,
                        minimumTextCharacters: 80
                    }
                }
            ));

            const res = await request(app)
                .post('/api/templates/extract-from-cv')
                .set({ ...AUTH, 'x-test-mimetype': 'application/pdf' });

            expect(res.status).toBe(422);
            expect(mockExtractFromPDF).toHaveBeenCalledWith(
                expect.any(Buffer),
                'template.pdf',
                { maxTokens: undefined }
            );
            expect(res.body.code).toBe('TEMPLATE_LAYOUT_TOO_SPARSE');
            expect(res.body.error).toContain('minimum requis 80');
            expect(res.body.details).toEqual(expect.objectContaining({
                detectedTextCharacters: 12,
                extractedPdfTextLength: expect.any(Number),
                minimumTextCharacters: 80
            }));
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
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'x-test-docx-archive': 'valid'
                })
                .then((response) => response);
            const secondRequest = request(app)
                .post('/api/templates/extract-from-cv')
                .set({
                    ...AUTH,
                    'x-test-filename': 'template.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'x-test-docx-archive': 'valid'
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
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'x-test-docx-archive': 'valid'
                });

            expect(thirdResponse.status).toBe(429);
            expect(thirdResponse.body.error).toContain('in progress');

            releaseFirst({
                template: { name: 'Template 1' },
                model: 'test-model',
                usage: { total_tokens: 1 },
                extractionMethod: 'office-pdf-layout-html'
            });
            releaseSecond({
                template: { name: 'Template 2' },
                model: 'test-model',
                usage: { total_tokens: 1 },
                extractionMethod: 'office-pdf-layout-html'
            });

            const [firstResponse, secondResponse] = await Promise.all([firstRequest, secondRequest]);
            expect(firstResponse.status).toBe(200);
            expect(secondResponse.status).toBe(200);
        });
    });
});


