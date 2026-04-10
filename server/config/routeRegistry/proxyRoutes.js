import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { randomUUID } from 'crypto';
import { safeLog } from '../../utils/logger.backend.js';
import { metrics } from '../../services/metrics.service.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateBody, generatePdfProxySchema, generateDocxProxySchema } from '../../utils/validation.js';
import { getPdfServerAuthHeaders } from '../../utils/pdfServerAuth.js';
import { applySafeBinaryHeaders } from '../../utils/fileResponseSecurity.js';
import { assertTrustedInternalServiceUrl } from '../../utils/networkHostSecurity.js';
import { getPdfProxyTimeoutMs } from '../../utils/pdfServiceTimeouts.js';

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

function buildProxyFailureBody(kind, statusCode) {
    const label = kind === 'DOCX' ? 'DOCX' : 'PDF';

    if (statusCode === 403) {
        return { error: `${label} generation is not authorized` };
    }

    if (statusCode === 408 || statusCode === 504) {
        return { error: `${label} generation timed out` };
    }

    return { error: `Failed to generate ${label}` };
}

async function relayBinaryResponse(response, res, fallbackContentType) {
    const contentType = response.headers.get('Content-Type') || fallbackContentType;
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentLength = response.headers.get('Content-Length');
    const debugId = response.headers.get('x-pdf-debug-id');

    applySafeBinaryHeaders(res, {
        contentType,
        contentDisposition,
        contentLength
    });
    if (debugId) {
        res.setHeader('x-pdf-debug-id', debugId);
    }

    if (response.body) {
        await pipeline(Readable.fromWeb(response.body), res);
        return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
}

async function fetchWithTimeout(url, options, timeoutMs) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error(`Upstream timeout after ${timeoutMs}ms`)), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

function isAbortError(error) {
    return error?.name === 'AbortError' || /timeout/i.test(error?.message || '');
}

function createProxyDebugContext(body) {
    return {
        filename: typeof body?.filename === 'string' ? body.filename : null,
        htmlLength: typeof body?.htmlContent === 'string' ? body.htmlContent.length : 0,
        stylesheetLength: typeof body?.stylesheet === 'string' ? body.stylesheet.length : 0,
        headerLength: typeof body?.headerContent === 'string' ? body.headerContent.length : 0,
        footerLength: typeof body?.footerContent === 'string' ? body.footerContent.length : 0,
        hasFooter: Boolean(body?.footerContent && String(body.footerContent).trim()),
        footerHeight: Number.isFinite(body?.footerHeight) ? body.footerHeight : null
    };
}

