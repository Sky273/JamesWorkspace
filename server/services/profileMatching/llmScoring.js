import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { getLLMSettings } from '../settings.service.js';
import { BATCH_PROFILE_SCORING_PROMPT } from '../../config/prompts.backend.js';
import { normalizeUtf8Text, parseJsonFromLlmResponse } from '../openai/textUtils.js';
import {
    PROFILE_MATCHING_LLM_BATCH_SIZE,
    PROFILE_MATCHING_LLM_MAX_CONCURRENCY
} from '../../config/constants.js';
import { metrics, buildLLMMetricLabel } from '../metrics.service.js';
import { safeLog } from '../../utils/logger.backend.js';
import { PROFILE_MATCHING_EXPLANATION_MAX_CONCURRENCY } from './constants.js';
import {
    buildExplanationPayload,
    buildProfileExplanationPrompt
} from './explanations.js';
import { validateBatchProfileScoringPayload } from './contracts.js';

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

export function isRecoverableBatchScoringError(error) {
    const message = error?.message || '';
    return message.includes('Unexpected end of JSON input')
        || message.includes('Unterminated string in JSON')
        || message.includes('DeepSeek response truncated due to token limit');
}

export function isRecoverableJsonOutputError(error) {
    return isRecoverableBatchScoringError(error);
}

