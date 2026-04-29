/**
 * Tests for HTML Builder utilities
 * Tests Puppeteer HTML/footer template generation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildPuppeteerHtml,
  buildPuppeteerFooter,
  normalizeInlineFooterContent,
  normalizePuppeteerFooterContent
} = require('../../lib/htmlBuilder.cjs');

describe('HTML Builder', () => {
  describe('buildPuppeteerHtml()', () => {
    it('should return a valid HTML5 document', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>Hello</p>', stylesheet: '', hasFooter: false });
      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html>');
      expect(html).toContain('</html>');
      expect(html).toContain('<meta charset="UTF-8">');
    });

    it('should include body content in main.pdf-body', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>Content</p>', stylesheet: '', hasFooter: false });
      expect(html).toContain('<main class="pdf-body"><p>Content</p></main>');
    });

    it('should include stylesheet when provided', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '.foo { color: red; }', hasFooter: false });
      expect(html).toContain('.foo { color: red; }');
    });

    it('should omit empty stylesheet tag', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: false });
      const styleMatches = html.match(/<style>/g) || [];
      expect(styleMatches.length).toBe(1); // only layout styles
    });

    it('should include header section when provided', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>Body</p>', stylesheet: '', headerContent: '<div>Header</div>', hasFooter: false });
      expect(html).toContain('<header class="pdf-header">');
      expect(html).toContain('Header');
    });

    it('should omit header section when empty', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>Body</p>', stylesheet: '', headerContent: '', hasFooter: false });
      expect(html).not.toContain('<header');
    });

    it('should omit header section when null', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>Body</p>', stylesheet: '', headerContent: null, hasFooter: false });
      expect(html).not.toContain('<header');
    });

    it('should set page margin when footer is present', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: true, footerHeight: 30 });
      // 30 + 20 = 50mm
      expect(html).toContain('margin-bottom: 50mm');
    });

    it('should set zero margin when no footer', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: false });
      expect(html).toContain('margin-bottom: 0mm');
    });

    it('should cap footer margin to 250mm', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: true, footerHeight: 500 });
      expect(html).toContain('margin-bottom: 250mm');
    });

    it('should default footer height to 25mm', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: true });
      // 25 + 20 = 45mm
      expect(html).toContain('margin-bottom: 45mm');
    });

    it('should include print-color-adjust CSS', () => {
      const html = buildPuppeteerHtml({ htmlContent: '<p>X</p>', stylesheet: '', hasFooter: false });
      expect(html).toContain('-webkit-print-color-adjust: exact');
    });

    it('should inline footer content in the body when requested', () => {
      const html = buildPuppeteerHtml({
        htmlContent: '<p>X</p>',
        stylesheet: '',
        footerContent: '<p>Footer</p>',
        hasFooter: true,
        inlineFooter: true
      });
      expect(html).toContain('<footer class="pdf-footer"><p>Footer</p></footer>');
      expect(html).toContain('margin-bottom: 0mm');
    });
  });

  describe('buildPuppeteerFooter()', () => {
    it('should return empty span for null content', () => {
      expect(buildPuppeteerFooter(null)).toBe('<span></span>');
    });

    it('should return empty span for empty string', () => {
      expect(buildPuppeteerFooter('')).toBe('<span></span>');
    });

    it('should return empty span for whitespace-only', () => {
      expect(buildPuppeteerFooter('   ')).toBe('<span></span>');
    });

    it('should replace -pageNumber- with Puppeteer class', () => {
      const result = buildPuppeteerFooter('<p>Page -pageNumber-</p>');
      expect(result).toContain('<span class="pageNumber"></span>');
      expect(result).not.toContain('-pageNumber-');
    });

    it('should replace -totalPages- with Puppeteer class', () => {
      const result = buildPuppeteerFooter('<p>of -totalPages-</p>');
      expect(result).toContain('<span class="totalPages"></span>');
      expect(result).not.toContain('-totalPages-');
    });

    it('should handle case-insensitive placeholders', () => {
      const result = buildPuppeteerFooter('<p>-PAGENUMBER- / -TOTALPAGES-</p>');
      expect(result).toContain('class="pageNumber"');
      expect(result).toContain('class="totalPages"');
    });

    it('should wrap content in 100%-width container', () => {
      const result = buildPuppeteerFooter('<p>Footer</p>');
      expect(result).toContain('width: 100%');
    });

    it('should convert hr with background-color to div', () => {
      const result = buildPuppeteerFooter('<hr style="height: 2px; background-color: #1e40af;">');
      expect(result).toContain('<div style=');
      expect(result).toContain('background-color: #1e40af');
    });

    it('should include print-color-adjust in output', () => {
      const result = buildPuppeteerFooter('<p>Footer</p>');
      expect(result).toContain('-webkit-print-color-adjust: exact');
    });

    it('should include template stylesheet in the native footer template', () => {
      const result = buildPuppeteerFooter(
        '<footer class="cv-footer"><span>Footer</span></footer>',
        '.cv-footer { color: #123456; font-weight: 700; }'
      );

      expect(result).toContain('.cv-footer { color: #123456; font-weight: 700; }');
      expect(result).toContain('<footer class="cv-footer"><span>Footer</span></footer>');
    });

    it('should preserve footer HTML structure', () => {
      const result = buildPuppeteerFooter('<table><tr><td>Left</td><td>Right</td></tr></table>');
      expect(result).toContain('<table>');
      expect(result).toContain('Left');
      expect(result).toContain('Right');
    });

    it('should strip full-document wrappers before building the native footer template', () => {
      const result = buildPuppeteerFooter('<html><head><style>.x{color:red}</style></head><body><footer><p>Footer</p></footer></body></html>');
      expect(result).not.toContain('<html>');
      expect(result).not.toContain('<style>.x{color:red}</style>');
      expect(result).toContain('<footer><p>Footer</p></footer>');
    });
  });

  describe('normalizeInlineFooterContent()', () => {
    it('removes page counters for inline fallback rendering', () => {
      expect(normalizeInlineFooterContent('<p>Page -pageNumber- / -totalPages-</p>'))
        .toBe('<p>Page  / </p>');
    });
  });

  describe('normalizePuppeteerFooterContent()', () => {
    it('extracts body content from a full HTML footer fragment', () => {
      expect(normalizePuppeteerFooterContent('<html><body><div>Footer</div></body></html>'))
        .toBe('<div>Footer</div>');
    });
  });
});
