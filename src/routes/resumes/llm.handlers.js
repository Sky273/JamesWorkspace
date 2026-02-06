/**
 * LLM-related route handlers for resumes (PostgreSQL)
 * Handles analyze, improve, match, and adapt operations
 */

import { selectWithTimeout, findWithTimeout, createWithTimeout } from '../../utils/postgresHelpers.js';
import { safeLog } from '../../utils/logger.backend.js';
import { analyzeResume, improveResume, matchResumeWithMission, adaptResumeToMission } from '../../services/openai.service.js';
import { getRequestMetadata } from '../../services/security.service.js';
import { getLLMSettings } from '../../services/settings.service.js';
import { getAcceptedIndustriesString } from '../../services/industry.service.js';
import { DEFAULT_IMPROVEMENT_PROMPT, DEFAULT_ANALYSIS_PROMPT, DEFAULT_MATCH_ANALYSIS_PROMPT, DEFAULT_ADAPTATION_PROMPT } from '../../config/prompts.backend.js';

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
 * @param {string} name - Full name of the candidate
 * @returns {string} - 3-letter trigram in uppercase
 */
function generateTrigram(name) {
    if (!name || name.length < 3) {
        return 'XXX';
    }
    
    const cleanName = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
    
    if (cleanName.length < 3) {
        return (cleanName + 'XXX').substring(0, 3);
    }
    
    return cleanName.substring(0, 3);
}

/**
 * POST /api/resumes/:id/analyze - Analyze resume
 */
export async function analyzeHandler(req, res) {
    try {
        const { id } = req.params;
        const userMetadata = getRequestMetadata(req);
        const resumeRecord = await findWithTimeout('resumes', id);
        
        // Check customer access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        if (!isAdmin && resumeRecord.customer_name !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only analyze resumes from your customer' });
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

        // Inject accepted industries into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        safeLog('debug', 'Injected accepted industries into analysis prompt', { 
            industriesCount: acceptedIndustries.split(',').length,
            industriesPreview: acceptedIndustries.substring(0, 100) + '...'
        });

        const analysis = await analyzeResume(resumeText, model, analysisPrompt, userMetadata);
        
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
        const { text } = req.body;
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

        // Inject accepted industries into the prompt
        const acceptedIndustries = await getAcceptedIndustriesString();
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

        const analysis = await analyzeResume(text, model, analysisPrompt, userMetadata);
        
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
        const { text, analysis } = req.body;
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

        // Inject accepted industries into BOTH prompts
        const acceptedIndustries = await getAcceptedIndustriesString();
        improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
        
        safeLog('debug', 'Injected accepted industries into improvement prompt', { 
            industriesCount: acceptedIndustries.split(',').length,
            industriesPreview: acceptedIndustries.substring(0, 100) + '...'
        });

        // Step 1: Improve the resume
        const improved = await improveResume(text, analysis, model, improvementPrompt, cvMode, userMetadata);
        
        // Step 2: Analyze the improved text to get post-improvement suggestions
        
        // Strip HTML tags for analysis
        const improvedTextForAnalysis = (improved.text || '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        safeLog('debug', 'Analyzing improved CV for post-improvement suggestions', {
            improvedTextLength: improvedTextForAnalysis.length
        });
        
        // Analyze with isImprovedCV=true for more favorable scoring
        const postImprovementAnalysis = await analyzeResume(improvedTextForAnalysis, model, analysisPrompt, userMetadata, true);
        
        // Merge the improvement scores with the post-improvement analysis suggestions
        const mergedAnalysis = {
            ...improved.analysis,
            // Use suggestions from post-improvement analysis
            suggestions: postImprovementAnalysis.suggestions || {},
            // Use tags from post-improvement analysis
            tags: postImprovementAnalysis.tags || improved.analysis?.tags || {
                skills: [],
                industries: [],
                tools: [],
                softSkills: []
            }
        };
        
        safeLog('info', 'Improvement complete with post-analysis', {
            hasImprovedText: !!improved.text,
            hasSuggestions: !!mergedAnalysis.suggestions,
            suggestionsKeys: Object.keys(mergedAnalysis.suggestions || {}),
            tagsSkillsCount: mergedAnalysis.tags?.skills?.length || 0
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
        
        // Check customer access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        if (!isAdmin && resumeRecord.customer_name !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only improve resumes from your customer' });
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

        const improved = await improveResume(resumeText, analysis, model, improvementPrompt, cvMode, userMetadata);
        
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
        
        // Check customer access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        if (!isAdmin && resumeRecord.customer_name !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only match resumes from your customer' });
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
        
        // Check customer access
        const userRole = (req.user?.role || '').toLowerCase();
        const isAdmin = userRole === 'admin';
        const userCustomer = req.user?.customer;
        
        if (!isAdmin && resumeRecord.customer_name !== userCustomer) {
            return res.status(403).json({ error: 'Access denied: You can only adapt resumes from your customer' });
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

        const adaptedText = await adaptResumeToMission({
            resumeText,
            resumeAnalysis: null,
            missionTitle,
            missionContent,
            matchAnalysis,
            model,
            adaptationPrompt,
            userMetadata
        });
        
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
            missionId: missionRecord.id,
            missionTitle: missionTitle,
            customer: resumeRecord.customer_name
        });

        const adaptationData = {
            resume_id: resumeRecord.id,
            mission_id: missionRecord.id,
            resume_name: resumeRecord.name || null,
            mission_title: missionTitle || null,
            mission_content: missionContent || null,
            customer: resumeRecord.customer_name || null,
            adapted_text: adaptedText,
            match_score: matchScoreNum,
            match_analysis: matchAnalysis ? JSON.stringify(matchAnalysis) : null,
            status: 'completed'
        };

        const adaptationRecord = await createWithTimeout('resume_adaptations', adaptationData);

        res.json({
            adaptedText,
            matchAnalysis,
            adaptationId: adaptationRecord.id
        });
    } catch (error) {
        handleLLMError(error, res, 'adapting resume to mission');
    }
}