export async function scoreBatchWithLLM(profiles, missionKeywords, missionRecord, userMetadata = null, options = {}) {
    if (!profiles || profiles.length === 0) {
        return { scores: {}, success: true };
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;

    if (!model && settings.llmProvider !== 'ollama') {
        safeLog('warn', 'LLM model not configured, skipping LLM scoring');
        return { scores: {}, success: false, error: 'LLM model not configured' };
    }

    const isMiniMaxProvider = settings.llmProvider === 'minimax';
    const isDeepSeekProvider = settings.llmProvider === 'deepseek';
    const isDeepSeekReasoner = isDeepSeekProvider && model === 'deepseek-reasoner';
    const supportsStructuredJsonResponse = settings.llmProvider === 'deepseek';
    const providerDefaultBatchSize = isDeepSeekProvider ? 4 : (isMiniMaxProvider ? 6 : 12);
    const batchSize = PROFILE_MATCHING_LLM_BATCH_SIZE > 0
        ? Math.min(PROFILE_MATCHING_LLM_BATCH_SIZE, 100)
        : providerDefaultBatchSize;
    const providerDefaultConcurrency = isDeepSeekReasoner ? 2 : (isMiniMaxProvider ? 3 : 5);
    const maxConcurrency = PROFILE_MATCHING_LLM_MAX_CONCURRENCY > 0
        ? Math.min(PROFILE_MATCHING_LLM_MAX_CONCURRENCY, 100)
        : providerDefaultConcurrency;
    const scoringMaxTokens = Number.isInteger(options.maxTokens) && options.maxTokens > 0
        ? options.maxTokens
        : (isDeepSeekReasoner ? 8192 : (isDeepSeekProvider ? 4096 : 2048));
    const batches = chunkArray(profiles, batchSize);
    const allScores = {};
    let hasErrors = false;
    const metricsProvider = buildLLMMetricLabel(settings.llmProvider || 'unknown', model || '');

    metrics.trackProfileMatchingActivity({
        provider: metricsProvider,
        event: 'search',
        profilesRequested: profiles.length,
        batchesStarted: batches.length,
        metadata: {
            batchCount: batches.length,
            batchSize,
            maxConcurrency
        }
    });

    safeLog('info', 'Starting LLM batch scoring', {
        totalProfiles: profiles.length,
        batchCount: batches.length,
        batchSize,
        maxConcurrency,
        providerDefaultBatchSize,
        providerDefaultConcurrency,
        scoringMaxTokens
    });

    async function processBatch(batch, batchIndex, depth = 0) {
        const candidatesData = batch.map(p => ({
            id: p.resumeId,
            title: p.title || normalizeUtf8Text('Non spécifié'),
            skills: (p.resumeTags?.skills || []).slice(0, 6),
            tools: (p.resumeTags?.tools || []).slice(0, 5),
            industries: (p.resumeTags?.industries || []).slice(0, 3),
            softSkills: (p.resumeTags?.softSkills || []).slice(0, 4)
        }));

        const candidatesJson = JSON.stringify(candidatesData);

        const prompt = BATCH_PROFILE_SCORING_PROMPT
            .replace('{MISSION_TITLE}', missionRecord.title || '')
            .replace('{MISSION_SKILLS}', (missionKeywords.skills || []).join(', ') || normalizeUtf8Text('Non spécifié'))
            .replace('{MISSION_TOOLS}', (missionKeywords.tools || []).join(', ') || normalizeUtf8Text('Non spécifié'))
            .replace('{MISSION_INDUSTRIES}', (missionKeywords.industries || []).join(', ') || normalizeUtf8Text('Non spécifié'))
            .replace('{MISSION_SOFT_SKILLS}', (missionKeywords.softSkills || []).join(', ') || normalizeUtf8Text('Non spécifié'))
            .replace('{EXPERIENCE_LEVEL}', missionKeywords.experienceLevel || normalizeUtf8Text('Non spécifié'))
            .replace('{CANDIDATES_JSON}', candidatesJson);

        try {
            const response = await callBusinessChatCompletion({
                model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only HR analysis API specialized in IT/IS profile matching. Respond with valid JSON only.' },
                    { role: 'user', content: prompt }
                ],
                maxTokens: scoringMaxTokens,
                temperature: 0.3,
                responseFormat: supportsStructuredJsonResponse ? { type: 'json_object' } : undefined,
                userMetadata,
                operationType: 'Batch Profile Scoring'
            });

            const result = validateBatchProfileScoringPayload(
                parseJsonFromLlmResponse(response.choices[0].message.content),
                metricsProvider
            );
            safeLog('debug', 'Batch scoring completed', {
                batchIndex: batchIndex + 1,
                totalBatches: batches.length,
                batchDepth: depth,
                scoresReturned: Object.keys(result.scores || {}).length,
                normalizationCount: result.metadata.normalizationCount
            });
            return result.scores || {};
        } catch (error) {
            if (batch.length > 1 && isRecoverableBatchScoringError(error)) {
                const midpoint = Math.ceil(batch.length / 2);
                const leftBatch = batch.slice(0, midpoint);
                const rightBatch = batch.slice(midpoint);

                safeLog('warn', 'LLM scoring batch returned malformed JSON, retrying with smaller sub-batches', {
                    batchIndex,
                    batchSize: batch.length,
                    leftBatchSize: leftBatch.length,
                    rightBatchSize: rightBatch.length,
                    batchDepth: depth,
                    error: error.message
                });

                metrics.trackProfileMatchingActivity({
                    provider: metricsProvider,
                    event: 'retry',
                    batchesRetried: 1,
                    metadata: {
                        batchIndex,
                        batchDepth: depth,
                        batchSize: batch.length,
                        leftBatchSize: leftBatch.length,
                        rightBatchSize: rightBatch.length
                    }
                });

                const [leftScores, rightScores] = await Promise.all([
                    processBatch(leftBatch, batchIndex, depth + 1),
                    processBatch(rightBatch, batchIndex, depth + 1)
                ]);

                return {
                    ...leftScores,
                    ...rightScores
                };
            }

            throw error;
        }
    }

    for (let waveStart = 0; waveStart < batches.length; waveStart += maxConcurrency) {
        const wave = batches.slice(waveStart, waveStart + maxConcurrency);
        const wavePromises = wave.map((batch, i) =>
            processBatch(batch, waveStart + i).catch(error => {
                safeLog('error', 'LLM scoring batch failed', {
                    batchIndex: waveStart + i,
                    error: error.message
                });
                hasErrors = true;
                return {};
            })
        );

        const waveResults = await Promise.all(wavePromises);
        for (const scores of waveResults) {
            Object.assign(allScores, scores);
        }

        const waveScored = waveResults.reduce((total, scores) => total + Object.keys(scores).length, 0);
        const failedBatchCount = waveResults.filter(scores => Object.keys(scores).length === 0).length;
        metrics.trackProfileMatchingActivity({
            provider: metricsProvider,
            event: 'wave',
            profilesScored: waveScored,
            batchesFailed: failedBatchCount
        });

        safeLog('info', 'Scoring wave completed', {
            waveStart,
            waveSize: wave.length,
            totalScored: Object.keys(allScores).length
        });
    }

    safeLog('info', 'LLM batch scoring completed', {
        totalScored: Object.keys(allScores).length,
        totalProfiles: profiles.length,
        hasErrors
    });

    return {
        scores: allScores,
        success: Object.keys(allScores).length > 0,
        partial: hasErrors && Object.keys(allScores).length > 0
    };
}

