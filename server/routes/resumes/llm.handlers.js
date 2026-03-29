/**
 * LLM-related route handlers for resumes (PostgreSQL)
 * Handles analyze, improve, match, and adapt operations
 */

import { findResumeRecord, findMissionRecord, createAdaptation, updateResume } from '../../services/resumes.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { analyzeResume, improveResume, matchResumeWithMission, adaptResumeToMission, cleanupText } from '../../services/openai.service.js';
import { getRequestMetadata } from '../../services/security.service.js';
import { getLLMSettings, calculateWeightedGlobalRating } from '../../services/settings.service.js';
import { getAcceptedIndustriesString, getIndustryMappingString } from '../../services/industry.service.js';
import { DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_ANALYSIS_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } from '../../config/prompts.backend.js';
import { generateTrigram } from '../../utils/trigram.js';
import { mapResumeToFrontend } from './helpers.js';
import { createVersion, hasImprovedTextChanged } from '../../services/resumeVersions.service.js';


/**
 * Handle LLM errors consistently
 */
function handleLLMError(error, res, operation) {
    safeLog('error', `Error ${operation}`, { error: error.message, status: error.response?.status });
    const statusCode = error.response?.status || 500;
    const errorMessage = error.estimatedTokens 
        ? { error: error.message, estimatedTokens: error.estimatedTokens }
        : { error: error.response?.data?.error || error.message || `Failed to ${operation}` };
    res.status(statusCode).json(errorMessage);
}

function parseScoreValue(value) {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : 0;
    const parsed = parseInt(String(value).replace('%', '').trim(), 10);
    return Number.isNaN(parsed) ? 0 : parsed;
}

function hasSuggestionContent(suggestions) {
    if (!suggestions || typeof suggestions !== 'object') return false;
    return Object.values(suggestions).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value));
}

function stringifyJsonField(value, fallback = null) {
    if (value === undefined) return undefined;
    if (value === null) return fallback;
    return JSON.stringify(value);
}

function extractSummaryText(analysis) {
    const summary = analysis?.summary ?? analysis?.Summary;
    if (typeof summary === 'string') {
        return summary.trim() || null;
    }
    if (summary && typeof summary === 'object') {
        const highlights = Array.isArray(summary.profileHighlights) ? summary.profileHighlights.filter(Boolean).map(String) : [];
        if (highlights.length > 0) {
            return highlights.join(' ');
        }
    }
    return null;
}

