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
const MAX_CONCURRENT_LLM = 20; // Max concurrent LLM requests to avoid rate limits
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

// Track queue health for debugging
let llmQueueStuckCount = 0;
const LLM_QUEUE_STUCK_THRESHOLD = 60000; // 1 minute
let lastLLMActivity = Date.now();

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
 * Generate a trigram from candidate name (first letter of first name + first two letters of last name)
 * Examples: "Jean Dupont" -> "JDU", "Marie Martin" -> "MMA", "Pierre-Louis Durand" -> "PDU"
 * @param {string} name - Full name of the candidate
 * @returns {string} - Trigram in uppercase (3 characters)
 */
function generateTrigram(name) {
    if (!name || typeof name !== 'string') {
        return 'XXX';
    }
    
    // Clean and normalize the name
    const cleanedName = name
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .toUpperCase();
    
    // Split by spaces, hyphens, or other separators
    const parts = cleanedName.split(/[\s\-_.,]+/).filter(p => p.length > 0);
    
    if (parts.length === 0) {
        return 'XXX';
    }
    
    if (parts.length === 1) {
        // Only one part: take first 3 letters
        const single = parts[0];
        return (single.substring(0, 3) + 'XX').substring(0, 3);
    }
    
    // Multiple parts: first letter of first name + first two letters of last name
    const firstName = parts[0];
    const lastName = parts[parts.length - 1]; // Take the last part as surname
    
    const firstInitial = firstName.charAt(0) || 'X';
    const lastInitials = (lastName.substring(0, 2) + 'XX').substring(0, 2);
    
    return firstInitial + lastInitials;
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
    activeLLMRequests = Math.max(0, activeLLMRequests - 1); // Prevent negative count
    lastLLMActivity = Date.now();
    if (llmQueue.length > 0) {
        const next = llmQueue.shift();
        next();
    }
}

/**
 * Reset LLM queue if stuck (called during shutdown or error recovery)
 */
