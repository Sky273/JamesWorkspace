/**
 * Batch Jobs Worker - Item Processors
 * Handles processing of individual batch job items (import and improve)
 */

import { safeLog } from '../../utils/logger.backend.js';
import { query } from '../../config/database.js';
import { processAnalysisTags } from '../../utils/tagCleaner.js';
import { ITEM_STATUS, updateJobItemStatus } from '../batchJobs.service.js';
import { parseScore, generateTrigram } from './helpers.js';
import { extractTextFromBuffer } from './textExtraction.js';
import { analyzeResumeWithLLM } from './llmIntegration.js';
import { buildConsentMetadata, sendConsentRequestIfNeeded } from './processors/shared.js';
import { processImprovement, processImproveItem } from './processors/improvement.js';
import { processAdaptItem, processMatchItem, processProfileSearchItem, processProfileAnalysisItem } from './processors/profileAndMatching.js';

export async function processImportItem(item, job, options) {
    const { improve = false } = options;
    const consentMetadata = buildConsentMetadata(options);
    
    safeLog('info', 'Starting import item processing', { 
        itemId: item.id, 
        fileName: item.file_name, 
        improve,
        hasFileData: !!item.file_data,
        fileDataLength: item.file_data?.length,
        mimeType: item.file_mime_type,
        profileType: consentMetadata.profileType,
        hasCandidateName: !!consentMetadata.candidateName,
        hasCandidateEmail: !!consentMetadata.candidateEmail
    });

    // Step 1: Create resume record with file data (like single upload)
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
        item.file_data,
        item.file_data?.length || 0,
        item.file_mime_type || 'application/octet-stream',
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

    await query(
        `UPDATE resumes SET resume_file_url = $1 WHERE id = $2`,
        [`/api/resumes/${resumeId}/download`, resumeId]
    );

    await sendConsentRequestIfNeeded(resumeId, consentMetadata, job.firm_id);

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

    // Step 3: Analyze the CV or use pending data if resuming with provided name
    let analysis;
    let isResumedWithName = false;
    
    // Check if this item is resuming with a manually provided name
    if (item.original_name && item.pending_data) {
        const pendingData = typeof item.pending_data === 'string' ? JSON.parse(item.pending_data) : item.pending_data;
        if (pendingData.analysis) {
            safeLog('info', 'Resuming item with provided name', { 
                itemId: item.id, 
                providedName: item.original_name,
                fileName: item.file_name 
            });
            analysis = pendingData.analysis;
            analysis.name = item.original_name; // Use the manually provided name
            isResumedWithName = true;
        }
    }
    
    // If not resuming, perform normal analysis
    if (!analysis) {
        safeLog('info', 'Analyzing CV with LLM', { itemId: item.id, firmId: job.firm_id, fileName: item.file_name });
        analysis = await analyzeResumeWithLLM(text, job.firm_id, item.file_name);
        safeLog('info', 'CV analyzed', { itemId: item.id, hasAnalysis: !!analysis, globalRating: analysis?.globalRating, name: analysis?.name });
    }

    // Check if name extraction failed - only for new analysis, not resumed items
    // Detect: XXX (new instruction), Candidat (old instruction), or CAN (trigram of Candidat)
    const nameUpper = analysis.name?.toUpperCase()?.trim();
    let isNameExtractionFailed = nameUpper === 'XXX' || nameUpper === 'CANDIDAT' || nameUpper === 'CAN';

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
        
        // Save partial analysis to resume (without name)
        // Process tags to get both raw and cleaned versions
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
            analysis.structuredText || text,
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
        
        // Set item to pending_name status - will be resumed when name is provided
        await updateJobItemStatus(item.id, ITEM_STATUS.PENDING_NAME, { 
            progress: 60,
            error_message: 'En attente du nom du candidat (extraction automatique échouée)',
            pending_analysis: JSON.stringify(analysis),
            pending_text: text,
            pending_improve: improve
        });
        
        // Return early - item will be resumed when name is provided
        return;
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 60 });

    // Step 4: Update resume with analysis
    // Process tags to get both raw and cleaned versions
    const { rawTags, cleanedTags } = processAnalysisTags(analysis);
    
    // Get LLM settings to check if CV should be anonymized
    const { getLLMSettings } = await import('../settings.service.js');
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
        analysis.structuredText || text,
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
        await processImprovement(item, resumeId, text, analysis, job);
    }

    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
    safeLog('info', 'Import item processing completed', { itemId: item.id, resumeId, improved: improve });
}


export {
    processAdaptItem,
    processMatchItem,
    processProfileSearchItem,
    processProfileAnalysisItem,
    processImproveItem
};
