import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import {
    validateBody,
    validateParams,
    createPipelineEntrySchema,
    scheduleInterviewSchema,
    completeInterviewSchema,
    updateInterviewSchema
} from '../utils/validation.js';
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
import { shouldBypassCache } from '../utils/requestCacheControl.js';

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

async function createPipelineEntry(req, res, access, services) {
    const normalizedEntry = normalizePipelineEntryPayload(req.body);
    const { resumeId, adaptationId, missionId, clientId, stage, notes } = normalizedEntry;

    if (!resumeId) {
        res.status(400).json({ error: 'Resume ID is required' });
        return null;
    }

    const associationCheck = await services.validatePipelineAssociations({
        resumeId,
        adaptationId: adaptationId || null,
        missionId: missionId || null,
        clientId: clientId || null,
        expectedFirmId: access.isAdmin ? null : access.userFirmId
    });
    if (!associationCheck.ok) {
        res.status(associationCheck.status).json({ error: associationCheck.error });
        return null;
    }

    return services.addToPipeline({
        resumeId,
        adaptationId: adaptationId || null,
        missionId: missionId || null,
        clientId: clientId || null,
        stage: stage || 'new',
        notes,
        createdBy: req.user.id
    });
}

function parseUpcomingInterviewDays(days) {
    const parsedDays = days === undefined ? 30 : Number.parseInt(days, 10);
    if (!Number.isInteger(parsedDays) || parsedDays < 0) {
        return { ok: false, status: 400, error: 'Invalid days filter' };
    }

    return { ok: true, value: parsedDays };
}

function validateStage(stage, validStages) {
    if (!stage) {
        return { ok: false, status: 400, error: 'Stage is required' };
    }

    if (!validStages.includes(stage)) {
        return { ok: false, status: 400, error: 'Invalid stage' };
    }

    return { ok: true };
}

function buildScheduledInterviewPayload(req) {
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
        return { ok: false, status: 400, error: 'Title and scheduled date are required' };
    }

    return {
        ok: true,
        value: {
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
        }
    };
}

function buildInterviewCompletionPayload(req) {
    const { outcome, outcomeNotes } = req.body;

    if (!outcome) {
        return { ok: false, status: 400, error: 'Outcome is required' };
    }

    return {
        ok: true,
        value: {
            interviewId: req.params.interviewId,
            outcome,
            outcomeNotes,
            changedBy: req.user.id
        }
    };
}

export function registerPipelineCrudRoutes(router, services) {
    router.post('/', authenticateToken, userRateLimit(), validateBody(createPipelineEntrySchema), createPipelineRouteHandler('Failed to add to pipeline', 'Failed to add to pipeline', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const pipeline = await createPipelineEntry(req, res, access, services);
            if (!pipeline) {
                return;
            }

            res.status(201).json(pipeline);
        });
    }));

    router.get('/overview', authenticateToken, createPipelineRouteHandler('Failed to get pipeline overview', 'Failed to get pipeline overview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const { clientId, missionId } = req.query;
            const bypassCache = shouldBypassCache(req);
            const overview = await services.getPipelineOverview({
                clientId,
                missionId,
                firmId: access.isAdmin ? null : access.userFirmId
            }, { bypassCache });
            res.json(overview);
        });
    }));

    router.get('/stats', authenticateToken, createPipelineRouteHandler('Failed to get pipeline stats', 'Failed to get statistics', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const { missionId, clientId } = req.query;
            const stats = await services.getPipelineStats({
                missionId,
                clientId,
                firmId: access.isAdmin ? null : access.userFirmId
            });
            res.json(stats);
        });
    }));

    router.get('/:id', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get pipeline entry', 'Failed to get pipeline entry', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const bypassCache = shouldBypassCache(req);
            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const pipeline = await services.getPipelineById(req.params.id, { bypassCache });
                if (!pipeline) {
                    return res.status(404).json({ error: 'Pipeline entry not found' });
                }
                res.json(pipeline);
            });
        });
    }));

    router.get('/resume/:resumeId', authenticateToken, validateParams('resumeId'), createPipelineRouteHandler('Failed to get pipeline for resume', 'Failed to get pipeline entries', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const bypassCache = shouldBypassCache(req);
            await withResumeAccess(res, access, req.params.resumeId, services.getResumeFirmId, async () => {
                const pipelines = await services.getPipelineByResumeId(req.params.resumeId, { bypassCache });
                res.json(pipelines);
            });
        });
    }));

    router.get('/mission/:missionId', authenticateToken, validateParams('missionId'), createPipelineRouteHandler('Failed to get pipeline for mission', 'Failed to get pipeline entries', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const bypassCache = shouldBypassCache(req);
            await withMissionAccess(res, access, req.params.missionId, services.getMissionContext, async () => {
                const pipelines = await services.getPipelineByMissionId(req.params.missionId, { bypassCache });
                res.json(pipelines);
            });
        });
    }));

    router.patch('/:id/stage', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to move pipeline stage', 'Failed to update stage', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const stageCheck = validateStage(req.body.stage, services.PIPELINE_STAGES.map((stage) => stage.id));
            if (!stageCheck.ok) {
                return res.status(stageCheck.status).json({ error: stageCheck.error });
            }

            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const pipeline = await services.moveToStage({
                    pipelineId: req.params.id,
                    newStage: req.body.stage,
                    changedBy: req.user.id,
                    notes: req.body.notes
                });

                res.json(pipeline);
            });
        });
    }));

    router.patch('/:id/notes', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to update pipeline notes', 'Failed to update notes', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const pipeline = await services.updatePipelineNotes({
                    pipelineId: req.params.id,
                    notes: req.body.notes
                });

                res.json(pipeline);
            });
        });
    }));

    router.delete('/:id', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to remove from pipeline', 'Failed to remove from pipeline', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                await services.removeFromPipeline(req.params.id);
                res.json({ success: true });
            });
        });
    }));

    router.get('/:id/history', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get pipeline history', 'Failed to get history', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const history = await services.getPipelineHistory(req.params.id);
                res.json(history);
            });
        });
    }));
}

