/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { cleanupHtml } from './textUtils.js';

/**
 * Normalize analysis response to ensure consistent format regardless of model
 * GPT-5 models sometimes return different field names than expected
 * @param {Object} analysis - Raw analysis from LLM
 * @returns {Object} - Normalized analysis object
 */
function normalizeAnalysisResponse(analysis) {
    // Normalize field names (GPT-5 sometimes uses different formats)
    // Check multiple possible key names for hobbies/languages rating
    const hobbiesRating = analysis.hobbiesLanguagesRating 
        || analysis['Hobbies Languages'] 
        || analysis['hobbiesLanguages']
        || analysis['Hobbies & Languages']
        || analysis['hobbies_languages']
        || analysis['Languages & Hobbies']
        || analysis['languagesHobbiesRating']
        || '0%';
    
    const normalized = {
        name: analysis.name || analysis.Name || 'Candidat',
        title: analysis.title || analysis.Title || analysis['Professional Title'] || '',
        globalRating: analysis.globalRating || analysis['Global Rating'] || '0%',
        executiveSummaryRating: analysis.executiveSummaryRating || analysis['Executive Summary'] || '0%',
        skillsRating: analysis.skillsRating || analysis['Skills'] || '0%',
        experiencesRating: analysis.experiencesRating || analysis['Experience'] || '0%',
        educationRating: analysis.educationRating || analysis['Education'] || '0%',
        hobbiesLanguagesRating: hobbiesRating,
        atsOptimizationRating: analysis.atsOptimizationRating || analysis['ATS Compatibility'] || analysis['ATS'] || '0%',
        tags: analysis.tags || {
            skills: analysis['Top Skills'] || [],
            industries: analysis['Top Industries'] || [],
            tools: analysis['Top Tools'] || [],
            softSkills: analysis['Top Soft Skills'] || []
        },
        suggestions: analysis.suggestions || {
            executiveSummary: [],
            skills: [],
            experiences: [],
            education: [],
            hobbiesLanguages: [],
            atsOptimization: []
        }
    };
    
    // Also preserve the original flat format for backward compatibility
    normalized['Global Rating'] = normalized.globalRating;
    normalized['Executive Summary'] = normalized.executiveSummaryRating;
    normalized['Skills'] = normalized.skillsRating;
    normalized['Experience'] = normalized.experiencesRating;
    normalized['Education'] = normalized.educationRating;
    normalized['Hobbies Languages'] = normalized.hobbiesLanguagesRating;
    normalized['ATS Compatibility'] = normalized.atsOptimizationRating;
    normalized['Top Skills'] = normalized.tags.skills;
    normalized['Top Industries'] = normalized.tags.industries;
    normalized['Top Tools'] = normalized.tags.tools;
    normalized['Top Soft Skills'] = normalized.tags.softSkills;
    // Preserve suggestions structure by section for display in OverviewTab
    normalized['Key Improvements'] = normalized.suggestions;
    normalized['Summary'] = analysis['Summary'] || analysis.summary || '';
    
    // Preserve structuredText if provided by LLM (HTML-formatted version of the CV)
    if (analysis.structuredText) {
        normalized.structuredText = analysis.structuredText;
    }
    
    return normalized;
}

/**
 * Analyze a resume using OpenAI
 * @param {string} resumeText - The resume text to analyze
 * @param {string} model - OpenAI model to use
 * @param {string} analysisPrompt - The analysis prompt template
 * @param {Object} userMetadata - User metadata for logging
 * @param {boolean} isImprovedCV - Whether this is an improved CV (for logging purposes only)
 * @param {string} originalFileName - Original file name for name extraction hint
 * @returns {Promise<Object>} - Parsed analysis result
 */
