import {
    JOB_STATUS,
    createJob,
    addJobItemsFromUploadedFiles,
    addJobResumeIds,
    addJobTaskItems,
    addJobExportItems,
    getJob,
    getDealForExport,
    getResumesForDeal,
    getAdaptationsForDeal,
    updateJobStatus
} from '../../services/batchJobs.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    cleanupUploadedFiles,
    createJobAndFetchResponse,
    ensureResumeIdsAccess,
    mapCreatedImportJobResponse,
    normalizeBatchJobPayload,
    stageImportJobItems,
    validateImportRequest
} from './helpers.js';
import {
    createMissionTaskJob,
} from './missionTaskHelpers.js';
import {
    getDealExportRequestContext,
    getResumeIdsJobRequestContext
} from './jobRequestHelpers.js';
import {
    buildDealExportItems,
    buildDealExportJobOptions,
    buildDealExportResponse
} from './dealExportHelpers.js';

const BATCH_IMPORT_ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_BATCH_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024;
const DEFAULT_CREATE_JOB_ERROR = 'Erreur lors de la création du job';
const DEAL_EXPORT_CREATE_JOB_ERROR = "Erreur lors de la création du job d'export";

function getMissionIdOrRespond(req, res) {
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    if (!normalizedPayload.missionId) {
        res.status(400).json({ error: 'Mission ID requis' });
        return null;
    }

    return normalizedPayload.missionId;
}

function respondCreateJobError(res, errorLogMessage, error, responseMessage = DEFAULT_CREATE_JOB_ERROR) {
    safeLog('error', errorLogMessage, { error: error.message });
    res.status(500).json({ error: responseMessage });
}

function createMissionResumeIdsJob(req, res, { jobType, logLabel, optionFlag }) {
    const missionId = getMissionIdOrRespond(req, res);
    if (!missionId) {
        return;
    }

    return createResumeIdsJob(req, res, {
        jobType,
        logLabel,
        optionsBuilder: ({ jobOptions }) => ({
            ...jobOptions,
            missionId,
            [optionFlag]: true
        })
    });
}

export async function createImportJob(req, res) {
    try {
        const importRequest = await validateImportRequest({
            req,
            res,
            allowedMimeTypes: BATCH_IMPORT_ALLOWED_MIME_TYPES,
            maxTotalBytes: MAX_BATCH_IMPORT_TOTAL_BYTES
        });
        if (!importRequest.ok) {
            return;
        }

        const {
            userContext,
            firmId,
            options,
            relativePaths,
            uploadedFiles
        } = importRequest;

        const job = await createJob({
            firmId,
            userId: userContext.userId,
            jobType: 'import',
            options
        });

        const responsePayload = mapCreatedImportJobResponse(job, req.files?.length || 0);

        safeLog('info', 'Batch job created via API', {
            jobId: job.id,
            fileCount: uploadedFiles.length,
            totalItems: responsePayload.total_items,
            options: {
                improve: options.improve,
                export: options.export,
                exportFormats: options.exportFormats,
                templateId: options.templateId,
                deleteAfterExport: options.deleteAfterExport,
                profileType: options.profileType,
                hasCandidateName: Boolean(options.candidateName),
                hasCandidateEmail: Boolean(options.candidateEmail)
            }
        });

        res.status(201).json(responsePayload);

        void stageImportJobItems({
            jobId: job.id,
            uploadedFiles,
            relativePaths,
            addJobItemsFromUploadedFiles,
            markJobFailed: (stagingError) => updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: stagingError.message })
        });
    } catch (error) {
        await cleanupUploadedFiles(req.files);
        respondCreateJobError(res, 'Failed to create batch job', error);
    }
}

