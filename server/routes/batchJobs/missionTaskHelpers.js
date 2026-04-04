import { safeLog } from '../../utils/logger.backend.js';
import {
    createJobAndFetchResponse,
    ensureFirmId,
    ensureMissionAccess,
    getUserContext,
    normalizeBatchJobPayload,
    resolveFirmId
} from './helpers.js';

export function getNormalizedRequestContext(req) {
    const userContext = getUserContext(req);
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    const firmId = resolveFirmId(userContext, normalizedPayload);

    return {
        userContext,
        normalizedPayload,
        firmId
    };
}

export async function getAccessibleMissionRequestContext(req, res) {
    const { userContext, normalizedPayload, firmId } = getNormalizedRequestContext(req);
    const missionId = normalizedPayload.missionId;

    if (!ensureFirmId(firmId, res)) {
        return null;
    }

    const accessibleMission = await ensureMissionAccess(missionId, firmId, userContext, res);
    if (!accessibleMission) {
        return null;
    }

    return {
        userContext,
        normalizedPayload,
        firmId,
        missionId,
        accessibleMission
    };
}

export async function createMissionTaskJob({
    req,
    res,
    jobType,
    optionsBuilder,
    stageItemsBuilder,
    successLogMessage,
    errorLogMessage,
    beforeMissionAccess,
    createJobFn,
    getJobFn,
    addJobTaskItemsFn
}) {
    try {
        const missionRequest = await getAccessibleMissionRequestContext(req, res);
        if (!missionRequest) {
            return;
        }

        const {
            userContext,
            normalizedPayload,
            firmId,
            missionId,
            accessibleMission
        } = missionRequest;

        if (typeof beforeMissionAccess === 'function') {
            const canContinue = await beforeMissionAccess({
                userContext,
                normalizedPayload,
                firmId,
                missionId,
                accessibleMission,
                res
            });
            if (!canContinue) {
                return;
            }
        }

        const { job, responsePayload: updatedJob } = await createJobAndFetchResponse({
            createJobFn,
            getJobFn,
            createParams: {
                firmId,
                userId: userContext.userId,
                jobType,
                options: optionsBuilder({
                    normalizedPayload,
                    userContext,
                    firmId,
                    missionId,
                    accessibleMission
                })
            },
            stageItems: (createdJob) => addJobTaskItemsFn(
                createdJob.id,
                stageItemsBuilder({
                    normalizedPayload,
                    missionId,
                    accessibleMission
                })
            )
        });

        safeLog('info', successLogMessage, {
            jobId: job.id,
            missionId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', errorLogMessage, { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
    }
}
