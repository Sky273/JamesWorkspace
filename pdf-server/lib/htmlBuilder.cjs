/**
 * HTML builder utilities for PDF/DOCX generation
 * Shared between PDF and DOCX generators
 */

/**
 * Build Puppeteer-compatible HTML document for PDF generation
 * Header is included in the body (first page), footer is handled by Puppeteer's displayHeaderFooter
 * @param {Object} options - Build options
 * @param {string} options.htmlContent - Main body content
 * @param {string} options.stylesheet - Custom stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @param {boolean} options.hasFooter - Whether footer content exists
 * @returns {string} Complete HTML document
 */
function buildPuppeteerHtml({ htmlContent, stylesheet, headerContent, footerHeight, hasFooter }) {
  const styleTag = stylesheet && stylesheet.trim() !== '' ? `<style>${stylesheet}</style>` : '';
  
  // Build header section (inline in body - appears on first page only)
  const headerSection = headerContent ? `<header class="pdf-header">${headerContent}</header>` : '';
  
  // Calculate body padding to account for footer margin
  const bodyPaddingBottom = hasFooter ? Math.min((footerHeight || 25) + 20, 250) : 0;
  
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
</body>
</html>`;
}

/**
 * Build Puppeteer footer template
 * Puppeteer requires specific HTML template for footers with inline styles
 * @param {string} footerContent - Footer HTML content
 * @returns {string} Puppeteer footer template
 */
function buildPuppeteerFooter(footerContent) {
  if (!footerContent || !footerContent.trim()) {
    return '<span></span>';
  }
  
  // Process footer content for Puppeteer
  // Convert hr with inline background-color to div for better PDF rendering
  let processedFooter = footerContent
    .replace(/<hr([^>]*?)style="([^"]*?)height:\s*(\d+)px;?\s*([^"]*?)background-color:\s*([^;"]+);?([^"]*?)"([^>]*?)>/gi,
      '<div style="height: $3px; background-color: $5; $2$4$6 -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>');
  
  // Replace page number placeholders with Puppeteer's special classes
  processedFooter = processedFooter
    .replace(/-pageNumber-/gi, '<span class="pageNumber"></span>')
    .replace(/-totalPages-/gi, '<span class="totalPages"></span>');
  
  // Puppeteer footer template with inline styles
  // Note: External CSS doesn't apply to footer template, everything must be inline
  return `
    <style>
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
    </style>
    <div style="width: 100%; font-size: 8px; padding: 2mm 10mm; box-sizing: border-box; -webkit-print-color-adjust: exact; line-height: 1.2;">
      ${processedFooter}
    </div>
  `;
}

module.exports = { buildPuppeteerHtml, buildPuppeteerFooter };
