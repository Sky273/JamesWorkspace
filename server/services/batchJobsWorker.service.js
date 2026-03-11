/**
 * Batch Jobs Worker Service
 * Processes batch job items (CV import, analysis, improvement)
 * Runs as a background worker processing items in parallel batches
 */

import { safeLog } from '../utils/logger.backend.js';
import { query } from '../config/database.js';
import {
    JOB_STATUS,
    ITEM_STATUS,
    initializeBatchJobsTable,
    getPendingJobs,
    getPendingItems,
    updateJobStatus,
    updateJobItemStatus,
    updateJobCounters,
    isJobComplete,
    updateJobExportFile,
    getJob,
    getJobItems
} from './batchJobs.service.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Worker configuration
const WORKER_INTERVAL = 5000; // Check for pending jobs every 5 seconds
const BATCH_SIZE = 100; // Process up to 100 items in parallel
const MAX_CONCURRENT_LLM = 10; // Max concurrent LLM requests to avoid rate limits
const SHUTDOWN_TIMEOUT = 30000; // Max wait time for graceful shutdown (30s)

// Worker state
let workerInterval = null;
let isWorkerRunning = false;
let isInitialized = false;
let isShuttingDown = false;
let activeProcessingCount = 0;

// Semaphore for LLM rate limiting
let activeLLMRequests = 0;
const llmQueue = [];

/**
 * Parse a score value to integer (handles "84%", 84, "84", etc.)
 * @param {any} value - Score value
 * @returns {number|null} - Integer score or null
 */
function parseScore(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') {
        // Remove % and any whitespace
        const cleaned = value.replace('%', '').trim();
        const num = parseInt(cleaned, 10);
        return isNaN(num) ? null : num;
    }
    return null;
}

/**
 * Acquire a slot for LLM request (rate limiting)
 * @returns {Promise<void>}
 */
async function acquireLLMSlot() {
    return new Promise((resolve) => {
        const tryAcquire = () => {
            if (activeLLMRequests < MAX_CONCURRENT_LLM) {
                activeLLMRequests++;
                resolve();
            } else {
                llmQueue.push(tryAcquire);
            }
        };
        tryAcquire();
    });
}

/**
 * Release a slot for LLM request
 */
function releaseLLMSlot() {
    activeLLMRequests--;
    if (llmQueue.length > 0) {
        const next = llmQueue.shift();
        next();
    }
}

/**
 * Initialize the worker
 */
export async function initializeWorker() {
    if (isInitialized) return;

    try {
        await initializeBatchJobsTable();
        isInitialized = true;
        safeLog('info', 'Batch jobs worker initialized');
    } catch (error) {
        safeLog('error', 'Failed to initialize batch jobs worker', { error: error.message });
        throw error;
    }
}

/**
 * Start the background worker
 */
export async function startWorker() {
    if (workerInterval) {
        safeLog('warn', 'Batch jobs worker already running');
        return;
    }

    isShuttingDown = false;
    safeLog('info', 'Starting batch jobs worker', { interval: WORKER_INTERVAL, batchSize: BATCH_SIZE });
    
    // Log all existing jobs for debugging
    try {
        const allJobsResult = await query(`SELECT id, status, total_items, processed_items, created_at FROM batch_jobs ORDER BY created_at DESC LIMIT 10`);
        if (allJobsResult.rows.length > 0) {
            safeLog('info', 'Existing batch jobs', { jobs: allJobsResult.rows.map(j => ({ id: j.id, status: j.status, total: j.total_items, processed: j.processed_items })) });
        }
    } catch (e) {
        safeLog('debug', 'Could not fetch existing jobs', { error: e.message });
    }

    workerInterval = setInterval(async () => {
        if (isWorkerRunning || isShuttingDown) return;

        try {
            isWorkerRunning = true;
            await processNextBatch();
        } catch (error) {
            safeLog('error', 'Batch jobs worker error', { error: error.message });
        } finally {
            isWorkerRunning = false;
        }
    }, WORKER_INTERVAL);
}

/**
 * Stop the background worker gracefully
 * Waits for active processing to complete before stopping
 * @returns {Promise<void>}
 */