function buildImprovementVersionPayload(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    return {
        improvedText,
        scores: {
            improvedGlobalRating: parseScoreValue(analysis?.globalRating || analysis?.['Global Rating']),
            improvedSkillsScore: parseScoreValue(analysis?.skillsRating || analysis?.['Skills']),
            improvedExperienceScore: parseScoreValue(analysis?.experiencesRating || analysis?.['Experience']),
            improvedEducationScore: parseScoreValue(analysis?.educationRating || analysis?.['Education']),
            improvedAtsScore: parseScoreValue(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']),
            improvedExecutiveSummaryScore: parseScoreValue(analysis?.executiveSummaryRating || analysis?.['Executive Summary']),
            improvedHobbiesLanguagesScore: parseScoreValue(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages'])
        },
        tags: {
            improvedSkills: improvedTags.skills || [],
            improvedIndustries: improvedTags.industries || [],
            improvedTools: improvedTags.tools || [],
            improvedSoftSkills: improvedTags.softSkills || []
        },
        keyImprovements: JSON.stringify(analysis?.suggestions || {})
    };
}

function buildImprovedResumeUpdateData(improvedText, analysis) {
    const improvedTags = analysis?.tags || {};
    const summaryText = extractSummaryText(analysis);
    return {
        improved_text: improvedText,
        improved_global_rating: parseScoreValue(analysis?.globalRating || analysis?.['Global Rating']),
        improved_skills_score: parseScoreValue(analysis?.skillsRating || analysis?.['Skills']),
        improved_experience_score: parseScoreValue(analysis?.experiencesRating || analysis?.['Experience']),
        improved_education_score: parseScoreValue(analysis?.educationRating || analysis?.['Education']),
        improved_ats_score: parseScoreValue(analysis?.atsOptimizationRating || analysis?.['ATS Compatibility']),
        improved_executive_summary_score: parseScoreValue(analysis?.executiveSummaryRating || analysis?.['Executive Summary']),
        improved_hobbies_languages_score: parseScoreValue(analysis?.hobbiesLanguagesRating || analysis?.['Hobbies Languages']),
        improved_skills: JSON.stringify(improvedTags.skills || []),
        improved_industries: JSON.stringify(improvedTags.industries || []),
        improved_tools: JSON.stringify(improvedTags.tools || []),
        improved_soft_skills: JSON.stringify(improvedTags.softSkills || []),
        improved_key_improvements: JSON.stringify(analysis?.suggestions || {}),
        improvement_suggestions: JSON.stringify(analysis?.suggestions || {}),
        analysis_details: analysis,
        summary: summaryText ?? undefined,
        title: analysis?.title || analysis?.Title || undefined,
        experience_years: analysis?.experienceYears ?? analysis?.experience_years,
        education_level: analysis?.educationLevel ?? analysis?.education_level,
        certifications: stringifyJsonField(analysis?.certifications),
        languages: stringifyJsonField(analysis?.languages),
        status: 'improved',
        improvement_date: new Date()
    };
}

async function persistPostImprovementAnalysis({
    resumeId,
    improvedText,
    model,
    settings,
    acceptedIndustries,
    anonymizationRules,
    originalFileName,
    userMetadata,
    userId,
    shouldCreateVersion
}) {
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    let postImprovementAnalysis = await analyzeResume(
        cleanupText(improvedText),
        model,
        analysisPrompt,
        userMetadata,
        true,
        originalFileName || null
    );

    postImprovementAnalysis = await calculateWeightedGlobalRating(postImprovementAnalysis, settings);
    const updatedRecord = await updateResume(
        resumeId,
        buildImprovedResumeUpdateData(improvedText, postImprovementAnalysis)
    );

    let createdVersionNumber = null;
    if (shouldCreateVersion) {
        const versionPayload = buildImprovementVersionPayload(improvedText, postImprovementAnalysis);
        const versionData = await createVersion({
            resumeId,
            improvedText: versionPayload.improvedText,
            scores: versionPayload.scores,
            tags: versionPayload.tags,
            keyImprovements: versionPayload.keyImprovements,
            userId,
            changeReason: 'initial_improvement'
        });
        createdVersionNumber = versionData.versionNumber;
    }

    safeLog('info', 'Post-improvement analysis saved', {
        resumeId,
        improvedGlobalRating: updatedRecord.improved_global_rating,
        hasSuggestions: hasSuggestionContent(postImprovementAnalysis.suggestions),
        suggestionsKeys: Object.keys(postImprovementAnalysis.suggestions || {}),
        createdVersionNumber
    });

    return {
        updatedRecord,
        postImprovementAnalysis,
        createdVersionNumber
    };
}

/**
 * POST /api/resumes/:id/analyze - Analyze resume
 */
export async function analyzeHandler(req, res) {
    try {
        const { id } = req.params;
        const userMetadata = getRequestMetadata(req);
        const resumeRecord = await findResumeRecord(id);
        
        // Check firm access
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resumeRecord.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only analyze resumes from your firm' });
        }
        
        const resumeText = resumeRecord.original_text || resumeRecord.improved_text;
        
        if (!resumeText) {
            return res.status(400).json({ error: 'Resume has no text content' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get original filename for name extraction hint
        const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
        const fileNameValue = originalFileName || 'Non disponible';
        
        // Inject accepted industries and mapping lexique into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        const industryMapping = await getIndustryMappingString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
        
        // Inject anonymization rules based on cvMode (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

        
        safeLog('debug', 'Injected accepted industries and anonymization rules into analysis prompt', { 
            industriesCount: acceptedIndustries.split(',').length,
            industriesPreview: acceptedIndustries.substring(0, 100) + '...',
            cvMode,
            fileName: fileNameValue
        });

        // Clean up text before analysis (removes HTML entities and tags for cleaner LLM processing)
        const cleanedText = cleanupText(resumeText);
        safeLog('debug', 'Text cleaned before analysis', { 
            originalLength: resumeText.length, 
            cleanedLength: cleanedText.length 
        });
        
        let analysis = await analyzeResume(cleanedText, model, analysisPrompt, userMetadata, false, originalFileName);
        
        // Recalculate globalRating based on admin-defined weights
        analysis = await calculateWeightedGlobalRating(analysis, settings);
        
        // In anonymous mode, replace name with trigram
        if (cvMode === 'anonymous' && analysis.name) {
            const trigram = generateTrigram(analysis.name);
            analysis.originalName = analysis.name;
            analysis.name = trigram;
            safeLog('info', 'Anonymous mode: replaced name with trigram', { trigram });
        }
        
        res.json(analysis);
    } catch (error) {
        handleLLMError(error, res, 'analyzing resume');
    }
}

/**
 * POST /api/resumes/analyze-text - Analyze resume text (without ID)
 * Used for initial analysis during upload
 */
export async function analyzeTextHandler(req, res) {
    try {
        const { text, fileName } = req.body;
        const userMetadata = getRequestMetadata(req);
        
        if (!text) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get filename value for injection
        const fileNameValue = fileName || 'Non disponible';
        
        // Inject accepted industries and mapping lexique into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        const industryMapping = await getIndustryMappingString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
        
        // Inject anonymization rules based on cvMode (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

        // Clean up text before analysis (removes HTML entities and tags for cleaner LLM processing)
        const cleanedText = cleanupText(text);
        safeLog('debug', 'Text cleaned before analysis', { 
            originalLength: text.length, 
            cleanedLength: cleanedText.length,
            fileName: fileNameValue,
            cvMode
        });

        let analysis = await analyzeResume(cleanedText, model, analysisPrompt, userMetadata, false, fileName || null);
        
        // Recalculate globalRating based on admin-defined weights
        analysis = await calculateWeightedGlobalRating(analysis, settings);
        
        // In anonymous mode, replace name with trigram
        if (cvMode === 'anonymous' && analysis.name) {
            const trigram = generateTrigram(analysis.name);
            analysis.originalName = analysis.name;
            analysis.name = trigram;
            safeLog('info', 'Anonymous mode: replaced name with trigram', { trigram });
        }
        
        res.json(analysis);
    } catch (error) {
        handleLLMError(error, res, 'analyzing resume text');
    }
}

/**
 * POST /api/resumes/improve - Improve resume (text and analysis in body)
 * Returns improved text + post-improvement analysis with suggestions
 */
export async function improveHandler(req, res) {
    try {
        const { text, analysis, fileName, resumeId } = req.body;
        const userMetadata = getRequestMetadata(req);
        
        if (!text) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let improvementPrompt = settings['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get filename value for injection
        const fileNameValue = fileName || 'Non disponible';
        
        // Inject accepted industries into BOTH prompts, mapping lexique only into analysis prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
        // Inject anonymization rules based on cvMode into BOTH prompts (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);
        
        safeLog('debug', 'Injected accepted industries and anonymization rules into prompts', { 
            industriesCount: acceptedIndustries.split(',').length,
            industriesPreview: acceptedIndustries.substring(0, 100) + '...',
            cvMode,
            fileName: fileNameValue
        });

        // Preserve the structured resume markup for improvement; stripping HTML here flattens the CV.
        safeLog('debug', 'Text prepared before improvement', {
            originalLength: text.length,
            containsHtml: /<\/?[a-z][^>]*>/i.test(text)
        });

        // Step 1: Improve the resume
        const improved = await improveResume(text, analysis, model, improvementPrompt, fileName || null, userMetadata);
        
        // Do not trigger a second LLM call here.
        // The improvement response is already the completion of this operation.
        let mergedAnalysis = {
            ...analysis,
            ...improved.analysis,
            suggestions: improved.analysis?.suggestions || analysis?.suggestions || {},
            tags: improved.analysis?.tags || analysis?.tags || {
                skills: [],
                industries: [],
                tools: [],
                softSkills: []
            }
        };

        try {
            mergedAnalysis = await calculateWeightedGlobalRating(mergedAnalysis, settings);
        } catch (weightError) {
            safeLog('warn', 'Failed to recalculate weighted score after resume improvement', {
                error: weightError.message,
                provider: settings.llmProvider,
                model
            });
        }

        let savedResume = null;
        let finalAnalysis = mergedAnalysis;

        if (resumeId) {
            const resumeRecord = await findResumeRecord(resumeId);
            const isAdmin = req.user?.role === 'admin';
            const userFirm = req.user?.firm || req.user?.customer;

            if (!isAdmin && resumeRecord.firm_name !== userFirm) {
                return res.status(403).json({ error: 'Access denied: You can only improve resumes from your firm' });
            }

            const shouldCreateVersion = await hasImprovedTextChanged(resumeId, improved.text);
            const { updatedRecord, postImprovementAnalysis } = await persistPostImprovementAnalysis({
                resumeId,
                improvedText: improved.text,
                model,
                settings,
                acceptedIndustries,
                anonymizationRules,
                originalFileName: fileName || null,
                userMetadata,
                userId: req.user?.id,
                shouldCreateVersion
            });
            savedResume = mapResumeToFrontend(updatedRecord);
            finalAnalysis = postImprovementAnalysis;
        }

        if (text && /<\/?[a-z][^>]*>/i.test(text) && improved.text && !/<\/?[a-z][^>]*>/i.test(improved.text)) {
            safeLog('warn', 'Improved resume output is plain text despite HTML input', {
                resumeId: resumeId || null,
                inputLength: text.length,
                outputLength: improved.text.length
            });
        }

        safeLog('info', 'Improvement complete with fully persisted post-analysis', {
            resumeId: resumeId || null,
            hasImprovedText: !!improved.text,
            hasSuggestions: hasSuggestionContent(finalAnalysis.suggestions),
            suggestionsKeys: Object.keys(finalAnalysis.suggestions || {}),
            tagsSkillsCount: Array.isArray(finalAnalysis.tags?.skills) ? finalAnalysis.tags.skills.length : 0,
            calculatedGlobalRating: finalAnalysis.globalRating,
            postAnalysisPending: false
        });
        res.json({
            text: improved.text,
            analysis: finalAnalysis,
            savedResume,
            postAnalysisPending: false
        });
    } catch (error) {
        handleLLMError(error, res, 'improving resume');
    }
}

/**
 * POST /api/resumes/:id/improve - Improve resume by ID
 */
export async function improveByIdHandler(req, res) {
    try {
        const { id } = req.params;
        const userMetadata = getRequestMetadata(req);
        const resumeRecord = await findResumeRecord(id);
        
        // Check firm access
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resumeRecord.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only improve resumes from your firm' });
        }
        
        const resumeText = resumeRecord.original_text;
        
        if (!resumeText) {
            return res.status(400).json({ error: 'Resume has no original text' });
        }

        // Build analysis object from resume fields
        const analysis = {
            name: resumeRecord.name,
            title: resumeRecord.title,
            globalRating: resumeRecord.global_rating,
            tags: {
                skills: resumeRecord.skills || [],
                industries: resumeRecord.industries || [],
                tools: resumeRecord.tools || [],
                softSkills: resumeRecord.soft_skills || []
            }
        };

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let improvementPrompt = settings['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get original filename for name extraction hint
        const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
        const fileNameValue = originalFileName || 'Non disponible';
        
        // Inject accepted industries into the prompt (no mapping lexique needed for improvement)
        const acceptedIndustries = await getAcceptedIndustriesString();
        improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
        // Inject anonymization rules based on cvMode (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

        // Preserve the structured resume markup for improvement; stripping HTML here flattens the CV.
        safeLog('debug', 'Text prepared before improvement (by ID)', {
            originalLength: resumeText.length,
            containsHtml: /<\/?[a-z][^>]*>/i.test(resumeText),
            cvMode,
            fileName: fileNameValue
        });
        
        const improved = await improveResume(resumeText, analysis, model, improvementPrompt, originalFileName, userMetadata);
        // Recalculate globalRating based on admin-defined weights
        if (improved.analysis) {
            improved.analysis = await calculateWeightedGlobalRating(improved.analysis, settings);
        }
        
        res.json(improved);
    } catch (error) {
        handleLLMError(error, res, 'improving resume');
    }
}

/**
 * POST /api/resumes/:id/match - Match resume with mission
 */
export async function matchHandler(req, res) {
    try {
        const { id } = req.params;
        const { missionId } = req.body;
        const userMetadata = getRequestMetadata(req);
        
        if (!missionId) {
            return res.status(400).json({ error: 'Mission ID is required' });
        }

        const resumeRecord = await findResumeRecord(id);
        const missionRecord = await findMissionRecord(missionId);
        
        // Check firm access
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resumeRecord.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only match resumes from your firm' });
        }

        const resumeText = resumeRecord.improved_text || resumeRecord.original_text;
        const missionTitle = missionRecord.title || '';
        const missionContent = missionRecord.content || '';

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        let matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        const matchResult = await matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchPrompt, userMetadata);
        
        res.json(matchResult);
    } catch (error) {
        handleLLMError(error, res, 'matching resume with mission');
    }
}

/**
 * POST /api/resumes/:id/adapt - Adapt resume for mission
 */
export async function adaptHandler(req, res) {
    try {
        const { id } = req.params;
        const { missionId } = req.body;
        const userMetadata = getRequestMetadata(req);
        
        if (!missionId) {
            return res.status(400).json({ error: 'Mission ID is required' });
        }

        const resumeRecord = await findResumeRecord(id);
        const missionRecord = await findMissionRecord(missionId);
        
        // Check firm access
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resumeRecord.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only adapt resumes from your firm' });
        }

        const resumeText = resumeRecord.improved_text || resumeRecord.original_text;
        const missionTitle = missionRecord.title || '';
        const missionContent = missionRecord.content || '';

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let adaptationPrompt = settings['Adaptation Prompt'] || DEFAULT_ADAPTATION_PROMPT;

        if (!model && settings.llmProvider !== 'ollama') {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get original filename for injection
        const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
        const fileNameValue = originalFileName || 'Non disponible';

        // Inject accepted industries into the adaptation prompt (no mapping lexique needed for adaptation)
        const acceptedIndustries = await getAcceptedIndustriesString();
        adaptationPrompt = adaptationPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

        // Inject anonymization rules based on cvMode (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        adaptationPrompt = adaptationPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

        // Inject filename into adaptation prompt
        adaptationPrompt = adaptationPrompt.replace('{FILENAME}', fileNameValue);

        safeLog('debug', 'Injected industries, anonymization rules and filename into adaptation prompt', {
            industriesCount: acceptedIndustries.split(',').length,
            cvMode,
            fileName: fileNameValue
        });

        // First do match analysis
        let matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;
        const matchAnalysis = await matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchPrompt, userMetadata);

        const adaptationResult = await adaptResumeToMission({
            resumeText,
            missionTitle,
            missionContent,
            matchAnalysis,
            model,
            adaptationPrompt,
            userMetadata
        });
        
        // Extract adaptedText, adaptedTitle, and structuredData from result
        const adaptedText = typeof adaptationResult === 'string' ? adaptationResult : adaptationResult.adaptedText;
        const adaptedTitle = typeof adaptationResult === 'string' ? null : (adaptationResult.adaptedTitle || null);
        const structuredData = typeof adaptationResult === 'string' ? null : (adaptationResult.structuredData || null);

        // Parse match score (can be "32%" or 32 or null)
        let matchScoreNum = null;
        if (matchAnalysis?.matchScore) {
            const scoreStr = String(matchAnalysis.matchScore).replace('%', '');
            const parsed = parseFloat(scoreStr);
            if (!isNaN(parsed)) {
                matchScoreNum = parsed;
            }
        }

        // Extract adaptation notes from structured data for storage
        const adaptationNotes = structuredData?.adaptationNotes 
            ? JSON.stringify(structuredData.adaptationNotes) 
            : null;

        // Save adaptation to database
        safeLog('debug', 'Creating adaptation with data', {
            resumeId: resumeRecord.id,
            resumeName: resumeRecord.name,
            candidateName: resumeRecord.candidate_name,
            adaptedTitle: adaptedTitle,
            missionId: missionRecord.id,
            missionTitle: missionTitle,
            firm: resumeRecord.firm_name,
            hasStructuredData: !!structuredData
        });

        const adaptationData = {
            resume_id: resumeRecord.id,
            mission_id: missionRecord.id,
            resume_name: resumeRecord.name || null,
            candidate_name: resumeRecord.candidate_name || null,
            adapted_title: adaptedTitle,
            mission_title: missionTitle || null,
            mission_content: missionContent || null,
            firm: resumeRecord.firm_name || null,
            adapted_text: adaptedText,
            adaptation_notes: adaptationNotes,
            match_score: matchScoreNum,
            match_analysis: matchAnalysis ? JSON.stringify(matchAnalysis) : null,
            status: 'completed'
        };

        const adaptationRecord = await createAdaptation(adaptationData);

        // Return full response with structured data for frontend
        res.json({
            adaptedText,
            adaptedTitle,
            matchAnalysis,
            adaptationId: adaptationRecord.id,
            // Include structured data for enhanced frontend display
            structuredAdaptation: structuredData,
            adaptationNotes: structuredData?.adaptationNotes || null
        });
    } catch (error) {
        handleLLMError(error, res, 'adapting resume to mission');
    }
}