function resetLLMQueue() {
    const queueLength = llmQueue.length;
    const activeCount = activeLLMRequests;
    llmQueue.length = 0; // Clear queue
    activeLLMRequests = 0;
    if (queueLength > 0 || activeCount > 0) {
        safeLog('warn', 'LLM queue reset', { clearedQueue: queueLength, clearedActive: activeCount });
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
    
    // Reset LLM queue to prevent stuck requests
    resetLLMQueue();
    
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

    // Step 1: Create resume record with file data (like single upload)
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 20 });

    const resumeResult = await query(`
        INSERT INTO resumes (
            name, 
            file_name,
            resume_file_data,
            resume_file_size,
            resume_file_type,
            resume_file_url,
            status, 
            firm_id,
            firm_name,
            profile_type,
            consent_status,
            created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING id
    `, [
        item.file_name,
        item.file_name,
        item.file_data,
        item.file_data?.length || 0,
        item.file_mime_type || 'application/octet-stream',
        null, // Will be updated after insert with correct ID
        'processing',
        job.firm_id,
        job.firm_name || null,
        'employee',
        'not_required'
    ]);

    const resumeId = resumeResult.rows[0].id;

    // Update resume_file_url with correct ID (like single upload)
    await query(
        `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
        [`/api/resumes/${resumeId}/download`, resumeId]
    );

    // Update item with resume_id
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { 
        progress: 30,
        resume_id: resumeId 
    });

    // Step 2: Extract text from file
    safeLog('info', 'Extracting text from file', { itemId: item.id, fileName: item.file_name });
    const text = await extractTextFromBuffer(item.file_data, item.file_mime_type, item.file_name);
    
    // Log first 500 chars of extracted text to verify trigrams and names are preserved
    safeLog('debug', 'Text extracted - preview', { 
        itemId: item.id, 
        textLength: text?.length,
        textPreview: text?.substring(0, 500)
    });

    if (!text || text.length < 50) {
        throw new Error('Impossible d\'extraire le texte du CV');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 40 });

    // Step 3: Analyze the CV (pass original filename for name extraction hint)
    safeLog('info', 'Analyzing CV with LLM', { itemId: item.id, firmId: job.firm_id, fileName: item.file_name });
    const analysis = await analyzeResumeWithLLM(text, job.firm_id, item.file_name);
    safeLog('info', 'CV analyzed', { itemId: item.id, hasAnalysis: !!analysis, globalRating: analysis?.globalRating });

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 60 });

    // Step 4: Update resume with analysis
    const tags = analysis.tags || { skills: [], industries: [], tools: [], softSkills: [] };
    
    // Get LLM settings to check if CV should be anonymized
    const { getLLMSettings } = await import('./settings.service.js');
    const llmSettings = await getLLMSettings();
    const isAnonymous = llmSettings.cvMode === 'anonymous';
    
    // Generate trigram only if anonymous mode is enabled, otherwise use full name
    const trigram = isAnonymous ? generateTrigram(analysis.name) : null;
    const displayName = isAnonymous ? trigram : analysis.name;
    safeLog('debug', 'Name handling based on cvMode', { 
        cvMode: llmSettings.cvMode, 
        isAnonymous, 
        originalName: analysis.name, 
        trigram, 
        displayName 
    });

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
            trigram = $16,
            status = 'analyzed',
            analyzed_at = NOW()
        WHERE id = $17
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
        displayName,  // Use trigram in anonymous mode, full name otherwise
        analysis.title,
        trigram,
        resumeId
    ]);

    // Save original name and display name to job item for tracking
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { 
        progress: 70,
        original_name: analysis.name,
        display_name: displayName
    });

    // Step 5: Improve if requested
    if (improve) {
        safeLog('info', 'Improving CV with LLM', { itemId: item.id, resumeId });
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 75 });

        // Use structuredText if available and valid, otherwise fall back to original text
        let textForImprovement = text;
        if (analysis.structuredText && analysis.structuredText.trim().length > 100) {
            textForImprovement = analysis.structuredText;
            safeLog('debug', 'Using structuredText for improvement', { 
                itemId: item.id, 
                structuredTextLength: analysis.structuredText.length 
            });
        } else {
            safeLog('debug', 'Using original text for improvement (structuredText empty or too short)', { 
                itemId: item.id, 
                originalTextLength: text.length,
                structuredTextLength: analysis.structuredText?.length || 0
            });
        }

        let improvedResult;
        const MAX_IMPROVE_RETRIES = 2;
        let lastImproveError = null;
        
        for (let attempt = 1; attempt <= MAX_IMPROVE_RETRIES; attempt++) {
            try {
                safeLog('info', `Improvement attempt ${attempt}/${MAX_IMPROVE_RETRIES}`, { itemId: item.id, resumeId });
                improvedResult = await improveResumeWithLLM(
                    textForImprovement,
                    analysis,
                    job.firm_id
                );
                // Success - break out of retry loop
                break;
            } catch (improveError) {
                lastImproveError = improveError;
                safeLog('warn', `CV improvement attempt ${attempt} failed`, { 
                    itemId: item.id, 
                    resumeId, 
                    attempt,
                    maxRetries: MAX_IMPROVE_RETRIES,
                    error: improveError.message 
                });
                
                // If not last attempt, wait before retrying
                if (attempt < MAX_IMPROVE_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                }
            }
        }
        
        // If all retries failed, throw the last error
        if (!improvedResult && lastImproveError) {
            safeLog('error', 'CV improvement failed after all retries', { 
                itemId: item.id, 
                resumeId, 
                error: lastImproveError.message 
            });
            throw new Error(`Échec de l'amélioration du CV après ${MAX_IMPROVE_RETRIES} tentatives: ${lastImproveError.message}`);
        }

        if (improvedResult && improvedResult.text && improvedResult.text.trim().length > 0) {
            const improvedAnalysis = improvedResult.analysis || {};
            const improvedTags = improvedAnalysis.tags || {};

            safeLog('debug', 'Improved result details', {
                hasText: !!improvedResult.text,
                textLength: improvedResult.text?.length,
                textPreview: improvedResult.text?.substring(0, 150),
                analysisKeys: Object.keys(improvedAnalysis),
                tagsKeys: Object.keys(improvedTags),
                skillsCount: improvedTags.skills?.length,
                industriesCount: improvedTags.industries?.length
            });

            // Parse individual scores
            const skillsScore = parseScore(improvedAnalysis.skillsRating);
            const experienceScore = parseScore(improvedAnalysis.experiencesRating);
            const educationScore = parseScore(improvedAnalysis.educationRating);
            const atsScore = parseScore(improvedAnalysis.atsOptimizationRating);
            const executiveSummaryScore = parseScore(improvedAnalysis.executiveSummaryRating);
            const hobbiesLanguagesScore = parseScore(improvedAnalysis.hobbiesLanguagesRating);

            // Get LLM settings for weights
            const { getLLMSettings } = await import('./settings.service.js');
            const llmSettings = await getLLMSettings();
            
            // Get weights from settings (with defaults)
            const weights = {
                executiveSummary: llmSettings['Executive Summary Weight'] || llmSettings.executiveSummaryWeight || 20,
                skills: llmSettings['Skills Weight'] || llmSettings.skillsWeight || 20,
                experience: llmSettings['Experience Weight'] || llmSettings.experienceWeight || 20,
                education: llmSettings['Education Weight'] || llmSettings.educationWeight || 15,
                ats: llmSettings['ATS Weight'] || llmSettings.atsWeight || 15,
                hobbiesLanguages: llmSettings['Hobbies Languages Weight'] || llmSettings.hobbiesLanguagesWeight || 10
            };
            
            // Normalize weights to ensure they sum to 100
            const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
            
            // Calculate weighted global rating
            const globalRating = Math.round(
                ((executiveSummaryScore || 0) * weights.executiveSummary +
                 (skillsScore || 0) * weights.skills +
                 (experienceScore || 0) * weights.experience +
                 (educationScore || 0) * weights.education +
                 (atsScore || 0) * weights.ats +
                 (hobbiesLanguagesScore || 0) * weights.hobbiesLanguages) / totalWeight
            );
            
            safeLog('debug', 'Calculated improved global rating', {
                weights,
                totalWeight,
                scores: { skillsScore, experienceScore, educationScore, atsScore, executiveSummaryScore, hobbiesLanguagesScore },
                globalRating
            });

            // Name and trigram are already set during initial analysis, no need to recalculate

            safeLog('info', 'Saving improved CV data', { 
                itemId: item.id, 
                resumeId,
                hasImprovedText: !!improvedResult.text,
                improvedGlobalRating: globalRating,
                skillsScore,
                experienceScore,
                educationScore,
                atsScore,
                executiveSummaryScore,
                hobbiesLanguagesScore
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
                globalRating,
                skillsScore,
                experienceScore,
                educationScore,
                atsScore,
                executiveSummaryScore,
                hobbiesLanguagesScore,
                JSON.stringify(improvedTags.skills || []),
                JSON.stringify(improvedTags.industries || []),
                JSON.stringify(improvedTags.tools || []),
                JSON.stringify(improvedTags.softSkills || []),
                JSON.stringify(improvedAnalysis.suggestions || {}),
                resumeId
            ]);

            safeLog('info', 'CV improvement saved successfully', { itemId: item.id, resumeId });
        } else {
            // Improvement returned empty text - this should not happen after the try-catch above
            // but we handle it as a safety net
            safeLog('error', 'Improvement returned empty or no result after successful call', { 
                itemId: item.id, 
                resumeId,
                hasResult: !!improvedResult,
                hasText: !!improvedResult?.text,
                textLength: improvedResult?.text?.length || 0
            });
            
            // Throw error to mark item as failed
            throw new Error('L\'amélioration a retourné un texte vide. Le CV n\'a pas pu être amélioré.');
        }
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
    safeLog('info', 'Import item processing completed', { itemId: item.id, resumeId, improved: improve });
}

