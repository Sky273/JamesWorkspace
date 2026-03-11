/**
 * DOCX/DOC Generator - Hybrid approach
 * 
 * DOCX: HTML → Pandoc → DOCX with reference.docx (clean text, editable, footer on every page)
 *       Footer is injected into a dynamically created reference.docx template
 * DOC:  HTML → Puppeteer → PDF → LibreOffice → DOC (visual fidelity with PDF)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { log } = require('./logger.cjs');
const { generatePdf } = require('./pdfGenerator.cjs');

// Lazy load JSZip for DOCX manipulation
let JSZip = null;
async function getJSZip() {
  if (!JSZip) {
    JSZip = (await import('jszip')).default;
  }
  return JSZip;
}

/**
 * Convert HTML to simple OOXML paragraphs for Word footer
 * Handles basic HTML tags: p, div, br, img, span, strong, em, hr
 * @param {string} html - HTML content
 * @returns {string} OOXML paragraph elements
 */
function htmlToOoxml(html) {
  if (!html || !html.trim()) return '';
  
  let ooxml = '';
  
  // Process the HTML content
  // Split by block elements and process
  const content = html
    .replace(/-pageNumber-/gi, '<w:fldSimple w:instr=" PAGE "/>')
    .replace(/-totalPages-/gi, '<w:fldSimple w:instr=" NUMPAGES "/>');
  
  // Handle <hr> tags - convert to horizontal line
  const hrRegex = /<hr[^>]*style="[^"]*background-color:\s*([^;"]+)[^"]*"[^>]*>/gi;
  let processedContent = content.replace(hrRegex, (match, color) => {
    // Convert color name or hex to OOXML format
    const ooxmlColor = color.replace('#', '').toUpperCase();
    return `</w:p><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="12" w:space="1" w:color="${ooxmlColor}"/></w:pBdr></w:pPr></w:p><w:p>`;
  });
  
  // Handle simple <hr> without style
  processedContent = processedContent.replace(/<hr[^>]*>/gi, '</w:p><w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p><w:p>');
  
  // Handle images - extract src and dimensions
  const imgRegex = /<img[^>]*src="([^"]*)"[^>]*(?:width="(\d+)")?[^>]*(?:height="(\d+)")?[^>]*>/gi;
  processedContent = processedContent.replace(imgRegex, (match, src, width, height) => {
    // For now, skip images in footer (complex to embed)
    // Could be enhanced later with base64 embedding
    return '';
  });
  
  // Handle <br> tags
  processedContent = processedContent.replace(/<br\s*\/?>/gi, '</w:t></w:r></w:p><w:p><w:r><w:t>');
  
  // Handle <strong> and <b> tags
  processedContent = processedContent.replace(/<(strong|b)>/gi, '</w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>');
  processedContent = processedContent.replace(/<\/(strong|b)>/gi, '</w:t></w:r><w:r><w:t>');
  
  // Handle <em> and <i> tags
  processedContent = processedContent.replace(/<(em|i)>/gi, '</w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>');
  processedContent = processedContent.replace(/<\/(em|i)>/gi, '</w:t></w:r><w:r><w:t>');
  
  // Remove remaining HTML tags but keep content
  processedContent = processedContent.replace(/<[^>]+>/g, '');
  
  // Decode HTML entities
  processedContent = processedContent
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  // Wrap in paragraph
  ooxml = `<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="16"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>${processedContent}</w:t></w:r></w:p>`;
  
  return ooxml;
}

/**
 * Create a reference.docx with custom footer injected
 * @param {string} footerContent - HTML footer content
 * @param {string} tempDir - Temporary directory
 * @param {string} tempId - Unique identifier
 * @returns {Promise<string>} Path to the reference.docx
 */
