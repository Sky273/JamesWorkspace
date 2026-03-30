/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import metrics, { buildLLMMetricLabel } from '../metrics.service.js';
import {
    isLikelyAnthropicModel,
    isLikelyDeepSeekModel,
    isLikelyGlmModel,
    isLikelyMiniMaxModel
} from '../llmConfiguration.service.js';
import { cleanupHtml, normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';
import {
    validateResumeAnalysisPayload,
    validateResumeImprovementEnvelope
} from './contracts.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}

function pickNumericScore(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
        const parsed = parseInt(String(value).replace('%', '').trim(), 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
}

function pickNumericScoreOrUndefined(...values) {
    for (const value of values) {
        if (value === undefined || value === null || value === '') continue;
        if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
        const parsed = parseInt(String(value).replace('%', '').trim(), 10);
        if (!Number.isNaN(parsed)) return parsed;
    }
    return undefined;
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

function looksLikeHtml(value) {
    return typeof value === 'string' && /<\/?[a-z][^>]*>/i.test(value);
}

function collectImprovementCandidates(...candidates) {
    return candidates
        .filter(candidate => typeof candidate === 'string')
        .map(candidate => candidate.trim())
        .filter(Boolean);
}

function normalizeStringArray(value) {
    if (value === null || value === undefined) return [];

    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed ? [trimmed] : [];
    }

    if (Array.isArray(value)) {
        return [...new Set(value.flatMap(normalizeStringArray).filter(Boolean))];
    }

    if (typeof value === 'object') {
        const directValues = ['label', 'name', 'title', 'text', 'value']
            .map((key) => value[key])
            .filter((candidate) => typeof candidate === 'string' && candidate.trim())
            .map((candidate) => candidate.trim());

        if (directValues.length > 0) {
            return [...new Set(directValues)];
        }

        return [...new Set(Object.values(value).flatMap(normalizeStringArray).filter(Boolean))];
    }

    return [];
}

function pickFirstNonEmptyArray(...values) {
    for (const value of values) {
        const normalized = normalizeStringArray(value);
        if (normalized.length > 0) {
            return normalized;
        }
    }

    return [];
}

function pickImprovedHtmlCandidate(...candidates) {
    const normalizedCandidates = collectImprovementCandidates(...candidates);
    const htmlCandidate = normalizedCandidates.find(looksLikeHtml);
    return htmlCandidate || normalizedCandidates[0] || '';
}

function finalizeImprovedOutput({ sourceText, selectedText, htmlAlternatives = [], context = {} }) {
    const normalizedSelected = typeof selectedText === 'string' ? cleanupHtml(selectedText) : '';
    const normalizedAlternatives = collectImprovementCandidates(...htmlAlternatives).map(candidate => cleanupHtml(candidate));
    const bestHtmlAlternative = normalizedAlternatives.find(looksLikeHtml) || '';
    const sourceLooksLikeHtml = looksLikeHtml(sourceText);
    const selectedLooksLikeHtml = looksLikeHtml(normalizedSelected);

    if (!normalizedSelected) {
        return normalizedSelected;
    }

    if (!selectedLooksLikeHtml && bestHtmlAlternative) {
        safeLog('warn', 'LLM improvement output was flattened; using structured HTML alternative', {
            ...context,
            selectedLength: normalizedSelected.length,
            alternativeLength: bestHtmlAlternative.length
        });
        return bestHtmlAlternative;
    }

    if (!selectedLooksLikeHtml && sourceLooksLikeHtml) {
        safeLog('warn', 'LLM improvement output lost HTML structure with no structured fallback available', {
            ...context,
            selectedLength: normalizedSelected.length,
            sourceLength: sourceText.length
        });
    }

    return normalizedSelected;
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

    const htmlCandidates = collectImprovementCandidates(
        parsed?.structuredText,
        envelope?.structuredText,
        parsed?.html,
        envelope?.html,
        parsed?.improvedText,
        envelope?.improvedText,
        parsed?.content,
        envelope?.content,
        parsed?.text,
        envelope?.text
    ).filter(looksLikeHtml);

    const textCandidates = collectImprovementCandidates(
        parsed?.improvedText,
        envelope?.improvedText,
        parsed?.content,
        envelope?.content,
        parsed?.text,
        envelope?.text
    );

    return {
        envelope,
        improvedText: htmlCandidates[0] || textCandidates[0] || '',
        htmlAlternatives: htmlCandidates,
        summary: parsed?.summary || envelope?.summary || {},
        improvements: parsed?.improvements || parsed?.scores || parsed?.analysis || envelope?.improvements || envelope?.scores || envelope?.analysis || {},
        tags: {
            ...(parsed?.tags && typeof parsed.tags === 'object' ? parsed.tags : {}),
            ...(envelope?.tags && typeof envelope.tags === 'object' ? envelope.tags : {}),
            skills: pickFirstNonEmptyArray(
                parsed?.tags?.skills,
                envelope?.tags?.skills,
                parsed?.skills,
                envelope?.skills,
                parsed?.competencies,
                envelope?.competencies,
                parsed?.keywords,
                envelope?.keywords,
                parsed?.summary?.skills,
                envelope?.summary?.skills
            ),
            industries: pickFirstNonEmptyArray(
                parsed?.tags?.industries,
                envelope?.tags?.industries,
                parsed?.industries,
                envelope?.industries,
                parsed?.summary?.industries,
                envelope?.summary?.industries
            ),
            tools: pickFirstNonEmptyArray(
                parsed?.tags?.tools,
                envelope?.tags?.tools,
                parsed?.tools,
                envelope?.tools,
                parsed?.technologies,
                envelope?.technologies,
                parsed?.summary?.tools,
                envelope?.summary?.tools
            ),
            softSkills: pickFirstNonEmptyArray(
                parsed?.tags?.softSkills,
                envelope?.tags?.softSkills,
                parsed?.tags?.soft_skills,
                envelope?.tags?.soft_skills,
                parsed?.softSkills,
                envelope?.softSkills,
                parsed?.soft_skills,
                envelope?.soft_skills,
                parsed?.summary?.softSkills,
                envelope?.summary?.softSkills
            )
        },
        name: parsed?.name || envelope?.name || '',
        title: parsed?.title || envelope?.title || '',
        experienceYears: parsed?.experienceYears ?? parsed?.experience_years ?? envelope?.experienceYears ?? envelope?.experience_years,
        educationLevel: parsed?.educationLevel ?? parsed?.education_level ?? envelope?.educationLevel ?? envelope?.education_level,
        certifications: parsed?.certifications ?? envelope?.certifications,
        languages: parsed?.languages ?? envelope?.languages,
        suggestionsSource: parsed?.suggestions || parsed?.['Key Improvements'] || parsed?.keyImprovements || parsed?.recommendations || parsed?.sectionSuggestions || parsed?.section_improvements || envelope?.suggestions || envelope?.['Key Improvements'] || envelope?.keyImprovements || envelope?.recommendations || envelope?.sectionSuggestions || envelope?.section_improvements || null,
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

function normalizeAnalysisResponse(analysis) {
    analysis = validateResumeAnalysisPayload(analysis);
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
    normalized['Key Improvements'] = normalized.suggestions;
    normalized['Summary'] = analysis['Summary'] || analysis.summary || '';
    
    if (analysis.structuredText) {
        normalized.structuredText = analysis.structuredText;
    }
    
    return normalized;
}

export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);
    
    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }
    
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

    if (process.env.NODE_ENV === 'development' || process.env.DEBUG_LLM === 'true') {
        safeLog('debug', '========== LLM IMPROVEMENT PROMPT DEBUG ==========');
        safeLog('debug', 'Model:', { model });
        safeLog('debug', 'Prompt length:', { length: improvementPrompt.length });
        safeLog('debug', '--- FULL PROMPT ---');
        safeLog('debug', improvementPrompt);
        safeLog('debug', '--- END PROMPT ---');
    }

    if (!text || text.trim().length < 100) {
        safeLog('error', 'Improvement input text too short', { 
            textLength: text?.length || 0,
            minRequired: 100
        });
        throw new Error(normalizeUtf8Text('Le texte du CV est trop court pour \u00eatre am\u00e9lior\u00e9 (minimum 100 caract\u00e8res).'));
}

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);

    let response;
    try {
        response = await callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: 'You are a professional resume improvement assistant. You MUST respond with valid JSON only, following the exact structure specified in the user prompt. Do not include any text outside the JSON object.' },
                { role: 'user', content: improvementPrompt }
            ],
            maxTokens: 16384,
            temperature: 0.3,
            responseFormat: { type: "json_object" },
            timeout: 300000,
            userMetadata,
            operationType: 'Resume Improvement'
        });
    } catch (error) {
        metrics.trackImprovementActivity({
            provider: metricsProvider,
            event: 'run',
            failedRuns: 1,
            inputChars: text.length,
            metadata: { source: 'provider-call', error: error.message }
        });
        throw error;
    }

    const rawContent = stripLlmThinkingContent(response.choices[0].message.content);

    safeLog('info', 'LLM Improvement raw response preview:', { 
        isJSON: rawContent.startsWith('{'),
        hasImprovedText: rawContent.includes('"improvedText"'),
        hasImprovedCv: rawContent.includes('"improvedCV"'),
        preview: rawContent.substring(0, 300)
    });

    if (rawContent.startsWith('{')) {
        try {
            const parsed = validateResumeImprovementEnvelope(parseJsonFromLlmResponse(rawContent));
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

            const analysisResult = {
                suggestions: normalizedSuggestions,
                tags: {
                    skills: pickFirstNonEmptyArray(tags.skills, summary.skills),
                    industries: pickFirstNonEmptyArray(tags.industries, summary.industries),
                    tools: pickFirstNonEmptyArray(tags.tools, summary.tools),
                    softSkills: pickFirstNonEmptyArray(tags.softSkills, tags.soft_skills, summary.softSkills)
                },
                name: improvementPayload.name || summary.name || analysis?.name || '',
                title: summary.targetRole || summary.title || improvementPayload.title || analysis?.title || '',
                summary: extractStructuredSummaryText(summary),
                experienceYears: improvementPayload.experienceYears,
                educationLevel: improvementPayload.educationLevel,
                certifications: improvementPayload.certifications,
                languages: improvementPayload.languages
            };

            const globalRating = pickNumericScoreOrUndefined(improvements.overall, improvements.globalRating, improvements.global, parsed.globalRating);
            const executiveSummaryRating = pickNumericScoreOrUndefined(improvements.executiveSummary, improvements.executive_summary, improvements.executiveSummaryRating, improvements.summary);
            const skillsRating = pickNumericScoreOrUndefined(improvements.skills, improvements.skillsRating, improvements.competencies);
            const experiencesRating = pickNumericScoreOrUndefined(improvements.experience, improvements.experiences, improvements.experienceRating, improvements.experiencesRating);
            const educationRating = pickNumericScoreOrUndefined(improvements.education, improvements.educationRating, improvements.formation);
            const atsOptimizationRating = pickNumericScoreOrUndefined(improvements.atsOptimization, improvements.ats, improvements.atsOptimizationRating);
            const hobbiesLanguagesRating = pickNumericScoreOrUndefined(improvements.languagesInterests, improvements.hobbiesLanguages, improvements.languages, improvements.hobbiesLanguagesRating);

            if (globalRating !== undefined) analysisResult.globalRating = globalRating;
            if (executiveSummaryRating !== undefined) analysisResult.executiveSummaryRating = executiveSummaryRating;
            if (skillsRating !== undefined) analysisResult.skillsRating = skillsRating;
            if (experiencesRating !== undefined) analysisResult.experiencesRating = experiencesRating;
            if (educationRating !== undefined) analysisResult.educationRating = educationRating;
            if (atsOptimizationRating !== undefined) analysisResult.atsOptimizationRating = atsOptimizationRating;
            if (hobbiesLanguagesRating !== undefined) analysisResult.hobbiesLanguagesRating = hobbiesLanguagesRating;

            const result = {
                text: cleanedText,
                analysis: analysisResult
            };

            metrics.trackImprovementActivity({
                provider: metricsProvider,
                event: 'run',
                successfulRuns: 1,
                structuredRuns: 1,
                inputChars: text.length,
                outputChars: cleanedText.length,
                metadata: { source: 'structured-json' }
            });

            safeLog('info', 'Parsed improvement result:', {
                hasText: !!result.text,
                textLength: result.text?.length,
                analysis: result.analysis
            });

            return result;
        } catch (parseError) {
            safeLog('error', 'Failed to parse LLM improvement response as JSON', {
                error: parseError.message,
                model,
                responsePreview: rawContent.substring(0, 500)
            });
            metrics.trackImprovementActivity({
                provider: metricsProvider,
                event: 'run',
                failedRuns: 1,
                inputChars: text.length,
                metadata: { source: 'structured-json', error: parseError.message }
            });
            throw new Error(normalizeUtf8Text("Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse JSON invalide pour l'am\u00e9lioration. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste."));
}
    }

    const cleanedText = finalizeImprovedOutput({
        sourceText: text,
        selectedText: rawContent,
        context: { fallback: true }
    });
    
    if (!cleanedText || cleanedText.trim().length === 0) {
        safeLog('error', 'LLM returned empty content in fallback (non-JSON) response', {
            rawContentLength: rawContent?.length || 0,
            cleanedTextLength: cleanedText?.length || 0,
            rawContentPreview: rawContent?.substring(0, 200)
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse vide. Veuillez r\u00e9essayer.'));
}

    metrics.trackImprovementActivity({
        provider: metricsProvider,
        event: 'run',
        successfulRuns: 1,
        fallbackRuns: 1,
        inputChars: text.length,
        outputChars: cleanedText.length,
        metadata: { source: 'plain-text-fallback' }
    });
    
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


