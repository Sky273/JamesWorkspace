/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { cleanupHtml, normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';

function pickNumericScore(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
        const parsed = parseInt(String(value).replace('%', '').trim(), 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
}

function extractSuggestionText(value) {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return [String(value)];
    }

    if (Array.isArray(value)) {
        return value.flatMap(extractSuggestionText);
    }

    if (typeof value === 'object') {
        const directText = [
            value.text,
            value.suggestion,
            value.content,
            value.message,
            value.label,
            value.title,
            value.value,
            value.description
        ].find(candidate => typeof candidate === 'string' && candidate.trim());

        if (directText) {
            return [directText.trim()];
        }

        const nestedValues = Object.values(value)
            .filter(candidate => candidate !== null && candidate !== undefined);

        return nestedValues.flatMap(extractSuggestionText);
    }

    return [];
}

function asSuggestionArray(value) {
    return [...new Set(extractSuggestionText(value).filter(Boolean))];
}

function extractStructuredSummaryText(summary) {
    if (typeof summary === 'string') return summary.trim() || '';
    if (!summary || typeof summary !== 'object') return '';

    const parts = [];
    const title = typeof summary.title === 'string' ? summary.title.trim() : '';
    const targetRole = typeof summary.targetRole === 'string' ? summary.targetRole.trim() : '';
    const highlights = Array.isArray(summary.profileHighlights) ? summary.profileHighlights.filter(Boolean).map(item => String(item).trim()).filter(Boolean) : [];

    if (title) parts.push(title);
    if (targetRole && targetRole !== title) parts.push(targetRole);
    if (highlights.length > 0) parts.push(highlights.join(' '));

    return parts.join(' - ').trim();
}

function extractImprovementEnvelope(parsed) {
    const nestedImprovedCv = parsed?.improvedCV && typeof parsed.improvedCV === 'object' ? parsed.improvedCV : {};
    const nestedImprovedResume = parsed?.improvedResume && typeof parsed.improvedResume === 'object' ? parsed.improvedResume : {};
    const nestedResume = parsed?.resume && typeof parsed.resume === 'object' ? parsed.resume : {};
    const envelope = Object.keys(nestedImprovedCv).length > 0
        ? nestedImprovedCv
        : Object.keys(nestedImprovedResume).length > 0
            ? nestedImprovedResume
            : nestedResume;

    return {
        envelope,
        improvedText: parsed?.improvedText
            || envelope?.improvedText
            || envelope?.structuredText
            || envelope?.html
            || envelope?.content
            || envelope?.text
            || '',
        summary: parsed?.summary || envelope?.summary || {},
        improvements: parsed?.improvements || parsed?.scores || parsed?.analysis || envelope?.improvements || envelope?.scores || envelope?.analysis || {},
        tags: parsed?.tags || envelope?.tags || {},
        name: parsed?.name || envelope?.name || '',
        title: parsed?.title || envelope?.title || '',
        experienceYears: parsed?.experienceYears ?? parsed?.experience_years ?? envelope?.experienceYears ?? envelope?.experience_years,
        educationLevel: parsed?.educationLevel ?? parsed?.education_level ?? envelope?.educationLevel ?? envelope?.education_level,
        certifications: parsed?.certifications ?? envelope?.certifications,
        languages: parsed?.languages ?? envelope?.languages,
        suggestionsSource: parsed?.suggestions || parsed?.['Key Improvements'] || parsed?.keyImprovements || envelope?.suggestions || envelope?.['Key Improvements'] || envelope?.keyImprovements || parsed,
    };
}

function normalizeSuggestionsBySection(source) {
    const suggestionsSource = source?.suggestions || source?.['Key Improvements'] || source?.keyImprovements || source?.recommendations || source?.sectionSuggestions || source?.section_improvements || source || {};
    return {
        executiveSummary: asSuggestionArray(
            suggestionsSource.executiveSummary
            ?? suggestionsSource.executive_summary
            ?? suggestionsSource.executiveBrief
            ?? suggestionsSource.executive_summary_suggestions
            ?? suggestionsSource.summary
            ?? suggestionsSource.resumeSummary
        ),
        skills: asSuggestionArray(
            suggestionsSource.skills
            ?? suggestionsSource.skillsKeywords
            ?? suggestionsSource.competencies
            ?? suggestionsSource.keywords
            ?? suggestionsSource.skillSuggestions
            ?? suggestionsSource.skills_and_keywords
        ),
        experiences: asSuggestionArray(
            suggestionsSource.experiences
            ?? suggestionsSource.experience
            ?? suggestionsSource.professionalExperience
            ?? suggestionsSource.workExperience
            ?? suggestionsSource.projects
            ?? suggestionsSource.missions
        ),
        education: asSuggestionArray(
            suggestionsSource.education
            ?? suggestionsSource.formation
            ?? suggestionsSource.training
        ),
        hobbiesLanguages: asSuggestionArray(
            suggestionsSource.hobbiesLanguages
            ?? suggestionsSource.hobbies
            ?? suggestionsSource.languages
            ?? suggestionsSource.languagesAndHobbies
            ?? suggestionsSource.languages_hobbies
            ?? suggestionsSource.interests
        ),
        atsOptimization: asSuggestionArray(
            suggestionsSource.atsOptimization
            ?? suggestionsSource.ats
            ?? suggestionsSource.atsCompatibility
            ?? suggestionsSource.atsSuggestions
            ?? suggestionsSource.formatting
        )
    };
}

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
    
    const normalizedSuggestions = normalizeSuggestionsBySection(analysis);

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
        suggestions: normalizedSuggestions
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
        rawAnalysis = parseJsonFromLlmResponse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM analysis response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse invalide. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste.'));
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
        tagsToolsPreview: normalized.tags?.tools?.slice(0, 3),
        suggestionKeys: Object.keys(normalized.suggestions || {}),
        suggestionCounts: Object.fromEntries(Object.entries(normalized.suggestions || {}).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0]))
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
        throw new Error(normalizeUtf8Text('Le texte du CV est trop court pour \u00eatre am\u00e9lior\u00e9 (minimum 100 caract\u00e8res).'));
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

    const rawContent = stripLlmThinkingContent(response.choices[0].message.content);

    safeLog('info', 'LLM Improvement raw response preview:', { 
        isJSON: rawContent.startsWith('{'),
        hasImprovedText: rawContent.includes('"improvedText"'),
        hasImprovedCv: rawContent.includes('"improvedCV"'),
        preview: rawContent.substring(0, 300)
    });

    if (rawContent.startsWith('{')) {
        try {
            const parsed = parseJsonFromLlmResponse(rawContent);
            const improvementPayload = extractImprovementEnvelope(parsed);
            const cleanedText = cleanupHtml(improvementPayload.improvedText || '');

            if (!cleanedText || cleanedText.trim().length === 0) {
                safeLog('error', 'LLM returned empty improved text in JSON response', {
                    topLevelKeys: Object.keys(parsed || {}),
                    envelopeKeys: Object.keys(improvementPayload.envelope || {}),
                    hasTopLevelImprovedText: !!parsed.improvedText,
                    hasEnvelopeImprovedText: !!improvementPayload.envelope?.improvedText,
                    hasEnvelopeStructuredText: !!improvementPayload.envelope?.structuredText,
                    improvedTextLength: improvementPayload.improvedText?.length || 0,
                    cleanedTextLength: cleanedText?.length || 0
                });
                throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 un CV am\u00e9lior\u00e9 vide. Veuillez r\u00e9essayer.'));
}

            const improvements = improvementPayload.improvements || {};
            const summary = improvementPayload.summary || {};
            const tags = improvementPayload.tags || {};
            const normalizedSuggestions = normalizeSuggestionsBySection(improvementPayload.suggestionsSource);

            const result = {
                text: cleanedText,
                analysis: {
                    globalRating: pickNumericScore(improvements.overall, improvements.globalRating, improvements.global, parsed.globalRating),
                    executiveSummaryRating: pickNumericScore(improvements.executiveSummary, improvements.executive_summary, improvements.executiveSummaryRating, improvements.summary),
                    skillsRating: pickNumericScore(improvements.skills, improvements.skillsRating, improvements.competencies),
                    experiencesRating: pickNumericScore(improvements.experience, improvements.experiences, improvements.experienceRating, improvements.experiencesRating),
                    educationRating: pickNumericScore(improvements.education, improvements.educationRating, improvements.formation),
                    atsOptimizationRating: pickNumericScore(improvements.atsOptimization, improvements.ats, improvements.atsOptimizationRating),
                    hobbiesLanguagesRating: pickNumericScore(improvements.languagesInterests, improvements.hobbiesLanguages, improvements.languages, improvements.hobbiesLanguagesRating),
                    suggestions: normalizedSuggestions,
                    tags: {
                        skills: tags.skills || summary.skills || [],
                        industries: tags.industries || summary.industries || [],
                        tools: tags.tools || summary.tools || [],
                        softSkills: tags.softSkills || tags.soft_skills || summary.softSkills || []
                    },
                    name: improvementPayload.name || summary.name || analysis?.name || '',
                    title: summary.targetRole || summary.title || improvementPayload.title || analysis?.title || '',
                    summary: extractStructuredSummaryText(summary),
                    experienceYears: improvementPayload.experienceYears,
                    educationLevel: improvementPayload.educationLevel,
                    certifications: improvementPayload.certifications,
                    languages: improvementPayload.languages
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
            throw new Error(normalizeUtf8Text("Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse JSON invalide pour l'am\u00e9lioration. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste."));
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
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse vide. Veuillez r\u00e9essayer.'));
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





