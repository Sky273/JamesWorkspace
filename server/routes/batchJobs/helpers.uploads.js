import fs from 'fs';
import fsPromises from 'fs/promises';
import multer from 'multer';
import path from 'path';
import { inferMimeTypeFromFilename, resolveUploadMimeType } from '../../utils/uploadFileTypes.js';
import { UPLOAD_DIR } from '../../config/constants.js';
import { getRequiredSignatureBytes, isValidDocxArchive, isValidFileSignature } from '../../utils/fileSignature.js';
import { safeLog } from '../../utils/logger.backend.js';
import {
    buildImportJobOptions,
    ensureFirmId,
    getUserContext,
    normalizeBatchJobPayload,
    parseArrayInput,
    resolveFirmId
} from './helpers.payloadAccess.js';

const ALLOWED_MIME_BY_EXTENSION = new Map([
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);
const DEFAULT_SIGNATURE_BYTES = 12;

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
