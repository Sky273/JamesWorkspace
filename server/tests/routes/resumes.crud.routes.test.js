/**
 * Comprehensive tests for Resume CRUD routes
 * GET /, GET /:id, PUT /:id, DELETE /:id, GET /:id/download
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { processAnalysisTags } from '../../utils/tagCleaner.js';

// Mock constants module FIRST
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
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

// Mock OpenAI service
vi.mock('../../services/openai.service.js', () => ({
    analyzeResume: vi.fn(),
    cleanupText: vi.fn((text) => text)
}));

// Mock settings + industry + DB side services imported by the route
vi.mock('../../services/settings.service.js', () => ({
    getLLMSettings: vi.fn(async () => ({ cvMode: 'nominative' })),
    calculateWeightedGlobalRating: vi.fn(() => 0)
}));
vi.mock('../../services/industry.service.js', () => ({
    getAcceptedIndustriesString: vi.fn(async () => ''),
    getIndustryMappingString: vi.fn(async () => '')
}));
vi.mock('../../services/database.service.js', () => ({
    query: vi.fn()
}));
vi.mock('../../services/security.service.js', () => ({
    securityLog: vi.fn(),
    getRequestMetadata: vi.fn(() => ({})),
    LOG_LEVELS: { SECURITY: 'SECURITY' },
    SECURITY_EVENTS: { RESUME_UPDATED: 'RESUME_UPDATED', RESUME_DELETED: 'RESUME_DELETED' }
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    }))
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
    normalizeResumeUpdatePayload: vi.fn((body) => ({
        name: body.name ?? body.Name,
        title: body.title ?? body.Title,
        status: body.status ?? body.Status,
        originalText: body.originalText ?? body['Original Text'],
        improvedText: body.improvedText ?? body['Improved Text'],
        globalRating: body.globalRating ?? body['Global Rating'],
        skillsScore: body.skillsScore ?? body['Skills Score'],
        experienceScore: body.experienceScore ?? body['Experience Score'],
        educationScore: body.educationScore ?? body['Education Score'],
        atsScore: body.atsScore ?? body['ATS Score'],
        executiveSummaryScore: body.executiveSummaryScore ?? body['Executive Summary Score'],
        hobbiesLanguagesScore: body.hobbiesLanguagesScore ?? body['Hobbies Languages Score'],
        improvedGlobalRating: body.improvedGlobalRating ?? body['Improved Global Rating'],
        improvedSkillsScore: body.improvedSkillsScore ?? body['Improved Skills Score'],
        improvedExperienceScore: body.improvedExperienceScore ?? body['Improved Experience Score'],
        improvedEducationScore: body.improvedEducationScore ?? body['Improved Education Score'],
        improvedAtsScore: body.improvedAtsScore ?? body['Improved ATS Score'],
        improvedExecutiveSummaryScore: body.improvedExecutiveSummaryScore ?? body['Improved Executive Summary Score'],
        improvedHobbiesLanguagesScore: body.improvedHobbiesLanguagesScore ?? body['Improved Hobbies Languages Score'],
        skills: body.skills ?? body.Skills,
        industries: body.industries ?? body.Industries,
        tools: body.tools ?? body.Tools,
        softSkills: body.softSkills ?? body['Soft Skills'],
        skillsCleaned: body.skillsCleaned ?? body.Skills_cleaned,
        industriesCleaned: body.industriesCleaned ?? body.Industries_cleaned,
        toolsCleaned: body.toolsCleaned ?? body.Tools_cleaned,
        softSkillsCleaned: body.softSkillsCleaned ?? body['Soft Skills_cleaned'],
        skillsEsco: body.skillsEsco ?? body.Skills_esco,
        industriesEsco: body.industriesEsco ?? body.Industries_esco,
        toolsEsco: body.toolsEsco ?? body.Tools_esco,
        softSkillsEsco: body.softSkillsEsco ?? body['Soft Skills_esco'],
        improvedSkills: body.improvedSkills ?? body['Improved Skills'],
        improvedIndustries: body.improvedIndustries ?? body['Improved Industries'],
        improvedTools: body.improvedTools ?? body['Improved Tools'],
        improvedSoftSkills: body.improvedSoftSkills ?? body['Improved Soft Skills'],
        keyImprovements: body.keyImprovements ?? body['Key Improvements'],
        improvedKeyImprovements: body.improvedKeyImprovements ?? body['Improved Key Improvements'],
        summary: body.summary ?? body.Summary,
        experienceYears: body.experienceYears ?? body['Experience Years'],
        educationLevel: body.educationLevel ?? body['Education Level'],
        certifications: body.certifications ?? body.Certifications,
        languages: body.languages ?? body.Languages,
        originalName: body.originalName ?? body['Original Name'],
        analysisDate: body.analysisDate ?? body['Analysis Date'],
        lastImproved: body.lastImproved ?? body['Last Improved']
    })),
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
        mockGetUserFirmId.mockResolvedValue('firm-123');
        mockIsUserAdmin.mockImplementation((req) => req?.user?.role === 'admin');
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
        expect(res.body.resumes).toEqual(res.body.data);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.totalCount).toBe(5);
    });

    it('should return 403 for user without firm_id', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/resumes')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('User has no valid firm association');
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

    it('should reject invalid pagination parameters', async () => {
        const res = await request(app)
            .get('/api/resumes?page=0&limit=-5')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
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
        expect(res.body.name).toBe('Test Resume');
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
            firm_id: 'firm-123',
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
            firm_id: 'firm-other',
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
            firm_id: 'firm-123',
            firm_name: 'Test Firm'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        expect(res.headers['content-disposition']).toContain('resume.pdf');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
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

    it('should successfully update resume with camelCase fields', async () => {
        const updatedRow = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Modern Name',
            title: 'Lead Engineer',
            status: 'improved'
        };
        mockUpdateResume.mockResolvedValueOnce(updatedRow);

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ name: 'Modern Name', title: 'Lead Engineer', status: 'Improved' });

        expect(res.status).toBe(200);
        expect(mockUpdateResume).toHaveBeenCalledWith(
            '123e4567-e89b-12d3-a456-426614174000',
            expect.objectContaining({ name: 'Modern Name', title: 'Lead Engineer', status: 'improved' })
        );
    });

    it('should successfully update resume with Name and Title', async () => {
        const updatedRow = {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Updated Name',
            title: 'Senior Dev',
            status: 'analyzed',
            firm_name: 'Test Firm',
            created_at: '2026-01-01',
            updated_at: '2026-03-20'
        };
        mockUpdateResume.mockResolvedValueOnce(updatedRow);

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ Name: 'Updated Name', Title: 'Senior Dev' });

        expect(res.status).toBe(200);
        expect(mockUpdateResume).toHaveBeenCalledWith(
            '123e4567-e89b-12d3-a456-426614174000',
            expect.objectContaining({ name: 'Updated Name', title: 'Senior Dev' })
        );
        expect(res.body.name).toBe('Updated Name');
        expect(res.body.title).toBe('Senior Dev');
    });

    it('should map Status to lowercase', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            status: 'improved'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ Status: 'Improved' });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ status: 'improved' })
        );
    });

    it('should parse camelCase score fields', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            global_rating: 91
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ globalRating: '91%', skillsScore: 77, improvedSkillsScore: '83%' });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ global_rating: 91, skills_score: 77, improved_skills_score: 83 })
        );
    });

    it('should parse score fields with % format', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            global_rating: 85
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ 'Global Rating': '85%', 'Skills Score': 72 });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({ global_rating: 85, skills_score: 72 })
        );
    });

    it('should handle JSONB fields (Skills_cleaned, Industries_cleaned)', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            skills_cleaned: '["JavaScript","Python"]'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ Skills_cleaned: ['JavaScript', 'Python'], Industries_cleaned: ['Tech'] });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                skills_cleaned: expect.any(String),
                industries_cleaned: expect.any(String)
            })
        );
    });

    it('should return 400 when no fields to update', async () => {
        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('No fields to update');
    });

    it('should handle Key Improvements as object', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            key_improvements: '{"summary":"Better"}'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ 'Key Improvements': { summary: 'Better' } });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                key_improvements: JSON.stringify({ summary: 'Better' })
            })
        );
    });

    it('should handle Key Improvements as string', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            key_improvements: 'Improved formatting'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ 'Key Improvements': 'Improved formatting' });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                key_improvements: 'Improved formatting'
            })
        );
    });

    it('should return 500 on service error', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: true, error: null });
        mockUpdateResume.mockRejectedValueOnce(new Error('DB connection lost'));

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ Name: 'Test' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to update resume');
    });

    it('should handle 404 statusCode error from service', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: true, error: null });
        const notFoundError = new Error('Not found');
        notFoundError.statusCode = 404;
        mockUpdateResume.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({ Name: 'Test' });

        expect(res.status).toBe(404);
    });

    it('should map camelCase text and tag fields', async () => {
        processAnalysisTags.mockReturnValueOnce({
            cleanedTags: {
                skills: ['Node.js'],
                industries: [],
                tools: [],
                softSkills: ['Communication']
            }
        });
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            summary: 'Modern summary'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({
                summary: 'Modern summary',
                experienceYears: 6,
                educationLevel: 'Master',
                certifications: 'AWS',
                languages: 'French',
                skills: ['Node.js'],
                softSkills: ['Communication']
            });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                summary: 'Modern summary',
                experience_years: 6,
                education_level: 'Master',
                certifications: 'AWS',
                languages: 'French',
                skills: expect.any(String),
                soft_skills: expect.any(String)
            })
        );
    });

    it('should map additional text fields', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            summary: 'Test summary',
            experience_years: '5',
            education_level: 'Master'
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Summary: 'Test summary',
                'Experience Years': '5',
                'Education Level': 'Master',
                Certifications: 'AWS',
                Languages: 'French, English'
            });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                summary: 'Test summary',
                experience_years: '5',
                education_level: 'Master',
                certifications: 'AWS',
                languages: 'French, English'
            })
        );
    });

    it('should map improved scores', async () => {
        mockUpdateResume.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            improved_global_rating: 90
        });

        await request(app)
            .put('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token')
            .send({
                'Improved Global Rating': 90,
                'Improved Skills Score': '88%',
                'Improved Experience Score': 92
            });

        expect(mockUpdateResume).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                improved_global_rating: 90,
                improved_skills_score: 88,
                improved_experience_score: 92
            })
        );
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

    it('should successfully delete resume', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: true, error: null });
        mockDeleteResume.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Resume deleted successfully');
        expect(mockDeleteResume).toHaveBeenCalledWith('123e4567-e89b-12d3-a456-426614174000');
    });

    it('should return 404 for non-existent resume', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: false, error: 'Resume not found' });

        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return 403 for unauthorized access', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: false, error: 'Access denied' });

        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should return 404 on statusCode 404 from service', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: true, error: null });
        const notFoundError = new Error('Not found');
        notFoundError.statusCode = 404;
        mockDeleteResume.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return 500 on service error', async () => {
        mockCheckResumeAccess.mockResolvedValueOnce({ hasAccess: true, error: null });
        mockDeleteResume.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .delete('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to delete resume');
    });
});

describe('Resume Routes - GET /api/resumes - error paths', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 500 on service error for list', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .get('/api/resumes')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to fetch resumes');
    });

    it('should handle hasMore with extra records', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(100);
        // Return limit+1 records to trigger hasMore
        const resumes = Array.from({ length: 51 }, (_, i) => ({
            id: `resume-${i}`, name: `Resume ${i}`, status: 'analyzed', firm_id: 'firm-123'
        }));
        mockListResumes.mockResolvedValueOnce(resumes);

        const res = await request(app)
            .get('/api/resumes?limit=50')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.hasMore).toBe(true);
        expect(res.body.pagination.nextPage).toBe(2);
    });

    it('should filter by dealId', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCountResumes.mockResolvedValueOnce(1);
        mockListResumes.mockResolvedValueOnce([
            { id: 'resume-1', name: 'Resume 1', status: 'analyzed', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/resumes?dealId=deal-abc')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });
});

describe('Resume Routes - GET /api/resumes/:id - error paths', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 500 on unexpected service error', async () => {
        mockGetResumeById.mockRejectedValueOnce(new Error('Connection refused'));

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to fetch resume');
    });

    it('should return 404 on statusCode 404 error', async () => {
        const notFoundError = new Error('Not found');
        notFoundError.statusCode = 404;
        mockGetResumeById.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return 403 when user has no firm_id', async () => {
        mockIsUserAdmin.mockReturnValueOnce(false);
        mockGetUserFirmId.mockResolvedValueOnce(null);
        mockGetResumeById.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: 'Test',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Resume Routes - GET /api/resumes/:id/download - error paths', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should allow admin to download any resume', async () => {
        const fileContent = Buffer.from('admin download');
        mockGetResumeFileForDownload.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174000',
            file_name: 'resume.pdf',
            resume_file_data: fileContent,
            resume_file_type: 'application/pdf',
            resume_file_size: fileContent.length,
            firm_name: 'Other Firm'
        });

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });

    it('should return 500 on service error', async () => {
        mockGetResumeFileForDownload.mockRejectedValueOnce(new Error('DB error'));

        const res = await request(app)
            .get('/api/resumes/123e4567-e89b-12d3-a456-426614174000/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Failed to download file');
    });
});

// Note: Input validation tests are skipped because validation middleware is mocked
// Real validation is tested in validation.test.js
