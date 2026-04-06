/**
 * Tests for Share routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'stream';

const mockPipeline = vi.fn();
vi.mock('stream/promises', () => ({
    pipeline: (...args) => mockPipeline(...args)
}));

process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';

const mockStoreSharedPdf = vi.fn();
const mockGetShareStatus = vi.fn();
const mockGetOriginalFileInfo = vi.fn();
const mockGetSharedPdfByToken = vi.fn();
const mockGetOrCreateOriginalFileToken = vi.fn();
const mockGetResumeFileMetadataByToken = vi.fn();
const mockGetResumeFileDataById = vi.fn();
const mockRevokeShareLinks = vi.fn();
const mockGetResumeForAccessCheck = vi.fn();
const mockGetUserFirmId = vi.fn();
const rateLimitCalls = [];
let shouldBlockShareGenerate = false;

vi.mock('../../services/shareResume.service.js', () => ({
    __esModule: true,
    default: {
        storeSharedPdf: (...args) => mockStoreSharedPdf(...args),
        getShareStatus: (...args) => mockGetShareStatus(...args),
        getOriginalFileInfo: (...args) => mockGetOriginalFileInfo(...args),
        getSharedPdfByToken: (...args) => mockGetSharedPdfByToken(...args),
        getOrCreateOriginalFileToken: (...args) => mockGetOrCreateOriginalFileToken(...args),
        getResumeFileMetadataByToken: (...args) => mockGetResumeFileMetadataByToken(...args),
        getResumeFileDataById: (...args) => mockGetResumeFileDataById(...args),
        revokeShareLinks: (...args) => mockRevokeShareLinks(...args)
    },
    storeSharedPdf: (...args) => mockStoreSharedPdf(...args),
    getShareStatus: (...args) => mockGetShareStatus(...args),
    getOriginalFileInfo: (...args) => mockGetOriginalFileInfo(...args),
    getSharedPdfByToken: (...args) => mockGetSharedPdfByToken(...args),
    getOrCreateOriginalFileToken: (...args) => mockGetOrCreateOriginalFileToken(...args),
    getResumeFileMetadataByToken: (...args) => mockGetResumeFileMetadataByToken(...args),
    getResumeFileDataById: (...args) => mockGetResumeFileDataById(...args),
    revokeShareLinks: (...args) => mockRevokeShareLinks(...args)
}));

vi.mock('../../services/resumes.service.js', () => ({
    getResumeForAccessCheck: (...args) => mockGetResumeForAccessCheck(...args)
}));

vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

const mockReadFile = vi.fn();
const mockStat = vi.fn();
vi.mock('fs/promises', () => ({
    default: { readFile: (...args) => mockReadFile(...args), stat: (...args) => mockStat(...args) },
    readFile: (...args) => mockReadFile(...args),
    stat: (...args) => mockStat(...args)
}));

const mockCreateReadStream = vi.fn();
vi.mock('fs', () => ({
    createReadStream: (...args) => mockCreateReadStream(...args)
}));

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    sharePdfSchema: {}
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', email: 'user@test.com', role: 'user', firm_id: 'firm-1' };
            next();
            return;
        }

        if (req.headers.authorization === 'Bearer admin-token') {
            req.user = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
            next();
            return;
        }

        res.status(401).json({ error: 'Unauthorized' });
    },
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: (...args) => {
        rateLimitCalls.push(args);
        return (_req, res, next) => {
            if (shouldBlockShareGenerate) {
                return res.status(429).json({
                    error: 'Too many requests',
                    retryAfter: 900
                });
            }
            next();
        };
    }
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const { default: shareRoutes } = await import('../../routes/share.routes.js');

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/share', shareRoutes);
    return app;
}

const AUTH = { Authorization: 'Bearer valid-token' };
const ADMIN_AUTH = { Authorization: 'Bearer admin-token' };
const VALID_TOKEN = 'a'.repeat(64);

describe('Share Routes', () => {
    let app;
    const originalPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN;

    beforeEach(() => {
        vi.clearAllMocks();
        shouldBlockShareGenerate = false;
        mockPipeline.mockImplementation((source, destination) => new Promise((resolve, reject) => {
            source.on('error', reject);
            destination.on('error', reject);
            destination.on('finish', resolve);
            source.pipe(destination);
        }));
        process.env.PDF_SERVER_INTERNAL_TOKEN = 't'.repeat(32);
        mockGetResumeForAccessCheck.mockResolvedValue({ id: 'res-1', firm_id: 'firm-1', name: 'Resume 1' });
        mockGetUserFirmId.mockResolvedValue('firm-1');
        app = createTestApp();
    });

    afterEach(() => {
        process.env.PDF_SERVER_INTERNAL_TOKEN = originalPdfToken;
    });

    it('blocks a user from sharing a resume from another firm', async () => {
        mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'res-2', firm_id: 'firm-2', name: 'Resume 2' });

        const res = await request(app)
            .post('/api/share/resume/res-2/generate')
            .set(AUTH)
            .send({ htmlContent: '<h1>CV</h1>' });

        expect(res.status).toBe(403);
        expect(mockStoreSharedPdf).not.toHaveBeenCalled();
    });

    it('allows an admin to share any resume PDF', async () => {
        mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'res-2', firm_id: 'firm-2', name: 'Resume 2' });
        mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('pdf').buffer) });
        mockStoreSharedPdf.mockResolvedValueOnce({ token: 'pdf-token', expiresAt: new Date(Date.now() + 60_000) });

        const res = await request(app)
            .post('/api/share/resume/res-2/generate')
            .set(ADMIN_AUTH)
            .send({ htmlContent: '<h1>CV</h1>', filename: 'admin-cv' });

        expect(res.status).toBe(200);
        expect(res.body.token).toBe('pdf-token');
    });

    it('adds an abort signal to the PDF server request', async () => {
        mockFetch.mockResolvedValueOnce({ ok: true, arrayBuffer: () => Promise.resolve(Buffer.from('pdf').buffer) });
        mockStoreSharedPdf.mockResolvedValueOnce({ token: 'pdf-token', expiresAt: new Date(Date.now() + 60_000) });

        const res = await request(app)
            .post('/api/share/resume/res-1/generate')
            .set(AUTH)
            .send({ htmlContent: '<h1>CV</h1>' });

        expect(res.status).toBe(200);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                signal: expect.any(Object)
            })
        );
        expect(mockFetch.mock.calls[0][1].headers['x-internal-service-token']).toBe(process.env.PDF_SERVER_INTERNAL_TOKEN);
    });

    it('applies a dedicated rate limit to share PDF generation', () => {
        expect(rateLimitCalls).toContainEqual([10, 15 * 60 * 1000]);
    });

    it('returns 429 before contacting the PDF server when the share generation limit is reached', async () => {
        shouldBlockShareGenerate = true;

        const res = await request(app)
            .post('/api/share/resume/res-1/generate')
            .set(AUTH)
            .send({ htmlContent: '<h1>CV</h1>' });

        expect(res.status).toBe(429);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(mockStoreSharedPdf).not.toHaveBeenCalled();
    });

    it('returns 504 when the PDF server request times out', async () => {
        const timeoutError = new Error('The operation was aborted');
        timeoutError.name = 'AbortError';
        mockFetch.mockRejectedValueOnce(timeoutError);

        const res = await request(app)
            .post('/api/share/resume/res-1/generate')
            .set(AUTH)
            .send({ htmlContent: '<h1>CV</h1>' });

        expect(res.status).toBe(504);
        expect(res.body.error).toBe('PDF generation timed out');
        expect(mockStoreSharedPdf).not.toHaveBeenCalled();
    });

    it('returns detailed share status with separate PDF and file tokens', async () => {
        mockGetShareStatus.mockResolvedValueOnce({
            hasSharedPdf: true,
            token: 'pdf-token',
            expiresAt: new Date(Date.now() + 60_000),
            pdfToken: 'pdf-token',
            pdfExpiresAt: new Date(Date.now() + 60_000),
            hasSharedFile: true,
            fileToken: 'file-token',
            fileExpiresAt: new Date(Date.now() + 60_000)
        });

        const res = await request(app)
            .get('/api/share/resume/res-1/status')
            .set(AUTH);

        expect(res.status).toBe(200);
        expect(res.body.pdfToken).toBe('pdf-token');
        expect(res.body.fileToken).toBe('file-token');
        expect(res.body.hasSharedFile).toBe(true);
    });

    it('returns a dedicated original-file token', async () => {
        mockGetOriginalFileInfo.mockResolvedValueOnce({ filename: 'john-cv.pdf' });
        mockGetOrCreateOriginalFileToken.mockResolvedValueOnce('file-token-abc');

        const res = await request(app)
            .get('/api/share/resume/res-1/original')
            .set(AUTH);

        expect(res.status).toBe(200);
        expect(res.body.token).toBe('file-token-abc');
    });

    it('revokes share links for an authorized user', async () => {
        mockRevokeShareLinks.mockResolvedValueOnce(true);

        const res = await request(app)
            .post('/api/share/resume/res-1/revoke')
            .set(AUTH);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(mockRevokeShareLinks).toHaveBeenCalledWith('res-1');
    });

    it('serves a shared PDF by PDF token', async () => {
        mockGetSharedPdfByToken.mockResolvedValueOnce({
            path: '/tmp/shared/cv.pdf',
            name: 'John Doe CV'
        });
        mockStat.mockResolvedValueOnce({ size: 21 });
        mockCreateReadStream.mockReturnValueOnce(Readable.from([Buffer.from('%PDF-1.4 fake content')]));

        const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/pdf');
        expect(res.headers['content-disposition']).toContain('inline');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(mockCreateReadStream).toHaveBeenCalledWith('/tmp/shared/cv.pdf');
        expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('returns 500 if the shared PDF stream fails after lookup', async () => {
        mockGetSharedPdfByToken.mockResolvedValueOnce({
            path: '/tmp/shared/cv.pdf',
            name: 'John Doe CV'
        });
        mockStat.mockResolvedValueOnce({ size: 21 });
        mockCreateReadStream.mockReturnValueOnce(Readable.from([Buffer.from('%PDF-1.4 fake content')]));
        mockPipeline.mockRejectedValueOnce(Object.assign(new Error('stream failed'), { code: 'EIO' }));

        const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to serve PDF');
    });

    it('returns 404 if the shared PDF disappears before streaming starts', async () => {
        mockGetSharedPdfByToken.mockResolvedValueOnce({
            path: '/tmp/shared/cv.pdf',
            name: 'John Doe CV'
        });
        mockStat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

        const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('PDF not found');
        expect(mockCreateReadStream).not.toHaveBeenCalled();
    });

    it('returns 404 when the shared PDF file is missing on disk', async () => {
        mockGetSharedPdfByToken.mockResolvedValueOnce({
            path: '/tmp/shared/missing.pdf',
            name: 'John Doe CV'
        });
        mockStat.mockRejectedValueOnce(Object.assign(new Error('missing'), { code: 'ENOENT' }));

        const res = await request(app).get(`/api/share/pdf/${VALID_TOKEN}`);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('PDF not found');
        expect(mockCreateReadStream).not.toHaveBeenCalled();
    });

    it('serves an original file only by file token', async () => {
        mockGetResumeFileMetadataByToken.mockResolvedValueOnce({
            id: 'r-1',
            file_name: 'resume.docx',
            name: 'John',
            resume_file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            resume_file_size: 12
        });
        mockGetResumeFileDataById.mockResolvedValueOnce(Buffer.from('file content'));

        const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/vnd.openxmlformats');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(mockGetResumeFileMetadataByToken).toHaveBeenCalledWith(VALID_TOKEN);
        expect(mockGetResumeFileDataById).toHaveBeenCalledWith('r-1');
    });

    it('rejects non-hex public share tokens before hitting the service', async () => {
        const res = await request(app).get('/api/share/pdf/' + 'z'.repeat(64));

        expect(res.status).toBe(400);
        expect(mockGetSharedPdfByToken).not.toHaveBeenCalled();
    });

    it('returns 404 for an expired or unknown public file token', async () => {
        mockGetResumeFileMetadataByToken.mockResolvedValueOnce(null);

        const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

        expect(res.status).toBe(404);
        expect(mockGetResumeFileDataById).not.toHaveBeenCalled();
    });

    it('returns 404 when the token is valid but the stored file data is gone', async () => {
        mockGetResumeFileMetadataByToken.mockResolvedValueOnce({
            id: 'r-1',
            file_name: 'resume.docx',
            name: 'John',
            resume_file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            resume_file_size: 12
        });
        mockGetResumeFileDataById.mockResolvedValueOnce(null);

        const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

        expect(res.status).toBe(404);
    });
});