export async function stopWorker() {
    if (!workerInterval && !isWorkerRunning) {
        safeLog('info', 'Batch jobs worker already stopped');
        return;
    }

    safeLog('info', 'Stopping batch jobs worker...', { activeProcessing: activeProcessingCount });
    isShuttingDown = true;

    // Stop the interval immediately to prevent new batches
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
    }

    // Wait for active processing to complete
    if (activeProcessingCount > 0 || isWorkerRunning) {
        safeLog('info', 'Waiting for active batch processing to complete...', { activeProcessingCount });
        
        const startTime = Date.now();
        
        await new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                const elapsed = Date.now() - startTime;
                
                if (activeProcessingCount === 0 && !isWorkerRunning) {
                    clearInterval(checkInterval);
                    safeLog('info', 'All batch processing completed');
                    resolve();
                } else if (elapsed >= SHUTDOWN_TIMEOUT) {
                    clearInterval(checkInterval);
                    safeLog('warn', 'Shutdown timeout reached, forcing stop', { 
                        activeProcessingCount, 
                        isWorkerRunning,
                        elapsed 
                    });
                    resolve();
                } else {
                    safeLog('debug', 'Still waiting for batch processing...', { 
                        activeProcessingCount, 
                        isWorkerRunning,
                        elapsed 
                    });
                }
            }, 500);
        });
    }

    isWorkerRunning = false;
    activeProcessingCount = 0;
    safeLog('info', 'Batch jobs worker stopped');
}

/**
 * Process the next batch of items
 */
async function processNextBatch() {
    // Get pending jobs
    const pendingJobs = await getPendingJobs();
    
    if (pendingJobs.length > 0) {
        safeLog('debug', 'Found jobs to process', { count: pendingJobs.length, jobIds: pendingJobs.map(j => j.id) });
    }

    for (const job of pendingJobs) {
        try {
            safeLog('debug', 'Processing job', { jobId: job.id, status: job.status, totalItems: job.total_items });
            
            // Mark job as processing if not already
            if (job.status === JOB_STATUS.PENDING) {
                await updateJobStatus(job.id, JOB_STATUS.PROCESSING);
            }

            // Get pending items
            const pendingItems = await getPendingItems(job.id);
            safeLog('debug', 'Got pending items', { jobId: job.id, pendingItemsCount: pendingItems.length });

            if (pendingItems.length === 0) {
                // No more items, check if job is complete
                const isComplete = await isJobComplete(job.id);
                safeLog('debug', 'No pending items, checking completion', { jobId: job.id, isComplete });
                
                if (isComplete) {
                    await updateJobCounters(job.id);
                    
                    // Generate export ZIP if export was requested
                    const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});
                    if (options.export && options.templateId) {
                        try {
                            await generateJobExport(job.id, options);
                        } catch (exportError) {
                            safeLog('error', 'Failed to generate export for job', { jobId: job.id, error: exportError.message });
                        }
                    }
                    
                    await updateJobStatus(job.id, JOB_STATUS.COMPLETED);
                    safeLog('info', 'Batch job completed', { jobId: job.id });
                }
                continue;
            }

            // Process items in parallel
            safeLog('info', 'Processing batch', { 
                jobId: job.id, 
                jobType: job.job_type,
                itemCount: pendingItems.length 
            });

            const promises = pendingItems.map(item => processItem(item, job));
            await Promise.all(promises);

            // Update counters after batch
            await updateJobCounters(job.id);

            // Check if job is complete
            if (await isJobComplete(job.id)) {
                // Generate export ZIP if export was requested
                const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});
                if (options.export && options.templateId) {
                    try {
                        await generateJobExport(job.id, options);
                    } catch (exportError) {
                        safeLog('error', 'Failed to generate export for job', { jobId: job.id, error: exportError.message });
                    }
                }
                
                await updateJobStatus(job.id, JOB_STATUS.COMPLETED);
                safeLog('info', 'Batch job completed', { jobId: job.id });
            }
        } catch (error) {
            safeLog('error', 'Error processing job', { jobId: job.id, error: error.message });
            await updateJobStatus(job.id, JOB_STATUS.FAILED, { error_message: error.message });
        }
    }
}

