/**
 * OpenAI Mission Operations
 * Resume-mission matching and adaptation using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';

/**
 * Match resume with mission using OpenAI
 * @param {string} resumeText - Resume text
 * @param {string} missionTitle - Mission title
 * @param {string} missionContent - Mission content
 * @param {string} model - OpenAI model to use
 * @param {string} matchAnalysisPrompt - Match analysis prompt template
 * @returns {Promise<Object>} - Parsed match analysis result (normalized for frontend compatibility)
 */
export async function matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchAnalysisPrompt, userMetadata = null) {
    const prompt = matchAnalysisPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent);

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only resume-mission matching API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 4096,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Resume-Mission Matching'
    });

    try {
        const rawAnalysis = parseJsonFromLlmResponse(response.choices[0].message.content);
        // Normalize the response to ensure frontend compatibility while preserving full data
        return normalizeMatchAnalysis(rawAnalysis);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM matching response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error(normalizeUtf8Text('Le mod\u00e8le LLM a retourn\u00e9 une r\u00e9ponse invalide pour le matching. Veuillez r\u00e9essayer ou contacter le support si le probl\u00e8me persiste.'));
}
}

/**
 * Normalize match analysis response to ensure frontend compatibility
 * Handles both old format (simple arrays) and new format (structured objects)
 * @param {Object} analysis - Raw LLM analysis response
 * @returns {Object} - Normalized analysis with both legacy and new fields
 */
function normalizeMatchAnalysis(analysis) {
    const normalized = { ...analysis };
    
    // Normalize matchScore (ensure it's a number)
    if (typeof normalized.matchScore === 'string') {
        normalized.matchScore = parseInt(normalized.matchScore.replace('%', ''), 10) || 0;
    }
    
    // Normalize strengths: convert [{item, evidence, coverage}] to string[] for frontend
    if (Array.isArray(normalized.strengths) && normalized.strengths.length > 0) {
        if (typeof normalized.strengths[0] === 'object' && normalized.strengths[0].item) {
            // New format: preserve original and create legacy format
            normalized._strengthsDetailed = normalized.strengths;
            normalized.strengths = normalized.strengths.map(s => {
                const coverage = s.coverage === 'explicit' ? '\u2713' : s.coverage === 'partial' ? '~' : '';
                return `${coverage} ${s.item}${s.evidence ? ` (${s.evidence})` : ''}`.trim();
            });
        }
    }
    
    // Normalize gaps: convert [{item, reason, severity}] to string[] for frontend
    if (Array.isArray(normalized.gaps) && normalized.gaps.length > 0) {
        if (typeof normalized.gaps[0] === 'object' && normalized.gaps[0].item) {
            // New format: preserve original and create legacy format
            normalized._gapsDetailed = normalized.gaps;
            normalized.gaps = normalized.gaps.map(g => {
                const severity = g.severity === 'high' ? '\u26a0\ufe0f' : g.severity === 'medium' ? '\u26a1' : '';
                return `${severity} ${g.item}${g.reason ? ` - ${g.reason}` : ''}`.trim();
            });
        }
    }
    
    // Normalize keywordAnalysis to legacy keywordMatches/missingKeywords
    if (normalized.keywordAnalysis) {
        normalized._keywordAnalysisDetailed = normalized.keywordAnalysis;
        
        // Extract matched keywords
        if (normalized.keywordAnalysis.matchedKeywords) {
            normalized.keywordMatches = normalized.keywordAnalysis.matchedKeywords.map(k => 
                typeof k === 'string' ? k : k.keyword
            );
        }
        
        // Extract partial keywords and add to matches with indicator
        if (normalized.keywordAnalysis.partialKeywords) {
            const partialKeywords = normalized.keywordAnalysis.partialKeywords.map(k => 
                typeof k === 'string' ? `~${k}` : `~${k.keyword}`
            );
            normalized.keywordMatches = [...(normalized.keywordMatches || []), ...partialKeywords];
        }
        
        // Extract missing keywords
        if (normalized.keywordAnalysis.missingKeywords) {
            normalized.missingKeywords = normalized.keywordAnalysis.missingKeywords.map(k => 
                typeof k === 'string' ? k : k.keyword
            );
        }
    }
    
    // Normalize recommendations to legacy format if needed
    if (normalized.recommendations && typeof normalized.recommendations === 'object') {
        // New format has executiveSummary, title, skills, experience, education, atsOptimization, priorityActions
        // Legacy format expects executiveSummary, skills, experience, education, atsOptimization
        // Keep as-is since frontend already handles object format
        normalized._recommendationsDetailed = normalized.recommendations;
    }
    
    // Preserve summary, scoreBreakdown, requirementsAnalysis, rewriteGuardrails for detailed views
    // These are new fields that the frontend can optionally display
    
    safeLog('debug', 'Normalized match analysis', {
        hasScoreBreakdown: !!normalized.scoreBreakdown,
        hasSummary: !!normalized.summary,
        strengthsCount: normalized.strengths?.length || 0,
        gapsCount: normalized.gaps?.length || 0,
        keywordMatchesCount: normalized.keywordMatches?.length || 0,
        missingKeywordsCount: normalized.missingKeywords?.length || 0
    });
    
    return normalized;
}

/**
 * Adapt resume to mission using OpenAI
 * @param {Object} params - Adaptation parameters
 * @param {string} params.resumeText - Resume text
 * @param {string} params.missionTitle - Mission title
 * @param {string} params.missionContent - Mission content
 * @param {Object} params.matchAnalysis - Match analysis result
 * @param {string} params.model - OpenAI model to use
 * @param {string} params.adaptationPrompt - Adaptation prompt template (with {ACCEPTED_INDUSTRIES}, {ANONYMIZATION_RULES}, {FILENAME} already injected)
 * @returns {Promise<Object>} - { adaptedText, adaptedTitle, structuredData }
 */
