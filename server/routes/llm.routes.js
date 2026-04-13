import express from 'express';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY, GLM_API_KEY, MINIMAX_API_KEY, HUGGINGFACE_API_KEY } from '../config/constants.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { llmLimiter, combinedRateLimit } from '../middleware/rateLimit.middleware.js';
import { getCircuitBreakerStates } from '../services/retry.service.js';
import { validateBody, openaiRequestSchema, anthropicRequestSchema } from '../utils/validation.js';
import { createCompatibleProxyHandler } from './llmProxyHandlers.js';
import {
    buildConfiguredCircuitBreakerIndicators
} from './llmRouteHelpers.js';

const router = express.Router();

router.post(
    '/openai',
    authenticateToken,
    llmLimiter,
    combinedRateLimit(30, 60 * 60 * 1000),
    validateBody(openaiRequestSchema),
    createCompatibleProxyHandler({
        responseShape: 'openai',
        proxyProvider: 'openai',
        fallbackErrorMessage: 'Failed to proxy request to OpenAI.',
        allowResponsesApi: true
    })
);

router.post(
    '/anthropic',
    authenticateToken,
    llmLimiter,
    combinedRateLimit(30, 60 * 60 * 1000),
    validateBody(anthropicRequestSchema),
    createCompatibleProxyHandler({
        responseShape: 'anthropic',
        proxyProvider: 'anthropic',
        fallbackErrorMessage: 'Failed to proxy request to Anthropic.',
        useRetry: true
    })
);

router.post(
    '/chat/completions',
    authenticateToken,
    llmLimiter,
    combinedRateLimit(30, 60 * 60 * 1000),
    validateBody(openaiRequestSchema),
    createCompatibleProxyHandler({
        responseShape: 'openai',
        proxyProvider: 'openai',
        fallbackErrorMessage: 'Failed to call OpenAI API.',
        allowResponsesApi: false
    })
);

router.post(
    '/messages',
    authenticateToken,
    llmLimiter,
    combinedRateLimit(30, 60 * 60 * 1000),
    validateBody(anthropicRequestSchema),
    createCompatibleProxyHandler({
        responseShape: 'anthropic',
        proxyProvider: 'anthropic',
        fallbackErrorMessage: 'Failed to call Anthropic API.',
        useRetry: true
    })
);

router.get('/circuit-breakers', authenticateToken, requireAdmin, (req, res) => {
    const states = getCircuitBreakerStates();
    res.json(buildConfiguredCircuitBreakerIndicators(states, {
        openai: Boolean(OPENAI_API_KEY),
        anthropic: Boolean(ANTHROPIC_API_KEY),
        huggingface: Boolean(HUGGINGFACE_API_KEY),
        gemma: Boolean(GEMINI_API_KEY),
        deepseek: Boolean(DEEPSEEK_API_KEY),
        glm: Boolean(GLM_API_KEY),
        minimax: Boolean(MINIMAX_API_KEY),
        ollama: true
    }));
});

export default router;


