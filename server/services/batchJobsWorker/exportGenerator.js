/**
 * Batch Jobs Worker - Export Generator
 * Generates ZIP exports with PDF/DOCX files from processed batch jobs
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { pipeline } from 'stream/promises';
import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import { metrics } from '../metrics.service.js';
import {
    ITEM_STATUS,
    updateJobItemStatus,
    updateJobExportFile,
    getJob,
    getJobItems
} from '../batchJobs.service.js';
import { removeSuggestionMarkers } from './helpers.js';
import { getPdfServerAuthHeaders } from '../../utils/pdfServerAuth.js';
import { normalizeArchiveRelativePath } from '../../utils/archiveRelativePath.js';
import { assertTrustedInternalServiceUrl } from '../../utils/networkHostSecurity.js';
import { getBatchExportPdfTimeoutMs } from '../../utils/pdfServiceTimeouts.js';
import { buildFirmLogoMarkup, replaceExportTemplatePlaceholders } from '../../utils/exportTemplatePlaceholders.js';
import {
    buildBatchExportArchiveBudgetError,
    getBatchExportMaxArchiveBytes,
    getGeneratedArtifactByteLength
} from '../../utils/batchExportArchiveBudget.js';

const MAX_LOGGED_EXPORT_ERRORS = 10;
let lastBatchExportSummary = null;

function templateUsesLogoPlaceholder(template = {}) {
    return /-logo-/i.test(template?.template_content || '')
        || /-logo-/i.test(template?.header_content || '')
        || /-logo-/i.test(template?.footer_content || '');
}

function updateLastBatchExportSummary(summary) {
    lastBatchExportSummary = {
        timestamp: new Date().toISOString(),
        ...summary
    };
}

function getBatchExportMaxOperations() {
    const configuredValue = Number.parseInt(process.env.BATCH_EXPORT_MAX_OPERATIONS || '', 10);
    if (!Number.isFinite(configuredValue) || configuredValue < 1) {
        return 300;
    }

    return Math.min(configuredValue, 300);
}

function getBatchExportBatchSize() {
    const configuredValue = Number.parseInt(process.env.BATCH_EXPORT_BATCH_SIZE || '', 10);
    if (!Number.isFinite(configuredValue) || configuredValue < 1) {
        return 100;
    }

    return Math.min(configuredValue, 100);
}

function buildSafeArchiveFilePath(relativePath, generatedFileName) {
    const normalizedRelativePath = normalizeArchiveRelativePath(relativePath);
    if (!normalizedRelativePath) {
        return generatedFileName;
    }

    const archiveDirectory = path.posix.dirname(normalizedRelativePath);
    if (!archiveDirectory || archiveDirectory === '.') {
        return generatedFileName;
    }

    return `${archiveDirectory}/${generatedFileName}`;
}

async function createTempExportWorkspace(jobId) {
    return fs.promises.mkdtemp(path.join(os.tmpdir(), `batch-export-${jobId}-`));
}

async function persistGeneratedArtifact(tempDir, itemId, format, content) {
    const artifactPath = path.join(tempDir, `${itemId}-${format}-${Date.now()}`);
    await fs.promises.writeFile(artifactPath, Buffer.from(content));
    return artifactPath;
}

async function cleanupPartialExportArchive(filePath, jobId) {
    if (!filePath) {
        return;
    }

    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            safeLog('warn', 'Failed to remove partial export archive', {
                jobId,
                filePath,
                error: error.message
            });
        }
    }
}

function buildCandidateTrigram(candidateName, existingTrigram = '') {
    return existingTrigram || candidateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
}

async function loadExportSourceData(item) {
    const sourceType = item.source_type || 'resume';

    if (sourceType === 'adaptation' && item.adaptation_id) {
        const adaptResult = await query(
            'SELECT adapted_text, candidate_name, adapted_title, mission_title, firm_id FROM resume_adaptations WHERE id = $1',
            [item.adaptation_id]
        );
        if (adaptResult.rows.length === 0) {
            return { success: false, error: 'Adaptation not found', sourceType };
        }

        const adaptation = adaptResult.rows[0];
        const content = removeSuggestionMarkers(adaptation.adapted_text || '');
        if (!content || content.trim().length === 0) {
            return { success: false, error: 'Adaptation has no content', sourceType };
        }

        const candidateName = adaptation.candidate_name || 'Candidat';
        return {
            success: true,
            sourceType,
            content,
            candidateName,
            candidateTitle: adaptation.adapted_title || '',
            firmId: adaptation.firm_id || null,
            trigram: buildCandidateTrigram(candidateName)
        };
    }

    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [item.resume_id]);
    if (resumeResult.rows.length === 0) {
        return { success: false, error: 'Resume not found in database', sourceType };
    }

    const resume = resumeResult.rows[0];
    const content = removeSuggestionMarkers(resume.improved_text || resume.original_text || '');
    if (!content || content.trim().length === 0) {
        return { success: false, error: 'Resume has no content', sourceType };
    }

    const candidateName = resume.name || 'Candidat';
    return {
        success: true,
        sourceType,
        content,
        candidateName,
        candidateTitle: resume.title || '',
        firmId: resume.firm_id || null,
        trigram: buildCandidateTrigram(candidateName, resume.trigram)
    };
}

async function resolveFirmLogoMarkup({ firmId, template, firmLogoMarkupCache }) {
    if (!firmId || !templateUsesLogoPlaceholder(template)) {
        return '';
    }

    if (!firmLogoMarkupCache.has(firmId)) {
        const firmResult = await query(
            'SELECT id, logo_url, logo_data, logo_mime_type FROM firms WHERE id = $1',
            [firmId]
        );
        firmLogoMarkupCache.set(firmId, buildFirmLogoMarkup(firmResult.rows[0] || null));
    }

    return firmLogoMarkupCache.get(firmId) || '';
}

function buildProcessedTemplateSections(template, { candidateName, candidateTitle, content, logoMarkup }) {
    let processedBody = replaceExportTemplatePlaceholders(template.template_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });
    processedBody = processedBody.replace(/-content-/g, content);

    const processedHeader = replaceExportTemplatePlaceholders(template.header_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });

    const processedFooter = replaceExportTemplatePlaceholders(template.footer_content, {
        name: candidateName,
        title: candidateTitle,
        logoMarkup
    });

    return {
        processedBody,
        processedHeader,
        processedFooter
    };
}

async function generateDocumentWithRetry({
    pdfServerUrl,
    template,
    jobId,
    processedBody,
    processedHeader,
    processedFooter,
    candidateName,
    format,
    diagnostics = {}
}) {
    const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
    const fileExtension = format === 'pdf' ? 'pdf' : format;
    const MAX_RETRIES = 3;
    const requestTimeoutMs = getBatchExportPdfTimeoutMs();
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const headers = getPdfServerAuthHeaders({ 'Content-Type': 'application/json' });
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
                controller.abort(new Error(`PDF server timeout after ${requestTimeoutMs}ms`));
            }, requestTimeoutMs);
            const response = await fetch(`${pdfServerUrl}${endpoint}`, {
                method: 'POST',
                headers,
                signal: controller.signal,
                body: JSON.stringify({
                    htmlContent: processedBody,
                    filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                    stylesheet: template.stylesheet || '',
                    headerContent: processedHeader || undefined,
                    footerContent: processedFooter || undefined,
                    footerHeight: template.footer_height || 25,
                    format
                })
            }).finally(() => {
                clearTimeout(timeoutId);
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                lastError = `${format.toUpperCase()} generation failed (status ${response.status}): ${errorText}`;
                safeLog('warn', 'Batch export document generation attempt failed', {
                    jobId,
                    endpoint,
                    attempt,
                    maxRetries: MAX_RETRIES,
                    candidateName,
                    format,
                    status: response.status,
                    ...diagnostics
                });
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
                return { success: false, error: lastError };
            }

            const buffer = await response.arrayBuffer();
            return { success: true, content: buffer };
        } catch (fetchErr) {
            if (fetchErr?.code === 'PDF_SERVER_AUTH_NOT_CONFIGURED') {
                return { success: false, error: 'PDF server authentication is not configured on the backend.' };
            }
            lastError = fetchErr.message;
            safeLog('warn', 'Batch export document generation request errored', {
                jobId,
                endpoint,
                attempt,
                maxRetries: MAX_RETRIES,
                candidateName,
                format,
                error: fetchErr.message,
                ...diagnostics
            });
            if (attempt < MAX_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                continue;
            }
        }
    }

    return { success: false, error: lastError || 'Unknown error after retries' };
}

/**
 * Generate export ZIP for a completed job
 * @param {string} jobId - Job ID
 * @param {Object} options - Export options (templateId, exportFormats)
 */
