/**
 * DOCX/DOC Generator - Hybrid approach
 * 
 * DOCX: HTML → Pandoc → DOCX, then post-process to inject native Word footer
 *       (clean text, editable, footer on every page via section properties)
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

// ============================================
// OOXML FOOTER HELPERS
// ============================================

/**
 * Escape special XML characters
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build OOXML run properties
 */
function buildRunProps(options = {}) {
  let rPr = '<w:sz w:val="16"/><w:szCs w:val="16"/>';
  if (options.bold) rPr += '<w:b/>';
  if (options.italic) rPr += '<w:i/>';
  if (options.color) {
    let c = options.color.replace('#', '').toUpperCase();
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    if (/^[0-9A-F]{6}$/.test(c)) rPr += `<w:color w:val="${c}"/>`;
  }
  return `<w:rPr>${rPr}</w:rPr>`;
}

/**
 * Build OOXML runs from text, handling PAGE / NUMPAGES field codes
 */
function buildRuns(text, runProps) {
  if (!text) return '';
  const parts = text.split(/(\uFFF0PAGE\uFFF0|\uFFF0NUMPAGES\uFFF0)/);
  let runs = '';
  for (const part of parts) {
    if (part === '\uFFF0PAGE\uFFF0' || part === '\uFFF0NUMPAGES\uFFF0') {
      const field = part === '\uFFF0PAGE\uFFF0' ? 'PAGE' : 'NUMPAGES';
      runs += `<w:r>${runProps}<w:fldChar w:fldCharType="begin"/></w:r>`;
      runs += `<w:r>${runProps}<w:instrText xml:space="preserve"> ${field} </w:instrText></w:r>`;
      runs += `<w:r>${runProps}<w:fldChar w:fldCharType="end"/></w:r>`;
    } else if (part) {
      runs += `<w:r>${runProps}<w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`;
    }
  }
  return runs;
}

/**
 * Parse inline HTML into OOXML runs
 * Handles <strong>, <b>, <em>, <i>, <span style="color:...">
 */
