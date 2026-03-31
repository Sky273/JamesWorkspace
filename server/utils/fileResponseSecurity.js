import { sanitizeDocumentFilename } from './sanitizer.backend.js';

const SAFE_INLINE_CONTENT_TYPES = new Set(['application/pdf']);

function normalizeContentType(contentType) {
    return typeof contentType === 'string' && contentType.trim()
        ? contentType
        : 'application/octet-stream';
}

function normalizeContentLength(contentLength) {
    if (contentLength === undefined || contentLength === null || contentLength === '') {
        return null;
    }

    return String(contentLength);
}

export function sanitizeDownloadFilename(filename, contentType = 'application/octet-stream') {
    if (contentType === 'application/pdf') {
        return sanitizeDocumentFilename(filename, 'pdf');
    }

    if (contentType === 'application/zip') {
        return sanitizeDocumentFilename(filename, 'zip');
    }

    if (contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return sanitizeDocumentFilename(filename, 'docx');
    }

    if (contentType === 'application/msword') {
        return sanitizeDocumentFilename(filename, 'doc');
    }

    return sanitizeDocumentFilename(filename, '');
}

export function setSafeFileResponseHeaders(res, {
    contentType,
    filename,
    contentLength,
    inline = false,
    cacheControl = 'private, no-store, max-age=0'
}) {
    const normalizedContentType = normalizeContentType(contentType);
    const safeFilename = sanitizeDownloadFilename(filename, normalizedContentType);
    const normalizedContentLength = normalizeContentLength(contentLength);
    const shouldInline = inline && SAFE_INLINE_CONTENT_TYPES.has(normalizedContentType);
    const dispositionType = shouldInline ? 'inline' : 'attachment';

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', cacheControl);
    res.setHeader('Content-Type', normalizedContentType);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFilename}"`);
    if (normalizedContentLength !== null) {
        res.setHeader('Content-Length', normalizedContentLength);
    }
}

export function applySafeBinaryHeaders(res, {
    contentType,
    contentDisposition,
    contentLength,
    cacheControl = 'private, no-store, max-age=0'
}) {
    if (contentType) {
        res.setHeader('Content-Type', normalizeContentType(contentType));
    }
    if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
    }
    if (contentLength !== undefined && contentLength !== null && contentLength !== '') {
        res.setHeader('Content-Length', String(contentLength));
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', cacheControl);
}
