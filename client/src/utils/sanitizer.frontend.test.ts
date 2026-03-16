/**
 * Tests for frontend sanitizer utility
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml, sanitizeUserHtml, createSafeHtml } from './sanitizer.frontend';

describe('sanitizer.frontend', () => {
    describe('sanitizeHtml', () => {
        it('should return empty string for null/undefined', () => {
            expect(sanitizeHtml(null)).toBe('');
            expect(sanitizeHtml(undefined)).toBe('');
            expect(sanitizeHtml('')).toBe('');
        });

        it('should return empty string for non-string input', () => {
            expect(sanitizeHtml(123 as unknown as string)).toBe('');
        });

        it('should allow safe HTML tags', () => {
            const html = '<p>Hello <strong>world</strong></p>';
            const result = sanitizeHtml(html);
            expect(result).toContain('<p>');
            expect(result).toContain('<strong>');
            expect(result).toContain('world');
        });

        it('should strip script tags', () => {
            const html = '<p>Safe</p><script>alert("xss")</script>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('alert');
            expect(result).toContain('Safe');
        });

        it('should strip iframe tags', () => {
            const html = '<p>Content</p><iframe src="http://evil.com"></iframe>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('<iframe');
            expect(result).toContain('Content');
        });

        it('should strip event handlers', () => {
            const html = '<img src="x" onerror="alert(1)" />';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('onerror');
            expect(result).not.toContain('alert');
        });

        it('should strip onclick handlers', () => {
            const html = '<div onclick="alert(1)">Click me</div>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('onclick');
        });

        it('should allow anchor tags with href', () => {
            const html = '<a href="https://example.com" target="_blank">Link</a>';
            const result = sanitizeHtml(html);
            expect(result).toContain('href="https://example.com"');
            expect(result).toContain('Link');
        });

        it('should strip style tags', () => {
            const html = '<style>body{display:none}</style><p>Visible</p>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('<style>');
            expect(result).toContain('Visible');
        });

        it('should strip form tags', () => {
            const html = '<form action="/steal"><input type="text" /></form>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('<form');
        });

        it('should allow table tags', () => {
            const html = '<table><thead><tr><th>Header</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>';
            const result = sanitizeHtml(html);
            expect(result).toContain('<table>');
            expect(result).toContain('<th>');
            expect(result).toContain('<td>');
        });

        it('should accept custom options', () => {
            const html = '<p>Text</p><div>More</div>';
            const result = sanitizeHtml(html, { ALLOWED_TAGS: ['p'] });
            expect(result).toContain('<p>');
        });

        it('should strip javascript: URIs', () => {
            const html = '<a href="javascript:alert(1)">Click</a>';
            const result = sanitizeHtml(html);
            expect(result).not.toContain('javascript:');
        });
    });

    describe('sanitizeUserHtml', () => {
        it('should return empty string for null/undefined', () => {
            expect(sanitizeUserHtml(null)).toBe('');
            expect(sanitizeUserHtml(undefined)).toBe('');
        });

        it('should allow basic formatting tags', () => {
            const html = '<p>Hello <strong>bold</strong> <em>italic</em> <u>underline</u></p>';
            const result = sanitizeUserHtml(html);
            expect(result).toContain('<strong>');
            expect(result).toContain('<em>');
            expect(result).toContain('<u>');
        });

        it('should strip complex tags not allowed in user content', () => {
            const html = '<table><tr><td>Data</td></tr></table><p>Text</p>';
            const result = sanitizeUserHtml(html);
            expect(result).not.toContain('<table>');
            expect(result).toContain('Text');
        });

        it('should allow links', () => {
            const html = '<a href="https://example.com">Link</a>';
            const result = sanitizeUserHtml(html);
            expect(result).toContain('<a');
            expect(result).toContain('href');
        });

        it('should allow lists', () => {
            const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
            const result = sanitizeUserHtml(html);
            expect(result).toContain('<ul>');
            expect(result).toContain('<li>');
        });
    });

    describe('createSafeHtml', () => {
        it('should return object with __html property', () => {
            const result = createSafeHtml('<p>Hello</p>');
            expect(result).toHaveProperty('__html');
            expect(result.__html).toContain('<p>');
        });

        it('should sanitize content in __html', () => {
            const result = createSafeHtml('<script>alert(1)</script><p>Safe</p>');
            expect(result.__html).not.toContain('<script>');
            expect(result.__html).toContain('Safe');
        });

        it('should handle null/undefined', () => {
            const result = createSafeHtml(null);
            expect(result.__html).toBe('');
        });

        it('should accept custom options', () => {
            const result = createSafeHtml('<p>Text</p><div>More</div>', { ALLOWED_TAGS: ['p'] });
            expect(result.__html).toContain('<p>');
        });
    });
});
