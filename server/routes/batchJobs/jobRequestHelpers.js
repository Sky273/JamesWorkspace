import {
    ensureFirmId,
    ensureOwnerAccess,
    ensureResumeIdsAccess,
    getUserContext,
    normalizeBatchJobPayload
} from './helpers.js';
import { getAccessibleMissionRequestContext, getNormalizedRequestContext } from './missionTaskHelpers.js';

export async function getResumeIdsJobRequestContext(req, res) {
    const { userContext, normalizedPayload, firmId } = getNormalizedRequestContext(req);
    const { resumeIds, options: jobOptions = {} } = normalizedPayload;

    if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
        res.status(400).json({ error: 'Resume IDs requis' });
        return null;
    }

    if (!ensureFirmId(firmId, res)) {
        return null;
    }

    if (!await ensureResumeIdsAccess(resumeIds, firmId, userContext, res)) {
        return null;
    }

    if (normalizedPayload.missionId) {
        const missionRequest = await getAccessibleMissionRequestContext(req, res);
        if (!missionRequest) {
            return null;
        }
    }

    return {
        userContext,
        normalizedPayload,
        firmId,
        resumeIds,
        jobOptions
    };
}

export async function getDealExportRequestContext(
    req,
    res,
    { getDealForExportFn, getResumesForDealFn, getAdaptationsForDealFn }
) {
    const userContext = getUserContext(req);
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    const { dealId, templateId, exportFormats = ['pdf'] } = normalizedPayload;

    if (!dealId) {
        res.status(400).json({ error: 'Deal ID requis' });
        return null;
    }
    if (!templateId) {
        res.status(400).json({ error: 'Template ID requis' });
        return null;
    }

    const deal = await getDealForExportFn(dealId);
    if (!deal) {
        res.status(404).json({ error: 'Affaire non trouvée' });
        return null;
    }
    if (!ensureOwnerAccess(deal.firm_id, userContext, res)) {
        return null;
    }

    const dealResumes = await getResumesForDealFn(dealId);
    const dealAdaptations = await getAdaptationsForDealFn(dealId);
    const totalItems = dealResumes.length + dealAdaptations.length;
    if (totalItems === 0) {
        res.status(400).json({ error: 'Aucun CV ni adaptation à exporter pour cette affaire' });
        return null;
    }

    return {
        userContext,
        deal,
        dealId,
        templateId,
        exportFormats,
        dealResumes,
        dealAdaptations
    };
}
