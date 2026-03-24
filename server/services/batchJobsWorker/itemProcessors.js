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
import { analyzeResumeWithLLM, improveResumeWithLLM } from './llmIntegration.js';
import crypto from 'crypto';
import { markConsentError, sendConsentRequest } from '../consent.service.js';

/**
 * Process an import item (upload + analyze + optionally improve)
 */
function normalizeProfileType(profileType) {
    return profileType === 'employee' ? 'employee' : 'external';
}

function buildConsentMetadata(options = {}) {
    const profileType = normalizeProfileType(options.profileType);
    const candidateName = typeof options.candidateName === 'string' && options.candidateName.trim().length > 0
        ? options.candidateName.trim()
        : null;
    const candidateEmail = profileType === 'external' && typeof options.candidateEmail === 'string' && options.candidateEmail.trim().length > 0
        ? options.candidateEmail.trim()
        : null;
    const consentStatus = profileType === 'employee' ? 'not_required' : 'pending_consent';
    const consentToken = profileType === 'external' ? crypto.randomBytes(32).toString('hex') : null;
    const consentTokenExpiresAt = profileType === 'external'
        ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        : null;
    const consentRequestedAt = profileType === 'external' ? new Date() : null;
    const retentionUntil = profileType === 'employee'
        ? null
        : new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);

    return {
        profileType,
        candidateName,
        candidateEmail,
        consentStatus,
        consentToken,
        consentTokenExpiresAt,
        consentRequestedAt,
        retentionUntil
    };
}

async function sendConsentRequestIfNeeded(resumeId, consentMetadata, firmId) {
    if (consentMetadata.profileType !== 'external' || !consentMetadata.candidateEmail || !firmId) {
        return;
    }

    try {
        await sendConsentRequest(resumeId);
    } catch (error) {
        safeLog('error', 'Failed to send GDPR consent email for batch import', {
            resumeId,
            firmId,
            error: error.message
        });
        await markConsentError(resumeId).catch(markError => {
            safeLog('error', 'Failed to mark consent email error for batch import', {
                resumeId,
                firmId,
                error: markError.message
            });
        });
    }
}
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

/**
 * Process improvement for an import item or standalone improve item
 */
async function processImprovement(item, resumeId, text, analysis, job) {
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
                job.firm_id,
                item.file_name
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
        await saveImprovedData(item, resumeId, improvedResult);
    } else {
        safeLog('error', 'Improvement returned empty or no result after successful call', { 
            itemId: item.id, 
            resumeId,
            hasResult: !!improvedResult,
            hasText: !!improvedResult?.text,
            textLength: improvedResult?.text?.length || 0
        });
        
        throw new Error('L\'amélioration a retourné un texte vide. Le CV n\'a pas pu être amélioré.');
    }
}

/**
 * Save improved resume data to database
 */
async function saveImprovedData(item, resumeId, improvedResult) {
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
    const { getLLMSettings } = await import('../settings.service.js');
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
}

/**
 * Process an improve item (improve existing resume)
 */
export async function processImproveItem(item, job, _options) {
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
            improvedResult = await improveResumeWithLLM(text, analysis, job.firm_id, item.file_name);
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

    // Save improved data (reuse the same function)
    await saveImprovedData(item, item.resume_id, improvedResult);

    safeLog('info', 'Improve item processing completed', { itemId: item.id, resumeId: item.resume_id });
    await updateJobItemStatus(item.id, ITEM_STATUS.PROCESSING, { progress: 95 });
}
