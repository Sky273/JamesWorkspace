import { describe, expect, it, vi } from 'vitest';
import {
  processResumeTemplate,
  buildSharePayload,
  buildExportPayload,
} from './resumeDocumentPayload';

vi.mock('../components/TiptapEditor', async () => {
  const actual = await vi.importActual<typeof import('../components/TiptapEditor')>('../components/TiptapEditor');
  return {
    ...actual,
    removeSuggestionMarkers: vi.fn((value: string) => value.replace(/\[\[suggestion\]\]/g, '')),
  };
});

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

  it('processes template placeholders with sanitized improved content', () => {
    expect(processResumeTemplate(resume as never, template)).toEqual({
      body: '<main>Jane Doe|Engineer|Improved profile</main>',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
      stylesheet: 'body { color: red; }',
      candidateName: 'Jane Doe',
    });
  });

  it('builds the share payload without file extension', () => {
    expect(buildSharePayload(resume as never, template)).toEqual({
      htmlContent: '<main>Jane Doe|Engineer|Improved profile</main>',
      filename: 'Jane_Doe',
      stylesheet: 'body { color: red; }',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
    });
  });

  it('builds the export payload with the selected format extension', () => {
    expect(buildExportPayload(resume as never, template, 'docx')).toEqual({
      htmlContent: '<main>Jane Doe|Engineer|Improved profile</main>',
      filename: 'Jane_Doe.docx',
      stylesheet: 'body { color: red; }',
      headerContent: '<header>Jane Doe</header>',
      footerContent: '<footer>Engineer</footer>',
      footerHeight: 40,
      format: 'docx',
    });
  });

  it('normalizes extracted full-document header and footer fragments before export', () => {
    const extractedTemplate = {
      TemplateContent: '<main>-content-</main>',
      HeaderContent: '<html><head><style>.x{color:red}</style></head><body><div>noise</div><header><div>-name-</div></header></body></html>',
      FooterContent: '<html><body><section>noise</section><footer><div>-title-</div></footer></body></html>',
      FooterHeight: 25,
      Stylesheet: '<style>body { color: red; }</style>',
    };

    expect(buildExportPayload(resume as never, extractedTemplate, 'pdf')).toEqual({
      htmlContent: '<main>Improved profile</main>',
      filename: 'Jane_Doe.pdf',
      stylesheet: 'body { color: red; }',
      headerContent: '<header><div>Jane Doe</div></header>',
      footerContent: '<footer><div>Engineer</div></footer>',
      footerHeight: 25,
      format: 'pdf',
    });
  });
});
