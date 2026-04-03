/**
 * Share Routes
 * Public endpoints for sharing resumes via QR code
 */

import { Router, json } from 'express';
import { createReadStream } from 'fs';
import fs from 'fs/promises';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, sharePdfSchema } from '../utils/validation.js';
import shareResumeService from '../services/shareResume.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getPdfServerAuthHeaders } from '../utils/pdfServerAuth.js';
import { getResumeForAccessCheck } from '../services/resumes.service.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import { setSafeFileResponseHeaders } from '../utils/fileResponseSecurity.js';

const router = Router();

// JSON parsing for this router
router.use(json());

function isValidShareToken(token) {
    return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

async function assertResumeAccess(req, res) {
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

/**
 * POST /api/share/resume/:resumeId/generate
 * Generate a shareable PDF for an improved resume
 * Requires authentication
 */
router.post('/resume/:resumeId/generate', authenticateToken, validateParams('resumeId'), validateBody(sharePdfSchema), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
        const resume = await assertResumeAccess(req, res);

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
        const pdfResponse = await fetch(`${pdfServerUrl}/generate-pdf`, {
            method: 'POST',
            headers: getPdfServerAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                htmlContent,
                filename: filename || 'cv.pdf',
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
        res.status(500).json({
            success: false,
            error: 'Failed to generate shareable PDF'
        });
    }
});

/**
 * GET /api/share/resume/:resumeId/status
 * Get share status for a resume
 * Requires authentication
 */
router.get('/resume/:resumeId/status', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res);

        if (!resume) {
            return;
        }

        const status = await shareResumeService.getShareStatus(resumeId);

        res.json({
            success: true,
            hasSharedPdf: status.hasSharedPdf,
            token: status.token,
            expiresAt: status.expiresAt,
            pdfToken: status.pdfToken,
            pdfExpiresAt: status.pdfExpiresAt,
            hasSharedFile: status.hasSharedFile,
            fileToken: status.fileToken,
            fileExpiresAt: status.fileExpiresAt
        });
    } catch (error) {
        safeLog('error', 'Failed to get share status', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get share status'
        });
    }
});

/**
 * GET /api/share/resume/:resumeId/original
 * Get the original file share URL
 * Requires authentication
 */
router.get('/resume/:resumeId/original', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res);

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
    } catch (error) {
        safeLog('error', 'Failed to get original file URL', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to get original file URL'
        });
    }
});

/**
 * POST /api/share/resume/:resumeId/revoke
 * Revoke all public share links for a resume
 * Requires authentication
 */
router.post('/resume/:resumeId/revoke', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const resume = await assertResumeAccess(req, res);

        if (!resume) {
            return;
        }

        await shareResumeService.revokeShareLinks(resumeId);
        res.json({ success: true, message: 'Share links revoked' });
    } catch (error) {
        safeLog('error', 'Failed to revoke share links', {
            resumeId: req.params.resumeId,
            error: error.message
        });
        res.status(500).json({ success: false, error: 'Failed to revoke share links' });
    }
});

/**
 * GET /api/share/pdf/:token
 * PUBLIC endpoint - Serve a shared PDF by token
 * No authentication required
 */
router.get('/pdf/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!isValidShareToken(token)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token'
            });
        }

        const pdfInfo = await shareResumeService.getSharedPdfByToken(token);
        if (!pdfInfo) {
            return res.status(404).json({
                success: false,
                error: 'PDF not found'
            });
        }

        const stats = await fs.stat(pdfInfo.path);
        const filename = pdfInfo.name ? `${pdfInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` : 'cv.pdf';

        setSafeFileResponseHeaders(res, {
            contentType: 'application/pdf',
            filename,
            contentLength: stats.size,
            inline: true
        });
        createReadStream(pdfInfo.path).pipe(res);
    } catch (error) {
        safeLog('error', 'Failed to serve shared PDF', {
            token: req.params.token?.substring(0, 8),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to serve PDF'
        });
    }
});

/**
 * GET /api/share/file/:token
 * PUBLIC endpoint - Serve the original file by token
 * No authentication required
 */
router.get('/file/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!isValidShareToken(token)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token'
            });
        }

        const resume = await shareResumeService.getResumeFileByToken(token);
        if (!resume) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        if (!resume.resume_file_data) {
            return res.status(404).json({
                success: false,
                error: 'Original file not available'
            });
        }

        const filename = resume.file_name || resume.name || 'cv';
        const contentType = resume.resume_file_type || 'application/octet-stream';

        setSafeFileResponseHeaders(res, {
            contentType,
            filename,
            contentLength: resume.resume_file_size || resume.resume_file_data.length
        });
        res.send(resume.resume_file_data);
    } catch (error) {
        safeLog('error', 'Failed to serve original file', {
            token: req.params.token?.substring(0, 8),
            error: error.message
        });
        res.status(500).json({
            success: false,
            error: 'Failed to serve file'
        });
    }
});

export default router;
