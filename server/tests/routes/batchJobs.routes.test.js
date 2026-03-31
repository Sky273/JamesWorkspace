/**
 * Comprehensive tests for Batch Jobs routes
 * GET /, GET /:id, POST /, POST /:id/cancel, DELETE /:id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { Readable } from 'stream';

function getImportFileBuffer(filename) {
    if (filename.endsWith('.pdf')) {
        return Buffer.from('%PDF-1.7 import');
    }
    if (filename.endsWith('.docx')) {
        return Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]);
    }
    if (filename.endsWith('.doc')) {
        return Buffer.from([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]);
    }
    return Buffer.from('invalid');
}

// Mock constants module FIRST
vi.mock('../../config/constants.js', () => ({
    JWT_SECRET: 'test-jwt-secret-for-vitest-minimum-32-chars-long',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-for-vitest-min-32-chars',
    CSRF_SECRET: 'test-csrf-secret-for-vitest-minimum-32-chars',
    UPLOAD_DIR: '/tmp/uploads',
    SALT_ROUNDS: 10,
    MAX_TEXT_LENGTH: 50000,
    MAX_PROMPT_LENGTH: 100000,
    MAX_STRING_FIELD_LENGTH: 1000,
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
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
    const multerMock = (options = {}) => ({
        array: () => (req, res, next) => {
            if (req.headers['x-test-invalid-upload'] === 'true' && typeof options.fileFilter === 'function') {
                options.fileFilter(req, {
                    originalname: 'resume.pdf',
                    mimetype: 'application/msword'
                }, (error) => next(error || undefined));
                return;
            }
            if (req.headers['x-test-invalid-signature'] === 'true') {
                req.files = [{
                    originalname: 'resume.pdf',
                    mimetype: 'application/pdf',
                    buffer: Buffer.from('not-a-pdf'),
                    size: 9
                }];
            } else if (req.headers['x-test-total-too-large'] === 'true') {
                req.files = [
                    {
                        originalname: 'resume-a.pdf',
                        mimetype: 'application/pdf',
                        path: '/tmp/uploads/a.pdf',
                        size: 150 * 1024 * 1024
                    },
                    {
                        originalname: 'resume-b.pdf',
                        mimetype: 'application/pdf',
                        path: '/tmp/uploads/b.pdf',
                        size: 150 * 1024 * 1024
                    }
                ];
            } else {
                req.files = req.files || [];
            }
            if (!req.body) req.body = {};
            next();
        },
        single: () => (req, res, next) => next(),
        none: () => (req, res, next) => next()
    });
    multerMock.memoryStorage = () => ({});
    multerMock.diskStorage = (config) => config;
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
const mockAddJobItemsFromUploadedFiles = vi.fn();
const mockAddJobResumeIds = vi.fn();
const mockAddJobTaskItems = vi.fn();
const mockAddJobExportItems = vi.fn();
const mockCancelJob = vi.fn();
const mockGetJobItem = vi.fn();
const mockResumeItemWithName = vi.fn();
const mockGetItemsPendingName = vi.fn();
const mockFindMission = vi.fn();
const mockClearJobExportFile = vi.fn(() => Promise.resolve());

vi.mock('../../services/batchJobs.service.js', () => ({
    createJob: (...args) => mockCreateJob(...args),
    getJob: (...args) => mockGetJob(...args),
    getJobsByFirm: (...args) => mockGetJobsByFirm(...args),
    getAllJobs: (...args) => mockGetAllJobs(...args),
    deleteJob: (...args) => mockDeleteJob(...args),
    getJobItems: (...args) => mockGetJobItems(...args),
    addJobItems: (...args) => mockAddJobItems(...args),
    addJobItemsFromUploadedFiles: (...args) => mockAddJobItemsFromUploadedFiles(...args),
    addJobResumeIds: (...args) => mockAddJobResumeIds(...args),
    addJobTaskItems: (...args) => mockAddJobTaskItems(...args),
    addJobExportItems: (...args) => mockAddJobExportItems(...args),
    cancelJob: (...args) => mockCancelJob(...args),
    getJobItem: (...args) => mockGetJobItem(...args),
    resumeItemWithName: (...args) => mockResumeItemWithName(...args),
    getItemsPendingName: (...args) => mockGetItemsPendingName(...args),
    clearJobExportFile: (...args) => mockClearJobExportFile(...args),
    getDealForExport: (...args) => mockGetDealForExport(...args),
    getResumesForDeal: (...args) => mockGetResumesForDeal(...args),
    getAdaptationsForDeal: (...args) => mockGetAdaptationsForDeal(...args),
    JOB_STATUS: { PENDING: 'pending', PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', PAUSED: 'paused', CANCELLED: 'cancelled' },
    ITEM_STATUS: { PENDING: 'pending', PROCESSING: 'processing', SUCCESS: 'success', ERROR: 'error', SKIPPED: 'skipped', PENDING_NAME: 'pending_name' }
}));

vi.mock('../../services/missions.service.js', () => ({
    findMission: (...args) => mockFindMission(...args)
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

vi.mock('fs/promises', () => ({
    default: {
        unlink: vi.fn(() => Promise.resolve()),
        open: vi.fn()
    },
    unlink: vi.fn(() => Promise.resolve()),
    open: vi.fn()
}));

// Mock rate limiter (userRateLimit is a factory function)
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
}));

// Mock validation middleware
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    batchImproveSchema: {},
    batchAdaptSchema: {},
    batchMatchSchema: {},
    batchProfileSearchSchema: {},
    batchProfileAnalysisSchema: {},
    batchDealExportSchema: {},
    provideNameSchema: {}
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
        mockAddJobItemsFromUploadedFiles.mockResolvedValueOnce(0);
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
            .send({
                improve: true,
                profile_type: 'external',
                candidate_name: 'Jane Candidate',
                candidate_email: 'jane@example.com'
            });

        expect(res.status).toBe(201);
        expect(res.body.id).toBe('new-job-123');
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                improve: true,
                profileType: 'external',
                candidateName: 'Jane Candidate',
                candidateEmail: 'jane@example.com'
            })
        }));
    });

    it('should reject files when extension and mimetype do not match', async () => {
        const res = await request(app)
            .post('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-invalid-upload', 'true');

        expect(res.status).toBe(500);
    });

    it('should reject files with invalid binary signatures', async () => {
        const res = await request(app)
            .post('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-invalid-signature', 'true');

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Invalid file contents');
    });

    it('should reject batch imports above the total upload size cap', async () => {
        const res = await request(app)
            .post('/api/batch-jobs')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-total-too-large', 'true');

        expect(res.status).toBe(413);
        expect(res.body.error).toContain('250MB');
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


describe('Batch Jobs Routes - POST /api/batch-jobs/improve', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create improve job with camelCase firmId', async () => {
        mockCreateJob.mockResolvedValueOnce({ id: 'job-improve', status: 'pending' });
        mockAddJobResumeIds.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-improve', status: 'pending', firm_id: 'firm-override' });

        const res = await request(app)
            .post('/api/batch-jobs/improve')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({ resumeIds: ['123e4567-e89b-12d3-a456-426614174000'], firmId: 'firm-override', options: { mode: 'fast' } });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-override', jobType: 'improve' }));
    });
});

describe('Batch Jobs Routes - GET /api/batch-jobs/:id/download', () => {
    let app;

    beforeEach(async () => {
        vi.resetAllMocks();
        app = createTestApp();
        const fsModule = await import('fs');
        vi.mocked(fsModule.default.existsSync).mockReturnValue(true);
        vi.mocked(fsModule.default.createReadStream).mockReturnValue(Readable.from(['zip-content']));
        vi.mocked(fsModule.default.unlink).mockImplementation((_path, callback) => callback(null));
    });

    it('should download an available export with safe headers', async () => {
        mockGetJob.mockResolvedValueOnce({
            id: 'job-123',
            firm_id: 'firm-123',
            export_file_path: 'C:/tmp/export.zip',
            export_file_name: 'batch export.zip'
        });

        const res = await request(app)
            .get('/api/batch-jobs/job-123/download')
            .set('Authorization', 'Bearer valid-token');

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('application/zip');
        expect(res.headers['content-disposition']).toContain('attachment');
        expect(res.headers['content-disposition']).toContain('batch_export.zip');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('private, no-store, max-age=0');
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/adapt', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create adapt job with missionId and camelCase firmId', async () => {
        mockCreateJob.mockResolvedValueOnce({ id: 'job-adapt', status: 'pending' });
        mockAddJobResumeIds.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-adapt', status: 'pending', firm_id: 'firm-override' });

        const res = await request(app)
            .post('/api/batch-jobs/adapt')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({
                resumeIds: ['123e4567-e89b-12d3-a456-426614174000'],
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                firmId: 'firm-override',
                options: { mode: 'targeted' }
            });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            firmId: 'firm-override',
            jobType: 'adapt',
            options: expect.objectContaining({
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                adapt: true
            })
        }));
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/match', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create match job with missionId and camelCase firmId', async () => {
        mockCreateJob.mockResolvedValueOnce({ id: 'job-match', status: 'pending' });
        mockAddJobResumeIds.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-match', status: 'pending', firm_id: 'firm-override' });

        const res = await request(app)
            .post('/api/batch-jobs/match')
            .set('Authorization', 'Bearer valid-token')
            .set('x-test-role', 'admin')
            .send({
                resumeIds: ['123e4567-e89b-12d3-a456-426614174000'],
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                firmId: 'firm-override',
                options: { mode: 'analysis-only' }
            });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            firmId: 'firm-override',
            jobType: 'match',
            options: expect.objectContaining({
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                match: true
            })
        }));
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/profile-search', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create profile search job and stage a generic task item', async () => {
        mockFindMission.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Mission Search',
            firm: 'firm-123'
        });
        mockCreateJob.mockResolvedValueOnce({ id: 'job-profile-search', status: 'pending' });
        mockAddJobTaskItems.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-profile-search', status: 'pending', firm_id: 'firm-123' });

        const res = await request(app)
            .post('/api/batch-jobs/profile-search')
            .set('Authorization', 'Bearer valid-token')
            .send({
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                limit: 25,
                minScore: 50
            });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            jobType: 'profile-search',
            options: expect.objectContaining({
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                limit: 25,
                minScore: 50
            })
        }));
        expect(mockAddJobTaskItems).toHaveBeenCalledWith('job-profile-search', [
            expect.objectContaining({
                fileName: 'Mission Search',
                sourceType: 'profile-search'
            })
        ]);
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/profile-analysis', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create profile analysis job for a mission and resume pair', async () => {
        mockFindMission.mockResolvedValueOnce({
            id: '123e4567-e89b-12d3-a456-426614174001',
            title: 'Mission Analysis',
            firm: 'firm-123'
        });
        mockCreateJob.mockResolvedValueOnce({ id: 'job-profile-analysis', status: 'pending' });
        mockAddJobTaskItems.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-profile-analysis', status: 'pending', firm_id: 'firm-123' });

        const res = await request(app)
            .post('/api/batch-jobs/profile-analysis')
            .set('Authorization', 'Bearer valid-token')
            .send({
                missionId: '123e4567-e89b-12d3-a456-426614174001',
                resumeId: '123e4567-e89b-12d3-a456-426614174000'
            });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            jobType: 'profile-analysis',
            options: expect.objectContaining({
                missionId: '123e4567-e89b-12d3-a456-426614174001'
            })
        }));
        expect(mockAddJobTaskItems).toHaveBeenCalledWith('job-profile-analysis', [
            expect.objectContaining({
                resumeId: '123e4567-e89b-12d3-a456-426614174000',
                sourceType: 'profile-analysis'
            })
        ]);
    });
});

describe('Batch Jobs Routes - POST /api/batch-jobs/deal-export', () => {
    let app;

    beforeEach(() => {
        vi.resetAllMocks();
        app = createTestApp();
    });

    it('should create deal export job with snake_case aliases', async () => {
        mockGetDealForExport.mockResolvedValueOnce({ id: '123e4567-e89b-12d3-a456-426614174000', title: 'Deal A', firm_id: 'firm-123' });
        mockGetResumesForDeal.mockResolvedValueOnce([{ id: 'res-1', name: 'Resume A' }]);
        mockGetAdaptationsForDeal.mockResolvedValueOnce([]);
        mockCreateJob.mockResolvedValueOnce({ id: 'job-export', status: 'pending' });
        mockAddJobExportItems.mockResolvedValueOnce(1);
        mockGetJob.mockResolvedValueOnce({ id: 'job-export', status: 'pending', firm_id: 'firm-123' });

        const res = await request(app)
            .post('/api/batch-jobs/deal-export')
            .set('Authorization', 'Bearer valid-token')
            .send({ deal_id: '123e4567-e89b-12d3-a456-426614174000', template_id: '123e4567-e89b-12d3-a456-426614174001', export_formats: ['pdf'] });

        expect(res.status).toBe(201);
        expect(mockCreateJob).toHaveBeenCalledWith(expect.objectContaining({
            jobType: 'deal-export',
            options: expect.objectContaining({
                dealId: '123e4567-e89b-12d3-a456-426614174000',
                templateId: '123e4567-e89b-12d3-a456-426614174001',
                exportFormats: ['pdf']
            })
        }));
    });
});
