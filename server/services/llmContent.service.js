/**
 * Shared helpers for LLM providers.
 */

import { stripLlmThinkingContent } from './openai/textUtils.js';

export function flattenLlmTextContent(content) {
    if (typeof content === 'string') {
        return content;
    }

    if (Array.isArray(content)) {
        return content
            .map(flattenLlmTextContent)
            .filter(Boolean)
            .join('\n');
    }

    if (!content || typeof content !== 'object') {
        return '';
    }

    return ['text', 'content', 'thinking']
        .map(key => flattenLlmTextContent(content[key]))
        .filter(Boolean)
        .join('\n');
}

export function extractTextFromContentBlocks(content, options = {}) {
    const {
        includeThinking = false,
        sanitizeThinkingMarkup = false
    } = options;

    const sanitize = (value) => {
        if (typeof value !== 'string') {
            return '';
        }
        return sanitizeThinkingMarkup ? stripLlmThinkingContent(value) : value.trim();
    };

    if (typeof content === 'string') {
        return sanitize(content);
    }

    if (Array.isArray(content)) {
        return content
            .map(item => {
                if (typeof item === 'string') {
                    return sanitize(item);
                }
                if (typeof item?.text === 'string') {
                    return sanitize(item.text);
                }
                if (typeof item?.content === 'string') {
                    return sanitize(item.content);
                }
                if (includeThinking && typeof item?.thinking === 'string') {
                    return sanitize(item.thinking);
                }
                return '';
            })
            .filter(Boolean)
            .join('\n')
            .trim();
    }

    if (content && typeof content === 'object') {
        if (typeof content.text === 'string') {
            return sanitize(content.text);
        }
        if (typeof content.content === 'string') {
            return sanitize(content.content);
        }
        if (includeThinking && typeof content.thinking === 'string') {
            return sanitize(content.thinking);
        }
    }

    return '';
}

export function sanitizeOpenAICompatibleResponseBody(body = {}) {
    const choices = Array.isArray(body?.choices) ? body.choices : null;
    if (!choices) {
        return body;
    }

    return {
        ...body,
        choices: choices.map(choice => ({
            ...choice,
            message: {
                ...choice?.message,
                ...(typeof choice?.message?.content === 'string'
                    ? { content: stripLlmThinkingContent(choice.message.content) }
                    : {}),
                reasoning_content: undefined
            }
        }))
    };
}

export function extractOpenAIResponsesText(output = []) {
    const messageItem = (output || []).find(item => item.type === 'message');
    return stripLlmThinkingContent(
        messageItem?.content?.find(item => item.type === 'output_text')?.text ||
        messageItem?.content?.[0]?.text ||
        (typeof messageItem?.content === 'string' ? messageItem.content : '')
    );
}

export function extractDeepSeekContent(body = {}) {
    return stripLlmThinkingContent(body?.choices?.[0]?.message?.content || '');
}
