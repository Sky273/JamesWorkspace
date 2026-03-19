/**
 * Tests for Share routes
 * POST /resume/:resumeId/generate, GET /resume/:resumeId/status,
 * GET /resume/:resumeId/original, GET /pdf/:token, GET /file/:token
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock shareResume service
const mockStoreSharedPdf = vi.fn();
const mockGetShareStatus = vi.fn();
const mockGetOriginalFileInfo = vi.fn();
const mockGetSharedPdfByToken = vi.fn();
vi.mock('../../services/shareResume.service.js', () => ({
    default: {
        storeSharedPdf: (...args) => mockStoreSharedPdf(...args),
        getShareStatus: (...args) => mockGetShareStatus(...args),
        getOriginalFileInfo: (...args) => mockGetOriginalFileInfo(...args),
        getSharedPdfByToken: (...args) => mockGetSharedPdfByToken(...args)
    }
}));

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock fs
const mockReadFile = vi.fn();
vi.mock('fs/promises', () => ({
    default: { readFile: (...args) => mockReadFile(...args) },
    readFile: (...args) => mockReadFile(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateParams: () => (req, res, next) => next()
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', email: 'user@test.com', role: 'user' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Mock global fetch for PDF generation
const mockFetch = vi.fn();
global.fetch = mockFetch;

import shareRoutes from '../../routes/share.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/share', shareRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };
const VALID_TOKEN = 'a'.repeat(64);

describe('Share Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    // ==========================================
    // POST /resume/:resumeId/generate
    // ==========================================
    describe('POST /resume/:resumeId/generate', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/share/resume/res-1/generate')
                .send({ htmlContent: '<h1>CV</h1>' });
            expect(res.status).toBe(401);
        });

        it('should return 400 if no htmlContent', async () => {
            const res = await request(app)
                .post('/api/share/resume/res-1/generate')
                .set(AUTH)
                .send({});

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('HTML content');
        });

        it('should generate PDF and return token', async () => {
            const pdfBuffer = Buffer.from('fake-pdf');
            mockFetch.mockResolvedValueOnce({
                ok: true,
                arrayBuffer: () => Promise.resolve(pdfBuffer.buffer)
            });
            mockStoreSharedPdf.mockResolvedValueOnce({ token: 'share-token-123' });

            const res = await request(app)
                .post('/api/share/resume/res-1/generate')
                .set(AUTH)
                .send({ htmlContent: '<h1>CV</h1>', filename: 'john-cv' });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBe('share-token-123');
        });

        it('should return 500 if PDF generation fails', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false });

            const res = await request(app)
                .post('/api/share/resume/res-1/generate')
                .set(AUTH)
                .send({ htmlContent: '<h1>CV</h1>' });

            expect(res.status).toBe(500);
            expect(res.body.error).toContain('Failed');
        });

        it('should return 500 on service error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const res = await request(app)
                .post('/api/share/resume/res-1/generate')
                .set(AUTH)
                .send({ htmlContent: '<h1>CV</h1>' });

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /resume/:resumeId/status
    // ==========================================
    describe('GET /resume/:resumeId/status', () => {
        it('should return share status', async () => {
            mockGetShareStatus.mockResolvedValueOnce({
                hasSharedPdf: true,
                token: 'existing-token'
            });

            const res = await request(app)
                .get('/api/share/resume/res-1/status')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.hasSharedPdf).toBe(true);
            expect(res.body.token).toBe('existing-token');
        });

        it('should return 500 on error', async () => {
            mockGetShareStatus.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/share/resume/res-1/status')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /resume/:resumeId/original
    // ==========================================
    describe('GET /resume/:resumeId/original', () => {
        it('should return 404 if no original file', async () => {
            mockGetOriginalFileInfo.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/share/resume/res-1/original')
                .set(AUTH);

            expect(res.status).toBe(404);
        });

        it('should return token for existing file with token', async () => {
            mockGetOriginalFileInfo.mockResolvedValueOnce({ filename: 'john-cv.pdf' });
            mockQuery.mockResolvedValueOnce({
                rows: [{ shared_pdf_token: 'existing-token-abc' }]
            });

            const res = await request(app)
                .get('/api/share/resume/res-1/original')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBe('existing-token-abc');
            expect(res.body.filename).toBe('john-cv.pdf');
        });

        it('should generate new token if none exists', async () => {
            mockGetOriginalFileInfo.mockResolvedValueOnce({ filename: 'cv.pdf' });
            mockQuery
                .mockResolvedValueOnce({ rows: [{ shared_pdf_token: null }] })
                .mockResolvedValueOnce({ rows: [] }); // UPDATE query

            const res = await request(app)
                .get('/api/share/resume/res-1/original')
                .set(AUTH);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.token).toBeDefined();
            expect(res.body.token.length).toBe(64); // 32 bytes hex = 64 chars
        });

        it('should return 500 on error', async () => {
            mockGetOriginalFileInfo.mockRejectedValueOnce(new Error('fail'));

            const res = await request(app)
                .get('/api/share/resume/res-1/original')
                .set(AUTH);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /pdf/:token (PUBLIC)
    // ==========================================
    describe('GET /pdf/:token', () => {
        it('should return 400 for invalid token length', async () => {
            const res = await request(app).get('/api/share/pdf/short-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid token');
        });

        it('should return 404 if PDF not found', async () => {
            mockGetSharedPdfByToken.mockResolvedValueOnce(null);

            const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not found');
        });

        it('should serve PDF file', async () => {
            const pdfContent = Buffer.from('%PDF-1.4 fake content');
            mockGetSharedPdfByToken.mockResolvedValueOnce({
                path: '/tmp/shared/cv.pdf',
                name: 'John Doe CV'
            });
            mockReadFile.mockResolvedValueOnce(pdfContent);

            const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/pdf');
            expect(res.headers['content-disposition']).toContain('John_Doe_CV.pdf');
        });

        it('should return 500 on error', async () => {
            mockGetSharedPdfByToken.mockRejectedValueOnce(new Error('IO error'));

            const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

            expect(res.status).toBe(500);
        });
    });

    // ==========================================
    // GET /file/:token (PUBLIC)
    // ==========================================
    describe('GET /file/:token', () => {
        it('should return 400 for invalid token', async () => {
            const res = await request(app).get('/api/share/file/bad');
            expect(res.status).toBe(400);
        });

        it('should return 404 if no resume found', async () => {
            mockQuery.mockResolvedValueOnce({ rows: [] });

            const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);
            expect(res.status).toBe(404);
        });

        it('should return 404 if file data missing', async () => {
            mockQuery.mockResolvedValueOnce({
                rows: [{ id: 'r-1', file_name: 'cv.pdf', resume_file_data: null }]
            });

            const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);
            expect(res.status).toBe(404);
            expect(res.body.error).toContain('not available');
        });

        it('should serve original file', async () => {
            const fileData = Buffer.from('file content');
            mockQuery.mockResolvedValueOnce({
                rows: [{
                    id: 'r-1',
                    file_name: 'resume.docx',
                    name: 'John',
                    resume_file_data: fileData,
                    resume_file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    resume_file_size: fileData.length
                }]
            });

            const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

            expect(res.status).toBe(200);
            expect(res.headers['content-type']).toContain('application/vnd.openxmlformats');
        });

        it('should return 500 on error', async () => {
            mockQuery.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);
            expect(res.status).toBe(500);
        });
    });
});