export function registerInterviewRoutes(router, services) {
    router.get('/interviews/upcoming', authenticateToken, createPipelineRouteHandler('Failed to get upcoming interviews', 'Failed to get upcoming interviews', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const daysFilter = parseUpcomingInterviewDays(req.query.days);
            if (!daysFilter.ok) {
                return res.status(daysFilter.status).json({ error: daysFilter.error });
            }

            const interviews = await services.getUpcomingInterviews({
                userId: req.user.id,
                days: daysFilter.value,
                firmId: access.isAdmin ? null : access.userFirmId
            });
            res.json(interviews);
        });
    }));

    router.post('/:id/interviews', authenticateToken, userRateLimit(), validateParams('id'), validateBody(scheduleInterviewSchema), createPipelineRouteHandler('Failed to schedule interview', 'Failed to schedule interview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const payload = buildScheduledInterviewPayload(req);
            if (!payload.ok) {
                return res.status(payload.status).json({ error: payload.error });
            }

            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const interview = await services.scheduleInterview(payload.value);
                res.status(201).json(interview);
            });
        });
    }));

    router.get('/:id/interviews', authenticateToken, validateParams('id'), createPipelineRouteHandler('Failed to get interviews', 'Failed to get interviews', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withPipelineEntryAccess(res, access, req.params.id, services.getPipelineAccessContext, async () => {
                const interviews = await services.getInterviews(req.params.id);
                res.json(interviews);
            });
        });
    }));

    router.patch('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), validateBody(updateInterviewSchema), createPipelineRouteHandler('Failed to update interview', 'Failed to update interview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withInterviewAccess(res, access, req.params.interviewId, services.getInterviewAccessContext, async () => {
                const interview = await services.updateInterview(req.params.interviewId, req.body);
                res.json(interview);
            });
        });
    }));

    router.post('/interviews/:interviewId/complete', authenticateToken, validateParams('interviewId'), validateBody(completeInterviewSchema), createPipelineRouteHandler('Failed to complete interview', 'Failed to complete interview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            const payload = buildInterviewCompletionPayload(req);
            if (!payload.ok) {
                return res.status(payload.status).json({ error: payload.error });
            }

            await withInterviewAccess(res, access, req.params.interviewId, services.getInterviewAccessContext, async () => {
                const interview = await services.completeInterview(payload.value);
                res.json(interview);
            });
        });
    }));

    router.post('/interviews/:interviewId/cancel', authenticateToken, validateParams('interviewId'), createPipelineRouteHandler('Failed to cancel interview', 'Failed to cancel interview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withInterviewAccess(res, access, req.params.interviewId, services.getInterviewAccessContext, async () => {
                const interview = await services.cancelInterview(req.params.interviewId);
                res.json(interview);
            });
        });
    }));

    router.delete('/interviews/:interviewId', authenticateToken, validateParams('interviewId'), createPipelineRouteHandler('Failed to delete interview', 'Failed to delete interview', async (req, res) => {
        await withPipelineRequestAccess(req, res, getUserFirmId, async (access) => {
            await withInterviewAccess(res, access, req.params.interviewId, services.getInterviewAccessContext, async () => {
                await services.deleteInterview(req.params.interviewId);
                res.json({ success: true });
            });
        });
    }));
}
