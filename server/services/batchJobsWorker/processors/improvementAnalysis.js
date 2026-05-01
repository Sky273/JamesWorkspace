import { safeLog } from '../../../utils/logger.backend.js';
import { analyzeImprovedResumeWithLLM } from '../llmIntegration.js';
import { getConfiguredAiActionRuntimeConfig } from '../../aiCredits.service.js';
import { isNonRetryableLlmProviderError, normalizeNonRetryableLlmProviderError } from '../../llmGateway.service.js';
import { metrics } from '../../metrics.service.js';

const IMPROVEMENT_PROVIDER_CONFIGURATION_MESSAGE = "L'amélioration du CV est indisponible car le fournisseur IA est mal configuré ou son jeton a expiré.";
const INVALID_RESPONSE_MARKERS = [
    'réponse invalide',
    'r\u00c3\u00a9ponse invalide',
    'r\u00c3\u0192\u00c2\u00a9ponse invalide',
    'r\u00c3\u0192\u00c6\u2019\u00c3\u201a\u00c2\u00a9ponse invalide',
    'reponse invalide',
    'invalid response',
    'returned an invalid response'
];

export function normalizeImprovementExecutionError(error) {
    const normalizedError = normalizeNonRetryableLlmProviderError(error);

    if (normalizedError === error) {
        return error;
    }

    normalizedError.message = IMPROVEMENT_PROVIDER_CONFIGURATION_MESSAGE;
    return normalizedError;
}

export function isNonRetryableImprovementError(error) {
    return error?.retryable === false || error?.code === 'LLM_PROVIDER_AUTH_ERROR' || isNonRetryableLlmProviderError(error);
}

function isInvalidImprovedAnalysisError(error) {
    const message = String(error?.message || '').toLowerCase();
    return INVALID_RESPONSE_MARKERS.some((marker) => message.includes(marker));
}

function hasUsableFallbackAnalysis(analysis) {
    if (!analysis || typeof analysis !== 'object') {
        return false;
    }

    return Boolean(
        analysis.globalRating !== undefined
        || analysis.skillsRating !== undefined
        || analysis.experiencesRating !== undefined
        || analysis.educationRating !== undefined
        || analysis.atsOptimizationRating !== undefined
        || analysis.executiveSummaryRating !== undefined
        || analysis.hobbiesLanguagesRating !== undefined
        || (analysis.summary && String(analysis.summary).trim())
        || (analysis.title && String(analysis.title).trim())
        || (analysis.tags && Object.values(analysis.tags).some((value) => Array.isArray(value) ? value.length > 0 : Boolean(value)))
        || (analysis.suggestions && Object.keys(analysis.suggestions).length > 0)
    );
}

function normalizeArray(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    return [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];
}

function isEvidenceTagKey(key) {
    return ['skillsEvidence', 'toolsEvidence', 'softSkillsEvidence'].includes(key);
}

function normalizeEvidenceArray(items) {
    if (!Array.isArray(items)) {
        return [];
    }

    const unique = new Map();
    for (const item of items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
            continue;
        }

        const name = String(item.name || item.skill || item.tool || '').trim();
        if (!name) {
            continue;
        }

        const key = name.toLowerCase();
        if (!unique.has(key)) {
            unique.set(key, { ...item, name });
        }
    }

    return [...unique.values()];
}

function normalizeTagArray(key, value) {
    return isEvidenceTagKey(key) ? normalizeEvidenceArray(value) : normalizeArray(value);
}

