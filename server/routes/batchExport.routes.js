/**
 * Batch Export Routes
 * Handles batch PDF/DOCX export to ZIP archive
 */

import express from 'express';
import JSZip from 'jszip';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, batchExportSchema } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as batchExportService from '../services/batchExport.service.js';
import { getPdfServerAuthHeaders } from '../utils/pdfServerAuth.js';
import { setSafeFileResponseHeaders } from '../utils/fileResponseSecurity.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import { assertTrustedInternalServiceUrl } from '../utils/networkHostSecurity.js';

const router = express.Router();
const MAX_BATCH_EXPORT_RESUMES = 100;
const DEFAULT_BATCH_EXPORT_CONCURRENCY = 4;
const MAX_BATCH_EXPORT_CONCURRENCY = 8;
const DEFAULT_BATCH_EXPORT_BATCH_DELAY_MS = 0;

function getFirstDefinedValue(source, keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
            return source[key];
        }
    }
    return undefined;
}

function normalizeBatchExportPayload(payload = {}) {
    return {
        ...payload,
        resumeIds: getFirstDefinedValue(payload, ['resumeIds', 'resume_ids']),
        templateId: getFirstDefinedValue(payload, ['templateId', 'template_id']),
        format: getFirstDefinedValue(payload, ['format', 'exportFormat', 'export_format'])
    };
}

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
        const headers = getPdfServerAuthHeaders({ 'Content-Type': 'application/json' });
        const response = await fetch(`${PDF_SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers,
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

function getNodeReadableStream(body) {
    if (!body) {
        return null;
    }

    if (typeof body.pipe === 'function') {
        return body;
    }

    if (typeof Readable.fromWeb === 'function' && typeof body.getReader === 'function') {
        return Readable.fromWeb(body);
    }

    return null;
}

function getBatchExportConcurrency() {
    const parsed = Number.parseInt(process.env.BATCH_EXPORT_CONCURRENCY || '', 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return DEFAULT_BATCH_EXPORT_CONCURRENCY;
    }
    return Math.min(parsed, MAX_BATCH_EXPORT_CONCURRENCY);
}

function getBatchExportBatchDelayMs() {
    const parsed = Number.parseInt(process.env.BATCH_EXPORT_BATCH_DELAY_MS || '', 10);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : DEFAULT_BATCH_EXPORT_BATCH_DELAY_MS;
}

function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}

// POST /api/batch-export - Generate ZIP with multiple PDFs/DOCXs
router.post('/', authenticateToken, validateBody(batchExportSchema), async (req, res) => {
    try {
        const normalizedPayload = normalizeBatchExportPayload(req.body);
        const { resumeIds, templateId, format } = normalizedPayload;
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        
        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs are required' });
        }

        if (resumeIds.length > MAX_BATCH_EXPORT_RESUMES) {
            return res.status(400).json({
                error: `Batch export is limited to ${MAX_BATCH_EXPORT_RESUMES} resumes per request`
            });
        }
        
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID is required' });
        }
        
        const exportFormat = format || 'pdf';
        const batchExportConcurrency = getBatchExportConcurrency();
        const batchExportBatchDelayMs = getBatchExportBatchDelayMs();
        safeLog('info', 'Starting batch export', { 
            resumeCount: resumeIds.length, 
            templateId, 
            format: exportFormat,
            pdfServerUrl: PDF_SERVER_URL,
            batchExportConcurrency
        });

        try {
            await assertTrustedInternalServiceUrl(PDF_SERVER_URL);
        } catch (guardError) {
            safeLog('warn', 'PDF server URL rejected by network guard', {
                error: guardError.message,
                pdfServerUrl: PDF_SERVER_URL
            });
            return res.status(503).json({
                error: 'PDF server endpoint is not configured for internal access.'
            });
        }
        
        // Fetch template
        const template = await batchExportService.getTemplateByIdForExport(templateId, { isAdmin, userFirmId });
        if (!template) {
            return res.status(404).json({ error: 'Template not found' });
        }

        // Test PDF server connectivity after validating local prerequisites
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
                error: 'PDF server is not available. Please ensure the PDF server is running.'
            });
        }

        const accessibleResumes = await batchExportService.getResumesByIdsForExport(resumeIds, { isAdmin, userFirmId });
        const resumesById = new Map(accessibleResumes.map((resume) => [resume.id, resume]));
        
        // Create ZIP archive
        const zip = new JSZip();
        const errors = [];
        const endpoint = exportFormat === 'pdf' ? '/generate-pdf' : '/generate-docx';
        const fileExtension = exportFormat === 'pdf' ? 'pdf' : exportFormat;

        const processResumeExport = async (resumeId) => {
            const resume = resumesById.get(resumeId);
            if (!resume) {
                return { ok: false, resumeId, error: 'Resume not found' };
            }

            try {
                const content = resume.improved_text || resume.original_text || '';
                const candidateName = resume.name || 'Candidat';
                const candidateTitle = resume.title || '';

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

                const pdfResponse = await callPdfServer(endpoint, {
                    htmlContent: processedBody,
                    filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                    stylesheet: template.stylesheet || '',
                    headerContent: processedHeader || undefined,
                    footerContent: processedFooter || undefined,
                    footerHeight: template.footer_height || 25,
                    format: exportFormat
                }, 60000);

                if (!pdfResponse.ok) {
                    const errorText = await pdfResponse.text().catch(() => 'Unknown error');
                    safeLog('error', 'PDF generation failed', { resumeId, status: pdfResponse.status, error: errorText });
                    return { ok: false, resumeId, error: `Failed to generate ${exportFormat.toUpperCase()}: ${errorText}` };
                }

                const fileName = `${candidateName.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_')}.${fileExtension}`;
                const nodeReadableStream = getNodeReadableStream(pdfResponse.body);
                if (nodeReadableStream) {
                    return { ok: true, resumeId, fileName, data: nodeReadableStream, binary: true };
                }

                const buffer = await pdfResponse.arrayBuffer();
                return { ok: true, resumeId, fileName, data: buffer };
            } catch (err) {
                safeLog('error', 'Error processing resume for batch export', { resumeId, error: err.message });
                return {
                    ok: false,
                    resumeId,
                    error: err?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED'
                        ? 'PDF server authentication is not configured on the backend.'
                        : err.message,
                    authConfigurationError: err?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED'
                };
            }
        };

        const resumeBatches = chunkArray(resumeIds, batchExportConcurrency);
        for (const [batchIndex, batch] of resumeBatches.entries()) {
            const batchResults = await Promise.all(batch.map((resumeId) => processResumeExport(resumeId)));

            for (const result of batchResults) {
                if (result.authConfigurationError) {
                    return res.status(503).json({
                        error: 'PDF server authentication is not configured on the backend.'
                    });
                }

                if (!result.ok) {
                    errors.push({ resumeId: result.resumeId, error: result.error });
                    continue;
                }

                if (result.binary) {
                    zip.file(result.fileName, result.data, { binary: true });
                } else {
                    zip.file(result.fileName, result.data);
                }
            }

            if (batchExportBatchDelayMs > 0 && batchIndex < resumeBatches.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, batchExportBatchDelayMs));
            }
        }
        
        // Check if any files were added
        if (Object.keys(zip.files).length === 0) {
            return res.status(500).json({ 
                error: 'No files could be generated', 
                details: errors 
            });
        }
        
        const zipStream = typeof zip.generateNodeStream === 'function'
            ? zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' })
            : null;

        setSafeFileResponseHeaders(res, {
            contentType: 'application/zip',
            filename: `batch_export_${Date.now()}.zip`
        });

        if (zipStream) {
            await pipeline(zipStream, res);
            safeLog('info', 'Batch export completed', { 
                filesCount: Object.keys(zip.files).length,
                errorsCount: errors.length,
                streaming: true
            });
            return;
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        res.setHeader('Content-Length', zipBuffer.length);
        res.send(zipBuffer);
        safeLog('info', 'Batch export completed', { 
            filesCount: Object.keys(zip.files).length,
            errorsCount: errors.length,
            streaming: false,
            zipSize: zipBuffer.length
        });
    } catch (error) {
        safeLog('error', 'Batch export error', { error: error.message });
        if (error?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED') {
            return res.status(503).json({
                error: 'PDF server authentication is not configured on the backend.'
            });
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate batch export' });
            return;
        }
        res.destroy(error);
    }
});

export default router;
