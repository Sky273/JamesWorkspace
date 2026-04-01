import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { safeLog } from '../../utils/logger.backend.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateBody, generatePdfProxySchema, generateDocxProxySchema } from '../../utils/validation.js';
import { getPdfServerAuthHeaders } from '../../utils/pdfServerAuth.js';
import { applySafeBinaryHeaders } from '../../utils/fileResponseSecurity.js';

const DEFAULT_PDF_PROXY_TIMEOUT_MS = 60_000;

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

    applySafeBinaryHeaders(res, {
        contentType,
        contentDisposition,
        contentLength
    });

    if (response.body) {
        await pipeline(Readable.fromWeb(response.body), res);
        return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
}

function getProxyTimeoutMs() {
    const parsed = Number.parseInt(process.env.PDF_PROXY_TIMEOUT_MS || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_PDF_PROXY_TIMEOUT_MS;
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

export function registerProxyRoutes(app) {
    const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://localhost:3002';
    const proxyTimeoutMs = getProxyTimeoutMs();
    const proxyGuards = [
        authenticateToken,
        userRateLimit(20, 15 * 60 * 1000)
    ];

    app.post('/generate-pdf', ...proxyGuards, validateBody(generatePdfProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying PDF generation request to PDF server');

            const response = await fetchWithTimeout(`${PDF_SERVER_URL}/generate-pdf`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            }, proxyTimeoutMs);

            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'PDF server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json(buildProxyFailureBody('PDF', response.status));
            }
            await relayBinaryResponse(response, res, 'application/pdf');
        } catch (error) {
            const statusCode = isAbortError(error) ? 504 : 500;
            safeLog(statusCode === 504 ? 'warn' : 'error', 'PDF proxy error', { error: error.message, timeoutMs: proxyTimeoutMs });
            if (!res.headersSent) {
                res.status(statusCode).json(buildProxyFailureBody('PDF', statusCode));
            }
        }
    });

    app.post('/generate-docx', ...proxyGuards, validateBody(generateDocxProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying DOCX generation request to PDF server');

            const response = await fetchWithTimeout(`${PDF_SERVER_URL}/generate-docx`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            }, proxyTimeoutMs);

            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'DOCX server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json(buildProxyFailureBody('DOCX', response.status));
            }
            await relayBinaryResponse(
                response,
                res,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        } catch (error) {
            const statusCode = isAbortError(error) ? 504 : 500;
            safeLog(statusCode === 504 ? 'warn' : 'error', 'DOCX proxy error', { error: error.message, timeoutMs: proxyTimeoutMs });
            if (!res.headersSent) {
                res.status(statusCode).json(buildProxyFailureBody('DOCX', statusCode));
            }
        }
    });
}