export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);
    
    // Inject original filename if available (helps LLM determine candidate name)
    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }
    
    // Agnostic system message - same for all CVs
    const systemMessage = 'You are a JSON-only resume analysis API. Respond with valid JSON only.';

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: prompt }
        ],
        maxTokens: 16000,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        maxPromptLength: 120000,
        userMetadata,
        operationType: isImprovedCV ? 'Improved Resume Analysis' : 'Resume Analysis'
    });

    let rawAnalysis;
    try {
        rawAnalysis = JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM analysis response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error('Le modÃ¨le LLM a retournÃ© une rÃ©ponse invalide. Veuillez rÃ©essayer ou contacter le support si le problÃ¨me persiste.');
    }
    
    // Debug logging to track tags and ratings
    safeLog('debug', 'Raw analysis from LLM', {
        allKeys: Object.keys(rawAnalysis),
        hasTags: !!rawAnalysis.tags,
        tagsContent: rawAnalysis.tags,
        hasTopSkills: !!rawAnalysis['Top Skills'],
        topSkillsContent: rawAnalysis['Top Skills'],
        hasSkills: !!rawAnalysis.skills,
        skillsContent: rawAnalysis.skills
    });
    
    const normalized = normalizeAnalysisResponse(rawAnalysis);
    
    safeLog('debug', 'Normalized analysis', {
        hasTags: !!normalized.tags,
        tagsSkillsCount: normalized.tags?.skills?.length || 0,
        tagsIndustriesCount: normalized.tags?.industries?.length || 0,
        tagsToolsCount: normalized.tags?.tools?.length || 0,
        tagsSoftSkillsCount: normalized.tags?.softSkills?.length || 0,
        tagsSkillsPreview: normalized.tags?.skills?.slice(0, 3),
        tagsToolsPreview: normalized.tags?.tools?.slice(0, 3)
    });
    
    return normalized;
}

/**
 * Improve resume text using OpenAI
 * @param {string} text - Resume text to improve
 * @param {Object} analysis - Analysis data
 * @param {string} model - OpenAI model to use
 * @param {string} improvementPromptTemplate - Improvement prompt template
 * @param {string} originalFileName - Original file name for name extraction hint
 * @param {Object} userMetadata - User metadata for logging
 * @returns {Promise<string>} - Improved resume text
 */
