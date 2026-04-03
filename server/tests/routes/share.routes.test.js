/**
 * Tests for Share routes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Readable } from 'stream';

const mockStoreSharedPdf = vi.fn();
const mockGetShareStatus = vi.fn();
const mockGetOriginalFileInfo = vi.fn();
const mockGetSharedPdfByToken = vi.fn();
const mockGetOrCreateOriginalFileToken = vi.fn();
const mockGetResumeFileByToken = vi.fn();
const mockRevokeShareLinks = vi.fn();
const mockGetResumeForAccessCheck = vi.fn();
const mockGetUserFirmId = vi.fn();

vi.mock('../../services/shareResume.service.js', () => ({
    default: {
        storeSharedPdf: (...args) => mockStoreSharedPdf(...args),
        getShareStatus: (...args) => mockGetShareStatus(...args),
        getOriginalFileInfo: (...args) => mockGetOriginalFileInfo(...args),
        getSharedPdfByToken: (...args) => mockGetSharedPdfByToken(...args),
        getOrCreateOriginalFileToken: (...args) => mockGetOrCreateOriginalFileToken(...args),
        getResumeFileByToken: (...args) => mockGetResumeFileByToken(...args),
        revokeShareLinks: (...args) => mockRevokeShareLinks(...args)
    }
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
const ADMIN_AUTH = { Authorization: 'Bearer admin-token' };
const VALID_TOKEN = 'a'.repeat(64);

describe('Share Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetResumeForAccessCheck.mockResolvedValue({ id: 'res-1', firm_id: 'firm-1', name: 'Resume 1' });
        mockGetUserFirmId.mockResolvedValue('firm-1');
        app = createTestApp();
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

    it('serves an original file only by file token', async () => {
        mockGetResumeFileByToken.mockResolvedValueOnce({
            id: 'r-1',
            file_name: 'resume.docx',
            name: 'John',
            resume_file_data: Buffer.from('file content'),
            resume_file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            resume_file_size: 12
        });

        const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/vnd.openxmlformats');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('rejects non-hex public share tokens before hitting the service', async () => {
        const res = await request(app).get('/api/share/pdf/' + 'z'.repeat(64));

        expect(res.status).toBe(400);
        expect(mockGetSharedPdfByToken).not.toHaveBeenCalled();
    });

    it('returns 404 for an expired or unknown public file token', async () => {
        mockGetResumeFileByToken.mockResolvedValueOnce(null);

        const res = await request(app).get(`/api/share/file/${VALID_TOKEN}`);

        expect(res.status).toBe(404);
    });
});
