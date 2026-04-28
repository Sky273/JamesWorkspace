import { removeSuggestionMarkers } from '../components/TiptapEditor/suggestionsHtml';
import type { Resume } from '../types/entities';
import type { ExportFormat } from '../components/ResumeAnalysis/ExportTab';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  removeUnsupportedDocumentResources,
  templateUsesLogoPlaceholder,
} from '../utils/templateFragments';
import { getFirmIdFromRecord, resolveFirmLogoMarkup } from '../utils/firmLogo';

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

export async function processResumeTemplate(
  resume: Resume,
  template: TemplateLike
): Promise<ProcessedTemplate> {
  const rawContent = resume['Improved Text'] || resume['Original Text'] || '';
  const content = removeSuggestionMarkers(rawContent);
  const candidateName = (resume['Name'] as string) || 'Candidat';
  const candidateTitle = (resume['Title'] as string) || '';
  const logoMarkup = templateUsesLogoPlaceholder(template)
    ? await resolveFirmLogoMarkup({
      firmId: getFirmIdFromRecord(resume as Record<string, unknown>),
      resumeId: resume.id,
    })
    : '';

  const processedBody = removeUnsupportedDocumentResources(applyTemplatePlaceholders(template.TemplateContent, {
    name: candidateName,
    title: candidateTitle,
    content,
    logoMarkup,
  }));
  const processedHeader = removeUnsupportedDocumentResources(applyTemplatePlaceholders(
    normalizeTemplateFragment(template.HeaderContent, 'header'),
    { name: candidateName, title: candidateTitle, logoMarkup }
  ));
  const processedFooter = removeUnsupportedDocumentResources(applyTemplatePlaceholders(
    normalizeTemplateFragment(template.FooterContent, 'footer'),
    { name: candidateName, title: candidateTitle, logoMarkup }
  ));

  return {
    body: processedBody,
    headerContent: processedHeader || undefined,
    footerContent: processedFooter || undefined,
    footerHeight: Number(template.FooterHeight || 25),
    stylesheet: normalizeTemplateStylesheet(template.Stylesheet),
    candidateName,
  };
}

export async function buildSharePayload(resume: Resume, template: TemplateLike): Promise<SharePayload> {
  const processed = await processResumeTemplate(resume, template);

  return {
    htmlContent: processed.body,
    filename: processed.candidateName.replace(/\s+/g, '_'),
    stylesheet: processed.stylesheet,
    headerContent: processed.headerContent,
    footerContent: processed.footerContent,
    footerHeight: processed.footerHeight,
  };
}

export async function buildExportPayload(
  resume: Resume,
  template: TemplateLike,
  format: ExportFormat
): Promise<ExportPayload> {
  const sharePayload = await buildSharePayload(resume, template);
  const fileExtension = format === 'pdf' ? 'pdf' : format;

  return {
    ...sharePayload,
    filename: `${sharePayload.filename}.${fileExtension}`,
    format,
  };
}
