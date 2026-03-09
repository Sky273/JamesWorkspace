/**
 * PDF Generator using PrinceXML
 * Generates high-quality PDFs from HTML content
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./logger.cjs');
const { buildPrinceHtml } = require('./htmlBuilder.cjs');

/**
 * Generate PDF from HTML content using PrinceXML
 * @param {Object} options - Generation options
 * @param {string} options.htmlContent - Main body HTML content
 * @param {string} options.stylesheet - Custom CSS stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {string} options.footerContent - Footer HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight }) {
  const tempDir = os.tmpdir();
  const tempId = `pdf_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const htmlFilePath = path.join(tempDir, `${tempId}.html`);
  const pdfFilePath = path.join(tempDir, `${tempId}.pdf`);

  try {
    // Build the complete HTML document
    const wrappedHtmlContent = buildPrinceHtml({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    });

    // Write HTML to temporary file
    fs.writeFileSync(htmlFilePath, wrappedHtmlContent, 'utf8');
    
    log('debug', 'Prince PDF generation', { 
      htmlLength: wrappedHtmlContent.length, 
      hasHeader: !!headerContent, 
      hasFooter: !!(footerContent && footerContent.trim()) 
    });

    // Generate PDF using Prince
    try {
      execSync(`prince "${htmlFilePath}" -o "${pdfFilePath}"`, {
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', 'Prince PDF generation failed', { 
        error: cmdError.message, 
        stderr: cmdError.stderr?.toString() 
      });
      throw new Error(`Prince PDF generation failed: ${cmdError.message}`);
    }

    // Check if PDF was generated
    if (!fs.existsSync(pdfFilePath)) {
      throw new Error('Prince did not generate the PDF file');
    }

    // Read and return the generated PDF
    const pdfBuffer = fs.readFileSync(pdfFilePath);
    
    log('debug', 'PDF generated', { size: `${Math.round(pdfBuffer.length / 1024)}KB` });
    
    return pdfBuffer;
  } finally {
    // Cleanup temporary files
    try {
      if (fs.existsSync(htmlFilePath)) fs.unlinkSync(htmlFilePath);
      if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
    } catch (cleanupError) {
      log('warn', 'Failed to cleanup temp files', { error: cleanupError.message });
    }
  }
}

module.exports = { generatePdf };
