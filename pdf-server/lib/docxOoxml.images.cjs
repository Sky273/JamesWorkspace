/**
 * DOCX OOXML helpers - inline images.
 */

function extractImagesFromHtml(html) {
  const images = [];
  let idx = 0;
  const processed = html.replace(/<img[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/src="data:image\/([^;]+);base64,([^"]+)"/i);
    if (!srcMatch) return '';
    idx++;
    const mimeSubtype = srcMatch[1];
    const base64Data = srcMatch[2];
    const ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
    const rId = `rImgF${idx}`;
    const wMatch = imgTag.match(/width="(\d+)"/i);
    const hMatch = imgTag.match(/height="(\d+)"/i);
    const width = wMatch ? parseInt(wMatch[1], 10) : 100;
    const height = hMatch ? parseInt(hMatch[1], 10) : 30;
    images.push({
      rId,
      filename: `footerImg${idx}.${ext}`,
      data: Buffer.from(base64Data, 'base64'),
      mimeType: `image/${mimeSubtype}`,
      ext,
      width,
      height
    });
    return `\uFFF1IMGF:${rId}:${width}:${height}\uFFF1`;
  });
  return { html: processed, images };
}

function buildImageDrawing(rId, widthPx, heightPx) {
  const cx = widthPx * 9525;
  const cy = heightPx * 9525;
  const docPrId = parseInt(rId.replace(/\D/g, ''), 10) || 1;
  return '<w:drawing>' +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${docPrId}" name="${rId}"/>` +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:nvPicPr>' +
    `<pic:cNvPr id="${docPrId}" name="${rId}"/>` +
    '<pic:cNvPicPr/>' +
    '</pic:nvPicPr>' +
    '<pic:blipFill>' +
    `<a:blip r:embed="${rId}"/>` +
    '<a:stretch><a:fillRect/></a:stretch>' +
    '</pic:blipFill>' +
    '<pic:spPr>' +
    '<a:xfrm>' +
    '<a:off x="0" y="0"/>' +
    `<a:ext cx="${cx}" cy="${cy}"/>` +
    '</a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>' +
    '<a:ln><a:noFill/></a:ln>' +
    '</pic:spPr>' +
    '</pic:pic>' +
    '</a:graphicData>' +
    '</a:graphic>' +
    '</wp:inline>' +
    '</w:drawing>';
}

module.exports = {
  extractImagesFromHtml,
  buildImageDrawing
};
