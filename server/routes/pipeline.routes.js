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

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

function normalizePipelineEntryPayload(payload = {}) {
    return {
        ...payload,
        resumeId: getFirstDefinedValue(payload, ['resumeId', 'resume_id']),
        missionId: getFirstDefinedValue(payload, ['missionId', 'mission_id']),
        clientId: getFirstDefinedValue(payload, ['clientId', 'client_id']),
        stage: getFirstDefinedValue(payload, ['stage', 'Stage']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes'])
    };
}

async function getPipelineRequestAccess(req) {
    const isAdmin = req.user?.role === 'admin';
    const userFirmId = await getUserFirmId(req);

    if (!isAdmin && !userFirmId) {
        return { ok: false, status: 403, error: 'No firm association' };
    }

    return { ok: true, isAdmin, userFirmId };
}

function hasFirmAccess(isAdmin, userFirmId, ...firmIds) {
    if (isAdmin) {
        return true;
    }

    const scopedFirmIds = firmIds.filter(Boolean);
    if (scopedFirmIds.length === 0) {
        return false;
    }

    return scopedFirmIds.every((firmId) => firmId === userFirmId);
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
router.post('/', authenticateToken, userRateLimit(), validateBody(createPipelineEntrySchema), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const normalizedEntry = normalizePipelineEntryPayload(req.body);
        const { resumeId, missionId, clientId, stage, notes } = normalizedEntry;

        if (!resumeId) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        const associationCheck = await validatePipelineAssociations({
            resumeId,
            missionId: missionId || null,
            clientId: clientId || null,
            expectedFirmId: access.isAdmin ? null : access.userFirmId
        });
        if (!associationCheck.ok) {
            return res.status(associationCheck.status).json({ error: associationCheck.error });
        }

        const pipeline = await addToPipeline({
            resumeId,
            missionId: missionId || null,
            clientId: clientId || null,
            stage: stage || 'new',
            notes,
            createdBy: req.user.id
        });

        res.status(201).json(pipeline);
    } catch (error) {
        safeLog('error', 'Failed to add to pipeline', { error: error.message });
        res.status(500).json({ error: 'Failed to add to pipeline' });
    }
});

/**
 * GET /api/pipeline/overview
 * Get pipeline overview grouped by stage
 */
router.get('/overview', authenticateToken, async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const { clientId, missionId } = req.query;
        const overview = await getPipelineOverview({
            clientId,
            missionId,
            firmId: access.isAdmin ? null : access.userFirmId
        });
        res.json(overview);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline overview', { error: error.message });
        res.status(500).json({ error: 'Failed to get pipeline overview' });
    }
});

/**
 * GET /api/pipeline/interviews/upcoming
 * Get upcoming interviews
 */
router.get('/interviews/upcoming', authenticateToken, async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

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
    } catch (error) {
        safeLog('error', 'Failed to get upcoming interviews', { error: error.message });
        res.status(500).json({ error: 'Failed to get upcoming interviews' });
    }
});

/**
 * GET /api/pipeline/stats
 * Get pipeline statistics
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const { missionId, clientId } = req.query;
        const stats = await getPipelineStats({
            missionId,
            clientId,
            firmId: access.isAdmin ? null : access.userFirmId
        });
        res.json(stats);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get statistics' });
    }
});

/**
 * GET /api/pipeline/:id
 * Get a specific pipeline entry
 */
router.get('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pipeline = await getPipelineById(req.params.id);
        if (!pipeline) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        res.json(pipeline);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline entry', { error: error.message });
        res.status(500).json({ error: 'Failed to get pipeline entry' });
    }
});

/**
 * GET /api/pipeline/resume/:resumeId
 * Get all pipeline entries for a resume
 */
router.get('/resume/:resumeId', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const resumeFirmId = await getResumeFirmId(req.params.resumeId);
        if (!resumeFirmId) {
            return res.status(404).json({ error: 'Resume not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, resumeFirmId)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pipelines = await getPipelineByResumeId(req.params.resumeId);
        res.json(pipelines);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for resume', { error: error.message });
        res.status(500).json({ error: 'Failed to get pipeline entries' });
    }
});

/**
 * GET /api/pipeline/mission/:missionId
 * Get all pipeline entries for a mission (Kanban view)
 */
router.get('/mission/:missionId', authenticateToken, validateParams('missionId'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const mission = await getMissionContext(req.params.missionId);
        if (!mission) {
            return res.status(404).json({ error: 'Mission not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, mission.firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pipelines = await getPipelineByMissionId(req.params.missionId);
        res.json(pipelines);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline for mission', { error: error.message });
        res.status(500).json({ error: 'Failed to get pipeline entries' });
    }
});

/**
 * PATCH /api/pipeline/:id/stage
 * Move a candidate to a different stage
 */
router.patch('/:id/stage', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const { stage, notes } = req.body;

        if (!stage) {
            return res.status(400).json({ error: 'Stage is required' });
        }

        const validStages = PIPELINE_STAGES.map(s => s.id);
        if (!validStages.includes(stage)) {
            return res.status(400).json({ error: 'Invalid stage' });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const pipeline = await moveToStage({
            pipelineId: req.params.id,
            newStage: stage,
            changedBy: req.user.id,
            notes
        });

        res.json(pipeline);
    } catch (error) {
        safeLog('error', 'Failed to move pipeline stage', { error: error.message });
        res.status(500).json({ error: 'Failed to update stage' });
    }
});

/**
 * PATCH /api/pipeline/:id/notes
 * Update pipeline notes
 */
router.patch('/:id/notes', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { notes } = req.body;
        const pipeline = await updatePipelineNotes({
            pipelineId: req.params.id,
            notes
        });

        res.json(pipeline);
    } catch (error) {
        safeLog('error', 'Failed to update pipeline notes', { error: error.message });
        res.status(500).json({ error: 'Failed to update notes' });
    }
});

