/**
 * DOCX/DOC Generator - Hybrid approach
 * 
 * DOCX: HTML → Pandoc → DOCX (clean text, no frames, editable)
 * DOC:  HTML → Puppeteer → PDF → LibreOffice → DOC (visual fidelity with PDF)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./logger.cjs');
const { generatePdf } = require('./pdfGenerator.cjs');

/**
 * Build a complete HTML document for Pandoc conversion
 * @param {Object} options - Build options
 * @returns {string} Complete HTML document
 */
function buildPandocHtml({ htmlContent, stylesheet, headerContent, footerContent }) {
  const styles = stylesheet || '';
  
  let bodyContent = '';
  
  if (headerContent && headerContent.trim()) {
    bodyContent += `<div class="document-header">${headerContent}</div>\n`;
  }
  
  bodyContent += `<div class="document-body">${htmlContent}</div>\n`;
  
  if (footerContent && footerContent.trim()) {
    // Remove page number placeholders for DOCX (not supported by Pandoc)
    const cleanFooter = footerContent
      .replace(/-pageNumber-/gi, '')
      .replace(/-totalPages-/gi, '');
    bodyContent += `<div class="document-footer">${cleanFooter}</div>\n`;
  }
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${styles}
    body { font-family: Arial, sans-serif; }
    .document-header { margin-bottom: 20px; }
    .document-footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; font-size: 9pt; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

/**
 * Generate DOCX using Pandoc (clean text, no frames)
 */
async function generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent }) {
  const tempDir = os.tmpdir();
  const tempId = `docx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const htmlFilePath = path.join(tempDir, `${tempId}.html`);
  const docxFilePath = path.join(tempDir, `${tempId}.docx`);

  try {
    const wrappedHtmlContent = buildPandocHtml({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent
    });

    log('info', 'DOCX generation via Pandoc', { 
      hasHeader: !!headerContent, 
      hasFooter: !!(footerContent && footerContent.trim()),
      htmlLength: wrappedHtmlContent.length
    });

    fs.writeFileSync(htmlFilePath, wrappedHtmlContent, 'utf8');
    
    const pandocCmd = `pandoc "${htmlFilePath}" -f html -t docx -o "${docxFilePath}" --standalone`;
    
    try {
      execSync(pandocCmd, {
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', 'Pandoc HTML to DOCX conversion failed', { error: cmdError.message });
      throw new Error(`Pandoc conversion failed: ${cmdError.message}`);
    }
    
    if (!fs.existsSync(docxFilePath)) {
      throw new Error('Pandoc did not generate the DOCX file');
    }

    const docxBuffer = fs.readFileSync(docxFilePath);
    log('debug', 'DOCX generated via Pandoc', { size: `${Math.round(docxBuffer.length / 1024)}KB` });
    
    return docxBuffer;
  } finally {
    try {
      if (fs.existsSync(htmlFilePath)) fs.unlinkSync(htmlFilePath);
      if (fs.existsSync(docxFilePath)) fs.unlinkSync(docxFilePath);
    } catch (cleanupError) {
      log('warn', 'Failed to cleanup temp files', { error: cleanupError.message });
    }
  }
}

/**
 * Generate DOC using Puppeteer PDF + LibreOffice (visual fidelity)
 */
async function generateDocViaPdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight }) {
  const tempDir = os.tmpdir();
  const tempId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const pdfFilePath = path.join(tempDir, `${tempId}.pdf`);
  const docFilePath = path.join(tempDir, `${tempId}.doc`);

  try {
    log('info', 'DOC generation via Puppeteer PDF + LibreOffice', { 
      hasHeader: !!headerContent, 
      hasFooter: !!(footerContent && footerContent.trim())
    });

    // Step 1: Generate PDF using Puppeteer (same as PDF export)
    const pdfBuffer = await generatePdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    });

    // Write PDF to temp file
    fs.writeFileSync(pdfFilePath, pdfBuffer);

    // Step 2: Convert PDF to DOC using LibreOffice
    const libreOfficeCmd = `soffice --headless --infilter="writer_pdf_import" --convert-to doc:"MS Word 97" --outdir "${tempDir}" "${pdfFilePath}"`;
    
    log('debug', 'LibreOffice PDF to DOC conversion', { cmd: libreOfficeCmd });
    
    try {
      execSync(libreOfficeCmd, { 
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', 'LibreOffice PDF to DOC conversion failed', { error: cmdError.message });
      throw new Error(`LibreOffice conversion failed: ${cmdError.message}`);
    }

    if (!fs.existsSync(docFilePath)) {
      throw new Error('LibreOffice did not generate the DOC file');
    }

    const docBuffer = fs.readFileSync(docFilePath);
    log('debug', 'DOC generated via PDF', { size: `${Math.round(docBuffer.length / 1024)}KB` });
    
    return docBuffer;
  } finally {
    try {
      if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
      if (fs.existsSync(docFilePath)) fs.unlinkSync(docFilePath);
    } catch (cleanupError) {
      log('warn', 'Failed to cleanup temp files', { error: cleanupError.message });
    }
  }
}

/**
 * Generate DOCX or DOC from HTML content
 * 
 * Hybrid approach:
 * - DOCX: Pandoc (clean text, editable, no frames)
 * - DOC: Puppeteer PDF → LibreOffice (visual fidelity with PDF export)
 * 
 * @param {Object} options - Generation options
 * @param {string} options.htmlContent - Main body HTML content
 * @param {string} options.stylesheet - Custom CSS stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {string} options.footerContent - Footer HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @param {string} options.format - Output format: 'docx' or 'doc'
 * @returns {Promise<Buffer>} DOCX/DOC buffer
 */
async function generateDocx({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, format = 'docx' }) {
  if (format === 'doc') {
    // DOC: Use PDF-based approach for visual fidelity
    return generateDocViaPdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight });
  }
  
  // DOCX: Use Pandoc for clean, editable text
  return generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent });
}

/**
 * Get MIME type for document format
 * @param {string} format - 'doc' or 'docx'
 * @returns {string} MIME type
 */
function getDocMimeType(format) {
  return format === 'doc' 
    ? 'application/msword'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

/**
 * Get file extension for document format
 * @param {string} format - 'doc' or 'docx'
 * @returns {string} File extension with dot
 */
function getDocExtension(format) {
  return format === 'doc' ? '.doc' : '.docx';
}

module.exports = { generateDocx, getDocMimeType, getDocExtension };
