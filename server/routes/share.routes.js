/**
 * Share Routes
 * Public endpoints for sharing resumes via QR code
 */

import { Router, json } from 'express';
import fs from 'fs/promises';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams } from '../utils/validation.js';
import shareResumeService from '../services/shareResume.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';

const router = Router();

// JSON parsing for this router
router.use(json());

/**
 * POST /api/share/resume/:resumeId/generate
 * Generate a shareable PDF for an improved resume
 * Requires authentication
 */
router.post('/resume/:resumeId/generate', authenticateToken, validateParams('resumeId'), async (req, res) => {
    try {
        const { resumeId } = req.params;
        const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;

        if (!htmlContent) {
            return res.status(400).json({
                success: false,
                error: 'HTML content is required'
            });
        }

        // Generate PDF via the PDF server
        const pdfServerUrl = process.env.PDF_SERVER_URL || 'http://localhost:3002';
        
        const pdfResponse = await fetch(`${pdfServerUrl}/generate-pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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

        // Store the PDF
        const { token } = await shareResumeService.storeSharedPdf(
            resumeId,
            pdfBuffer,
            filename || 'cv'
        );

        // Return token - frontend will build the URL using its origin
        res.json({
            success: true,
            token
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
        const status = await shareResumeService.getShareStatus(resumeId);
        
        res.json({
            success: true,
            hasSharedPdf: status.hasSharedPdf,
            token: status.token
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
        const fileInfo = await shareResumeService.getOriginalFileInfo(resumeId);

        if (!fileInfo) {
            return res.status(404).json({
                success: false,
                error: 'Original file not found'
            });
        }

        // For original files, we serve them directly via a token-based URL
        // First check if we already have a token, otherwise create one
        const result = await query(`
            SELECT shared_pdf_token FROM resumes WHERE id = $1
        `, [resumeId]);

        let token = result.rows[0]?.shared_pdf_token;
        
        if (!token) {
            // Generate a token for the original file
            const crypto = await import('crypto');
            token = crypto.randomBytes(32).toString('hex');
            await query(`
                UPDATE resumes SET shared_pdf_token = $1 WHERE id = $2
            `, [token, resumeId]);
        }

        // Return token - frontend will build the URL using its origin
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
 * GET /api/share/pdf/:token
 * PUBLIC endpoint - Serve a shared PDF by token
 * No authentication required
 */
router.get('/pdf/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!token || token.length !== 64) {
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

        // Read and serve the PDF
        const pdfBuffer = await fs.readFile(pdfInfo.path);
        const filename = pdfInfo.name ? `${pdfInfo.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` : 'cv.pdf';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.setHeader('Content-Length', pdfBuffer.length);
        res.send(pdfBuffer);
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

        if (!token || token.length !== 64) {
            return res.status(400).json({
                success: false,
                error: 'Invalid token'
            });
        }

        // Find resume by token and get file data from database
        const result = await query(`
            SELECT id, file_name, name, resume_file_data, resume_file_type, resume_file_size
            FROM resumes 
            WHERE shared_pdf_token = $1
        `, [token]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'File not found'
            });
        }

        const resume = result.rows[0];

        if (!resume.resume_file_data) {
            return res.status(404).json({
                success: false,
                error: 'Original file not available'
            });
        }

        const filename = resume.file_name || resume.name || 'cv';
        const contentType = resume.resume_file_type || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
        res.setHeader('Content-Length', resume.resume_file_size || resume.resume_file_data.length);
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
