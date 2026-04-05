import { formatDate } from '../utils/dateFormatter';
import {
  applyTemplatePlaceholders,
  normalizeTemplateFragment,
  normalizeTemplateStylesheet,
} from '../utils/templateFragments';
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

  const processedBody = applyTemplatePlaceholders(template.TemplateContent, { name, title, content });
  const processedHeader = applyTemplatePlaceholders(
    normalizeTemplateFragment(template.HeaderContent, 'header'),
    { name, title }
  );
  const processedFooter = applyTemplatePlaceholders(
    normalizeTemplateFragment(template.FooterContent, 'footer'),
    { name, title }
  );

  return { processedBody, processedHeader, processedFooter, name, title };
}

export function buildEmailAttachmentHtml(template: Template, adaptation: Adaptation, content: string): {
  htmlContent: string;
  filenameBase: string;
} {
  const { processedBody, processedHeader, processedFooter, name, title } = buildTemplateHtml(template, adaptation, content);

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
