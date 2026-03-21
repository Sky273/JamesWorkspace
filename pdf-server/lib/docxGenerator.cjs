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
 * Decode HTML entities (named + numeric) to their Unicode characters.
 * Must be called BEFORE escapeXml() so that e.g. &bull; becomes • first,
 * then escapeXml() only escapes the 4 XML-special characters.
 */
const HTML_ENTITIES = {
  // XML core
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  // Spacing & punctuation
  nbsp: '\u00A0', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  bull: '\u2022', middot: '\u00B7', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', minus: '\u2212',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '\u00AB', raquo: '\u00BB', prime: '\u2032', Prime: '\u2033',
  // Symbols
  euro: '\u20AC', pound: '\u00A3', yen: '\u00A5', cent: '\u00A2', curren: '\u00A4',
  deg: '\u00B0', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  times: '\u00D7', divide: '\u00F7', plusmn: '\u00B1', micro: '\u00B5',
  para: '\u00B6', sect: '\u00A7', dagger: '\u2020', Dagger: '\u2021',
  permil: '\u2030', fnof: '\u0192', ordf: '\u00AA', ordm: '\u00BA',
  sup1: '\u00B9', sup2: '\u00B2', sup3: '\u00B3', frac14: '\u00BC', frac12: '\u00BD', frac34: '\u00BE',
  iquest: '\u00BF', iexcl: '\u00A1', brvbar: '\u00A6', not: '\u00AC', macr: '\u00AF',
  cedil: '\u00B8', shy: '\u00AD',
  // Latin uppercase accented
  Agrave: '\u00C0', Aacute: '\u00C1', Acirc: '\u00C2', Atilde: '\u00C3', Auml: '\u00C4', Aring: '\u00C5',
  AElig: '\u00C6', Ccedil: '\u00C7',
  Egrave: '\u00C8', Eacute: '\u00C9', Ecirc: '\u00CA', Euml: '\u00CB',
  Igrave: '\u00CC', Iacute: '\u00CD', Icirc: '\u00CE', Iuml: '\u00CF',
  ETH: '\u00D0', Ntilde: '\u00D1',
  Ograve: '\u00D2', Oacute: '\u00D3', Ocirc: '\u00D4', Otilde: '\u00D5', Ouml: '\u00D6', Oslash: '\u00D8',
  Ugrave: '\u00D9', Uacute: '\u00DA', Ucirc: '\u00DB', Uuml: '\u00DC',
  Yacute: '\u00DD', THORN: '\u00DE',
  // Latin lowercase accented
  agrave: '\u00E0', aacute: '\u00E1', acirc: '\u00E2', atilde: '\u00E3', auml: '\u00E4', aring: '\u00E5',
  aelig: '\u00E6', ccedil: '\u00E7',
  egrave: '\u00E8', eacute: '\u00E9', ecirc: '\u00EA', euml: '\u00EB',
  igrave: '\u00EC', iacute: '\u00ED', icirc: '\u00EE', iuml: '\u00EF',
  eth: '\u00F0', ntilde: '\u00F1',
  ograve: '\u00F2', oacute: '\u00F3', ocirc: '\u00F4', otilde: '\u00F5', ouml: '\u00F6', oslash: '\u00F8',
  ugrave: '\u00F9', uacute: '\u00FA', ucirc: '\u00FB', uuml: '\u00FC',
  yacute: '\u00FD', thorn: '\u00FE', yuml: '\u00FF', szlig: '\u00DF',
  // Extended Latin (OElig, Scaron commonly used in French)
  OElig: '\u0152', oelig: '\u0153', Scaron: '\u0160', scaron: '\u0161',
  Yuml: '\u0178',
};

function decodeHtmlEntities(str) {
  if (!str || !str.includes('&')) return str;
  return str
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => HTML_ENTITIES[name] ?? m);
}

/**
 * Convert a CSS color value (hex, rgb(), named) to a 6-char uppercase hex string.
 * Returns null if the color can't be parsed or is transparent.
 */
