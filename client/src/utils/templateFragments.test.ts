import { describe, expect, it } from 'vitest';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  removeUnsupportedDocumentResources,
  summarizeTemplatePayload,
  templateUsesLogoPlaceholder,
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
    const template = '<section><h1>-name-</h1><h2>-title-</h2><div>-logo-</div><div>-content-</div></section>';

    expect(normalizeTemplateStylesheet(stylesheet)).toBe('.page { color: blue; }');
    expect(applyTemplatePlaceholders(template, { name: 'Alice', title: 'CTO', content: '<p>Body</p>', logoMarkup: '<img src="logo.png">' })).toBe(
      '<section><h1>Alice</h1><h2>CTO</h2><div><img src="logo.png"></div><div><p>Body</p></div></section>'
    );
  });

  it('removes stylesheet URL references that would trigger browser refreshes or PDF rejection', () => {
    const stylesheet = `
      <style>
        @import url("https://example.test/theme.css");
        .page { background-image: url("/2bb9e8df-b051-4cfd-8770-29425c602ced"); }
        .avatar { background: url(2bb9e8df-b051-4cfd-8770-29425c602ced) center / cover no-repeat; }
        .logo { background-image: url("data:image/png;base64,AAA"); }
      </style>
    `;

    const result = normalizeTemplateStylesheet(stylesheet);

    expect(result).not.toContain('@import');
    expect(result).not.toContain('/2bb9e8df-b051-4cfd-8770-29425c602ced');
    expect(result).not.toContain('url(2bb9e8df-b051-4cfd-8770-29425c602ced)');
    expect(result).toContain('url("data:image/png;base64,AAA")');
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

  it('detects -logo- in body, header, or footer', () => {
    expect(templateUsesLogoPlaceholder({
      TemplateContent: '<main>-logo-</main>',
      HeaderContent: '',
      FooterContent: '',
    })).toBe(true);
    expect(templateUsesLogoPlaceholder({
      TemplateContent: '',
      HeaderContent: '<header>-logo-</header>',
      FooterContent: '',
    })).toBe(true);
    expect(templateUsesLogoPlaceholder({
      TemplateContent: '',
      HeaderContent: '',
      FooterContent: '<footer>-logo-</footer>',
    })).toBe(true);
    expect(templateUsesLogoPlaceholder({
      TemplateContent: '<main>-content-</main>',
      HeaderContent: '',
      FooterContent: '',
    })).toBe(false);
  });

  it('removes bare UUID image sources that would hit the SPA fallback', () => {
    const fragment = '<footer><img src="/2bb9e8df-b051-4cfd-8770-29425c602ced" /><img src="2bb9e8df-b051-4cfd-8770-29425c602ced" /><span>Footer</span></footer>';

    const result = removeUnsupportedDocumentResources(fragment);

    expect(result).not.toContain('/2bb9e8df-b051-4cfd-8770-29425c602ced');
    expect(result).not.toContain('src="2bb9e8df-b051-4cfd-8770-29425c602ced"');
    expect(result).toContain('<span>Footer</span>');
  });

  it('keeps embedded data images while removing http resources', () => {
    const fragment = '<header><img src="data:image/png;base64,AAA" /><img src="https://example.test/logo.png" /></header>';

    const result = removeUnsupportedDocumentResources(fragment);

    expect(result).toContain('src="data:image/png;base64,AAA"');
    expect(result).not.toContain('https://example.test/logo.png');
  });
});
