/**
 * Batch Jobs Worker - LLM Integration
 * Rate-limited LLM calls for resume analysis and improvement
 */

import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';

// ============================================
// LLM RATE LIMITING (Semaphore)
// ============================================

const MAX_CONCURRENT_LLM = 20; // Max concurrent LLM requests to avoid rate limits

let activeLLMRequests = 0;
const llmQueue = [];

// Track queue health for debugging
let _lastLLMActivity = Date.now();

function isExternalLlmDisabledForE2E() {
    return process.env.E2E_DISABLE_EXTERNAL_LLM === 'true';
}

function buildMockAnalysis(text, originalFileName = null, { improved = false } = {}) {
    const normalizedText = typeof text === 'string' && text.trim().length > 0
        ? text.trim()
        : '<p>Profil analysé automatiquement pour les tests E2E.</p>';
    const inferredName = originalFileName
        ? String(originalFileName).replace(/\.[^.]+$/, '')
        : 'Candidat E2E';

    return {
        structuredText: normalizedText,
        title: improved ? 'Consultant IT confirmé' : 'Consultant IT',
        globalRating: improved ? 88 : 76,
        skillsRating: improved ? 90 : 78,
        experiencesRating: improved ? 86 : 74,
        educationRating: improved ? 82 : 72,
        atsOptimizationRating: improved ? 89 : 75,
        executiveSummaryRating: improved ? 85 : 73,
        hobbiesLanguagesRating: improved ? 70 : 65,
        candidateName: inferredName,
        tags: {
            skills: ['JavaScript', 'TypeScript', 'React'],
            industries: ['IT'],
            tools: ['Node.js', 'PostgreSQL'],
            softSkills: ['Communication']
        },
        suggestions: {
            critical: [],
            recommended: ['Mettre en avant les réalisations clés'],
            optional: []
        }
    };
}

function buildMockImprovement(text) {
    const baseText = typeof text === 'string' && text.trim().length > 0
        ? text.trim()
        : '<p>CV amélioré automatiquement pour les tests E2E.</p>';
    return {
        text: looksLikeHtml(baseText)
            ? `${baseText}\n<p><strong>Version optimisée E2E.</strong></p>`
            : `${baseText}\nVersion optimisée E2E.`,
        analysis: buildMockAnalysis(baseText, null, { improved: true })
    };
}

function looksLikeHtml(value) {
    return typeof value === 'string' && /<\/?[a-z][^>]*>/i.test(value);
}

function buildLlmDeadlineExceededError() {
    const error = new Error('Batch LLM item deadline exceeded');
    error.code = 'LLM_ITEM_DEADLINE_EXCEEDED';
    error.statusCode = 504;
    return error;
}

function resolveLlmDeadlineOptions(options = {}) {
    const timeoutMs = Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0
        ? Number(options.timeoutMs)
        : LLM_OPERATION_TIMEOUT_MS;
    const deadlineAt = Number.isFinite(Number(options.deadlineAt))
        ? Number(options.deadlineAt)
        : Date.now() + timeoutMs;

    return {
        ...options,
        timeoutMs,
        deadlineAt
    };
}

function assertLlmDeadlineNotExpired(options = {}) {
    const resolvedDeadlineAt = Number(options.deadlineAt);
    if (Number.isFinite(resolvedDeadlineAt) && resolvedDeadlineAt <= Date.now()) {
        throw buildLlmDeadlineExceededError();
    }
}

/**
 * Acquire a slot for LLM request (rate limiting)
 * @returns {Promise<void>}
 */
export async function acquireLLMSlot() {
    return new Promise((resolve) => {
        const tryAcquire = () => {
            if (activeLLMRequests < MAX_CONCURRENT_LLM) {
                activeLLMRequests++;
                resolve();
            } else {
                llmQueue.push(tryAcquire);
            }
        };
        tryAcquire();
    });
}

/**
 * Release a slot for LLM request
 */
export function releaseLLMSlot() {
    activeLLMRequests = Math.max(0, activeLLMRequests - 1); // Prevent negative count
    _lastLLMActivity = Date.now();
    if (llmQueue.length > 0) {
        const next = llmQueue.shift();
        next();
    }
}

/**
 * Reset LLM queue if stuck (called during shutdown or error recovery)
 */
export function resetLLMQueue() {
    const queueLength = llmQueue.length;
    const activeCount = activeLLMRequests;
    llmQueue.length = 0; // Clear queue
    activeLLMRequests = 0;
    if (queueLength > 0 || activeCount > 0) {
        safeLog('warn', 'LLM queue reset', { clearedQueue: queueLength, clearedActive: activeCount });
    }
}

// ============================================
// LLM FUNCTIONS
// ============================================

/**
 * Analyze a resume using the LLM (with rate limiting)
 * @param {string} text - Resume text to analyze
 * @param {string} _firmId - Firm ID (unused but kept for API consistency)
 * @param {string} originalFileName - Original file name for name extraction hint
 */
