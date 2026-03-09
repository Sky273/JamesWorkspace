/**
 * HTML builder utilities for PDF/DOCX generation
 * Shared between PDF and DOCX generators
 */

/**
 * Build Prince-compatible HTML document with proper CSS for PDF generation
 * @param {Object} options - Build options
 * @param {string} options.htmlContent - Main body content
 * @param {string} options.stylesheet - Custom stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {string} options.footerContent - Footer HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @returns {string} Complete HTML document
 */
function buildPrinceHtml({ htmlContent, stylesheet, headerContent, footerContent, footerHeight: customFooterHeight }) {
  const styleTag = stylesheet && stylesheet.trim() !== '' ? `<style>${stylesheet}</style>` : '';
  
  // Build header section (inline in body, not in page margin - better for complex headers with images)
  const headerSection = headerContent ? `<header class="pdf-header">${headerContent}</header>` : '';
  const hasFooterContent = footerContent && footerContent.trim() !== '';
  
  // Process footer for Prince - replace page number placeholders
  let processedFooter = footerContent || '';
  if (hasFooterContent) {
    processedFooter = processedFooter
      .replace(/-pageNumber-/gi, '<span class="page-number"></span>')
      .replace(/-totalPages-/gi, '<span class="page-count"></span>');
  }
  const footerSection = hasFooterContent ? `<footer class="pdf-footer">${processedFooter}</footer>` : '';
  
  // Calculate margins
  const footerHeightMm = hasFooterContent ? Math.min((customFooterHeight || 25), 50) : 10;
  
  // Prince-specific CSS - header in body (first page only), footer in page margin
  const princeStyles = `
    <style>
      @page {
        size: A4;
        margin: 15mm 10mm ${footerHeightMm + 10}mm 10mm;
        
        @bottom-center {
          content: flow(footer);
        }
      }
      
      /* First page has smaller top margin for header */
      @page:first {
        margin-top: 10mm;
      }
      
      /* Page counter support */
      .page-number::before {
        content: counter(page);
      }
      .page-count::before {
        content: counter(pages);
      }
      
      html, body {
        margin: 0;
        padding: 0;
        font-family: Calibri, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 11pt;
        line-height: 1.4;
      }
      
      /* Header stays in body flow (first page only appearance) */
      .pdf-header {
        margin-bottom: 15px;
        padding-bottom: 10px;
      }
      
      /* Footer goes to page margin area */
      .pdf-footer {
        flow: static(footer);
        font-size: 9pt;
        text-align: center;
        padding-top: 5px;
      }
      
      .pdf-body {
        /* Main content area */
      }
      
      /* Ensure images are properly sized */
      img {
        max-width: 100%;
        height: auto;
      }
      
      /* Print color support */
      * {
        -prince-background-image-resolution: 300dpi;
        print-color-adjust: exact;
      }
    </style>
  `;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${styleTag}
  ${princeStyles}
</head>
<body>
  ${headerSection}
  ${footerSection}
  <main class="pdf-body">${htmlContent}</main>
</body>
</html>`;
}

module.exports = { buildPrinceHtml };
