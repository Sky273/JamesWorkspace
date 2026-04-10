import { normalizeRequestBodyAliases } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';

export function normalizePipelineEntryPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        resumeId: normalized.resumeId,
        adaptationId: normalized.adaptationId,
        missionId: normalized.missionId,
        clientId: normalized.clientId,
        stage: normalized.stage,
        notes: normalized.notes
    };
}

export function buildPipelineEntryCreatePayload(payload = {}) {
    const normalized = normalizePipelineEntryPayload(payload);
    return {
        resumeId: normalized.resumeId,
        adaptationId: normalized.adaptationId || null,
        missionId: normalized.missionId || null,
        clientId: normalized.clientId || null,
        stage: normalized.stage || 'new',
        notes: normalized.notes
    };
}

export function buildInterviewSchedulePayload(payload = {}, pipelineId, createdBy) {
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
    } = payload;

    return {
        pipelineId,
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
        createdBy
    };
}

export function buildInterviewCompletionPayload(payload = {}, interviewId, changedBy) {
    return {
        interviewId,
        outcome: payload.outcome,
        outcomeNotes: payload.outcomeNotes,
        changedBy
    };
}

export function parseNonNegativeIntegerQuery(value, defaultValue = null) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function isValidPipelineStage(stage, pipelineStages = []) {
    return pipelineStages.some((item) => item.id === stage);
}

export function createPipelineRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message });
            res.status(500).json({ error: errorMessage });
        }
    };
}

export async function getPipelineRequestAccess(req, getUserFirmId) {
    const isAdmin = req.user?.role === 'admin';
    const userFirmId = await getUserFirmId(req);

    if (!isAdmin && !userFirmId) {
        return { ok: false, status: 403, error: 'No firm association' };
    }

    return { ok: true, isAdmin, userFirmId };
}

export function respondAccessError(res, accessResult) {
    return res.status(accessResult.status).json({ error: accessResult.error });
}

export async function requirePipelineRequestAccess(req, res, getUserFirmId) {
    const access = await getPipelineRequestAccess(req, getUserFirmId);
    if (!access.ok) {
        respondAccessError(res, access);
        return null;
    }

    return access;
}

export async function withPipelineRequestAccess(req, res, getUserFirmId, handler) {
    const access = await requirePipelineRequestAccess(req, res, getUserFirmId);
    if (!access) {
        return null;
    }

    return handler(access);
}

export function hasFirmAccess(isAdmin, userFirmId, ...firmIds) {
    if (isAdmin) {
        return true;
    }

    const scopedFirmIds = firmIds.filter(Boolean);
    if (scopedFirmIds.length === 0) {
        return false;
    }

    return scopedFirmIds.every((firmId) => firmId === userFirmId);
}

export async function getPipelineEntryAccessResult(access, pipelineId, getPipelineAccessContext) {
    const context = await getPipelineAccessContext(pipelineId);
    if (!context) {
        return { ok: false, status: 404, error: 'Pipeline entry not found' };
    }

    if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true, context };
}

export async function requirePipelineEntryAccess(res, access, pipelineId, getPipelineAccessContext) {
    const entryAccess = await getPipelineEntryAccessResult(access, pipelineId, getPipelineAccessContext);
    if (!entryAccess.ok) {
        respondAccessError(res, entryAccess);
        return null;
    }

    return entryAccess;
}

export async function withPipelineEntryAccess(res, access, pipelineId, getPipelineAccessContext, handler) {
    const entryAccess = await requirePipelineEntryAccess(res, access, pipelineId, getPipelineAccessContext);
    if (!entryAccess) {
        return null;
    }

    return handler(entryAccess);
}

export async function getInterviewAccessResult(access, interviewId, getInterviewAccessContext) {
    const context = await getInterviewAccessContext(interviewId);
    if (!context) {
        return { ok: false, status: 404, error: 'Interview not found' };
    }

    if (!hasFirmAccess(access.isAdmin, access.userFirmId, context.resume_firm_id, context.mission_firm_id, context.client_firm_id)) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true, context };
}

export async function requireInterviewAccess(res, access, interviewId, getInterviewAccessContext) {
    const interviewAccess = await getInterviewAccessResult(access, interviewId, getInterviewAccessContext);
    if (!interviewAccess.ok) {
        respondAccessError(res, interviewAccess);
        return null;
    }

    return interviewAccess;
}

export async function withInterviewAccess(res, access, interviewId, getInterviewAccessContext, handler) {
    const interviewAccess = await requireInterviewAccess(res, access, interviewId, getInterviewAccessContext);
    if (!interviewAccess) {
        return null;
    }

    return handler(interviewAccess);
}

export async function getMissionAccessResult(access, missionId, getMissionContext) {
    const mission = await getMissionContext(missionId);
    if (!mission) {
        return { ok: false, status: 404, error: 'Mission not found' };
    }

    if (!hasFirmAccess(access.isAdmin, access.userFirmId, mission.firm_id)) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true, mission };
}

export async function requireMissionAccess(res, access, missionId, getMissionContext) {
    const missionAccess = await getMissionAccessResult(access, missionId, getMissionContext);
    if (!missionAccess.ok) {
        respondAccessError(res, missionAccess);
        return null;
    }

    return missionAccess;
}

export async function withMissionAccess(res, access, missionId, getMissionContext, handler) {
    const missionAccess = await requireMissionAccess(res, access, missionId, getMissionContext);
    if (!missionAccess) {
        return null;
    }

    return handler(missionAccess);
}

export async function getResumeAccessResult(access, resumeId, getResumeFirmId) {
    const resumeFirmId = await getResumeFirmId(resumeId);
    if (!resumeFirmId) {
        return { ok: false, status: 404, error: 'Resume not found' };
    }

    if (!hasFirmAccess(access.isAdmin, access.userFirmId, resumeFirmId)) {
        return { ok: false, status: 403, error: 'Access denied' };
    }

    return { ok: true, resumeFirmId };
}

export async function requireResumeAccess(res, access, resumeId, getResumeFirmId) {
    const resumeAccess = await getResumeAccessResult(access, resumeId, getResumeFirmId);
    if (!resumeAccess.ok) {
        respondAccessError(res, resumeAccess);
        return null;
    }

    return resumeAccess;
}

export async function withResumeAccess(res, access, resumeId, getResumeFirmId, handler) {
    const resumeAccess = await requireResumeAccess(res, access, resumeId, getResumeFirmId);
    if (!resumeAccess) {
        return null;
    }

    return handler(resumeAccess);
}