export async function generateJobExport(jobId, options) {
    const startedAt = Date.now();
    const trackBatchExport = (payload = {}) => {
        metrics.trackBatchExportActivity({
            source: 'job',
            durationMs: Date.now() - startedAt,
            ...payload
        });
    };
    const persistItemResults = async (exportFailureMessage = null) => {
        for (const { item, failures, successCount } of itemResults.values()) {
            if (failures.length > 0) {
                await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, {
                    progress: 100,
                    error_message: failures.join(' | ').slice(0, 1000)
                });
                continue;
            }

            if (successCount > 0 && exportFailureMessage) {
                await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, {
                    progress: 100,
                    error_message: exportFailureMessage.slice(0, 1000)
                });
                continue;
            }

            if (successCount > 0) {
                await updateJobItemStatus(item.id, ITEM_STATUS.SUCCESS, { progress: 100 });
            }
        }
    };
    const markExportItemsAsError = async (itemsToMark, errorMessage) => {
        const normalizedItems = Array.isArray(itemsToMark) ? itemsToMark : [];
        const normalizedMessage = typeof errorMessage === 'string' && errorMessage.trim().length > 0
            ? errorMessage.trim()
            : 'Export generation failed';

        await Promise.all(normalizedItems.map((item) => updateJobItemStatus(item.id, ITEM_STATUS.ERROR, {
            progress: 100,
            error_message: normalizedMessage.slice(0, 1000)
        })));
    };
    // Support both old exportFormat (single) and new exportFormats (array)
    let exportFormats = options.exportFormats || [options.exportFormat || 'pdf'];
    if (!Array.isArray(exportFormats)) {
        exportFormats = [exportFormats];
    }
    const { templateId } = options;
    
    safeLog('info', 'Generating export for job', { jobId, templateId, exportFormats });
    
    // Get job and items
    const _job = await getJob(jobId);
    const items = await getJobItems(jobId);
    
    // Log all item statuses for debugging
    const statusCounts = items.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
    }, {});
    safeLog('info', 'Job items status breakdown', { jobId, totalItems: items.length, statusCounts });
    
    // Get successful items with resume_id or adaptation_id
    const successfulItems = items.filter(item => item.status === 'success' && (item.resume_id || item.adaptation_id));
    const successWithoutResumeId = items.filter(item => item.status === 'success' && !item.resume_id && !item.adaptation_id);
    const skippedItems = items.length - successfulItems.length;

    // Log relative paths for debugging
    const itemsWithRelativePath = successfulItems.filter(item => item.relative_path);
    safeLog('info', 'Relative paths in successful items', { 
        jobId, 
        totalSuccessful: successfulItems.length,
        withRelativePath: itemsWithRelativePath.length,
        samplePaths: itemsWithRelativePath.slice(0, 5).map(i => ({ fileName: i.file_name, relativePath: i.relative_path }))
    });
    safeLog('info', 'Batch export item selection', {
        jobId,
        totalItems: items.length,
        exportableItems: successfulItems.length,
        skippedItems,
        successfulItemsWithoutSource: successWithoutResumeId.length,
        statusCounts
    });
    
    if (successWithoutResumeId.length > 0) {
        safeLog('warn', 'Some successful items have no resume_id', { 
            jobId, 
            count: successWithoutResumeId.length,
            itemIds: successWithoutResumeId.slice(0, 5).map(i => i.id)
        });
    }
    
    if (successfulItems.length === 0) {
        safeLog('warn', 'No successful items to export', { jobId, statusCounts });
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'no_exportable_items',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: 0,
            skippedItems,
            durationMs: Date.now() - startedAt
        });
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: items.length,
            failedRuns: 1,
            metadata: { jobId, reason: 'no_successful_items' }
        });
        return;
    }
    
    // Get template
    const templateResult = await query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (templateResult.rows.length === 0) {
        await markExportItemsAsError(successfulItems, 'Template not found');
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            failedRuns: 1,
            metadata: { jobId, reason: 'template_not_found' }
        });
        throw new Error('Template not found');
    }
    const template = templateResult.rows[0];
    
    // Import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    const tempExportDir = await createTempExportWorkspace(jobId);
    
    // PDF Server URL
    const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://127.0.0.1:3002';
    try {
        await assertTrustedInternalServiceUrl(PDF_SERVER_URL);
    } catch (error) {
        await fs.promises.rm(tempExportDir, { recursive: true, force: true }).catch(() => {});
        await markExportItemsAsError(successfulItems, error.message);
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            failedRuns: 1,
            metadata: { jobId, reason: 'invalid_pdf_server_url' }
        });
        throw error;
    }
    
    // Track export statistics
    let exportSuccessCount = 0;
    let exportErrorCount = 0;
    const exportErrors = [];
    const itemResults = new Map();
    const firmLogoMarkupCache = new Map();
    const maxArchiveBytes = getBatchExportMaxArchiveBytes();
    let totalGeneratedArtifactBytes = 0;
    let archiveBudgetExceededMessage = null;
    
    // Create folders for each format in the ZIP
    const formatFolders = {};
    for (const format of exportFormats) {
        formatFolders[format] = { root: zip.folder(format.toUpperCase()) };
    }
    
    // Get template name for file naming
    const templateName = (template.name || 'Template').replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');

    for (const item of successfulItems) {
        itemResults.set(item.id, { item, failures: [], successCount: 0 });
    }
    
    // Process single item for a specific format
    const processExportItemForFormat = async (item, format) => {
        const fileExtension = format === 'pdf' ? 'pdf' : format;
        const fallbackSourceType = item.source_type || 'resume';
        
        try {
            const exportSource = await loadExportSourceData(item);
            if (!exportSource.success) {
                return {
                    success: false,
                    itemId: item.id,
                    error: exportSource.error,
                    resumeId: item.resume_id,
                    format,
                    sourceType: exportSource.sourceType
                };
            }

            const {
                sourceType,
                content,
                candidateName,
                candidateTitle,
                trigram,
                firmId
            } = exportSource;

            const logoMarkup = await resolveFirmLogoMarkup({
                firmId,
                template,
                firmLogoMarkupCache
            });

            const {
                processedBody,
                processedHeader,
                processedFooter
            } = buildProcessedTemplateSections(template, {
                candidateName,
                candidateTitle,
                content,
                logoMarkup
            });
            
            // Generate document
            const result = await generateDocumentWithRetry({
                pdfServerUrl: PDF_SERVER_URL,
                template,
                jobId,
                processedBody,
                processedHeader,
                processedFooter,
                candidateName,
                format,
                diagnostics: {
                    itemId: item.id,
                    resumeId: item.resume_id || null,
                    adaptationId: item.adaptation_id || null,
                    sourceType
                }
            });
            
            if (!result.success) {
                return { success: false, itemId: item.id, error: result.error, resumeId: item.resume_id, format, sourceType };
            }
            
            const sanitizedItemName = (item.file_name || '')
                .replace(/[^a-zA-Z0-9\-_\s]/g, '')
                .replace(/\s+/g, '_');
            const fileName = sourceType === 'adaptation' && sanitizedItemName
                ? `${trigram}_${sanitizedItemName}_${templateName}.${fileExtension}`
                : `${trigram}_${templateName}.${fileExtension}`;
            
            return { success: true, itemId: item.id, fileName, content: result.content, resumeId: item.resume_id, format, relativePath: item.relative_path, sourceType };
        } catch (err) {
            safeLog('error', `Error processing ${fallbackSourceType} for ${format.toUpperCase()} export`, { resumeId: item.resume_id, adaptationId: item.adaptation_id, error: err.message });
            return { success: false, itemId: item.id, error: err.message, resumeId: item.resume_id, format, sourceType: fallbackSourceType };
        }
    };
    
    // Process items in bounded batches to keep upstream load controlled.
    const exportBatchSize = getBatchExportBatchSize();
    const totalBatches = Math.ceil(successfulItems.length / exportBatchSize);
    
    // Calculate total operations: items × formats
    const totalOperations = successfulItems.length * exportFormats.length;
    const maxOperations = getBatchExportMaxOperations();
    if (totalOperations > maxOperations) {
        const errorMessage = `Batch export exceeds configured workload limit (${totalOperations}/${maxOperations} operations)`;
        await markExportItemsAsError(successfulItems, errorMessage);
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'rejected',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: successfulItems.length,
            skippedItems,
            totalOperations,
            maxOperations,
            reason: 'max_operations_exceeded',
            durationMs: Date.now() - startedAt
        });
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            failedRuns: 1,
            metadata: {
                jobId,
                reason: 'max_operations_exceeded',
                totalOperations,
                maxOperations
            }
        });
        throw new Error(errorMessage);
    }
    safeLog('info', 'Starting batched export processing', { 
        jobId, 
        itemCount: successfulItems.length,
        formats: exportFormats,
        totalOperations,
        batchSize: exportBatchSize,
        totalBatches,
        maxOperations
    });
    
    // Process each format separately to organize files in folders
    for (const format of exportFormats) {
        safeLog('info', `Processing format: ${format.toUpperCase()}`, { jobId, itemCount: successfulItems.length });
        let formatSuccessCount = 0;
        let formatErrorCount = 0;
        
        // Track file name duplicates per format folder
        const fileNameCounts = new Map();
        
        for (let i = 0; i < successfulItems.length; i += exportBatchSize) {
            const batch = successfulItems.slice(i, i + exportBatchSize);
            const batchNumber = Math.floor(i / exportBatchSize) + 1;
            const batchStartedAt = Date.now();
            let batchSuccessCount = 0;
            let batchErrorCount = 0;
            safeLog('info', `Processing ${format.toUpperCase()} batch`, { jobId, batchStart: i, batchSize: batch.length });
            safeLog('info', 'Batch export batch started', {
                jobId,
                format,
                batchNumber,
                totalBatches,
                batchSize: batch.length,
                processedItemsBeforeBatch: i,
                totalItems: successfulItems.length
            });
            
            const batchResults = await Promise.all(batch.map(item => processExportItemForFormat(item, format)));
            
            // Add results to the appropriate folder
            for (const result of batchResults) {
                if (result.success) {
                    const itemResult = itemResults.get(result.itemId);
                    const artifactBytes = getGeneratedArtifactByteLength(result.content);
                    if (totalGeneratedArtifactBytes + artifactBytes > maxArchiveBytes) {
                        archiveBudgetExceededMessage = buildBatchExportArchiveBudgetError({
                            currentBytes: totalGeneratedArtifactBytes,
                            nextBytes: artifactBytes,
                            maxBytes: maxArchiveBytes
                        }).message;
                        safeLog('warn', 'Batch export archive budget exceeded', {
                            jobId,
                            format,
                            itemId: result.itemId,
                            currentBytes: totalGeneratedArtifactBytes,
                            nextBytes: artifactBytes,
                            maxArchiveBytes
                        });
                        break;
                    }

                    let filePath;
                    try {
                        filePath = buildSafeArchiveFilePath(result.relativePath, result.fileName);
                    } catch (pathError) {
                        exportErrorCount++;
                        exportErrors.push({
                            itemId: result.itemId,
                            resumeId: result.resumeId,
                            format: result.format,
                            error: pathError.message
                        });
                        if (itemResult) {
                            itemResult.failures.push(`${result.format.toUpperCase()}: ${pathError.message}`);
                        }
                        continue;
                    }
                    if (itemResult) {
                        itemResult.successCount++;
                    }
                    
                    // Handle duplicate file paths by adding a suffix
                    const count = fileNameCounts.get(filePath) || 0;
                    if (count > 0) {
                        const lastDot = filePath.lastIndexOf('.');
                        if (lastDot > 0) {
                            filePath = `${filePath.substring(0, lastDot)}_${count + 1}${filePath.substring(lastDot)}`;
                        } else {
                            filePath = `${filePath}_${count + 1}`;
                        }
                    }
                    fileNameCounts.set(result.relativePath ? filePath.split('/').slice(0, -1).join('/') + '/' + result.fileName : filePath, count + 1);
                    
                    const artifactPath = await persistGeneratedArtifact(tempExportDir, result.itemId, result.format, result.content);
                    totalGeneratedArtifactBytes += artifactBytes;

                    // Add to the format-specific folder
                    safeLog('debug', 'Adding file to ZIP', { format, filePath, sourceType: result.sourceType });
                    formatFolders[format].root.file(filePath, fs.createReadStream(artifactPath));
                    exportSuccessCount++;
                    formatSuccessCount++;
                    batchSuccessCount++;
                } else {
                    exportErrorCount++;
                    formatErrorCount++;
                    batchErrorCount++;
                    exportErrors.push({ itemId: result.itemId, resumeId: result.resumeId, format: result.format, error: result.error });
                    const itemResult = itemResults.get(result.itemId);
                    if (itemResult) {
                        itemResult.failures.push(`${result.format.toUpperCase()}: ${result.error}`);
                    }
                }
            }

            safeLog('info', 'Batch export batch completed', {
                jobId,
                format,
                batchNumber,
                totalBatches,
                batchSize: batch.length,
                generatedFiles: batchSuccessCount,
                failedFiles: batchErrorCount,
                durationMs: Date.now() - batchStartedAt
            });

            if (archiveBudgetExceededMessage) {
                break;
            }
        }
        
        // Log duplicates for this format
        const duplicatesDetected = Array.from(fileNameCounts.entries()).filter(([_, count]) => count > 1);
        if (duplicatesDetected.length > 0) {
            safeLog('debug', `Duplicates in ${format.toUpperCase()} folder`, { 
                duplicates: duplicatesDetected.map(([name, count]) => `${name} (x${count})`) 
            });
        }
        safeLog('info', 'Batch export format completed', {
            jobId,
            format,
            exportableItems: successfulItems.length,
            generatedFiles: formatSuccessCount,
            failedFiles: formatErrorCount,
            skippedItems
        });

        if (archiveBudgetExceededMessage) {
            break;
        }
    }

    if (archiveBudgetExceededMessage) {
        await markExportItemsAsError(successfulItems, archiveBudgetExceededMessage);
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'rejected',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: successfulItems.length,
            skippedItems,
            generatedArtifactBytes: totalGeneratedArtifactBytes,
            maxArchiveBytes,
            reason: 'max_archive_bytes_exceeded',
            durationMs: Date.now() - startedAt
        });
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            failedRuns: 1,
            metadata: {
                jobId,
                reason: 'max_archive_bytes_exceeded',
                generatedArtifactBytes: totalGeneratedArtifactBytes,
                maxArchiveBytes
            }
        });
        throw new Error(archiveBudgetExceededMessage);
    }
    
    // Log export statistics - count only actual files, not directories
    const actualFilesInZip = Object.values(zip.files).filter(f => !f.dir).length;
    safeLog('info', 'Export processing completed', { 
        jobId, 
        totalItems: successfulItems.length,
        formats: exportFormats,
        exportSuccessCount, 
        exportErrorCount,
        skippedItems,
        filesInZip: actualFilesInZip,
        totalZipEntries: Object.keys(zip.files).length,
        errors: exportErrors.length > 0 ? exportErrors.slice(0, MAX_LOGGED_EXPORT_ERRORS) : undefined,
        generatedArtifactBytes: totalGeneratedArtifactBytes,
        durationMs: Date.now() - startedAt
    });

    // Check if any files were added
    if (actualFilesInZip === 0) {
        await persistItemResults('Export archive generation failed');
        safeLog('warn', 'No files generated for export', { jobId, exportErrors });
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'failed',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: successfulItems.length,
            skippedItems,
            generatedFiles: 0,
            failedFiles: exportErrorCount,
            reason: 'no_generated_files',
            durationMs: Date.now() - startedAt
        });
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            resolvedResumes: successfulItems.length,
            generatedFiles: 0,
            failedFiles: exportErrorCount,
            failedRuns: 1,
            metadata: { jobId, reason: 'no_generated_files' }
        });
        throw new Error('No files generated for export');
    }
    
    let finalArchivePath = null;

    try {
        // Generate ZIP directly to disk to avoid buffering the full archive in memory
        const exportsDir = path.join(os.tmpdir(), 'batch-exports');
        await fs.promises.mkdir(exportsDir, { recursive: true });

        // Save ZIP file
        const fileName = `export_${jobId}_${Date.now()}.zip`;
        const filePath = path.join(exportsDir, fileName);
        finalArchivePath = filePath;
        const zipStream = typeof zip.generateNodeStream === 'function'
            ? zip.generateNodeStream({ streamFiles: true, compression: 'DEFLATE' })
            : null;
        let exportedSize = 0;

        if (zipStream) {
            await pipeline(zipStream, fs.createWriteStream(filePath));
            exportedSize = (await fs.promises.stat(filePath)).size;
        } else {
            const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
            await fs.promises.writeFile(filePath, zipBuffer);
            exportedSize = (await fs.promises.stat(filePath)).size;
        }
        
        // Update job with export file info
        await updateJobExportFile(jobId, filePath, fileName);
        await persistItemResults();
        trackBatchExport({
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            requestedResumes: successfulItems.length,
            resolvedResumes: successfulItems.length,
            generatedFiles: actualFilesInZip,
            failedFiles: exportErrorCount,
            generatedArtifactBytes: totalGeneratedArtifactBytes,
            archiveBytes: exportedSize,
            successfulRuns: 1,
            metadata: { jobId }
        });
        
        safeLog('info', 'Export generated successfully', { 
            jobId, 
            fileName, 
            filesCount: Object.keys(zip.files).length,
            size: exportedSize,
            durationMs: Date.now() - startedAt
        });
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'completed',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: successfulItems.length,
            skippedItems,
            generatedFiles: actualFilesInZip,
            failedFiles: exportErrorCount,
            generatedArtifactBytes: totalGeneratedArtifactBytes,
            archiveBytes: exportedSize,
            durationMs: Date.now() - startedAt
        });
    } catch (error) {
        await cleanupPartialExportArchive(finalArchivePath, jobId);
        await persistItemResults('Export archive generation failed');
        updateLastBatchExportSummary({
            operation: 'generateJobExport',
            jobId,
            status: 'failed',
            format: exportFormats.length === 1 ? exportFormats[0] : 'multi',
            totalItems: items.length,
            exportableItems: successfulItems.length,
            skippedItems,
            failedFiles: exportErrorCount,
            generatedArtifactBytes: totalGeneratedArtifactBytes,
            error: error.message,
            durationMs: Date.now() - startedAt
        });
        throw error;
    } finally {
        await fs.promises.rm(tempExportDir, { recursive: true, force: true }).catch((cleanupError) => {
            safeLog('warn', 'Failed to remove temporary export workspace', {
                jobId,
                tempExportDir,
                error: cleanupError.message
            });
        });
    }
}

export function getLastBatchExportSummary() {
    return lastBatchExportSummary;
}
