import * as missionsService from '../../services/missions.service.js';
import { getResumeForAccessCheck } from '../../services/resumes.service.js';

export function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

export function normalizeBatchJobPayload(payload = {}) {
    return {
        ...payload,
        firm_id: getFirstDefinedValue(payload, ['firm_id', 'firmId']),
        templateId: getFirstDefinedValue(payload, ['templateId', 'template_id']),
        exportFormat: getFirstDefinedValue(payload, ['exportFormat', 'export_format']),
        exportFormats: getFirstDefinedValue(payload, ['exportFormats', 'export_formats']),
        deleteAfterExport: getFirstDefinedValue(payload, ['deleteAfterExport', 'delete_after_export']),
        relativePaths: getFirstDefinedValue(payload, ['relativePaths', 'relative_paths']),
        resumeIds: getFirstDefinedValue(payload, ['resumeIds', 'resume_ids']),
        resumeId: getFirstDefinedValue(payload, ['resumeId', 'resume_id']),
        dealId: getFirstDefinedValue(payload, ['dealId', 'deal_id']),
        profileType: getFirstDefinedValue(payload, ['profileType', 'profile_type']),
        candidateName: getFirstDefinedValue(payload, ['candidateName', 'candidate_name']),
        candidateEmail: getFirstDefinedValue(payload, ['candidateEmail', 'candidate_email']),
        missionId: getFirstDefinedValue(payload, ['missionId', 'mission_id'])
    };
}

export function parseBoolean(value) {
    return value === 'true' || value === true;
}

export function parseArrayInput(value, defaultValue = []) {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }

    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return Array.isArray(value) ? value : [value];
    }
}

export function buildImportJobOptions(normalizedPayload, rawPayload = {}) {
    const exportFormats = normalizedPayload.exportFormats
        ? parseArrayInput(normalizedPayload.exportFormats, ['pdf'])
        : normalizedPayload.exportFormat
            ? [normalizedPayload.exportFormat]
            : ['pdf'];

    return {
        improve: parseBoolean(rawPayload.improve),
        export: parseBoolean(rawPayload.export),
        exportFormats,
        templateId: normalizedPayload.templateId || null,
        deleteAfterExport: parseBoolean(normalizedPayload.deleteAfterExport),
        profileType: normalizedPayload.profileType || undefined,
        candidateName: normalizedPayload.candidateName || undefined,
        candidateEmail: normalizedPayload.candidateEmail || undefined
    };
}

export function mapCreatedImportJobResponse(job, totalItems) {
    return {
        id: job.id,
        status: job.status,
        firm_id: job.firm_id,
        user_id: job.user_id,
        job_type: job.job_type,
        total_items: totalItems,
        processed_items: job.processed_items || 0,
        success_count: job.success_count || 0,
        error_count: job.error_count || 0,
        options: job.options,
        created_at: job.created_at
    };
}

export function getUserContext(req) {
    return {
        userId: req.user?.id,
        isAdmin: req.user?.role === 'admin',
        userFirmId: req.user?.firmId || req.user?.firm_id
    };
}

export function resolveFirmId({ isAdmin, userFirmId }, normalizedPayload) {
    if (isAdmin && normalizedPayload.firm_id) {
        return normalizedPayload.firm_id;
    }
    return userFirmId;
}

export function ensureFirmId(resolvedFirmId, res) {
    if (!resolvedFirmId) {
        res.status(400).json({ error: 'Firm ID requis' });
        return false;
    }
    return true;
}

export function ensureOwnerAccess(resourceFirmId, userContext, res) {
    if (!userContext.isAdmin && resourceFirmId !== userContext.userFirmId) {
        res.status(403).json({ error: 'Accès non autorisé' });
        return false;
    }
    return true;
}

export async function ensureResumeIdsAccess(resumeIds, firmId, userContext, res) {
    for (const resumeId of resumeIds) {
        const resume = await getResumeForAccessCheck(resumeId);
        if (!resume) {
            res.status(404).json({ error: `CV introuvable: ${resumeId}` });
            return false;
        }

        if (!userContext.isAdmin && resume.firm_id !== userContext.userFirmId) {
            res.status(403).json({ error: 'Accès non autorisé' });
            return false;
        }

        if (firmId && resume.firm_id !== firmId) {
            res.status(400).json({ error: `Le CV ${resumeId} n'appartient pas à la firme ciblée` });
            return false;
        }
    }

    return true;
}

export async function ensureMissionAccess(missionId, firmId, userContext, res) {
    const missionRecord = await missionsService.findMission(missionId);
    if (!missionRecord) {
        res.status(404).json({ error: 'Mission non trouvée' });
        return null;
    }

    const missionFirmId = missionRecord.firm_id || missionRecord.firm;
    if (!ensureOwnerAccess(missionFirmId, userContext, res)) {
        return null;
    }

    if (firmId && missionFirmId !== firmId) {
        res.status(400).json({ error: 'La mission n’appartient pas à la firme ciblée' });
        return null;
    }

    return missionRecord;
}

export async function createJobAndFetchResponse({
    createJobFn,
    getJobFn,
    createParams,
    stageItems,
    responseBuilder = (job) => job
}) {
    const job = await createJobFn(createParams);

    if (typeof stageItems === 'function') {
        await stageItems(job);
    }

    const updatedJob = await getJobFn(job.id);
    return {
        job,
        updatedJob,
        responsePayload: responseBuilder(updatedJob, job)
    };
}
