/**
 * Comprehensive tests for Resume CRUD routes
 * GET /, GET /:id, PUT /:id, DELETE /:id, GET /:id/download
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants module FIRST
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } }
}));

// Mock resumes service
const mockCountResumes = vi.fn();
const mockListResumes = vi.fn();
const mockGetResumeById = vi.fn();
const mockGetResumeFileForDownload = vi.fn();
const mockUpdateResume = vi.fn();
const mockDeleteResume = vi.fn();
const mockGetResumeForAccessCheck = vi.fn();
vi.mock('../../services/resumes.service.js', () => ({
    countResumes: (...args) => mockCountResumes(...args),
    listResumes: (...args) => mockListResumes(...args),
    getResumeById: (...args) => mockGetResumeById(...args),
    getResumeFileForDownload: (...args) => mockGetResumeFileForDownload(...args),
    updateResume: (...args) => mockUpdateResume(...args),
    deleteResume: (...args) => mockDeleteResume(...args),
    getResumeForAccessCheck: (...args) => mockGetResumeForAccessCheck(...args),
    RESUME_SELECT_COLUMNS: 'id, name, title, status, firm_id, created_at'
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
const mockIsUserAdmin = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    isUserAdmin: (...args) => mockIsUserAdmin(...args),
    isValidUUID: vi.fn((id) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock tagCleaner
vi.mock('../../utils/tagCleaner.js', () => ({
    processAnalysisTags: vi.fn((data) => data)
}));

// Mock tags.routes
vi.mock('../../routes/tags.routes.js', () => ({
    invalidateTagsCache: vi.fn()
}));

// Mock resumeVersions service
vi.mock('../../services/resumeVersions.service.js', () => ({
    createVersion: vi.fn(),
    hasImprovedTextChanged: vi.fn(() => false)
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    updateResumeSchema: {}
}));

// Mock helpers
const mockCheckResumeAccess = vi.fn();
vi.mock('../../routes/resumes/helpers.js', () => ({
    checkResumeAccess: (...args) => mockCheckResumeAccess(...args),
    parseScore: vi.fn((s) => parseFloat(s) || 0),
    stringifyIfNeeded: vi.fn((v) => typeof v === 'string' ? v : JSON.stringify(v)),
    mapResumeToFrontend: vi.fn((r) => ({
        id: r.id,
        name: r.name,
        title: r.title,
        status: r.status,
        firm_id: r.firm_id
    })),
    RESUME_SELECT_COLUMNS: 'id, name, title, status, firm_id, created_at'
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { 
                id: 'user-123', 
                email: 'test@example.com', 
                role: req.headers['x-test-role'] || 'user',
                firm: 'Test Firm',
                firm_id: 'firm-123'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Import routes after mocks
import crudRoutes from '../../routes/resumes/crud.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/resumes', crudRoutes);
    return app;
}

describe('Resume Routes - GET /api/resumes', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/resumes');

        expect(res.status).toBe(401);
    });

    it('should return paginated resumes for authenticated user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(5);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-1', name: 'Resume 1', status: 'analyzed', firm_id: 'firm-123' },
            { id: 'resume-2', name: 'Resume 2', status: 'pending', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/resumes')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.totalCount).toBe(5);
    });

    it('should return empty results for user without firm_id', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/resumes')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);
        expect(res.body.pagination.totalCount).toBe(0);
    });

    it('should filter by status', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(2);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-1', name: 'Resume 1', status: 'analyzed', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/resumes?status=analyzed')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(1);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-1', name: 'John Doe', status: 'analyzed', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/resumes?search=john')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination parameters', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(100);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-51', name: 'Resume 51', status: 'analyzed', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/resumes?page=2&limit=50')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(2);
        expect(res.body.pagination.limit).toBe(50);
    });

    it('should allow admin to see all resumes', async () => {
        mockCountResumes.mockResolvedValueOnce(10);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-1', name: 'Resume 1', status: 'analyzed', firm_id: 'firm-other' }
        ]);

        const res = await request(app)
            .get('/api/resumes')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        // Admin should not have firm filter applied
        expect(mockGetUserFirmId).not.toHaveBeenCalled();
    });
});

describe('Resume Routes - GET /api/resumes/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent resume', async () => {
        mockGetResumeById.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return resume for authorized user', async () => {
        mockIsUserAdmin.mockReturnValueOnce(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetResumeById.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000', 
            name: 'Test Resume',
            status: 'analyzed',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 403 for resume from different firm', async () => {
        mockIsUserAdmin.mockReturnValueOnce(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetResumeById.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000', 
            name: 'Other Firm Resume',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to access any resume', async () => {
        mockIsUserAdmin.mockReturnValueOnce(true);
        mockGetResumeById.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000', 
            name: 'Other Firm Resume',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

describe('Resume Routes - GET /api/resumes/:id/download', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 404 for non-existent resume', async () => {
        mockGetResumeFileForDownload.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return 404 if file data is missing', async () => {
        mockGetResumeFileForDownload.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000',
            file_name: 'resume.pdf',
            resume_file_data: null,
            firm_name: 'Test Firm'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
        expect(res.body.error).toContain('File not found');
    });

    it('should return 403 for resume from different firm', async () => {
        mockGetResumeFileForDownload.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000',
            file_name: 'resume.pdf',
            resume_file_data: Buffer.from('test'),
            firm_name: 'Other Firm'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should download file for authorized user', async () => {
        const fileContent = Buffer.from('PDF content here');
        mockGetResumeFileForDownload.mockResolvedValueOnce({ 
            id: '123e4567-e89b-12d3-a456-426614174000',
            file_name: 'resume.pdf',
            resume_file_data: fileContent,
            resume_file_type: 'application/pdf',
            resume_file_size: fileContent.length,
            firm_name: 'Test Firm'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toContain('resume.pdf');
    });
});

describe('Resume Routes - PUT /api/resumes/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
        mockCheckResumeAccess.mockResolvedValue({ hasAccess: true, error: null });
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent resume', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: false, error: 'Resume not found' });

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: false, error: 'Access denied' });

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Updated Name' });

        expect(res.status).toBe(403);
    });
});

describe('Resume Routes - DELETE /api/resumes/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000');

        expect(res.status).toBe(401);
    });
});

// Note: Input validation tests are skipped because validation middleware is mocked
// Real validation is tested in validation.test.js
