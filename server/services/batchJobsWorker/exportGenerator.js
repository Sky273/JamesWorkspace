/**
 * Batch Jobs Worker - Export Generator
 * Generates ZIP exports with PDF/DOCX files from processed batch jobs
 */

import fs from 'fs';
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
import { assertTrustedInternalServiceUrl } from '../../utils/networkHostSecurity.js';
import {
    buildBatchExportArchiveBudgetError,
    getBatchExportMaxArchiveBytes,
    getGeneratedArtifactByteLength
} from '../../utils/batchExportArchiveBudget.js';
import { writeExportArchiveToDisk } from './exportGenerator.archive.js';
import { processExportItemForFormat } from './exportGenerator.items.js';
import {
    buildExportItemSelection,
    buildSafeArchiveFilePath,
    countActualZipFiles,
    createFormatFolders,
    createItemResultsMap,
    createTempExportWorkspace,
    getBatchExportBatchSize,
    getBatchExportMaxOperations,
    persistGeneratedArtifact,
    resolveDuplicateArchivePath
} from './exportGenerator.support.js';

const MAX_LOGGED_EXPORT_ERRORS = 10;
let lastBatchExportSummary = null;

function updateLastBatchExportSummary(summary) {
    lastBatchExportSummary = {
        timestamp: new Date().toISOString(),
        ...summary
    };
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
    const {
        statusCounts,
        successfulItems,
        successWithoutResumeId,
        skippedItems,
        itemsWithRelativePath
    } = buildExportItemSelection(items);
    safeLog('info', 'Job items status breakdown', { jobId, totalItems: items.length, statusCounts });

    // Log relative paths for debugging
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
    const firmLogoMarkupCache = new Map();
    const maxArchiveBytes = getBatchExportMaxArchiveBytes();
    let totalGeneratedArtifactBytes = 0;
    let archiveBudgetExceededMessage = null;
    
    // Create folders for each format in the ZIP
    const formatFolders = createFormatFolders(zip, exportFormats);
    
    // Get template name for file naming
    const templateName = (template.name || 'Template').replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');

    const itemResults = createItemResultsMap(successfulItems);
    
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
            
            const batchResults = await Promise.all(batch.map((item) => processExportItemForFormat({
                item,
                format,
                jobId,
                template,
                templateName,
                pdfServerUrl: PDF_SERVER_URL,
                firmLogoMarkupCache
            })));
            
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
                    filePath = resolveDuplicateArchivePath(filePath, fileNameCounts);
                    
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
    const actualFilesInZip = countActualZipFiles(zip);
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
        const { fileName, filePath, archiveBytes } = await writeExportArchiveToDisk({ zip, jobId });
        finalArchivePath = filePath;
        
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
            archiveBytes,
            successfulRuns: 1,
            metadata: { jobId }
        });
        
        safeLog('info', 'Export generated successfully', { 
            jobId, 
            fileName, 
            filesCount: Object.keys(zip.files).length,
            size: archiveBytes,
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
            archiveBytes,
            durationMs: Date.now() - startedAt
        });
    } catch (error) {
        await cleanupPartialExportArchive(finalArchivePath || error?.partialArchivePath, jobId);
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
