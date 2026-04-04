/**
 * Pipeline Routes
 * API endpoints for candidate selection pipeline and interview scheduling
 */

import express from 'express';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateBody, validateParams, createPipelineEntrySchema, scheduleInterviewSchema, completeInterviewSchema, updateInterviewSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import {
    normalizePipelineEntryPayload,
    withInterviewAccess,
    withMissionAccess,
    withPipelineEntryAccess,
    withPipelineRequestAccess,
    withResumeAccess
} from './pipeline.routes.helpers.js';
import {
    PIPELINE_STAGES,
    addToPipeline,
    getInterviewAccessContext,
    getMissionContext,
    getPipelineById,
    getPipelineAccessContext,
    getPipelineByResumeId,
    getPipelineByMissionId,
    getPipelineOverview,
    moveToStage,
    updatePipelineNotes,
    removeFromPipeline,
    getResumeFirmId,
    getPipelineHistory,
    scheduleInterview,
    getInterviews,
    getUpcomingInterviews,
    updateInterview,
    completeInterview,
    cancelInterview,
    deleteInterview,
    getPipelineStats,
    validatePipelineAssociations
} from '../services/candidatePipeline.service.js';

const router = express.Router();

function createPipelineRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            res.status(500).json({ error: errorMessage });
        }
    };
}

// ============================================
// PIPELINE STAGES
// ============================================

/**
 * GET /api/pipeline/stages
 * Get all pipeline stages configuration
 */
router.get('/stages', authenticateToken, (req, res) => {
    res.json(PIPELINE_STAGES);
});

// ============================================
// PIPELINE CRUD
// ============================================

/**
 * POST /api/pipeline
 * Add a resume to the pipeline
 */
router.post('/', authenticateToken, userRateLimit(), validateBody(createPipelineEntrySchema), createPipelineRouteHandler('Failed to add to pipeline', 'Failed to add to pipeline', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const pipeline = await createPipelineEntry(req, res, access);
        if (!pipeline) {
            return;
        }

        res.status(201).json(pipeline);
    });
}));

async function createPipelineEntry(req, res, access) {
    const normalizedEntry = normalizePipelineEntryPayload(req.body);
    const { resumeId, missionId, clientId, stage, notes } = normalizedEntry;

    if (!resumeId) {
        res.status(400).json({ error: 'Resume ID is required' });
        return null;
    }

    const associationCheck = await validatePipelineAssociations({
        resumeId,
        missionId: missionId || null,
        clientId: clientId || null,
        expectedFirmId: access.isAdmin ? null : access.userFirmId
    });
    if (!associationCheck.ok) {
        res.status(associationCheck.status).json({ error: associationCheck.error });
        return null;
    }

    return addToPipeline({
        resumeId,
        missionId: missionId || null,
        clientId: clientId || null,
        stage: stage || 'new',
        notes,
        createdBy: req.user.id
    });
}

/**
 * GET /api/pipeline/overview
 * Get pipeline overview grouped by stage
 */
router.get('/overview', authenticateToken, createPipelineRouteHandler('Failed to get pipeline overview', 'Failed to get pipeline overview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const { clientId, missionId } = req.query;
        const overview = await getPipelineOverview({
            clientId,
            missionId,
            firmId: access.isAdmin ? null : access.userFirmId
        });
        res.json(overview);
    });
}));

/**
 * GET /api/pipeline/interviews/upcoming
 * Get upcoming interviews
 */
router.get('/interviews/upcoming', authenticateToken, createPipelineRouteHandler('Failed to get upcoming interviews', 'Failed to get upcoming interviews', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const { days } = req.query;
        const parsedDays = days === undefined ? 30 : Number.parseInt(days, 10);
        if (!Number.isInteger(parsedDays) || parsedDays < 0) {
            return res.status(400).json({ error: 'Invalid days filter' });
        }

        const interviews = await getUpcomingInterviews({
            userId: req.user.id,
            days: parsedDays,
            firmId: access.isAdmin ? null : access.userFirmId
        });
        res.json(interviews);
    });
}));

/**
 * GET /api/pipeline/stats
 * Get pipeline statistics
 */
router.get('/stats', authenticateToken, createPipelineRouteHandler('Failed to get pipeline stats', 'Failed to get statistics', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const { missionId, clientId } = req.query;
        const stats = await getPipelineStats({
            missionId,
            clientId,
            firmId: access.isAdmin ? null : access.userFirmId
        });
        res.json(stats);
    });
}));

/**
 * GET /api/pipeline/:id
 * Get a specific pipeline entry
 */
router.get('/:id', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get pipeline entry', 'Failed to get pipeline entry', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const pipeline = await getPipelineById(req.params.id);
            if (!pipeline) {
                return res.status(404).json({ error: 'Pipeline entry not found' });
            }
            res.json(pipeline);
        });
    });
}));

/**
 * GET /api/pipeline/resume/:resumeId
 * Get all pipeline entries for a resume
 */
router.get('/resume/:resumeId', authenticateToken, validateParams('resumeId'), createPipelineRouteHandler('Failed to get pipeline for resume', 'Failed to get pipeline entries', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withResumeAccess(res, access, req.params.resumeId, getResumeFirmId, async () => {
            const pipelines = await getPipelineByResumeId(req.params.resumeId);
            res.json(pipelines);
        });
    });
}));

/**
 * GET /api/pipeline/mission/:missionId
 * Get all pipeline entries for a mission (Kanban view)
 */
