import { describe, expect, it, vi } from 'vitest';
import {
  processResumeTemplate,
  buildSharePayload,
  buildExportPayload,
} from './resumeDocumentPayload';
import { resolveFirmLogoMarkup } from '../utils/firmLogo';

vi.mock('../components/TiptapEditor/suggestionsHtml', async () => {
  const actual = await vi.importActual<typeof import('../components/TiptapEditor/suggestionsHtml')>('../components/TiptapEditor/suggestionsHtml');
  return {
    ...actual,
    removeSuggestionMarkers: vi.fn((value: string) => value.replace(/\[\[suggestion\]\]/g, '')),
  };
});

vi.mock('../utils/firmLogo', () => ({
  getFirmIdFromRecord: vi.fn(() => null),
  resolveFirmLogoMarkup: vi.fn(async () => ''),
}));

describe('resumeDocumentPayload', () => {
  const resume = {
    id: 'resume-1',
    Name: 'Jane Doe',
    Title: 'Engineer',
    'Improved Text': '[[suggestion]]Improved profile',
    'Original Text': 'Original profile',
  };

  const template = {
    TemplateContent: '<main>-name-|-title-|-content-</main>',
    HeaderContent: '<header>-name-</header>',
    FooterContent: '<footer>-title-</footer>',
    FooterHeight: 40,
    Stylesheet: 'body { color: red; }',
  };

  it('processes template placeholders with sanitized improved content', async () => {
    expect(await processResumeTemplate(resume as never, template)).toEqual({
      body: '<main>Jane Doe|Engineer|Improved profile</main>',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
      stylesheet: 'body { color: red; }',
      candidateName: 'Jane Doe',
    });
  });

  it('builds the share payload without file extension', async () => {
    expect(await buildSharePayload(resume as never, template)).toEqual({
      htmlContent: '<main>Jane Doe|Engineer|Improved profile</main>',
      filename: 'Jane_Doe',
      stylesheet: 'body { color: red; }',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
    });
  });

  it('builds the export payload with the selected format extension', async () => {
    expect(await buildExportPayload(resume as never, template, 'docx')).toEqual({
      htmlContent: '<main>Jane Doe|Engineer|Improved profile</main>',
      filename: 'Jane_Doe.docx',
      stylesheet: 'body { color: red; }',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
      format: 'docx',
    });
  });

  it('normalizes extracted full-document header and footer fragments before export', async () => {
    const extractedTemplate = {
      TemplateContent: '<main>-content-</main>',
      HeaderContent: '<html><head><style>.x{color:red}</style></head><body><div>noise</div><header><div>-name-</div></header></body></html>',
      FooterContent: '<html><body><section>noise</section><footer><div>-title-</div></footer></body></html>',
      FooterHeight: 25,
      Stylesheet: '<style>body { color: red; }</style>',
    };

    expect(await buildExportPayload(resume as never, extractedTemplate, 'pdf')).toEqual({
      htmlContent: '<main>Improved profile</main>',
      filename: 'Jane_Doe.pdf',
      stylesheet: 'body { color: red; }',
      headerContent: '<header><div>Jane Doe</div></header>',
      footerContent: '<footer><div>Engineer</div></footer>',
      footerHeight: 25,
      format: 'pdf',
    });
  });

  it('replaces -logo- across body, header, and footer when a logo is resolved', async () => {
    vi.mocked(resolveFirmLogoMarkup).mockResolvedValueOnce('<img src="data:image/png;base64,AAA" alt="Cabinet logo" />');

    const templateWithLogo = {
      TemplateContent: '<main>-logo-|-content-</main>',
      HeaderContent: '<header>-logo-</header>',
      FooterContent: '<footer>-logo-</footer>',
      FooterHeight: 20,
      Stylesheet: '',
    };

    const payload = await buildExportPayload(resume as never, templateWithLogo, 'pdf');

    expect(payload.htmlContent).toContain('<img src="data:image/png;base64,AAA" alt="Cabinet logo" />');
    expect(payload.headerContent).toContain('<img src="data:image/png;base64,AAA" alt="Cabinet logo" />');
    expect(payload.footerContent).toContain('<img src="data:image/png;base64,AAA" alt="Cabinet logo" />');
    expect(payload.htmlContent).not.toContain('-logo-');
    expect(payload.headerContent).not.toContain('-logo-');
    expect(payload.footerContent).not.toContain('-logo-');
  });

  it('removes unsupported external resources before sending fragments to the PDF server', async () => {
    const templateWithExternalFooterImage = {
      TemplateContent: '<main><a href="https://example.test/profile">-content-</a><img src="data:image/png;base64,AAA" /></main>',
      HeaderContent: '<header><img src="https://resumeconverter.net/api/firms/2bb9e8df-b051-4cfd-8770-29425c602ced/logo/image" /></header>',
      FooterContent: '<footer><img src="https://resumeconverter.net/api/firms/2bb9e8df-b051-4cfd-8770-29425c602ced/logo/image" /><span>-title-</span></footer>',
      FooterHeight: 25,
      Stylesheet: '',
    };

    const payload = await buildExportPayload(resume as never, templateWithExternalFooterImage, 'pdf');

    expect(payload.htmlContent).not.toContain('https://example.test/profile');
    expect(payload.htmlContent).toContain('src="data:image/png;base64,AAA"');
    expect(payload.headerContent).not.toContain('https://resumeconverter.net');
    expect(payload.footerContent).not.toContain('https://resumeconverter.net');
    expect(payload.footerContent).toContain('<span>Engineer</span>');
  });
});