async function createReferenceDocxWithFooter(footerContent, tempDir, tempId) {
  const baseDocxPath = path.join(tempDir, `${tempId}_base.docx`);
  const referenceDocxPath = path.join(tempDir, `${tempId}_reference.docx`);
  
  // Step 1: Generate a base reference.docx using Pandoc
  const defaultCmd = `pandoc --print-default-data-file reference.docx > "${baseDocxPath}"`;
  try {
    execSync(defaultCmd, { 
      timeout: 10000, 
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    });
  } catch (err) {
    // If --print-default-data-file fails, create a minimal docx
    const minimalHtml = '<html><body><p></p></body></html>';
    const minimalHtmlPath = path.join(tempDir, `${tempId}_minimal.html`);
    fs.writeFileSync(minimalHtmlPath, minimalHtml, 'utf8');
    execSync(`pandoc "${minimalHtmlPath}" -o "${baseDocxPath}"`, { timeout: 10000 });
    if (fs.existsSync(minimalHtmlPath)) fs.unlinkSync(minimalHtmlPath);
  }
  
  if (!fs.existsSync(baseDocxPath)) {
    throw new Error('Failed to create base reference.docx');
  }
  
  // Step 2: Open the DOCX (ZIP) and inject footer
  const JSZipClass = await getJSZip();
  const docxBuffer = fs.readFileSync(baseDocxPath);
  const zip = await JSZipClass.loadAsync(docxBuffer);
  
  // Create footer XML content
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${htmlToOoxml(footerContent)}
</w:ftr>`;
  
  // Add footer1.xml to the DOCX
  zip.file('word/footer1.xml', footerXml);
  
  // Update [Content_Types].xml to include footer
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypesXml.includes('footer1.xml')) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
    );
    zip.file('[Content_Types].xml', contentTypesXml);
  }
  
  // Update word/_rels/document.xml.rels to reference footer
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!relsXml.includes('footer1.xml')) {
    // Find the highest rId
    const rIdMatches = relsXml.match(/rId(\d+)/g) || [];
    const maxRId = rIdMatches.reduce((max, id) => {
      const num = parseInt(id.replace('rId', ''));
      return num > max ? num : max;
    }, 0);
    const newRId = `rId${maxRId + 1}`;
    
    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`
    );
    zip.file('word/_rels/document.xml.rels', relsXml);
    
    // Update document.xml to reference the footer in section properties
    let documentXml = await zip.file('word/document.xml').async('string');
    
    // Find or create sectPr (section properties)
    if (documentXml.includes('<w:sectPr')) {
      // Add footer reference to existing sectPr
      documentXml = documentXml.replace(
        /<w:sectPr([^>]*)>/,
        `<w:sectPr$1><w:footerReference w:type="default" r:id="${newRId}"/>`
      );
    } else {
      // Add sectPr before </w:body>
      documentXml = documentXml.replace(
        '</w:body>',
        `<w:sectPr><w:footerReference w:type="default" r:id="${newRId}"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr></w:body>`
      );
    }
    zip.file('word/document.xml', documentXml);
  }
  
  // Write the modified DOCX
  const modifiedBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(referenceDocxPath, modifiedBuffer);
  
  // Cleanup base file
  if (fs.existsSync(baseDocxPath)) fs.unlinkSync(baseDocxPath);
  
  return referenceDocxPath;
}

/**
 * Build a complete HTML document for Pandoc conversion (body only, no footer)
 * @param {Object} options - Build options
 * @returns {string} Complete HTML document
 */
