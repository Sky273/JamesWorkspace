import { callProviderChat } from './llmGateway.service.js';
import { resolveEffectiveModelParameters, OLLAMA_GENERIC_MODEL_KEY, OLLAMA_GLOBAL_KEY } from './llmAdminParameters.service.js';
import { getProviderDefaultModel } from './llmConfiguration.service.js';
import { safeLog } from '../utils/logger.backend.js';

const SETTINGS_VALIDATION_MESSAGES = Object.freeze([
    {
        role: 'user',
        content: 'Reply with OK.'
    }
]);

function createValidationError(message, details = {}) {
    const error = new Error(message);
    error.statusCode = 400;
    error.details = details;
    return error;
}

function collectValidationTargets(settingsData = {}) {
    const targets = new Map();
    const provider = String(settingsData.llmProvider || '').trim().toLowerCase();
    const model = String(settingsData.llmModel || '').trim();

    if (provider && (model || provider !== 'ollama')) {
        targets.set(`${provider}:${model || getProviderDefaultModel(provider)}`, {
            provider,
            model: model || getProviderDefaultModel(provider)
        });
    }

    const persistedParameters = settingsData.llmModelParameters;
    if (!persistedParameters || typeof persistedParameters !== 'object' || Array.isArray(persistedParameters)) {
        return Array.from(targets.values());
    }

    for (const [entryProvider, models] of Object.entries(persistedParameters)) {
        if (!models || typeof models !== 'object' || Array.isArray(models)) {
            continue;
        }

        for (const [entryModel, parameters] of Object.entries(models)) {
            if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters)) {
                continue;
            }

            if (entryProvider === 'ollama' && (entryModel === OLLAMA_GLOBAL_KEY || entryModel === OLLAMA_GENERIC_MODEL_KEY)) {
                continue;
            }

            const normalizedProvider = String(entryProvider || '').trim().toLowerCase();
            const normalizedModel = String(entryModel || '').trim() || getProviderDefaultModel(normalizedProvider);
            if (!normalizedProvider || !normalizedModel) {
                continue;
            }

            targets.set(`${normalizedProvider}:${normalizedModel}`, {
                provider: normalizedProvider,
                model: normalizedModel
            });
        }
    }

    return Array.from(targets.values());
}

export async function validatePersistedLlmSettings(settingsData = {}, user = null) {
    const targets = collectValidationTargets(settingsData);

    for (const target of targets) {
        const { provider, model } = target;
        const { parameters } = resolveEffectiveModelParameters({
            settings: settingsData,
            provider,
            model,
            overrides: {}
        });

        try {
            await callProviderChat({
                provider,
                model,
                messages: SETTINGS_VALIDATION_MESSAGES,
                settings: settingsData,
                options: {
                    ...parameters,
                    timeout: 15000,
                    operationType: 'LLM settings validation',
                    userMetadata: user ? {
                        email: user.email || 'admin',
                        action: 'SETTINGS_VALIDATION'
                    } : undefined
                }
            });
        } catch (error) {
            if (provider === 'ollama') {
                safeLog('warn', 'Ollama settings validation failed; persisting settings anyway', {
                    provider,
                    model,
                    error: error.message
                });
                continue;
            }

            throw createValidationError(
                `Saved parameters are invalid for ${provider}/${model}: ${error.message}`,
                { provider, model }
            );
        }
    }
}