/**
 * Process an improve item (improve existing resume)
 */
async function processImproveItem(item, job, _options) {
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

    // Improve the resume with retry mechanism
    let improvedResult;
    const MAX_IMPROVE_RETRIES = 2;
    let lastImproveError = null;
    
    for (let attempt = 1; attempt <= MAX_IMPROVE_RETRIES; attempt++) {
        try {
            safeLog('info', `Improvement attempt ${attempt}/${MAX_IMPROVE_RETRIES} (improve job)`, { 
                itemId: item.id, 
                resumeId: item.resume_id 
            });
            improvedResult = await improveResumeWithLLM(text, analysis, job.firm_id);
            // Success - break out of retry loop
            break;
        } catch (improveError) {
            lastImproveError = improveError;
            safeLog('warn', `CV improvement attempt ${attempt} failed (improve job)`, { 
                itemId: item.id, 
                resumeId: item.resume_id, 
                attempt,
                maxRetries: MAX_IMPROVE_RETRIES,
                error: improveError.message 
            });
            
            // If not last attempt, wait before retrying
            if (attempt < MAX_IMPROVE_RETRIES) {
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
            }
        }
    }
    
    // If all retries failed, throw the last error
    if (!improvedResult && lastImproveError) {
        safeLog('error', 'CV improvement failed after all retries (improve job)', { 
            itemId: item.id, 
            resumeId: item.resume_id, 
            error: lastImproveError.message 
        });
        throw new Error(`Échec de l'amélioration du CV après ${MAX_IMPROVE_RETRIES} tentatives: ${lastImproveError.message}`);
    }

    // Validate that we have actual improved text
    if (!improvedResult || !improvedResult.text || improvedResult.text.trim().length === 0) {
        safeLog('error', 'Improvement returned empty result (improve job)', { 
            itemId: item.id, 
            resumeId: item.resume_id,
            hasResult: !!improvedResult,
            hasText: !!improvedResult?.text,
            textLength: improvedResult?.text?.length || 0
        });
        throw new Error('L\'amélioration a retourné un texte vide. Le CV n\'a pas pu être amélioré.');
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 80 });

    // Update resume with improved data
    const improvedAnalysis = improvedResult.analysis || {};
    const improvedTags = improvedAnalysis.tags || {};

    // Parse individual scores
    const skillsScore = parseScore(improvedAnalysis.skillsRating);
    const experienceScore = parseScore(improvedAnalysis.experiencesRating);
    const educationScore = parseScore(improvedAnalysis.educationRating);
    const atsScore = parseScore(improvedAnalysis.atsOptimizationRating);
    const executiveSummaryScore = parseScore(improvedAnalysis.executiveSummaryRating);
    const hobbiesLanguagesScore = parseScore(improvedAnalysis.hobbiesLanguagesRating);

    // Get LLM settings for weights
    const { getLLMSettings } = await import('./settings.service.js');
    const llmSettings = await getLLMSettings();
    
    // Get weights from settings (with defaults)
    const weights = {
        executiveSummary: llmSettings['Executive Summary Weight'] || llmSettings.executiveSummaryWeight || 20,
        skills: llmSettings['Skills Weight'] || llmSettings.skillsWeight || 20,
        experience: llmSettings['Experience Weight'] || llmSettings.experienceWeight || 20,
        education: llmSettings['Education Weight'] || llmSettings.educationWeight || 15,
        ats: llmSettings['ATS Weight'] || llmSettings.atsWeight || 15,
        hobbiesLanguages: llmSettings['Hobbies Languages Weight'] || llmSettings.hobbiesLanguagesWeight || 10
    };
    
    // Normalize weights to ensure they sum to 100
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    
    // Calculate weighted global rating
    const globalRating = Math.round(
        ((executiveSummaryScore || 0) * weights.executiveSummary +
         (skillsScore || 0) * weights.skills +
         (experienceScore || 0) * weights.experience +
         (educationScore || 0) * weights.education +
         (atsScore || 0) * weights.ats +
         (hobbiesLanguagesScore || 0) * weights.hobbiesLanguages) / totalWeight
    );
    
    safeLog('debug', 'Calculated improved global rating (improve job)', {
        weights,
        totalWeight,
        scores: { skillsScore, experienceScore, educationScore, atsScore, executiveSummaryScore, hobbiesLanguagesScore },
        globalRating
    });

    // Name and trigram are already set during initial analysis, no need to recalculate

    safeLog('info', 'Saving improved CV data (improve job)', { 
        itemId: item.id, 
        resumeId: item.resume_id,
        hasImprovedText: !!improvedResult.text,
        improvedGlobalRating: globalRating,
        skillsScore,
        experienceScore,
        educationScore,
        atsScore,
        executiveSummaryScore,
        hobbiesLanguagesScore
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
        globalRating,
        skillsScore,
        experienceScore,
        educationScore,
        atsScore,
        executiveSummaryScore,
        hobbiesLanguagesScore,
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
 * Extract text from PDF using pdfjs-dist (more reliable than pdf-parse)
 * Improved to better preserve structure, trigrams, and candidate names
 */
async function extractTextFromPDFBuffer(buffer) {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    
    // Convert Buffer to Uint8Array (required by pdfjs-dist)
    const uint8Array = new Uint8Array(buffer);
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page with improved structure preservation
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Group text items by their vertical position (Y coordinate) to preserve lines
        const lines = [];
        let currentLine = [];
        let lastY = null;
        const Y_THRESHOLD = 5; // Pixels threshold to consider same line
        
        for (const item of textContent.items) {
            const y = item.transform ? item.transform[5] : 0;
            
            // If Y position changed significantly, start a new line
            if (lastY !== null && Math.abs(y - lastY) > Y_THRESHOLD) {
                if (currentLine.length > 0) {
                    lines.push(currentLine);
                    currentLine = [];
                }
            }
            
            // Add item to current line (preserve the text as-is, including trigrams)
            if (item.str && item.str.trim()) {
                currentLine.push(item.str);
            }
            lastY = y;
        }
        
        // Don't forget the last line
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        // Join items within each line with space, join lines with newline
        const pageText = lines
            .map(line => line.join(' '))
            .join('\n');
        
        fullText += pageText + '\n\n';
    }
    
    // Clean up excessive whitespace while preserving structure
    fullText = fullText
        .replace(/[ \t]+/g, ' ')           // Multiple spaces to single space
        .replace(/\n{3,}/g, '\n\n')        // Max 2 consecutive newlines
        .trim();
    
    return fullText;
}

/**
 * Extract text from file buffer
 */
async function extractTextFromBuffer(buffer, mimeType, fileName) {
    // Use pdfjs-dist for PDF, mammoth for DOCX, word-extractor for DOC
    if (mimeType === 'application/pdf') {
        try {
            return await extractTextFromPDFBuffer(buffer);
        } catch (pdfError) {
            safeLog('error', 'PDF extraction with pdfjs-dist failed', { error: pdfError.message, fileName });
            throw new Error(`Failed to extract text from PDF: ${pdfError.message}`);
        }
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const mammoth = await import('mammoth');
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    } else if (mimeType === 'application/msword') {
        // word-extractor is CommonJS
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        const WordExtractor = require('word-extractor');
        const extractor = new WordExtractor();
        const doc = await extractor.extract(buffer);
        return doc.getBody();
    }
    throw new Error(`Unsupported file type: ${mimeType}`);
}

/**
 * Analyze a resume using the LLM (with rate limiting)
 * @param {string} text - Resume text to analyze
 * @param {string} _firmId - Firm ID (unused but kept for API consistency)
 * @param {string} originalFileName - Original file name for name extraction hint
 */
async function analyzeResumeWithLLM(text, _firmId, originalFileName = null) {
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
        // Analyze with original filename for name extraction hint
        analysis = await analyzeResume(cleanedText, model, analysisPrompt, null, false, originalFileName);
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
async function improveResumeWithLLM(text, analysis, _firmId) {
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
    let improveResult;
    try {
        // improveResume returns { text, analysis } object
        improveResult = await improveResume(cleanedText, analysis, model, improvementPrompt, null);
    } finally {
        releaseLLMSlot();
    }

    // Extract the actual text from the result (improveResume returns { text, analysis })
    const improvedText = typeof improveResult === 'string' ? improveResult : improveResult?.text;
    
    // Validate that we have actual content (not null, undefined, or empty string)
    if (!improvedText || improvedText.trim().length === 0) {
        throw new Error('L\'amélioration LLM a retourné un texte vide. Le CV n\'a pas pu être amélioré.');
    }

    safeLog('debug', 'Improvement result received', {
        resultType: typeof improveResult,
        hasText: !!improvedText,
        textLength: improvedText?.length,
        textPreview: improvedText?.substring(0, 100)
    });

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

    safeLog('debug', 'Post-improvement analysis completed', {
        hasAnalysis: !!improvedAnalysis,
        globalRating: improvedAnalysis?.globalRating,
        skillsRating: improvedAnalysis?.skillsRating,
        experiencesRating: improvedAnalysis?.experiencesRating,
        hasTags: !!improvedAnalysis?.tags,
        tagsKeys: improvedAnalysis?.tags ? Object.keys(improvedAnalysis.tags) : []
    });

    return {
        text: improvedText,
        analysis: improvedAnalysis
    };
}

/**
 * Generate export ZIP for a completed job
 * @param {string} jobId - Job ID
 * @param {Object} options - Export options (templateId, exportFormats)
 */
async function generateJobExport(jobId, options) {
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
    
    // Get successful items with resume_id
    const successfulItems = items.filter(item => item.status === 'success' && item.resume_id);
    const successWithoutResumeId = items.filter(item => item.status === 'success' && !item.resume_id);
    
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
    
    // Create folders for each format in the ZIP
    const formatFolders = {};
    for (const format of exportFormats) {
        formatFolders[format] = zip.folder(format.toUpperCase());
    }
    
    // Get template name for file naming
    const templateName = (template.name || 'Template').replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');
    
    // Process single item for a specific format
    const processExportItemForFormat = async (item, format) => {
        try {
            // Fetch resume
            const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [item.resume_id]);
            if (resumeResult.rows.length === 0) {
                return { success: false, error: 'Resume not found in database', resumeId: item.resume_id, format };
            }
            
            const resume = resumeResult.rows[0];
            const content = resume.improved_text || resume.original_text || '';
            
            if (!content || content.trim().length === 0) {
                return { success: false, error: 'Resume has no content', resumeId: item.resume_id, format };
            }
            
            const candidateName = resume.name || 'Candidat';
            const candidateTitle = resume.title || '';
            // Use trigram if available, otherwise fallback to candidate name
            const trigram = resume.trigram || candidateName.replace(/[^a-zA-Z0-9]/g, '').substring(0, 3).toUpperCase();
            
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
            
            // Generate document via PDF server with retry
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
                            safeLog('warn', `${format.toUpperCase()} generation failed, retrying...`, { resumeId: item.resume_id, attempt, error: lastError });
                            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
                            continue;
                        }
                        safeLog('error', `Failed to generate ${format.toUpperCase()} for export after retries`, { resumeId: item.resume_id, attempts: MAX_RETRIES, error: lastError });
                        return { success: false, error: lastError, resumeId: item.resume_id, format };
                    }
                    
                    const buffer = await response.arrayBuffer();
                    // File name format: trigramme_nom_modèle.extension
                    const fileName = `${trigram}_${templateName}.${fileExtension}`;
                    
                    // Include relative_path for preserving folder structure
                    return { success: true, fileName, buffer, resumeId: item.resume_id, format, relativePath: item.relative_path };
                } catch (fetchErr) {
                    lastError = fetchErr.message;
                    if (attempt < MAX_RETRIES) {
                        safeLog('warn', `${format.toUpperCase()} fetch error, retrying...`, { resumeId: item.resume_id, attempt, error: lastError });
                        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        continue;
                    }
                }
            }
            
            return { success: false, error: lastError || 'Unknown error after retries', resumeId: item.resume_id, format };
            
        } catch (err) {
            safeLog('error', `Error processing resume for ${format.toUpperCase()} export`, { resumeId: item.resume_id, error: err.message });
            return { success: false, error: err.message, resumeId: item.resume_id, format };
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
                    
                    // Add to the format-specific folder (JSZip handles nested paths automatically)
                    safeLog('debug', 'Adding file to ZIP', { format, filePath });
                    formatFolders[format].file(filePath, result.buffer);
                    exportSuccessCount++;
                } else {
                    exportErrorCount++;
                    exportErrors.push({ resumeId: result.resumeId, format: result.format, error: result.error });
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
