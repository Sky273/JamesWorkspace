/**
 * Tests for OpenAI Text Utilities
 * Pure functions: decodeHtmlEntities, cleanupText, cleanupHtml
 */

import { describe, it, expect } from 'vitest';
import { decodeHtmlEntities, cleanupText, cleanupHtml } from '../../services/openai/textUtils.js';

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
            expect(decodeHtmlEntities('&laquo;')).toBe('«');
            expect(decodeHtmlEntities('&raquo;')).toBe('»');
            expect(decodeHtmlEntities('&ndash;')).toBe('–');
            expect(decodeHtmlEntities('&mdash;')).toBe('—');
            expect(decodeHtmlEntities('&hellip;')).toBe('…');
            expect(decodeHtmlEntities('&euro;')).toBe('€');
        });

        it('should decode decimal numeric entities', () => {
            expect(decodeHtmlEntities('&#65;')).toBe('A');
            expect(decodeHtmlEntities('&#233;')).toBe('é');
        });

        it('should decode hexadecimal numeric entities', () => {
            expect(decodeHtmlEntities('&#x41;')).toBe('A');
            expect(decodeHtmlEntities('&#xE9;')).toBe('é');
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
