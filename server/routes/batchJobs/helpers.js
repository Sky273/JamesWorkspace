import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { inferMimeTypeFromFilename } from '../../utils/uploadFileTypes.js';
import { UPLOAD_DIR } from '../../config/constants.js';

const ALLOWED_MIME_BY_EXTENSION = new Map([
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
]);

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
