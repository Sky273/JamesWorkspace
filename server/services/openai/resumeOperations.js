/**
 * OpenAI Resume Operations
 * Resume analysis and improvement using OpenAI
 */

import { safeLog } from '../../utils/logger.backend.js';
import { LLM_OPERATION_TIMEOUT_MS } from '../../config/constants.js';
import { callBusinessChatCompletion } from '../llmProvider.service.js';
import { buildLLMMetricLabel } from '../metrics.service.js';
import {
    isLikelyAnthropicModel,
    isLikelyDeepSeekModel,
    isLikelyHuggingFaceModel,
    isLikelyGlmModel,
    isLikelyMiniMaxModel
} from '../llmConfiguration.service.js';
import { normalizeUtf8Text, stripLlmThinkingContent } from './textUtils.js';
import { executeResumeAnalysis } from './resumeAnalysis.service.js';
import { executeResumeImprovement } from './resumeImprovement.service.js';

function inferMetricsProvider(model) {
    if (isLikelyAnthropicModel(model)) return 'anthropic';
    if (isLikelyDeepSeekModel(model)) return 'deepseek';
    if (isLikelyHuggingFaceModel(model)) return 'huggingface';
    if (isLikelyGlmModel(model)) return 'glm';
    if (isLikelyMiniMaxModel(model)) return 'minimax';
    return 'openai';
}

function buildDeadlineExceededError(operationType) {
    const error = new Error(`${operationType} deadline exceeded`);
    error.code = 'LLM_ITEM_DEADLINE_EXCEEDED';
    error.statusCode = 504;
    return error;
}

function resolveRemainingBudgetMs(options = {}, fallbackTimeoutMs = LLM_OPERATION_TIMEOUT_MS, operationType = 'LLM operation') {
    const explicitDeadlineAt = Number(options.deadlineAt);
    if (Number.isFinite(explicitDeadlineAt)) {
        const remainingMs = explicitDeadlineAt - Date.now();
        if (remainingMs <= 0) {
            throw buildDeadlineExceededError(operationType);
        }

        return remainingMs;
    }

    const explicitTimeoutMs = Number(options.timeoutMs);
    if (Number.isFinite(explicitTimeoutMs) && explicitTimeoutMs > 0) {
        return explicitTimeoutMs;
    }

    return fallbackTimeoutMs;
}

function isDeadlineExceededError(error) {
    return error?.code === 'LLM_ITEM_DEADLINE_EXCEEDED';
}

export async function analyzeResume(resumeText, model, analysisPrompt, userMetadata = null, isImprovedCV = false, originalFileName = null, options = {}) {
    let prompt = analysisPrompt.replace('{TEXT}', resumeText);

    if (originalFileName) {
        prompt = prompt.replace('{FILENAME}', originalFileName);
    } else {
        prompt = prompt.replace('{FILENAME}', 'Non disponible');
    }

    const operationType = isImprovedCV ? 'Improved Resume Analysis' : 'Resume Analysis';
    const requestedMaxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : undefined;
    const normalized = await executeResumeAnalysis({
        resumeText,
        model,
        prompt,
        userMetadata,
        operationType,
        requestedMaxTokens,
        resolveRemainingBudgetMs,
        inferMetricsProvider,
        originalParseOptions: options
    });

    safeLog('debug', 'Raw analysis from LLM', {
        allKeys: Object.keys(normalized),
        hasTags: !!normalized.tags,
        tagsContent: normalized.tags,
        hasTopSkills: !!normalized['Top Skills'],
        topSkillsContent: normalized['Top Skills'],
        hasSkills: !!normalized.skills,
        skillsContent: normalized.skills
    });

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

export async function preAnalyzeResumeText(text, model, preAnalysisPrompt, userMetadata = null, originalFileName = null, options = {}) {
    const prompt = preAnalysisPrompt
        .replace(/{TEXT}/g, text)
        .replace(/{FILENAME}/g, originalFileName || 'Non disponible');

    const response = await callBusinessChatCompletion({
        model,
        messages: [
            {
                role: 'system',
                content: 'You clean and minimally structure extracted resume text. Respond with plain Markdown text only.'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        maxTokens: options.maxTokens ?? 12000,
        temperature: 0,
        timeout: resolveRemainingBudgetMs(options, 20 * 60 * 1000, 'Resume Pre-Analysis'),
        maxPromptLength: 120000,
        userMetadata,
        operationType: 'Resume Pre-Analysis'
    });

    const content = normalizeUtf8Text(stripLlmThinkingContent(response.choices?.[0]?.message?.content || ''));
    return content.trim();
}

export async function improveResume(text, analysis, model, improvementPromptTemplate, originalFileName = null, userMetadata = null, options = {}) {
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
        throw new Error(normalizeUtf8Text('Le texte du CV est trop court pour être amélioré (minimum 100 caractères).'));
    }

    const metricsProvider = buildLLMMetricLabel(inferMetricsProvider(model), model);
    return executeResumeImprovement({
        text,
        analysis,
        model,
        improvementPrompt,
        userMetadata,
        options,
        metricsProvider,
        resolveRemainingBudgetMs,
        isDeadlineExceededError
    });
}
