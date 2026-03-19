/**
 * Comprehensive tests for Missions routes
 * GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /:missionId/adaptations
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

// Mock database
const mockQuery = vi.fn();
vi.mock('../../config/database.js', () => ({
    query: (...args) => mockQuery(...args)
}));

// Mock postgres helpers
const mockSelectWithTimeout = vi.fn();
const mockFindWithTimeout = vi.fn();
const mockCreateWithTimeout = vi.fn();
const mockUpdateWithTimeout = vi.fn();
const mockDestroyWithTimeout = vi.fn();

vi.mock('../../utils/postgresHelpers.js', () => ({
    selectWithTimeout: (...args) => mockSelectWithTimeout(...args),
    findWithTimeout: (...args) => mockFindWithTimeout(...args),
    createWithTimeout: (...args) => mockCreateWithTimeout(...args),
    updateWithTimeout: (...args) => mockUpdateWithTimeout(...args),
    destroyWithTimeout: (...args) => mockDestroyWithTimeout(...args),
    escapeLike: (str) => str.replace(/[%_\\]/g, '\\$&')
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

// Mock sanitizer
vi.mock('../../utils/sanitizer.backend.js', () => ({
    sanitizeHtmlContent: (content) => content
}));

// Mock errors utility
vi.mock('../../utils/errors.js', () => ({
    sanitizeErrorMessage: (error, defaultMsg) => defaultMsg
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createMissionSchema: {},
    updateMissionSchema: {}
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
import missionsRoutes from '../../routes/missions.routes.js';

// Helper: create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/missions', missionsRoutes);
    return app;
}

// Helper: sample mission row (as returned by SQL query with joins)
function makeMissionRow(overrides = {}) {
    return {
        id: 'mission-123',
        title: 'Dev React Senior',
        content: '<p>Looking for a React developer</p>',
        firm: 'Test Firm',
        firm_id: 'firm-123',
        status: 'active',
        keywords: ['react', 'javascript'],
        required_skills: ['React', 'TypeScript'],
        preferred_skills: ['Node.js'],
        client_id: null,
        contact_id: null,
        deal_id: null,
        client_name: null,
        client_type: null,
        contact_name: null,
        contact_email: null,
        contact_role: null,
        deal_title: null,
        deal_status: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        ...overrides
    };
}

// ============================================
// GET /api/missions
// ============================================
describe('Missions Routes - GET /api/missions', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app).get('/api/missions');
        expect(res.status).toBe(401);
    });

    it('should return paginated missions for authenticated user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '2' }]);
        mockQuery.mockResolvedValueOnce({
            rows: [
                makeMissionRow({ id: 'mission-1', title: 'Mission A' }),
                makeMissionRow({ id: 'mission-2', title: 'Mission B' })
            ]
        });

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.totalCount).toBe(2);
    });

    it('should return empty results for user without firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.records).toEqual([]);
        expect(res.body.pagination.totalCount).toBe(0);
    });

    it('should filter by status', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '1' }]);
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ status: 'active' })]
        });

        const res = await request(app)
            .get('/api/missions?status=active')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '1' }]);
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ title: 'React Developer' })]
        });

        const res = await request(app)
            .get('/api/missions?search=react')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should filter by dealId', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '1' }]);
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ deal_id: 'deal-1' })]
        });

        const res = await request(app)
            .get('/api/missions?dealId=deal-1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination parameters', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '50' }]);
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/missions?page=3&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(3);
        expect(res.body.pagination.limit).toBe(10);
    });

    it('should cap limit at 100', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '0' }]);
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/missions?limit=500')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.limit).toBeLessThanOrEqual(100);
    });

    it('should allow admin to see all missions without firm filter', async () => {
        mockSelectWithTimeout.mockResolvedValueOnce([{ total: '3' }]);
        mockQuery.mockResolvedValueOnce({
            rows: [
                makeMissionRow({ id: 'mission-1', firm: 'Firm A', firm_id: 'firm-a' }),
                makeMissionRow({ id: 'mission-2', firm: 'Firm B', firm_id: 'firm-b' })
            ]
        });

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockGetUserFirmId).not.toHaveBeenCalled();
    });
});

// ============================================
// GET /api/missions/:id
// ============================================
describe('Missions Routes - GET /api/missions/:id', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app).get('/api/missions/mission-123');
        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent mission', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .get('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return mission for authorized user', async () => {
        mockQuery.mockResolvedValueOnce({ rows: [makeMissionRow()] });
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('mission-123');
        expect(res.body.Title).toBe('Dev React Senior');
    });

    it('should return 403 for mission from different firm', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })]
        });
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to access any mission', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })]
        });

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });

    it('should return mission with client and deal data', async () => {
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({
                client_id: 'client-1',
                client_name: 'Acme Corp',
                client_type: 'client',
                contact_id: 'contact-1',
                contact_name: 'John Doe',
                contact_email: 'john@acme.com',
                deal_id: 'deal-1',
                deal_title: 'Big Deal',
                deal_status: 'open'
            })]
        });
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body['Client Name']).toBe('Acme Corp');
        expect(res.body['Deal Title']).toBe('Big Deal');
        expect(res.body['Contact Name']).toBe('John Doe');
    });
});

// ============================================
// POST /api/missions
// ============================================
describe('Missions Routes - POST /api/missions', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .post('/api/missions')
            .send({ title: 'New Mission' });

        expect(res.status).toBe(401);
    });

    it('should create mission with valid data', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockCreateWithTimeout.mockResolvedValueOnce({ id: 'new-mission-1' });
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({
                id: 'new-mission-1',
                title: 'Dev Full Stack',
                status: 'active'
            })]
        });

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Title: 'Dev Full Stack',
                Content: '<p>Full stack position</p>',
                Status: 'active'
            });

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('new-mission-1');
        expect(res.body.Title).toBe('Dev Full Stack');
    });

    it('should create mission with client and deal associations', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        // client validation query
        mockQuery.mockResolvedValueOnce({ rows: [{ firm_id: 'firm-123' }] });
        // contact validation query
        mockQuery.mockResolvedValueOnce({ rows: [{ id: 'contact-1' }] });
        // deal validation query
        mockQuery.mockResolvedValueOnce({ rows: [{ firm_id: 'firm-123' }] });
        // createWithTimeout
        mockCreateWithTimeout.mockResolvedValueOnce({ id: 'new-mission-2' });
        // fetch with joins query
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({
                id: 'new-mission-2',
                client_id: 'client-1',
                client_name: 'Acme',
                contact_id: 'contact-1',
                deal_id: 'deal-1'
            })]
        });

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Title: 'Mission with links',
                client_id: 'client-1',
                contact_id: 'contact-1',
                deal_id: 'deal-1'
            });

        expect(res.status).toBe(200);
        expect(res.body['Client ID']).toBe('client-1');
    });

    it('should reject if client belongs to different firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        // client validation query - different firm
        mockQuery.mockResolvedValueOnce({ rows: [{ firm_id: 'firm-other' }] });

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Title: 'Mission',
                client_id: 'client-other'
            });

        expect(res.status).toBe(403);
    });

    it('should reject if client not found', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        // client validation query - not found
        mockQuery.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Title: 'Mission',
                client_id: 'nonexistent'
            });

        expect(res.status).toBe(400);
    });
});

// ============================================
// PUT /api/missions/:id
// ============================================
describe('Missions Routes - PUT /api/missions/:id', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/missions/mission-123')
            .send({ title: 'Updated' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent mission', async () => {
        const notFoundError = new Error('Record not found');
        notFoundError.statusCode = 404;
        mockFindWithTimeout.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .put('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should update mission for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockUpdateWithTimeout.mockResolvedValueOnce({ id: 'mission-123' });
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ title: 'Updated Title', status: 'closed' })]
        });

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title', status: 'closed' });

        expect(res.status).toBe(200);
        expect(res.body.Title).toBe('Updated Title');
    });

    it('should return 403 for mission from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated' });

        expect(res.status).toBe(403);
    });

    it('should allow admin to update any mission', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockUpdateWithTimeout.mockResolvedValueOnce({ id: 'mission-123' });
        mockQuery.mockResolvedValueOnce({
            rows: [makeMissionRow({ title: 'Admin Updated' })]
        });

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ title: 'Admin Updated' });

        expect(res.status).toBe(200);
    });
});

// ============================================
// DELETE /api/missions/:id
// ============================================
describe('Missions Routes - DELETE /api/missions/:id', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app).delete('/api/missions/mission-123');
        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent mission', async () => {
        const notFoundError = new Error('Record not found');
        notFoundError.statusCode = 404;
        mockFindWithTimeout.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .delete('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete mission for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockDestroyWithTimeout.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('should return 403 for mission from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to delete any mission', async () => {
        mockDestroyWithTimeout.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockFindWithTimeout).not.toHaveBeenCalled();
    });
});

// ============================================
// GET /api/missions/:missionId/adaptations
// ============================================
describe('Missions Routes - GET /api/missions/:missionId/adaptations', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app).get('/api/missions/mission-123/adaptations');
        expect(res.status).toBe(401);
    });

    it('should return adaptations for authorized user', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockSelectWithTimeout.mockResolvedValueOnce([
            {
                id: 'adapt-1',
                resume_id: 'resume-1',
                mission_id: 'mission-123',
                resume_name: 'John Doe',
                candidate_name: 'John Doe',
                adapted_title: 'Adapted CV',
                mission_title: 'Dev React',
                adapted_text: 'Adapted content',
                match_score: 85,
                status: 'completed',
                created_at: '2024-01-01',
                updated_at: '2024-01-01'
            }
        ]);

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0]['Resume Name']).toBe('John Doe');
    });

    it('should return 403 for mission from different firm', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to view adaptations for any mission', async () => {
        mockFindWithTimeout.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockSelectWithTimeout.mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