const CSS_NAMED_COLORS = {
  black:'000000',white:'FFFFFF',red:'FF0000',green:'008000',blue:'0000FF',
  yellow:'FFFF00',gray:'808080',grey:'808080',silver:'C0C0C0',navy:'000080',
  teal:'008080',maroon:'800000',purple:'800080',olive:'808000',lime:'00FF00',
  aqua:'00FFFF',fuchsia:'FF00FF',orange:'FFA500',pink:'FFC0CB',brown:'A52A2A',
  darkgray:'A9A9A9',darkgrey:'A9A9A9',lightgray:'D3D3D3',lightgrey:'D3D3D3',
  darkblue:'00008B',darkgreen:'006400',darkred:'8B0000',crimson:'DC143C',
  coral:'FF7F50',gold:'FFD700',indigo:'4B0082',ivory:'FFFFF0',khaki:'F0E68C',
  lavender:'E6E6FA',salmon:'FA8072',tomato:'FF6347',violet:'EE82EE',wheat:'F5DEB3',
};
function cssColorToHex(color) {
  if (!color) return null;
  color = color.trim();
  if (color === 'transparent' || color === 'inherit' || color === 'initial') return null;
  if (/^#[0-9A-Fa-f]{3,6}$/.test(color)) {
    let hex = color.slice(1).toUpperCase();
    if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    return hex;
  }
  const rgbM = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbM) {
    return [rgbM[1], rgbM[2], rgbM[3]]
      .map(v => Math.min(255, parseInt(v)).toString(16).padStart(2, '0'))
      .join('').toUpperCase();
  }
  return CSS_NAMED_COLORS[color.toLowerCase()] || null;
}

/**
 * Extract header border info from stylesheet CSS.
 * Looks for border-bottom on header-related selectors.
 * @param {string} stylesheet - Template CSS stylesheet
 * @returns {{ color: string, size: number } | null} Border info or null
 */
function extractHeaderBorder(stylesheet) {
  if (!stylesheet) return null;
  // Try header-specific selectors first
  let match = stylesheet.match(
    /[^{}]*header[^{}]*\{[^}]*border-bottom:\s*(\d+)(?:px)?\s+solid\s+([^;}"]+)/i
  );
  // Fall back to any border-bottom with solid color (common separator pattern)
  if (!match) {
    match = stylesheet.match(
      /border-bottom:\s*(\d+)(?:px)?\s+solid\s+([^;}"]+)/i
    );
  }
  if (!match) return null;
  const width = parseInt(match[1]) || 2;
  const rawColor = match[2].trim();
  const color = cssColorToHex(rawColor);
  if (!color) return null;
  // size in OOXML eighth-points (1px ≈ 4 eighth-points)
  return { color, size: Math.max(4, width * 4) };
}

/**
 * Convert a CSS size value to OOXML half-points (1pt = 2 half-points).
 * Handles px, pt, em, rem, %, and named sizes.
 */
function cssSizeToHalfPoints(cssSize) {
  if (!cssSize) return null;
  cssSize = cssSize.trim();
  const px = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  if (px) return Math.round(parseFloat(px[1]) * 1.5); // 1px ≈ 0.75pt → 1.5 half-pt
  const pt = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*pt$/i);
  if (pt) return Math.round(parseFloat(pt[1]) * 2);
  const em = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*(em|rem)$/i);
  if (em) return Math.round(parseFloat(em[1]) * 16); // 1em ≈ 8pt default
  const pct = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*%$/i);
  if (pct) return Math.round(parseFloat(pct[1]) / 100 * 16);
  const named = { 'xx-small':10, 'x-small':12, 'small':14, 'medium':16, 'large':20, 'x-large':24, 'xx-large':28 };
  return named[cssSize.toLowerCase()] || null;
}

/**
 * Convert a CSS size value to OOXML twips (1pt = 20 twips, 1px ≈ 15 twips).
 */
function cssSizeToTwips(cssSize) {
  if (!cssSize) return 0;
  cssSize = cssSize.trim();
  const px = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  if (px) return Math.round(parseFloat(px[1]) * 15);
  const pt = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*pt$/i);
  if (pt) return Math.round(parseFloat(pt[1]) * 20);
  const mm = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*mm$/i);
  if (mm) return Math.round(parseFloat(mm[1]) * 56.7);
  const cm = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*cm$/i);
  if (cm) return Math.round(parseFloat(cm[1]) * 567);
  const em = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*(em|rem)$/i);
  if (em) return Math.round(parseFloat(em[1]) * 160); // 1em ≈ 8pt ≈ 160 twips
  return 0;
}

