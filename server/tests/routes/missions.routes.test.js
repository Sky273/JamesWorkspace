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
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
}));

// Mock missions service
const mockListMissions = vi.fn();
const mockGetMissionsGroupedByDeal = vi.fn();
const mockGetMissionWithJoins = vi.fn();
const mockMapMissionRecord = vi.fn((r) => ({
    id: r.id, Title: r.title, Content: r.content, Firm: r.firm,
    'Firm ID': r.firm_id, Status: r.status, Keywords: r.keywords,
    'Required Skills': r.required_skills, 'Preferred Skills': r.preferred_skills,
    'Created At': r.created_at, 'Updated At': r.updated_at,
    'Client ID': r.client_id, 'Client Name': r.client_name, 'Client Type': r.client_type,
    'Contact ID': r.contact_id, 'Contact Name': r.contact_name,
    'Contact Email': r.contact_email, 'Contact Role': r.contact_role,
    'Deal ID': r.deal_id, 'Deal Title': r.deal_title, 'Deal Status': r.deal_status
}));
const mockValidateFirm = vi.fn();
const mockValidateClient = vi.fn();
const mockValidateContact = vi.fn();
const mockValidateDeal = vi.fn();
const mockValidateMissionAssociations = vi.fn();
const mockCreateMission = vi.fn();
const mockFindMission = vi.fn();
const mockUpdateMission = vi.fn();
const mockDeleteMission = vi.fn();
const mockListMissionAdaptations = vi.fn();
const mockClearMissionKeywordsCache = vi.fn();

vi.mock('../../services/missions.service.js', () => ({
    listMissions: (...args) => mockListMissions(...args),
    getMissionsGroupedByDeal: (...args) => mockGetMissionsGroupedByDeal(...args),
    getMissionWithJoins: (...args) => mockGetMissionWithJoins(...args),
    mapMissionRecord: (...args) => mockMapMissionRecord(...args),
    validateFirm: (...args) => mockValidateFirm(...args),
    validateClient: (...args) => mockValidateClient(...args),
    validateContact: (...args) => mockValidateContact(...args),
    validateDeal: (...args) => mockValidateDeal(...args),
    validateMissionAssociations: (...args) => mockValidateMissionAssociations(...args),
    createMission: (...args) => mockCreateMission(...args),
    findMission: (...args) => mockFindMission(...args),
    updateMission: (...args) => mockUpdateMission(...args),
    deleteMission: (...args) => mockDeleteMission(...args),
    listMissionAdaptations: (...args) => mockListMissionAdaptations(...args)
}));