export async function adaptResumeToMission({
    resumeText,
    missionTitle,
    missionContent,
    matchAnalysis,
    model,
    adaptationPrompt,
    userMetadata = null
}) {
    const matchAnalysisStr = JSON.stringify(matchAnalysis, null, 2);
    const prompt = adaptationPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent)
        // New placeholder name used by the updated default prompt
        .replace('{MATCH_ANALYSIS_JSON}', matchAnalysisStr)
        // Legacy placeholder for backward-compatibility with user-customized prompts
        .replace('{MATCH_ANALYSIS}', matchAnalysisStr);

    const systemPrompt = `You are an expert HR consultant specialized in CV adaptation. 
You must respond with a valid JSON object following the exact structure specified in the user prompt.
Do NOT wrap your response in markdown code blocks. Return ONLY the JSON object.
Respond in the same language as the resume.`;

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ],
        maxTokens: 8192,
        temperature: 0.4,
        timeout: 120000,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Resume Adaptation'
    });

    // Clean markdown code blocks if present
    const content = stripLlmThinkingContent(response.choices[0].message.content);
    
    // Parse the structured JSON response
    try {
        const parsed = parseJsonFromLlmResponse(content);
        
        // New format: { name, summary, improvedText, improvements }
        if (parsed.improvedText !== undefined) {
            const adaptedTitle = parsed.summary?.title || parsed.summary?.targetRole || null;
            return {
                adaptedText: parsed.improvedText,
                adaptedTitle: adaptedTitle,
                structuredData: parsed
            };
        }

        // Legacy structured format with targetedTitle, professionalSummary, etc.
        if (parsed.targetedTitle !== undefined) {
            // Convert structured JSON to HTML for display
            const adaptedText = convertAdaptationToHtml(parsed);
            return {
                adaptedText,
                adaptedTitle: parsed.targetedTitle || null,
                structuredData: parsed
            };
        }
        
        // Legacy format support: {adaptedTitle, adaptedText}
        if (parsed.adaptedText && parsed.adaptedTitle) {
            return {
                adaptedText: parsed.adaptedText,
                adaptedTitle: parsed.adaptedTitle
            };
        }
        
        // If JSON but unknown format, return as-is
        safeLog('warn', 'adaptResumeToMission: Unknown JSON format, returning raw content');
        return {
            adaptedText: content,
            adaptedTitle: null,
            structuredData: parsed
        };
    } catch {
        // If JSON parsing fails, fall back to treating the whole content as adaptedText
        safeLog('warn', 'adaptResumeToMission: Could not parse JSON response, falling back to plain text');
    }
    
    return {
        adaptedText: content,
        adaptedTitle: null
    };
}

/**
 * Convert structured adaptation JSON to HTML for display
 * @param {Object} data - Structured adaptation data
 * @returns {string} - HTML representation
 */
function convertAdaptationToHtml(data) {
    const sections = [];
    
    // Professional Summary
    if (data.professionalSummary) {
        sections.push(`<h2>R\u00e9sum\u00e9 Professionnel</h2>\n<p>${data.professionalSummary}</p>`);
    }
    
    // Key Skills
    if (data.keySkills && data.keySkills.length > 0) {
        sections.push(`<h2>Comp\u00e9tences Cl\u00e9s</h2>\n<ul>\n${data.keySkills.map(s => `  <li>${s}</li>`).join('\n')}\n</ul>`);
    }
    
    // Tools and Technologies
    if (data.toolsAndTechnologies && data.toolsAndTechnologies.length > 0) {
        sections.push(`<h2>Outils et Technologies</h2>\n<p>${data.toolsAndTechnologies.join(', ')}</p>`);
    }
    
    // Professional Experience
    if (data.professionalExperience && data.professionalExperience.length > 0) {
        const expHtml = data.professionalExperience.map(exp => {
            const header = `<h3>${exp.jobTitle || ''}${exp.company ? ` - ${exp.company}` : ''}${exp.dates ? ` (${exp.dates})` : ''}</h3>`;
            const context = exp.context ? `<p><em>${exp.context}</em></p>` : '';
            const missions = exp.missions && exp.missions.length > 0 
                ? `<ul>\n${exp.missions.map(m => `  <li>${m}</li>`).join('\n')}\n</ul>` 
                : '';
            const techs = exp.technologies && exp.technologies.length > 0 
                ? `<p><strong>Technologies:</strong> ${exp.technologies.join(', ')}</p>` 
                : '';
            return `${header}\n${context}${missions}${techs}`;
        }).join('\n\n');
        sections.push(`<h2>Exp\u00e9rience Professionnelle</h2>\n${expHtml}`);
    }
    
    // Education
    if (data.education && data.education.length > 0) {
        const eduItems = Array.isArray(data.education) 
            ? data.education.map(e => typeof e === 'string' ? e : `${e.degree || ''} - ${e.institution || ''} ${e.year || ''}`).join('</li>\n  <li>')
            : data.education;
        sections.push(`<h2>Formation</h2>\n<ul>\n  <li>${eduItems}</li>\n</ul>`);
    }
    
    // Certifications
    if (data.certifications && data.certifications.length > 0) {
        sections.push(`<h2>Certifications</h2>\n<ul>\n${data.certifications.map(c => `  <li>${c}</li>`).join('\n')}\n</ul>`);
    }
    
    // Languages
    if (data.languages && data.languages.length > 0) {
        sections.push(`<h2>Langues</h2>\n<ul>\n${data.languages.map(l => `  <li>${l}</li>`).join('\n')}\n</ul>`);
    }
    
    return sections.join('\n\n');
}