export async function analyzeResumeWithLLM(text, _firmId, originalFileName = null, options = {}) {
    if (isExternalLlmDisabledForE2E()) {
        safeLog('info', 'Using mocked batch resume analysis for E2E', { originalFileName });
        return buildMockAnalysis(text, originalFileName, { improved: false, ocrUsed: options.ocrUsed });
    }

    const { analyzeResume, cleanupText } = await import('../openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('../settings.service.js');
    const { getAcceptedIndustriesString, getIndustryMappingString } = await import('../industry.service.js');
    const { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');
    const resolvedOptions = resolveLlmDeadlineOptions(options);
    assertLlmDeadlineNotExpired(resolvedOptions);

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const analysisPromptMeta = buildPromptExecutionMetadata('DEFAULT_ANALYSIS_PROMPT', settings['Analysis Prompt'] ? 'settings' : 'default');

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured');
    }

    // Get filename value for injection
    const fileNameValue = originalFileName || 'Non disponible';
    
    // Inject accepted industries and mapping lexique
    const acceptedIndustries = await getAcceptedIndustriesString();
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);
    
    // Inject anonymization rules based on cvMode (with FILENAME replaced)
    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    // Clean text before analysis
    const cleanedText = cleanupText(text);
    const ocrHint = options.ocrUsed
        ? '\n\nOCR NOTE: This resume text was extracted from images via OCR. The content may contain recognition noise, missing accents, spacing issues, and generic placeholders. Infer cautiously. Do not treat generic labels such as "CANDIDAT 1", "CANDIDAT", "PROFILE", or "CV" as a real candidate name.'
        : '';

    // Acquire LLM slot (rate limiting)
    await acquireLLMSlot();
    let analysis;
    try {
        // Analyze with original filename for name extraction hint
        safeLog('debug', 'Batch analysis using governed prompt', { ...analysisPromptMeta, originalFileName });
        analysis = await analyzeResume(cleanedText, model, `${analysisPrompt}${ocrHint}`, { promptMetadata: analysisPromptMeta }, false, originalFileName, {
            maxTokens: resolvedOptions.maxTokens,
            timeoutMs: resolvedOptions.timeoutMs,
            deadlineAt: resolvedOptions.deadlineAt
        });
    } finally {
        releaseLLMSlot();
    }

    // Recalculate weighted global rating
    analysis = await calculateWeightedGlobalRating(analysis, settings);

    return analysis;
}

export async function preAnalyzeResumeWithLLM(text, _firmId, originalFileName = null) {
    if (isExternalLlmDisabledForE2E()) {
        safeLog('info', 'Using mocked batch resume pre-analysis for E2E', { originalFileName });
        return typeof text === 'string' ? text : '';
    }

    const { preAnalyzeResumeText } = await import('../openai.service.js');
    const { getLLMSettings } = await import('../settings.service.js');
    const { DEFAULT_PRE_ANALYSIS_PROMPT } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');
    const resolvedOptions = resolveLlmDeadlineOptions({});
    assertLlmDeadlineNotExpired(resolvedOptions);

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const preAnalysisPrompt = settings['Pre Analysis Prompt'] || DEFAULT_PRE_ANALYSIS_PROMPT;
    const promptMetadata = buildPromptExecutionMetadata('DEFAULT_PRE_ANALYSIS_PROMPT', settings['Pre Analysis Prompt'] ? 'settings' : 'default');

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured');
    }

    await acquireLLMSlot();
    try {
        safeLog('debug', 'Batch pre-analysis using governed prompt', { ...promptMetadata, originalFileName });
        return await preAnalyzeResumeText(text, model, preAnalysisPrompt, { promptMetadata }, originalFileName, {
            timeoutMs: resolvedOptions.timeoutMs,
            deadlineAt: resolvedOptions.deadlineAt
        });
    } finally {
        releaseLLMSlot();
    }
}

/**
 * Improve a resume using the LLM (with rate limiting)
 * @param {string} text - Resume text to improve
 * @param {Object} analysis - Analysis data
 * @param {string} _firmId - Firm ID (unused but kept for API consistency)
 * @param {string} originalFileName - Original file name for name extraction hint
 */
