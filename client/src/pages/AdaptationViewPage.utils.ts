import { formatDate } from '../utils/dateFormatter';
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

export function buildTemplateHtml(
  template: Template,
  adaptation: Adaptation,
  content: string,
): {
  processedBody: string;
  processedHeader: string;
  processedFooter: string;
  name: string;
  title: string;
} {
  const name = getAdaptationName(adaptation);
  const title = getAdaptationTitle(adaptation);

  let processedBody = template.TemplateContent || '';
  processedBody = processedBody.replace(/-name-/g, name);
  processedBody = processedBody.replace(/-title-/g, title);
  processedBody = processedBody.replace(/-content-/g, content);

  let processedHeader = template.HeaderContent || '';
  if (processedHeader) {
    processedHeader = processedHeader.replace(/-name-/g, name);
    processedHeader = processedHeader.replace(/-title-/g, title);
  }

  let processedFooter = template.FooterContent || '';
  if (processedFooter) {
    processedFooter = processedFooter.replace(/-name-/g, name);
    processedFooter = processedFooter.replace(/-title-/g, title);
  }

  return { processedBody, processedHeader, processedFooter, name, title };
}

export function buildEmailAttachmentHtml(template: Template, adaptation: Adaptation, content: string): {
  htmlContent: string;
  filenameBase: string;
} {
  const { processedBody, name, title } = buildTemplateHtml(template, adaptation, content);

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${template.Stylesheet || ''}</style>
    </head>
    <body>
      ${template.HeaderContent || ''}
      ${processedBody}
      ${template.FooterContent || ''}
    </body>
    </html>
  `;

  return {
    htmlContent,
    filenameBase: `${name.replace(/[^a-zA-Z0-9]/g, '_')}_${title.replace(/[^a-zA-Z0-9]/g, '_')}`,
  };
}
