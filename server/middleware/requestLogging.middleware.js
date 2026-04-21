import { safeLog } from '../utils/logger.backend.js';

function summarizeBadRequestBody(body) {
    if (body === null) {
        return { type: 'null' };
    }

    if (body === undefined) {
        return { type: 'undefined' };
    }

    if (Array.isArray(body)) {
        return { type: 'array', length: body.length };
    }

    if (typeof body === 'string') {
        return { type: 'string', length: body.length };
    }

    if (typeof body === 'object') {
        const keys = Object.keys(body);
        const summary = {
            type: 'object',
            keys: keys.slice(0, 10),
            keyCount: keys.length
        };

        if (typeof body.error === 'string') {
            summary.errorType = 'string';
        } else if (body.error && typeof body.error === 'object') {
            summary.errorType = 'object';
            summary.errorKeys = Object.keys(body.error).slice(0, 5);
        }

        if (Array.isArray(body.details)) {
            summary.detailCount = body.details.length;
        }

        return summary;
    }

    return { type: typeof body };
}

function buildBadRequestDiagnostic(req, body) {
    return {
        path: req.path,
        method: req.method,
        contentType: req.headers['content-type'],
        origin: req.headers.origin || 'no-origin',
        responseSummary: summarizeBadRequestBody(body)
    };
}

export function requestLoggingMiddleware(req, res, next) {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let badRequestDiagnosticLogged = false;

    const logBadRequestDiagnostic = (body) => {
        if (badRequestDiagnosticLogged || res.statusCode !== 400) {
            return;
        }

        const shouldQuietExpectedE2EAuthValidation =
            process.env.E2E_QUIET_EXPECTED_WARNINGS === 'true'
            && ['/signin', '/register', '/refresh', '/forgot-password', '/reset-password'].includes(req.path);
        if (shouldQuietExpectedE2EAuthValidation) {
            return;
        }

        badRequestDiagnosticLogged = true;
        safeLog('warn', '400 Bad Request diagnostic', {
            requestId: req.requestId,
            ...buildBadRequestDiagnostic(req, body)
        });
    };

    res.json = function(body) {
        logBadRequestDiagnostic(body);
        return originalJson(body);
    };

    res.send = function(body) {
        const responseType = res.getHeader('Content-Type');
        const looksJson = typeof body === 'object'
            || (typeof body === 'string' && String(responseType || '').toLowerCase().includes('application/json'));
        if (looksJson) {
            logBadRequestDiagnostic(body);
        }
        return originalSend(body);
    };

    const finishHandler = () => {
        const duration = Date.now() - start;
        safeLog('info', 'HTTP request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration
        });
        res.removeListener('finish', finishHandler);
    };

    res.on('finish', finishHandler);
    next();
}
