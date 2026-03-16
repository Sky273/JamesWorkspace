/**
 * Tests for Pipeline routes
 * GET /stages, POST /, GET /:id, PATCH /:id/stage, PATCH /:id/notes,
 * DELETE /:id, GET /:id/history, POST /:id/interviews, POST /interviews/:id/complete,
 * DELETE /interviews/:id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

// Mock constants
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

// Mock candidatePipeline service
const mockAddToPipeline = vi.fn();
const mockGetPipelineById = vi.fn();
const mockGetPipelineByResumeId = vi.fn();
const mockGetPipelineByMissionId = vi.fn();
const mockGetPipelineOverview = vi.fn();
const mockMoveToStage = vi.fn();
const mockUpdatePipelineNotes = vi.fn();
const mockRemoveFromPipeline = vi.fn();
const mockGetPipelineHistory = vi.fn();
const mockScheduleInterview = vi.fn();
const mockGetInterviews = vi.fn();
const mockGetUpcomingInterviews = vi.fn();
const mockUpdateInterview = vi.fn();
const mockCompleteInterview = vi.fn();
const mockCancelInterview = vi.fn();
const mockDeleteInterview = vi.fn();
const mockGetPipelineStats = vi.fn();

vi.mock('../../services/candidatePipeline.service.js', () => ({
    PIPELINE_STAGES: [
        { id: 'new', label: 'New' },
        { id: 'screening', label: 'Screening' },
        { id: 'interview', label: 'Interview' },
        { id: 'offer', label: 'Offer' },
        { id: 'hired', label: 'Hired' },
        { id: 'rejected', label: 'Rejected' }
    ],
    addToPipeline: (...args) => mockAddToPipeline(...args),
    getPipelineById: (...args) => mockGetPipelineById(...args),
    getPipelineByResumeId: (...args) => mockGetPipelineByResumeId(...args),
    getPipelineByMissionId: (...args) => mockGetPipelineByMissionId(...args),
    getPipelineOverview: (...args) => mockGetPipelineOverview(...args),
    moveToStage: (...args) => mockMoveToStage(...args),
    updatePipelineNotes: (...args) => mockUpdatePipelineNotes(...args),
    removeFromPipeline: (...args) => mockRemoveFromPipeline(...args),
    getPipelineHistory: (...args) => mockGetPipelineHistory(...args),
    scheduleInterview: (...args) => mockScheduleInterview(...args),
    getInterviews: (...args) => mockGetInterviews(...args),
    getUpcomingInterviews: (...args) => mockGetUpcomingInterviews(...args),
    updateInterview: (...args) => mockUpdateInterview(...args),
    completeInterview: (...args) => mockCompleteInterview(...args),
    cancelInterview: (...args) => mockCancelInterview(...args),
    deleteInterview: (...args) => mockDeleteInterview(...args),
    getPipelineStats: (...args) => mockGetPipelineStats(...args)
}));

// Mock logger
vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: vi.fn(),
    createModuleLogger: vi.fn(() => vi.fn())
}));

// Mock rate limiter
vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    userRateLimit: () => (req, res, next) => next()
}));

// Mock validation
vi.mock('../../utils/validation.js', () => ({
    validateBody: () => (req, res, next) => next(),
    validateParams: () => (req, res, next) => next(),
    createPipelineEntrySchema: {}
}));

// Mock auth middleware
vi.mock('../../middleware/auth.middleware.js', () => ({
    authenticateToken: (req, res, next) => {
        if (req.headers.authorization === 'Bearer valid-token') {
            req.user = { id: 'user-123', email: 'test@example.com', role: 'user', firm: 'Test Firm' };
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized' });
        }
    }
}));

import pipelineRoutes from '../../routes/pipeline.routes.js';

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use('/api/pipeline', pipelineRoutes);
    return app;
}

describe('Pipeline Routes', () => {
    let app;
    const authHeader = { Authorization: 'Bearer valid-token' };

    beforeEach(() => {
        vi.clearAllMocks();
        app = createTestApp();
    });

    describe('GET /api/pipeline/stages', () => {
        it('should return pipeline stages', async () => {
            const res = await request(app).get('/api/pipeline/stages').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
            expect(res.body.length).toBe(6);
            expect(res.body[0]).toHaveProperty('id', 'new');
        });

        it('should reject unauthenticated requests', async () => {
            const res = await request(app).get('/api/pipeline/stages');
            expect(res.status).toBe(401);
        });
    });

    describe('POST /api/pipeline', () => {
        it('should add to pipeline', async () => {
            const entry = { id: 'pipe-1', resumeId: 'r-1', stage: 'new' };
            mockAddToPipeline.mockResolvedValue(entry);

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resumeId: 'r-1', stage: 'new' });

            expect(res.status).toBe(201);
            expect(res.body.id).toBe('pipe-1');
            expect(mockAddToPipeline).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'r-1',
                createdBy: 'user-123'
            }));
        });

        it('should return 400 if resumeId missing', async () => {
            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ stage: 'new' });

            expect(res.status).toBe(400);
        });

        it('should return 500 on service error', async () => {
            mockAddToPipeline.mockRejectedValue(new Error('DB error'));

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resumeId: 'r-1' });

            expect(res.status).toBe(500);
        });
    });

    describe('GET /api/pipeline/:id', () => {
        it('should return pipeline entry', async () => {
            mockGetPipelineById.mockResolvedValue({ id: 'pipe-1', stage: 'new' });

            const res = await request(app).get('/api/pipeline/pipe-1').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body.id).toBe('pipe-1');
        });

        it('should return 404 if not found', async () => {
            mockGetPipelineById.mockResolvedValue(null);

            const res = await request(app).get('/api/pipeline/nonexistent').set(authHeader);
            expect(res.status).toBe(404);
        });
    });

    describe('PATCH /api/pipeline/:id/stage', () => {
        it('should move to valid stage', async () => {
            mockMoveToStage.mockResolvedValue({ id: 'pipe-1', stage: 'interview' });

            const res = await request(app)
                .patch('/api/pipeline/pipe-1/stage')
                .set(authHeader)
                .send({ stage: 'interview' });

            expect(res.status).toBe(200);
            expect(mockMoveToStage).toHaveBeenCalledWith(expect.objectContaining({
                pipelineId: 'pipe-1',
                newStage: 'interview',
                changedBy: 'user-123'
            }));
        });

        it('should return 400 if stage missing', async () => {
            const res = await request(app)
                .patch('/api/pipeline/pipe-1/stage')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should return 400 for invalid stage', async () => {
            const res = await request(app)
                .patch('/api/pipeline/pipe-1/stage')
                .set(authHeader)
                .send({ stage: 'invalid_stage' });

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid stage');
        });
    });

    describe('PATCH /api/pipeline/:id/notes', () => {
        it('should update notes', async () => {
            mockUpdatePipelineNotes.mockResolvedValue({ id: 'pipe-1', notes: 'Updated' });

            const res = await request(app)
                .patch('/api/pipeline/pipe-1/notes')
                .set(authHeader)
                .send({ notes: 'Updated' });

            expect(res.status).toBe(200);
        });
    });

    describe('DELETE /api/pipeline/:id', () => {
        it('should remove from pipeline', async () => {
            mockRemoveFromPipeline.mockResolvedValue(undefined);

            const res = await request(app).delete('/api/pipeline/pipe-1').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });

    describe('GET /api/pipeline/:id/history', () => {
        it('should return pipeline history', async () => {
            mockGetPipelineHistory.mockResolvedValue([{ id: 'h-1', from_stage: 'new', to_stage: 'screening' }]);

            const res = await request(app).get('/api/pipeline/pipe-1/history').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body).toBeInstanceOf(Array);
        });
    });

    describe('POST /api/pipeline/:id/interviews', () => {
        it('should schedule interview', async () => {
            mockScheduleInterview.mockResolvedValue({ id: 'int-1', title: 'Tech Interview' });

            const res = await request(app)
                .post('/api/pipeline/pipe-1/interviews')
                .set(authHeader)
                .send({ title: 'Tech Interview', scheduledAt: '2026-04-01T10:00:00Z' });

            expect(res.status).toBe(201);
            expect(mockScheduleInterview).toHaveBeenCalledWith(expect.objectContaining({
                pipelineId: 'pipe-1',
                title: 'Tech Interview'
            }));
        });

        it('should return 400 if title or scheduledAt missing', async () => {
            const res = await request(app)
                .post('/api/pipeline/pipe-1/interviews')
                .set(authHeader)
                .send({ description: 'No title' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/pipeline/interviews/:id/complete', () => {
        it('should complete interview with outcome', async () => {
            mockCompleteInterview.mockResolvedValue({ id: 'int-1', outcome: 'passed' });

            const res = await request(app)
                .post('/api/pipeline/interviews/int-1/complete')
                .set(authHeader)
                .send({ outcome: 'passed', outcomeNotes: 'Great candidate' });

            expect(res.status).toBe(200);
        });

        it('should return 400 if outcome missing', async () => {
            const res = await request(app)
                .post('/api/pipeline/interviews/int-1/complete')
                .set(authHeader)
                .send({});

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/pipeline/interviews/:id', () => {
        it('should delete interview', async () => {
            mockDeleteInterview.mockResolvedValue(undefined);

            const res = await request(app).delete('/api/pipeline/interviews/int-1').set(authHeader);
            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
        });
    });
});
