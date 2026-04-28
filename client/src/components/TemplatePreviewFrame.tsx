import { useMemo } from 'react';

import { sanitizeHtml } from '../utils/sanitizer.frontend';
import { removeUnsupportedDocumentResources } from '../utils/templateFragments';

interface TemplatePreviewFrameProps {
  stylesheet?: string;
  headerContent?: string;
  templateContent?: string;
  footerContent?: string;
  title?: string;
  className?: string;
  scale?: number;
}

const normalizeStylesheet = (stylesheet?: string): string => {
  if (!stylesheet) {
    return '';
  }

  return stylesheet
    .replace(/<\/?style\b[^>]*>/gi, '')
    .replace(/<\/?script\b[^>]*>/gi, '')
    .trim();
};

const TemplatePreviewFrame = ({
  stylesheet,
  headerContent,
  templateContent,
  footerContent,
  title = 'Template preview',
  className = 'w-full h-full border-0 bg-white',
  scale = 1,
}: TemplatePreviewFrameProps): JSX.Element => {
  const srcDoc = useMemo(() => {
    const safeStylesheet = normalizeStylesheet(stylesheet);
    const safeHeader = removeUnsupportedDocumentResources(sanitizeHtml(headerContent));
    const safeContent = removeUnsupportedDocumentResources(sanitizeHtml(templateContent));
    const safeFooter = removeUnsupportedDocumentResources(sanitizeHtml(footerContent));
    const normalizedScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const scaledWidth = normalizedScale === 1 ? '100%' : `${100 / normalizedScale}%`;
    const previewWrapperStyle = normalizedScale === 1
      ? 'min-height:100%;'
      : `transform:scale(${normalizedScale});transform-origin:top left;width:${scaledWidth};min-height:${100 / normalizedScale}%;`;

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
      }
      body {
        min-height: 100vh;
      }
      #template-preview-root {
        ${previewWrapperStyle}
      }
      ${safeStylesheet}
    </style>
  </head>
  <body>
    <div id="template-preview-root">
      ${safeHeader}
      ${safeContent}
      ${safeFooter}
    </div>
  </body>
</html>`;
  }, [footerContent, headerContent, scale, stylesheet, templateContent]);

  return (
    <iframe
      title={title}
      srcDoc={srcDoc}
      className={className}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
    />
  );
};

export default TemplatePreviewFrame;