async function createResumeIdsJob(req, res, { jobType, optionsBuilder, logLabel }) {
    try {
        const jobRequest = await getResumeIdsJobRequestContext(req, res);
        if (!jobRequest) {
            return;
        }

        const {
            userContext,
            normalizedPayload,
            firmId,
            resumeIds,
            jobOptions
        } = jobRequest;

        const { job, responsePayload: updatedJob } = await createJobAndFetchResponse({
            createJobFn: createJob,
            getJobFn: getJob,
            createParams: {
                firmId,
                userId: userContext.userId,
                jobType,
                options: optionsBuilder({ normalizedPayload, jobOptions })
            },
            stageItems: (createdJob) => addJobResumeIds(createdJob.id, resumeIds)
        });

        safeLog('info', `${logLabel} created via API`, {
            jobId: job.id,
            resumeCount: resumeIds.length,
            missionId: normalizedPayload.missionId || null
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        respondCreateJobError(res, `Failed to create ${jobType} job`, error);
    }
}

export function createImproveJob(req, res) {
    return createResumeIdsJob(req, res, {
        jobType: 'improve',
        logLabel: 'Batch improvement job',
        optionsBuilder: ({ jobOptions }) => ({ ...jobOptions, improve: true })
    });
}

export function createAdaptJob(req, res) {
    return createMissionResumeIdsJob(req, res, {
        jobType: 'adapt',
        logLabel: 'Batch adaptation job',
        optionFlag: 'adapt'
    });
}

export function createMatchJob(req, res) {
    return createMissionResumeIdsJob(req, res, {
        jobType: 'match',
        logLabel: 'Batch match job',
        optionFlag: 'match'
    });
}

export async function createProfileSearchJob(req, res) {
    return createMissionTaskJob({
        req,
        res,
        jobType: 'profile-search',
        successLogMessage: 'Profile search job created via API',
        errorLogMessage: 'Failed to create profile search job',
        createJobFn: createJob,
        getJobFn: getJob,
        addJobTaskItemsFn: addJobTaskItems,
        optionsBuilder: ({ normalizedPayload, userContext, firmId, missionId }) => ({
            missionId,
            limit: normalizedPayload.limit ?? 0,
            minScore: normalizedPayload.minScore ?? 0,
            status: normalizedPayload.status ?? null,
            weights: normalizedPayload.weights,
            dealId: normalizedPayload.dealId || null,
            searchFirmId: userContext.isAdmin && !normalizedPayload.firmId ? null : firmId
        }),
        stageItemsBuilder: ({ missionId, accessibleMission }) => [{
            fileName: accessibleMission.title || `Mission ${missionId}`,
            sourceType: 'profile-search'
        }]
    });
}

export async function createProfileAnalysisJob(req, res) {
    return createMissionTaskJob({
        req,
        res,
        jobType: 'profile-analysis',
        successLogMessage: 'Profile analysis job created via API',
        errorLogMessage: 'Failed to create profile analysis job',
        createJobFn: createJob,
        getJobFn: getJob,
        addJobTaskItemsFn: addJobTaskItems,
        beforeMissionAccess: async ({ normalizedPayload, firmId, userContext, res }) => {
            const resumeId = normalizedPayload.resumeId;
            return ensureResumeIdsAccess([resumeId], firmId, userContext, res);
        },
        optionsBuilder: ({ missionId }) => ({ missionId }),
        stageItemsBuilder: ({ normalizedPayload }) => [{
            resumeId: normalizedPayload.resumeId,
            fileName: `Profile Analysis ${normalizedPayload.resumeId}`,
            sourceType: 'profile-analysis'
        }]
    });
}

export async function createDealExportJob(req, res) {
    try {
        const exportRequest = await getDealExportRequestContext(req, res, {
            getDealForExportFn: getDealForExport,
            getResumesForDealFn: getResumesForDeal,
            getAdaptationsForDealFn: getAdaptationsForDeal
        });
        if (!exportRequest) {
            return;
        }

        const {
            userContext,
            deal,
            dealId,
            templateId,
            exportFormats,
            dealResumes,
            dealAdaptations
        } = exportRequest;

        const exportItems = buildDealExportItems(dealResumes, dealAdaptations);

        const { job, updatedJob } = await createJobAndFetchResponse({
            createJobFn: createJob,
            getJobFn: getJob,
            createParams: {
                firmId: deal.firm_id,
                userId: userContext.userId,
                jobType: 'deal-export',
                options: buildDealExportJobOptions({ deal, dealId, templateId, exportFormats })
            },
            stageItems: (createdJob) => addJobExportItems(createdJob.id, exportItems)
        });

        safeLog('info', 'Deal export job created', {
            jobId: job.id,
            dealId,
            dealTitle: deal.title,
            resumeCount: dealResumes.length,
            adaptationCount: dealAdaptations.length,
            exportFormats
        });

        res.status(201).json(buildDealExportResponse(updatedJob, dealResumes, dealAdaptations));
    } catch (error) {
        respondCreateJobError(res, 'Failed to create deal export job', error, DEAL_EXPORT_CREATE_JOB_ERROR);
    }
}
