import { findResumeRecord, findMissionRecord } from '../../../services/resumes.service.js';
import { safeLog } from '../../../utils/logger.backend.js';
import { analyzeResume, improveResume, matchResumeWithMission, cleanupText } from '../../../services/openai.service.js';
import { getRequestMetadata } from '../../../services/security.service.js';
import { getLLMSettings, calculateWeightedGlobalRating } from '../../../services/settings.service.js';
import { getAcceptedIndustriesString, getIndustryMappingString } from '../../../services/industry.service.js';
import {
    DEFAULT_IMPROVEMENT_PROMPT,
    DEFAULT_ANALYSIS_PROMPT,
    DEFAULT_MATCH_ANALYSIS_PROMPT,
    ANONYMIZATION_RULES_ANONYMOUS,
    ANONYMIZATION_RULES_NOMINATIVE
} from '../../../config/prompts.backend.js';
import { generateTrigram } from '../../../utils/trigram.js';
import { mapResumeToFrontend } from '../helpers.js';
import { hasImprovedTextChanged } from '../../../services/resumeVersions.service.js';
import {
    buildImprovedResumeUpdateData,
    hasSuggestionContent,
    persistPostImprovementAnalysis
} from './improvementHelpers.js';

function handleLLMError(error, res, operation) {
    safeLog('error', `Error ${operation}`, { error: error.message, status: error.response?.status });
    const statusCode = error.response?.status || 500;
    const errorMessage = error.estimatedTokens
        ? { error: error.message, estimatedTokens: error.estimatedTokens }
        : { error: error.response?.data?.error || error.message || `Failed to ${operation}` };
    res.status(statusCode).json(errorMessage);
}

function createAnalyzeHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const userMetadata = getRequestMetadata(req);
            const resumeRecord = await findResumeRecord(id);
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

            const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
            const fileNameValue = originalFileName || 'Non disponible';
            const acceptedIndustries = await getAcceptedIndustriesString();
            const industryMapping = await getIndustryMappingString();
            analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
            analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
            let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
            anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
            analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

            safeLog('debug', 'Injected accepted industries and anonymization rules into analysis prompt', {
                industriesCount: acceptedIndustries.split(',').length,
                industriesPreview: `${acceptedIndustries.substring(0, 100)}...`,
                cvMode,
                fileName: fileNameValue
            });

            const cleanedText = cleanupText(resumeText);
            safeLog('debug', 'Text cleaned before analysis', {
                originalLength: resumeText.length,
                cleanedLength: cleanedText.length
            });

            let analysis = await analyzeResume(cleanedText, model, analysisPrompt, userMetadata, false, originalFileName);
            analysis = await calculateWeightedGlobalRating(analysis, settings);

            if (cvMode === 'anonymous' && analysis.name) {
                const trigram = generateTrigram(analysis.name);
                analysis.originalName = analysis.name;
                analysis.name = trigram;
                safeLog('info', 'Anonymous mode: replaced name with trigram', { trigram });
            }

            return res.json(analysis);
        } catch (error) {
            return handleLLMError(error, res, 'analyzing resume');
        }
    };
}

function createAnalyzeTextHandler() {
    return async (req, res) => {
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

            const fileNameValue = fileName || 'Non disponible';
            const acceptedIndustries = await getAcceptedIndustriesString();
            const industryMapping = await getIndustryMappingString();
            analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
            analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
            let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
            anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
            analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

            const cleanedText = cleanupText(text);
            safeLog('debug', 'Text cleaned before analysis', {
                originalLength: text.length,
                cleanedLength: cleanedText.length,
                fileName: fileNameValue,
                cvMode
            });

            let analysis = await analyzeResume(cleanedText, model, analysisPrompt, userMetadata, false, fileName || null);
            analysis = await calculateWeightedGlobalRating(analysis, settings);

            if (cvMode === 'anonymous' && analysis.name) {
                const trigram = generateTrigram(analysis.name);
                analysis.originalName = analysis.name;
                analysis.name = trigram;
                safeLog('info', 'Anonymous mode: replaced name with trigram', { trigram });
            }

            return res.json(analysis);
        } catch (error) {
            return handleLLMError(error, res, 'analyzing resume text');
        }
    };
}