function hasMeaningfulAnalysisValue(value) {
    if (value === undefined || value === null) {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (typeof value === 'object') {
        return Object.keys(value).length > 0;
    }

    return String(value).trim() !== '';
}

function mergeSuggestionSections(primary = {}, fallback = {}) {
    const merged = {};
    let changed = false;
    const keys = new Set([...Object.keys(primary || {}), ...Object.keys(fallback || {})]);

    for (const key of keys) {
        const preferred = normalizeArray(primary?.[key]);
        const alternate = normalizeArray(fallback?.[key]);
        const combined = preferred.length > 0 ? preferred : alternate;
        if (combined.length > 0) {
            merged[key] = combined;
        }
        if (preferred.length === 0 && alternate.length > 0) {
            changed = true;
        }
    }

    return { value: merged, changed };
}

function mergeTagSections(primary = {}, fallback = {}) {
    const merged = {};
    let changed = false;
    const keys = new Set([...Object.keys(primary || {}), ...Object.keys(fallback || {})]);

    for (const key of keys) {
        const preferred = normalizeTagArray(key, primary?.[key]);
        const alternate = normalizeTagArray(key, fallback?.[key]);
        const combined = preferred.length > 0 ? preferred : alternate;
        if (combined.length > 0) {
            merged[key] = combined;
        }
        if (preferred.length === 0 && alternate.length > 0) {
            changed = true;
        }
    }

    return { value: merged, changed };
}

function mergeImprovedAnalysis(primaryAnalysis, fallbackAnalysis) {
    if (!primaryAnalysis || typeof primaryAnalysis !== 'object' || !hasUsableFallbackAnalysis(fallbackAnalysis)) {
        return {
            merged: primaryAnalysis,
            mergedFromFallback: false,
            mergedKeys: []
        };
    }

    const scalarKeys = [
        'globalRating',
        'skillsRating',
        'experiencesRating',
        'educationRating',
        'atsOptimizationRating',
        'executiveSummaryRating',
        'hobbiesLanguagesRating',
        'summary',
        'Summary',
        'title',
        'name',
        'candidateName',
        'experienceYears',
        'experience_years',
        'educationLevel',
        'education_level',
        'certifications',
        'languages'
    ];

    const merged = { ...primaryAnalysis };
    const mergedKeys = [];

    for (const key of scalarKeys) {
        const currentValue = merged[key];
        const fallbackValue = fallbackAnalysis?.[key];
        const hasCurrentValue = hasMeaningfulAnalysisValue(currentValue);
        const hasFallbackValue = hasMeaningfulAnalysisValue(fallbackValue);

        if (!hasCurrentValue && hasFallbackValue) {
            merged[key] = fallbackValue;
            mergedKeys.push(key);
        }
    }

    const mergedTags = mergeTagSections(primaryAnalysis.tags, fallbackAnalysis.tags);
    if (Object.keys(mergedTags.value).length > 0) {
        merged.tags = mergedTags.value;
        if (mergedTags.changed) {
            mergedKeys.push('tags');
        }
    }

    const mergedSuggestions = mergeSuggestionSections(primaryAnalysis.suggestions, fallbackAnalysis.suggestions);
    if (Object.keys(mergedSuggestions.value).length > 0) {
        merged.suggestions = mergedSuggestions.value;
        if (mergedSuggestions.changed) {
            mergedKeys.push('suggestions');
        }
    }

    return {
        merged,
        mergedFromFallback: mergedKeys.length > 0,
        mergedKeys
    };
}

async function analyzeImprovedResumeForPersistence(improvedText, job, item) {
    const { maxTokens } = await getConfiguredAiActionRuntimeConfig('resume.improvement');

    try {
        return await analyzeImprovedResumeWithLLM(improvedText, job.firm_id, item.file_name, {
            maxTokens
        });
    } catch (error) {
        throw normalizeImprovementExecutionError(error);
    }
}

export async function resolveImprovedAnalysisWithFallback(improvedResult, improvedText, job, item) {
    try {
        const persistedAnalysis = await analyzeImprovedResumeForPersistence(improvedText, job, item);
        const { merged, mergedFromFallback, mergedKeys } = mergeImprovedAnalysis(persistedAnalysis, improvedResult?.analysis);

        if (mergedFromFallback) {
            safeLog('warn', 'Post-improvement analysis was sparse; merged missing fields from embedded improvement analysis', {
                itemId: item.id,
                resumeId: item.resume_id,
                mergedKeys
            });

            metrics.trackImprovementActivity({
                provider: 'batch-job',
                event: 'post-analysis-merge',
                postAnalysisMergeRuns: 1,
                inputChars: improvedText.length,
                outputChars: improvedText.length,
                metadata: {
                    source: 'embedded-analysis-merge',
                    stage: 'post-analysis',
                    mergedKeys,
                    itemId: item.id,
                    resumeId: item.resume_id || null
                }
            });
        }

        return merged;
    } catch (error) {
        if (!isInvalidImprovedAnalysisError(error) || !hasUsableFallbackAnalysis(improvedResult?.analysis)) {
            throw error;
        }

        safeLog('warn', 'Post-improvement analysis returned invalid structured payload; falling back to embedded improvement analysis', {
            itemId: item.id,
            resumeId: item.resume_id,
            error: error.message,
            fallbackKeys: Object.keys(improvedResult.analysis || {})
        });

        metrics.trackImprovementActivity({
            provider: 'batch-job',
            event: 'post-analysis-fallback',
            successfulRuns: 0,
            failedRuns: 0,
            fallbackRuns: 0,
            postAnalysisFallbackRuns: 1,
            postAnalysisMergeRuns: 0,
            inputChars: improvedText.length,
            outputChars: improvedText.length,
            metadata: {
                source: 'embedded-analysis-fallback',
                stage: 'post-analysis',
                itemId: item.id,
                resumeId: item.resume_id || null
            }
        });

        return improvedResult.analysis;
    }
}
