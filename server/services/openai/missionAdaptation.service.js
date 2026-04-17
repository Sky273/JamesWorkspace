import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { metrics } from '../metrics.service.js';
import { parseJsonFromLlmResponse, stripLlmThinkingContent } from './textUtils.js';
import { validateAdaptationPayload } from './contracts.js';
import { buildAdaptationResult } from './missionNormalization.js';

export async function executeMissionAdaptation({
    resumeText,
    missionTitle,
    missionContent,
    prompt,
    model,
    userMetadata = null,
    maxTokens = null,
    metricsProvider
}) {
    const systemPrompt = `You are an expert HR consultant specialized in CV adaptation. 
You must respond with a valid JSON object following the exact structure specified in the user prompt.
Do NOT wrap your response in markdown code blocks. Return ONLY the JSON object.
Respond in the same language as the resume.`;

    const inputChars = resumeText.length + missionTitle.length + missionContent.length;
    let response;
    try {
        response = await callBusinessChatCompletion({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            maxTokens: maxTokens ?? 8192,
            temperature: 0.4,
            timeout: LLM_OPERATION_TIMEOUT_MS,
            responseFormat: { type: 'json_object' },
            userMetadata,
            operationType: 'Resume Adaptation'
        });
    } catch (error) {
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'run',
            failedRuns: 1,
            inputChars,
            metadata: { source: 'adapt-provider-call', error: error.message, ...(userMetadata?.promptMetadata || {}) }
        });
        throw error;
    }

    const content = stripLlmThinkingContent(response.choices[0].message.content);

    try {
        const parsed = validateAdaptationPayload(parseJsonFromLlmResponse(content));
        const result = buildAdaptationResult(parsed, content);
        metrics.trackAdaptationActivity({
            provider: metricsProvider,
            event: 'run',
            successfulRuns: 1,
            inputChars,
            ...result.tracking,
            metadata: {
                ...(result.tracking?.metadata || {}),
                resumeSource: userMetadata?.resumeSource || 'unknown',
                ...(userMetadata?.promptMetadata || {})
            }
        });
        return {
            adaptedText: result.adaptedText,
            adaptedTitle: result.adaptedTitle,
            ...(result.structuredData ? { structuredData: result.structuredData } : {})
        };
    } catch {
        safeLog('warn', 'adaptResumeToMission: Could not parse JSON response, falling back to plain text');
    }

    metrics.trackAdaptationActivity({
        provider: metricsProvider,
        event: 'run',
        successfulRuns: 1,
        fallbackRuns: 1,
        inputChars,
        outputChars: content.length,
        metadata: {
            source: 'plain-text-fallback',
            resumeSource: userMetadata?.resumeSource || 'unknown',
            ...(userMetadata?.promptMetadata || {})
        }
    });

    return {
        adaptedText: content,
        adaptedTitle: null
    };
}
