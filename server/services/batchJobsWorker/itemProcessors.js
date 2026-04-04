/**
 * Batch Jobs Worker - Item Processors
 * Handles processing of individual batch job items (import and improve)
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import { processAnalysisTags } from '../../utils/tagCleaner.js';
import { ITEM_STATUS } from '../batchJobs/constants.js';
import { updateJobItemStatus, getJobItemFilePayload, clearJobItemFileData } from '../batchJobs/itemCrud.js';
import { parseScore, generateTrigram } from './helpers.js';
import { extractTextFromBuffer } from './textExtraction.js';
import { analyzeResumeWithLLM, preAnalyzeResumeWithLLM } from './llmIntegration.js';
import { cleanExtractedResumeText, isPlaceholderCandidateName } from '../ocrTextCleanup.service.js';
import { buildConsentMetadata, sendConsentRequestIfNeeded } from './processors/shared.js';
import { processImprovement, processImproveItem } from './processors/improvement.js';
import { processAdaptItem, processMatchItem, processProfileSearchItem, processProfileAnalysisItem } from './processors/profileAndMatching.js';
import { metrics } from '../metrics.service.js';
import { getLLMSettings } from '../settings.service.js';

function buildOcrMetricsMetadata(extractionResult, baseMetadata = {}) {
    return {
        ...baseMetadata,
        engine: extractionResult?.primaryResult?.engine || null,
        variant: extractionResult?.primaryResult?.variant || null,
        psm: extractionResult?.primaryResult?.psm || null,
        textLength: extractionResult?.primaryResult?.textLength || 0,
        recentResults: Array.isArray(extractionResult?.recentResults)
            ? extractionResult.recentResults.slice(-5)
            : []
    };
}

export async function processImportItem(item, job, options) {
    const { improve = false } = options;
    const consentMetadata = buildConsentMetadata(options);
    const startedAt = Date.now();
    const filePayload = item.file_data ? {
        file_data: item.file_data,
        file_mime_type: item.file_mime_type
    } : await getJobItemFilePayload(item.id);

    if (!filePayload?.file_data) {
        throw new Error('Fichier source du batch introuvable');
    }

    let fileBuffer = filePayload.file_data;
    const mimeType = filePayload.file_mime_type || item.file_mime_type || 'application/octet-stream';
    const fileSize = fileBuffer.length || 0;
    let currentStage = 'create-resume';
    
    metrics.trackBatchImportActivity({
        event: 'run',
        mimeType,
        fileSize,
        improvementRequestedRuns: improve ? 1 : 0,
        metadata: {
            source: 'batch-job',
            itemId: item.id,
            jobId: job.id
        }
    });

    safeLog('info', 'Starting import item processing', { 
        itemId: item.id, 
        fileName: item.file_name, 
        improve,
        hasFileData: !!fileBuffer,
        fileDataLength: fileBuffer.length,
        mimeType,
        profileType: consentMetadata.profileType,
        hasCandidateName: !!consentMetadata.candidateName,
        hasCandidateEmail: !!consentMetadata.candidateEmail
    });

    try {
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 20 });

        const resumeResult = await query(`
            INSERT INTO resumes (
                name, 
                file_name,
                relative_path,
                resume_file_data,
                resume_file_size,
                resume_file_type,
                resume_file_url,
                status, 
                firm_id,
                firm_name,
                profile_type,
                candidate_name,
                candidate_email,
                consent_status,
                consent_token,
                consent_token_expires_at,
                consent_requested_at,
                retention_until,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
            RETURNING id
        `, [
            consentMetadata.candidateName || item.file_name,
            item.file_name,
            item.relative_path || null,
            fileBuffer,
            fileBuffer.length || 0,
            mimeType,
            null,
            'processing',
            job.firm_id,
            job.firm_name || null,
            consentMetadata.profileType,
            consentMetadata.candidateName,
            consentMetadata.candidateEmail,
            consentMetadata.consentStatus,
            consentMetadata.consentToken,
            consentMetadata.consentTokenExpiresAt,
            consentMetadata.consentRequestedAt,
            consentMetadata.retentionUntil
        ]);

        const resumeId = resumeResult.rows[0].id;

        metrics.trackBatchImportActivity({
            event: 'resume-created',
            mimeType,
            resumeRecordsCreated: 1,
            metadata: {
                source: 'batch-job',
                itemId: item.id,
                jobId: job.id,
                resumeId
            }
        });

        await query(
            `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
            [`/api/resumes/${resumeId}/download`, resumeId]
        );

        await sendConsentRequestIfNeeded(resumeId, consentMetadata, job.firm_id);

        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
            progress: 30,
            resume_id: resumeId
        });

        currentStage = 'extract-text';
        safeLog('info', 'Extracting text from file', { itemId: item.id, fileName: item.file_name });
        const extractionStartedAt = Date.now();
        const extractionResult = await extractTextFromBuffer(fileBuffer, mimeType, item.file_name);
        fileBuffer = null;
        const rawText = extractionResult?.text || '';
        const { text, metadata: textCleanupMetadata } = cleanExtractedResumeText(rawText, {
            ocrUsed: !!extractionResult?.ocrUsed
        });
        metrics.trackBatchImportActivity({
            event: 'extract-text',
            mimeType,
            textExtractionRuns: 1,
            extractedChars: text?.length || 0,
            durationMs: Date.now() - extractionStartedAt,
            metadata: {
                source: 'batch-job',
                itemId: item.id,
                jobId: job.id,
                resumeId
            }
        });

        if (extractionResult?.ocrUsed || extractionResult?.ocrPageCount || extractionResult?.failedOcrPages) {
            metrics.trackOcrActivity({
                pages: extractionResult?.pages || 0,
                ocrPageCount: extractionResult?.ocrPageCount || 0,
                failedPages: extractionResult?.failedOcrPages || 0,
                avgConfidence: extractionResult?.avgOcrConfidence ?? null,
                extractionTimeMs: Date.now() - extractionStartedAt,
                success: (extractionResult?.ocrUsed && !extractionResult?.failedOcrPages) || false,
                metadata: buildOcrMetricsMetadata(extractionResult, {
                    source: 'batch-job',
                    itemId: item.id,
                    jobId: job.id,
                    resumeId,
                    fileName: item.file_name
                })
            });
        }

        safeLog('debug', 'Text extracted - preview', {
            itemId: item.id,
            textLength: text?.length,
            textPreview: text?.substring(0, 500),
            ocrUsed: !!extractionResult?.ocrUsed,
            textCleanupChanged: textCleanupMetadata.changed,
            cleanedLength: textCleanupMetadata.cleanedLength
        });

        if (!text || text.length < 50) {
            throw new Error('Impossible d\'extraire le texte du CV');
        }

        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 40 });

        const llmSettings = await getLLMSettings();
        const originalExtractedText = text;
        let analysisInputText = originalExtractedText;

        if (llmSettings.preAnalysisEnabled) {
            currentStage = 'pre-analyze';
            await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 50 });
            safeLog('info', 'Pre-analyzing extracted CV text with LLM', { itemId: item.id, resumeId, fileName: item.file_name });
            const preAnalyzedText = await preAnalyzeResumeWithLLM(text, job.firm_id, item.file_name);
            if (!preAnalyzedText || preAnalyzedText.trim().length < 50) {
                throw new Error('La pre-analyse du CV a retourne un texte inexploitable');
            }
            analysisInputText = preAnalyzedText.trim();
        }

        currentStage = 'analyze';
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 60 });
        let analysis;
        let isResumedWithName = false;

        if (item.original_name && item.pending_data) {
            const pendingData = typeof item.pending_data === 'string' ? JSON.parse(item.pending_data) : item.pending_data;
            if (pendingData.analysis) {
                safeLog('info', 'Resuming item with provided name', {
                    itemId: item.id,
                    providedName: item.original_name,
                    fileName: item.file_name
                });
                analysis = pendingData.analysis;
                analysis.name = item.original_name;
                isResumedWithName = true;
            }
        }

        if (!analysis) {
            safeLog('info', 'Analyzing CV with LLM', { itemId: item.id, firmId: job.firm_id, fileName: item.file_name });
            analysis = await analyzeResumeWithLLM(analysisInputText, job.firm_id, item.file_name, {
                ocrUsed: !!extractionResult?.ocrUsed
            });
            metrics.trackBatchImportActivity({
                event: 'analyze',
                mimeType,
                analysisRuns: 1,
                metadata: {
                    source: 'batch-job',
                    itemId: item.id,
                    jobId: job.id,
                    resumeId
                }
            });
            safeLog('info', 'CV analyzed', { itemId: item.id, hasAnalysis: !!analysis, globalRating: analysis?.globalRating, name: analysis?.name });
        }

        let isNameExtractionFailed = isPlaceholderCandidateName(analysis.name);

        if (!isResumedWithName && isNameExtractionFailed && consentMetadata.candidateName) {
            analysis.name = consentMetadata.candidateName;
            isNameExtractionFailed = false;
            safeLog('info', 'Using candidate name provided at upload as analysis fallback', {
                itemId: item.id,
                resumeId,
                fallbackName: consentMetadata.candidateName
            });
        }

        if (!isResumedWithName && isNameExtractionFailed) {
            safeLog('warn', 'Name extraction failed - pausing item for manual input', {
                itemId: item.id,
                fileName: item.file_name,
                resumeId
            });

            const { rawTags: pendingRawTags, cleanedTags: pendingCleanedTags } = processAnalysisTags(analysis);
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
                    skills_cleaned = $13,
                    industries_cleaned = $14,
                    tools_cleaned = $15,
                    soft_skills_cleaned = $16,
                    key_improvements = $17,
                    title = $18,
                    status = 'pending_name',
                    analyzed_at = NOW()
                WHERE id = $19
            `, [
                originalExtractedText,
                parseScore(analysis.globalRating),
                parseScore(analysis.skillsRating),
                parseScore(analysis.experiencesRating),
                parseScore(analysis.educationRating),
                parseScore(analysis.atsOptimizationRating),
                parseScore(analysis.executiveSummaryRating),
                parseScore(analysis.hobbiesLanguagesRating),
                JSON.stringify(pendingRawTags.skills),
                JSON.stringify(pendingRawTags.industries),
                JSON.stringify(pendingRawTags.tools),
                JSON.stringify(pendingRawTags.softSkills),
                JSON.stringify(pendingCleanedTags.skills),
                JSON.stringify(pendingCleanedTags.industries),
                JSON.stringify(pendingCleanedTags.tools),
                JSON.stringify(pendingCleanedTags.softSkills),
                JSON.stringify(analysis.suggestions || {}),
                analysis.title,
                resumeId
            ]);

            await updateJobItemStatus(item.id, ITEM_STATUS.PENDING_NAME, {
                progress: 60,
                error_message: 'En attente du nom du candidat (extraction automatique échouée)',
                pending_analysis: JSON.stringify(analysis),
                pending_text: analysisInputText,
                pending_improve: improve
            });

            metrics.trackBatchImportActivity({
                event: 'pending-name',
                mimeType,
                pendingNameRuns: 1,
                durationMs: Date.now() - startedAt,
                metadata: {
                    source: 'batch-job',
                    itemId: item.id,
                    jobId: job.id,
                    resumeId
                }
            });
            await clearJobItemFileData(item.id);
            return;
        }

        currentStage = 'persist-analysis';
        const { rawTags, cleanedTags } = processAnalysisTags(analysis);

        const isAnonymous = llmSettings.cvMode === 'anonymous';

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
                skills_cleaned = $13,
                industries_cleaned = $14,
                tools_cleaned = $15,
                soft_skills_cleaned = $16,
                key_improvements = $17,
                name = COALESCE($18, name),
                title = $19,
                trigram = $20,
                status = 'analyzed',
                analyzed_at = NOW()
            WHERE id = $21
        `, [
                originalExtractedText,
            parseScore(analysis.globalRating),
            parseScore(analysis.skillsRating),
            parseScore(analysis.experiencesRating),
            parseScore(analysis.educationRating),
            parseScore(analysis.atsOptimizationRating),
            parseScore(analysis.executiveSummaryRating),
            parseScore(analysis.hobbiesLanguagesRating),
            JSON.stringify(rawTags.skills),
            JSON.stringify(rawTags.industries),
            JSON.stringify(rawTags.tools),
            JSON.stringify(rawTags.softSkills),
            JSON.stringify(cleanedTags.skills),
            JSON.stringify(cleanedTags.industries),
            JSON.stringify(cleanedTags.tools),
            JSON.stringify(cleanedTags.softSkills),
            JSON.stringify(analysis.suggestions || {}),
            displayName,
            analysis.title,
            trigram,
            resumeId
        ]);

        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, {
            progress: 70,
            original_name: analysis.name,
            display_name: displayName
        });

        if (improve) {
            currentStage = 'improve';
            await processImprovement(item, resumeId, analysisInputText, analysis, job);
        }

        await clearJobItemFileData(item.id);
        await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
        metrics.trackBatchImportActivity({
            event: 'completed',
            mimeType,
            successfulRuns: 1,
            durationMs: Date.now() - startedAt,
            metadata: {
                source: 'batch-job',
                itemId: item.id,
                jobId: job.id,
                resumeId,
                improved: improve
            }
        });
        safeLog('info', 'Import item processing completed', { itemId: item.id, resumeId, improved: improve });
    } catch (error) {
        metrics.trackBatchImportActivity({
            event: currentStage === 'extract-text' ? 'extract-failed' : 'failed',
            mimeType,
            textExtractionFailures: currentStage === 'extract-text' ? 1 : 0,
            failedRuns: 1,
            durationMs: Date.now() - startedAt,
            stage: currentStage,
            metadata: {
                source: 'batch-job',
                itemId: item.id,
                jobId: job.id,
                error: error.message
            }
        });
        throw error;
    }
}


export {
    processAdaptItem,
    processMatchItem,
    processProfileSearchItem,
    processProfileAnalysisItem,
    processImproveItem
};
