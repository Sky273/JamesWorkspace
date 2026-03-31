/**
 * Tests for Resume extraction routes
 * POST /extract-doc, POST /extract-pdf
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

function getFileSignatureBuffer(mimetype) {
    switch (mimetype) {
        case 'application/pdf':
            return Buffer.from('%PDF-1.7 fake pdf content');
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
            return Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
        case 'application/msword':
            return Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
        default:
            return Buffer.from('invalid');
    }
}

const { multerCallOptions, pdfDocuments, pendingReadFileResolvers } = vi.hoisted(() => ({
    multerCallOptions: [],
    pdfDocuments: [],
    pendingReadFileResolvers: []
}));

vi.mock('../../config/constants.js', () => ({
    UPLOAD_DIR: '/tmp/uploads',
    MAX_FILE_SIZE: 50 * 1024 * 1024
}));

const mockReadFile = vi.fn();
const mockUnlink = vi.fn();
vi.mock('fs/promises', () => ({
    default: {
        readFile: (...args) => mockReadFile(...args),
        unlink: (...args) => mockUnlink(...args)
    },
    readFile: (...args) => mockReadFile(...args),
    unlink: (...args) => mockUnlink(...args)
}));

vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
    getDocument: vi.fn(() => ({
        promise: Promise.resolve(pdfDocuments.shift() || {
            numPages: 1,
            getPage: async () => ({
                getTextContent: async () => ({
                    items: [
                        { str: 'This', transform: [0, 0, 0, 0, 0, 100] },
                        { str: 'is', transform: [0, 0, 0, 0, 0, 100] },
                        { str: 'extracted', transform: [0, 0, 0, 0, 0, 100] },
                        { str: 'PDF', transform: [0, 0, 0, 0, 0, 100] },
                        { str: 'text content with enough characters to bypass OCR fallback in tests.', transform: [0, 0, 0, 0, 0, 100] }
                    ]
                })
            })
        })
    }))
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() })
}));

const mockExtractTextFromWordBuffer = vi.fn();
vi.mock('../../services/wordTextExtraction.service.js', () => ({
    extractTextFromWordBuffer: (...args) => mockExtractTextFromWordBuffer(...args)
}));

const mockUploadLimiter = vi.fn((req, _res, next) => next());
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    uploadLimiter: (...args) => mockUploadLimiter(...args)
}));

vi.mock('multer', () => {
    class MulterError extends Error {
        constructor(code, field) {
            super(code);
            this.code = code;
            this.field = field;
            this.name = 'MulterError';
        }
    }

    const multerMock = vi.fn((options = {}) => {
        multerCallOptions.push(options);
        return {
            single: () => (req, _res, next) => {
                if (req.headers['x-test-oversized'] === 'true') {
                    next(new MulterError('LIMIT_FILE_SIZE', 'file'));
                    return;
                }

                if (req.headers['x-test-invalid-filetype'] === 'true' && typeof options.fileFilter === 'function') {
                    options.fileFilter(req, {
                        originalname: 'resume.exe',
                        mimetype: 'application/x-msdownload'
                    }, (error) => next(error || undefined));
                    return;
                }

                if (req.headers['x-test-no-file'] === 'true') {
                    req.file = null;
                } else {
                    req.file = {
                        path: '/tmp/uploads/test-file',
                        originalname: req.headers['x-test-filename'] || 'resume.pdf',
                        size: 1024,
                        mimetype: req.headers['x-test-mimetype'] || 'application/pdf'
                    };
                }

                if (req.headers['x-test-body']) {
                    try { req.body = JSON.parse(req.headers['x-test-body']); } catch {}
                }
                next();
            }
        };
    });

    multerMock.memoryStorage = () => ({});
    multerMock.MulterError = MulterError;
    return { default: multerMock };
});

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = {
                id: req.headers['x-test-user-id'] || 'user-123',
                role: req.headers['x-test-role'] || 'user',
                firm: 'Test Firm'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import uploadRoutes from '../../routes/resumes/upload.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/resumes', uploadRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };

describe('Resume Extraction Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockReadFile.mockReset();
        mockUnlink.mockReset();
        mockExtractTextFromWordBuffer.mockReset();
        app = createTestApp();
        pdfDocuments.length = 0;
        pendingReadFileResolvers.length = 0;
        mockUnlink.mockResolvedValue(undefined);
        mockReadFile.mockImplementation((_path) => Promise.resolve(getFileSignatureBuffer('application/pdf')));
    });

    it('configures multer with a 50MB file size limit', () => {
        expect(multerCallOptions).toHaveLength(2);
        expect(multerCallOptions.every((options) => options.limits?.fileSize === 50 * 1024 * 1024)).toBe(true);
        expect(multerCallOptions.every((options) => options.limits?.files === 1)).toBe(true);
    });

    describe('POST /extract-doc', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/resumes/extract-doc');
            expect(res.status).toBe(401);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-doc')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });

        it('should accept DOCX uploads and return OCR metadata when server fallback is used', async () => {
            mockReadFile.mockResolvedValueOnce(getFileSignatureBuffer('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
            mockExtractTextFromWordBuffer.mockResolvedValueOnce({
                text: 'luc . moreau @ gmail . com',
                ocrUsed: true,
                ocrPageCount: 1,
                failedOcrPages: 0,
                avgOcrConfidence: 91.5,
                pages: 1,
                primaryResult: {
                    engine: 'tesseract-cli',
                    variant: 'pdftoppm-page',
                    psm: 6
                }
            });

            const res = await request(app)
                .post('/api/resumes/extract-doc')
                .set({
                    ...AUTH,
                    'x-test-filename': 'resume.docx',
                    'x-test-mimetype': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                });

            expect(res.status).toBe(200);
            expect(res.body.text).toBe('luc.moreau@gmail.com');
            expect(res.body.ocrUsed).toBe(true);
            expect(mockExtractTextFromWordBuffer).toHaveBeenCalledWith(
                expect.any(Buffer),
                expect.objectContaining({
                    fileName: 'resume.docx',
                    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                })
            );
        });
    });

    describe('POST /extract-pdf', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).post('/api/resumes/extract-pdf');
            expect(res.status).toBe(401);
        });

        it('should return 400 if no file uploaded', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-pdf')
                .set({ ...AUTH, 'x-test-no-file': 'true' });
            expect(res.status).toBe(400);
            expect(res.body.error).toContain('No file');
        });

        it('should reject invalid file types before extraction', async () => {
            const res = await request(app)
                .post('/api/resumes/extract-pdf')
                .set({ ...AUTH, 'x-test-invalid-filetype': 'true' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid file type');
        });

        it('should reject PDF files with invalid binary signatures', async () => {
            mockReadFile.mockResolvedValueOnce(Buffer.from('not-a-pdf'));

            const res = await request(app)
                .post('/api/resumes/extract-pdf')
                .set(AUTH);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid PDF file contents');
        });

        it('should reject PDF extraction when concurrency limit is reached for the same user', async () => {
            mockReadFile
                .mockImplementationOnce(() => new Promise((resolve) => pendingReadFileResolvers.push(resolve)))
                .mockImplementationOnce(() => new Promise((resolve) => pendingReadFileResolvers.push(resolve)))
                .mockResolvedValue(getFileSignatureBuffer('application/pdf'));

            const firstRequestPromise = request(app).post('/api/resumes/extract-pdf').set(AUTH).then((response) => response);
            const secondRequestPromise = request(app).post('/api/resumes/extract-pdf').set(AUTH).then((response) => response);

            await vi.waitFor(() => {
                expect(pendingReadFileResolvers).toHaveLength(2);
            });

            const thirdResponse = await request(app)
                .post('/api/resumes/extract-pdf')
                .set(AUTH);

            expect(thirdResponse.status).toBe(503);
            expect(thirdResponse.body.retryable).toBe(true);
            expect(thirdResponse.body.error).toContain('temporarily saturated for this user');

            for (const resolvePendingReadFile of pendingReadFileResolvers.splice(0)) {
                resolvePendingReadFile(getFileSignatureBuffer('application/pdf'));
            }

            const [firstResponse, secondResponse] = await Promise.all([firstRequestPromise, secondRequestPromise]);
            expect([200, 400, 500]).toContain(firstResponse.status);
            expect([200, 400, 500]).toContain(secondResponse.status);
        }, 10000);

        it('should allow another user to extract a PDF while the first user is saturated', async () => {
            mockReadFile
                .mockImplementationOnce(() => new Promise((resolve) => pendingReadFileResolvers.push(resolve)))
                .mockImplementationOnce(() => new Promise((resolve) => pendingReadFileResolvers.push(resolve)))
                .mockResolvedValue(getFileSignatureBuffer('application/pdf'));

            const firstRequestPromise = request(app).post('/api/resumes/extract-pdf').set({ ...AUTH, 'x-test-user-id': 'user-123' }).then((response) => response);
            const secondRequestPromise = request(app).post('/api/resumes/extract-pdf').set({ ...AUTH, 'x-test-user-id': 'user-123' }).then((response) => response);

            await vi.waitFor(() => {
                expect(pendingReadFileResolvers).toHaveLength(2);
            });

            const otherUserResponse = await request(app)
                .post('/api/resumes/extract-pdf')
                .set({ ...AUTH, 'x-test-user-id': 'user-456' });

            expect(otherUserResponse.status).toBe(200);
            expect(otherUserResponse.body.text).toContain('text content with enough characters');

            for (const resolvePendingReadFile of pendingReadFileResolvers.splice(0)) {
                resolvePendingReadFile(getFileSignatureBuffer('application/pdf'));
            }

            const [firstResponse, secondResponse] = await Promise.all([firstRequestPromise, secondRequestPromise]);
            expect([200, 400, 500]).toContain(firstResponse.status);
            expect([200, 400, 500]).toContain(secondResponse.status);
        }, 10000);
    });

});




