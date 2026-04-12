/**
 * Comprehensive tests for Adaptations routes
 * GET /, GET /:id, PUT /:id, DELETE /:id
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

// Mock adaptations service
const mockListAdaptations = vi.fn();
const mockGetAdaptationsGroupedByDeal = vi.fn();
const mockGetAdaptationById = vi.fn();
const mockGetMissionClientContact = vi.fn();
const mockUpdateAdaptation = vi.fn();
const mockDeleteAdaptation = vi.fn();

vi.mock('../../services/adaptations.service.js', () => ({
    listAdaptations: (...args) => mockListAdaptations(...args),
    getAdaptationsGroupedByDeal: (...args) => mockGetAdaptationsGroupedByDeal(...args),
    getAdaptationById: (...args) => mockGetAdaptationById(...args),
    getMissionClientContact: (...args) => mockGetMissionClientContact(...args),
    updateAdaptation: (...args) => mockUpdateAdaptation(...args),
    deleteAdaptation: (...args) => mockDeleteAdaptation(...args)
}));

vi.mock('../../services/viewCacheInvalidation.service.js', () => ({
    invalidateDashboardAndGroupedViews: vi.fn(async () => undefined)
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    updateAdaptationSchema: {},
    normalizeRequestBodyAliases: (value) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return value;
        }

        const normalized = { ...value };
        if (Object.prototype.hasOwnProperty.call(normalized, 'adapted_text') && normalized.adaptedText === undefined) {
            normalized.adaptedText = normalized.adapted_text;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'adapted_title') && normalized.adaptedTitle === undefined) {
            normalized.adaptedTitle = normalized.adapted_title;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'match_score') && normalized.matchScore === undefined) {
            normalized.matchScore = normalized.match_score;
        }
        if (Object.prototype.hasOwnProperty.call(normalized, 'match_analysis') && normalized.matchAnalysis === undefined) {
            normalized.matchAnalysis = normalized.match_analysis;
        }
        return normalized;
    }
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
                customer: 'Test Firm',
                firm_id: req.headers['x-test-no-firm'] === 'true' ? null : 'firm-123'
            };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

// Import routes after mocks
import adaptationsRoutes from '../../routes/adaptations.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/adaptations', adaptationsRoutes);
    return app;
}

describe('Adaptations Routes - GET /api/adaptations', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/adaptations');

        expect(res.status).toBe(401);
    });

    it('should return paginated adaptations for authenticated user', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [
                { 
                    id: 'adapt-1', 
                    resume_id: 'resume-1', 
                    mission_id: 'mission-1',
                    resume_name: 'John Doe',
                    mission_title: 'Dev React',
                    status: 'completed',
                    firm: 'Test Firm',
                    firm_id: 'firm-123'
                },
                { 
                    id: 'adapt-2', 
                    resume_id: 'resume-2', 
                    mission_id: 'mission-1',
                    resume_name: 'Jane Smith',
                    mission_title: 'Dev React',
                    status: 'pending',
                    firm: 'Test Firm',
                    firm_id: 'firm-123'
                }
            ],
            totalCount: 5
        });

        const res = await request(app)
            .get('/api/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
    });

    it('should filter by resumeId', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [{ id: 'adapt-1', resume_id: 'resume-123', firm: 'Test Firm' }],
            totalCount: 1
        });

        const res = await request(app)
            .get('/api/adaptations?resumeId=resume-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListAdaptations).toHaveBeenCalledWith(
            expect.objectContaining({ resumeId: 'resume-123' })
        );
    });

    it('should filter by missionId', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [
                { id: 'adapt-1', mission_id: 'mission-123', firm: 'Test Firm' },
                { id: 'adapt-2', mission_id: 'mission-123', firm: 'Test Firm' }
            ],
            totalCount: 2
        });

        const res = await request(app)
            .get('/api/adaptations?missionId=mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by status', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [{ id: 'adapt-1', status: 'completed', firm: 'Test Firm' }],
            totalCount: 1
        });

        const res = await request(app)
            .get('/api/adaptations?status=completed')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by search term', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [{ id: 'adapt-1', mission_title: 'React Developer', firm: 'Test Firm' }],
            totalCount: 1
        });

        const res = await request(app)
            .get('/api/adaptations?search=react')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination parameters', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [],
            totalCount: 50
        });

        const res = await request(app)
            .get('/api/adaptations?page=2&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(2);
    });

    it('should reject invalid pagination parameters', async () => {
        const res = await request(app)
            .get('/api/adaptations?page=-1&limit=0')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
        expect(mockListAdaptations).not.toHaveBeenCalled();
    });

    it('should limit max results to 100', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [],
            totalCount: 200
        });

        const res = await request(app)
            .get('/api/adaptations?limit=500')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should allow admin to see all adaptations', async () => {
        mockListAdaptations.mockResolvedValueOnce({
            records: [{ id: 'adapt-1', firm: 'Other Firm' }],
            totalCount: 10
        });

        const res = await request(app)
            .get('/api/adaptations')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockListAdaptations).toHaveBeenCalledWith(
            expect.objectContaining({ firmId: null })
        );
    });

    it('should reject non-admin list access without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/adaptations')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'user')
            .set('x-test-no-firm', 'true');

        expect(res.status).toBe(403);
    });
});

describe('Adaptations Routes - GET /api/adaptations/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/adaptations/adapt-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Adaptation not found');
        notFoundError.statusCode = 404;
        mockGetAdaptationById.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return adaptation for authorized user', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            resume_id: 'resume-1',
            mission_id: 'mission-1',
            resume_name: 'John Doe',
            mission_title: 'Dev React',
            status: 'completed',
            adapted_text: 'Adapted resume content...',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });
        mockGetMissionClientContact.mockResolvedValueOnce({ client_id: 'c-1', contact_id: 'cc-1' });

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('adapt-123');
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            firm: 'Other Firm',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to access any adaptation', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            firm: 'Other Firm',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

describe('Adaptations Routes - PUT /api/adaptations/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .send({ status: 'completed' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Adaptation not found');
        notFoundError.statusCode = 404;
        mockGetAdaptationById.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'completed' });

        expect(res.status).toBe(404);
    });

    it('should update adaptation with camelCase payload', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123',
            status: 'pending',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });
        mockUpdateAdaptation.mockResolvedValueOnce({
            id: 'adapt-123',
            status: 'completed',
            adapted_title: 'Modern Title',
            adapted_text: 'Updated adapted text',
            match_score: 88,
            match_analysis: 'Strong match',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({
                adaptedTitle: 'Modern Title',
                adaptedText: 'Updated adapted text',
                status: 'completed',
                matchScore: 88,
                matchAnalysis: 'Strong match'
            });

        expect(res.status).toBe(200);
        expect(mockUpdateAdaptation).toHaveBeenCalledWith('adapt-123', expect.objectContaining({
            adapted_title: 'Modern Title',
            adapted_text: 'Updated adapted text',
            status: 'completed',
            match_score: 88,
            match_analysis: 'Strong match'
        }));
    });

    it('should update adaptation with snake_case payload', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({
            id: 'adapt-124',
            status: 'pending',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });
        mockUpdateAdaptation.mockResolvedValueOnce({
            id: 'adapt-124',
            status: 'completed',
            adapted_title: 'Legacy Title',
            adapted_text: 'Legacy adapted text',
            match_score: 72,
            match_analysis: 'Legacy strong match',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .put('/api/adaptations/adapt-124')
            .set('Authorization', 'Bearer valid-token')
            .send({
                adapted_title: 'Legacy Title',
                adapted_text: 'Legacy adapted text',
                status: 'completed',
                match_score: 72,
                match_analysis: 'Legacy strong match'
            });

        expect(res.status).toBe(200);
        expect(mockUpdateAdaptation).toHaveBeenCalledWith('adapt-124', expect.objectContaining({
            adapted_title: 'Legacy Title',
            adapted_text: 'Legacy adapted text',
            status: 'completed',
            match_score: 72,
            match_analysis: 'Legacy strong match'
        }));
    });

    it('should update adaptation for authorized user', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123',
            status: 'pending',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });
        mockUpdateAdaptation.mockResolvedValueOnce({
            id: 'adapt-123',
            status: 'completed',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'completed' });

        expect(res.status).toBe(200);
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Other Firm',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'completed' });

        expect(res.status).toBe(403);
    });
});

describe('Adaptations Routes - DELETE /api/adaptations/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/adaptations/adapt-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Adaptation not found');
        notFoundError.statusCode = 404;
        mockGetAdaptationById.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete adaptation for authorized user', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Test Firm',
            firm_id: 'firm-123'
        });
        mockDeleteAdaptation.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Other Firm',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to delete any adaptation', async () => {
        mockGetAdaptationById.mockResolvedValueOnce({
            id: 'adapt-123',
            firm: 'Other Firm',
            firm_id: 'firm-other'
        });
        mockDeleteAdaptation.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

// Note: Input validation tests are skipped because validation middleware is mocked
// Real validation is tested in validation.test.js
