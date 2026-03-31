import { removeSuggestionMarkers } from '../utils/tinymceSuggestionsPlugin';
import type { Resume } from '../types/entities';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';

interface TemplateLike {
  TemplateContent?: string;
  HeaderContent?: string;
  FooterContent?: string;
  FooterHeight?: number;
  Stylesheet?: string;
}

interface ProcessedTemplate {
  body: string;
  headerContent?: string;
  footerContent?: string;
  footerHeight: number;
  stylesheet: string;
  candidateName: string;
}

export interface SharePayload {
  htmlContent: string;
  filename: string;
  stylesheet: string;
  headerContent?: string;
  footerContent?: string;
  footerHeight: number;
}

export interface ExportPayload extends SharePayload {
  format: ExportFormat;
}

export function processResumeTemplate(
  resume: Resume,
  template: TemplateLike
): ProcessedTemplate {
  const rawContent = resume['Improved Text'] || resume['Original Text'] || '';
  const content = removeSuggestionMarkers(rawContent);
  const candidateName = (resume['Name'] as string) || 'Candidat';
  const candidateTitle = (resume['Title'] as string) || '';

  let processedBody = String(template.TemplateContent || '');
  processedBody = processedBody.replace(/-name-/g, candidateName);
  processedBody = processedBody.replace(/-title-/g, candidateTitle);
  processedBody = processedBody.replace(/-content-/g, content);

  let processedHeader = String(template.HeaderContent || '');
  if (processedHeader) {
    processedHeader = processedHeader.replace(/-name-/g, candidateName);
    processedHeader = processedHeader.replace(/-title-/g, candidateTitle);
  }

  let processedFooter = String(template.FooterContent || '');
  if (processedFooter) {
    processedFooter = processedFooter.replace(/-name-/g, candidateName);
    processedFooter = processedFooter.replace(/-title-/g, candidateTitle);
  }

  return {
    body: processedBody,
    headerContent: processedHeader || undefined,
    footerContent: processedFooter || undefined,
    footerHeight: Number(template.FooterHeight || 25),
    stylesheet: String(template.Stylesheet || ''),
    candidateName,
  };
}

export function buildSharePayload(resume: Resume, template: TemplateLike): SharePayload {
  const processed = processResumeTemplate(resume, template);

  return {
    htmlContent: processed.body,
    filename: processed.candidateName.replace(/\s+/g, '_'),
    stylesheet: processed.stylesheet,
    headerContent: processed.headerContent,
    footerContent: processed.footerContent,
    footerHeight: processed.footerHeight,
  };
}

export function buildExportPayload(
  resume: Resume,
  template: TemplateLike,
  format: ExportFormat
): ExportPayload {
  const sharePayload = buildSharePayload(resume, template);
  const fileExtension = format === 'pdf' ? 'pdf' : format;

  return {
    ...sharePayload,
    filename: `${sharePayload.filename}.${fileExtension}`,
    format,
  };
}
