/**
 * DOCX/DOC Generator - Hybrid approach
 *
 * DOCX: HTML -> Pandoc -> DOCX, then post-process to inject native Word header/footer.
 * DOC:  HTML -> Puppeteer -> PDF -> LibreOffice -> DOC.
 */

const fsPromises = require('fs/promises');
const os = require('os');
const { log } = require('./logger.cjs');
const { generatePdf } = require('./pdfGenerator.cjs');
const {
  cleanupTempFiles,
  createTempArtifactPaths,
  runExternalCommand
} = require('./docxRuntime.cjs');
const {
  attachDocumentPart,
  loadDocxZip,
  registerEmbeddedImages,
  updateContentTypes
} = require('./docxPackage.cjs');
const {
  escapeXml,
  decodeHtmlEntities,
  HTML_ENTITIES,
  cssColorToHex,
  CSS_NAMED_COLORS,
  extractHeaderBorder,
  cssSizeToHalfPoints,
  cssSizeToTwips,
  parseInlineStyles,
  extractImagesFromHtml,
  buildImageDrawing,
  buildRunProps,
  buildRuns,
  INLINE_TAGS,
  parseInlineHtml,
  buildFlexParagraph,
  parseBorderStyle,
  buildBorderXml,
  convertTableToOoxml,
  convertBlocksToOoxml,
  htmlToOoxml
} = require('./docxOoxml.cjs');

let JSZip = null;
async function getJSZip() {
  if (!JSZip) {
    JSZip = (await import('jszip')).default;
  }
  return JSZip;
}

function buildPandocHtml({ htmlContent, stylesheet }) {
  const styles = stylesheet || '';
  const bodyContent = `<div class="document-body">${htmlContent}</div>\n`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    ${styles}
    body { font-family: Arial, sans-serif; }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;
}

