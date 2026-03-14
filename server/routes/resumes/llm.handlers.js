/**
 * LLM-related route handlers for resumes (PostgreSQL)
 * Handles analyze, improve, match, and adapt operations
 */

import { findWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import { safeLog } from '../../utils/logger.backend.js';
import { analyzeResume, improveResume, matchResumeWithMission, adaptResumeToMission, cleanupText } from '../../services/openai.service.js';
import { getRequestMetadata } from '../../services/security.service.js';
import { getLLMSettings, calculateWeightedGlobalRating } from '../../services/settings.service.js';
import { getAcceptedIndustriesString } from '../../services/industry.service.js';
import { DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_ANALYSIS_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } from '../../config/prompts.backend.js';

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

/**
 * Generate trigram from candidate name
 * Format: 1st letter of first name + 2 first letters of last name
 * Example: "Jean Dupont" -> "JDU"
 * @param {string} name - Full name of the candidate (first name + last name)
 * @returns {string} - 3-letter trigram in uppercase
 */
function generateTrigram(name) {
    if (!name || name.trim().length === 0) {
        return 'XXX';
    }
    
    // Split name into parts (handle multiple spaces)
    const parts = name.trim().split(/\s+/).filter(part => part.length > 0);
    
    if (parts.length === 0) {
        return 'XXX';
    }
    
    // Clean each part (keep only letters)
    const cleanParts = parts.map(part => part.replace(/[^a-zA-Z]/g, '').toUpperCase());
    
    if (parts.length === 1) {
        // Only one name part: take first 3 letters
        const singleName = cleanParts[0];
        return (singleName + 'XXX').substring(0, 3);
    }
    
    // First name is the first part, last name is the last part
    const firstName = cleanParts[0];
    const lastName = cleanParts[cleanParts.length - 1];
    
    // 1st letter of first name + 2 first letters of last name
    const firstInitial = firstName.length > 0 ? firstName.charAt(0) : 'X';
    const lastInitials = lastName.length >= 2 ? lastName.substring(0, 2) : (lastName + 'XX').substring(0, 2);
    
    return firstInitial + lastInitials;
}

/**
 * POST /api/resumes/:id/analyze - Analyze resume
 */
export async function analyzeHandler(req, res) {
    try {
        const { id } = req.params;
        const userMetadata = getRequestMetadata(req);
        const resumeRecord = await findWithTimeout('resumes', id);
        
        // Check firm access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
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

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get original filename for name extraction hint
        const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
        const fileNameValue = originalFileName || 'Non disponible';
        
        // Inject accepted industries into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
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

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get filename value for injection
        const fileNameValue = fileName || 'Non disponible';
        
        // Inject accepted industries into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
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
        const { text, analysis, fileName } = req.body;
        const userMetadata = getRequestMetadata(req);
        
        if (!text) {
            return res.status(400).json({ error: 'Resume text is required' });
        }

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        const cvMode = settings.cvMode || 'nominative';
        let improvementPrompt = settings['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT;
        let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get filename value for injection
        const fileNameValue = fileName || 'Non disponible';
        
        // Inject accepted industries into BOTH prompts
        const acceptedIndustries = await getAcceptedIndustriesString();
        improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
        // Inject anonymization rules based on cvMode into BOTH prompts (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);
        analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);
        
        safeLog('debug', 'Injected accepted industries and anonymization rules into prompts', { 
            industriesCount: acceptedIndustries.split(',').length,
            industriesPreview: acceptedIndustries.substring(0, 100) + '...',
            cvMode,
            fileName: fileNameValue
        });

        // Clean up text before improvement (removes HTML tags for cleaner LLM processing)
        const cleanedText = cleanupText(text);
        safeLog('debug', 'Text cleaned before improvement', { 
            originalLength: text.length, 
            cleanedLength: cleanedText.length 
        });

        // Step 1: Improve the resume
        const improved = await improveResume(cleanedText, analysis, model, improvementPrompt, fileName || null, userMetadata);
        
        // Step 2: Analyze the improved text to get post-improvement suggestions
        
        // Clean up improved text for analysis (removes HTML entities and tags)
        const improvedTextForAnalysis = cleanupText(improved.text || '');
        
        safeLog('debug', 'Analyzing improved CV for post-improvement suggestions', {
            originalLength: (improved.text || '').length,
            cleanedLength: improvedTextForAnalysis.length
        });
        
        // Analyze with isImprovedCV=true for more favorable scoring
        let postImprovementAnalysis = await analyzeResume(improvedTextForAnalysis, model, analysisPrompt, userMetadata, true);
        
        // Recalculate globalRating based on admin-defined weights for post-improvement analysis
        postImprovementAnalysis = await calculateWeightedGlobalRating(postImprovementAnalysis, settings);
        
        // Merge the improvement scores with the post-improvement analysis suggestions
        // Use the recalculated globalRating from post-improvement analysis
        const mergedAnalysis = {
            ...improved.analysis,
            // Override with recalculated ratings from post-improvement analysis
            globalRating: postImprovementAnalysis.globalRating,
            'Global Rating': postImprovementAnalysis['Global Rating'],
            executiveSummaryRating: postImprovementAnalysis.executiveSummaryRating,
            skillsRating: postImprovementAnalysis.skillsRating,
            experiencesRating: postImprovementAnalysis.experiencesRating,
            educationRating: postImprovementAnalysis.educationRating,
            hobbiesLanguagesRating: postImprovementAnalysis.hobbiesLanguagesRating,
            atsOptimizationRating: postImprovementAnalysis.atsOptimizationRating,
            // Use suggestions from post-improvement analysis
            suggestions: postImprovementAnalysis.suggestions || {},
            // Use tags from post-improvement analysis
            tags: postImprovementAnalysis.tags || improved.analysis?.tags || {
                skills: [],
                industries: [],
                tools: [],
                softSkills: []
            },
            // Store weights info for transparency
            _weightsUsed: postImprovementAnalysis._weightsUsed,
            _originalLLMGlobalRating: postImprovementAnalysis._originalLLMGlobalRating
        };
        
        safeLog('info', 'Improvement complete with post-analysis', {
            hasImprovedText: !!improved.text,
            hasSuggestions: !!mergedAnalysis.suggestions,
            suggestionsKeys: Object.keys(mergedAnalysis.suggestions || {}),
            tagsSkillsCount: mergedAnalysis.tags?.skills?.length || 0,
            calculatedGlobalRating: mergedAnalysis.globalRating
        });
        
        res.json({
            text: improved.text,
            analysis: mergedAnalysis
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
        const resumeRecord = await findWithTimeout('resumes', id);
        
        // Check firm access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
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

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // Get original filename for name extraction hint
        const originalFileName = resumeRecord.original_file_name || resumeRecord.name || null;
        const fileNameValue = originalFileName || 'Non disponible';
        
        // Inject accepted industries into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
        // Inject anonymization rules based on cvMode (with FILENAME replaced)
        let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
        anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
        improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

        // Clean up text before improvement (removes HTML tags for cleaner LLM processing)
        const cleanedText = cleanupText(resumeText);
        safeLog('debug', 'Text cleaned before improvement (by ID)', { 
            originalLength: resumeText.length, 
            cleanedLength: cleanedText.length,
            cvMode,
            fileName: fileNameValue
        });
        
        const improved = await improveResume(cleanedText, analysis, model, improvementPrompt, originalFileName, userMetadata);
        
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

        const resumeRecord = await findWithTimeout('resumes', id);
        const missionRecord = await findWithTimeout('missions', missionId);
        
        // Check firm access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
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

        if (!model) {
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

        const resumeRecord = await findWithTimeout('resumes', id);
        const missionRecord = await findWithTimeout('missions', missionId);
        
        // Check firm access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userFirm = req.user?.firm || req.user?.customer;
        
        if (!isAdmin && resumeRecord.firm_name !== userFirm) {
            return res.status(403).json({ error: 'Access denied: You can only adapt resumes from your firm' });
        }

        const resumeText = resumeRecord.improved_text || resumeRecord.original_text;
        const missionTitle = missionRecord.title || '';
        const missionContent = missionRecord.content || '';

        const settings = await getLLMSettings();
        const model = settings.llmModel;
        let adaptationPrompt = settings['Adaptation Prompt'] || DEFAULT_ADAPTATION_PROMPT;

        if (!model) {
            return res.status(500).json({ error: 'LLM model not configured in Settings.' });
        }

        // First do match analysis
        let matchPrompt = settings['Match Analysis Prompt'] || DEFAULT_MATCH_ANALYSIS_PROMPT;
        const matchAnalysis = await matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchPrompt, userMetadata);

        const adaptationResult = await adaptResumeToMission({
            resumeText,
            resumeAnalysis: null,
            missionTitle,
            missionContent,
            matchAnalysis,
            model,
            adaptationPrompt,
            userMetadata
        });
        
        // Extract adaptedText and adaptedTitle from result (new format returns object)
        const adaptedText = typeof adaptationResult === 'string' ? adaptationResult : adaptationResult.adaptedText;
        const adaptedTitle = typeof adaptationResult === 'string' ? null : (adaptationResult.adaptedTitle || null);

        // Parse match score (can be "32%" or 32 or null)
        let matchScoreNum = null;
        if (matchAnalysis?.matchScore) {
            const scoreStr = String(matchAnalysis.matchScore).replace('%', '');
            const parsed = parseFloat(scoreStr);
            if (!isNaN(parsed)) {
                matchScoreNum = parsed;
            }
        }

        // Save adaptation to database
        safeLog('debug', 'Creating adaptation with data', {
            resumeId: resumeRecord.id,
            resumeName: resumeRecord.name,
            candidateName: resumeRecord.candidate_name,
            adaptedTitle: adaptedTitle,
            missionId: missionRecord.id,
            missionTitle: missionTitle,
            firm: resumeRecord.firm_name
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
            match_score: matchScoreNum,
            match_analysis: matchAnalysis ? JSON.stringify(matchAnalysis) : null,
            status: 'completed'
        };

        const adaptationRecord = await createWithTimeout('resume_adaptations', adaptationData);

        res.json({
            adaptedText,
            adaptedTitle,
            matchAnalysis,
            adaptationId: adaptationRecord.id
        });
    } catch (error) {
        handleLLMError(error, res, 'adapting resume to mission');
    }
}