function parseInlineHtml(html, defaultStyle) {
  if (!html) return '';
  const defaultColorMatch = (defaultStyle || '').match(/color:\s*([^;"]+)/i);
  const defaultColor = defaultColorMatch ? defaultColorMatch[1].trim() : null;

  let content = html
    .replace(/-pageNumber-/gi, '\uFFF0PAGE\uFFF0')
    .replace(/-totalPages-/gi, '\uFFF0NUMPAGES\uFFF0')
    .replace(/<img[^>]*>/gi, '');

  const tokens = content.split(/(<\/?(?:strong|b|em|i|span)[^>]*>)/gi).filter(Boolean);
  let runs = '';
  let bold = false, italic = false;
  let colorStack = defaultColor ? [defaultColor] : [];

  for (const token of tokens) {
    if (/^<(strong|b)>/i.test(token)) { bold = true; continue; }
    if (/^<\/(strong|b)>/i.test(token)) { bold = false; continue; }
    if (/^<(em|i)>/i.test(token)) { italic = true; continue; }
    if (/^<\/(em|i)>/i.test(token)) { italic = false; continue; }
    if (/^<span/i.test(token)) {
      const cm = token.match(/color:\s*([^;"]+)/i);
      if (cm) colorStack.push(cm[1].trim());
      continue;
    }
    if (/^<\/span>/i.test(token)) {
      if (colorStack.length > (defaultColor ? 1 : 0)) colorStack.pop();
      continue;
    }
    if (/^<[^>]+>$/.test(token)) continue;

    let text = token
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (!text) continue;

    const color = colorStack.length > 0 ? colorStack[colorStack.length - 1] : null;
    runs += buildRuns(text, buildRunProps({ bold, italic, color }));
  }
  return runs;
}

/**
 * Build a flex-layout paragraph (space-between) using Word tab stops
 * Produces left / right (or left / center / right) aligned content
 */
function buildFlexParagraph(html) {
  const children = [];
  const regex = /<(?:span|div)[^>]*?(?:style="([^"]*)")?[^>]*>([\s\S]*?)<\/(?:span|div)>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    children.push({ style: m[1] || '', content: m[2] });
  }
  if (children.length === 0) return '';

  // A4 usable width in twips: 11906 - 2×1440 = 9026
  const tabStops = children.length >= 3
    ? '<w:tabs><w:tab w:val="center" w:pos="4513"/><w:tab w:val="right" w:pos="9026"/></w:tabs>'
    : '<w:tabs><w:tab w:val="right" w:pos="9026"/></w:tabs>';

  const parentStyleMatch = html.match(/style="([^"]*)"/i);
  const parentStyle = parentStyleMatch ? parentStyleMatch[1] : '';

  let runs = parseInlineHtml(children[0].content, children[0].style || parentStyle);
  for (let i = 1; i < children.length; i++) {
    runs += '<w:r><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr><w:tab/></w:r>';
    runs += parseInlineHtml(children[i].content, children[i].style || parentStyle);
  }

  return `<w:p><w:pPr>${tabStops}<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>${runs}</w:p>`;
}

/**
 * Convert footer HTML to OOXML paragraphs for Word footer
 * Handles <hr>, flex layouts (space-between), block elements, inline formatting
 * @param {string} html - Footer HTML content
 * @returns {string} OOXML paragraph elements
 */
function htmlToOoxml(html) {
  if (!html || !html.trim()) return '';
  let ooxml = '';

  // Split by <hr> elements, keeping them as tokens
  const parts = html.split(/(<hr[^>]*>)/gi);

  for (const part of parts) {
    // Handle <hr> elements → horizontal line paragraph
    if (/^<hr/i.test(part)) {
      const colorMatch = part.match(/background-color:\s*([^;"]+)/i);
      const color = colorMatch ? colorMatch[1].trim().replace('#', '').toUpperCase() : 'auto';
      const heightMatch = part.match(/height:\s*(\d+)/i);
      const sz = heightMatch ? Math.max(4, parseInt(heightMatch[1]) * 4) : 12;
      ooxml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${sz}" w:space="1" w:color="${color}"/></w:pBdr></w:pPr></w:p>`;
      continue;
    }
    if (!part.trim()) continue;

    // Flex container → tab-based left/right layout
    if (/display:\s*flex/i.test(part) && /justify-content:\s*space-between/i.test(part)) {
      ooxml += buildFlexParagraph(part);
      continue;
    }

    // Split by closing block elements into paragraphs
    const blocks = part.split(/<\/(?:div|p)>/gi);
    for (const block of blocks) {
      const stripped = block.replace(/<[^>]+>/g, '').trim();
      if (!stripped && !/-pageNumber-/i.test(block) && !/-totalPages-/i.test(block)) continue;
      const styleMatch = block.match(/<(?:div|p|span)[^>]*style="([^"]*)"/i);
      const style = styleMatch ? styleMatch[1] : '';
      const runs = parseInlineHtml(block, style);
      if (runs) {
        ooxml += `<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>${runs}</w:p>`;
      }
    }
  }
  return ooxml;
}

/**
 * Inject a Word-native footer into an existing DOCX buffer
 * Post-processes the Pandoc output to add footer1.xml and wire it into the document
 * @param {Buffer} docxBuffer - The DOCX file buffer
 * @param {string} footerContent - Footer HTML content
 * @returns {Promise<Buffer>} Modified DOCX buffer with footer on every page
 */
async function injectFooterIntoDocx(docxBuffer, footerContent) {
  const JSZipClass = await getJSZip();
  const zip = await JSZipClass.loadAsync(docxBuffer);

  // Build footer XML from HTML
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${htmlToOoxml(footerContent)}
</w:ftr>`;

  zip.file('word/footer1.xml', footerXml);

  // Register footer in [Content_Types].xml
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypesXml.includes('footer1.xml')) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
    );
    zip.file('[Content_Types].xml', contentTypesXml);
  }

  // Add relationship for the footer
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!relsXml.includes('footer1.xml')) {
    const rIdMatches = relsXml.match(/rId(\d+)/g) || [];
    const maxRId = rIdMatches.reduce((max, id) => {
      const num = parseInt(id.replace('rId', ''));
      return num > max ? num : max;
    }, 0);
    const footerRId = `rId${maxRId + 1}`;

    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${footerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`
    );
    zip.file('word/_rels/document.xml.rels', relsXml);

    // Wire the footer into document.xml section properties
    let documentXml = await zip.file('word/document.xml').async('string');
    if (documentXml.includes('<w:sectPr')) {
      documentXml = documentXml.replace(
        /<w:sectPr([^>]*)>/,
        `<w:sectPr$1><w:footerReference w:type="default" r:id="${footerRId}"/>`
      );
      // Ensure footer margin is defined
      if (!/<w:pgMar[^>]*w:footer/.test(documentXml)) {
        documentXml = documentXml.replace(
          /<w:pgMar([^/]*)\/?>/,
          '<w:pgMar$1 w:footer="720"/>'
        );
      }
    } else {
      // No sectPr yet – create one with A4 dimensions
      documentXml = documentXml.replace(
        '</w:body>',
        `<w:sectPr><w:footerReference w:type="default" r:id="${footerRId}"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr></w:body>`
      );
    }
    zip.file('word/document.xml', documentXml);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
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
  
  // Footer is injected via post-processing (injectFooterIntoDocx), not in body
  
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
 * Generate DOCX using Pandoc, then post-process to inject native Word footer
 * Footer appears on every page via Word's section properties
 */
async function generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent }) {
  const tempDir = os.tmpdir();
  const tempId = `docx_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const htmlFilePath = path.join(tempDir, `${tempId}.html`);
  const docxFilePath = path.join(tempDir, `${tempId}.docx`);

  try {
    const hasFooter = footerContent && footerContent.trim();

    // Build HTML (body + header, no footer — footer is injected post-Pandoc)
    const wrappedHtmlContent = buildPandocHtml({
      htmlContent,
      stylesheet,
      headerContent
    });

    log('info', 'DOCX generation via Pandoc + post-process footer', {
      hasHeader: !!headerContent,
      hasFooter: !!hasFooter,
      htmlLength: wrappedHtmlContent.length
    });

    fs.writeFileSync(htmlFilePath, wrappedHtmlContent, 'utf8');

    // Run Pandoc HTML → DOCX
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

    let docxBuffer = fs.readFileSync(docxFilePath);

    // Post-process: inject footer into the generated DOCX
    if (hasFooter) {
      try {
        docxBuffer = await injectFooterIntoDocx(docxBuffer, footerContent);
        log('debug', 'Footer injected into DOCX via post-processing');
      } catch (footerError) {
        log('warn', 'Failed to inject footer into DOCX, returning without footer', { error: footerError.message });
      }
    }

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
 * - DOCX: Pandoc + post-process footer injection (clean text, editable, footer on every page)
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
  
  // DOCX: Use Pandoc for clean, editable text + native Word footer
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
