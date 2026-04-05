/**
 * DOCX OOXML helpers - inline text parsing and runs.
 */

const {
  escapeXml,
  decodeHtmlEntities,
  cssColorToHex,
  cssSizeToHalfPoints,
  parseInlineStyles
} = require('./docxOoxml.styles.cjs');
const {
  buildImageDrawing
} = require('./docxOoxml.images.cjs');

function buildRunProps(options = {}) {
  let rPr = '';
  if (options.fontFamily) {
    const font = escapeXml(options.fontFamily.split(',')[0].trim().replace(/['"]/g, ''));
    rPr += `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}"/>`;
  }
  if (options.bold) rPr += '<w:b/>';
  if (options.italic) rPr += '<w:i/>';
  if (options.caps) rPr += '<w:caps/>';
  if (options.strike) rPr += '<w:strike/>';
  if (options.underline) rPr += '<w:u w:val="single"/>';
  if (options.color) {
    const hex = cssColorToHex(options.color);
    if (hex) rPr += `<w:color w:val="${hex}"/>`;
  }
  const sz = options.fontSize || 16;
  rPr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
  if (options.bgColor) {
    const hex = cssColorToHex(options.bgColor);
    if (hex) rPr += `<w:shd w:val="clear" w:color="auto" w:fill="${hex}"/>`;
  }
  if (options.vertAlign) rPr += `<w:vertAlign w:val="${options.vertAlign}"/>`;
  if (options.letterSpacing) rPr += `<w:spacing w:val="${options.letterSpacing}"/>`;
  return `<w:rPr>${rPr}</w:rPr>`;
}

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

const INLINE_TAGS = new Set([
  'b','strong','i','em','u','ins','s','strike','del',
  'sub','sup','small','big','mark','span','font',
  'abbr','cite','code','kbd','samp','var','q','dfn','time','data'
]);

function parseInlineHtml(html, defaultStyle) {
  if (!html) return '';
  const defaults = parseInlineStyles(defaultStyle || '');
  let content = html
    .replace(/-pageNumber-/gi, '\uFFF0PAGE\uFFF0')
    .replace(/-totalPages-/gi, '\uFFF0NUMPAGES\uFFF0');
  const tokens = content.split(/(<[^>]+>)/g).filter(Boolean);
  let runs = '';
  const styleStack = [];

  function currentStyles() {
    const m = { ...defaults };
    for (const entry of styleStack) {
      for (const [k, v] of Object.entries(entry.styles)) {
        if (v !== undefined && v !== null) m[k] = v;
      }
    }
    return m;
  }

  for (const token of tokens) {
    const openMatch = token.match(/^<([a-z]\w*)\b([^>]*)>/i);
    if (openMatch && !/^<br/i.test(token)) {
      const tag = openMatch[1].toLowerCase();
      if (INLINE_TAGS.has(tag)) {
        const attrs = openMatch[2];
        const styleAttr = (attrs.match(/style="([^"]*)"/i) || [])[1] || '';
        const styles = parseInlineStyles(styleAttr);
        if (tag === 'b' || tag === 'strong') styles.bold = true;
        if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'var' || tag === 'dfn') styles.italic = true;
        if (tag === 'u' || tag === 'ins') styles.underline = true;
        if (tag === 's' || tag === 'strike' || tag === 'del') styles.strike = true;
        if (tag === 'sub') styles.vertAlign = 'subscript';
        if (tag === 'sup') styles.vertAlign = 'superscript';
        if (tag === 'small') { const cur = currentStyles(); styles.fontSize = Math.round((cur.fontSize || 16) * 0.8); }
        if (tag === 'big') { const cur = currentStyles(); styles.fontSize = Math.round((cur.fontSize || 16) * 1.2); }
        if (tag === 'mark' && !styles.bgColor) styles.bgColor = '#FFFF00';
        if ((tag === 'code' || tag === 'kbd' || tag === 'samp') && !styles.fontFamily) styles.fontFamily = 'Courier New';
        if (tag === 'font') {
          const colorAttr = (attrs.match(/color="([^"]*)"/i) || [])[1];
          const faceAttr = (attrs.match(/face="([^"]*)"/i) || [])[1];
          const sizeAttr = (attrs.match(/size="([^"]*)"/i) || [])[1];
          if (colorAttr && !styles.color) { const h = cssColorToHex(colorAttr); if (h) styles.color = '#' + h; }
          if (faceAttr && !styles.fontFamily) styles.fontFamily = faceAttr;
          if (sizeAttr && !styles.fontSize) {
            const fontSizeMap = { '1':10, '2':13, '3':16, '4':18, '5':24, '6':32, '7':48 };
            styles.fontSize = fontSizeMap[sizeAttr] || 16;
          }
        }
        styleStack.push({ tag, styles });
        continue;
      }
    }

    const closeMatch = token.match(/^<\/([a-z]\w*)>/i);
    if (closeMatch) {
      const tag = closeMatch[1].toLowerCase();
      if (INLINE_TAGS.has(tag)) {
        for (let k = styleStack.length - 1; k >= 0; k--) {
          if (styleStack[k].tag === tag) { styleStack.splice(k, 1); break; }
        }
        continue;
      }
    }

    if (/^<[^>]+>$/.test(token)) continue;
    const text = decodeHtmlEntities(token);
    if (!text && !text.includes('\t')) continue;
    const styles = currentStyles();
    const runProps = buildRunProps(styles);

    if (text.includes('\uFFF1IMGF:')) {
      const imgParts = text.split(/(\uFFF1IMGF:[^:]+:\d+:\d+\uFFF1)/);
      for (const imgPart of imgParts) {
        const imgMatch = imgPart.match(/\uFFF1IMGF:([^:]+):(\d+):(\d+)\uFFF1/);
        if (imgMatch) {
          runs += `<w:r>${runProps}${buildImageDrawing(imgMatch[1], parseInt(imgMatch[2], 10), parseInt(imgMatch[3], 10))}</w:r>`;
        } else if (imgPart.trim()) {
          runs += buildRuns(imgPart, runProps);
        }
      }
    } else if (text.includes('\t')) {
      const tabParts = text.split('\t');
      for (let j = 0; j < tabParts.length; j++) {
        if (j > 0) runs += `<w:r>${buildRunProps(styles)}<w:tab/></w:r>`;
        if (tabParts[j]) runs += buildRuns(tabParts[j], runProps);
      }
    } else {
      runs += buildRuns(text, runProps);
    }
  }

  return runs;
}

module.exports = {
  buildRunProps,
  buildRuns,
  INLINE_TAGS,
  parseInlineHtml
};
