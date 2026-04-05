/**
 * DOCX OOXML helpers - block layout, tables and HTML conversion.
 */

const {
  cssColorToHex
} = require('./docxOoxml.styles.cjs');
const { parseInlineHtml } = require('./docxOoxml.inline.cjs');
const {
  buildSpacingXml,
  buildIndentXml,
  resolveBlockAlignment,
  resolveBlockFontSize,
  resolveBlockStyle
} = require('./docxOoxml.blockUtils.cjs');

function buildFlexParagraph(html) {
  const children = [];
  const regex = /<(?:span|div)[^>]*?(?:style="([^"]*)")?[^>]*>([\s\S]*?)<\/(?:span|div)>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    children.push({ style: m[1] || '', content: m[2] });
  }
  if (children.length === 0) return '';

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

function parseBorderStyle(css) {
  if (!css) return null;
  const m = css.match(/border(?:-(?:top|bottom|left|right))?:\s*([^;]+)/i);
  if (!m) return null;
  const val = m[1].trim();
  if (/^(none|0)\b/i.test(val)) return null;

  const widthMatch = val.match(/(\d+(?:\.\d+)?)\s*px/i);
  const sz = widthMatch ? Math.max(2, Math.round(parseFloat(widthMatch[1]) * 8)) : 4;
  const colorMatch = val.match(/#([0-9A-Fa-f]{3,6})\b/);
  let color = 'auto';
  if (colorMatch) {
    let hex = colorMatch[1];
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    color = hex.toUpperCase();
  }
  const style = /dashed/i.test(val) ? 'dashed' : /dotted/i.test(val) ? 'dotted' : 'single';
  return { sz, color, style };
}

function buildBorderXml(border, sides) {
  let xml = '';
  for (const s of sides) {
    if (border) {
      xml += `<w:${s} w:val="${border.style}" w:sz="${border.sz}" w:space="0" w:color="${border.color}"/>`;
    } else {
      xml += `<w:${s} w:val="none" w:sz="0" w:space="0" w:color="auto"/>`;
    }
  }
  return xml;
}

function convertTableToOoxml(tableHtml) {
  const rows = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rm;
  while ((rm = rowRe.exec(tableHtml)) !== null) {
    const cells = [];
    const cellRe = /<(td|th)([^>]*)>([\s\S]*?)<\/\1>/gi;
    let cm;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[2];
      const sty = (attrs.match(/style="([^"]*)"/i) || [])[1] || '';
      const align = (sty.match(/text-align:\s*(left|right|center|justify)/i) || [])[1] || 'left';
      const colspan = parseInt((attrs.match(/colspan="(\d+)"/i) || [])[1] || '1', 10);
      cells.push({ content: cm[3], style: sty, alignment: align, colspan });
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';

  const tableStyleMatch = tableHtml.match(/<table[^>]*style="([^"]*)"/i);
  const tableBorderAttr = tableHtml.match(/<table[^>]*\bborder="([^"]*)"/i);
  const tableStyle = tableStyleMatch ? tableStyleMatch[1] : '';
  const tableBorder = parseBorderStyle(tableStyle)
    || (tableBorderAttr && tableBorderAttr[1] !== '0' ? { sz: 4, color: 'auto', style: 'single' } : null);

  const numCols = rows[0].reduce((s, c) => s + c.colspan, 0);
  const colW = Math.floor(9026 / numCols);

  let tbl = '<w:tbl><w:tblPr>';
  tbl += '<w:tblW w:w="5000" w:type="pct"/>';
  tbl += '<w:tblLook w:val="0000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>';
  tbl += '<w:tblBorders>';
  tbl += buildBorderXml(tableBorder, ['top','left','bottom','right','insideH','insideV']);
  tbl += '</w:tblBorders>';
  tbl += '<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/></w:tblCellMar>';
  tbl += '</w:tblPr><w:tblGrid>';
  for (let i = 0; i < numCols; i++) tbl += `<w:gridCol w:w="${colW}"/>`;
  tbl += '</w:tblGrid>';

  for (const row of rows) {
    tbl += '<w:tr>';
    for (const cell of row) {
      const jc = cell.alignment === 'justify' ? 'both' : cell.alignment;
      const w = colW * cell.colspan;
      const cellBorder = parseBorderStyle(cell.style) || tableBorder;
      tbl += '<w:tc><w:tcPr>';
      tbl += `<w:tcW w:w="${w}" w:type="dxa"/>`;
      if (cell.colspan > 1) tbl += `<w:gridSpan w:val="${cell.colspan}"/>`;
      tbl += '<w:tcBorders>';
      tbl += buildBorderXml(cellBorder, ['top','left','bottom','right']);
      tbl += '</w:tcBorders>';
      tbl += '<w:vAlign w:val="center"/>';
      tbl += '</w:tcPr>';
      const inner = cell.content.replace(/<\/?p[^>]*>/gi, '').trim();
      const runs = parseInlineHtml(inner, cell.style);
      tbl += `<w:p><w:pPr><w:jc w:val="${jc}"/><w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr></w:pPr>${runs || ''}</w:p>`;
      tbl += '</w:tc>';
    }
    tbl += '</w:tr>';
  }
  tbl += '</w:tbl>';
  return tbl;
}