function buildPandocHtml({ htmlContent, stylesheet, headerContent }) {
  const styles = stylesheet || '';
  
  let bodyContent = '';
  
  if (headerContent && headerContent.trim()) {
    bodyContent += `<div class="document-header">${headerContent}</div>\n`;
  }
  
  bodyContent += `<div class="document-body">${htmlContent}</div>\n`;
  
  // Footer is now handled via reference.docx, not in body
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${styles}
    body { font-family: Arial, sans-serif; }
    .document-header { margin-bottom: 20px; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

/**
 * Generate DOCX using Pandoc with dynamic footer via reference.docx
 * Footer appears on every page using Word's native footer mechanism
 */
async function generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent }) {
  const tempDir = os.tmpdir();
  const tempId = `docx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const htmlFilePath = path.join(tempDir, `${tempId}.html`);
  const docxFilePath = path.join(tempDir, `${tempId}.docx`);
  let referenceDocxPath = null;

  try {
    const hasFooter = footerContent && footerContent.trim();
    
    // Build HTML without footer (footer will be in reference.docx)
    const wrappedHtmlContent = buildPandocHtml({
      htmlContent,
      stylesheet,
      headerContent
    });

    log('info', 'DOCX generation via Pandoc with reference.docx', { 
      hasHeader: !!headerContent, 
      hasFooter: !!hasFooter,
      htmlLength: wrappedHtmlContent.length
    });

    fs.writeFileSync(htmlFilePath, wrappedHtmlContent, 'utf8');
    
    // Build Pandoc command
    let pandocCmd = `pandoc "${htmlFilePath}" -f html -t docx -o "${docxFilePath}" --standalone`;
    
    // If we have footer content, create a reference.docx with the footer injected
    if (hasFooter) {
      try {
        referenceDocxPath = await createReferenceDocxWithFooter(footerContent, tempDir, tempId);
        pandocCmd += ` --reference-doc="${referenceDocxPath}"`;
        log('debug', 'Created reference.docx with footer', { path: referenceDocxPath });
      } catch (refError) {
        log('warn', 'Failed to create reference.docx with footer, continuing without', { error: refError.message });
      }
    }
    
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
      if (referenceDocxPath && fs.existsSync(referenceDocxPath)) fs.unlinkSync(referenceDocxPath);
    } catch (cleanupError) {
      log('warn', 'Failed to cleanup temp files', { error: cleanupError.message });
    }
  }
}

/**
 * Generate DOC/DOCX using Puppeteer PDF + LibreOffice (visual fidelity)
 * This ensures headers/footers appear on every page correctly.
 * @param {string} outputFormat - 'doc' or 'docx'
 */
async function generateDocViaPdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, outputFormat = 'doc' }) {
  const tempDir = os.tmpdir();
  const tempId = `doc_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const pdfFilePath = path.join(tempDir, `${tempId}.pdf`);
  const outputExt = outputFormat === 'docx' ? 'docx' : 'doc';
  const outputFilePath = path.join(tempDir, `${tempId}.${outputExt}`);

  try {
    log('info', `${outputFormat.toUpperCase()} generation via Puppeteer PDF + LibreOffice`, { 
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

    // Step 2: Convert PDF to DOC/DOCX using LibreOffice
    // For DOCX: use "Office Open XML Text" filter
    // For DOC: use "MS Word 97" filter
    const outputFilter = outputFormat === 'docx' ? 'docx:"Office Open XML Text"' : 'doc:"MS Word 97"';
    const libreOfficeCmd = `soffice --headless --infilter="writer_pdf_import" --convert-to ${outputFilter} --outdir "${tempDir}" "${pdfFilePath}"`;
    
    log('debug', `LibreOffice PDF to ${outputFormat.toUpperCase()} conversion`, { cmd: libreOfficeCmd });
    
    try {
      execSync(libreOfficeCmd, { 
        timeout: 60000,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cmdError) {
      log('error', `LibreOffice PDF to ${outputFormat.toUpperCase()} conversion failed`, { error: cmdError.message });
      throw new Error(`LibreOffice conversion failed: ${cmdError.message}`);
    }

    if (!fs.existsSync(outputFilePath)) {
      throw new Error(`LibreOffice did not generate the ${outputFormat.toUpperCase()} file`);
    }

    const outputBuffer = fs.readFileSync(outputFilePath);
    log('debug', `${outputFormat.toUpperCase()} generated via PDF`, { size: `${Math.round(outputBuffer.length / 1024)}KB` });
    
    return outputBuffer;
  } finally {
    try {
      if (fs.existsSync(pdfFilePath)) fs.unlinkSync(pdfFilePath);
      if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
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
 *         Note: Footer appears only at end of document (Pandoc limitation)
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
    // DOC: Use PDF-based approach for visual fidelity (footer on every page)
    return generateDocViaPdf({ 
      htmlContent, 
      stylesheet, 
      headerContent, 
      footerContent, 
      footerHeight,
      outputFormat: 'doc'
    });
  }
  
  // DOCX: Use Pandoc for clean, editable text (footer at end only)
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
