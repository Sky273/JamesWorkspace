import fs from 'fs/promises';
import * as missionsService from '../../services/missions.service.js';
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
import { getRequiredSignatureBytes, isValidFileSignature } from '../../utils/fileSignature.js';
import {
    ensureFirmId,
    ensureOwnerAccess,
    getUserContext,
    normalizeBatchJobPayload,
    parseArrayInput,
    parseBoolean,
    resolveFirmId
} from './helpers.js';
import { resolveUploadMimeType } from '../../utils/uploadFileTypes.js';

const BATCH_IMPORT_ALLOWED_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]);
const MAX_BATCH_IMPORT_TOTAL_BYTES = 250 * 1024 * 1024;

async function cleanupUploadedFiles(files) {
    await Promise.all((Array.isArray(files) ? files : []).map(async (file) => {
        if (file?.path) {
            await fs.unlink(file.path).catch(() => {});
        }
    }));
}

async function readFileHeader(filePath, bytesToRead) {
    const handle = await fs.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

export async function createImportJob(req, res) {
    try {
        const userContext = getUserContext(req);
        const normalizedPayload = normalizeBatchJobPayload(req.body);
        const firmId = resolveFirmId(userContext, normalizedPayload);

        if (!ensureFirmId(firmId, res)) {
            return;
        }

        const exportFormats = normalizedPayload.exportFormats
            ? parseArrayInput(normalizedPayload.exportFormats, ['pdf'])
            : normalizedPayload.exportFormat
                ? [normalizedPayload.exportFormat]
                : ['pdf'];

        const options = {
            improve: parseBoolean(req.body.improve),
            export: parseBoolean(req.body.export),
            exportFormats,
            templateId: normalizedPayload.templateId || null,
            deleteAfterExport: parseBoolean(normalizedPayload.deleteAfterExport),
            profileType: normalizedPayload.profileType || undefined,
            candidateName: normalizedPayload.candidateName || undefined,
            candidateEmail: normalizedPayload.candidateEmail || undefined
        };

        const relativePaths = parseArrayInput(normalizedPayload.relativePaths, []);
        const totalUploadBytes = (req.files || []).reduce((sum, file) => sum + (file?.size || 0), 0);
        if (totalUploadBytes > MAX_BATCH_IMPORT_TOTAL_BYTES) {
            await cleanupUploadedFiles(req.files);
            return res.status(413).json({
                error: `Batch import payload too large. Maximum total upload size is ${Math.round(MAX_BATCH_IMPORT_TOTAL_BYTES / (1024 * 1024))}MB.`
            });
        }

        const uploadedFiles = [];
        for (const [index, file] of (req.files || []).entries()) {
            const resolvedMimeType = resolveUploadMimeType(file.originalname, file.mimetype, BATCH_IMPORT_ALLOWED_MIME_TYPES);
            const signatureBytes = getRequiredSignatureBytes(resolvedMimeType);
            const fileSignatureBuffer = file.buffer || await readFileHeader(file.path, signatureBytes || 12);
            if (!isValidFileSignature(fileSignatureBuffer, resolvedMimeType)) {
                await cleanupUploadedFiles(req.files);
                return res.status(400).json({ error: `Invalid file contents for ${file.originalname}` });
            }
            uploadedFiles.push({
                ...file,
                fileMimeType: resolvedMimeType,
                relativePath: relativePaths[index] || null
            });
        }

        const job = await createJob({
            firmId,
            userId: userContext.userId,
            jobType: 'import',
            options
        });

        const responsePayload = {
            id: job.id,
            status: job.status,
            firm_id: job.firm_id,
            user_id: job.user_id,
            job_type: job.job_type,
            total_items: req.files?.length || 0,
            processed_items: job.processed_items || 0,
            success_count: job.success_count || 0,
            error_count: job.error_count || 0,
            options: job.options,
            created_at: job.created_at
        };

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

        void (async () => {
            try {
                if (uploadedFiles.length === 0) {
                    safeLog('warn', 'No files received for batch job', { jobId: job.id });
                    return;
                }

                safeLog('info', 'Adding items to job', {
                    jobId: job.id,
                    itemCount: uploadedFiles.length,
                    hasRelativePaths: relativePaths.length > 0,
                    totalFileBytes: uploadedFiles.reduce((sum, item) => sum + (item.size || 0), 0)
                });

                const addedCount = await addJobItemsFromUploadedFiles(job.id, uploadedFiles);
                safeLog('info', 'Items added to job', { jobId: job.id, addedCount });
            } catch (stagingError) {
                await cleanupUploadedFiles(uploadedFiles);
                safeLog('error', 'Failed to stage items for batch job after job creation', { jobId: job.id, error: stagingError.message });
                await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: stagingError.message });
            }
        })();
    } catch (error) {
        await cleanupUploadedFiles(req.files);
        safeLog('error', 'Failed to create batch job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
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

        const job = await createJob({
            firmId,
            userId: userContext.userId,
            jobType,
            options: optionsBuilder({ normalizedPayload, jobOptions })
        });

        await addJobResumeIds(job.id, resumeIds);
        const updatedJob = await getJob(job.id);

        safeLog('info', `${logLabel} created via API`, {
            jobId: job.id,
            resumeCount: resumeIds.length,
            missionId: normalizedPayload.missionId || null
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', `Failed to create ${jobType} job`, { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
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

        const missionRecord = await missionsService.findMission(missionId);
        if (!missionRecord) {
            return res.status(404).json({ error: 'Mission non trouvée' });
        }

        const missionFirmId = missionRecord.firm_id || missionRecord.firm;
        if (!ensureOwnerAccess(missionFirmId, userContext, res)) {
            return;
        }

        const job = await createJob({
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
        });

        await addJobTaskItems(job.id, [{
            fileName: missionRecord.title || `Mission ${missionId}`,
            sourceType: 'profile-search'
        }]);

        const updatedJob = await getJob(job.id);
        safeLog('info', 'Profile search job created via API', {
            jobId: job.id,
            missionId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile search job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
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

        const missionRecord = await missionsService.findMission(missionId);
        if (!missionRecord) {
            return res.status(404).json({ error: 'Mission non trouvée' });
        }

        const missionFirmId = missionRecord.firm_id || missionRecord.firm;
        if (!ensureOwnerAccess(missionFirmId, userContext, res)) {
            return;
        }

        const job = await createJob({
            firmId,
            userId: userContext.userId,
            jobType: 'profile-analysis',
            options: { missionId }
        });

        await addJobTaskItems(job.id, [{
            resumeId,
            fileName: `Profile Analysis ${resumeId}`,
            sourceType: 'profile-analysis'
        }]);

        const updatedJob = await getJob(job.id);
        safeLog('info', 'Profile analysis job created via API', {
            jobId: job.id,
            missionId,
            resumeId,
            requestedBy: userContext.userId
        });

        res.status(201).json(updatedJob);
    } catch (error) {
        safeLog('error', 'Failed to create profile analysis job', { error: error.message });
        res.status(500).json({ error: error.message || 'Erreur lors de la création du job' });
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

        const job = await createJob({
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
        });

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

        await addJobExportItems(job.id, exportItems);
        const updatedJob = await getJob(job.id);

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
        res.status(500).json({ error: error.message || "Erreur lors de la création du job d'export" });
    }
}