vi.mock('../../services/profileMatching.service.js', () => ({
    clearMissionKeywordsCache: (...args) => mockClearMissionKeywordsCache(...args)
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
    updateMissionSchema: {},
    findProfilesSchema: {}
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
        mockListMissions.mockResolvedValueOnce({
            data: [
                { id: 'mission-1', Title: 'Mission A' },
                { id: 'mission-2', Title: 'Mission B' }
            ],
            pagination: { page: 1, limit: 20, totalCount: 2, totalPages: 1, hasMore: false }
        });

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.data).toBeDefined();
        expect(res.body.data.length).toBe(2);
        expect(res.body.pagination).toBeDefined();
        expect(res.body.pagination.totalCount).toBe(2);
        expect(mockListMissions).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-123' }));
    });

    it('should return empty results for user without firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('No firm association');
        expect(mockListMissions).not.toHaveBeenCalled();
    });

    it('should filter by status', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListMissions.mockResolvedValueOnce({
            data: [{ id: 'mission-1', Title: 'Active Mission' }],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1, hasMore: false }
        });

        const res = await request(app)
            .get('/api/missions?status=active')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListMissions).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListMissions.mockResolvedValueOnce({
            data: [{ id: 'mission-1', Title: 'React Developer' }],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1, hasMore: false }
        });

        const res = await request(app)
            .get('/api/missions?search=react')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListMissions).toHaveBeenCalledWith(expect.objectContaining({ search: 'react' }));
    });

    it('should filter by dealId', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListMissions.mockResolvedValueOnce({
            data: [{ id: 'mission-1' }],
            pagination: { page: 1, limit: 20, totalCount: 1, totalPages: 1, hasMore: false }
        });

        const res = await request(app)
            .get('/api/missions?dealId=deal-1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockListMissions).toHaveBeenCalledWith(expect.objectContaining({ dealId: 'deal-1' }));
    });

    it('should support pagination parameters', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListMissions.mockResolvedValueOnce({
            data: [],
            pagination: { page: 3, limit: 10, totalCount: 50, totalPages: 5, hasMore: true }
        });

        const res = await request(app)
            .get('/api/missions?page=3&limit=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.pagination.page).toBe(3);
        expect(res.body.pagination.limit).toBe(10);
    });

    it('should reject invalid pagination parameters', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions?page=0&limit=-1')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
        expect(mockListMissions).not.toHaveBeenCalled();
    });

    it('should reject limit above 100', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions?limit=500')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Invalid pagination parameters');
        expect(mockListMissions).not.toHaveBeenCalled();
    });

    it('should allow admin to see all missions without firm filter', async () => {
        mockListMissions.mockResolvedValueOnce({
            data: [
                { id: 'mission-1', Firm: 'Firm A' },
                { id: 'mission-2', Firm: 'Firm B' }
            ],
            pagination: { page: 1, limit: 20, totalCount: 2, totalPages: 1, hasMore: false }
        });

        const res = await request(app)
            .get('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockGetUserFirmId).not.toHaveBeenCalled();
        expect(mockListMissions).toHaveBeenCalledWith(expect.objectContaining({ firmId: null }));
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
        mockGetMissionWithJoins.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return mission for authorized user', async () => {
        mockGetMissionWithJoins.mockResolvedValueOnce(makeMissionRow());
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('mission-123');
        expect(res.body.Title).toBe('Dev React Senior');
    });

    it('should return 403 for mission from different firm', async () => {
        mockGetMissionWithJoins.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should reject non-admin detail access without firm association', async () => {
        mockGetMissionWithJoins.mockResolvedValueOnce(makeMissionRow());
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to access any mission', async () => {
        mockGetMissionWithJoins.mockResolvedValueOnce(
            makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' })
        );

        const res = await request(app)
            .get('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });

    it('should return mission with client and deal data', async () => {
        mockGetMissionWithJoins.mockResolvedValueOnce(makeMissionRow({
            client_id: 'client-1',
            client_name: 'Acme Corp',
            client_type: 'client',
            contact_id: 'contact-1',
            contact_name: 'John Doe',
            contact_email: 'john@acme.com',
            deal_id: 'deal-1',
            deal_title: 'Big Deal',
            deal_status: 'open'
        }));
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

    it('should create mission with camelCase payload', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const created = makeMissionRow({
            id: 'new-mission-camel',
            title: 'Mission Camel',
            status: 'active',
            required_skills: ['React'],
            preferred_skills: ['Node.js']
        });
        mockCreateMission.mockResolvedValueOnce(created);

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                title: 'Mission Camel',
                content: '<p>Modern payload</p>',
                status: 'active',
                keywords: ['react'],
                requiredSkills: ['React'],
                preferredSkills: ['Node.js']
            });

        expect(res.status).toBe(200);
        expect(mockCreateMission).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Mission Camel',
            content: '<p>Modern payload</p>',
            status: 'active',
            keywords: ['react'],
            required_skills: ['React'],
            preferred_skills: ['Node.js']
        }));
    });

    it('should create mission with valid data', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const created = makeMissionRow({ id: 'new-mission-1', title: 'Dev Full Stack', status: 'active' });
        mockCreateMission.mockResolvedValueOnce(created);

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
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const created = makeMissionRow({
            id: 'new-mission-2', client_id: 'client-1', client_name: 'Acme',
            contact_id: 'contact-1', deal_id: 'deal-1'
        });
        mockCreateMission.mockResolvedValueOnce(created);

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
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: false, status: 403, error: 'Client does not belong to the target firm' });

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
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: false, status: 400, error: 'Client not found' });

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({
                Title: 'Mission',
                client_id: 'nonexistent'
            });

        expect(res.status).toBe(400);
    });

    it('should reject creation for non-admin without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/missions')
            .set('Authorization', 'Bearer valid-token')
            .send({ Title: 'Mission' });

        expect(res.status).toBe(403);
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
        mockFindMission.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .put('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated' });

        expect(res.status).toBe(404);
    });

    it('should update mission with camelCase payload', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const updated = makeMissionRow({ title: 'Updated Camel', status: 'closed', required_skills: ['TS'] });
        mockUpdateMission.mockResolvedValueOnce(updated);

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Camel', status: 'closed', requiredSkills: ['TS'], preferredSkills: ['Node'] });

        expect(res.status).toBe(200);
        expect(mockUpdateMission).toHaveBeenCalledWith('mission-123', expect.objectContaining({
            title: 'Updated Camel',
            status: 'closed',
            required_skills: ['TS'],
            preferred_skills: ['Node'],
            keywords: null
        }));
    });

    it('should invalidate cached mission keywords when title changes', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        mockUpdateMission.mockResolvedValueOnce(makeMissionRow({ title: 'Updated Title' }));

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(200);
        expect(mockUpdateMission).toHaveBeenCalledWith('mission-123', expect.objectContaining({
            title: 'Updated Title',
            keywords: null
        }));
    });

    it('should update mission for authorized user', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const updated = makeMissionRow({ title: 'Updated Title', status: 'closed' });
        mockUpdateMission.mockResolvedValueOnce(updated);

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title', status: 'closed' });

        expect(res.status).toBe(200);
        expect(res.body.Title).toBe('Updated Title');
    });

    it('should return 403 for mission from different firm', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated' });

        expect(res.status).toBe(403);
    });

    it('should reject non-admin update without firm association', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated' });

        expect(res.status).toBe(403);
    });

    it('should allow admin to update any mission', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockValidateMissionAssociations.mockResolvedValueOnce({ ok: true });
        const updated = makeMissionRow({ title: 'Admin Updated' });
        mockUpdateMission.mockResolvedValueOnce(updated);

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ title: 'Admin Updated' });

        expect(res.status).toBe(200);
    });

    it('should reject admin firm change when existing associations do not match target firm', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({
            firm: 'Old Firm',
            firm_id: 'firm-old',
            client_id: 'client-1',
            contact_id: 'contact-1',
            deal_id: 'deal-1'
        }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-admin');
        mockValidateFirm.mockResolvedValueOnce({ id: 'firm-new', name: 'New Firm' });
        mockValidateMissionAssociations.mockResolvedValueOnce({
            ok: false,
            status: 403,
            error: 'Client does not belong to the target firm'
        });

        const res = await request(app)
            .put('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ firmId: 'firm-new' });

        expect(res.status).toBe(403);
        expect(res.body.error).toBe('Client does not belong to your firm');
        expect(mockUpdateMission).not.toHaveBeenCalled();
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
        mockFindMission.mockRejectedValueOnce(notFoundError);

        const res = await request(app)
            .delete('/api/missions/mission-999')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete mission for authorized user', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockDeleteMission.mockResolvedValueOnce(undefined);

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
        expect(mockDeleteMission).toHaveBeenCalledWith('mission-123');
    });

    it('should return 403 for mission from different firm', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should reject non-admin delete without firm association', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to delete any mission', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockDeleteMission.mockResolvedValueOnce(undefined);

        const res = await request(app)
            .delete('/api/missions/mission-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockFindMission).toHaveBeenCalledWith('mission-123');
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
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockListMissionAdaptations.mockResolvedValueOnce([
            {
                id: 'adapt-1',
                'Resume ID': 'resume-1',
                'Mission ID': 'mission-123',
                'Resume Name': 'John Doe',
                'Match Score': 85,
                Status: 'completed'
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
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should reject non-admin adaptations access without firm association', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should allow admin to view adaptations for any mission', async () => {
        mockListMissionAdaptations.mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/missions/mission-123/adaptations')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

// ============================================
// DELETE /api/missions/:missionId/keywords-cache
// ============================================
describe('Missions Routes - DELETE /api/missions/:missionId/keywords-cache', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should clear cached keywords for an authorized user matched by firm_id', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockClearMissionKeywordsCache.mockResolvedValueOnce(undefined);

        const res = await request(app)
            .delete('/api/missions/mission-123/keywords-cache')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockClearMissionKeywordsCache).toHaveBeenCalledWith('mission-123');
    });

    it('should return 403 when the mission belongs to another firm', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Other Firm', firm_id: 'firm-other' }));
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .delete('/api/missions/mission-123/keywords-cache')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(mockClearMissionKeywordsCache).not.toHaveBeenCalled();
    });

    it('should reject keywords cache clear without firm association', async () => {
        mockFindMission.mockResolvedValueOnce(makeMissionRow({ firm: 'Test Firm', firm_id: 'firm-123' }));
        mockGetUserFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/api/missions/mission-123/keywords-cache')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(mockClearMissionKeywordsCache).not.toHaveBeenCalled();
    });
});
