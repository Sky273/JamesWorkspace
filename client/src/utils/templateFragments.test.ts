import { describe, expect, it } from 'vitest';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  summarizeTemplatePayload,
} from './templateFragments';

describe('templateFragments', () => {
  it('strips full-document wrappers from footer fragments', () => {
    const fragment = `
      <!DOCTYPE html>
      <html>
        <head><style>.x{color:red;}</style></head>
        <body><footer><p>-name-</p><span>-title-</span></footer></body>
      </html>
    `;

    expect(normalizeTemplateFragment(fragment, 'footer')).toBe('<footer><p>-name-</p><span>-title-</span></footer>');
  });

  it('keeps simple fragments unchanged', () => {
    expect(normalizeTemplateFragment('<header><strong>-name-</strong></header>', 'header')).toBe(
      '<header><strong>-name-</strong></header>'
    );
  });

  it('normalizes stylesheet wrappers and applies placeholders', () => {
    const stylesheet = '<style>.page { color: blue; }</style>';
    const template = '<section><h1>-name-</h1><h2>-title-</h2><div>-content-</div></section>';

    expect(normalizeTemplateStylesheet(stylesheet)).toBe('.page { color: blue; }');
    expect(applyTemplatePlaceholders(template, { name: 'Alice', title: 'CTO', content: '<p>Body</p>' })).toBe(
      '<section><h1>Alice</h1><h2>CTO</h2><div><p>Body</p></div></section>'
    );
  });

  it('summarizes oversized raw fragments versus normalized payload', () => {
    const summary = summarizeTemplatePayload({
      HeaderContent: '<html><body><header><p>Head</p></header></body></html>',
      FooterContent: '<html><body><footer><p>Foot</p></footer></body></html>',
      Stylesheet: '<style>.a{}</style>',
    });

    expect(summary.headerHadDocumentWrappers).toBe(true);
    expect(summary.footerHadDocumentWrappers).toBe(true);
    expect(summary.normalizedHeaderLength).toBeLessThan(summary.rawHeaderLength);
    expect(summary.normalizedFooterLength).toBeLessThan(summary.rawFooterLength);
    expect(summary.normalizedStylesheetLength).toBeLessThan(summary.rawStylesheetLength);
  });
});
