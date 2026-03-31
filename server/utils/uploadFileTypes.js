import path from 'path';

const MIME_BY_EXTENSION = new Map([
    ['.pdf', 'application/pdf'],
    ['.doc', 'application/msword'],
    ['.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.gif', 'image/gif'],
    ['.webp', 'image/webp'],
    ['.svg', 'image/svg+xml']
]);

function normalizeExtension(filename) {
    return path.extname(filename || '').toLowerCase();
}

export function inferMimeTypeFromFilename(filename) {
    return MIME_BY_EXTENSION.get(normalizeExtension(filename)) || null;
}

export function resolveUploadMimeType(filename, mimetype, allowedMimeTypes, fallbackMimeType = 'application/octet-stream') {
    const normalizedMimeType = typeof mimetype === 'string' ? mimetype.toLowerCase() : '';
    const inferredMimeType = inferMimeTypeFromFilename(filename);

    if (inferredMimeType && allowedMimeTypes.has(inferredMimeType)) {
        if (!normalizedMimeType || normalizedMimeType === inferredMimeType || normalizedMimeType === 'application/octet-stream') {
            return inferredMimeType;
        }
    }

    if (normalizedMimeType && allowedMimeTypes.has(normalizedMimeType)) {
        return normalizedMimeType;
    }

    return fallbackMimeType;
}
