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

// Mock postgresHelpers
const mockSelectWithTimeout = vi.fn();
const mockFindWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
const mockDestroyWithTimeout = vi.fn();
vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    findWithTimeout: (...args) => mockFindWithTimeout(...args),
    updateWithTimeout: (...args) => mockUpdateWithTimeout(...args),
    escapeLike: (str) => str.replace(/[%_\\]/g, '\\$&'),
    destroyWithTimeout: (...args) => mockDestroyWithTimeout(...args)
}));

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
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
    updateAdaptationSchema: {}
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
                firm_id: 'firm-123'
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
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/adaptations');

        expect(res.status).toBe(401);
    });

    it('should return paginated adaptations for authenticated user', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '5' }]) // count query
            .mockResolvedValueOnce([
                { 
                    id: 'adapt-1', 
                    resume_id: 'resume-1', 
                    mission_id: 'mission-1',
                    resume_name: 'John Doe',
                    mission_title: 'Dev React',
                    status: 'completed',
                    firm: 'Test Firm'
                },
                { 
                    id: 'adapt-2', 
                    resume_id: 'resume-2', 
                    mission_id: 'mission-1',
                    resume_name: 'Jane Smith',
                    mission_title: 'Dev React',
                    status: 'pending',
                    firm: 'Test Firm'
                }
            ]);

        const res = await request(app)
            .get('/api/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.pagination).toBeDefined();
    });

    it('should filter by resumeId', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([
                { id: 'adapt-1', resume_id: 'resume-123', firm: 'Test Firm' }
            ]);

        const res = await request(app)
            .get('/api/adaptations?resumeId=resume-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by missionId', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '2' }])
            .mockResolvedValueOnce([
                { id: 'adapt-1', mission_id: 'mission-123', firm: 'Test Firm' },
                { id: 'adapt-2', mission_id: 'mission-123', firm: 'Test Firm' }
            ]);

        const res = await request(app)
            .get('/api/adaptations?missionId=mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by status', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([
                { id: 'adapt-1', status: 'completed', firm: 'Test Firm' }
            ]);

        const res = await request(app)
            .get('/api/adaptations?status=completed')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by search term', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '1' }])
            .mockResolvedValueOnce([
                { id: 'adapt-1', mission_title: 'React Developer', firm: 'Test Firm' }
            ]);

        const res = await request(app)
            .get('/api/adaptations?search=react')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination parameters', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '50' }])
            .mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/adaptations?page=2&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(2);
    });

    it('should limit max results to 100', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '200' }])
            .mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/adaptations?limit=500')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should allow admin to see all adaptations', async () => {
        mockSelectWithTimeout
            .mockResolvedValueOnce([{ total: '10' }])
            .mockResolvedValueOnce([
                { id: 'adapt-1', firm: 'Other Firm' }
            ]);

        const res = await request(app)
            .get('/api/adaptations')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

describe('Adaptations Routes - GET /api/adaptations/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/adaptations/adapt-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Record not found');
        notFoundError.statusCode = 404;
        mockFindWithTimeout.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return adaptation for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            resume_id: 'resume-1',
            mission_id: 'mission-1',
            resume_name: 'John Doe',
            mission_title: 'Dev React',
            status: 'completed',
            adapted_text: 'Adapted resume content...',
            firm: 'Test Firm'
        });

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('adapt-123');
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            firm: 'Other Firm'
        });

        const res = await request(app)
            .get('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to access any adaptation', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123', 
            firm: 'Other Firm'
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
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .send({ status: 'completed' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Record not found');
        notFoundError.statusCode = 404;
        mockFindWithTimeout.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'completed' });

        expect(res.status).toBe(404);
    });

    it('should update adaptation for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123',
            status: 'pending',
            firm: 'Test Firm'
        });
        mockUpdateWithTimeout.mockResolvedValueOnce([{
            id: 'adapt-123',
            status: 'completed',
            firm: 'Test Firm'
        }]);

        const res = await request(app)
            .put('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'completed' });

        expect(res.status).toBe(200);
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Other Firm'
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
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/adaptations/adapt-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent adaptation', async () => {
        const notFoundError = new Error('Record not found');
        notFoundError.statusCode = 404;
        mockFindWithTimeout.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete adaptation for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Test Firm'
        });
        mockDestroyWithTimeout.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('should return 403 for adaptation from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Other Firm'
        });

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to delete any adaptation', async () => {
        mockFindWithTimeout.mockResolvedValueOnce({ 
            id: 'adapt-123',
            firm: 'Other Firm'
        });
        mockDestroyWithTimeout.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/adaptations/adapt-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

// Note: Input validation tests are skipped because validation middleware is mocked
// Real validation is tested in validation.test.js
