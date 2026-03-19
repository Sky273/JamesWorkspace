/**
 * Comprehensive tests for Batch Jobs routes
 * GET /, GET /:id, POST /, POST /:id/cancel, DELETE /:id
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

// Mock deal-export service functions (added to batchJobs.service.js)
const mockGetDealForExport = vi.fn();
const mockGetResumesForDeal = vi.fn();
const mockGetAdaptationsForDeal = vi.fn();

// Mock fs (used by route for file availability checks)
vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(() => false),
        createReadStream: vi.fn(),
        unlink: vi.fn()
    },
    existsSync: vi.fn(() => false),
    createReadStream: vi.fn(),
    unlink: vi.fn()
}));

// Mock multer (used for file uploads in POST /)
vi.mock('multer', () => {
    const multerMock = () => ({
        array: () => (req, res, next) => { req.files = req.files || []; if (!req.body) req.body = {}; next(); },
        single: () => (req, res, next) => next(),
        none: () => (req, res, next) => next()
    });
    multerMock.memoryStorage = () => ({});
    return { default: multerMock };
});

// Mock batchJobs service
const mockCreateJob = vi.fn();
const mockGetJob = vi.fn();
const mockGetJobsByFirm = vi.fn();
const mockGetAllJobs = vi.fn();
const mockDeleteJob = vi.fn();
const mockGetJobItems = vi.fn();
const mockAddJobItems = vi.fn();
const mockAddJobResumeIds = vi.fn();
const mockAddJobExportItems = vi.fn();
const mockCancelJob = vi.fn();
const mockGetJobItem = vi.fn();
const mockResumeItemWithName = vi.fn();
const mockGetItemsPendingName = vi.fn();

vi.mock('../../services/batchJobs.service.js', () => ({
    createJob: (...args) => mockCreateJob(...args),
    getJob: (...args) => mockGetJob(...args),
    getJobsByFirm: (...args) => mockGetJobsByFirm(...args),
    getAllJobs: (...args) => mockGetAllJobs(...args),
    deleteJob: (...args) => mockDeleteJob(...args),
    getJobItems: (...args) => mockGetJobItems(...args),
    addJobItems: (...args) => mockAddJobItems(...args),
    addJobResumeIds: (...args) => mockAddJobResumeIds(...args),
    addJobExportItems: (...args) => mockAddJobExportItems(...args),
    cancelJob: (...args) => mockCancelJob(...args),
    getJobItem: (...args) => mockGetJobItem(...args),
    resumeItemWithName: (...args) => mockResumeItemWithName(...args),
    getItemsPendingName: (...args) => mockGetItemsPendingName(...args),
    getDealForExport: (...args) => mockGetDealForExport(...args),
    getResumesForDeal: (...args) => mockGetResumesForDeal(...args),
    getAdaptationsForDeal: (...args) => mockGetAdaptationsForDeal(...args),
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', PAUSED: 'paused', CANCELLED: 'cancelled' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error', SKIPPED: 'skipped', PENDING_NAME: 'pending_name' }
}));

// Mock firmHelpers
const mockGetUserFirmId = vi.fn();
vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args),
    isUserAdmin: (req) => req.user?.role === 'admin'
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock rate limiter (userRateLimit is a factory function)
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next()
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
import batchJobsRoutes from '../../routes/batchJobs.routes.js';

// Create test app
function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/batch-jobs', batchJobsRoutes);
    return app;
}

describe('Batch Jobs Routes - GET /api/batch-jobs', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/batch-jobs');

        expect(res.status).toBe(401);
    });

    it('should return batch jobs for authenticated user', async () => {
        mockGetJobsByFirm.mockResolvedValueOnce([
            { id: 'job-1', name: 'Batch 1', status: 'completed', firm_id: 'firm-123' },
            { id: 'job-2', name: 'Batch 2', status: 'processing', firm_id: 'firm-123' }
        ]);

        const res = await request(app)
            .get('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(2);
    });

    it('should filter by status', async () => {
        mockGetJobsByFirm.mockResolvedValueOnce([
            { id: 'job-1', status: 'completed' }
        ]);

        const res = await request(app)
            .get('/api/batch-jobs?status=completed')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should support pagination', async () => {
        mockGetJobsByFirm.mockResolvedValueOnce([]);

        const res = await request(app)
            .get('/api/batch-jobs?limit=10&offset=10')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
    });

    it('should use getAllJobs for admin', async () => {
        mockGetAllJobs.mockResolvedValueOnce([
            { id: 'job-1', firm_id: 'firm-other' }
        ]);

        const res = await request(app)
            .get('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin');

        expect(res.status).toBe(200);
        expect(mockGetAllJobs).toHaveBeenCalled();
        expect(mockGetJobsByFirm).not.toHaveBeenCalled();
    });
});

describe('Batch Jobs Routes - GET /api/batch-jobs/:id', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .get('/api/batch-jobs/job-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent job', async () => {
        mockGetJob.mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should return job with items for authorized user', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123', 
            name: 'Test Batch',
            status: 'completed',
            firm_id: 'firm-123',
            total_items: 10,
            processed_items: 10
        });
        mockGetJobItems.mockResolvedValueOnce([
            { id: 'item-1', file_name: 'resume1.pdf', status: 'success' }
        ]);

        const res = await request(app)
            .get('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.id).toBe('job-123');
        expect(res.body.items).toBeDefined();
    });

    it('should return 403 for job from different firm', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .get('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .post('/api/batch-jobs');

        expect(res.status).toBe(401);
    });

    it('should create batch job with firm_id from user', async () => {
        mockCreateJob.mockResolvedValueOnce({ id: 'new-job-123', status: 'pending' });
        mockAddJobItems.mockResolvedValueOnce(0);
        mockGetJob.mockResolvedValueOnce({
            id: 'new-job-123',
            status: 'pending',
            firm_id: 'firm-123',
            total_items: 0
        });

        const res = await request(app)
            .post('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token')
            .set('Content-Type', 'application/json')
            .send({ improve: true });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('new-job-123');
    });
});

describe('Batch Jobs Routes - DELETE /api/batch-jobs/:id', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should return 401 without authentication', async () => {
        const res = await request(app)
            .delete('/api/batch-jobs/job-123');

        expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent job', async () => {
        mockGetJob.mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should delete completed job for authorized user', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            status: 'completed',
            firm_id: 'firm-123'
        });
        mockDeleteJob.mockResolvedValueOnce(true);

        const res = await request(app)
            .delete('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('should reject deleting pending job', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            status: 'pending',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .delete('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
    });

    it('should return 403 for job from different firm', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            status: 'completed',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .delete('/api/batch-jobs/job-123')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/:id/cancel', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should cancel processing job for authorized user', async () => {
        mockGetJob
            .mockResolvedValueOnce({ 
                id: 'job-123',
                status: 'processing',
                firm_id: 'firm-123'
            })
            .mockResolvedValueOnce({
                id: 'job-123',
                status: 'cancelled',
                firm_id: 'firm-123'
            });
        mockCancelJob.mockResolvedValueOnce(true);

        const res = await request(app)
            .post('/api/batch-jobs/job-123/cancel')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(mockCancelJob).toHaveBeenCalled();
    });

    it('should return 404 for non-existent job', async () => {
        mockGetJob.mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/api/batch-jobs/job-123/cancel')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(404);
    });

    it('should reject cancelling completed job', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            status: 'completed',
            firm_id: 'firm-123'
        });

        const res = await request(app)
            .post('/api/batch-jobs/job-123/cancel')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(400);
    });

    it('should return 403 for job from different firm', async () => {
        mockGetJob.mockResolvedValueOnce({ 
            id: 'job-123',
            status: 'processing',
            firm_id: 'firm-other'
        });

        const res = await request(app)
            .post('/api/batch-jobs/job-123/cancel')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(403);
    });
});