/**
 * Process a single item
 * @param {Object} item - The job item to process
 * @param {Object} job - The parent job
 */
async function processItem(item, job) {
    // Check if shutdown is in progress
    if (isShuttingDown) {
        safeLog('debug', 'Skipping item processing due to shutdown', { itemId: item.id });
        return;
    }

    activeProcessingCount++;
    
    try {
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 10 });

        const options = typeof job.options === 'string' ? JSON.parse(job.options) : (job.options || {});

        if (job.job_type === 'import') {
            await processImportItem(item, job, options);
        } else if (job.job_type === 'improve') {
            await processImproveItem(item, job, options);
        } else {
            throw new Error(`Unknown job type: ${job.job_type}`);
        }

        await updateJobItemStatus(item.id, ITEM_STATUS.SUCCESS, { progress: 100 });
        safeLog('debug', 'Item processed successfully', { itemId: item.id, fileName: item.file_name });

    } catch (error) {
        safeLog('error', 'Failed to process item', { 
            itemId: item.id, 
            fileName: item.file_name,
            error: error.message 
        });
        await updateJobItemStatus(item.id, ITEM_STATUS.ERROR, { 
            error_message: error.message 
        });
    } finally {
        activeProcessingCount--;
    }
}

/**
 * Process an import item (upload + analyze + optionally improve)
 */
