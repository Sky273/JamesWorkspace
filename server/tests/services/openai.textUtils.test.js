/**
 * Tests for OpenAI Text Utilities
 * Pure functions: decodeHtmlEntities, cleanupText, cleanupHtml
 */

import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, cleanupText, cleanupHtml, stripLlmThinkingContent, extractJsonPayload, parseJsonFromLlmResponse, salvageResumeAnalysisFromText } from '../../services/openai/textUtils.js';

describe('OpenAI Text Utilities', () => {
    describe('decodeHtmlEntities', () => {
        it('should return falsy input as-is', () => {
            expect(decodeHtmlEntities(null)).toBeNull();
            expect(decodeHtmlEntities('')).toBe('');
        });

        it('should decode named HTML entities', () => {
            expect(decodeHtmlEntities('&amp;')).toBe('&');
            expect(decodeHtmlEntities('&lt;')).toBe('<');
            expect(decodeHtmlEntities('&gt;')).toBe('>');
            expect(decodeHtmlEntities('&quot;')).toBe('"');
            expect(decodeHtmlEntities('&#39;')).toBe("'");
            expect(decodeHtmlEntities('&nbsp;')).toBe(' ');
        });

        it('should decode typographic entities', () => {
            expect(decodeHtmlEntities('&laquo;')).toBe('\u00ab');
            expect(decodeHtmlEntities('&raquo;')).toBe('\u00bb');
            expect(decodeHtmlEntities('&ndash;')).toBe('\u2013');
            expect(decodeHtmlEntities('&mdash;')).toBe('\u2014');
            expect(decodeHtmlEntities('&hellip;')).toBe('\u2026');
            expect(decodeHtmlEntities('&euro;')).toBe('\u20ac');
        });

        it('should decode decimal numeric entities', () => {
            expect(decodeHtmlEntities('&#65;')).toBe('A');
            expect(decodeHtmlEntities('&#233;')).toBe('\u00e9');
        });

        it('should decode hexadecimal numeric entities', () => {
            expect(decodeHtmlEntities('&#x41;')).toBe('A');
            expect(decodeHtmlEntities('&#xE9;')).toBe('\u00e9');
        });

        it('should decode multiple entities in one string', () => {
            expect(decodeHtmlEntities('A &amp; B &lt; C')).toBe('A & B < C');
        });
    });


    describe('cleanupText', () => {
        it('should return falsy input as-is', () => {
            expect(cleanupText(null)).toBeNull();
            expect(cleanupText('')).toBe('');
        });

        it('should decode HTML entities', () => {
            expect(cleanupText('A &amp; B')).toBe('A & B');
        });

        it('should convert <br> to newlines', () => {
            expect(cleanupText('line1<br>line2')).toBe('line1\nline2');
            expect(cleanupText('line1<br/>line2')).toBe('line1\nline2');
        });

        it('should convert closing block tags to newlines', () => {
            const result = cleanupText('<p>Para1</p><p>Para2</p>');
            expect(result).toContain('Para1');
            expect(result).toContain('Para2');
        });

        it('should strip all HTML tags', () => {
            expect(cleanupText('<strong>bold</strong> <em>italic</em>')).toBe('bold italic');
        });

        it('should collapse multiple spaces', () => {
            expect(cleanupText('hello     world')).toBe('hello world');
        });

        it('should collapse excessive newlines', () => {
            expect(cleanupText('a\n\n\n\n\nb')).toBe('a\n\nb');
        });

        it('should trim result', () => {
            expect(cleanupText('  hello  ')).toBe('hello');
        });
    });

    describe('LLM JSON parsing', () => {
        it('should strip think blocks before parsing', () => {
            expect(stripLlmThinkingContent('<think>reasoning</think>{"ok":true}')).toBe('{"ok":true}');
            expect(extractJsonPayload('preface <think>reasoning</think>{"ok":true}')).toBe('{"ok":true}');
        });

        it('should discard unclosed think preambles before the JSON payload', () => {
            const response = '<think>reasoning about the resume\n- bullet\n{"ok":true,"items":["a","b"]}';
            expect(stripLlmThinkingContent(response)).toBe('{"ok":true,"items":["a","b"]}');
            expect(parseJsonFromLlmResponse(response)).toEqual({ ok: true, items: ['a', 'b'] });
        });

        it('should parse JSON wrapped in markdown fences after reasoning', () => {
            const response = '<thinking>draft</thinking>```json\n{"ok":true}\n```';
            expect(parseJsonFromLlmResponse(response)).toEqual({ ok: true });
        });

        it('should repair raw control characters inside JSON strings', () => {
            const parsed = parseJsonFromLlmResponse('{"summary":"Line 1\nLine 2","score":85}');
            expect(parsed).toEqual({ summary: 'Line 1\nLine 2', score: 85 });
        });

        it('should repair trailing commas in JSON payloads', () => {
            const parsed = parseJsonFromLlmResponse('{"name":"John","skills":["React","Node"],}');
            expect(parsed).toEqual({ name: 'John', skills: ['React', 'Node'] });
        });

        it('should repair missing commas between JSON properties', () => {
            const parsed = parseJsonFromLlmResponse('{"name":"John" "title":"Developer","score":85}');
            expect(parsed).toEqual({ name: 'John', title: 'Developer', score: 85 });
        });

        it('should remove JSON comments before parsing', () => {
            const parsed = parseJsonFromLlmResponse('{\n  "name": "John", // candidate name\n  "score": 85 /* rating */\n}');
            expect(parsed).toEqual({ name: 'John', score: 85 });
        });

        it('should normalize smart quotes before parsing', () => {
            const parsed = parseJsonFromLlmResponse('{“name”:“John Doe”,“title”:“Developer”}');
            expect(parsed).toEqual({ name: 'John Doe', title: 'Developer' });
        });

        it('should repair duplicated separators in JSON payloads', () => {
            const parsed = parseJsonFromLlmResponse('{"name":"John",,"title":"Developer","score"::85}');
            expect(parsed).toEqual({ name: 'John', title: 'Developer', score: 85 });
        });

        it('should close a truncated root JSON object when the remainder is structurally obvious', () => {
            const parsed = parseJsonFromLlmResponse('{"name":"John","tags":{"skills":["React","Node"]}');
            expect(parsed).toEqual({ name: 'John', tags: { skills: ['React', 'Node'] } });
        });

        it('should strip BOM and null characters before parsing JSON payloads', () => {
            const parsed = parseJsonFromLlmResponse('\uFEFF{"name":"Jo\u0000hn","score":85}\u0000');
            expect(parsed).toEqual({ name: 'John', score: 85 });
        });

        it('should salvage a loose markdown analysis payload when JSON parsing is impossible', () => {
            const salvaged = salvageResumeAnalysisFromText(`
Name: Jane Doe
Title: Backend Engineer
Global Rating: 84%
Skills Rating: 88%

Top Skills:
- Java
- Node.js

Top Tools: Docker, PostgreSQL

Executive Summary Improvements:
- Tighten the introduction
- Add measurable impact
            `);

            expect(salvaged).toEqual(expect.objectContaining({
                name: 'Jane Doe',
                title: 'Backend Engineer',
                globalRating: '84%',
                skillsRating: '88%',
                tags: expect.objectContaining({
                    skills: ['Java', 'Node.js'],
                    tools: ['Docker', 'PostgreSQL']
                }),
                suggestions: expect.objectContaining({
                    executiveSummary: ['Tighten the introduction', 'Add measurable impact']
                })
            }));
        });
    });

    describe('cleanupHtml', () => {
        it('should return falsy input as-is', () => {
            expect(cleanupHtml(null)).toBeNull();
            expect(cleanupHtml('')).toBe('');
        });

        it('should decode HTML entities', () => {
            expect(cleanupHtml('A &amp; B')).toBe('A & B');
        });

        it('should remove nested <p> inside <li>', () => {
            expect(cleanupHtml('<li><p>item</p></li>')).toBe('<li>item</li>');
        });

        it('should remove <p> wrapping <ul>', () => {
            expect(cleanupHtml('<p><ul>')).toBe('<ul>');
            expect(cleanupHtml('</ul></p>')).toBe('</ul>');
        });

        it('should remove <p> wrapping headings', () => {
            expect(cleanupHtml('<p><h2>Title</h2></p>')).toBe('<h2>Title</h2>');
        });

        it('should remove empty <p> tags', () => {
            expect(cleanupHtml('<p></p>')).toBe('');
            expect(cleanupHtml('<p>  </p>')).toBe('');
        });

        it('should collapse nested <p> tags', () => {
            expect(cleanupHtml('<p><p>text</p></p>')).toBe('<p>text</p>');
        });

        it('should collapse excessive <br> tags', () => {
            expect(cleanupHtml('<br><br><br><br>')).toBe('<br><br>');
        });

        it('should remove <p> wrapping only whitespace and <br>', () => {
            expect(cleanupHtml('<p><br></p>')).toBe('');
            expect(cleanupHtml('<p>  <br/>  </p>')).toBe('');
        });
    });
});





