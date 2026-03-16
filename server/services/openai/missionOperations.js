/**
 * OpenAI Mission Operations
 * Resume-mission matching and adaptation using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { callOpenAI } from './apiClient.js';

/**
 * Match resume with mission using OpenAI
 * @param {string} resumeText - Resume text
 * @param {string} missionTitle - Mission title
 * @param {string} missionContent - Mission content
 * @param {string} model - OpenAI model to use
 * @param {string} matchAnalysisPrompt - Match analysis prompt template
 * @returns {Promise<Object>} - Parsed match analysis result
 */
export async function matchResumeWithMission(resumeText, missionTitle, missionContent, model, matchAnalysisPrompt, userMetadata = null) {
    const prompt = matchAnalysisPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent);

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: 'You are a JSON-only resume-mission matching API. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
        ],
        maxTokens: 2048,
        temperature: 0.3,
        responseFormat: { type: "json_object" },
        userMetadata,
        operationType: 'Resume-Mission Matching'
    });

    try {
        return JSON.parse(response.choices[0].message.content);
    } catch (parseError) {
        safeLog('error', 'Failed to parse LLM matching response as JSON', {
            error: parseError.message,
            responsePreview: response.choices[0].message.content.substring(0, 500)
        });
        throw new Error('Le modèle LLM a retourné une réponse invalide pour le matching. Veuillez réessayer ou contacter le support si le problème persiste.');
    }
}

/**
 * Adapt resume to mission using OpenAI
 * @param {Object} params - Adaptation parameters
 * @param {string} params.resumeText - Resume text
 * @param {string} params.resumeAnalysis - Resume analysis
 * @param {string} params.missionTitle - Mission title
 * @param {string} params.missionContent - Mission content
 * @param {Object} params.matchAnalysis - Match analysis result
 * @param {string} params.model - OpenAI model to use
 * @param {string} params.adaptationPrompt - Adaptation prompt template
 * @returns {Promise<string>} - Adapted resume text
 */
export async function adaptResumeToMission({
    resumeText,
    resumeAnalysis,
    missionTitle,
    missionContent,
    matchAnalysis,
    model,
    adaptationPrompt,
    userMetadata = null
}) {
    const prompt = adaptationPrompt
        .replace('{RESUME_TEXT}', resumeText)
        .replace('{RESUME_ANALYSIS}', resumeAnalysis || 'No analysis available')
        .replace('{MISSION_TITLE}', missionTitle)
        .replace('{MISSION_CONTENT}', missionContent)
        .replace('{MATCH_ANALYSIS}', JSON.stringify(matchAnalysis, null, 2));

    const systemPrompt = `You are an expert HR consultant. You must respond with a valid JSON object containing exactly two fields:
1. "adaptedTitle": A professional title (in the same language as the resume) adapted/optimized for the target mission. This should be a concise job title (e.g. "Développeur Full Stack Senior", "Chef de Projet Digital") that best positions the candidate for this specific mission. Maximum 100 characters.
2. "adaptedText": The full adapted resume in clean HTML format.

Example response format:
{"adaptedTitle": "Consultant Data Engineer Senior", "adaptedText": "<h2>...</h2><p>...</p>"}

Do NOT wrap your response in markdown code blocks. Return ONLY the JSON object.`;

    const response = await callOpenAI({
        model,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ],
        maxTokens: 4096,
        temperature: 0.4,
        timeout: 120000,
        userMetadata,
        operationType: 'Resume Adaptation'
    });

    // Clean markdown code blocks if present
    let content = response.choices[0].message.content;
    content = content.replace(/^```json\s*/i, '').replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();
    
    // Try to parse as JSON to extract adaptedTitle and adaptedText
    try {
        const parsed = JSON.parse(content);
        if (parsed.adaptedText && parsed.adaptedTitle) {
            return {
                adaptedText: parsed.adaptedText,
                adaptedTitle: parsed.adaptedTitle
            };
        }
    } catch {
        // If JSON parsing fails, fall back to treating the whole content as adaptedText
        safeLog('warn', 'adaptResumeToMission: Could not parse JSON response, falling back to plain text');
    }
    
    return {
        adaptedText: content,
        adaptedTitle: null
    };
}