/**
 * DELETE /api/pipeline/:id
 * Remove from pipeline
 */
router.delete('/:id', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await removeFromPipeline(req.params.id);
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Failed to remove from pipeline', { error: error.message });
        res.status(500).json({ error: 'Failed to remove from pipeline' });
    }
});

/**
 * GET /api/pipeline/:id/history
 * Get pipeline history
 */
router.get('/:id/history', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const history = await getPipelineHistory(req.params.id);
        res.json(history);
    } catch (error) {
        safeLog('error', 'Failed to get pipeline history', { error: error.message });
        res.status(500).json({ error: 'Failed to get history' });
    }
});

// ============================================
// INTERVIEW ROUTES
// ============================================

/**
 * POST /api/pipeline/:id/interviews
 * Schedule an interview
 */
router.post('/:id/interviews', authenticateToken, userRateLimit(), validateParams('id'), validateBody(scheduleInterviewSchema), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

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

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

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
    } catch (error) {
        safeLog('error', 'Failed to schedule interview', { error: error.message });
        res.status(500).json({ error: 'Failed to schedule interview' });
    }
});

/**
 * GET /api/pipeline/:id/interviews
 * Get interviews for a pipeline entry
 */
router.get('/:id/interviews', authenticateToken, validateParams('id'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getPipelineAccessContext(req.params.id);
        if (!context) {
            return res.status(404).json({ error: 'Pipeline entry not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const interviews = await getInterviews(req.params.id);
        res.json(interviews);
    } catch (error) {
        safeLog('error', 'Failed to get interviews', { error: error.message });
        res.status(500).json({ error: 'Failed to get interviews' });
    }
});

/**
 * GET /api/pipeline/interviews/upcoming
 * Get upcoming interviews
 */
/**
 * PATCH /api/pipeline/interviews/:interviewId
 * Update an interview
 */
router.patch('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), validateBody(updateInterviewSchema), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getInterviewAccessContext(req.params.interviewId);
        if (!context) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const interview = await updateInterview(req.params.interviewId, req.body);
        res.json(interview);
    } catch (error) {
        safeLog('error', 'Failed to update interview', { error: error.message });
        res.status(500).json({ error: 'Failed to update interview' });
    }
});

/**
 * POST /api/pipeline/interviews/:interviewId/complete
 * Complete an interview with outcome
 */
router.post('/interviews/:interviewId/complete', authenticateToken, validateParams('interviewId'), validateBody(completeInterviewSchema), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const { outcome, outcomeNotes } = req.body;

        if (!outcome) {
            return res.status(400).json({ error: 'Outcome is required' });
        }

        const context = await getInterviewAccessContext(req.params.interviewId);
        if (!context) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const interview = await completeInterview({
            interviewId: req.params.interviewId,
            outcome,
            outcomeNotes,
            changedBy: req.user.id
        });

        res.json(interview);
    } catch (error) {
        safeLog('error', 'Failed to complete interview', { error: error.message });
        res.status(500).json({ error: 'Failed to complete interview' });
    }
});

/**
 * POST /api/pipeline/interviews/:interviewId/cancel
 * Cancel an interview
 */
router.post('/interviews/:interviewId/cancel', authenticateToken, validateParams('interviewId'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getInterviewAccessContext(req.params.interviewId);
        if (!context) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const interview = await cancelInterview(req.params.interviewId);
        res.json(interview);
    } catch (error) {
        safeLog('error', 'Failed to cancel interview', { error: error.message });
        res.status(500).json({ error: 'Failed to cancel interview' });
    }
});

/**
 * DELETE /api/pipeline/interviews/:interviewId
 * Delete an interview
 */
router.delete('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), async (req, res) => {
    try {
        const access = await getPipelineRequestAccess(req);
        if (!access.ok) {
            return res.status(access.status).json({ error: access.error });
        }

        const context = await getInterviewAccessContext(req.params.interviewId);
        if (!context) {
            return res.status(404).json({ error: 'Interview not found' });
        }
        if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await deleteInterview(req.params.interviewId);
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Failed to delete interview', { error: error.message });
        res.status(500).json({ error: 'Failed to delete interview' });
    }
});

export default router;
