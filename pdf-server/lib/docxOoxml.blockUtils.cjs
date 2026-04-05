const { cssSizeToTwips, cssSizeToHalfPoints } = require('./docxOoxml.styles.cjs');

function resolveBlockStyle(block, defaultStyle) {
  const styleMatch = block.match(/<(?:div|p|span)[^>]*style="([^"]*)"/i);
  const blockStyle = styleMatch ? styleMatch[1] : '';
  return (defaultStyle && blockStyle)
    ? `${blockStyle}; ${defaultStyle}`
    : blockStyle || defaultStyle || '';
}

function resolveBlockAlignment(block, defaultAlign) {
  const alignMatch = block.match(/text-align:\s*(left|right|center|justify)/i);
  return alignMatch ? alignMatch[1].toLowerCase() : (defaultAlign || 'left');
}

function buildSpacingXml(style) {
  const mt = (style.match(/margin-top:\s*([^;"]+)/i) || [])[1];
  const mb = (style.match(/margin-bottom:\s*([^;"]+)/i) || [])[1];
  const lh = (style.match(/line-height:\s*([^;"]+)/i) || [])[1];

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
    } else if (!Number.isNaN(lhNum) && lhNum > 0) {
      attrs += ` w:line="${Math.round(lhNum * 240)}" w:lineRule="auto"`;
    }
  } else {
    attrs += ' w:line="240" w:lineRule="auto"';
  }

  return `<w:spacing${attrs}/>`;
}

function buildIndentXml(style) {
  const ti = (style.match(/text-indent:\s*([^;"]+)/i) || [])[1];
  const pl = (style.match(/(?:padding|margin)-left:\s*([^;"]+)/i) || [])[1];
  if (!ti && !pl) return '';

  let attrs = '';
  if (ti) attrs += ` w:firstLine="${cssSizeToTwips(ti)}"`;
  if (pl) attrs += ` w:left="${cssSizeToTwips(pl)}"`;
  return `<w:ind${attrs}/>`;
}

function resolveBlockFontSize(style) {
  return cssSizeToHalfPoints((style.match(/font-size:\s*([^;"]+)/i) || [])[1]) || 16;
}

module.exports = {
  resolveBlockStyle,
  resolveBlockAlignment,
  buildSpacingXml,
  buildIndentXml,
  resolveBlockFontSize
};
