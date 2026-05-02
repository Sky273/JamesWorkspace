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
    RATE_LIMIT: { AUTH: { windowMs: 900000, max: 20 }, USER: { windowMs: 900000, max: 50 } },
    MAX_LOGS: 1000
}));

// Mock candidatePipeline service
const mockAddToPipeline = vi.fn();
const mockGetClientFirmId = vi.fn();
const mockGetInterviewAccessContext = vi.fn();
const mockGetMissionContext = vi.fn();
const mockGetPipelineById = vi.fn();
const mockGetPipelineAccessContext = vi.fn();
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
const mockGetResumeFirmId = vi.fn();
const mockValidatePipelineAssociations = vi.fn();

const mockGetUserFirmId = vi.fn();

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
    getClientFirmId: (...args) => mockGetClientFirmId(...args),
    getInterviewAccessContext: (...args) => mockGetInterviewAccessContext(...args),
    getMissionContext: (...args) => mockGetMissionContext(...args),
    getPipelineById: (...args) => mockGetPipelineById(...args),
    getPipelineAccessContext: (...args) => mockGetPipelineAccessContext(...args),
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
    getPipelineStats: (...args) => mockGetPipelineStats(...args),
    getResumeFirmId: (...args) => mockGetResumeFirmId(...args),
    validatePipelineAssociations: (...args) => mockValidatePipelineAssociations(...args)
}));