async function executeImprovementFlow({ req, res, text, analysis = {}, fileName = null, resumeId = null, resumeRecord = null }) {
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

    const fileNameValue = fileName || 'Non disponible';
    const acceptedIndustries = await getAcceptedIndustriesString();
    improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
    improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    safeLog('debug', 'Injected accepted industries and anonymization rules into prompts', {
        industriesCount: acceptedIndustries.split(',').length,
        industriesPreview: `${acceptedIndustries.substring(0, 100)}...`,
        cvMode,
        fileName: fileNameValue,
        resumeId: resumeId || null
    });

    safeLog('debug', 'Text prepared before improvement', {
        originalLength: text.length,
        containsHtml: /<\/?[a-z][^>]*>/i.test(text),
        cvMode,
        fileName: fileNameValue,
        resumeId: resumeId || null
    });

    const improved = await improveResume(text, analysis, model, improvementPrompt, fileName, userMetadata);
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
            model,
            resumeId: resumeId || null
        });
    }

    let savedResume = null;
    let finalAnalysis = mergedAnalysis;

    if (resumeId) {
        const record = resumeRecord || await findResumeRecord(resumeId);
        const isAdmin = req.user?.role === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        if (!isAdmin && record.firm_name !== userFirm) {
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
            originalFileName: fileName,
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

    return res.json({
        text: improved.text,
        analysis: finalAnalysis,
        savedResume,
        postAnalysisPending: false
    });
}

function createImproveHandler() {
    return async (req, res) => {
        try {
            const { text, analysis, fileName, resumeId } = req.body;
            return await executeImprovementFlow({ req, res, text, analysis, fileName: fileName || null, resumeId: resumeId || null });
        } catch (error) {
            return handleLLMError(error, res, 'improving resume');
        }
    };
}

function createImproveByIdHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const resumeRecord = await findResumeRecord(id);
            const isAdmin = req.user?.role === 'admin';
            const userFirm = req.user?.firm || req.user?.customer;

            if (!isAdmin && resumeRecord.firm_name !== userFirm) {
                return res.status(403).json({ error: 'Access denied: You can only improve resumes from your firm' });
            }

            const resumeText = resumeRecord.original_text;
            if (!resumeText) {
                return res.status(400).json({ error: 'Resume has no original text' });
            }

            const analysis = {
                name: resumeRecord.name,
                title: resumeRecord.title,
                globalRating: resumeRecord.global_rating,
                skillsRating: resumeRecord.skills_score,
                experiencesRating: resumeRecord.experience_score,
                educationRating: resumeRecord.education_score,
                atsOptimizationRating: resumeRecord.ats_score,
                executiveSummaryRating: resumeRecord.executive_summary_score,
                hobbiesLanguagesRating: resumeRecord.hobbies_languages_score,
                suggestions: resumeRecord.improvement_suggestions || {},
                tags: {
                    skills: resumeRecord.skills || [],
                    industries: resumeRecord.industries || [],
                    tools: resumeRecord.tools || [],
                    softSkills: resumeRecord.soft_skills || []
                }
            };
            const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
            return await executeImprovementFlow({
                req,
                res,
                text: resumeText,
                analysis,
                fileName: originalFileName,
                resumeId: id,
                resumeRecord
            });
        } catch (error) {
            return handleLLMError(error, res, 'improving resume');
        }
    };
}

function createMatchHandler() {
    return async (req, res) => {
        try {
            const { id } = req.params;
            const { missionId } = req.body;
            const userMetadata = getRequestMetadata(req);
            if (!missionId) {
                return res.status(400).json({ error: 'Mission ID is required' });
            }

            const resumeRecord = await findResumeRecord(id);
            const missionRecord = await findMissionRecord(missionId);
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
            const matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;

            if (!model && settings.llmProvider !== 'ollama') {
                return res.status(500).json({ error: 'LLM model not configured in Settings.' });
            }

            const matchResult = await matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchPrompt, userMetadata);
            return res.json(matchResult);
        } catch (error) {
            return handleLLMError(error, res, 'matching resume with mission');
        }
    };
}

export {
    createAnalyzeHandler,
    createAnalyzeTextHandler,
    createImproveByIdHandler,
    createImproveHandler,
    createMatchHandler,
    handleLLMError
};
