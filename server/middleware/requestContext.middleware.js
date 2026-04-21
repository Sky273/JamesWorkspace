import crypto from 'crypto';

const REQUEST_ID_HEADER = 'x-request-id';

function normalizeRequestId(rawValue) {
    if (typeof rawValue !== 'string') {
        return '';
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
        return '';
    }

    return trimmed.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
}

export function requestContextMiddleware(req, res, next) {
    const rawRequestId = Array.isArray(req.headers[REQUEST_ID_HEADER])
        ? req.headers[REQUEST_ID_HEADER][0]
        : req.headers[REQUEST_ID_HEADER];
    const requestId = normalizeRequestId(rawRequestId) || crypto.randomUUID();

    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
}