export async function improveResume(text, analysis, model, improvementPromptTemplate, originalFileName = null, userMetadata = null) {
    const analysisJson = JSON.stringify(analysis, null, 2);
    const fileNameValue = originalFileName || 'Non disponible';
    const improvementPrompt = improvementPromptTemplate
        .replace(/{ANALYSIS}/g, analysisJson)
        .replace(/{analysis}/g, analysisJson)
        .replace(/{TEXT}/g, text)
        .replace(/{text}/g, text)
        .replace(/{FILENAME}/g, fileNameValue)
        .replace(/{filename}/g, fileNameValue);

    // Debug: Log the full prompt sent to LLM (dev mode only)
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LLM === 'true') {
        safeLog('debug', '========== LLM IMPROVEMENT PROMPT DEBUG ==========');
        safeLog('debug', 'Model:', { model });
        safeLog('debug', 'Prompt length:', { length: improvementPrompt.length });
        safeLog('debug', '--- FULL PROMPT ---');
        safeLog('debug', improvementPrompt);
        safeLog('debug', '--- END PROMPT ---');
    }

    // Validate input text before calling LLM
    if (!text || text.trim().length < 100) {
        safeLog('error', 'Improvement input text too short', { 
            textLength: text?.length || 0,
            minRequired: 100
        });
        throw new Error('Le texte du CV est trop court pour Ãªtre amÃ©liorÃ© (minimum 100 caractÃ¨res).');
    }

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: 'You are a professional resume improvement assistant. You MUST respond with valid JSON only, following the exact structure specified in the user prompt. Do not include any text outside the JSON object.' },
            { role: 'user', content: improvementPrompt }
        ],
        maxTokens: 16384,  // Increased from 8192 to handle longer CVs
        temperature: 0.3,
        timeout: 300000,   // 5 minutes for complex CVs
        userMetadata,
        operationType: 'Resume Improvement'
    });

    let rawContent = response.choices[0].message.content
        .replace(/^```html\s*/i, '')
        .replace(/\s*```$/i, '')
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .trim();

    safeLog('info', 'LLM Improvement raw response preview:', { 
        isJSON: rawContent.startsWith('{'),
        hasImprovedText: rawContent.includes('"improvedText"'),
        preview: rawContent.substring(0, 300)
    });

    // Check if the response is JSON with improvedText field
    // The prompt asks for JSON format with improvedText, improvements, summary
    if (rawContent.startsWith('{') && rawContent.includes('"improvedText"')) {
        try {
            const parsed = JSON.parse(rawContent);
            
            // Clean up the HTML content
            const cleanedText = cleanupHtml(parsed.improvedText || '');
            
            // Validate that we have actual content
            if (!cleanedText || cleanedText.trim().length === 0) {
                safeLog('error', 'LLM returned empty improvedText in JSON response', {
                    hasImprovedText: !!parsed.improvedText,
                    improvedTextLength: parsed.improvedText?.length || 0,
                    cleanedTextLength: cleanedText?.length || 0
                });
                throw new Error('Le modÃ¨le LLM a retournÃ© un CV amÃ©liorÃ© vide. Veuillez rÃ©essayer.');
            }
            
            // Build analysis object from improvements
            const improvements = parsed.improvements || {};
            const summary = parsed.summary || {};
            
            // Return structured response for frontend
            const result = {
                text: cleanedText,
                analysis: {
                    globalRating: improvements.overall || 0,
                    executiveSummaryRating: improvements.executiveSummary || 0,
                    skillsRating: improvements.skills || 0,
                    experiencesRating: improvements.experience || 0,
                    educationRating: improvements.education || 0,
                    atsOptimizationRating: improvements.atsOptimization || 0,
                    hobbiesLanguagesRating: improvements.languagesInterests || 0,
                    suggestions: {}, // Post-improvement has no new suggestions
                    tags: {
                        skills: [],
                        industries: summary.industries || [],
                        tools: [],
                        softSkills: []
                    },
                    name: summary.title || analysis?.name || '',
                    title: summary.targetRole || analysis?.title || ''
                }
            };
            
            safeLog('info', 'Parsed improvement result:', {
                hasText: !!result.text,
                textLength: result.text?.length,
                analysis: result.analysis
            });
            
            return result;
        } catch (parseError) {
            safeLog('error', 'Failed to parse LLM improvement response as JSON', {
                error: parseError.message,
                responsePreview: rawContent.substring(0, 500)
            });
            throw new Error('Le modÃ¨le LLM a retournÃ© une rÃ©ponse JSON invalide pour l\'amÃ©lioration. Veuillez rÃ©essayer ou contacter le support si le problÃ¨me persiste.');
        }
    }

    // Fallback: if response is plain HTML, return with empty analysis
    const cleanedText = cleanupHtml(rawContent);
    
    // Validate fallback content is not empty
    if (!cleanedText || cleanedText.trim().length === 0) {
        safeLog('error', 'LLM returned empty content in fallback (non-JSON) response', {
            rawContentLength: rawContent?.length || 0,
            cleanedTextLength: cleanedText?.length || 0,
            rawContentPreview: rawContent?.substring(0, 200)
        });
        throw new Error('Le modÃ¨le LLM a retournÃ© une rÃ©ponse vide. Veuillez rÃ©essayer.');
    }
    
    return {
        text: cleanedText,
        analysis: {
            globalRating: 0,
            executiveSummaryRating: 0,
            skillsRating: 0,
            experiencesRating: 0,
            educationRating: 0,
            atsOptimizationRating: 0,
            hobbiesLanguagesRating: 0,
            suggestions: {},
            tags: { skills: [], industries: [], tools: [], softSkills: [] },
            name: '',
            title: ''
        }
    };
}