async function processImportItem(item, job, options) {
    const { improve = false } = options;
    
    safeLog('info', 'Starting import item processing', { 
        itemId: item.id, 
        fileName: item.file_name, 
        improve,
        hasFileData: !!item.file_data,
        fileDataLength: item.file_data?.length,
        mimeType: item.file_mime_type
    });

    // Step 1: Create resume record
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 20 });

    const resumeResult = await query(`
        INSERT INTO resumes (
            name, 
            status, 
            firm_id, 
            profile_type,
            consent_status,
            created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
    `, [item.file_name, 'processing', job.firm_id, 'employee', 'not_required']);

    const resumeId = resumeResult.rows[0].id;

    // Update item with resume_id
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { 
        progress: 30,
        resume_id: resumeId 
    });

    // Step 2: Extract text from file
    safeLog('info', 'Extracting text from file', { itemId: item.id, fileName: item.file_name });
    const text = await extractTextFromBuffer(item.file_data, item.file_mime_type, item.file_name);
    safeLog('info', 'Text extracted', { itemId: item.id, textLength: text?.length });

    if (!text || text.length < 50) {
        throw new Error('Impossible d\'extraire le texte du CV');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 40 });

    // Step 3: Analyze the CV
    safeLog('info', 'Analyzing CV with LLM', { itemId: item.id, firmId: job.firm_id });
    const analysis = await analyzeResumeWithLLM(text, job.firm_id);
    safeLog('info', 'CV analyzed', { itemId: item.id, hasAnalysis: !!analysis, globalRating: analysis?.globalRating });

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 60 });

    // Step 4: Update resume with analysis
    const tags = analysis.tags || { skills: [], industries: [], tools: [], softSkills: [] };

    await query(`
        UPDATE resumes SET
            original_text = $1,
            global_rating = $2,
            skills_score = $3,
            experience_score = $4,
            education_score = $5,
            ats_score = $6,
            executive_summary_score = $7,
            hobbies_languages_score = $8,
            skills = $9,
            industries = $10,
            tools = $11,
            soft_skills = $12,
            key_improvements = $13,
            name = COALESCE($14, name),
            title = $15,
            status = 'analyzed',
            analyzed_at = NOW()
        WHERE id = $16
    `, [
        analysis.structuredText || text,
        parseScore(analysis.globalRating),
        parseScore(analysis.skillsRating),
        parseScore(analysis.experiencesRating),
        parseScore(analysis.educationRating),
        parseScore(analysis.atsOptimizationRating),
        parseScore(analysis.executiveSummaryRating),
        parseScore(analysis.hobbiesLanguagesRating),
        JSON.stringify(tags.skills || []),
        JSON.stringify(tags.industries || []),
        JSON.stringify(tags.tools || []),
        JSON.stringify(tags.softSkills || []),
        JSON.stringify(analysis.suggestions || {}),
        analysis.name,
        analysis.title,
        resumeId
    ]);

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 70 });

    // Step 5: Improve if requested
    if (improve) {
        safeLog('info', 'Improving CV with LLM', { itemId: item.id, resumeId });
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 75 });

        const improvedResult = await improveResumeWithLLM(
            analysis.structuredText || text,
            analysis,
            job.firm_id
        );

        if (improvedResult) {
            const improvedAnalysis = improvedResult.analysis || {};
            const improvedTags = improvedAnalysis.tags || {};

            safeLog('info', 'Saving improved CV data', { 
                itemId: item.id, 
                resumeId,
                hasImprovedText: !!improvedResult.text,
                improvedGlobalRating: improvedAnalysis.globalRating
            });

            await query(`
                UPDATE resumes SET
                    improved_text = $1,
                    improved_global_rating = $2,
                    improved_skills_score = $3,
                    improved_experience_score = $4,
                    improved_education_score = $5,
                    improved_ats_score = $6,
                    improved_executive_summary_score = $7,
                    improved_hobbies_languages_score = $8,
                    improved_skills = $9,
                    improved_industries = $10,
                    improved_tools = $11,
                    improved_soft_skills = $12,
                    improved_key_improvements = $13,
                    status = 'improved',
                    improvement_date = NOW(),
                    updated_at = NOW()
                WHERE id = $14
            `, [
                improvedResult.text,
                parseScore(improvedAnalysis.globalRating),
                parseScore(improvedAnalysis.skillsRating),
                parseScore(improvedAnalysis.experiencesRating),
                parseScore(improvedAnalysis.educationRating),
                parseScore(improvedAnalysis.atsOptimizationRating),
                parseScore(improvedAnalysis.executiveSummaryRating),
                parseScore(improvedAnalysis.hobbiesLanguagesRating),
                JSON.stringify(improvedTags.skills || []),
                JSON.stringify(improvedTags.industries || []),
                JSON.stringify(improvedTags.tools || []),
                JSON.stringify(improvedTags.softSkills || []),
                JSON.stringify(improvedAnalysis.suggestions || {}),
                resumeId
            ]);

            safeLog('info', 'CV improvement saved successfully', { itemId: item.id, resumeId });
        } else {
            safeLog('warn', 'Improvement returned no result', { itemId: item.id, resumeId });
        }
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
    safeLog('info', 'Import item processing completed', { itemId: item.id, resumeId, improved: improve });
}

/**
 * Process an improve item (improve existing resume)
 */
