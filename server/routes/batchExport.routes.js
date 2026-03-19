/**
 * Batch Export Routes
 * Handles batch PDF/DOCX export to ZIP archive
 */

import express from 'express';
import JSZip from 'jszip';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import * as batchExportService from '../services/batchExport.service.js';

const router = express.Router();

// PDF Server URL from environment
const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://127.0.0.1:3002';

/**
 * Helper function to call PDF server with timeout
 * @param {string} endpoint - PDF server endpoint
 * @param {Object} body - Request body
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function callPdfServer(endpoint, body, timeout = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(`${PDF_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (err) {
        clearTimeout(timeoutId);
        throw err;
    }
}

/**
 * Process template placeholders
 * @param {string} content - Template content
 * @param {string} name - Candidate name
 * @param {string} title - Candidate title
 * @returns {string} Processed content
 */
function processTemplatePlaceholders(content, name, title) {
    if (!content) return '';
    return content
        .replace(/-name-/g, name)
        .replace(/-title-/g, title);
}

// POST /api/batch-export - Generate ZIP with multiple PDFs/DOCXs
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { resumeIds, templateId, format } = req.body;
        
        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs are required' });
        }
        
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID is required' });
        }
        
        const exportFormat = format || 'pdf';
        safeLog('info', 'Starting batch export', { 
            resumeCount: resumeIds.length, 
            templateId, 
            format: exportFormat,
            pdfServerUrl: PDF_SERVER_URL
        });
        
        // Test PDF server connectivity first
        try {
            const testResponse = await fetch(`${PDF_SERVER_URL}/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            if (!testResponse.ok) {
                safeLog('warn', 'PDF server health check failed', { status: testResponse.status });
            }
        } catch (healthErr) {
            safeLog('error', 'PDF server not reachable', { 
                url: PDF_SERVER_URL, 
                error: healthErr.message 
            });
            return res.status(503).json({ 
                error: 'PDF server is not available. Please ensure the PDF server is running.',
                details: `Cannot reach ${PDF_SERVER_URL}`
            });
        }
        
        // Fetch template
        const template = await batchExportService.getTemplateById(templateId);
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }
        
        // Create ZIP archive
        const zip = new JSZip();
        const errors = [];
        
        // Process each resume sequentially to avoid overwhelming the PDF server
        for (const resumeId of resumeIds) {
            try {
                // Fetch resume
                const resume = await batchExportService.getResumeById(resumeId);
                if (!resume) {
                    errors.push({ resumeId, error: 'Resume not found' });
                    continue;
                }
                
                // Prepare content
                const content = resume.improved_text || resume.original_text || '';
                const candidateName = resume.name || 'Candidat';
                const candidateTitle = resume.title || '';
                
                // Process template
                let processedBody = template.template_content || '';
                processedBody = processedBody.replace(/-name-/g, candidateName);
                processedBody = processedBody.replace(/-title-/g, candidateTitle);
                processedBody = processedBody.replace(/-content-/g, content);
                
                const processedHeader = processTemplatePlaceholders(
                    template.header_content, 
                    candidateName, 
                    candidateTitle
                );
                
                const processedFooter = processTemplatePlaceholders(
                    template.footer_content, 
                    candidateName, 
                    candidateTitle
                );
                
                // Generate document via PDF server
                const endpoint = exportFormat === 'pdf' ? '/generate-pdf' : '/generate-docx';
                const fileExtension = exportFormat === 'pdf' ? 'pdf' : exportFormat;
                
                const pdfResponse = await callPdfServer(endpoint, {
                    htmlContent: processedBody,
                    filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                    stylesheet: template.stylesheet || '',
                    headerContent: processedHeader || undefined,
                    footerContent: processedFooter || undefined,
                    footerHeight: template.footer_height || 25,
                    format: exportFormat
                }, 60000); // 60s timeout per document
                
                if (!pdfResponse.ok) {
                    const errorText = await pdfResponse.text().catch(() => 'Unknown error');
                    safeLog('error', 'PDF generation failed', { resumeId, status: pdfResponse.status, error: errorText });
                    errors.push({ resumeId, error: `Failed to generate ${exportFormat.toUpperCase()}: ${errorText}` });
                    continue;
                }
                
                const buffer = await pdfResponse.arrayBuffer();
                const fileName = `${candidateName.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_')}.${fileExtension}`;
                zip.file(fileName, buffer);
                
                safeLog('debug', 'Added file to ZIP', { fileName, resumeId, size: buffer.byteLength });
            } catch (err) {
                safeLog('error', 'Error processing resume for batch export', { resumeId, error: err.message });
                errors.push({ resumeId, error: err.message });
            }
        }
        
        // Check if any files were added
        if (Object.keys(zip.files).length === 0) {
            return res.status(500).json({ 
                error: 'No files could be generated', 
                details: errors 
            });
        }
        
        // Generate ZIP
        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        
        safeLog('info', 'Batch export completed', { 
            filesCount: Object.keys(zip.files).length,
            errorsCount: errors.length,
            zipSize: zipBuffer.length
        });
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="batch_export_${Date.now()}.zip"`);
        res.send(zipBuffer);
    } catch (error) {
        safeLog('error', 'Batch export error', { error: error.message });
        res.status(500).json({ error: 'Failed to generate batch export', details: error.message });
    }
});

export default router;
