/**
 * Batch Jobs Worker - Export Generator
 * Generates ZIP exports with PDF/DOCX files from processed batch jobs
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import {
    ITEM_STATUS,
    updateJobItemStatus,
    updateJobExportFile,
    getJob,
    getJobItems
} from '../batchJobs.service.js';
import { removeSuggestionMarkers } from './helpers.js';

/**
 * Generate export ZIP for a completed job
 * @param {string} jobId - Job ID
 * @param {Object} options - Export options (templateId, exportFormats)
 */
export async function generateJobExport(jobId, options) {
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
    
    // Log relative paths for debugging
    const itemsWithRelativePath = successfulItems.filter(item => item.relative_path);
    safeLog('info', 'Relative paths in successful items', { 
        jobId, 
        totalSuccessful: successfulItems.length,
        withRelativePath: itemsWithRelativePath.length,
        samplePaths: itemsWithRelativePath.slice(0, 5).map(i => ({ fileName: i.file_name, relativePath: i.relative_path }))
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
        return;
    }
    
    // Get template
    const templateResult = await query('SELECT * FROM templates WHERE id = $1', [templateId]);
    if (templateResult.rows.length === 0) {
        throw new Error('Template not found');
    }
    const template = templateResult.rows[0];
    
    // Import JSZip
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    
    // PDF Server URL
    const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://127.0.0.1:3002';
    
    // Track export statistics
    let exportSuccessCount = 0;
    let exportErrorCount = 0;
    const exportErrors = [];
    const itemResults = new Map();
    
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
    
    /**
     * Helper: generate a document via PDF server with retry
     */
    const generateDocumentWithRetry = async (processedBody, processedHeader, processedFooter, candidateName, format) => {
        const endpoint = format === 'pdf' ? '/generate-pdf' : '/generate-docx';
        const fileExtension = format === 'pdf' ? 'pdf' : format;
        const MAX_RETRIES = 3;
        let lastError = null;
        
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                const response = await fetch(`${PDF_SERVER_URL}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        htmlContent: processedBody,
                        filename: `${candidateName.replace(/\s+/g, '_')}.${fileExtension}`,
                        stylesheet: template.stylesheet || '',
                        headerContent: processedHeader || undefined,
                        footerContent: processedFooter || undefined,
                        footerHeight: template.footer_height || 25,
                        format: format
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    lastError = `${format.toUpperCase()} generation failed (status ${response.status}): ${errorText}`;
                    if (attempt < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                    return { success: false, error: lastError };
                }
                
                const buffer = await response.arrayBuffer();
                return { success: true, buffer };
            } catch (fetchErr) {
                lastError = fetchErr.message;
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                    continue;
                }
            }
        }
        return { success: false, error: lastError || 'Unknown error after retries' };
    };
    
    // Process single item for a specific format
    const processExportItemForFormat = async (item, format) => {
        const fileExtension = format === 'pdf' ? 'pdf' : format;
        const sourceType = item.source_type || 'resume';
        
        try {
            let content, candidateName, candidateTitle, trigram;
            
            if (sourceType === 'adaptation' && item.adaptation_id) {
                // Fetch adaptation
                const adaptResult = await query(
                    'SELECT adapted_text, candidate_name, adapted_title, mission_title FROM resume_adaptations WHERE id = $1',
                    [item.adaptation_id]
                );
                if (adaptResult.rows.length === 0) {
                    return { success: false, itemId: item.id, error: 'Adaptation not found', resumeId: item.resume_id, format, sourceType };
                }
                const adaptation = adaptResult.rows[0];
                content = removeSuggestionMarkers(adaptation.adapted_text || '');
                if (!content || content.trim().length === 0) {
                    return { success: false, itemId: item.id, error: 'Adaptation has no content', resumeId: item.resume_id, format, sourceType };
                }
                candidateName = adaptation.candidate_name || 'Candidat';
                candidateTitle = adaptation.adapted_title || '';
                trigram = candidateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
            } else {
                // Fetch resume
                const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [item.resume_id]);
                if (resumeResult.rows.length === 0) {
                    return { success: false, itemId: item.id, error: 'Resume not found in database', resumeId: item.resume_id, format, sourceType };
                }
                const resume = resumeResult.rows[0];
                content = removeSuggestionMarkers(resume.improved_text || resume.original_text || '');
                if (!content || content.trim().length === 0) {
                    return { success: false, itemId: item.id, error: 'Resume has no content', resumeId: item.resume_id, format, sourceType };
                }
                candidateName = resume.name || 'Candidat';
                candidateTitle = resume.title || '';
                trigram = resume.trigram || candidateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
            }
            
            // Process template
            let processedBody = template.template_content || '';
            processedBody = processedBody.replace(/-name-/g, candidateName);
            processedBody = processedBody.replace(/-title-/g, candidateTitle);
            processedBody = processedBody.replace(/-content-/g, content);
            
            const processedHeader = (template.header_content || '')
                .replace(/-name-/g, candidateName)
                .replace(/-title-/g, candidateTitle);
            
            const processedFooter = (template.footer_content || '')
                .replace(/-name-/g, candidateName)
                .replace(/-title-/g, candidateTitle);
            
            // Generate document
            const result = await generateDocumentWithRetry(processedBody, processedHeader, processedFooter, candidateName, format);
            
            if (!result.success) {
                return { success: false, itemId: item.id, error: result.error, resumeId: item.resume_id, format, sourceType };
            }
            
            const sanitizedItemName = (item.file_name || '')
                .replace(/[^a-zA-Z0-9\-_\s]/g, '')
                .replace(/\s+/g, '_');
            const fileName = sourceType === 'adaptation' && sanitizedItemName
                ? `${trigram}_${sanitizedItemName}_${templateName}.${fileExtension}`
                : `${trigram}_${templateName}.${fileExtension}`;
            
            return { success: true, itemId: item.id, fileName, buffer: result.buffer, resumeId: item.resume_id, format, relativePath: item.relative_path, sourceType };
        } catch (err) {
            safeLog('error', `Error processing ${sourceType} for ${format.toUpperCase()} export`, { resumeId: item.resume_id, adaptationId: item.adaptation_id, error: err.message });
            return { success: false, itemId: item.id, error: err.message, resumeId: item.resume_id, format, sourceType };
        }
    };
    
    // Process items sequentially to avoid rate limiting (429 errors)
    // The PDF server has rate limiting, so we process with small batches and delays
    const PDF_BATCH_SIZE = 3; // Process 3 documents at a time
    const BATCH_DELAY_MS = 500; // Wait 500ms between batches
    
    // Calculate total operations: items × formats
    const totalOperations = successfulItems.length * exportFormats.length;
    safeLog('info', 'Starting batched export processing', { 
        jobId, 
        itemCount: successfulItems.length, 
        formats: exportFormats,
        totalOperations,
        batchSize: PDF_BATCH_SIZE 
    });
    
    // Process each format separately to organize files in folders
    for (const format of exportFormats) {
        safeLog('info', `Processing format: ${format.toUpperCase()}`, { jobId, itemCount: successfulItems.length });
        
        // Track file name duplicates per format folder
        const fileNameCounts = new Map();
        
        for (let i = 0; i < successfulItems.length; i += PDF_BATCH_SIZE) {
            const batch = successfulItems.slice(i, i + PDF_BATCH_SIZE);
            safeLog('debug', `Processing ${format.toUpperCase()} batch`, { jobId, batchStart: i, batchSize: batch.length });
            
            const batchResults = await Promise.all(batch.map(item => processExportItemForFormat(item, format)));
            
            // Add results to the appropriate folder
            for (const result of batchResults) {
                if (result.success) {
                    const itemResult = itemResults.get(result.itemId);
                    if (itemResult) {
                        itemResult.successCount++;
                    }
                    // Determine the file path in the ZIP
                    let filePath = result.fileName;
                    
                    // Log relativePath for debugging
                    safeLog('debug', 'Processing export result', { 
                        fileName: result.fileName, 
                        relativePath: result.relativePath,
                        hasRelativePath: !!result.relativePath
                    });
                    
                    // If relativePath exists, use it to preserve folder structure
                    if (result.relativePath) {
                        // relativePath is like "folder/subfolder/filename.pdf"
                        // Extract the directory part and replace the filename with the generated one
                        const pathParts = result.relativePath.split('/');
                        if (pathParts.length > 1) {
                            // Remove the original filename and use the directory structure
                            pathParts.pop();
                            filePath = pathParts.join('/') + '/' + result.fileName;
                        }
                        safeLog('debug', 'Using relative path structure', { 
                            originalRelativePath: result.relativePath,
                            finalFilePath: filePath 
                        });
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
                    
                    // Add to the format-specific folder
                    safeLog('debug', 'Adding file to ZIP', { format, filePath, sourceType: result.sourceType });
                    formatFolders[format].root.file(filePath, result.buffer);
                    exportSuccessCount++;
                } else {
                    exportErrorCount++;
                    exportErrors.push({ itemId: result.itemId, resumeId: result.resumeId, format: result.format, error: result.error });
                    const itemResult = itemResults.get(result.itemId);
                    if (itemResult) {
                        itemResult.failures.push(`${result.format.toUpperCase()}: ${result.error}`);
                    }
                }
            }
            
            // Add delay between batches to avoid rate limiting
            if (i + PDF_BATCH_SIZE < successfulItems.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
            }
        }
        
        // Log duplicates for this format
        const duplicatesDetected = Array.from(fileNameCounts.entries()).filter(([_, count]) => count > 1);
        if (duplicatesDetected.length > 0) {
            safeLog('debug', `Duplicates in ${format.toUpperCase()} folder`, { 
                duplicates: duplicatesDetected.map(([name, count]) => `${name} (x${count})`) 
            });
        }
        
        // Add delay between formats
        if (exportFormats.indexOf(format) < exportFormats.length - 1) {
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
    }
    
    // Log export statistics - count only actual files, not directories
    const actualFilesInZip = Object.values(zip.files).filter(f => !f.dir).length;
    safeLog('info', 'Export processing completed', { 
        jobId, 
        totalItems: successfulItems.length,
        formats: exportFormats,
        exportSuccessCount, 
        exportErrorCount,
        filesInZip: actualFilesInZip,
        totalZipEntries: Object.keys(zip.files).length,
        errors: exportErrors.length > 0 ? exportErrors.slice(0, 5) : undefined
    });

    for (const { item, failures, successCount } of itemResults.values()) {
        if (failures.length > 0) {
            await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, {
                progress: 100,
                error_message: failures.join(' | ').slice(0, 1000)
            });
        } else if (successCount > 0) {
            await updateJobItemStatus(item.id, ITEM_STATUS.SUCCESS, { progress: 100 });
        }
    }
    
    // Check if any files were added
    if (actualFilesInZip === 0) {
        safeLog('warn', 'No files generated for export', { jobId, exportErrors });
        throw new Error('No files generated for export');
    }
    
    // Generate ZIP and save to temp directory
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    
    // Create exports directory if it doesn't exist
    const exportsDir = path.join(os.tmpdir(), 'batch-exports');
    if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
    }
    
    // Save ZIP file
    const fileName = `export_${jobId}_${Date.now()}.zip`;
    const filePath = path.join(exportsDir, fileName);
    fs.writeFileSync(filePath, zipBuffer);
    
    // Update job with export file info
    await updateJobExportFile(jobId, filePath, fileName);
    
    safeLog('info', 'Export generated successfully', { 
        jobId, 
        fileName, 
        filesCount: Object.keys(zip.files).length,
        size: zipBuffer.length 
    });
}
