/**
 * Shared helpers for provider payloads and proxy responses.
 */

export function getOpenAICompatibleTokenParam(model, tokenLimit) {
    const requiresCompletionTokens = String(model || '').match(/^(gpt-5(\.\d+)?(-\w+)?|gpt-4\.1|chatgpt-5|gpt-4o-2024-08-06|gpt-4o-2024-11-20|gpt-4o-mini-2024-07-18)/i);
    return requiresCompletionTokens ? { max_completion_tokens: tokenLimit } : { max_tokens: tokenLimit };
}

export function supportsCustomTemperatureForOpenAICompatible(model) {
    return !String(model || '').match(/^(gpt-5(\.\d+)?(-\w+)?|chatgpt-5)/i);
}

export function buildOpenAICompatibleParams(model, { maxTokens, temperature, topP, additionalParams = {} }) {
    const params = {
        model,
        ...getOpenAICompatibleTokenParam(model, maxTokens),
        ...additionalParams
    };

    if (temperature !== undefined && supportsCustomTemperatureForOpenAICompatible(model)) {
        params.temperature = temperature;
    }

    if (topP !== undefined) {
        params.top_p = topP;
    }

    return params;
}

export function normalizeAnthropicContent(content) {
    if (typeof content === 'string') {
        return [{ type: 'text', text: content }];
    }

    if (!Array.isArray(content)) {
        return [];
    }

    return content.map(block => typeof block === 'string' ? { type: 'text', text: block } : block);
}

export function normalizeAnthropicRequestBody(body = {}, model) {
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const systemMessages = messages.filter(message => message.role === 'system');
    const conversationMessages = messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role,
            content: normalizeAnthropicContent(message.content)
        }));

    const requestBody = {
        ...body,
        model,
        messages: conversationMessages
    };

    if (systemMessages.length > 0 && requestBody.system === undefined) {
        requestBody.system = systemMessages
            .flatMap(message => normalizeAnthropicContent(message.content))
            .filter(Boolean);
    } else if (requestBody.system !== undefined) {
        requestBody.system = normalizeAnthropicContent(requestBody.system);
    }

    return requestBody;
}

export function toOpenAICompatibleResponse(result, prefix = 'provider') {
    return {
        id: `${prefix}-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: result.actualModel || result.model,
        choices: [{
            index: 0,
            message: {
                role: 'assistant',
                content: result.content
            },
            finish_reason: 'stop'
        }],
        usage: result.usage || {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    };
}

export function toAnthropicCompatibleResponse(result, prefix = 'provider') {
    return {
        id: `${prefix}-${Date.now()}`,
        type: 'message',
        role: 'assistant',
        model: result.actualModel || result.model,
        content: [{ type: 'text', text: result.content }],
        stop_reason: 'end_turn',
        usage: {
            input_tokens: result.usage?.input_tokens || result.usage?.prompt_tokens || 0,
            output_tokens: result.usage?.output_tokens || result.usage?.completion_tokens || 0
        }
    };
}