async function processImproveItem(item, job, options) {
    if (!item.resume_id) {
        throw new Error('Resume ID manquant');
    }

    // Get the resume
    const resumeResult = await query(`
        SELECT id, original_text, global_rating, skills_score, experience_score,
               education_score, ats_score, executive_summary_score, hobbies_languages_score,
               key_improvements, name, title
        FROM resumes WHERE id = $1
    `, [item.resume_id]);

    if (resumeResult.rows.length === 0) {
        throw new Error('CV non trouvé');
    }

    const resume = resumeResult.rows[0];
    const text = resume.original_text;

    if (!text) {
        throw new Error('Texte du CV manquant');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 30 });

    // Build analysis object from resume data
    const analysis = {
        globalRating: resume.global_rating,
        skillsRating: resume.skills_score,
        experiencesRating: resume.experience_score,
        educationRating: resume.education_score,
        atsOptimizationRating: resume.ats_score,
        executiveSummaryRating: resume.executive_summary_score,
        hobbiesLanguagesRating: resume.hobbies_languages_score,
        suggestions: resume.key_improvements ? (typeof resume.key_improvements === 'string' ? JSON.parse(resume.key_improvements) : resume.key_improvements) : {},
        name: resume.name,
        title: resume.title
    };

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 50 });

    // Improve the resume
    const improvedResult = await improveResumeWithLLM(text, analysis, job.firm_id);

    if (!improvedResult) {
        throw new Error('Échec de l\'amélioration');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 80 });

    // Update resume with improved data
    const improvedAnalysis = improvedResult.analysis || {};
    const improvedTags = improvedAnalysis.tags || {};

    safeLog('info', 'Saving improved CV data (improve job)', { 
        itemId: item.id, 
        resumeId: item.resume_id,
        hasImprovedText: !!improvedResult.text,
        improvedGlobalRating: improvedAnalysis.globalRating
    });

    await query(`
        UPDATE resumes SET
            improved_text = $1,
            improved_global_rating = $2,
            improved_skills_score = $3,
            improved_experience_score = $4,
            improved_education_score = $5,
            improved_ats_score = $6,
            improved_executive_summary_score = $7,
            improved_hobbies_languages_score = $8,
            improved_skills = $9,
            improved_industries = $10,
            improved_tools = $11,
            improved_soft_skills = $12,
            improved_key_improvements = $13,
            status = 'improved',
            improvement_date = NOW(),
            updated_at = NOW()
        WHERE id = $14
    `, [
        improvedResult.text,
        parseScore(improvedAnalysis.globalRating),
        parseScore(improvedAnalysis.skillsRating),
        parseScore(improvedAnalysis.experiencesRating),
        parseScore(improvedAnalysis.educationRating),
        parseScore(improvedAnalysis.atsOptimizationRating),
        parseScore(improvedAnalysis.executiveSummaryRating),
        parseScore(improvedAnalysis.hobbiesLanguagesRating),
        JSON.stringify(improvedTags.skills || []),
        JSON.stringify(improvedTags.industries || []),
        JSON.stringify(improvedTags.tools || []),
        JSON.stringify(improvedTags.softSkills || []),
        JSON.stringify(improvedAnalysis.suggestions || {}),
        item.resume_id
    ]);

    safeLog('info', 'Improve item processing completed', { itemId: item.id, resumeId: item.resume_id });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
}

/**
 * Extract text from file buffer
 */
