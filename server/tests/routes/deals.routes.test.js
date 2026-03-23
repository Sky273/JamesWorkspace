/**
 * Comprehensive tests for Deals routes
 * GET /, GET /stats, GET /:id, POST /, PUT /:id, DELETE /:id
 * Deal-Resume associations: POST /:id/resumes, DELETE /:id/resumes/:resumeId
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

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
const mockIsUserAdmin = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    isUserAdmin: (...args) => mockIsUserAdmin(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock deals service
const mockCreateDeal = vi.fn();
const mockUpdateDeal = vi.fn();
const mockDeleteDeal = vi.fn();
const mockGetDealById = vi.fn();
const mockGetDeals = vi.fn();
const mockAddResumeToDeal = vi.fn();
const mockRemoveResumeFromDeal = vi.fn();
const mockUpdateDealResumeStatus = vi.fn();
const mockGetDealsForResume = vi.fn();
const mockGetResumesForDeal = vi.fn();
const mockGetDealStats = vi.fn();
const mockGetDealFirmId = vi.fn();
const mockGetClientFirmId = vi.fn();
const mockGetResumeFirmId = vi.fn();
const mockGetMissionsForDeal = vi.fn();

vi.mock('../../services/deals.service.js', () => ({
    createDeal: (...args) => mockCreateDeal(...args),
    updateDeal: (...args) => mockUpdateDeal(...args),
    deleteDeal: (...args) => mockDeleteDeal(...args),
    getDealById: (...args) => mockGetDealById(...args),
    getDeals: (...args) => mockGetDeals(...args),
    addResumeToDeal: (...args) => mockAddResumeToDeal(...args),
    removeResumeFromDeal: (...args) => mockRemoveResumeFromDeal(...args),
    updateDealResumeStatus: (...args) => mockUpdateDealResumeStatus(...args),
    getDealsForResume: (...args) => mockGetDealsForResume(...args),
    getResumesForDeal: (...args) => mockGetResumesForDeal(...args),
    getDealStats: (...args) => mockGetDealStats(...args),
    getDealFirmId: (...args) => mockGetDealFirmId(...args),
    getClientFirmId: (...args) => mockGetClientFirmId(...args),
    getResumeFirmId: (...args) => mockGetResumeFirmId(...args),
    getMissionsForDeal: (...args) => mockGetMissionsForDeal(...args),
    DEAL_STATUS: { OPEN: 'open', WON: 'won', LOST: 'lost', PENDING: 'pending' },
    DEAL_PRIORITY: { LOW: 'low', MEDIUM: 'medium', HIGH: 'high' },
    DEAL_RESUME_STATUS: { PENDING: 'pending', SUBMITTED: 'submitted', ACCEPTED: 'accepted', REJECTED: 'rejected' }
}));

// Mock rate limiter (userRateLimit is a factory function)
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createDealSchema: {},
    updateDealSchema: {},
    addDealResumeSchema: {},
    updateDealResumeSchema: {},
    addResumeToMultipleDealsSchema: {}
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
import dealsRoutes from '../../routes/deals.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/deals', dealsRoutes);
    return app;
}

describe('Deals Routes - GET /api/deals', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/deals');

        expect(res.status).toBe(401);
    });

    it('should return 403 for user without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);
        mockIsUserAdmin.mockReturnValue(false);

        const res = await request(app)
            .get('/api/deals')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
        expect(res.body.error).toContain('firm');
    });

    it('should return deals for authenticated user', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetDeals.mockResolvedValueOnce({
            deals: [
                { id: 'deal-1', title: 'Deal 1', status: 'open' },
                { id: 'deal-2', title: 'Deal 2', status: 'pending' }
            ],
            pagination: { page: 1, totalCount: 2 }
        });

        const res = await request(app)
            .get('/api/deals')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.deals).toBeDefined();
        expect(res.body.deals.length).toBe(2);
    });

    it('should filter by status', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetDeals.mockResolvedValueOnce({
            deals: [{ id: 'deal-1', title: 'Deal 1', status: 'open' }],
            pagination: { page: 1, totalCount: 1 }
        });

        const res = await request(app)
            .get('/api/deals?status=open')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockGetDeals).toHaveBeenCalledWith(
            'firm-123',
            expect.objectContaining({ status: 'open' }),
            expect.any(Object)
        );
    });

    it('should filter by priority', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetDeals.mockResolvedValueOnce({
            deals: [],
            pagination: { page: 1, totalCount: 0 }
        });

        const res = await request(app)
            .get('/api/deals?priority=high')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockGetDeals).toHaveBeenCalledWith(
            'firm-123',
            expect.objectContaining({ priority: 'high' }),
            expect.any(Object)
        );
    });

    it('should filter by search term', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetDeals.mockResolvedValueOnce({
            deals: [],
            pagination: { page: 1, totalCount: 0 }
        });

        const res = await request(app)
            .get('/api/deals?search=important')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockGetDeals).toHaveBeenCalledWith(
            'firm-123',
            expect.objectContaining({ search: 'important' }),
            expect.any(Object)
        );
    });

    it('should allow admin to query specific firm', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(true);
        mockGetDeals.mockResolvedValueOnce({
            deals: [],
            pagination: { page: 1, totalCount: 0 }
        });

        const res = await request(app)
            .get('/api/deals?firmId=firm-other')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockGetDeals).toHaveBeenCalledWith(
            'firm-other',
            expect.any(Object),
            expect.any(Object)
        );
    });
});

describe('Deals Routes - GET /api/deals/stats', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/deals/stats');

        expect(res.status).toBe(401);
    });

    it('should return 403 for user without firm association', async () => {
        mockGetUserFirmId.mockResolvedValueOnce(null);
        mockIsUserAdmin.mockReturnValue(false);

        const res = await request(app)
            .get('/api/deals/stats')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should return deal statistics', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetDealStats.mockResolvedValueOnce({
            total: 10,
            byStatus: { open: 5, won: 3, lost: 2 },
            byPriority: { high: 2, medium: 5, low: 3 }
        });

        const res = await request(app)
            .get('/api/deals/stats')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.total).toBe(10);
        expect(res.body.byStatus).toBeDefined();
    });
});

describe('Deals Routes - GET /api/deals/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/deals/deal-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent deal', async () => {
        mockGetDealFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should update deal with camelCase payload', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetClientFirmId.mockResolvedValueOnce('firm-123');
        mockUpdateDeal.mockResolvedValueOnce({
            id: 'deal-123',
            title: 'Camel Updated Deal',
            status: 'won',
            client_id: '123e4567-e89b-12d3-a456-426614174000',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .put('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token')
            .send({
                title: 'Camel Updated Deal',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                expectedEndDate: '2026-03-30',
                budgetMax: 5000
            });

        expect(res.status).toBe(200);
        expect(mockUpdateDeal).toHaveBeenCalledWith('deal-123', expect.objectContaining({
            client_id: '123e4567-e89b-12d3-a456-426614174000',
            expected_end_date: '2026-03-30',
            budget_max: 5000
        }));
    });

    it('should return 403 for deal from different firm', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-other');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .get('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });

    it('should return deal for authorized user', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockGetDealById.mockResolvedValueOnce({
            id: 'deal-123',
            title: 'Important Deal',
            status: 'open',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .get('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('deal-123');
    });

    it('should allow admin to access any deal', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-other');
        mockIsUserAdmin.mockReturnValue(true);
        mockGetDealById.mockResolvedValueOnce({
            id: 'deal-123',
            title: 'Other Firm Deal',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
    });
});

describe('Deals Routes - POST /api/deals', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .post('/api/deals')
            .send({ title: 'New Deal' });

        expect(res.status).toBe(401);
    });

    it('should create deal with valid data', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockCreateDeal.mockResolvedValueOnce({
            id: 'new-deal-123',
            title: 'New Important Deal',
            status: 'open',
            priority: 'high',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .post('/api/deals')
            .set('Authorization', 'Bearer valid-token')
            .send({ 
                title: 'New Important Deal',
                status: 'open',
                priority: 'high'
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('new-deal-123');
    });

    it('should create deal with camelCase payload', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetClientFirmId.mockResolvedValueOnce('firm-123');
        mockCreateDeal.mockResolvedValueOnce({
            id: 'new-deal-camel',
            title: 'Camel Deal',
            status: 'open',
            client_id: '123e4567-e89b-12d3-a456-426614174000',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .post('/api/deals')
            .set('Authorization', 'Bearer valid-token')
            .send({
                title: 'Camel Deal',
                clientId: '123e4567-e89b-12d3-a456-426614174000',
                contactId: '123e4567-e89b-12d3-a456-426614174001',
                expectedStartDate: '2026-03-23',
                budgetMin: 1000,
                budgetMax: 2000
            });

        expect(res.status).toBe(201);
        expect(mockCreateDeal).toHaveBeenCalledWith(expect.objectContaining({
            client_id: '123e4567-e89b-12d3-a456-426614174000',
            contact_id: '123e4567-e89b-12d3-a456-426614174001',
            expected_start_date: '2026-03-23',
            budget_min: 1000,
            budget_max: 2000
        }), 'user-123', 'firm-123');
    });

    it('should reject deal without title', async () => {
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);

        const res = await request(app)
            .post('/api/deals')
            .set('Authorization', 'Bearer valid-token')
            .send({ status: 'open' });

        expect(res.status).toBe(400);
    });
});

describe('Deals Routes - PUT /api/deals/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .put('/api/deals/deal-123')
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent deal', async () => {
        mockGetDealFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .put('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(404);
    });

    it('should update deal for authorized user', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockUpdateDeal.mockResolvedValueOnce({
            id: 'deal-123',
            title: 'Updated Title',
            status: 'won',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .put('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title', status: 'won' });

        expect(res.status).toBe(200);
        expect(res.body.title).toBe('Updated Title');
    });

    it('should return 403 for deal from different firm', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-other');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .put('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token')
            .send({ title: 'Updated Title' });

        expect(res.status).toBe(403);
    });
});

describe('Deals Routes - DELETE /api/deals/:id', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/deals/deal-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent deal', async () => {
        mockGetDealFirmId.mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete deal for authorized user', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-123');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');
        mockDeleteDeal.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('deleted');
    });

    it('should return 403 for deal from different firm', async () => {
        mockGetDealFirmId.mockResolvedValueOnce('firm-other');
        mockIsUserAdmin.mockReturnValue(false);
        mockGetUserFirmId.mockResolvedValueOnce('firm-123');

        const res = await request(app)
            .delete('/api/deals/deal-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Deals Routes - Deal-Resume Associations', () => {
    let app;

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('POST /api/deals/:id/resumes', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .post('/api/deals/deal-123/resumes')
                .send({ resumeId: 'resume-123' });

            expect(res.status).toBe(401);
        });

        it('should add resume to deal', async () => {
            mockGetDealFirmId.mockResolvedValueOnce('firm-123');
            mockGetResumeFirmId.mockResolvedValueOnce('firm-123');
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockAddResumeToDeal.mockResolvedValueOnce({
                deal_id: 'deal-123',
                resume_id: 'resume-123',
                status: 'pending'
            });

            const res = await request(app)
                .post('/api/deals/deal-123/resumes')
                .set('Authorization', 'Bearer valid-token')
                .send({ resumeId: 'resume-123' });

            expect(res.status).toBe(201);
        });

        it('should return 403 for deal from different firm', async () => {
            mockGetDealFirmId.mockResolvedValueOnce('firm-other');
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');

            const res = await request(app)
                .post('/api/deals/deal-123/resumes')
                .set('Authorization', 'Bearer valid-token')
                .send({ resumeId: 'resume-123' });

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /api/deals/:id/resumes/:resumeId', () => {
        it('should return 401 without authentication', async () => {
            const res = await request(app)
                .delete('/api/deals/deal-123/resumes/resume-123');

            expect(res.status).toBe(401);
        });

        it('should remove resume from deal', async () => {
            mockGetDealFirmId.mockResolvedValueOnce('firm-123');
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockRemoveResumeFromDeal.mockResolvedValueOnce(true);

            const res = await request(app)
                .delete('/api/deals/deal-123/resumes/resume-123')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
        });
    });

    describe('GET /api/deals/:id/resumes', () => {
        it('should return resumes for deal', async () => {
            mockGetDealFirmId.mockResolvedValueOnce('firm-123');
            mockIsUserAdmin.mockReturnValue(false);
            mockGetUserFirmId.mockResolvedValueOnce('firm-123');
            mockGetResumesForDeal.mockResolvedValueOnce([
                { id: 'resume-1', name: 'John Doe', status: 'submitted' },
                { id: 'resume-2', name: 'Jane Smith', status: 'pending' }
            ]);

            const res = await request(app)
                .get('/api/deals/deal-123/resumes')
                .set('Authorization', 'Bearer valid-token');

            expect(res.status).toBe(200);
            expect(res.body.length).toBe(2);
        });
    });
});
