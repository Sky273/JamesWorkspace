import axios from 'axios';
import {
    HUGGINGFACE_API_KEY,
    HUGGINGFACE_BASE_URL,
    LLM_OPERATION_TIMEOUT_MS,
    MAX_PROMPT_LENGTH
} from '../config/constants.js';
import { buildLLMMetricLabel, metrics } from './metrics.service.js';
import { withRetry } from './retry.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { validatePromptSize } from '../utils/postgresHelpers.js';
import { flattenLlmTextContent } from './llmContent.service.js';
import { buildCapabilityAwareOpenAICompatibleParams } from './llmPayloadCapabilities.service.js';
import { markModelUnavailable } from './llmAvailability.service.js';
import { resolveHuggingFaceModelId } from './llmConfiguration.service.js';

const HUGGINGFACE_CHAT_API_PATH = '/chat/completions';

function shouldMarkHuggingFaceModelUnavailable(error) {
    const status = error?.response?.status;
    return status === 401 || status === 403;
}

export async function callHuggingFace({
    model,
    messages,
    maxTokens = 4096,
    temperature = 0,
    topP = 1,
    responseFormat = null,
    timeout = LLM_OPERATION_TIMEOUT_MS,
    maxPromptLength = MAX_PROMPT_LENGTH,
    operationType = 'Hugging Face API request',
    userMetadata = null,
    ...providerParameters
}) {
    if (!HUGGINGFACE_API_KEY) {
        throw new Error('Hugging Face API key not configured on server');
    }

    const resolvedModel = resolveHuggingFaceModelId(model);
    if (!resolvedModel) {
        throw new Error('Hugging Face model is required');
    }

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required and must not be empty');
    }

    if (maxPromptLength) {
        const combinedPrompt = messages
            .map((message) => flattenLlmTextContent(message?.content))
            .filter(Boolean)
            .join('\n');
        const promptValidation = validatePromptSize(combinedPrompt, maxPromptLength);
        if (!promptValidation.valid) {
            const error = new Error(promptValidation.error);
            error.estimatedTokens = promptValidation.estimatedTokens;
            throw error;
        }
    }

    const normalized = buildCapabilityAwareOpenAICompatibleParams('huggingface', resolvedModel, {
        parameters: providerParameters,
        maxTokens,
        temperature,
        topP,
        responseFormat,
        additionalParams: { messages },
        fallbackMaxTokens: 4096
    });

    if (normalized.droppedParams.length > 0) {
        safeLog('warn', 'Dropped unsupported Hugging Face params', {
            model: resolvedModel,
            operationType,
            droppedParams: normalized.droppedParams
        });
    }

    try {
        safeLog('info', 'Hugging Face request', {
            model: resolvedModel,
            operationType,
            messageCount: messages.length,
            action: userMetadata?.action || 'POST /huggingface-service'
        });

        const response = await axios.post(
            `${HUGGINGFACE_BASE_URL.replace(/\/$/, '')}${HUGGINGFACE_CHAT_API_PATH}`,
            normalized.requestParams,
            {
                headers: {
                    Authorization: `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout
            }
        );

        if (response.status >= 400) {
            const error = new Error(response.data?.error?.message || 'Hugging Face API error');
            error.response = response;
            throw error;
        }

        const usage = response.data?.usage || {};
        const inputTokens = usage.input_tokens || usage.prompt_tokens || 0;
        const outputTokens = usage.output_tokens || usage.completion_tokens || 0;
        const totalTokens = usage.total_tokens || (inputTokens + outputTokens);
        metrics.trackLLMRequest(buildLLMMetricLabel('huggingface', resolvedModel), totalTokens, true, inputTokens, outputTokens);

        return response.data;
    } catch (error) {
        metrics.trackLLMRequest(buildLLMMetricLabel('huggingface', resolvedModel), 0, false, 0, 0);
        safeLog('error', 'Hugging Face API call failed', {
            model: resolvedModel,
            operationType,
            error: error.message,
            status: error.response?.status
        });

        if (shouldMarkHuggingFaceModelUnavailable(error)) {
            void markModelUnavailable('huggingface', resolvedModel, 'provider_model_access_denied', null);
        }

        throw error;
    }
}

export async function callHuggingFaceWithCircuitBreaker(params) {
    const operationName = params.operationType || 'Hugging Face API call';
    return withRetry(
        () => callHuggingFace(params),
        {
            serviceName: 'huggingface',
            operationName,
            retryConfig: {
                maxRetries: 3,
                initialDelayMs: 2000,
                maxDelayMs: 60000
            }
        }
    );
}
