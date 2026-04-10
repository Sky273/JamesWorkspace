/**
 * Batch Export Routes
 * Handles batch PDF/DOCX export to ZIP archive
 */

import express from 'express';
import JSZip from 'jszip';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { pipeline } from 'stream/promises';
import { authenticateToken, isUserAdmin } from '../middleware/auth.middleware.js';
import { validateBody, batchExportSchema, normalizeRequestBodyAliases } from '../utils/validation.js';
import { safeLog } from '../utils/logger.backend.js';
import * as batchExportService from '../services/batchExport.service.js';
import { metrics } from '../services/metrics.service.js';
import { getPdfServerAuthHeaders } from '../utils/pdfServerAuth.js';
import { setSafeFileResponseHeaders } from '../utils/fileResponseSecurity.js';
import { getUserFirmId } from '../utils/firmHelpers.js';
import { assertTrustedInternalServiceUrl } from '../utils/networkHostSecurity.js';
import { getBatchExportPdfTimeoutMs } from '../utils/pdfServiceTimeouts.js';

const router = express.Router();
const MAX_BATCH_EXPORT_RESUMES = 100;
const DEFAULT_BATCH_EXPORT_CONCURRENCY = 4;
const MAX_BATCH_EXPORT_CONCURRENCY = 8;
const DEFAULT_BATCH_EXPORT_BATCH_DELAY_MS = 0;
const MAX_BATCH_EXPORT_ERROR_DETAILS = 20;

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

async function createTempBatchExportWorkspace() {
    return fs.promises.mkdtemp(path.join(os.tmpdir(), 'batch-export-http-'));
}

async function persistBatchExportArtifact(tempDir, fileName, content) {
    const artifactPath = path.join(tempDir, `${Date.now()}-${fileName}`);
    await fs.promises.writeFile(artifactPath, Buffer.from(content));
    return artifactPath;
}

