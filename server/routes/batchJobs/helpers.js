import fs from 'fs';
import fsPromises from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { inferMimeTypeFromFilename, resolveUploadMimeType } from '../../utils/uploadFileTypes.js';
import { UPLOAD_DIR } from '../../config/constants.js';
import * as missionsService from '../../services/missions.service.js';
import { getResumeForAccessCheck } from '../../services/resumes.service.js';
import { getRequiredSignatureBytes, isValidDocxArchive, isValidFileSignature } from '../../utils/fileSignature.js';
import { safeLog } from '../../utils/logger.backend.js';

const ALLOWED_MIME_BY_EXTENSION = new Map([
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);
const DEFAULT_SIGNATURE_BYTES = 12;

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

export async function cleanupUploadedFiles(files) {
    await Promise.all((Array.isArray(files) ? files : []).map(async (file) => {
        if (file?.path) {
            await fsPromises.unlink(file.path).catch(() => {});
        }
    }));
}

async function readFileHeader(filePath, bytesToRead) {
    const handle = await fsPromises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(bytesToRead);
        const { bytesRead } = await handle.read(buffer, 0, bytesToRead, 0);
        return buffer.subarray(0, bytesRead);
    } finally {
        await handle.close();
    }
}

export async function hasValidUploadedFileContents(filePath, mimeType) {
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const fileBuffer = await fsPromises.readFile(filePath);
        return isValidDocxArchive(fileBuffer);
    }

    const signatureBytes = getRequiredSignatureBytes(mimeType);
    const fileSignatureBuffer = await readFileHeader(filePath, signatureBytes || DEFAULT_SIGNATURE_BYTES);
    return isValidFileSignature(fileSignatureBuffer, mimeType);
}

export async function normalizeAndValidateUploadedFiles(files, relativePaths, allowedMimeTypes) {
    const uploadedFiles = [];

    for (const [index, file] of (files || []).entries()) {
        const resolvedMimeType = resolveUploadMimeType(file.originalname, file.mimetype, allowedMimeTypes);
        const hasValidContents = file.buffer
            ? (
                resolvedMimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    ? await isValidDocxArchive(file.buffer)
                    : isValidFileSignature(file.buffer, resolvedMimeType)
            )
            : await hasValidUploadedFileContents(file.path, resolvedMimeType);

        if (!hasValidContents) {
            await cleanupUploadedFiles(files);
            return {
                ok: false,
                status: 400,
                error: `Invalid file contents for ${file.originalname}`
            };
        }

        uploadedFiles.push({
            ...file,
            fileMimeType: resolvedMimeType,
            relativePath: relativePaths[index] || null
        });
    }

    return { ok: true, uploadedFiles };
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

export function createUploadMiddleware() {
    const batchUploadDir = path.join(UPLOAD_DIR, 'batch-jobs');

    return multer({
        storage: multer.diskStorage({
            destination: (_req, _file, cb) => {
                fs.mkdirSync(batchUploadDir, { recursive: true });
                cb(null, batchUploadDir);
            },
            filename: (_req, file, cb) => {
                const timestamp = Date.now();
                const randomSuffix = Math.random().toString(36).slice(2, 10);
                const extension = path.extname(file.originalname || '').toLowerCase();
                cb(null, `${timestamp}-${randomSuffix}${extension}`);
            }
        }),
        limits: {
            fileSize: 50 * 1024 * 1024,
            files: 200
        },
        fileFilter: (_req, file, cb) => {
            const extension = path.extname(file.originalname || '').toLowerCase();
            const expectedMimeType = ALLOWED_MIME_BY_EXTENSION.get(extension);
            const normalizedMimeType = (file.mimetype || '').toLowerCase();
            const inferredMimeType = inferMimeTypeFromFilename(file.originalname || '');
            const mimeMatches = Boolean(expectedMimeType)
                && inferredMimeType === expectedMimeType
                && normalizedMimeType === expectedMimeType;

            if (mimeMatches) {
                cb(null, true);
            } else {
                cb(new Error(`Type de fichier non supporte : ${file.mimetype || extension || 'inconnu'}`));
            }
        }
    });
}

export async function validateImportRequest({
    req,
    res,
    allowedMimeTypes,
    maxTotalBytes
}) {
    const userContext = getUserContext(req);
    const normalizedPayload = normalizeBatchJobPayload(req.body);
    const firmId = resolveFirmId(userContext, normalizedPayload);

    if (!ensureFirmId(firmId, res)) {
        return { ok: false };
    }

    const options = buildImportJobOptions(normalizedPayload, req.body);
    const relativePaths = parseArrayInput(normalizedPayload.relativePaths, []);
    const uploadedRequestFiles = req.files || [];
    const totalUploadBytes = uploadedRequestFiles.reduce((sum, file) => sum + (file?.size || 0), 0);

    if (totalUploadBytes > maxTotalBytes) {
        await cleanupUploadedFiles(uploadedRequestFiles);
        res.status(413).json({
            error: `Batch import payload too large. Maximum total upload size is ${Math.round(maxTotalBytes / (1024 * 1024))}MB.`
        });
        return { ok: false };
    }

    const normalizedUploads = await normalizeAndValidateUploadedFiles(
        uploadedRequestFiles,
        relativePaths,
        allowedMimeTypes
    );
    if (!normalizedUploads.ok) {
        res.status(normalizedUploads.status).json({ error: normalizedUploads.error });
        return { ok: false };
    }

    return {
        ok: true,
        userContext,
        normalizedPayload,
        firmId,
        options,
        relativePaths,
        totalUploadBytes,
        uploadedFiles: normalizedUploads.uploadedFiles
    };
}

export async function stageImportJobItems({
    jobId,
    uploadedFiles,
    relativePaths,
    addJobItemsFromUploadedFiles,
    markJobFailed
}) {
    try {
        if (uploadedFiles.length === 0) {
            safeLog('warn', 'No files received for batch job', { jobId });
            return;
        }

        safeLog('info', 'Adding items to job', {
            jobId,
            itemCount: uploadedFiles.length,
            hasRelativePaths: relativePaths.length > 0,
            totalFileBytes: uploadedFiles.reduce((sum, item) => sum + (item.size || 0), 0)
        });

        const addedCount = await addJobItemsFromUploadedFiles(jobId, uploadedFiles);
        safeLog('info', 'Items added to job', { jobId, addedCount });
    } catch (stagingError) {
        await cleanupUploadedFiles(uploadedFiles);
        safeLog('error', 'Failed to stage items for batch job after job creation', {
            jobId,
            error: stagingError.message
        });
        await markJobFailed(stagingError);
    }
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