vi.mock('../../utils/firmHelpers.js', () => ({
    getUserFirmId: (...args) => mockGetUserFirmId(...args)
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
    createPipelineEntrySchema: {},
    scheduleInterviewSchema: {},
    completeInterviewSchema: {},
    updateInterviewSchema: {},
    normalizeRequestBodyAliases: (payload = {}) => {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return payload;
        }

        const normalized = { ...payload };

        if (normalized.resume_id !== undefined && normalized.resumeId === undefined) {
            normalized.resumeId = normalized.resume_id;
        }
        if (normalized.mission_id !== undefined && normalized.missionId === undefined) {
            normalized.missionId = normalized.mission_id;
        }
        if (normalized.client_id !== undefined && normalized.clientId === undefined) {
            normalized.clientId = normalized.client_id;
        }
        if (normalized.adaptation_id !== undefined && normalized.adaptationId === undefined) {
            normalized.adaptationId = normalized.adaptation_id;
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
                firm: 'Test Firm'
            };
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
    const defaultPipelineAccess = {
        id: 'pipe-1',
        resume_firm_id: 'firm-123',
        mission_firm_id: 'firm-123',
        client_firm_id: 'firm-123'
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUserFirmId.mockResolvedValue('firm-123');
        mockValidatePipelineAssociations.mockResolvedValue({ ok: true, firmId: 'firm-123' });
        mockGetPipelineAccessContext.mockResolvedValue(defaultPipelineAccess);
        mockGetInterviewAccessContext.mockResolvedValue({
            id: 'int-1',
            pipeline_id: 'pipe-1',
            resume_firm_id: 'firm-123',
            mission_firm_id: 'firm-123',
            client_firm_id: 'firm-123'
        });
        mockGetResumeFirmId.mockResolvedValue('firm-123');
        mockGetMissionContext.mockResolvedValue({ firm_id: 'firm-123', client_id: 'c-1' });
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
            expect(mockValidatePipelineAssociations).toHaveBeenCalled();
        });

        it('should pass adaptationId when adding an adaptation to the pipeline', async () => {
            const entry = { id: 'pipe-3', resumeId: 'r-3', adaptationId: 'a-1', stage: 'new' };
            mockAddToPipeline.mockResolvedValue(entry);

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resumeId: 'r-3', adaptationId: 'a-1', missionId: 'm-1', stage: 'new' });

            expect(res.status).toBe(201);
            expect(mockValidatePipelineAssociations).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'r-3',
                adaptationId: 'a-1',
                missionId: 'm-1'
            }));
            expect(mockAddToPipeline).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'r-3',
                adaptationId: 'a-1',
                missionId: 'm-1'
            }));
        });

        it('should add to pipeline with snake_case payload', async () => {
            const entry = { id: 'pipe-2', resumeId: 'r-2', stage: 'screening' };
            mockAddToPipeline.mockResolvedValue(entry);

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resume_id: 'r-2', mission_id: 'm-1', client_id: 'c-1', stage: 'screening', notes: 'Legacy payload' });

            expect(res.status).toBe(201);
            expect(mockAddToPipeline).toHaveBeenCalledWith(expect.objectContaining({
                resumeId: 'r-2',
                missionId: 'm-1',
                clientId: 'c-1',
                notes: 'Legacy payload'
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

        it('should reject pipeline creation when adaptation associations are invalid', async () => {
            mockValidatePipelineAssociations.mockResolvedValueOnce({
                ok: false,
                status: 400,
                error: 'Adaptation does not belong to the mission'
            });

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resumeId: 'r-1', adaptationId: 'a-1', missionId: 'm-1' });

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Adaptation does not belong to the mission');
            expect(mockAddToPipeline).not.toHaveBeenCalled();
        });

        it('should reject creation without firm association for non-admin', async () => {
            mockGetUserFirmId.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/pipeline')
                .set(authHeader)
                .send({ resumeId: 'r-1' });

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('No firm association');
            expect(mockAddToPipeline).not.toHaveBeenCalled();
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

        it('should reject access to pipeline entry from another firm', async () => {
            mockGetPipelineAccessContext.mockResolvedValueOnce({
                ...defaultPipelineAccess,
                resume_firm_id: 'firm-other'
            });

            const res = await request(app).get('/api/pipeline/pipe-1').set(authHeader);
            expect(res.status).toBe(403);
        });
    });

    describe('GET /api/pipeline/overview', () => {
        it('should return overview', async () => {
            mockGetPipelineOverview.mockResolvedValue({ new: { count: 1, items: [] } });

            const res = await request(app).get('/api/pipeline/overview').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockGetPipelineOverview).toHaveBeenCalledWith(
                expect.objectContaining({ firmId: 'firm-123' }),
                { bypassCache: false }
            );
        });

        it('should bypass cache when refresh=1 is provided', async () => {
            mockGetPipelineOverview.mockResolvedValue({ new: { count: 1, items: [] } });

            const res = await request(app).get('/api/pipeline/overview?refresh=1').set(authHeader);

            expect(res.status).toBe(200);
            expect(mockGetPipelineOverview).toHaveBeenCalledWith(
                expect.objectContaining({ firmId: 'firm-123' }),
                { bypassCache: true }
            );
        });
    });

    describe('GET /api/pipeline/stats', () => {
        it('should return stats', async () => {
            mockGetPipelineStats.mockResolvedValue({ total: '1' });

            const res = await request(app).get('/api/pipeline/stats').set(authHeader);

            expect(res.status).toBe(200);
            expect(res.body.total).toBe('1');
            expect(mockGetPipelineStats).toHaveBeenCalledWith(expect.objectContaining({ firmId: 'firm-123' }));
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

    describe('GET /api/pipeline/interviews/upcoming', () => {
        it('should return upcoming interviews', async () => {
            mockGetUpcomingInterviews.mockResolvedValue([{ id: 'int-1' }]);

            const res = await request(app)
                .get('/api/pipeline/interviews/upcoming?days=7')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(mockGetUpcomingInterviews).toHaveBeenCalledWith({
                userId: 'user-123',
                days: 7,
                firmId: 'firm-123'
            });
        });

        it('should reject invalid days filter', async () => {
            const res = await request(app)
                .get('/api/pipeline/interviews/upcoming?days=-1')
                .set(authHeader);

            expect(res.status).toBe(400);
            expect(res.body.error).toBe('Invalid days filter');
        });
    });

    describe('GET /api/pipeline/:id/interviews', () => {
        it('should bypass cache when refresh is requested', async () => {
            mockGetInterviews.mockResolvedValue([{ id: 'int-1' }]);

            const res = await request(app)
                .get('/api/pipeline/pipe-1/interviews?refresh=1')
                .set(authHeader);

            expect(res.status).toBe(200);
            expect(mockGetInterviews).toHaveBeenCalledWith('pipe-1', { bypassCache: true });
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