async function extractTextFromBuffer(buffer, mimeType, fileName) {
    // Use pdf-parse for PDF, mammoth for DOCX, word-extractor for DOC
    if (mimeType === 'application/pdf') {
        const pdfParse = (await import('pdf-parse')).default;
        const data = await pdfParse(buffer);
        return data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } else if (mimeType === 'application/msword') {
        const WordExtractor = (await import('word-extractor')).default;
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        return doc.getBody();
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Analyze a resume using the LLM (with rate limiting)
 */
async function analyzeResumeWithLLM(text, firmId) {
    const { analyzeResume, cleanupText } = await import('./openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('./settings.service.js');
    const { getAcceptedIndustriesString } = await import('./industry.service.js');
    const { DEFAULT_ANALYSIS_PROMPT } = await import('../config/prompts.backend.js');

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;

    if (!model) {
        throw new Error('LLM model not configured');
    }

    // Inject accepted industries
    const acceptedIndustries = await getAcceptedIndustriesString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

    // Clean text before analysis
    const cleanedText = cleanupText(text);

    // Acquire LLM slot (rate limiting)
    await acquireLLMSlot();
    let analysis;
    try {
        // Analyze
        analysis = await analyzeResume(cleanedText, model, analysisPrompt, null, false);
    } finally {
        releaseLLMSlot();
    }

    // Recalculate weighted global rating
    analysis = await calculateWeightedGlobalRating(analysis, settings);

    return analysis;
}

/**
 * Improve a resume using the LLM (with rate limiting)
 */
async function improveResumeWithLLM(text, analysis, firmId) {
    const { improveResume, cleanupText, analyzeResume } = await import('./openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('./settings.service.js');
    const { getAcceptedIndustriesString } = await import('./industry.service.js');
    const { DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_ANALYSIS_PROMPT } = await import('../config/prompts.backend.js');

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    let improvementPrompt = settings['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT;

    if (!model) {
        throw new Error('LLM model not configured');
    }

    // Clean text
    const cleanedText = cleanupText(text);

    // Acquire LLM slot for improvement (rate limiting)
    await acquireLLMSlot();
    let improvedText;
    try {
        improvedText = await improveResume(cleanedText, analysis, model, improvementPrompt, null);
    } finally {
        releaseLLMSlot();
    }

    if (!improvedText) {
        throw new Error('Improvement returned empty text');
    }

    // Re-analyze the improved text (with rate limiting)
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const acceptedIndustries = await getAcceptedIndustriesString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

    await acquireLLMSlot();
    let improvedAnalysis;
    try {
        improvedAnalysis = await analyzeResume(improvedText, model, analysisPrompt, null, true);
    } finally {
        releaseLLMSlot();
    }
    
    improvedAnalysis = await calculateWeightedGlobalRating(improvedAnalysis, settings);

    return {
        text: improvedText,
        analysis: improvedAnalysis
    };
}

/**
 * Generate export ZIP for a completed job
 * @param {string} jobId - Job ID
 * @param {Object} options - Export options (templateId, exportFormat)
 */
async function generateJobExport(jobId, options) {
    const { templateId, exportFormat = 'pdf' } = options;
    
    safeLog('info', 'Generating export for job', { jobId, templateId, exportFormat });
    
    // Get job and items
    const job = await getJob(jobId);
    const items = await getJobItems(jobId);
    
    // Get successful items with resume_id
    const successfulItems = items.filter(item => item.status === 'success' && item.resume_id);
    
    if (successfulItems.length === 0) {
        safeLog('warn', 'No successful items to export', { jobId });
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
    const exportResults = [];
    
    // Process single item for export
    const processExportItem = async (item) => {
        try {
            // Fetch resume
            const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [item.resume_id]);
            if (resumeResult.rows.length === 0) {
                return { success: false, error: 'Resume not found in database', resumeId: item.resume_id };
            }
            
            const resume = resumeResult.rows[0];
            const content = resume.improved_text || resume.original_text || '';
            
            if (!content || content.trim().length === 0) {
                return { success: false, error: 'Resume has no content', resumeId: item.resume_id };
            }
            
            const candidateName = resume.name || 'Candidat';
            const candidateTitle = resume.title || '';
            
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
            
            // Generate document via PDF server
            const endpoint = exportFormat === 'pdf' ? '/generate-pdf' : '/generate-docx';
            const fileExtension = exportFormat === 'pdf' ? 'pdf' : exportFormat;
            
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
                    format: exportFormat
                })
            });
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                safeLog('error', 'Failed to generate document for export', { resumeId: item.resume_id, status: response.status, error: errorText });
                return { success: false, error: `PDF generation failed: ${errorText}`, resumeId: item.resume_id };
            }
            
            const buffer = await response.arrayBuffer();
            const fileName = `${candidateName.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_')}.${fileExtension}`;
            
            return { success: true, fileName, buffer, resumeId: item.resume_id };
            
        } catch (err) {
            safeLog('error', 'Error processing resume for export', { resumeId: item.resume_id, error: err.message });
            return { success: false, error: err.message, resumeId: item.resume_id };
        }
    };
    
    // Process all items in parallel
    safeLog('info', 'Starting parallel export processing', { jobId, itemCount: successfulItems.length });
    const results = await Promise.all(successfulItems.map(item => processExportItem(item)));
    
    // Collect results
    for (const result of results) {
        if (result.success) {
            zip.file(result.fileName, result.buffer);
            exportSuccessCount++;
        } else {
            exportErrorCount++;
            exportErrors.push({ resumeId: result.resumeId, error: result.error });
        }
    }
    
    // Log export statistics
    safeLog('info', 'Export processing completed', { 
        jobId, 
        totalItems: successfulItems.length,
        exportSuccessCount, 
        exportErrorCount,
        errors: exportErrors.length > 0 ? exportErrors.slice(0, 5) : undefined // Log first 5 errors
    });
    
    // Check if any files were added
    if (Object.keys(zip.files).length === 0) {
        safeLog('warn', 'No files generated for export', { jobId, exportErrors });
        return;
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

export default {
    initializeWorker,
    startWorker,
    stopWorker
};
