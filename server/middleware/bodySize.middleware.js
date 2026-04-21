import { safeLog } from '../utils/logger.backend.js';

const METHODS_WITH_BODIES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getDeclaredContentLength(req) {
    const rawHeader = req.headers['content-length'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const parsedContentLength = Number.parseInt(headerValue || '', 10);
    return Number.isFinite(parsedContentLength) && parsedContentLength >= 0 ? parsedContentLength : null;
}

function getBodyLimitBytes(contentType, { jsonBodyLimitBytes, urlencodedBodyLimitBytes }) {
    return contentType.includes('application/x-www-form-urlencoded')
        ? urlencodedBodyLimitBytes
        : jsonBodyLimitBytes;
}

export function createBodySizeGuardMiddleware({
    jsonBodyLimitBytes,
    urlencodedBodyLimitBytes
}) {
    return (req, res, next) => {
        if (!METHODS_WITH_BODIES.has(req.method)) {
            return next();
        }

        const contentType = (req.headers['content-type'] || '').toLowerCase();
        const parsesJsonOrFormBody = contentType.includes('json')
            || contentType.includes('application/x-www-form-urlencoded');
        if (!parsesJsonOrFormBody) {
            return next();
        }

        const contentLength = getDeclaredContentLength(req);
        if (contentLength === null) {
            return next();
        }

        const bodyLimitBytes = getBodyLimitBytes(contentType, {
            jsonBodyLimitBytes,
            urlencodedBodyLimitBytes
        });
        if (contentLength > bodyLimitBytes) {
            safeLog('warn', 'Request body rejected before parsing', {
                requestId: req.requestId,
                path: req.path,
                method: req.method,
                contentLength,
                bodyLimitBytes
            });
            return res.status(413).json({ error: 'Request body too large' });
        }

        next();
    };
}