function normalizeBatchExportPayload(payload = {}) {
    const normalized = normalizeRequestBodyAliases(payload);

    return {
        ...normalized,
        resumeIds: normalized.resumeIds,
        templateId: normalized.templateId,
        format: normalized.format || normalized.exportFormat
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
async function callPdfServer(endpoint, body, timeout = getBatchExportPdfTimeoutMs()) {
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

function summarizeBatchExportErrors(errors) {
    const safeErrors = Array.isArray(errors) ? errors : [];
    const details = safeErrors.slice(0, MAX_BATCH_EXPORT_ERROR_DETAILS);
    return {
        details,
        totalErrors: safeErrors.length,
        truncated: safeErrors.length > details.length
    };
}

// POST /api/batch-export - Generate ZIP with multiple PDFs/DOCXs
router.post('/', authenticateToken, validateBody(batchExportSchema), async (req, res) => {
    const startedAt = Date.now();
    let tempExportDir = null;
    const requestId = req.requestId
        || res.locals?.requestId
        || normalizeRequestId(Array.isArray(req.headers['x-request-id']) ? req.headers['x-request-id'][0] : req.headers['x-request-id'])
        || 'batch-export';
    res.setHeader('x-request-id', requestId);
    const exportTimeoutMs = getBatchExportPdfTimeoutMs();
    const trackBatchExport = (payload = {}) => {
        metrics.trackBatchExportActivity({
            source: 'http',
            durationMs: Date.now() - startedAt,
            ...payload
        });
    };
    try {
        const normalizedPayload = normalizeBatchExportPayload(req.body);
        const { resumeIds, templateId, format } = normalizedPayload;
        const isAdmin = isUserAdmin(req);
        const userFirmId = await getUserFirmId(req);
        
        if (!resumeIds || !Array.isArray(resumeIds) || resumeIds.length === 0) {
            return res.status(400).json({ error: 'Resume IDs are required', requestId });
        }

        if (resumeIds.length > MAX_BATCH_EXPORT_RESUMES) {
            return res.status(400).json({
                error: `Batch export is limited to ${MAX_BATCH_EXPORT_RESUMES} resumes per request`,
                requestId
            });
        }
        
        if (!templateId) {
            return res.status(400).json({ error: 'Template ID is required', requestId });
        }
        
        const exportFormat = format || 'pdf';
        const batchExportConcurrency = getBatchExportConcurrency();
        const batchExportBatchDelayMs = getBatchExportBatchDelayMs();
        const totalBatches = Math.ceil(resumeIds.length / batchExportConcurrency);
        safeLog('info', 'Starting batch export', { 
            requestId,
            resumeCount: resumeIds.length, 
            templateId, 
            format: exportFormat,
            pdfServerUrl: PDF_SERVER_URL,
            batchExportConcurrency,
            totalBatches
        });

        try {
            await assertTrustedInternalServiceUrl(PDF_SERVER_URL);
        } catch (guardError) {
            safeLog('warn', 'PDF server URL rejected by network guard', {
                requestId,
                error: guardError.message,
                pdfServerUrl: PDF_SERVER_URL
            });
            trackBatchExport({
                format: format || 'pdf',
                requestedResumes: Array.isArray(resumeIds) ? resumeIds.length : 0,
                failedRuns: 1
            });
            return res.status(503).json({
                error: 'PDF server endpoint is not configured for internal access.',
                requestId
            });
        }
        
        // Fetch template
        const template = await batchExportService.getTemplateByIdForExport(templateId, { isAdmin, userFirmId });
        if (!template) {
            trackBatchExport({
                format: format || 'pdf',
                requestedResumes: resumeIds.length,
                failedRuns: 1
            });
            return res.status(404).json({ error: 'Template not found', requestId });
        }

        // Test PDF server connectivity after validating local prerequisites
        try {
            const testResponse = await fetch(`${PDF_SERVER_URL}/health`, { 
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            if (!testResponse.ok) {
                safeLog('warn', 'PDF server health check failed', { requestId, status: testResponse.status });
            }
        } catch (healthErr) {
            safeLog('error', 'PDF server not reachable', { 
                requestId,
                url: PDF_SERVER_URL, 
                error: healthErr.message 
            });
            trackBatchExport({
                format: format || 'pdf',
                requestedResumes: resumeIds.length,
                failedRuns: 1
            });
            return res.status(503).json({
                error: 'PDF server is not available. Please ensure the PDF server is running.',
                requestId
            });
        }

        const accessibleResumes = await batchExportService.getResumesByIdsForExport(resumeIds, { isAdmin, userFirmId });
        const resumesById = new Map(accessibleResumes.map((resume) => [resume.id, resume]));
        const inaccessibleResumeCount = Math.max(0, resumeIds.length - resumesById.size);
        
        // Create ZIP archive
        const zip = new JSZip();
        tempExportDir = await createTempBatchExportWorkspace();
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
                }, exportTimeoutMs);

                if (!pdfResponse.ok) {
                    const errorText = await pdfResponse.text().catch(() => 'Unknown error');
                    safeLog('error', 'PDF generation failed', { requestId, resumeId, status: pdfResponse.status, error: errorText });
                    return { ok: false, resumeId, error: `Failed to generate ${exportFormat.toUpperCase()}: ${errorText}` };
                }

                const fileName = `${candidateName.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_')}.${fileExtension}`;
                const buffer = await pdfResponse.arrayBuffer();
                return { ok: true, resumeId, fileName, data: buffer };
            } catch (err) {
                safeLog('error', 'Error processing resume for batch export', { requestId, resumeId, error: err.message });
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
            safeLog('debug', 'Batch export HTTP progress', {
                requestId,
                requestedResumeCount: resumeIds.length,
                resolvedResumeCount: resumesById.size,
                batchNumber: batchIndex + 1,
                totalBatches,
                batchSize: batch.length,
                format: exportFormat
            });
            const batchResults = await Promise.all(batch.map((resumeId) => processResumeExport(resumeId)));

            for (const result of batchResults) {
                if (result.authConfigurationError) {
                    return res.status(503).json({
                        error: 'PDF server authentication is not configured on the backend.',
                        requestId
                    });
                }

                if (!result.ok) {
                    errors.push({ resumeId: result.resumeId, error: result.error });
                    continue;
                }

                const artifactPath = await persistBatchExportArtifact(tempExportDir, result.fileName, result.data);
                zip.file(result.fileName, fs.createReadStream(artifactPath));
            }

            if (batchExportBatchDelayMs > 0 && batchIndex < resumeBatches.length - 1) {
                await new Promise((resolve) => setTimeout(resolve, batchExportBatchDelayMs));
            }
        }
        
        // Check if any files were added
        if (Object.keys(zip.files).length === 0) {
            const errorSummary = summarizeBatchExportErrors(errors);
            safeLog('warn', 'Batch export generated no files', {
                requestId,
                requestedResumeCount: resumeIds.length,
                resolvedResumeCount: resumesById.size,
                inaccessibleResumeCount,
                totalErrors: errorSummary.totalErrors,
                truncatedErrors: errorSummary.truncated,
                durationMs: Date.now() - startedAt
            });
            trackBatchExport({
                format: exportFormat,
                requestedResumes: resumeIds.length,
                resolvedResumes: resumesById.size,
                inaccessibleResumes: inaccessibleResumeCount,
                failedFiles: errorSummary.totalErrors,
                failedRuns: 1,
                truncatedErrors: errorSummary.truncated ? 1 : 0
            });
            return res.status(500).json({ 
                error: 'No files could be generated', 
                requestId,
                details: errorSummary.details,
                totalErrors: errorSummary.totalErrors,
                truncated: errorSummary.truncated
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
            trackBatchExport({
                format: exportFormat,
                requestedResumes: resumeIds.length,
                resolvedResumes: resumesById.size,
                inaccessibleResumes: inaccessibleResumeCount,
                generatedFiles: Object.keys(zip.files).length,
                failedFiles: errors.length,
                successfulRuns: 1
            });
            safeLog('info', 'Batch export completed', { 
                requestId,
                templateId,
                format: exportFormat,
                requestedResumeCount: resumeIds.length,
                resolvedResumeCount: resumesById.size,
                inaccessibleResumeCount,
                filesCount: Object.keys(zip.files).length,
                errorsCount: errors.length,
                streaming: true,
                durationMs: Date.now() - startedAt
            });
            return;
        }

        const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
        res.setHeader('Content-Length', zipBuffer.length);
        res.send(zipBuffer);
        trackBatchExport({
            format: exportFormat,
            requestedResumes: resumeIds.length,
            resolvedResumes: resumesById.size,
            inaccessibleResumes: inaccessibleResumeCount,
            generatedFiles: Object.keys(zip.files).length,
            failedFiles: errors.length,
            archiveBytes: zipBuffer.length,
            successfulRuns: 1
        });
        safeLog('info', 'Batch export completed', { 
            requestId,
            templateId,
            format: exportFormat,
            requestedResumeCount: resumeIds.length,
            resolvedResumeCount: resumesById.size,
            inaccessibleResumeCount,
            filesCount: Object.keys(zip.files).length,
            errorsCount: errors.length,
            streaming: false,
            zipSize: zipBuffer.length,
            durationMs: Date.now() - startedAt
        });
    } catch (error) {
        const normalizedPayload = normalizeBatchExportPayload(req.body);
        trackBatchExport({
            format: normalizedPayload.format || 'pdf',
            requestedResumes: Array.isArray(normalizedPayload.resumeIds) ? normalizedPayload.resumeIds.length : 0,
            failedRuns: 1
        });
        safeLog('error', 'Batch export error', { requestId, error: error.message, durationMs: Date.now() - startedAt });
        if (error?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED') {
            return res.status(503).json({
                error: 'PDF server authentication is not configured on the backend.',
                requestId
            });
        }
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate batch export', requestId });
            return;
        }
        res.destroy(error);
    } finally {
        if (tempExportDir) {
            await fs.promises.rm(tempExportDir, { recursive: true, force: true }).catch(() => {});
        }
    }
});

export default router;
