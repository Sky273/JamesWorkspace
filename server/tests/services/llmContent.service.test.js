/**
 * Tests for shared LLM content helpers.
 */

import { describe, expect, it } from 'vitest';

import {
    extractOpenAIResponsesText,
    extractTextFromContentBlocks,
    flattenLlmTextContent,
    sanitizeOpenAICompatibleResponseBody
} from '../../services/llmContent.service.js';

describe('llmContent.service', () => {
    it('flattens structured message content', () => {
        expect(flattenLlmTextContent([
            { type: 'text', text: 'Visible' },
            { type: 'input_text', content: 'Nested' },
            { type: 'thinking', thinking: 'Reasoning' }
        ])).toBe('Visible\nNested\nReasoning');
    });

    it('extracts only final text blocks by default', () => {
        expect(extractTextFromContentBlocks([
            { type: 'thinking', thinking: 'Reasoning' },
            { type: 'text', text: 'Final answer' }
        ])).toBe('Final answer');
    });

    it('sanitizes OpenAI-compatible message content', () => {
        expect(sanitizeOpenAICompatibleResponseBody({
            choices: [{ message: { content: '<think>draft</think>answer' } }]
        }).choices[0].message.content).toBe('answer');
    });

    it('extracts sanitized text from OpenAI responses output', () => {
        expect(extractOpenAIResponsesText([
            {
                type: 'message',
                content: [{ type: 'output_text', text: '<think>draft</think>answer' }]
            }
        ])).toBe('answer');
    });
});