export async function explainTopProfilesWithLLM(profiles, missionKeywords, missionRecord, userMetadata = null, options = {}) {
    if (!profiles || profiles.length === 0) {
        return {};
    }

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const provider = settings.llmProvider || 'unknown';
    const supportsStructuredJsonResponse = provider === 'deepseek';
    const isDeepSeekReasoner = provider === 'deepseek' && model === 'deepseek-reasoner';
    const explanationMaxTokens = Number.isInteger(options.maxTokens) && options.maxTokens > 0
        ? options.maxTokens
        : (isDeepSeekReasoner ? 3072 : (provider === 'deepseek' ? 2048 : 1536));
    const maxConcurrency = PROFILE_MATCHING_LLM_MAX_CONCURRENCY > 0
        ? Math.min(PROFILE_MATCHING_LLM_MAX_CONCURRENCY, PROFILE_MATCHING_EXPLANATION_MAX_CONCURRENCY)
        : Math.min(PROFILE_MATCHING_EXPLANATION_MAX_CONCURRENCY, provider === 'deepseek' ? 3 : 5);
    const metricsProvider = buildLLMMetricLabel(provider, model || '');
    const explanations = {};

    async function explainSingleProfile(profile) {
        const prompt = buildProfileExplanationPrompt(profile, missionRecord, missionKeywords);

        async function requestExplanation(compactRetry = false) {
            const response = await callBusinessChatCompletion({
                model,
                messages: [
                    { role: 'system', content: 'You are a JSON-only HR explanation API. Respond with valid JSON only.' },
                    {
                        role: 'user',
                        content: compactRetry
                            ? `${prompt}\n\nReturn compact JSON only. No markdown. No extra text.`
                            : prompt
                    }
                ],
                maxTokens: explanationMaxTokens,
                temperature: 0.2,
                responseFormat: supportsStructuredJsonResponse ? { type: 'json_object' } : undefined,
                userMetadata,
                operationType: 'Profile Match Explanation'
            });

            return buildExplanationPayload(parseJsonFromLlmResponse(response.choices[0].message.content), {
                provider: metricsProvider,
                source: 'explanation-pass',
                resumeId: profile.resumeId
            });
        }

        try {
            return await requestExplanation(false);
        } catch (error) {
            if (isRecoverableJsonOutputError(error)) {
                safeLog('warn', 'Profile match explanation returned malformed JSON, retrying once', {
                    resumeId: profile.resumeId,
                    provider,
                    model,
                    error: error.message
                });

                try {
                    return await requestExplanation(true);
                } catch (retryError) {
                    safeLog('error', 'Profile match explanation retry failed', {
                        resumeId: profile.resumeId,
                        provider,
                        model,
                        error: retryError.message
                    });
                }
            } else {
                safeLog('error', 'Profile match explanation failed', {
                    resumeId: profile.resumeId,
                    provider,
                    model,
                    error: error.message
                });
            }

            return null;
        }
    }

    for (let waveStart = 0; waveStart < profiles.length; waveStart += maxConcurrency) {
        const wave = profiles.slice(waveStart, waveStart + maxConcurrency);
        const waveResults = await Promise.all(
            wave.map(async profile => ({
                resumeId: profile.resumeId,
                explanation: await explainSingleProfile(profile)
            }))
        );

        for (const result of waveResults) {
            if (result.explanation) {
                explanations[result.resumeId] = result.explanation;
            }
        }
    }

    metrics.trackProfileMatchingActivity({
        provider: metricsProvider,
        event: 'explanation',
        profilesExplained: Object.keys(explanations).length,
        metadata: {
            profilesExplained: Object.keys(explanations).length
        }
    });

    return explanations;
}
