import { formatDate } from '../utils/dateFormatter';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
  removeUnsupportedDocumentResources,
  templateUsesLogoPlaceholder,
} from '../utils/templateFragments';
import { getFirmIdFromRecord, resolveFirmLogoMarkup } from '../utils/firmLogo';
import type { Adaptation, Template } from './AdaptationViewPage.types';

export function formatAdaptationDate(dateString: string | undefined, language: string): string {
  const locale = language === 'fr' ? 'fr-FR' : 'en-US';
  return formatDate(dateString, 'long', locale) || '';
}

export function getAdaptationName(adaptation: Adaptation): string {
  return adaptation['Resume Name'] || adaptation['Candidate Name'] || adaptation.ResumeName || 'Candidat';
}

export function getAdaptationTitle(adaptation: Adaptation): string {
  return adaptation['Adapted Title'] || adaptation['Mission Title'] || 'CV Adapté';
}

export async function buildTemplateHtml(
  template: Template,
  adaptation: Adaptation,
  content: string,
): Promise<{
  processedBody: string;
  processedHeader: string;
  processedFooter: string;
  name: string;
  title: string;
}> {
  const name = getAdaptationName(adaptation);
  const title = getAdaptationTitle(adaptation);
  const logoMarkup = templateUsesLogoPlaceholder(template)
    ? await resolveFirmLogoMarkup({
      firmId: getFirmIdFromRecord(adaptation as Record<string, unknown>),
      resumeId: String(adaptation['Resume ID'] || adaptation.Resume?.[0] || ''),
    })
    : '';

  const processedBody = removeUnsupportedDocumentResources(
    applyTemplatePlaceholders(template.TemplateContent, { name, title, content, logoMarkup })
  );
  const processedHeader = removeUnsupportedDocumentResources(applyTemplatePlaceholders(
    normalizeTemplateFragment(template.HeaderContent, 'header'),
    { name, title, logoMarkup }
  ));
  const processedFooter = removeUnsupportedDocumentResources(applyTemplatePlaceholders(
    normalizeTemplateFragment(template.FooterContent, 'footer'),
    { name, title, logoMarkup }
  ));

  return { processedBody, processedHeader, processedFooter, name, title };
}

export async function buildEmailAttachmentHtml(template: Template, adaptation: Adaptation, content: string): Promise<{
  htmlContent: string;
  filenameBase: string;
}> {
  const { processedBody, processedHeader, processedFooter, name, title } = await buildTemplateHtml(template, adaptation, content);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${normalizeTemplateStylesheet(template.Stylesheet)}</style>
    </head>
    <body>
      ${processedHeader}
      ${processedBody}
      ${processedFooter}
    </body>
    </html>
  `;

  return {
    htmlContent,
    filenameBase: `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/[^a-zA-Z0-9]/g, '_')}`,
  };
}
