/**
 * Tests for Resume Versions routes
 * GET /:id/versions, GET /:id/versions/:versionNumber,
 * POST /:id/versions/:versionNumber/restore
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock resumeVersions service
const mockGetVersions = vi.fn();
const mockGetVersion = vi.fn();
const mockRestoreVersion = vi.fn();
const mockGetResumeForAccessCheck = vi.fn();
const mockGetUserFirmId = vi.fn();
vi.mock('../../services/resumeVersions.service.js', () => ({
    getVersions: (...args) => mockGetVersions(...args),
    getVersion: (...args) => mockGetVersion(...args),
    restoreVersion: (...args) => mockRestoreVersion(...args)
}));
vi.mock('../../services/resumes.service.js', () => ({
    getResumeForAccessCheck: (...args) => mockGetResumeForAccessCheck(...args)
}));
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateParams: () => (req, res, next) => next()
}));

// Mock rate limit
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
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

import versionRoutes from '../../routes/resumes/versions.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/resumes', versionRoutes);
    return app;
}

const sampleVersion = {
    id: 'ver-1',
    resume_id: 'res-1',
    version_number: 1,
    content: { name: 'John Doe', title: 'Dev' },
    created_at: '2026-01-15T10:00:00Z',
    created_by: 'user-123'
};

describe('Resume Versions Routes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetResumeForAccessCheck.mockResolvedValue({ id: 'res-1', firm_id: 'firm-123', name: 'Resume 1' });
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    // ==========================================
    // GET /api/resumes/:id/versions
    // ==========================================
    describe('GET /:id/versions', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/resumes/res-1/versions');
            expect(res.status).toBe(401);
        });

        it('should return versions list', async () => {
            mockGetVersions.mockResolvedValueOnce({
                versions: [sampleVersion],
                totalCount: 1
            });

            const res = await request(app)
                .get('/api/resumes/res-1/versions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.versions).toHaveLength(1);
            expect(mockGetVersions).toHaveBeenCalledWith('res-1', {
                limit: 50,
                offset: 0
            });
        });

        it('should respect limit and offset params', async () => {
            mockGetVersions.mockResolvedValueOnce({ versions: [], totalCount: 0 });

            await request(app)
                .get('/api/resumes/res-1/versions?limit=10&offset=20')
                .set('Authorization', 'Bearer valid-token');

            expect(mockGetVersions).toHaveBeenCalledWith('res-1', {
                limit: 10,
                offset: 20
            });
        });

        it('should cap limit at 100', async () => {
            mockGetVersions.mockResolvedValueOnce({ versions: [], totalCount: 0 });

            await request(app)
                .get('/api/resumes/res-1/versions?limit=500')
                .set('Authorization', 'Bearer valid-token');

            expect(mockGetVersions).toHaveBeenCalledWith('res-1', {
                limit: 100,
                offset: 0
            });
        });

        it('should return 400 for invalid limit', async () => {
            const res = await request(app)
                .get('/api/resumes/res-1/versions?limit=-5')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid limit parameter');
            expect(mockGetVersions).not.toHaveBeenCalled();
        });

        it('should return 400 for invalid offset', async () => {
            const res = await request(app)
                .get('/api/resumes/res-1/versions?offset=-10')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid offset parameter');
            expect(mockGetVersions).not.toHaveBeenCalled();
        });

        it('should return 500 on error', async () => {
            mockGetVersions.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/resumes/res-1/versions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch resume versions');
        });

        it('should return 403 for a resume from another firm', async () => {
            mockGetResumeForAccessCheck.mockResolvedValueOnce({ id: 'res-1', firm_id: 'firm-other', name: 'Resume 1' });

            const res = await request(app)
                .get('/api/resumes/res-1/versions')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(403);
            expect(mockGetVersions).not.toHaveBeenCalled();
        });
    });

    // ==========================================
    // GET /api/resumes/:id/versions/:versionNumber
    // ==========================================
    describe('GET /:id/versions/:versionNumber', () => {
        it('should return specific version', async () => {
            mockGetVersion.mockResolvedValueOnce(sampleVersion);

            const res = await request(app)
                .get('/api/resumes/res-1/versions/1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.version_number).toBe(1);
            expect(mockGetVersion).toHaveBeenCalledWith('res-1', 1);
        });

        it('should return 404 if version not found', async () => {
            mockGetVersion.mockResolvedValueOnce(null);

            const res = await request(app)
                .get('/api/resumes/res-1/versions/99')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Version not found');
        });

        it('should return 400 for invalid version number', async () => {
            const res = await request(app)
                .get('/api/resumes/res-1/versions/abc')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid version number');
        });

        it('should return 400 for version number 0', async () => {
            const res = await request(app)
                .get('/api/resumes/res-1/versions/0')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid version number');
        });

        it('should return 400 for negative version number', async () => {
            const res = await request(app)
                .get('/api/resumes/res-1/versions/-1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
        });

        it('should return 500 on service error', async () => {
            mockGetVersion.mockRejectedValueOnce(new Error('DB error'));

            const res = await request(app)
                .get('/api/resumes/res-1/versions/1')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to fetch resume version');
        });
    });

    // ==========================================
    // POST /api/resumes/:id/versions/:versionNumber/restore
    // ==========================================
    describe('POST /:id/versions/:versionNumber/restore', () => {
        it('should restore a version', async () => {
            mockRestoreVersion.mockResolvedValueOnce({
                ...sampleVersion,
                version_number: 3,
                id: 'ver-3'
            });

            const res = await request(app)
                .post('/api/resumes/res-1/versions/1/restore')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.message).toContain('Version 1 restored');
            expect(res.body.newVersion).toBeDefined();
            expect(mockRestoreVersion).toHaveBeenCalledWith('res-1', 1, 'user-123');
        });

        it('should return 400 for invalid version number', async () => {
            const res = await request(app)
                .post('/api/resumes/res-1/versions/abc/restore')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid version number');
        });

        it('should return 404 if version not found', async () => {
            mockRestoreVersion.mockRejectedValueOnce(new Error('Version 99 not found for resume res-1'));

            const res = await request(app)
                .post('/api/resumes/res-1/versions/99/restore')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(404);
            expect(res.body.error).toBe('Version not found');
        });

        it('should return 500 on general error', async () => {
            mockRestoreVersion.mockRejectedValueOnce(new Error('DB connection lost'));

            const res = await request(app)
                .post('/api/resumes/res-1/versions/1/restore')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(500);
            expect(res.body.error).toBe('Failed to restore resume version');
        });
    });
});
