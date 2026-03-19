/**
 * Tests for sanitizer.backend.js
 * escapeAirtableFormula, sanitizeHtmlContent
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

import { escapeAirtableFormula, sanitizeHtmlContent } from '../../utils/sanitizer.backend.js';

describe('sanitizer.backend', () => {
    describe('escapeAirtableFormula', () => {
        it('should return non-string values unchanged', () => {
            expect(escapeAirtableFormula(null)).toBeNull();
            expect(escapeAirtableFormula(undefined)).toBeUndefined();
            expect(escapeAirtableFormula(42)).toBe(42);
            expect(escapeAirtableFormula('')).toBe('');
        });

        it('should neutralize dangerous prefix =', () => {
            const result = escapeAirtableFormula('=SUM(A1)');
            // Prepended ' gets escaped to \' by the escape step
            expect(result.startsWith("\\'")).toBe(true);
        });

        it('should neutralize dangerous prefix +', () => {
            const result = escapeAirtableFormula('+cmd');
            expect(result.startsWith("\\'")).toBe(true);
        });

        it('should neutralize dangerous prefix -', () => {
            const result = escapeAirtableFormula('-1+1');
            expect(result.startsWith("\\'")).toBe(true);
        });

        it('should neutralize dangerous prefix @', () => {
            const result = escapeAirtableFormula('@import');
            expect(result.startsWith("\\'")).toBe(true);
        });

        it('should escape special characters', () => {
            const result = escapeAirtableFormula('hello(world)');
            expect(result).toContain('\\(');
            expect(result).toContain('\\)');
        });

        it('should escape curly braces and commas', () => {
            const result = escapeAirtableFormula('{a,b}');
            expect(result).toContain('\\{');
            expect(result).toContain('\\}');
            expect(result).toContain('\\,');
        });

        it('should escape quotes', () => {
            const result = escapeAirtableFormula("it's a \"test\"");
            expect(result).toContain("\\'");
            expect(result).toContain('\\"');
        });

        it('should not prepend quote for safe strings', () => {
            const result = escapeAirtableFormula('Normal text');
            expect(result.startsWith("'")).toBe(false);
        });
    });

    describe('sanitizeHtmlContent', () => {
        it('should allow safe HTML tags', () => {
            const input = '<p>Hello <strong>world</strong></p>';
            const result = sanitizeHtmlContent(input);
            expect(result).toContain('<p>');
            expect(result).toContain('<strong>');
        });

        it('should strip script tags (XSS)', () => {
            const input = '<p>Hello</p><script>alert("xss")</script>';
            const result = sanitizeHtmlContent(input);
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
        });

        it('should strip event handlers', () => {
            const input = '<p onclick="alert(1)">Click</p>';
            const result = sanitizeHtmlContent(input);
            expect(result).not.toContain('onclick');
        });

        it('should allow safe attributes on links', () => {
            const input = '<a href="https://example.com" target="_blank">Link</a>';
            const result = sanitizeHtmlContent(input);
            expect(result).toContain('href="https://example.com"');
        });

        it('should strip javascript: URLs', () => {
            const input = '<a href="javascript:alert(1)">Click</a>';
            const result = sanitizeHtmlContent(input);
            expect(result).not.toContain('javascript:');
        });

        it('should allow class and id attributes', () => {
            const input = '<div class="container" id="main">Content</div>';
            const result = sanitizeHtmlContent(input);
            expect(result).toContain('class="container"');
            expect(result).toContain('id="main"');
        });

        it('should allow table tags', () => {
            const input = '<table><thead><tr><th>A</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table>';
            const result = sanitizeHtmlContent(input);
            expect(result).toContain('<table>');
            expect(result).toContain('<td>');
        });

        it('should strip img tags (not in allowed list)', () => {
            const input = '<img src="x" onerror="alert(1)">';
            const result = sanitizeHtmlContent(input);
            expect(result).not.toContain('<img');
        });
    });
});