/**
 * Parse a CSS style string into a formatting properties object.
 * Used for inline styles on any HTML element.
 */
function parseInlineStyles(styleStr) {
  if (!styleStr) return {};
  const s = {};
  const fw = styleStr.match(/font-weight:\s*(\w+|\d+)/i);
  if (fw) { const v = fw[1]; if (v === 'bold' || v === 'bolder' || parseInt(v) >= 700) s.bold = true; }
  const fs = styleStr.match(/font-style:\s*(\w+)/i);
  if (fs && /^(italic|oblique)$/i.test(fs[1])) s.italic = true;
  const td = styleStr.match(/text-decoration[^:]*:\s*([^;]+)/i);
  if (td) {
    const v = td[1].toLowerCase();
    if (v.includes('underline')) s.underline = true;
    if (v.includes('line-through')) s.strike = true;
  }
  // color (not background-color)
  const cm = styleStr.match(/(?<![\w-])color:\s*([^;"]+)/i);
  if (cm) { const hex = cssColorToHex(cm[1].trim()); if (hex) s.color = '#' + hex; }
  const bg = styleStr.match(/background-color:\s*([^;"]+)/i);
  if (bg) { const hex = cssColorToHex(bg[1].trim()); if (hex) s.bgColor = '#' + hex; }
  const fz = styleStr.match(/font-size:\s*([^;"]+)/i);
  if (fz) { const hp = cssSizeToHalfPoints(fz[1].trim()); if (hp) s.fontSize = hp; }
  const ff = styleStr.match(/font-family:\s*([^;"]+)/i);
  if (ff) s.fontFamily = ff[1].trim();
  const va = styleStr.match(/vertical-align:\s*(\w+)/i);
  if (va) {
    if (va[1] === 'super') s.vertAlign = 'superscript';
    else if (va[1] === 'sub') s.vertAlign = 'subscript';
  }
  const tt = styleStr.match(/text-transform:\s*(\w+)/i);
  if (tt && tt[1].toLowerCase() === 'uppercase') s.caps = true;
  const ls = styleStr.match(/letter-spacing:\s*([^;"]+)/i);
  if (ls) {
    const v = ls[1].trim();
    const pxM = v.match(/(-?\d+(?:\.\d+)?)\s*px/i);
    const ptM = v.match(/(-?\d+(?:\.\d+)?)\s*pt/i);
    if (pxM) s.letterSpacing = Math.round(parseFloat(pxM[1]) * 15);
    else if (ptM) s.letterSpacing = Math.round(parseFloat(ptM[1]) * 20);
  }
  return s;
}

/**
 * Extract base64 images from HTML <img> tags.
 * Replaces each <img src="data:..."> with a Unicode marker \uFFF1IMGF:rId:w:h\uFFF1
 * and returns the processed HTML plus an array of image metadata + binary data.
 */
function extractImagesFromHtml(html) {
  const images = [];
  let idx = 0;

  const processed = html.replace(/<img[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/src="data:image\/([^;]+);base64,([^"]+)"/i);
    if (!srcMatch) return ''; // strip non-base64 images

    idx++;
    const mimeSubtype = srcMatch[1]; // png, jpeg, gif…
    const base64Data = srcMatch[2];
    const ext = mimeSubtype === 'jpeg' ? 'jpg' : mimeSubtype;
    const rId = `rImgF${idx}`;

    const wMatch = imgTag.match(/width="(\d+)"/i);
    const hMatch = imgTag.match(/height="(\d+)"/i);
    const width = wMatch ? parseInt(wMatch[1]) : 100;
    const height = hMatch ? parseInt(hMatch[1]) : 30;

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

/**
 * Build an OOXML inline drawing element for an embedded image
 * @param {string} rId  - relationship id (e.g. "rImgF1")
 * @param {number} widthPx  - image width in CSS pixels
 * @param {number} heightPx - image height in CSS pixels
 */
function buildImageDrawing(rId, widthPx, heightPx) {
  // 1 CSS px ≈ 9525 EMU
  const cx = widthPx * 9525;
  const cy = heightPx * 9525;
  const docPrId = parseInt(rId.replace(/\D/g, '')) || 1;

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

/**
 * Build OOXML run properties from a comprehensive formatting options object.
 * Supports: fontFamily, bold, italic, caps, strike, underline, color,
 * fontSize, bgColor, vertAlign, letterSpacing.
 */
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
  const sz = options.fontSize || 16; // default 8pt = 16 half-points
  rPr += `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;
  if (options.bgColor) {
    const hex = cssColorToHex(options.bgColor);
    if (hex) rPr += `<w:shd w:val="clear" w:color="auto" w:fill="${hex}"/>`;
  }
  if (options.vertAlign) rPr += `<w:vertAlign w:val="${options.vertAlign}"/>`;
  if (options.letterSpacing) rPr += `<w:spacing w:val="${options.letterSpacing}"/>`;
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
 * Inline formatting tag names (lowercase) handled by parseInlineHtml.
 * Opening tags push styles onto a stack; closing tags pop them.
 */
const INLINE_TAGS = new Set([
  'b','strong','i','em','u','ins','s','strike','del',
  'sub','sup','small','big','mark','span','font',
  'abbr','cite','code','kbd','samp','var','q','dfn','time','data'
]);

/**
 * Parse inline HTML into OOXML runs.
 * Uses a style stack: each opening tag pushes formatting overrides,
 * closing tags pop them. Supports all common HTML formatting tags
 * plus inline CSS styles on any element.
 */
function parseInlineHtml(html, defaultStyle) {
  if (!html) return '';

  // Parse defaults from the parent element's style attribute
  const defaults = parseInlineStyles(defaultStyle || '');

  let content = html
    .replace(/-pageNumber-/gi, '\uFFF0PAGE\uFFF0')
    .replace(/-totalPages-/gi, '\uFFF0NUMPAGES\uFFF0');

  // Tokenize on ALL HTML tags so none leak as raw text
  const tokens = content.split(/(<[^>]+>)/g).filter(Boolean);
  let runs = '';
  const styleStack = []; // each entry: { tag, styles }

  // Compute current merged style from defaults + stack
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
    // Opening inline formatting tag
    const openMatch = token.match(/^<([a-z]\w*)\b([^>]*)>/i);
    if (openMatch && !/^<br/i.test(token)) {
      const tag = openMatch[1].toLowerCase();
      if (INLINE_TAGS.has(tag)) {
        const attrs = openMatch[2];
        const styleAttr = (attrs.match(/style="([^"]*)"/i) || [])[1] || '';
        const styles = parseInlineStyles(styleAttr);

        // Apply semantic meaning of the tag
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

        // <font> tag HTML attributes
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

    // Closing inline formatting tag
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

    // Skip ALL other HTML tags (table, td, a, p, div, img, br, etc.)
    if (/^<[^>]+>$/.test(token)) continue;

    // Text content
    let text = decodeHtmlEntities(token);
    if (!text && !text.includes('\t')) continue;

    const styles = currentStyles();
    const runProps = buildRunProps(styles);

    // Handle image markers (from extractImagesFromHtml)
    if (text.includes('\uFFF1IMGF:')) {
      const imgParts = text.split(/(\uFFF1IMGF:[^:]+:\d+:\d+\uFFF1)/);
      for (const imgPart of imgParts) {
        const imgMatch = imgPart.match(/\uFFF1IMGF:([^:]+):(\d+):(\d+)\uFFF1/);
        if (imgMatch) {
          runs += `<w:r>${runProps}${buildImageDrawing(imgMatch[1], parseInt(imgMatch[2]), parseInt(imgMatch[3]))}</w:r>`;
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
 * Parse a CSS border shorthand (e.g. "1px solid #000") into OOXML attributes.
 * Returns null if no valid border found or border is "none"/"0".
 */
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

/**
 * Build OOXML border elements for all sides.
 * @param {object|null} border - parsed border or null for no border
 * @param {string[]} sides - list of border side names
 */
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

/**
 * Convert an HTML <table> block to a native OOXML <w:tbl> element.
 * Preserves cell count, colspan, per-cell text-align, and inline content.
 * Borders are only applied when explicitly present in the HTML style.
 */
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
      const colspan = parseInt((attrs.match(/colspan="(\d+)"/i) || [])[1] || '1');
      cells.push({ content: cm[3], style: sty, alignment: align, colspan });
    }
    if (cells.length) rows.push(cells);
  }
  if (!rows.length) return '';

  // Detect table-level border from <table> tag style or border attribute
  const tableStyleMatch = tableHtml.match(/<table[^>]*style="([^"]*)"/i);
  const tableBorderAttr = tableHtml.match(/<table[^>]*\bborder="([^"]*)"/i);
  const tableStyle = tableStyleMatch ? tableStyleMatch[1] : '';
  const tableBorder = parseBorderStyle(tableStyle)
    || (tableBorderAttr && tableBorderAttr[1] !== '0' ? { sz: 4, color: 'auto', style: 'single' } : null);

  const numCols = rows[0].reduce((s, c) => s + c.colspan, 0);
  const colW = Math.floor(9026 / numCols); // A4 usable width in twips

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
      // Check for cell-level border override
      const cellBorder = parseBorderStyle(cell.style) || tableBorder;
      tbl += '<w:tc><w:tcPr>';
      tbl += `<w:tcW w:w="${w}" w:type="dxa"/>`;
      if (cell.colspan > 1) tbl += `<w:gridSpan w:val="${cell.colspan}"/>`;
      tbl += '<w:tcBorders>';
      tbl += buildBorderXml(cellBorder, ['top','left','bottom','right']);
      tbl += '</w:tcBorders>';
      tbl += '<w:vAlign w:val="center"/>';
      tbl += '</w:tcPr>';
      // Strip <p> wrappers inside cells, keep inline content
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

/**
 * Convert non-table HTML to OOXML paragraphs.
 * Handles <hr>, flex layouts (space-between), and block elements.
 * @param {string} html - HTML content
 * @param {string} [defaultAlign='left'] - Default paragraph alignment from stylesheet
 * @param {string} [defaultStyle=''] - Default CSS style inherited from stylesheet
 */
function convertBlocksToOoxml(html, defaultAlign, defaultStyle) {
  if (!html || !html.trim()) return '';
  let ooxml = '';

  const parts = html.split(/(<hr[^>]*>)/gi);
  for (const part of parts) {
    if (/^<hr/i.test(part)) {
      const colorMatch = part.match(/background-color:\s*([^;"]+)/i);
      const color = colorMatch ? colorMatch[1].trim().replace('#', '').toUpperCase() : 'auto';
      const heightMatch = part.match(/height:\s*(\d+)/i);
      const sz = heightMatch ? Math.max(4, parseInt(heightMatch[1]) * 4) : 12;
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
      // Detect <div> with background color and small height → separator bar (like <hr>)
      const bgBarStyle = block.match(/<(?:div|p)[^>]*style="([^"]*)"/i);
      if (bgBarStyle) {
        const barStyle = bgBarStyle[1];
        const barHeight = (barStyle.match(/height:\s*(\d+)/i) || [])[1];
        const barBg = (barStyle.match(/(?:background-color|background):\s*([^;"]+)/i) || [])[1];
        if (barHeight && parseInt(barHeight) <= 10 && barBg) {
          const barColor = cssColorToHex(barBg.trim()) || 'auto';
          const barSz = Math.max(4, parseInt(barHeight) * 4);
          ooxml += `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="${barSz}" w:space="1" w:color="${barColor}"/></w:pBdr></w:pPr></w:p>`;
          continue;
        }
      }

      const stripped = block.replace(/<[^>]+>/g, '').replace(/\uFFF1[^\uFFF1]*\uFFF1/g, '').trim();
      if (!stripped && !/-pageNumber-/i.test(block) && !/-totalPages-/i.test(block) && !/\uFFF1IMGF:/.test(block)) continue;

      const styleMatch = block.match(/<(?:div|p|span)[^>]*style="([^"]*)"/i);
      const blockStyle = styleMatch ? styleMatch[1] : '';
      // Merge: block inline style first (regex matches first occurrence = block wins)
      const style = (defaultStyle && blockStyle) ? blockStyle + '; ' + defaultStyle
        : blockStyle || defaultStyle || '';

      // Paragraph alignment
      const alignMatch = block.match(/text-align:\s*(left|right|center|justify)/i);
      const alignment = alignMatch ? alignMatch[1].toLowerCase() : (defaultAlign || 'left');
      const ooxmlAlign = alignment === 'justify' ? 'both' : alignment;

      // Paragraph spacing (margin-top / margin-bottom / line-height)
      let spacingXml = '';
      const mt = (style.match(/margin-top:\s*([^;"]+)/i) || [])[1];
      const mb = (style.match(/margin-bottom:\s*([^;"]+)/i) || [])[1];
      const lh = (style.match(/line-height:\s*([^;"]+)/i) || [])[1];
      {
        let attrs = '';
        if (mt) attrs += ` w:before="${cssSizeToTwips(mt)}"`;
        else attrs += ' w:before="0"';
        if (mb) attrs += ` w:after="${cssSizeToTwips(mb)}"`;
        else attrs += ' w:after="0"';
        if (lh) {
          const lhVal = lh.trim();
          const lhNum = parseFloat(lhVal);
          if (lhVal.endsWith('px') || lhVal.endsWith('pt')) {
            attrs += ` w:line="${cssSizeToTwips(lhVal)}" w:lineRule="exact"`;
          } else if (!isNaN(lhNum) && lhNum > 0) {
            attrs += ` w:line="${Math.round(lhNum * 240)}" w:lineRule="auto"`;
          }
        } else {
          attrs += ' w:line="240" w:lineRule="auto"';
        }
        spacingXml = `<w:spacing${attrs}/>`;
      }

      // Paragraph indentation (text-indent, padding-left, margin-left)
      let indXml = '';
      const ti = (style.match(/text-indent:\s*([^;"]+)/i) || [])[1];
      const pl = (style.match(/(?:padding|margin)-left:\s*([^;"]+)/i) || [])[1];
      if (ti || pl) {
        let attrs = '';
        if (ti) attrs += ` w:firstLine="${cssSizeToTwips(ti)}"`;
        if (pl) attrs += ` w:left="${cssSizeToTwips(pl)}"`;
        indXml = `<w:ind${attrs}/>`;
      }

      // Default run font-size from block style
      const blockFontSize = cssSizeToHalfPoints((style.match(/font-size:\s*([^;"]+)/i) || [])[1]);
      const defaultSz = blockFontSize || 16;

      const runs = parseInlineHtml(block, style);
      if (!runs) continue;

      ooxml += `<w:p><w:pPr><w:jc w:val="${ooxmlAlign}"/>${spacingXml}${indXml}<w:rPr><w:sz w:val="${defaultSz}"/><w:szCs w:val="${defaultSz}"/></w:rPr></w:pPr>${runs}</w:p>`;
    }
  }
  return ooxml;
}

/**
 * Convert footer HTML to OOXML elements for Word footer.
 * Tables → native <w:tbl>, other content → paragraphs with <hr>/flex/block handling.
 * @param {string} html - Footer HTML content
 * @param {string} [defaultAlign] - Default paragraph alignment (e.g. from stylesheet)
 * @returns {string} OOXML elements
 */
function htmlToOoxml(html, defaultAlign, defaultStyle) {
  if (!html || !html.trim()) return '';

  // Pre-process: convert <a> to <span> (preserve inline styles), <br> to paragraph breaks
  let processed = html;
  processed = processed.replace(/<a\b([^>]*)>/gi, '<span$1>');
  processed = processed.replace(/<\/a>/gi, '</span>');
  processed = processed.replace(/<br\s*\/?>/gi, '</p><p>');

  let ooxml = '';

  // Split into table blocks and non-table blocks, processing in order
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

/**
 * Inject a Word-native footer into an existing DOCX buffer
 * Post-processes the Pandoc output to add footer1.xml and wire it into the document
 * @param {Buffer} docxBuffer - The DOCX file buffer
 * @param {string} footerContent - Footer HTML content
 * @param {string} [stylesheet] - Template stylesheet (used to extract default alignment)
 * @returns {Promise<Buffer>} Modified DOCX buffer with footer on every page
 */
async function injectFooterIntoDocx(docxBuffer, footerContent, stylesheet) {
  const JSZipClass = await getJSZip();
  const zip = await JSZipClass.loadAsync(docxBuffer);

  // Extract default styling from stylesheet for footer context
  let defaultAlign;
  let defaultStyle = '';
  if (stylesheet) {
    const alignMatch = stylesheet.match(/text-align:\s*(left|right|center|justify)/i);
    if (alignMatch) defaultAlign = alignMatch[1].toLowerCase();
    // Compose a default inline style string from stylesheet properties
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
  }

  // Extract base64 images from footer HTML (replaced with markers)
  const { html: processedFooter, images } = extractImagesFromHtml(footerContent);
  const hasImages = images.length > 0;

  // Build footer XML from processed HTML
  const wpNs = hasImages ? '\n       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' : '';
  const footerXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"${wpNs}>
  ${htmlToOoxml(processedFooter, defaultAlign, defaultStyle)}
</w:ftr>`;

  zip.file('word/footer1.xml', footerXml);

  // Embed image files and create footer relationships
  if (hasImages) {
    for (const img of images) {
      zip.file(`word/media/${img.filename}`, img.data);
    }

    let footerRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (const img of images) {
      footerRelsXml += `\n  <Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`;
    }
    footerRelsXml += '\n</Relationships>';
    zip.file('word/_rels/footer1.xml.rels', footerRelsXml);
  }

  // Register footer and image content types in [Content_Types].xml
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypesXml.includes('footer1.xml')) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'
    );
  }
  if (hasImages) {
    const extensions = [...new Set(images.map(img => img.ext))];
    for (const ext of extensions) {
      if (!contentTypesXml.includes(`Extension="${ext}"`)) {
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
        );
      }
    }
  }
  zip.file('[Content_Types].xml', contentTypesXml);

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
    const footerRef = `<w:footerReference w:type="default" r:id="${footerRId}"/>`;
    const defaultSectPr = `<w:sectPr>${footerRef}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr>`;

    if (/<w:sectPr\s*\/>/.test(documentXml)) {
      // Pandoc generates self-closing <w:sectPr /> — replace entirely
      documentXml = documentXml.replace(/<w:sectPr\s*\/>/, defaultSectPr);
    } else if (/<w:sectPr[^/]*>/.test(documentXml)) {
      // Opening tag with children — inject footerReference after opening tag
      documentXml = documentXml.replace(
        /<w:sectPr([^/][^>]*)>/,
        `<w:sectPr$1>${footerRef}`
      );
      // Ensure footer margin is defined
      if (!/<w:pgMar[^>]*w:footer/.test(documentXml)) {
        documentXml = documentXml.replace(
          /<w:pgMar([^/]*)\/?>/,
          '<w:pgMar$1 w:footer="720"/>'
        );
      }
    } else {
      // No sectPr at all — create one before </w:body>
      documentXml = documentXml.replace('</w:body>', `${defaultSectPr}</w:body>`);
    }
    zip.file('word/document.xml', documentXml);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
}

/**
 * Build a complete HTML document for Pandoc conversion (body only)
 * Header and footer are injected post-Pandoc as native Word header/footer
 * @param {Object} options - Build options
 * @returns {string} Complete HTML document
 */
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

/**
 * Inject a Word-native header into an existing DOCX buffer
 * Post-processes the Pandoc output to add header1.xml and wire it into the document
 * @param {Buffer} docxBuffer - The DOCX file buffer
 * @param {string} headerContent - Header HTML content
 * @param {string} [stylesheet] - Template stylesheet
 * @returns {Promise<Buffer>} Modified DOCX buffer with header on every page
 */
async function injectHeaderIntoDocx(docxBuffer, headerContent, stylesheet) {
  const JSZipClass = await getJSZip();
  const zip = await JSZipClass.loadAsync(docxBuffer);

  // Extract base64 images from header HTML (replaced with markers)
  const { html: processedHeader, images } = extractImagesFromHtml(headerContent);
  const hasImages = images.length > 0;

  // Build header OOXML content
  const wpNs = hasImages ? '\n       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"' : '';
  let headerOoxml = htmlToOoxml(processedHeader);

  // Append border paragraph if stylesheet defines border-bottom on header
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

  // Embed image files and create header relationships
  if (hasImages) {
    for (const img of images) {
      zip.file(`word/media/${img.filename}`, img.data);
    }

    let headerRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (const img of images) {
      headerRelsXml += `\n  <Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.filename}"/>`;
    }
    headerRelsXml += '\n</Relationships>';
    zip.file('word/_rels/header1.xml.rels', headerRelsXml);
  }

  // Register header and image content types in [Content_Types].xml
  let contentTypesXml = await zip.file('[Content_Types].xml').async('string');
  if (!contentTypesXml.includes('header1.xml')) {
    contentTypesXml = contentTypesXml.replace(
      '</Types>',
      '<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>'
    );
  }
  if (hasImages) {
    const extensions = [...new Set(images.map(img => img.ext))];
    for (const ext of extensions) {
      if (!contentTypesXml.includes(`Extension="${ext}"`)) {
        const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
        contentTypesXml = contentTypesXml.replace(
          '</Types>',
          `<Default Extension="${ext}" ContentType="${mime}"/></Types>`
        );
      }
    }
  }
  zip.file('[Content_Types].xml', contentTypesXml);

  // Add relationship for the header
  let relsXml = await zip.file('word/_rels/document.xml.rels').async('string');
  if (!relsXml.includes('header1.xml')) {
    const rIdMatches = relsXml.match(/rId(\d+)/g) || [];
    const maxRId = rIdMatches.reduce((max, id) => {
      const num = parseInt(id.replace('rId', ''));
      return num > max ? num : max;
    }, 0);
    const headerRId = `rId${maxRId + 1}`;

    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="${headerRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/></Relationships>`
    );
    zip.file('word/_rels/document.xml.rels', relsXml);

    // Wire the header into document.xml section properties
    let documentXml = await zip.file('word/document.xml').async('string');
    const headerRef = `<w:headerReference w:type="default" r:id="${headerRId}"/>`;

    if (/<w:sectPr\s*\/>/.test(documentXml)) {
      const defaultSectPr = `<w:sectPr>${headerRef}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr>`;
      documentXml = documentXml.replace(/<w:sectPr\s*\/>/, defaultSectPr);
    } else if (/<w:sectPr[^/]*>/.test(documentXml)) {
      documentXml = documentXml.replace(
        /<w:sectPr([^/][^>]*)>/,
        `<w:sectPr$1>${headerRef}`
      );
      if (!/<w:pgMar[^>]*w:header/.test(documentXml)) {
        documentXml = documentXml.replace(
          /<w:pgMar([^/]*)\/?>/,
          '<w:pgMar$1 w:header="720"/>'
        );
      }
    } else {
      const defaultSectPr = `<w:sectPr>${headerRef}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/></w:sectPr>`;
      documentXml = documentXml.replace('</w:body>', `${defaultSectPr}</w:body>`);
    }
    zip.file('word/document.xml', documentXml);
  }

  return zip.generateAsync({ type: 'nodebuffer' });
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

    const hasHeader = headerContent && headerContent.trim();

    // Build HTML (body only — header and footer are injected post-Pandoc)
    const wrappedHtmlContent = buildPandocHtml({
      htmlContent,
      stylesheet
    });

    log('info', 'DOCX generation via Pandoc + post-process header/footer', {
      hasHeader: !!hasHeader,
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

    // Post-process: inject header into the generated DOCX
    if (hasHeader) {
      try {
        docxBuffer = await injectHeaderIntoDocx(docxBuffer, headerContent, stylesheet);
        log('debug', 'Header injected into DOCX via post-processing');
      } catch (headerError) {
        log('warn', 'Failed to inject header into DOCX, returning without header', { error: headerError.message });
      }
    }

    // Post-process: inject footer into the generated DOCX
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
 * - DOCX: Pandoc + post-process header/footer injection (clean text, editable)
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

  // DOCX: Use Pandoc for clean, editable text + native Word header/footer
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

module.exports = {
  generateDocx, getDocMimeType, getDocExtension,
  // Internal helpers exported for testing
  _internal: {
    escapeXml, decodeHtmlEntities, HTML_ENTITIES,
    cssColorToHex, CSS_NAMED_COLORS, cssSizeToHalfPoints, cssSizeToTwips, parseInlineStyles,
    buildRunProps, buildRuns, parseInlineHtml, INLINE_TAGS,
    extractImagesFromHtml, buildImageDrawing, parseBorderStyle, buildBorderXml,
    convertTableToOoxml, convertBlocksToOoxml, buildFlexParagraph,
    htmlToOoxml, injectFooterIntoDocx, injectHeaderIntoDocx, buildPandocHtml,
    extractHeaderBorder
  }
};
