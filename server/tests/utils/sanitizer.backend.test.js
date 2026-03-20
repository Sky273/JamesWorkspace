/**
 * Tests for sanitizer.backend.js
 * sanitizeHtmlContent
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../utils/logger.backend.js', () => ({ safeLog: vi.fn() }));

import { sanitizeHtmlContent } from '../../utils/sanitizer.backend.js';

describe('sanitizer.backend', () => {
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
