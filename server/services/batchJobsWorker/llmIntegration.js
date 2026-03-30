/**
 * Batch Jobs Worker - LLM Integration
 * Rate-limited LLM calls for resume analysis and improvement
 */

import { safeLog } from '../../utils/logger.backend.js';

// ============================================
// LLM RATE LIMITING (Semaphore)
// ============================================

const MAX_CONCURRENT_LLM = 20; // Max concurrent LLM requests to avoid rate limits

let activeLLMRequests = 0;
const llmQueue = [];

// Track queue health for debugging
let _lastLLMActivity = Date.now();

function looksLikeHtml(value) {
    return typeof value === 'string' && /<\/?[a-z][^>]*>/i.test(value);
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
export async function analyzeResumeWithLLM(text, _firmId, originalFileName = null) {
    const { analyzeResume, cleanupText } = await import('../openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('../settings.service.js');
    const { getAcceptedIndustriesString, getIndustryMappingString } = await import('../industry.service.js');
    const { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');

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

    // Acquire LLM slot (rate limiting)
    await acquireLLMSlot();
    let analysis;
    try {
        // Analyze with original filename for name extraction hint
        safeLog('debug', 'Batch analysis using governed prompt', { ...analysisPromptMeta, originalFileName });
        analysis = await analyzeResume(cleanedText, model, analysisPrompt, { promptMetadata: analysisPromptMeta }, false, originalFileName);
    } finally {
        releaseLLMSlot();
    }

    // Recalculate weighted global rating
    analysis = await calculateWeightedGlobalRating(analysis, settings);

    return analysis;
}

/**
 * Improve a resume using the LLM (with rate limiting)
 * @param {string} text - Resume text to improve
 * @param {Object} analysis - Analysis data
 * @param {string} _firmId - Firm ID (unused but kept for API consistency)
 * @param {string} originalFileName - Original file name for name extraction hint
 */
export async function improveResumeWithLLM(text, analysis, _firmId, originalFileName = null) {
    const { improveResume } = await import('../openai.service.js');
    const { getLLMSettings } = await import('../settings.service.js');
    const { getAcceptedIndustriesString } = await import('../industry.service.js');
    const { DEFAULT_IMPROVEMENT_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');

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
        improveResult = await improveResume(improvementInput, analysis, model, improvementPrompt, originalFileName, { promptMetadata: improvementPromptMeta });
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

export async function analyzeImprovedResumeWithLLM(text, _firmId, originalFileName = null) {
    const { analyzeResume } = await import('../openai.service.js');
    const { getLLMSettings, calculateWeightedGlobalRating } = await import('../settings.service.js');
    const { getAcceptedIndustriesString, getIndustryMappingString } = await import('../industry.service.js');
    const { DEFAULT_ANALYSIS_PROMPT, ANONYMIZATION_RULES_ANONYMOUS, ANONYMIZATION_RULES_NOMINATIVE } = await import('../../config/prompts.backend.js');
    const { buildPromptExecutionMetadata } = await import('../../config/llmGovernance.js');

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
        improvedAnalysis = await analyzeResume(text, model, analysisPrompt, { promptMetadata: analysisPromptMeta }, true);
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


