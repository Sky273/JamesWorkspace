/**
 * Share Routes
 * Public endpoints for sharing resumes via QR code
 */

import { Router, json } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { pipeline } from 'stream/promises';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, sharePdfSchema } from '../utils/validation.js';
import * as shareResumeService from '../services/shareResume.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getPdfServerAuthHeaders } from '../utils/pdfServerAuth.js';
import { getResumeForAccessCheck } from '../services/resumes.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import { setSafeFileResponseHeaders } from '../utils/fileResponseSecurity.js';
import { assertTrustedInternalServiceUrl } from '../utils/networkHostSecurity.js';
import { getSharePdfTimeoutMs } from '../utils/pdfServiceTimeouts.js';

const router = Router();
const PDF_SERVER_TIMEOUT_MS = getSharePdfTimeoutMs();

// JSON parsing for this router
router.use(json());

function createShareRouteHandler(logMessage, errorMessage, handler, errorResponder = null) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message, resumeId: req.params.resumeId ?? null });
            if (errorResponder) {
                const handled = errorResponder(error, res);
                if (handled) {
                    return handled;
                }
            }
            res.status(500).json({ success: false, error: errorMessage });
        }
    };
}

function isValidShareToken(token) {
    return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

async function getAccessibleResume(req, res) {
    const { resumeId } = req.params;
    const resume = await getResumeForAccessCheck(resumeId);

    if (!resume) {
        res.status(404).json({
            success: false,
            error: 'Resume not found'
        });
        return null;
    }

    if (isUserAdmin(req)) {
        return resume;
    }

    const userFirmId = await getUserFirmId(req);
    if (!userFirmId || !resume.firm_id || resume.firm_id !== userFirmId) {
        res.status(403).json({
            success: false,
            error: 'Access denied'
        });
        return null;
    }

    return resume;
}

function buildShareStatusResponse(status) {
    return {
        success: true,
        hasSharedPdf: status.hasSharedPdf,
        token: status.token,
        expiresAt: status.expiresAt,
        pdfToken: status.pdfToken,
        pdfExpiresAt: status.pdfExpiresAt,
        hasSharedFile: status.hasSharedFile,
        fileToken: status.fileToken,
        fileExpiresAt: status.fileExpiresAt
    };
}

function createAbortablePdfRequest(req, res) {
    const controller = new AbortController();
    const abortRequest = () => controller.abort(new Error('PDF generation request aborted'));
    const abortOnResponseClose = () => {
        if (!res.writableEnded) {
            abortRequest();
        }
    };
    const timeoutId = setTimeout(() => controller.abort(new Error('PDF generation request timed out')), PDF_SERVER_TIMEOUT_MS);

    req.once('aborted', abortRequest);
    res.once('close', abortOnResponseClose);

    return {
        signal: controller.signal,
        cleanup() {
            clearTimeout(timeoutId);
            req.removeListener('aborted', abortRequest);
            res.removeListener('close', abortOnResponseClose);
        }
    };
}

async function serveSharedPdfByToken(res, token) {
    const pdfInfo = await shareResumeService.getSharedPdfByToken(token);
    if (!pdfInfo) {
        return res.status(404).json({
            success: false,
            error: 'PDF not found'
        });
    }

    let stats;
    try {
        stats = await fs.stat(pdfInfo.path);
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return res.status(404).json({
                success: false,
                error: 'PDF not found'
            });
        }

        throw error;
    }
    const filename = pdfInfo.name ? `${pdfInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` : 'cv.pdf';

    setSafeFileResponseHeaders(res, {
        contentType: 'application/pdf',
        filename,
        contentLength: stats.size,
        inline: true
    });

    try {
        await pipeline(createReadStream(pdfInfo.path), res);
    } catch (error) {
        if (error?.code === 'ENOENT' && !res.headersSent) {
            res.removeHeader('Content-Type');
            res.removeHeader('Content-Disposition');
            res.removeHeader('Content-Length');
            return res.status(404).json({
                success: false,
                error: 'PDF not found'
            });
        }
        if (!res.headersSent) {
            res.removeHeader('Content-Type');
            res.removeHeader('Content-Disposition');
            res.removeHeader('Content-Length');
            return res.status(500).json({
                success: false,
                error: 'Failed to serve PDF'
            });
        }
        throw error;
    }

    return null;
}

async function serveOriginalFileByToken(res, token) {
    const resumeMetadata = await shareResumeService.getResumeFileMetadataByToken(token);
    if (!resumeMetadata) {
        return res.status(404).json({
            success: false,
            error: 'File not found'
        });
    }

    const resumeFileData = await shareResumeService.getResumeFileDataById(resumeMetadata.id);
    if (!resumeFileData) {
        return res.status(404).json({
            success: false,
            error: 'Original file not available'
        });
    }

    const filename = resumeMetadata.file_name || resumeMetadata.name || 'cv';
    const contentType = resumeMetadata.resume_file_type || 'application/octet-stream';

    setSafeFileResponseHeaders(res, {
        contentType,
        filename,
        contentLength: resumeMetadata.resume_file_size || resumeFileData.length
    });
    res.end(resumeFileData);
    return null;
}

