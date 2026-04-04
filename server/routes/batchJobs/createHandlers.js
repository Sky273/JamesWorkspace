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
    ensureFirmId,
    ensureMissionAccess,
    ensureOwnerAccess,
    ensureResumeIdsAccess,
    getUserContext,
    mapCreatedImportJobResponse,
    normalizeBatchJobPayload,
    resolveFirmId,
    stageImportJobItems,
    validateImportRequest
} from './helpers.js';

const BATCH_IMPORT_ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_BATCH_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024;


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
        safeLog('error', 'Failed to create batch job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
    }
}

async function createResumeIdsJob(req, res, { jobType, optionsBuilder, logLabel }) {
    try {
        const userContext = getUserContext(req);
        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { resumeIds, options: jobOptions = {} } = normalizedPayload;

        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs requis' });
        }

        const firmId = resolveFirmId(userContext, normalizedPayload);
        if (!ensureFirmId(firmId, res)) {
            return;
        }

        if (!await ensureResumeIdsAccess(resumeIds, firmId, userContext, res)) {
            return;
        }

        if (normalizedPayload.missionId) {
            const missionRecord = await ensureMissionAccess(normalizedPayload.missionId, firmId, userContext, res);
            if (!missionRecord) {
                return;
            }
        }

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
        safeLog('error', `Failed to create ${jobType} job`, { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
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
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    if (!normalizedPayload.missionId) {
        return res.status(400).json({ error: 'Mission ID requis' });
    }

    return createResumeIdsJob(req, res, {
        jobType: 'adapt',
        logLabel: 'Batch adaptation job',
        optionsBuilder: ({ normalizedPayload, jobOptions }) => ({ ...jobOptions, missionId: normalizedPayload.missionId, adapt: true })
    });
}

export function createMatchJob(req, res) {
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    if (!normalizedPayload.missionId) {
        return res.status(400).json({ error: 'Mission ID requis' });
    }

    return createResumeIdsJob(req, res, {
        jobType: 'match',
        logLabel: 'Batch match job',
        optionsBuilder: ({ normalizedPayload, jobOptions }) => ({ ...jobOptions, missionId: normalizedPayload.missionId, match: true })
    });
}

export async function createProfileSearchJob(req, res) {
    try {
        const userContext = getUserContext(req);
        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const missionId = normalizedPayload.missionId;
        const firmId = resolveFirmId(userContext, normalizedPayload);

        if (!ensureFirmId(firmId, res)) {
            return;
        }

        const accessibleMission = await ensureMissionAccess(missionId, firmId, userContext, res);
        if (!accessibleMission) {
            return;
        }

        const { job, responsePayload: updatedJob } = await createJobAndFetchResponse({
            createJobFn: createJob,
            getJobFn: getJob,
            createParams: {
                firmId,
                userId: userContext.userId,
                jobType: 'profile-search',
                options: {
                    missionId,
                    limit: normalizedPayload.limit ?? 0,
                    minScore: normalizedPayload.minScore ?? 0,
                    status: normalizedPayload.status ?? null,
                    weights: normalizedPayload.weights,
                    dealId: normalizedPayload.dealId || null,
                    searchFirmId: userContext.isAdmin && !normalizedPayload.firm_id ? null : firmId
                }
            },
            stageItems: (createdJob) => addJobTaskItems(createdJob.id, [{
                fileName: accessibleMission.title || `Mission ${missionId}`,
                sourceType: 'profile-search'
            }])
        });
        safeLog('info', 'Profile search job created via API', {
            jobId: job.id,
            missionId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile search job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
    }
}

export async function createProfileAnalysisJob(req, res) {
    try {
        const userContext = getUserContext(req);
        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const resumeId = normalizedPayload.resumeId || normalizedPayload.resume_id;
        const missionId = normalizedPayload.missionId;
        const firmId = resolveFirmId(userContext, normalizedPayload);

        if (!ensureFirmId(firmId, res)) {
            return;
        }

        if (!await ensureResumeIdsAccess([resumeId], firmId, userContext, res)) {
            return;
        }

        const accessibleMission = await ensureMissionAccess(missionId, firmId, userContext, res);
        if (!accessibleMission) {
            return;
        }

        const { job, responsePayload: updatedJob } = await createJobAndFetchResponse({
            createJobFn: createJob,
            getJobFn: getJob,
            createParams: {
                firmId,
                userId: userContext.userId,
                jobType: 'profile-analysis',
                options: { missionId }
            },
            stageItems: (createdJob) => addJobTaskItems(createdJob.id, [{
                resumeId,
                fileName: `Profile Analysis ${resumeId}`,
                sourceType: 'profile-analysis'
            }])
        });
        safeLog('info', 'Profile analysis job created via API', {
            jobId: job.id,
            missionId,
            resumeId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile analysis job', { error: error.message });
        res.status(500).json({ error: 'Erreur lors de la création du job' });
    }
}

export async function createDealExportJob(req, res) {
    try {
        const userContext = getUserContext(req);
        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const { dealId, templateId, exportFormats = ['pdf'] } = normalizedPayload;

        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID requis' });
        }
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID requis' });
        }

        const deal = await getDealForExport(dealId);
        if (!deal) {
            return res.status(404).json({ error: 'Affaire non trouvée' });
        }
        if (!ensureOwnerAccess(deal.firm_id, userContext, res)) {
            return;
        }

        const dealResumes = await getResumesForDeal(dealId);
        const dealAdaptations = await getAdaptationsForDeal(dealId);
        const totalItems = dealResumes.length + dealAdaptations.length;
        if (totalItems === 0) {
            return res.status(400).json({ error: 'Aucun CV ni adaptation à exporter pour cette affaire' });
        }

        const exportItems = [];
        for (const resume of dealResumes) {
            exportItems.push({
                resumeId: resume.id,
                adaptationId: null,
                sourceType: 'resume',
                fileName: resume.name || 'CV',
                relativePath: resume.relative_path || null,
                originalName: resume.source_file_name || null
            });
        }
        for (const adaptation of dealAdaptations) {
            exportItems.push({
                resumeId: adaptation.resume_id,
                adaptationId: adaptation.id,
                sourceType: 'adaptation',
                fileName: `${adaptation.candidate_name || 'Candidat'} - ${adaptation.mission_name || 'Mission'}`,
                originalName: adaptation.source_file_name || null,
                relativePath: adaptation.relative_path || null
            });
        }

        const { job, updatedJob } = await createJobAndFetchResponse({
            createJobFn: createJob,
            getJobFn: getJob,
            createParams: {
                firmId: deal.firm_id,
                userId: userContext.userId,
                jobType: 'deal-export',
                options: {
                    dealId,
                    dealTitle: deal.title,
                    templateId,
                    exportFormats: Array.isArray(exportFormats) ? exportFormats : [exportFormats],
                    export: true
                }
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

        res.status(201).json({
            ...updatedJob,
            resumeCount: dealResumes.length,
            adaptationCount: dealAdaptations.length
        });
    } catch (error) {
        safeLog('error', 'Failed to create deal export job', { error: error.message });
        res.status(500).json({ error: "Erreur lors de la création du job d'export" });
    }
}
