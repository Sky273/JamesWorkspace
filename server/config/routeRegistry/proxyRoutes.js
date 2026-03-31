import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { safeLog } from '../../utils/logger.backend.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';
import { userRateLimit } from '../../middleware/rateLimit.middleware.js';
import { validateBody, generatePdfProxySchema, generateDocxProxySchema } from '../../utils/validation.js';
import { getPdfServerAuthHeaders } from '../../utils/pdfServerAuth.js';

async function relayBinaryResponse(response, res, fallbackContentType) {
    const contentType = response.headers.get('Content-Type') || fallbackContentType;
    const contentDisposition = response.headers.get('Content-Disposition');
    const contentLength = response.headers.get('Content-Length');

    res.setHeader('Content-Type', contentType);
    if (contentDisposition) {
        res.setHeader('Content-Disposition', contentDisposition);
    }
    if (contentLength) {
        res.setHeader('Content-Length', contentLength);
    }

    if (response.body) {
        await pipeline(Readable.fromWeb(response.body), res);
        return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Length', buffer.length.toString());
    res.end(buffer);
}

export function registerProxyRoutes(app) {
    const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://localhost:3002';
    const proxyGuards = [
        authenticateToken,
        userRateLimit(20, 15 * 60 * 1000)
    ];

    app.post('/generate-pdf', ...proxyGuards, validateBody(generatePdfProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying PDF generation request to PDF server');

            const response = await fetch(`${PDF_SERVER_URL}/generate-pdf`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'PDF server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json({ error: errorText });
            }
            await relayBinaryResponse(response, res, 'application/pdf');
        } catch (error) {
            safeLog('error', 'PDF proxy error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
            }
        }
    });

    app.post('/generate-docx', ...proxyGuards, validateBody(generateDocxProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying DOCX generation request to PDF server');

            const response = await fetch(`${PDF_SERVER_URL}/generate-docx`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            });

            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'DOCX server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json({ error: errorText });
            }
            await relayBinaryResponse(
                response,
                res,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        } catch (error) {
            safeLog('error', 'DOCX proxy error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate DOCX', details: error.message });
            }
        }
    });
}
