/**
 * Shared CSS/XML helpers for DOCX OOXML conversion.
 */

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: '\u00A0', ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009',
  bull: '\u2022', middot: '\u00B7', hellip: '\u2026',
  mdash: '\u2014', ndash: '\u2013', minus: '\u2212',
  lsquo: '\u2018', rsquo: '\u2019', ldquo: '\u201C', rdquo: '\u201D',
  laquo: '\u00AB', raquo: '\u00BB', prime: '\u2032', Prime: '\u2033',
  euro: '\u20AC', pound: '\u00A3', yen: '\u00A5', cent: '\u00A2', curren: '\u00A4',
  deg: '\u00B0', copy: '\u00A9', reg: '\u00AE', trade: '\u2122',
  times: '\u00D7', divide: '\u00F7', plusmn: '\u00B1', micro: '\u00B5',
  para: '\u00B6', sect: '\u00A7', dagger: '\u2020', Dagger: '\u2021',
  permil: '\u2030', fnof: '\u0192', ordf: '\u00AA', ordm: '\u00BA',
  sup1: '\u00B9', sup2: '\u00B2', sup3: '\u00B3', frac14: '\u00BC', frac12: '\u00BD', frac34: '\u00BE',
  iquest: '\u00BF', iexcl: '\u00A1', brvbar: '\u00A6', not: '\u00AC', macr: '\u00AF',
  cedil: '\u00B8', shy: '\u00AD',
  Agrave: '\u00C0', Aacute: '\u00C1', Acirc: '\u00C2', Atilde: '\u00C3', Auml: '\u00C4', Aring: '\u00C5',
  AElig: '\u00C6', Ccedil: '\u00C7',
  Egrave: '\u00C8', Eacute: '\u00C9', Ecirc: '\u00CA', Euml: '\u00CB',
  Igrave: '\u00CC', Iacute: '\u00CD', Icirc: '\u00CE', Iuml: '\u00CF',
  ETH: '\u00D0', Ntilde: '\u00D1',
  Ograve: '\u00D2', Oacute: '\u00D3', Ocirc: '\u00D4', Otilde: '\u00D5', Ouml: '\u00D6', Oslash: '\u00D8',
  Ugrave: '\u00D9', Uacute: '\u00DA', Ucirc: '\u00DB', Uuml: '\u00DC',
  Yacute: '\u00DD', THORN: '\u00DE',
  agrave: '\u00E0', aacute: '\u00E1', acirc: '\u00E2', atilde: '\u00E3', auml: '\u00E4', aring: '\u00E5',
  aelig: '\u00E6', ccedil: '\u00E7',
  egrave: '\u00E8', eacute: '\u00E9', ecirc: '\u00EA', euml: '\u00EB',
  igrave: '\u00EC', iacute: '\u00ED', icirc: '\u00EE', iuml: '\u00EF',
  eth: '\u00F0', ntilde: '\u00F1',
  ograve: '\u00F2', oacute: '\u00F3', ocirc: '\u00F4', otilde: '\u00F5', ouml: '\u00F6', oslash: '\u00F8',
  ugrave: '\u00F9', uacute: '\u00FA', ucirc: '\u00FB', uuml: '\u00FC',
  yacute: '\u00FD', thorn: '\u00FE', yuml: '\u00FF', szlig: '\u00DF',
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
      .map(v => Math.min(255, parseInt(v, 10)).toString(16).padStart(2, '0'))
      .join('').toUpperCase();
  }
  return CSS_NAMED_COLORS[color.toLowerCase()] || null;
}

function extractHeaderBorder(stylesheet) {
  if (!stylesheet) return null;
  let match = stylesheet.match(/[^{}]*header[^{}]*\{[^}]*border-bottom:\s*(\d+)(?:px)?\s+solid\s+([^;}"]+)/i);
  if (!match) {
    match = stylesheet.match(/border-bottom:\s*(\d+)(?:px)?\s+solid\s+([^;}"]+)/i);
  }
  if (!match) return null;
  const width = parseInt(match[1], 10) || 2;
  const color = cssColorToHex(match[2].trim());
  if (!color) return null;
  return { color, size: Math.max(4, width * 4) };
}

function cssSizeToHalfPoints(cssSize) {
  if (!cssSize) return null;
  cssSize = cssSize.trim();
  const px = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  if (px) return Math.round(parseFloat(px[1]) * 1.5);
  const pt = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*pt$/i);
  if (pt) return Math.round(parseFloat(pt[1]) * 2);
  const em = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*(em|rem)$/i);
  if (em) return Math.round(parseFloat(em[1]) * 16);
  const pct = cssSize.match(/^(-?\d+(?:\.\d+)?)\s*%$/i);
  if (pct) return Math.round(parseFloat(pct[1]) / 100 * 16);
  const named = { 'xx-small':10, 'x-small':12, small:14, medium:16, large:20, 'x-large':24, 'xx-large':28 };
  return named[cssSize.toLowerCase()] || null;
}

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
  if (em) return Math.round(parseFloat(em[1]) * 160);
  return 0;
}

function parseInlineStyles(styleStr) {
  if (!styleStr) return {};
  const s = {};
  const fw = styleStr.match(/font-weight:\s*(\w+|\d+)/i);
  if (fw) {
    const v = fw[1];
    if (v === 'bold' || v === 'bolder' || parseInt(v, 10) >= 700) s.bold = true;
  }
  const fs = styleStr.match(/font-style:\s*(\w+)/i);
  if (fs && /^(italic|oblique)$/i.test(fs[1])) s.italic = true;
  const td = styleStr.match(/text-decoration[^:]*:\s*([^;]+)/i);
  if (td) {
    const v = td[1].toLowerCase();
    if (v.includes('underline')) s.underline = true;
    if (v.includes('line-through')) s.strike = true;
  }
  const cm = styleStr.match(/(?<![\w-])color:\s*([^;"]+)/i);
  if (cm) {
    const hex = cssColorToHex(cm[1].trim());
    if (hex) s.color = '#' + hex;
  }
  const bg = styleStr.match(/background-color:\s*([^;"]+)/i);
  if (bg) {
    const hex = cssColorToHex(bg[1].trim());
    if (hex) s.bgColor = '#' + hex;
  }
  const fz = styleStr.match(/font-size:\s*([^;"]+)/i);
  if (fz) {
    const hp = cssSizeToHalfPoints(fz[1].trim());
    if (hp) s.fontSize = hp;
  }
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

function extractImagesFromHtml(html) {
  const images = [];
  let idx = 0;
  const processed = html.replace(/<img[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/src="data:image\/([^;]+);base64,([^"]+)"/i);
    if (!srcMatch) return '';
    idx += 1;
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

module.exports = {
  escapeXml,
  decodeHtmlEntities,
  HTML_ENTITIES,
  CSS_NAMED_COLORS,
  cssColorToHex,
  extractHeaderBorder,
  cssSizeToHalfPoints,
  cssSizeToTwips,
  parseInlineStyles,
  extractImagesFromHtml
};
