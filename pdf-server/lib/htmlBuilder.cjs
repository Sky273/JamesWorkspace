/**
 * HTML builder utilities for PDF/DOCX generation
 * Shared between PDF and DOCX generators
 */

/**
 * Build Puppeteer-compatible HTML document for PDF generation
 * Header is included in the body (first page), footer can be native Puppeteer or inlined as a fallback
 * @param {Object} options - Build options
 * @param {string} options.htmlContent - Main body content
 * @param {string} options.stylesheet - Custom stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {string} options.footerContent - Footer HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @param {boolean} options.hasFooter - Whether footer content exists
 * @param {boolean} options.inlineFooter - Whether footer should be rendered in the document body
 * @returns {string} Complete HTML document
 */
function normalizeInlineFooterContent(footerContent) {
  if (!footerContent || !footerContent.trim()) {
    return '';
  }

  return footerContent
    .replace(/-pageNumber-/gi, '')
    .replace(/-totalPages-/gi, '');
}

function stripDocumentWrappers(fragment) {
  if (!fragment || !fragment.trim()) {
    return '';
  }

  const bodyMatch = fragment.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  const source = bodyMatch ? bodyMatch[1] : fragment;

  return source
    .replace(/<!doctype[^>]*>/gi, '')
    .replace(/<\/?(html|head|body|meta|title|link)\b[^>]*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .trim();
}

function normalizePuppeteerFooterContent(footerContent) {
  const normalized = stripDocumentWrappers(footerContent);
  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/<hr([^>]*?)style="([^"]*?)height:\s*(\d+)px;?\s*([^"]*?)background-color:\s*([^;"]+);?([^"]*?)"([^>]*?)>/gi,
      '<div style="height: $3px; background-color: $5; $2$4$6 -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>')
    .replace(/-pageNumber-/gi, '<span class="pageNumber"></span>')
    .replace(/-totalPages-/gi, '<span class="totalPages"></span>');
}

function buildPuppeteerHtml({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, hasFooter, inlineFooter }) {
  const styleTag = stylesheet && stylesheet.trim() !== '' ? `<style>${stylesheet}</style>` : '';
  
  // Build header section (inline in body - appears on first page only)
  const headerSection = headerContent ? `<header class="pdf-header">${headerContent}</header>` : '';
  const footerSection = inlineFooter && footerContent
    ? `<footer class="pdf-footer">${normalizeInlineFooterContent(footerContent)}</footer>`
    : '';
  
  // Keep @page aligned with Puppeteer's bottom margin; the PDF margin remains the source of truth.
  const bodyPaddingBottom = hasFooter && !inlineFooter ? Math.min(Math.max(Number(footerHeight || 25), 10), 250) : 0;
  
  // Puppeteer-compatible CSS
  const layoutStyles = `
    <style>
      @page {
        margin-bottom: ${bodyPaddingBottom}mm;
      }
      html, body {
        margin: 0;
        padding: 0;
        font-family: Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11pt;
        line-height: 1.4;
      }
      .pdf-header {
        margin-bottom: 15px;
        padding-bottom: 10px;
      }
      .pdf-body {
        /* Content will respect @page margin */
      }
      .pdf-body,
      .pdf-body section,
      .pdf-body article,
      .pdf-body div,
      .pdf-body p,
      .pdf-body ul,
      .pdf-body ol,
      .pdf-body li {
        break-inside: auto !important;
        page-break-inside: auto !important;
      }
      .pdf-body h1,
      .pdf-body h2,
      .pdf-body h3,
      .pdf-body h4 {
        break-after: avoid;
        page-break-after: avoid;
      }
      .pdf-footer {
        margin-top: 16px;
        padding-top: 8px;
        break-inside: avoid;
      }
      /* Ensure images are properly sized */
      img {
        max-width: 100%;
        height: auto;
      }
      /* Print color support */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    </style>
  `;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${styleTag}
  ${layoutStyles}
</head>
<body>
  ${headerSection}
  <main class="pdf-body">${htmlContent}</main>
  ${footerSection}
</body>
</html>`;
}

/**
 * Build Puppeteer footer template
 * Puppeteer requires specific HTML template for footers with inline styles
 * @param {string} footerContent - Footer HTML content
 * @param {string} stylesheet - Template stylesheet that must also apply inside Puppeteer's isolated footer template
 * @returns {string} Puppeteer footer template
 */
function buildPuppeteerFooter(footerContent, stylesheet = '') {
  if (!footerContent || !footerContent.trim()) {
    return '<span></span>';
  }
  const processedFooter = normalizePuppeteerFooterContent(footerContent);
  if (!processedFooter) {
    return '<span></span>';
  }
  const styleTag = stylesheet && stylesheet.trim() !== '' ? `${stylesheet}\n` : '';
  
  // Puppeteer footer template with inline styles
  // Note: External CSS doesn't apply to footer template, everything must be inline
  return `
    <style>
      ${styleTag}
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
    </style>
    <div style="width: 100%; font-size: 8px; padding: 2mm 10mm; box-sizing: border-box; -webkit-print-color-adjust: exact; line-height: 1.2;">
      ${processedFooter}
    </div>
  `;
}

 module.exports = {
  buildPuppeteerHtml,
  buildPuppeteerFooter,
  normalizeInlineFooterContent,
  normalizePuppeteerFooterContent
 };