router.get('/mission/:missionId', authenticateToken, validateParams('missionId'), createPipelineRouteHandler('Failed to get pipeline for mission', 'Failed to get pipeline entries', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withMissionAccess(res, access, req.params.missionId, getMissionContext, async () => {
            const pipelines = await getPipelineByMissionId(req.params.missionId);
            res.json(pipelines);
        });
    });
}));

/**
 * PATCH /api/pipeline/:id/stage
 * Move a candidate to a different stage
 */
router.patch('/:id/stage', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to move pipeline stage', 'Failed to update stage', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const { stage, notes } = req.body;

        if (!stage) {
            return res.status(400).json({ error: 'Stage is required' });
        }

        const validStages = PIPELINE_STAGES.map(s => s.id);
        if (!validStages.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const pipeline = await moveToStage({
                pipelineId: req.params.id,
                newStage: stage,
                changedBy: req.user.id,
                notes
            });

            res.json(pipeline);
        });
    });
}));

/**
 * PATCH /api/pipeline/:id/notes
 * Update pipeline notes
 */
router.patch('/:id/notes', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to update pipeline notes', 'Failed to update notes', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const { notes } = req.body;
            const pipeline = await updatePipelineNotes({
                pipelineId: req.params.id,
                notes
            });

            res.json(pipeline);
        });
    });
}));

/**
 * DELETE /api/pipeline/:id
 * Remove from pipeline
 */
router.delete('/:id', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to remove from pipeline', 'Failed to remove from pipeline', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            await removeFromPipeline(req.params.id);
            res.json({ success: true });
        });
    });
}));

/**
 * GET /api/pipeline/:id/history
 * Get pipeline history
 */
router.get('/:id/history', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get pipeline history', 'Failed to get history', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const history = await getPipelineHistory(req.params.id);
            res.json(history);
        });
    });
}));

// ============================================
// INTERVIEW ROUTES
// ============================================

/**
 * POST /api/pipeline/:id/interviews
 * Schedule an interview
 */
router.post('/:id/interviews', authenticateToken, userRateLimit(), validateParams('id'), validateBody(scheduleInterviewSchema), createPipelineRouteHandler('Failed to schedule interview', 'Failed to schedule interview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const {
            title,
            description,
            interviewType,
            scheduledAt,
            durationMinutes,
            location,
            meetingLink,
            attendees,
            calendarEventId,
            calendarProvider
        } = req.body;

        if (!title || !scheduledAt) {
            return res.status(400).json({ error: 'Title and scheduled date are required' });
        }

        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const interview = await scheduleInterview({
                pipelineId: req.params.id,
                title,
                description,
                interviewType,
                scheduledAt,
                durationMinutes,
                location,
                meetingLink,
                attendees,
                calendarEventId,
                calendarProvider,
                createdBy: req.user.id
            });

            res.status(201).json(interview);
        });
    });
}));

/**
 * GET /api/pipeline/:id/interviews
 * Get interviews for a pipeline entry
 */
router.get('/:id/interviews', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get interviews', 'Failed to get interviews', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withPipelineEntryAccess(res, access, req.params.id, getPipelineAccessContext, async () => {
            const interviews = await getInterviews(req.params.id);
            res.json(interviews);
        });
    });
}));

/**
 * PATCH /api/pipeline/interviews/:interviewId
 * Update an interview
 */
router.patch('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), validateBody(updateInterviewSchema), createPipelineRouteHandler('Failed to update interview', 'Failed to update interview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withInterviewAccess(res, access, req.params.interviewId, getInterviewAccessContext, async () => {
            const interview = await updateInterview(req.params.interviewId, req.body);
            res.json(interview);
        });
    });
}));

/**
 * POST /api/pipeline/interviews/:interviewId/complete
 * Complete an interview with outcome
 */
router.post('/interviews/:interviewId/complete', authenticateToken, validateParams('interviewId'), validateBody(completeInterviewSchema), createPipelineRouteHandler('Failed to complete interview', 'Failed to complete interview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        const { outcome, outcomeNotes } = req.body;

        if (!outcome) {
            return res.status(400).json({ error: 'Outcome is required' });
        }

        await withInterviewAccess(res, access, req.params.interviewId, getInterviewAccessContext, async () => {
            const interview = await completeInterview({
                interviewId: req.params.interviewId,
                outcome,
                outcomeNotes,
                changedBy: req.user.id
            });

            res.json(interview);
        });
    });
}));

/**
 * POST /api/pipeline/interviews/:interviewId/cancel
 * Cancel an interview
 */
router.post('/interviews/:interviewId/cancel', authenticateToken, validateParams('interviewId'), createPipelineRouteHandler('Failed to cancel interview', 'Failed to cancel interview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withInterviewAccess(res, access, req.params.interviewId, getInterviewAccessContext, async () => {
            const interview = await cancelInterview(req.params.interviewId);
            res.json(interview);
        });
    });
}));

/**
 * DELETE /api/pipeline/interviews/:interviewId
 * Delete an interview
 */
router.delete('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), createPipelineRouteHandler('Failed to delete interview', 'Failed to delete interview', async (req, res) => {
    await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
        await withInterviewAccess(res, access, req.params.interviewId, getInterviewAccessContext, async () => {
            await deleteInterview(req.params.interviewId);
            res.json({ success: true });
        });
    });
}));

export default router;