/**
 * POST /api/share/resume/:resumeId/generate
 * Generate a shareable PDF for an improved resume
 * Requires authentication
 */
router.post('/resume/:resumeId/generate', authenticateToken, validateParams('resumeId'), validateBody(sharePdfSchema), async (req, res) => {
    const pdfServerRequest = createAbortablePdfRequest(req, res);
    try {
        const { resumeId } = req.params;
        const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
        const resume = await getAccessibleResume(req, res);

        if (!resume) {
            return;
        }

        if (!htmlContent) {
            return res.status(400).json({
                success: false,
                error: 'HTML content is required'
            });
        }

        const pdfServerUrl = process.env.PDF_SERVER_URL || 'http://localhost:3002';
        try {
            await assertTrustedInternalServiceUrl(pdfServerUrl);
        } catch (guardError) {
            safeLog('warn', 'PDF server URL rejected by network guard', {
                resumeId,
                error: guardError.message
            });
            return res.status(503).json({
                success: false,
                error: 'PDF server endpoint is not configured for internal access.'
            });
        }

        const pdfServerHeaders = getPdfServerAuthHeaders({ 'Content-Type': 'application/json' });
        const pdfResponse = await fetch(`${pdfServerUrl}/generate-pdf`, {
            method: 'POST',
            headers: pdfServerHeaders,
            signal: pdfServerRequest.signal,
            body: JSON.stringify({
                htmlContent,
                filename: filename || 'cv',
                stylesheet: stylesheet || '',
                headerContent,
                footerContent,
                footerHeight: footerHeight || 25
            })
        });

        if (!pdfResponse.ok) {
            throw new Error('Failed to generate PDF');
        }

        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const { token, expiresAt } = await shareResumeService.storeSharedPdf(
            resumeId,
            pdfBuffer,
            filename || 'cv'
        );

        res.json({
            success: true,
            token,
            expiresAt
        });
    } catch (error) {
        safeLog('error', 'Failed to generate shareable PDF', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        if (error?.name === 'AbortError' || /timed out/i.test(error?.message || '')) {
            return res.status(504).json({
                success: false,
                error: 'PDF generation timed out'
            });
        }
        if (error?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED') {
            return res.status(503).json({
                success: false,
                error: 'PDF server authentication is not configured on the backend.'
            });
        }
        res.status(500).json({
            success: false,
            error: 'Failed to generate shareable PDF'
        });
    } finally {
        pdfServerRequest.cleanup();
    }
});

/**
 * GET /api/share/resume/:resumeId/status
 * Get share status for a resume
 * Requires authentication
 */
router.get('/resume/:resumeId/status', authenticateToken, validateParams('resumeId'), createShareRouteHandler(
    'Failed to get share status',
    'Failed to get share status',
    async (req, res) => {
        const { resumeId } = req.params;
        const resume = await getAccessibleResume(req, res);

        if (!resume) {
            return;
        }

        const status = await shareResumeService.getShareStatus(resumeId);
        res.json(buildShareStatusResponse(status));
    }
));

/**
 * GET /api/share/resume/:resumeId/original
 * Get the original file share URL
 * Requires authentication
 */
router.get('/resume/:resumeId/original', authenticateToken, validateParams('resumeId'), createShareRouteHandler(
    'Failed to get original file URL',
    'Failed to get original file URL',
    async (req, res) => {
        const { resumeId } = req.params;
        const resume = await getAccessibleResume(req, res);

        if (!resume) {
            return;
        }

        const fileInfo = await shareResumeService.getOriginalFileInfo(resumeId);
        if (!fileInfo) {
            return res.status(404).json({
                success: false,
                error: 'Original file not found'
            });
        }

        const token = await shareResumeService.getOrCreateOriginalFileToken(resumeId);

        res.json({
            success: true,
            token,
            filename: fileInfo.filename
        });
    }
));

/**
 * POST /api/share/resume/:resumeId/revoke
 * Revoke all public share links for a resume
 * Requires authentication
 */
router.post('/resume/:resumeId/revoke', authenticateToken, validateParams('resumeId'), createShareRouteHandler(
    'Failed to revoke share links',
    'Failed to revoke share links',
    async (req, res) => {
        const { resumeId } = req.params;
        const resume = await getAccessibleResume(req, res);

        if (!resume) {
            return;
        }

        await shareResumeService.revokeShareLinks(resumeId);
        res.json({ success: true, message: 'Share links revoked' });
    }
));

/**
 * GET /api/share/pdf/:token
 * PUBLIC endpoint - Serve a shared PDF by token
 * No authentication required
 */
router.get('/pdf/:token', createShareRouteHandler(
    'Failed to serve shared PDF',
    'Failed to serve PDF',
    async (req, res) => {
        const { token } = req.params;

        if (!isValidShareToken(token)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token'
            });
        }

        return serveSharedPdfByToken(res, token);
    }
));

/**
 * GET /api/share/file/:token
 * PUBLIC endpoint - Serve the original file by token
 * No authentication required
 */
router.get('/file/:token', createShareRouteHandler(
    'Failed to serve original file',
    'Failed to serve file',
    async (req, res) => {
        const { token } = req.params;

        if (!isValidShareToken(token)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token'
            });
        }

        return serveOriginalFileByToken(res, token);
    }
));

export default router;
