// ============================================
// LLM SERVICE - Public facade over the provider gateway
// ============================================

import { getLLMSettings } from './settings.service.js';
import { callProviderChat, callProviderVision, logGatewayCall } from './llmGateway.service.js';
import { resolveLLMRuntimeConfig } from './llmConfiguration.service.js';
import { buildOpenAICompatibleParams, getOpenAICompatibleTokenParam, supportsCustomTemperatureForOpenAICompatible } from './llmProviderCommon.service.js';
import { resolveEffectiveModelParameters } from './llmAdminParameters.service.js';

export const getTokenParameter = getOpenAICompatibleTokenParam;
export const supportsCustomTemperature = supportsCustomTemperatureForOpenAICompatible;
export const buildOpenAIParams = buildOpenAICompatibleParams;

export async function callLLM(messages, options = {}) {
    const settings = await getLLMSettings();
    const { provider, model } = resolveLLMRuntimeConfig(settings);
    const { parameters } = resolveEffectiveModelParameters({
        settings,
        provider,
        model,
        overrides: options
    });

    logGatewayCall({
        provider,
        model,
        messageCount: messages.length,
        temperature: parameters.temperature,
        maxTokens: parameters.max_tokens || parameters.max_completion_tokens
    });

    return callProviderChat({
        provider,
        model,
        messages,
        settings,
        options: {
            ...options,
            ...parameters
        }
    });
}

export async function callLLMWithVision(systemPrompt, userContent, options = {}) {
    const settings = await getLLMSettings();
    const { provider, model } = resolveLLMRuntimeConfig(settings);
    const { parameters } = resolveEffectiveModelParameters({
        settings,
        provider,
        model,
        overrides: options
    });

    logGatewayCall({
        provider,
        model,
        messageCount: userContent.length,
        hasImages: userContent.some(c => c.type === 'image_url'),
        vision: true
    });

    return callProviderVision({
        provider,
        model,
        systemPrompt,
        userContent,
        settings,
        options: {
            ...options,
            ...parameters
        }
    });
}