export async function improveResumeWithLLM(text, analysis, _firmId, originalFileName = null, options = {}) {
    if (isExternalLlmDisabledForE2E()) {
        safeLog('info', 'Using mocked batch resume improvement for E2E', { originalFileName });
        return {
            ...buildMockImprovement(text),
            analysis: analysis || buildMockAnalysis(text, originalFileName, { improved: true })
        };
    }

    const { improveResume } = await import('../openai.service.js');
    const { getLLMSettings } = await import('../settings.service.js');
    const { getAcceptedIndustriesString } = await import('../industry.service.js');
    const { DEFAULT_IMPROVEMENT_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');
    const resolvedOptions = resolveLlmDeadlineOptions(options);
    assertLlmDeadlineNotExpired(resolvedOptions);

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';
    let improvementPrompt = settings['Improvement Prompt'] || DEFAULT_IMPROVEMENT_PROMPT;
    const improvementPromptMeta = buildPromptExecutionMetadata('DEFAULT_IMPROVEMENT_PROMPT', settings['Improvement Prompt'] ? 'settings' : 'default');

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured');
    }

    const fileNameValue = originalFileName || 'Non disponible';
    const acceptedIndustries = await getAcceptedIndustriesString();
    improvementPrompt = improvementPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);

    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
    improvementPrompt = improvementPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    const improvementInput = typeof text === 'string' ? text : '';

    await acquireLLMSlot();
    let improveResult;
    try {
        safeLog('debug', 'Batch improvement using governed prompt', { ...improvementPromptMeta, originalFileName });
        improveResult = await improveResume(improvementInput, analysis, model, improvementPrompt, originalFileName, { promptMetadata: improvementPromptMeta }, {
            maxTokens: resolvedOptions.maxTokens,
            timeoutMs: resolvedOptions.timeoutMs,
            deadlineAt: resolvedOptions.deadlineAt
        });
    } finally {
        releaseLLMSlot();
    }

    const improvedText = typeof improveResult === 'string' ? improveResult : improveResult?.text;
    if (!improvedText || improvedText.trim().length === 0) {
        throw new Error('Improvement LLM returned empty text. Resume could not be improved.');
    }

    if (looksLikeHtml(text) && !looksLikeHtml(improvedText)) {
        safeLog('warn', 'Batch improvement output is plain text despite HTML input', {
            inputLength: text.length,
            outputLength: improvedText.length
        });
    }

    safeLog('debug', 'Improvement result received', {
        resultType: typeof improveResult,
        hasText: !!improvedText,
        textLength: improvedText?.length,
        textPreview: improvedText?.substring(0, 100)
    });

    return {
        text: improvedText,
        analysis: typeof improveResult === 'string' ? null : (improveResult?.analysis || null)
    };
}

export async function analyzeImprovedResumeWithLLM(text, _firmId, originalFileName = null, options = {}) {
    if (isExternalLlmDisabledForE2E()) {
        safeLog('info', 'Using mocked post-improvement analysis for E2E', { originalFileName });
        return buildMockAnalysis(text, originalFileName, { improved: true });
    }

    const { analyzeResume } = await import('../openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('../settings.service.js');
    const { getAcceptedIndustriesString, getIndustryMappingString } = await import('../industry.service.js');
    const { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');
    const resolvedOptions = resolveLlmDeadlineOptions(options);
    assertLlmDeadlineNotExpired(resolvedOptions);

    const settings = await getLLMSettings();
    const model = settings.llmModel;
    const cvMode = settings.cvMode || 'nominative';
    let analysisPrompt = settings['Analysis Prompt'] || DEFAULT_ANALYSIS_PROMPT;
    const analysisPromptMeta = buildPromptExecutionMetadata('DEFAULT_ANALYSIS_PROMPT', settings['Analysis Prompt'] ? 'settings' : 'default');

    if (!model && settings.llmProvider !== 'ollama') {
        throw new Error('LLM model not configured');
    }

    const fileNameValue = originalFileName || 'Non disponible';
    const acceptedIndustries = await getAcceptedIndustriesString();
    const industryMapping = await getIndustryMappingString();
    analysisPrompt = analysisPrompt.replace('{ACCEPTED_INDUSTRIES}', acceptedIndustries);
    analysisPrompt = analysisPrompt.replace('{INDUSTRY_MAPPING}', industryMapping);

    let anonymizationRules = cvMode === 'anonymous' ? ANONYMIZATION_RULES_ANONYMOUS : ANONYMIZATION_RULES_NOMINATIVE;
    anonymizationRules = anonymizationRules.replace(/{FILENAME}/g, fileNameValue);
    analysisPrompt = analysisPrompt.replace('{ANONYMIZATION_RULES}', anonymizationRules);

    await acquireLLMSlot();
    let improvedAnalysis;
    try {
        safeLog('debug', 'Batch post-improvement analysis using governed prompt', { ...analysisPromptMeta, originalFileName });
        improvedAnalysis = await analyzeResume(text, model, analysisPrompt, { promptMetadata: analysisPromptMeta }, true, originalFileName, {
            maxTokens: resolvedOptions.maxTokens,
            timeoutMs: resolvedOptions.timeoutMs,
            deadlineAt: resolvedOptions.deadlineAt
        });
    } finally {
        releaseLLMSlot();
    }

    improvedAnalysis = await calculateWeightedGlobalRating(improvedAnalysis, settings);

    safeLog('debug', 'Post-improvement analysis completed', {
        hasAnalysis: !!improvedAnalysis,
        globalRating: improvedAnalysis?.globalRating,
        skillsRating: improvedAnalysis?.skillsRating,
        experiencesRating: improvedAnalysis?.experiencesRating,
        hasTags: !!improvedAnalysis?.tags,
        tagsKeys: improvedAnalysis?.tags ? Object.keys(improvedAnalysis.tags) : []
    });

    return improvedAnalysis;
}
