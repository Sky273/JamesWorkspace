export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizePipelineEntryPayload(payload = {}) {
    return {
        ...payload,
        resumeId: getFirstDefinedValue(payload, ['resumeId', 'resume_id']),
        missionId: getFirstDefinedValue(payload, ['missionId', 'mission_id']),
        clientId: getFirstDefinedValue(payload, ['clientId', 'client_id']),
        stage: getFirstDefinedValue(payload, ['stage', 'Stage']),
        notes: getFirstDefinedValue(payload, ['notes', 'Notes'])
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