function convertBlocksToOoxml(html, defaultAlign, defaultStyle) {
  if (!html || !html.trim()) return '';
  let ooxml = '';

  const parts = html.split(/(<hr[^>]*>)/gi);
  for (const part of parts) {
    if (/^<hr/i.test(part)) {
      const colorMatch = part.match(/background-color:\s*([^;"]+)/i);
      const color = colorMatch ? colorMatch[1].trim().replace('#', '').toUpperCase() : 'auto';
      const heightMatch = part.match(/height:\s*(\d+)/i);
      const sz = heightMatch ? Math.max(4, parseInt(heightMatch[1], 10) * 4) : 12;
      ooxml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${sz}" w:space="1" w:color="${color}"/></w:pBdr></w:pPr></w:p>`;
      continue;
    }
    if (!part.trim()) continue;

    if (/display:\s*flex/i.test(part) && /justify-content:\s*space-between/i.test(part)) {
      ooxml += buildFlexParagraph(part);
      continue;
    }

    const blocks = part.split(/<\/(?:div|p)>/gi);
    for (const block of blocks) {
      const bgBarStyle = block.match(/<(?:div|p)[^>]*style="([^"]*)"/i);
      if (bgBarStyle) {
        const barStyle = bgBarStyle[1];
        const barHeight = (barStyle.match(/height:\s*(\d+)/i) || [])[1];
        const barBg = (barStyle.match(/(?:background-color|background):\s*([^;"]+)/i) || [])[1];
        if (barHeight && parseInt(barHeight, 10) <= 10 && barBg) {
          const barColor = cssColorToHex(barBg.trim()) || 'auto';
          const barSz = Math.max(4, parseInt(barHeight, 10) * 4);
          ooxml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${barSz}" w:space="1" w:color="${barColor}"/></w:pBdr></w:pPr></w:p>`;
          continue;
        }
      }

      const stripped = block.replace(/<[^>]+>/g, '').replace(/\uFFF1[^\uFFF1]*\uFFF1/g, '').trim();
      if (!stripped && !/-pageNumber-/i.test(block) && !/-totalPages-/i.test(block) && !/\uFFF1IMGF:/.test(block)) continue;

      const style = resolveBlockStyle(block, defaultStyle);
      const alignment = resolveBlockAlignment(block, defaultAlign);
      const ooxmlAlign = alignment === 'justify' ? 'both' : alignment;
      const spacingXml = buildSpacingXml(style);
      const indXml = buildIndentXml(style);
      const defaultSz = resolveBlockFontSize(style);
      const runs = parseInlineHtml(block, style);
      if (!runs) continue;

      ooxml += `<w:p><w:pPr><w:jc w:val="${ooxmlAlign}"/>${spacingXml}${indXml}<w:rPr><w:sz w:val="${defaultSz}"/><w:szCs w:val="${defaultSz}"/></w:rPr></w:pPr>${runs}</w:p>`;
    }
  }
  return ooxml;
}

function htmlToOoxml(html, defaultAlign, defaultStyle) {
  if (!html || !html.trim()) return '';
  let processed = html;
  processed = processed.replace(/<a\b([^>]*)>/gi, '<span$1>');
  processed = processed.replace(/<\/a>/gi, '</span>');
  processed = processed.replace(/<br\s*\/?>/gi, '</p><p>');

  let ooxml = '';
  const segments = processed.split(/(<table[\s\S]*?<\/table>)/gi);
  for (const segment of segments) {
    if (/^<table/i.test(segment)) {
      ooxml += convertTableToOoxml(segment);
    } else if (segment.trim()) {
      ooxml += convertBlocksToOoxml(segment, defaultAlign, defaultStyle);
    }
  }
  return ooxml;
}

module.exports = {
  buildFlexParagraph,
  parseBorderStyle,
  buildBorderXml,
  convertTableToOoxml,
  convertBlocksToOoxml,
  htmlToOoxml
};
