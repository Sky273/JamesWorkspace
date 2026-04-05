import { removeSuggestionMarkers } from '../components/TiptapEditor';
import type { Resume } from '../types/entities';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
} from '../utils/templateFragments';

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

  const processedBody = applyTemplatePlaceholders(template.TemplateContent, {
    name: candidateName,
    title: candidateTitle,
    content,
  });
  const processedHeader = applyTemplatePlaceholders(
    normalizeTemplateFragment(template.HeaderContent, 'header'),
    { name: candidateName, title: candidateTitle }
  );
  const processedFooter = applyTemplatePlaceholders(
    normalizeTemplateFragment(template.FooterContent, 'footer'),
    { name: candidateName, title: candidateTitle }
  );

  return {
    body: processedBody,
    headerContent: processedHeader || undefined,
    footerContent: processedFooter || undefined,
    footerHeight: Number(template.FooterHeight || 25),
    stylesheet: normalizeTemplateStylesheet(template.Stylesheet),
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