function getDefaultOoxmlContextFromStylesheet(stylesheet) {
  let defaultAlign;
  let defaultStyle = '';
  if (!stylesheet) {
    return { defaultAlign, defaultStyle };
  }

  const alignMatch = stylesheet.match(/text-align:\s*(left|right|center|justify)/i);
  if (alignMatch) defaultAlign = alignMatch[1].toLowerCase();

  const cssParts = [];
  const fzMatch = stylesheet.match(/font-size:\s*([^;}"]+)/i);
  if (fzMatch) cssParts.push(`font-size: ${fzMatch[1].trim()}`);
  const clMatch = stylesheet.match(/(?<![\w-])color:\s*([^;}"]+)/i);
  if (clMatch) cssParts.push(`color: ${clMatch[1].trim()}`);
  const ffMatch = stylesheet.match(/font-family:\s*([^;}"]+)/i);
  if (ffMatch) cssParts.push(`font-family: ${ffMatch[1].trim()}`);
  const lhMatch = stylesheet.match(/line-height:\s*([^;}"]+)/i);
  if (lhMatch) cssParts.push(`line-height: ${lhMatch[1].trim()}`);

  defaultStyle = cssParts.join('; ');
  return { defaultAlign, defaultStyle };
}

async function injectFooterIntoDocx(docxBuffer, footerContent, stylesheet) {
  const zip = await loadDocxZip(getJSZip, docxBuffer);
  const { defaultAlign, defaultStyle } = getDefaultOoxmlContextFromStylesheet(stylesheet);
  const { html: processedFooter, images } = extractImagesFromHtml(footerContent);
  const hasImages = images.length > 0;
  const wpNs = hasImages
    ? '\n       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
    : '';

  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"${wpNs}>
  ${htmlToOoxml(processedFooter, defaultAlign, defaultStyle)}
</w:ftr>`;

  zip.file('word/footer1.xml', footerXml);
  registerEmbeddedImages(zip, images, 'word/_rels/footer1.xml.rels');

  await updateContentTypes(zip, {
    partName: '/word/footer1.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
    images
  });

  await attachDocumentPart(zip, {
    partFileName: 'footer1.xml',
    relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
    referenceXml: '<w:footerReference w:type="default" r:id="__RID__"/>',
    marginAttr: 'w:footer'
  });

  return zip.generateAsync({ type: 'nodebuffer' });
}

async function injectHeaderIntoDocx(docxBuffer, headerContent, stylesheet) {
  const zip = await loadDocxZip(getJSZip, docxBuffer);
  const { html: processedHeader, images } = extractImagesFromHtml(headerContent);
  const hasImages = images.length > 0;
  const wpNs = hasImages
    ? '\n       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
    : '';

  let headerOoxml = htmlToOoxml(processedHeader);
  const border = extractHeaderBorder(stylesheet);
  if (border) {
    headerOoxml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${border.size}" w:space="1" w:color="${border.color}"/></w:pBdr><w:spacing w:after="120"/></w:pPr></w:p>`;
  }

  const headerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"${wpNs}>
  ${headerOoxml}
</w:hdr>`;

  zip.file('word/header1.xml', headerXml);
  registerEmbeddedImages(zip, images, 'word/_rels/header1.xml.rels');

  await updateContentTypes(zip, {
    partName: '/word/header1.xml',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
    images
  });

  await attachDocumentPart(zip, {
    partFileName: 'header1.xml',
    relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
    referenceXml: '<w:headerReference w:type="default" r:id="__RID__"/>',
    marginAttr: 'w:header'
  });

  return zip.generateAsync({ type: 'nodebuffer' });
}

async function generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent }) {
  const tempDir = os.tmpdir();
  const { files } = createTempArtifactPaths({
    tempDir,
    prefix: 'docx',
    outputs: { html: 'html', docx: 'docx' }
  });
  const htmlFilePath = files.html;
  const docxFilePath = files.docx;

  try {
    const hasHeader = headerContent && headerContent.trim();
    const hasFooter = footerContent && footerContent.trim();
    const wrappedHtmlContent = buildPandocHtml({ htmlContent, stylesheet });

    log('info', 'DOCX generation via Pandoc + post-process header/footer', {
      hasHeader: !!hasHeader,
      hasFooter: !!hasFooter,
      htmlLength: wrappedHtmlContent.length
    });

    await fsPromises.writeFile(htmlFilePath, wrappedHtmlContent, 'utf8');

    try {
      await runExternalCommand({
        command: 'pandoc',
        args: [htmlFilePath, '-f', 'html', '-t', 'docx', '-o', docxFilePath, '--standalone'],
        log,
        timeout: 30000,
        failureMessage: 'Pandoc HTML to DOCX conversion failed'
      });
    } catch (cmdError) {
      throw new Error(`Pandoc conversion failed: ${cmdError.message}`);
    }

    let docxBuffer;
    try {
      docxBuffer = await fsPromises.readFile(docxFilePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error('Pandoc did not generate the DOCX file');
      }
      throw error;
    }

    if (hasHeader) {
      try {
        docxBuffer = await injectHeaderIntoDocx(docxBuffer, headerContent, stylesheet);
        log('debug', 'Header injected into DOCX via post-processing');
      } catch (headerError) {
        log('warn', 'Failed to inject header into DOCX, returning without header', { error: headerError.message });
      }
    }

    if (hasFooter) {
      try {
        docxBuffer = await injectFooterIntoDocx(docxBuffer, footerContent, stylesheet);
        log('debug', 'Footer injected into DOCX via post-processing');
      } catch (footerError) {
        log('warn', 'Failed to inject footer into DOCX, returning without footer', { error: footerError.message });
      }
    }

    log('debug', 'DOCX generated via Pandoc', { size: `${Math.round(docxBuffer.length / 1024)}KB` });
    return docxBuffer;
  } finally {
    await cleanupTempFiles({
      fs: fsPromises,
      log,
      filePaths: [htmlFilePath, docxFilePath]
    });
  }
}

async function generateDocViaPdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, outputFormat = 'doc' }) {
  const tempDir = os.tmpdir();
  const outputExt = outputFormat === 'docx' ? 'docx' : 'doc';
  const { files } = createTempArtifactPaths({
    tempDir,
    prefix: 'doc',
    outputs: { pdf: 'pdf', output: outputExt }
  });
  const pdfFilePath = files.pdf;
  const outputFilePath = files.output;

  try {
    log('info', `${outputFormat.toUpperCase()} generation via Puppeteer PDF + LibreOffice`, {
      hasHeader: !!headerContent,
      hasFooter: !!(footerContent && footerContent.trim())
    });

    let pdfBuffer = await generatePdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    });

    await fsPromises.writeFile(pdfFilePath, pdfBuffer);
    pdfBuffer = null;

    const outputFilter = outputFormat === 'docx' ? 'docx:"Office Open XML Text"' : 'doc:"MS Word 97"';
    const libreOfficeArgs = [
      '--headless',
      '--infilter=writer_pdf_import',
      '--convert-to',
      outputFilter,
      '--outdir',
      tempDir,
      pdfFilePath
    ];

    log('debug', `LibreOffice PDF to ${outputFormat.toUpperCase()} conversion`, {
      command: 'soffice',
      args: libreOfficeArgs
    });

    try {
      await runExternalCommand({
        command: 'soffice',
        args: libreOfficeArgs,
        log,
        timeout: 60000,
        failureMessage: `LibreOffice PDF to ${outputFormat.toUpperCase()} conversion failed`
      });
    } catch (cmdError) {
      throw new Error(`LibreOffice conversion failed: ${cmdError.message}`);
    }

    let outputBuffer;
    try {
      outputBuffer = await fsPromises.readFile(outputFilePath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new Error(`LibreOffice did not generate the ${outputFormat.toUpperCase()} file`);
      }
      throw error;
    }

    log('debug', `${outputFormat.toUpperCase()} generated via PDF`, { size: `${Math.round(outputBuffer.length / 1024)}KB` });
    return outputBuffer;
  } finally {
    await cleanupTempFiles({
      fs: fsPromises,
      log,
      filePaths: [pdfFilePath, outputFilePath]
    });
  }
}

async function generateDocx({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, format = 'docx' }) {
  if (format === 'doc') {
    return generateDocViaPdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      outputFormat: 'doc'
    });
  }

  return generateDocxViaPandoc({ htmlContent, stylesheet, headerContent, footerContent });
}

function getDocMimeType(format) {
  return format === 'doc'
    ? 'application/msword'
    : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
}

function getDocExtension(format) {
  return format === 'doc' ? '.doc' : '.docx';
}

module.exports = {
  generateDocx,
  getDocMimeType,
  getDocExtension,
  _internal: {
    escapeXml,
    decodeHtmlEntities,
    HTML_ENTITIES,
    cssColorToHex,
    CSS_NAMED_COLORS,
    cssSizeToHalfPoints,
    cssSizeToTwips,
    parseInlineStyles,
    buildRunProps,
    buildRuns,
    parseInlineHtml,
    INLINE_TAGS,
    extractImagesFromHtml,
    buildImageDrawing,
    parseBorderStyle,
    buildBorderXml,
    convertTableToOoxml,
    convertBlocksToOoxml,
    buildFlexParagraph,
    htmlToOoxml,
    injectFooterIntoDocx,
    injectHeaderIntoDocx,
    buildPandocHtml,
    extractHeaderBorder,
    cleanupTempFiles,
    createTempArtifactPaths,
    runExternalCommand,
    loadDocxZip,
    registerEmbeddedImages,
    updateContentTypes,
    attachDocumentPart
  }
};
