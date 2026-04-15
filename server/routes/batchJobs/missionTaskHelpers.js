import { safeLog } from '../../utils/logger.backend.js';
import {
    ensureFirmId,
    ensureMissionAccess,
    getUserContext,
    normalizeBatchJobPayload,
    resolveFirmId
} from './helpers.js';
import { refundCreditsAmount } from '../../services/aiCredits.service.js';
import { reserveBatchJobCredits, settleBatchJobCredits } from '../../services/batchJobCredits.service.js';
import { JOB_STATUS, updateJobStatus } from '../../services/batchJobs.service.js';

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
    let reservedCredits = null;
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

        const stagedItems = stageItemsBuilder({
            normalizedPayload,
            missionId,
            accessibleMission
        });
        const resolvedOptions = optionsBuilder({
            normalizedPayload,
            userContext,
            firmId,
            missionId,
            accessibleMission
        });

        reservedCredits = await reserveBatchJobCredits({
            firmId,
            userId: userContext.userId,
            jobType,
            itemCount: stagedItems.length,
            options: resolvedOptions,
            metadata: {
                source: 'batch-job',
                missionId
            }
        });

        const finalOptions = reservedCredits
            ? { ...resolvedOptions, creditReservation: reservedCredits }
            : resolvedOptions;

        let job;
        try {
            job = await createJobFn({
                firmId,
                userId: userContext.userId,
                jobType,
                options: finalOptions
            });
            await addJobTaskItemsFn(job.id, stagedItems);
        } catch (createOrStageError) {
            if (job?.id) {
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: createOrStageError.message });
                await settleBatchJobCredits({
                    ...job,
                    status: JOB_STATUS.FAILED,
                    options: finalOptions
                }, {
                    reason: 'batch_job_stage_failed',
                    stagingError: createOrStageError.message
                });
            } else if (reservedCredits?.id) {
                await refundCreditsAmount({
                    id: reservedCredits.id,
                    firm_id: firmId,
                    user_id: userContext.userId || null,
                    action_type: reservedCredits.actionType
                }, reservedCredits.totalReserved, {
                    reason: 'batch_job_create_failed'
                });
            }
            throw createOrStageError;
        }

        const updatedJob = await getJobFn(job.id);

        safeLog('info', successLogMessage, {
            jobId: job.id,
            missionId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        if (error.code === 'INSUFFICIENT_CREDITS') {
            return res.status(402).json({
                code: 'INSUFFICIENT_CREDITS',
                error: 'Insufficient credits for this AI action',
                details: error.details || null
            });
        }
        safeLog('error', errorLogMessage, { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
    }
}
