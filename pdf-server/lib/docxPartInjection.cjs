/**
 * DOCX part injection helpers.
 *
 * Shared machinery for adding header/footer XML parts to an existing DOCX
 * archive without changing the surrounding generation flow.
 */

const {
  attachDocumentPart,
  loadDocxZip,
  registerEmbeddedImages,
  updateContentTypes
} = require('./docxPackage.cjs');
const {
  htmlToOoxml,
  extractImagesFromHtml,
  extractHeaderBorder
} = require('./docxOoxml.cjs');

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

function buildPartXml({
  rootTag,
  htmlContent,
  stylesheet,
  includeBorder = false,
  applyStylesheetContext = true
}) {
  const { html: processedHtml, images } = extractImagesFromHtml(htmlContent);
  const hasImages = images.length > 0;
  const wpNs = hasImages
    ? '\n       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
    : '';
  const { defaultAlign, defaultStyle } = getDefaultOoxmlContextFromStylesheet(stylesheet);

  let partXml = applyStylesheetContext
    ? htmlToOoxml(processedHtml, defaultAlign, defaultStyle)
    : htmlToOoxml(processedHtml);
  if (includeBorder) {
    const border = extractHeaderBorder(stylesheet);
    if (border) {
      partXml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${border.size}" w:space="1" w:color="${border.color}"/></w:pBdr><w:spacing w:after="120"/></w:pPr></w:p>`;
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<${rootTag} xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"${wpNs}>
  ${partXml}
</${rootTag}>`;

  return { xml, images };
}

async function injectHtmlPartIntoDocx(getJSZip, docxBuffer, {
  rootTag,
  htmlContent,
  stylesheet,
  partFileName,
  relationshipType,
  referenceXml,
  marginAttr,
  contentType,
  relsPath,
  includeBorder = false,
  applyStylesheetContext = true
}) {
  const zip = await loadDocxZip(getJSZip, docxBuffer);
  const { xml, images } = buildPartXml({
    rootTag,
    htmlContent,
    stylesheet,
    includeBorder,
    applyStylesheetContext
  });

  zip.file(`word/${partFileName}`, xml);
  registerEmbeddedImages(zip, images, relsPath);

  await updateContentTypes(zip, {
    partName: `/word/${partFileName}`,
    contentType,
    images
  });

  await attachDocumentPart(zip, {
    partFileName,
    relationshipType,
    referenceXml,
    marginAttr
  });

  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = {
  buildPartXml,
  getDefaultOoxmlContextFromStylesheet,
  injectHtmlPartIntoDocx
};
