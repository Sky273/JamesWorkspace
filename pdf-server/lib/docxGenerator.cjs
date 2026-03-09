/**
 * DOCX/DOC Generator using PrinceXML + LibreOffice
 * Strategy: Generate PDF with Prince (perfect CSS rendering) then convert to DOCX/DOC with LibreOffice
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./logger.cjs');
const { buildPrinceHtml } = require('./htmlBuilder.cjs');

/**
 * Generate DOCX or DOC from HTML content
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
  const tempDir = os.tmpdir();
  const tempId = `docx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const htmlFilePath = path.join(tempDir, `${tempId}.html`);
  const pdfFilePath = path.join(tempDir, `${tempId}.pdf`);
  
  // Determine output format
  const isDoc = format === 'doc';
  const outputFormat = isDoc ? 'doc' : 'docx';
  const outputFilter = isDoc ? 'MS Word 97' : 'MS Word 2007 XML';
  const docxFilePath = path.join(tempDir, `${tempId}.${outputFormat}`);

  try {
    // Build the complete HTML document
    const wrappedHtmlContent = buildPrinceHtml({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    });

    log('info', `${outputFormat.toUpperCase()} generation via Prince+LibreOffice`, { 
      hasHeader: !!headerContent, 
      hasFooter: !!(footerContent && footerContent.trim()),
      headerLength: headerContent?.length || 0,
      footerLength: footerContent?.length || 0,
      htmlLength: wrappedHtmlContent.length
    });

    // Step 1: Write HTML to temp file and generate PDF with Prince
    fs.writeFileSync(htmlFilePath, wrappedHtmlContent, 'utf8');
    
    try {
      execSync(`prince "${htmlFilePath}" -o "${pdfFilePath}"`, {
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', 'Prince PDF generation failed', { error: cmdError.message });
      throw new Error(`Prince PDF generation failed: ${cmdError.message}`);
    }
    
    if (!fs.existsSync(pdfFilePath)) {
      throw new Error('Prince did not generate the PDF file');
    }

    // Step 2: Convert PDF to DOC/DOCX using LibreOffice
    const libreOfficeCmd = `soffice --headless --infilter="writer_pdf_import" --convert-to ${outputFormat}:"${outputFilter}" --outdir "${tempDir}" "${pdfFilePath}"`;
    
    log('debug', 'LibreOffice conversion command', { cmd: libreOfficeCmd, format: outputFormat });
    
    try {
      execSync(libreOfficeCmd, { 
        timeout: 60000, // 60 second timeout for PDF conversion
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', `LibreOffice PDF to ${outputFormat.toUpperCase()} conversion failed`, { error: cmdError.message });
      throw new Error(`LibreOffice conversion failed: ${cmdError.message}`);
    }

    // Check if file was generated
    if (!fs.existsSync(docxFilePath)) {
      throw new Error(`LibreOffice did not generate the ${outputFormat.toUpperCase()} file`);
    }

    // Read and return the generated file
    const docxBuffer = fs.readFileSync(docxFilePath);
    
    log('debug', `${outputFormat.toUpperCase()} generated`, { size: `${Math.round(docxBuffer.length / 1024)}KB` });
    
    return docxBuffer;
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(htmlFilePath)) fs.unlinkSync(htmlFilePath);
      if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
      if (fs.existsSync(docxFilePath)) fs.unlinkSync(docxFilePath);
    } catch (cleanupError) {
      log('warn', 'Failed to cleanup temp files', { error: cleanupError.message });
    }
  }
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