export function registerProxyRoutes(app) {
    const proxyTimeoutMs = getPdfProxyTimeoutMs();
    const proxyGuards = [
        authenticateToken,
        userRateLimit(20, 15 * 60 * 1000)
    ];

    async function validatePdfServerTarget(requestId, debugContext, routeLabel) {
        const pdfServerUrl = process.env.PDF_SERVER_URL || 'http://localhost:3002';
        try {
            await assertTrustedInternalServiceUrl(pdfServerUrl);
            return pdfServerUrl;
        } catch (error) {
            safeLog('error', `Rejected ${routeLabel} proxy target`, {
                url: pdfServerUrl,
                error: error.message,
                requestId,
                ...debugContext
            });
            return null;
        }
    }

    app.post('/generate-pdf', ...proxyGuards, validateBody(generatePdfProxySchema), async (req, res) => {
        const requestId = req.requestId
            || res.locals?.requestId
            || normalizeRequestId(Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id'])
            || randomUUID();
        res.setHeader('x-request-id', requestId);
        const debugContext = createProxyDebugContext(req.body);
        try {
            const pdfServerUrl = await validatePdfServerTarget(requestId, debugContext, 'PDF');
            if (!pdfServerUrl) {
                return res.status(503).json({ error: 'PDF generation service is unavailable', requestId });
            }

            safeLog('info', 'Proxying PDF generation request to PDF server', {
                requestId,
                ...debugContext
            });

            const response = await fetchWithTimeout(`${pdfServerUrl}/generate-pdf`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json',
                    'x-request-id': requestId
                }),
                body: JSON.stringify(req.body)
            }, proxyTimeoutMs);

            if (!response.ok) {
                const errorText = await response.text();
                const upstreamDebugId = response.headers.get('x-pdf-debug-id');
                metrics.trackBatchExportActivity({
                    event: 'run',
                    format: 'pdf',
                    source: 'direct',
                    failedRuns: 1,
                    failedFiles: 1,
                    metadata: {
                        requestId,
                        filename: req.body?.filename || null,
                        error: errorText
                    }
                });
                safeLog(response.status === 403 ? 'warn' : 'error', 'PDF server error', {
                    requestId,
                    status: response.status,
                    error: errorText,
                    upstreamDebugId,
                    ...debugContext,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                if (upstreamDebugId) {
                    res.setHeader('x-pdf-debug-id', upstreamDebugId);
                }
                return res.status(response.status).json({
                    ...buildProxyFailureBody('PDF', response.status),
                    requestId
                });
            }
            metrics.trackBatchExportActivity({
                event: 'run',
                format: 'pdf',
                source: 'direct',
                successfulRuns: 1,
                generatedFiles: 1,
                metadata: {
                    requestId,
                    filename: req.body?.filename || null
                }
            });
            await relayBinaryResponse(response, res, 'application/pdf');
        } catch (error) {
            const statusCode = error?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED'
                ? 503
                : (isAbortError(error) ? 504 : 500);
            metrics.trackBatchExportActivity({
                event: 'run',
                format: 'pdf',
                source: 'direct',
                failedRuns: 1,
                failedFiles: 1,
                metadata: {
                    requestId,
                    filename: req.body?.filename || null,
                    error: error.message
                }
            });
            safeLog(statusCode === 504 ? 'warn' : 'error', 'PDF proxy error', {
                requestId,
                error: error.message,
                timeoutMs: proxyTimeoutMs,
                ...debugContext
            });
            if (!res.headersSent) {
                res.status(statusCode).json({
                    ...buildProxyFailureBody('PDF', statusCode),
                    requestId
                });
            }
        }
    });

    app.post('/generate-docx', ...proxyGuards, validateBody(generateDocxProxySchema), async (req, res) => {
        const requestId = req.requestId
            || res.locals?.requestId
            || normalizeRequestId(Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id'])
            || randomUUID();
        res.setHeader('x-request-id', requestId);
        const debugContext = createProxyDebugContext(req.body);
        try {
            const pdfServerUrl = await validatePdfServerTarget(requestId, debugContext, 'DOCX');
            if (!pdfServerUrl) {
                return res.status(503).json({ error: 'DOCX generation service is unavailable', requestId });
            }

            safeLog('info', 'Proxying DOCX generation request to PDF server', {
                requestId,
                ...debugContext
            });

            const response = await fetchWithTimeout(`${pdfServerUrl}/generate-docx`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json',
                    'x-request-id': requestId
                }),
                body: JSON.stringify(req.body)
            }, proxyTimeoutMs);

            if (!response.ok) {
                const errorText = await response.text();
                const upstreamDebugId = response.headers.get('x-pdf-debug-id');
                metrics.trackBatchExportActivity({
                    event: 'run',
                    format: typeof req.body?.format === 'string' ? req.body.format : 'docx',
                    source: 'direct',
                    failedRuns: 1,
                    failedFiles: 1,
                    metadata: {
                        requestId,
                        filename: req.body?.filename || null,
                        error: errorText
                    }
                });
                safeLog(response.status === 403 ? 'warn' : 'error', 'DOCX server error', {
                    requestId,
                    status: response.status,
                    error: errorText,
                    upstreamDebugId,
                    ...debugContext,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                if (upstreamDebugId) {
                    res.setHeader('x-pdf-debug-id', upstreamDebugId);
                }
                return res.status(response.status).json({
                    ...buildProxyFailureBody('DOCX', response.status),
                    requestId
                });
            }
            metrics.trackBatchExportActivity({
                event: 'run',
                format: typeof req.body?.format === 'string' ? req.body.format : 'docx',
                source: 'direct',
                successfulRuns: 1,
                generatedFiles: 1,
                metadata: {
                    requestId,
                    filename: req.body?.filename || null
                }
            });
            await relayBinaryResponse(
                response,
                res,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        } catch (error) {
            const statusCode = error?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED'
                ? 503
                : (isAbortError(error) ? 504 : 500);
            metrics.trackBatchExportActivity({
                event: 'run',
                format: typeof req.body?.format === 'string' ? req.body.format : 'docx',
                source: 'direct',
                failedRuns: 1,
                failedFiles: 1,
                metadata: {
                    requestId,
                    filename: req.body?.filename || null,
                    error: error.message
                }
            });
            safeLog(statusCode === 504 ? 'warn' : 'error', 'DOCX proxy error', {
                requestId,
                error: error.message,
                timeoutMs: proxyTimeoutMs,
                ...debugContext
            });
            if (!res.headersSent) {
                res.status(statusCode).json({
                    ...buildProxyFailureBody('DOCX', statusCode),
                    requestId
                });
            }
        }
    });
}
