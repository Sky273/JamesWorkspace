import { describe, expect, it, vi } from 'vitest';
import {
  processResumeTemplate,
  buildSharePayload,
  buildExportPayload,
} from './resumeDocumentPayload';

vi.mock('../utils/tinymceSuggestionsPlugin', () => ({
  removeSuggestionMarkers: vi.fn((value: string) => value.replace(/\[\[suggestion\]\]/g, '')),
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
});
