/**
 * Unit tests for DOCX Generator – OOXML helpers
 * Tests pure functions: escapeXml, buildRunProps, buildRuns, parseInlineHtml,
 * extractImagesFromHtml, buildImageDrawing, convertTableToOoxml,
 * convertBlocksToOoxml, buildFlexParagraph, htmlToOoxml, buildPandocHtml
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  getDocMimeType, getDocExtension,
  _internal: {
    escapeXml, decodeHtmlEntities, HTML_ENTITIES,
    cssColorToHex, CSS_NAMED_COLORS, cssSizeToHalfPoints, cssSizeToTwips, parseInlineStyles,
    buildRunProps, buildRuns, parseInlineHtml, INLINE_TAGS,
    extractImagesFromHtml, buildImageDrawing,
    parseBorderStyle, buildBorderXml,
    convertTableToOoxml, convertBlocksToOoxml, buildFlexParagraph,
    htmlToOoxml, buildPandocHtml,
    extractHeaderBorder, injectHeaderBorderIntoDocx
  }
} = require('../../lib/docxGenerator.cjs');

// ========================================================
// Public API
// ========================================================
describe('DOCX Generator – Public API', () => {
  describe('getDocMimeType()', () => {
    it('should return DOCX MIME type for docx', () => {
      expect(getDocMimeType('docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should return DOC MIME type for doc', () => {
      expect(getDocMimeType('doc')).toBe('application/msword');
    });
  });

  describe('getDocExtension()', () => {
    it('should return .docx for docx', () => {
      expect(getDocExtension('docx')).toBe('.docx');
    });

    it('should return .doc for doc', () => {
      expect(getDocExtension('doc')).toBe('.doc');
    });
  });
});

// ========================================================
// escapeXml
// ========================================================
describe('escapeXml()', () => {
  it('should escape ampersand', () => {
    expect(escapeXml('a & b')).toBe('a &amp; b');
  });

  it('should escape angle brackets', () => {
    expect(escapeXml('<div>')).toBe('&lt;div&gt;');
  });

  it('should escape double quotes', () => {
    expect(escapeXml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('should handle combined special chars', () => {
    expect(escapeXml('<a href="x">&')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;');
  });

  it('should leave normal text unchanged', () => {
    expect(escapeXml('Hello World 123')).toBe('Hello World 123');
  });
});

// ========================================================
// decodeHtmlEntities
// ========================================================
describe('decodeHtmlEntities()', () => {
  it('should decode common named entities', () => {
    expect(decodeHtmlEntities('&bull;')).toBe('\u2022');
    expect(decodeHtmlEntities('&euro;')).toBe('\u20AC');
    expect(decodeHtmlEntities('&deg;')).toBe('\u00B0');
    expect(decodeHtmlEntities('&copy;')).toBe('\u00A9');
    expect(decodeHtmlEntities('&reg;')).toBe('\u00AE');
    expect(decodeHtmlEntities('&trade;')).toBe('\u2122');
    expect(decodeHtmlEntities('&nbsp;')).toBe('\u00A0');
    expect(decodeHtmlEntities('&mdash;')).toBe('\u2014');
    expect(decodeHtmlEntities('&ndash;')).toBe('\u2013');
    expect(decodeHtmlEntities('&laquo;')).toBe('\u00AB');
    expect(decodeHtmlEntities('&raquo;')).toBe('\u00BB');
  });

  it('should decode XML entities', () => {
    expect(decodeHtmlEntities('&amp;')).toBe('&');
    expect(decodeHtmlEntities('&lt;')).toBe('<');
    expect(decodeHtmlEntities('&gt;')).toBe('>');
    expect(decodeHtmlEntities('&quot;')).toBe('"');
    expect(decodeHtmlEntities('&apos;')).toBe("'");
  });

  it('should decode numeric decimal entities', () => {
    expect(decodeHtmlEntities('&#8226;')).toBe('\u2022'); // bullet
    expect(decodeHtmlEntities('&#169;')).toBe('\u00A9');   // copyright
  });

  it('should decode numeric hex entities', () => {
    expect(decodeHtmlEntities('&#x2022;')).toBe('\u2022');
    expect(decodeHtmlEntities('&#x20AC;')).toBe('\u20AC');
  });

  it('should handle mixed text and entities', () => {
    const input = 'T\u00E9l. : 01 82 88 39 39 &bull; Fax : 01 82 88 39 45 &bull; SARL au capital de 100 500 &euro;';
    const result = decodeHtmlEntities(input);
    expect(result).toContain('\u2022');
    expect(result).toContain('\u20AC');
    expect(result).not.toContain('&bull;');
    expect(result).not.toContain('&euro;');
  });

  it('should leave unknown entities as-is', () => {
    expect(decodeHtmlEntities('&foobar;')).toBe('&foobar;');
  });

  it('should return empty/null input unchanged', () => {
    expect(decodeHtmlEntities('')).toBe('');
    expect(decodeHtmlEntities(null)).toBe(null);
    expect(decodeHtmlEntities(undefined)).toBe(undefined);
  });

  it('should leave strings without & unchanged', () => {
    expect(decodeHtmlEntities('no entities here')).toBe('no entities here');
  });

  it('should decode French accented character entities', () => {
    expect(decodeHtmlEntities('&eacute;')).toBe('\u00E9'); // é
    expect(decodeHtmlEntities('&egrave;')).toBe('\u00E8'); // è
    expect(decodeHtmlEntities('&ecirc;')).toBe('\u00EA');  // ê
    expect(decodeHtmlEntities('&euml;')).toBe('\u00EB');   // ë
    expect(decodeHtmlEntities('&agrave;')).toBe('\u00E0');  // à
    expect(decodeHtmlEntities('&acirc;')).toBe('\u00E2');   // â
    expect(decodeHtmlEntities('&ocirc;')).toBe('\u00F4');   // ô
    expect(decodeHtmlEntities('&ugrave;')).toBe('\u00F9');  // ù
    expect(decodeHtmlEntities('&ucirc;')).toBe('\u00FB');   // û
    expect(decodeHtmlEntities('&ccedil;')).toBe('\u00E7');  // ç
    expect(decodeHtmlEntities('&iuml;')).toBe('\u00EF');    // ï
    expect(decodeHtmlEntities('&oelig;')).toBe('\u0153');   // œ
    expect(decodeHtmlEntities('&Eacute;')).toBe('\u00C9');  // É
  });

  it('should decode uppercase accented entities', () => {
    expect(decodeHtmlEntities('&Agrave;')).toBe('\u00C0');
    expect(decodeHtmlEntities('&Ccedil;')).toBe('\u00C7');
    expect(decodeHtmlEntities('&Ntilde;')).toBe('\u00D1');
    expect(decodeHtmlEntities('&Uuml;')).toBe('\u00DC');
  });
});

// ========================================================
// cssColorToHex
// ========================================================
describe('cssColorToHex()', () => {
  it('should return null for null/empty/transparent', () => {
    expect(cssColorToHex(null)).toBeNull();
    expect(cssColorToHex('')).toBeNull();
    expect(cssColorToHex('transparent')).toBeNull();
    expect(cssColorToHex('inherit')).toBeNull();
  });

  it('should parse 6-char hex colors', () => {
    expect(cssColorToHex('#ff0000')).toBe('FF0000');
    expect(cssColorToHex('#ABC123')).toBe('ABC123');
  });

  it('should expand 3-char hex colors', () => {
    expect(cssColorToHex('#f00')).toBe('FF0000');
    expect(cssColorToHex('#abc')).toBe('AABBCC');
  });

  it('should parse rgb() colors', () => {
    expect(cssColorToHex('rgb(255, 0, 0)')).toBe('FF0000');
    expect(cssColorToHex('rgb(0,128,0)')).toBe('008000');
  });

  it('should parse rgba() colors (ignoring alpha)', () => {
    expect(cssColorToHex('rgba(255, 0, 0, 0.5)')).toBe('FF0000');
  });

  it('should parse named colors', () => {
    expect(cssColorToHex('red')).toBe('FF0000');
    expect(cssColorToHex('blue')).toBe('0000FF');
    expect(cssColorToHex('navy')).toBe('000080');
    expect(cssColorToHex('Black')).toBe('000000');
  });

  it('should return null for unknown color names', () => {
    expect(cssColorToHex('foobar')).toBeNull();
  });
});

// ========================================================
// cssSizeToHalfPoints
// ========================================================
describe('cssSizeToHalfPoints()', () => {
  it('should return null for null/empty', () => {
    expect(cssSizeToHalfPoints(null)).toBeNull();
    expect(cssSizeToHalfPoints('')).toBeNull();
  });

  it('should convert px to half-points (1px ≈ 1.5 half-pt)', () => {
    expect(cssSizeToHalfPoints('10px')).toBe(15);
    expect(cssSizeToHalfPoints('8px')).toBe(12);
  });

  it('should convert pt to half-points (1pt = 2 half-pt)', () => {
    expect(cssSizeToHalfPoints('8pt')).toBe(16);
    expect(cssSizeToHalfPoints('12pt')).toBe(24);
  });

  it('should convert em to half-points', () => {
    expect(cssSizeToHalfPoints('1em')).toBe(16);
    expect(cssSizeToHalfPoints('1.5em')).toBe(24);
  });

  it('should convert named sizes', () => {
    expect(cssSizeToHalfPoints('small')).toBe(14);
    expect(cssSizeToHalfPoints('medium')).toBe(16);
    expect(cssSizeToHalfPoints('large')).toBe(20);
  });

  it('should return null for unknown values', () => {
    expect(cssSizeToHalfPoints('auto')).toBeNull();
  });
});

// ========================================================
// cssSizeToTwips
// ========================================================
describe('cssSizeToTwips()', () => {
  it('should return 0 for null/empty', () => {
    expect(cssSizeToTwips(null)).toBe(0);
    expect(cssSizeToTwips('')).toBe(0);
  });

  it('should convert px to twips (1px ≈ 15 twips)', () => {
    expect(cssSizeToTwips('10px')).toBe(150);
  });

  it('should convert pt to twips (1pt = 20 twips)', () => {
    expect(cssSizeToTwips('12pt')).toBe(240);
  });

  it('should convert mm to twips', () => {
    expect(cssSizeToTwips('10mm')).toBe(567);
  });
});

// ========================================================
// parseInlineStyles
// ========================================================
describe('parseInlineStyles()', () => {
  it('should return empty object for null/empty', () => {
    expect(parseInlineStyles(null)).toEqual({});
    expect(parseInlineStyles('')).toEqual({});
  });

  it('should parse font-weight bold', () => {
    expect(parseInlineStyles('font-weight: bold;').bold).toBe(true);
    expect(parseInlineStyles('font-weight: 700;').bold).toBe(true);
    expect(parseInlineStyles('font-weight: 400;').bold).toBeUndefined();
  });

  it('should parse font-style italic', () => {
    expect(parseInlineStyles('font-style: italic;').italic).toBe(true);
  });

  it('should parse text-decoration underline and line-through', () => {
    const ul = parseInlineStyles('text-decoration: underline;');
    expect(ul.underline).toBe(true);
    const lt = parseInlineStyles('text-decoration: line-through;');
    expect(lt.strike).toBe(true);
    const both = parseInlineStyles('text-decoration: underline line-through;');
    expect(both.underline).toBe(true);
    expect(both.strike).toBe(true);
  });

  it('should parse color (not background-color)', () => {
    const s = parseInlineStyles('color: #ff0000; background-color: #00ff00;');
    expect(s.color).toBe('#FF0000');
    expect(s.bgColor).toBe('#00FF00');
  });

  it('should parse font-size', () => {
    expect(parseInlineStyles('font-size: 12pt;').fontSize).toBe(24);
    expect(parseInlineStyles('font-size: 10px;').fontSize).toBe(15);
  });

  it('should parse font-family', () => {
    expect(parseInlineStyles('font-family: Arial, sans-serif;').fontFamily).toBe('Arial, sans-serif');
  });

  it('should parse vertical-align', () => {
    expect(parseInlineStyles('vertical-align: super;').vertAlign).toBe('superscript');
    expect(parseInlineStyles('vertical-align: sub;').vertAlign).toBe('subscript');
  });

  it('should parse text-transform uppercase', () => {
    expect(parseInlineStyles('text-transform: uppercase;').caps).toBe(true);
  });

  it('should parse letter-spacing', () => {
    expect(parseInlineStyles('letter-spacing: 2px;').letterSpacing).toBe(30);
    expect(parseInlineStyles('letter-spacing: 1pt;').letterSpacing).toBe(20);
  });
});

// ========================================================
// buildRunProps
// ========================================================
describe('buildRunProps()', () => {
  it('should include default size properties', () => {
    const rPr = buildRunProps();
    expect(rPr).toContain('<w:sz w:val="16"/>');
    expect(rPr).toContain('<w:szCs w:val="16"/>');
  });

  it('should include bold tag when bold=true', () => {
    expect(buildRunProps({ bold: true })).toContain('<w:b/>');
  });

  it('should include italic tag when italic=true', () => {
    expect(buildRunProps({ italic: true })).toContain('<w:i/>');
  });

  it('should include color for 6-char hex', () => {
    expect(buildRunProps({ color: '#1e40af' })).toContain('<w:color w:val="1E40AF"/>');
  });

  it('should expand 3-char hex to 6-char', () => {
    expect(buildRunProps({ color: '#f00' })).toContain('<w:color w:val="FF0000"/>');
  });

  it('should ignore invalid color strings', () => {
    expect(buildRunProps({ color: 'notacolor' })).not.toContain('<w:color');
  });

  it('should combine bold + italic + color', () => {
    const rPr = buildRunProps({ bold: true, italic: true, color: '#333333' });
    expect(rPr).toContain('<w:b/>');
    expect(rPr).toContain('<w:i/>');
    expect(rPr).toContain('<w:color w:val="333333"/>');
  });

  it('should not include bold/italic when false', () => {
    const rPr = buildRunProps({ bold: false, italic: false });
    expect(rPr).not.toContain('<w:b/>');
    expect(rPr).not.toContain('<w:i/>');
  });

  it('should include underline when underline=true', () => {
    expect(buildRunProps({ underline: true })).toContain('<w:u w:val="single"/>');
  });

  it('should include strikethrough when strike=true', () => {
    expect(buildRunProps({ strike: true })).toContain('<w:strike/>');
  });

  it('should include caps when caps=true', () => {
    expect(buildRunProps({ caps: true })).toContain('<w:caps/>');
  });

  it('should include font family when fontFamily is set', () => {
    const rPr = buildRunProps({ fontFamily: "'Arial', sans-serif" });
    expect(rPr).toContain('<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>');
  });

  it('should use custom fontSize', () => {
    const rPr = buildRunProps({ fontSize: 24 });
    expect(rPr).toContain('<w:sz w:val="24"/>');
    expect(rPr).toContain('<w:szCs w:val="24"/>');
  });

  it('should include background color shading', () => {
    const rPr = buildRunProps({ bgColor: '#FFFF00' });
    expect(rPr).toContain('<w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/>');
  });

  it('should include vertical alignment', () => {
    expect(buildRunProps({ vertAlign: 'superscript' })).toContain('<w:vertAlign w:val="superscript"/>');
    expect(buildRunProps({ vertAlign: 'subscript' })).toContain('<w:vertAlign w:val="subscript"/>');
  });

  it('should include letter spacing', () => {
    expect(buildRunProps({ letterSpacing: 30 })).toContain('<w:spacing w:val="30"/>');
  });

  it('should handle named CSS colors via cssColorToHex', () => {
    expect(buildRunProps({ color: 'red' })).toContain('<w:color w:val="FF0000"/>');
    expect(buildRunProps({ color: 'navy' })).toContain('<w:color w:val="000080"/>');
  });
});

// ========================================================
// buildRuns
// ========================================================
describe('buildRuns()', () => {
  const defaultProps = '<w:rPr><w:sz w:val="16"/><w:szCs w:val="16"/></w:rPr>';

  it('should return empty string for empty/null text', () => {
    expect(buildRuns('', defaultProps)).toBe('');
    expect(buildRuns(null, defaultProps)).toBe('');
  });

  it('should wrap plain text in w:r with xml:space="preserve"', () => {
    const result = buildRuns('Hello', defaultProps);
    expect(result).toContain('<w:t xml:space="preserve">Hello</w:t>');
    expect(result).toContain('<w:r>');
  });

  it('should escape XML entities in text', () => {
    const result = buildRuns('a < b & c', defaultProps);
    expect(result).toContain('a &lt; b &amp; c');
  });

  it('should convert PAGE placeholder to Word field code', () => {
    const result = buildRuns('\uFFF0PAGE\uFFF0', defaultProps);
    expect(result).toContain('fldCharType="begin"');
    expect(result).toContain('PAGE');
    expect(result).toContain('fldCharType="end"');
  });

  it('should convert NUMPAGES placeholder to Word field code', () => {
    const result = buildRuns('\uFFF0NUMPAGES\uFFF0', defaultProps);
    expect(result).toContain('NUMPAGES');
    expect(result).toContain('fldCharType="begin"');
  });

  it('should handle text mixed with multiple field codes', () => {
    const result = buildRuns('page \uFFF0PAGE\uFFF0 / \uFFF0NUMPAGES\uFFF0', defaultProps);
    expect(result).toContain('page ');
    expect(result).toContain('PAGE');
    expect(result).toContain(' / ');
    expect(result).toContain('NUMPAGES');
  });

  it('should include run properties in output', () => {
    const result = buildRuns('text', '<w:rPr><w:b/></w:rPr>');
    expect(result).toContain('<w:b/>');
  });

  it('should XML-escape already-decoded text correctly', () => {
    // Entity decoding now happens in parseInlineHtml; buildRuns receives decoded text
    const result = buildRuns('100\u00A0500\u00A0\u20AC \u2022 RCS n\u00B0', defaultProps);
    expect(result).toContain('100\u00A0500\u00A0\u20AC');
    expect(result).toContain('\u2022');
    expect(result).toContain('n\u00B0');
  });
});

// ========================================================
// parseInlineHtml
// ========================================================
describe('parseInlineHtml()', () => {
  it('should return empty string for null/empty input', () => {
    expect(parseInlineHtml(null)).toBe('');
    expect(parseInlineHtml('')).toBe('');
  });

  it('should render plain text as OOXML run', () => {
    const result = parseInlineHtml('Hello world');
    expect(result).toContain('<w:r>');
    expect(result).toContain('Hello world');
  });

  it('should handle <strong> bold formatting', () => {
    const result = parseInlineHtml('<strong>Bold text</strong>');
    expect(result).toContain('<w:b/>');
    expect(result).toContain('Bold text');
  });

  it('should handle <b> bold formatting', () => {
    const result = parseInlineHtml('<b>Bold</b>');
    expect(result).toContain('<w:b/>');
  });

  it('should handle <em> italic formatting', () => {
    const result = parseInlineHtml('<em>Italic text</em>');
    expect(result).toContain('<w:i/>');
    expect(result).toContain('Italic text');
  });

  it('should handle <i> italic formatting', () => {
    const result = parseInlineHtml('<i>Italic</i>');
    expect(result).toContain('<w:i/>');
  });

  it('should handle nested bold + italic', () => {
    const result = parseInlineHtml('<strong><em>Both</em></strong>');
    expect(result).toContain('<w:b/>');
    expect(result).toContain('<w:i/>');
    expect(result).toContain('Both');
  });

  it('should handle <span> with inline color', () => {
    const result = parseInlineHtml('<span style="color: #ff0000">Red</span>');
    expect(result).toContain('<w:color w:val="FF0000"/>');
    expect(result).toContain('Red');
  });

  it('should apply default style color', () => {
    const result = parseInlineHtml('Colored', 'color: #00ff00');
    expect(result).toContain('<w:color w:val="00FF00"/>');
  });

  it('should pop color stack on </span>', () => {
    const result = parseInlineHtml('<span style="color:#ff0000">Red</span> Normal');
    // After </span>, color should revert
    expect(result).toContain('Red');
    expect(result).toContain('Normal');
  });

  it('should strip unknown HTML tags without leaking', () => {
    const result = parseInlineHtml('<div><p>Text</p></div>');
    expect(result).toContain('Text');
    expect(result).not.toContain('&lt;div');
    expect(result).not.toContain('&lt;p');
  });

  it('should decode HTML entities', () => {
    const result = parseInlineHtml('&nbsp;test&amp;more');
    expect(result).toContain('test');
  });

  it('should replace -pageNumber- with PAGE field code', () => {
    const result = parseInlineHtml('Page -pageNumber-');
    expect(result).toContain('PAGE');
    expect(result).toContain('fldCharType="begin"');
  });

  it('should replace -totalPages- with NUMPAGES field code', () => {
    const result = parseInlineHtml('of -totalPages-');
    expect(result).toContain('NUMPAGES');
  });

  it('should handle image markers from extractImagesFromHtml', () => {
    const result = parseInlineHtml('\uFFF1IMGF:rImgF1:100:50\uFFF1');
    expect(result).toContain('w:drawing');
    expect(result).toContain('r:embed="rImgF1"');
    expect(result).toContain(`cx="${100 * 9525}"`);
    expect(result).toContain(`cy="${50 * 9525}"`);
  });

  it('should handle tab characters as OOXML tabs', () => {
    const result = parseInlineHtml('Left\tRight');
    expect(result).toContain('<w:tab/>');
    expect(result).toContain('Left');
    expect(result).toContain('Right');
  });

  it('should not leak <br> as text', () => {
    const result = parseInlineHtml('A<br>B');
    expect(result).not.toContain('&lt;br');
  });

  // --- New tag support ---
  it('should handle <u> underline tag', () => {
    const result = parseInlineHtml('<u>Underlined</u>');
    expect(result).toContain('<w:u w:val="single"/>');
    expect(result).toContain('Underlined');
  });

  it('should handle <ins> as underline', () => {
    const result = parseInlineHtml('<ins>Inserted</ins>');
    expect(result).toContain('<w:u w:val="single"/>');
  });

  it('should handle <s> strikethrough tag', () => {
    const result = parseInlineHtml('<s>Deleted</s>');
    expect(result).toContain('<w:strike/>');
    expect(result).toContain('Deleted');
  });

  it('should handle <del> as strikethrough', () => {
    const result = parseInlineHtml('<del>Removed</del>');
    expect(result).toContain('<w:strike/>');
  });

  it('should handle <sub> subscript', () => {
    const result = parseInlineHtml('H<sub>2</sub>O');
    expect(result).toContain('<w:vertAlign w:val="subscript"/>');
    expect(result).toContain('2');
  });

  it('should handle <sup> superscript', () => {
    const result = parseInlineHtml('x<sup>2</sup>');
    expect(result).toContain('<w:vertAlign w:val="superscript"/>');
    expect(result).toContain('2');
  });

  it('should handle <small> with reduced font size', () => {
    const result = parseInlineHtml('<small>Fine print</small>');
    // default 16 * 0.8 = 12.8 → rounded to 13
    expect(result).toContain('<w:sz w:val="13"/>');
    expect(result).toContain('Fine print');
  });

  it('should handle <mark> with yellow background', () => {
    const result = parseInlineHtml('<mark>Highlighted</mark>');
    expect(result).toContain('<w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/>');
    expect(result).toContain('Highlighted');
  });

  it('should handle <code> with monospace font', () => {
    const result = parseInlineHtml('<code>snippet</code>');
    expect(result).toContain('w:ascii="Courier New"');
    expect(result).toContain('snippet');
  });

  it('should handle inline style font-weight: bold on span', () => {
    const result = parseInlineHtml('<span style="font-weight: bold;">Bold via style</span>');
    expect(result).toContain('<w:b/>');
  });

  it('should handle inline style font-style: italic on span', () => {
    const result = parseInlineHtml('<span style="font-style: italic;">Italic via style</span>');
    expect(result).toContain('<w:i/>');
  });

  it('should handle inline style text-decoration: underline', () => {
    const result = parseInlineHtml('<span style="text-decoration: underline;">Underlined via style</span>');
    expect(result).toContain('<w:u w:val="single"/>');
  });

  it('should handle inline style text-decoration: line-through', () => {
    const result = parseInlineHtml('<span style="text-decoration: line-through;">Struck</span>');
    expect(result).toContain('<w:strike/>');
  });

  it('should handle inline style font-size', () => {
    const result = parseInlineHtml('<span style="font-size: 12pt;">Large</span>');
    expect(result).toContain('<w:sz w:val="24"/>'); // 12pt = 24 half-points
  });

  it('should handle inline style font-family', () => {
    const result = parseInlineHtml('<span style="font-family: Georgia;">Serif</span>');
    expect(result).toContain('w:ascii="Georgia"');
  });

  it('should handle inline style background-color', () => {
    const result = parseInlineHtml('<span style="background-color: #ff0;">Highlighted</span>');
    expect(result).toContain('<w:shd w:val="clear" w:color="auto" w:fill="FFFF00"/>');
  });

  it('should handle inline style vertical-align: super', () => {
    const result = parseInlineHtml('<span style="vertical-align: super;">sup</span>');
    expect(result).toContain('<w:vertAlign w:val="superscript"/>');
  });

  it('should handle inline style text-transform: uppercase', () => {
    const result = parseInlineHtml('<span style="text-transform: uppercase;">caps</span>');
    expect(result).toContain('<w:caps/>');
  });

  it('should handle <font> tag with color and face attributes', () => {
    const result = parseInlineHtml('<font color="#0000ff" face="Verdana">Old style</font>');
    expect(result).toContain('<w:color w:val="0000FF"/>');
    expect(result).toContain('w:ascii="Verdana"');
  });

  it('should handle nested formatting with style stack', () => {
    const result = parseInlineHtml('<b><u><span style="color: red;">Nested</span></u></b> Plain');
    // "Nested" should be bold + underline + red
    expect(result).toContain('<w:b/>');
    expect(result).toContain('<w:u w:val="single"/>');
    expect(result).toContain('<w:color w:val="FF0000"/>');
    // "Plain" should have none of those
    const plainRun = result.split('Plain')[0].split('Nested')[1];
    // After closing all tags, formatting should be reset
  });

  it('should apply default style as base and override with inline', () => {
    const result = parseInlineHtml(
      '<span style="font-size: 20pt;">Big</span> Normal',
      'color: #333; font-size: 10pt;'
    );
    // "Big" should have fontSize=40 (20pt) and color #333
    expect(result).toContain('<w:sz w:val="40"/>');
    expect(result).toContain('<w:color w:val="333333"/>');
    // "Normal" should have fontSize=20 (10pt from default)
    expect(result).toContain('<w:sz w:val="20"/>');
  });
});

// ========================================================
// extractImagesFromHtml
// ========================================================
describe('extractImagesFromHtml()', () => {
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAAlwSFlzAAAA';

  it('should replace base64 <img> with marker', () => {
    const html = `<p><img src="data:image/png;base64,${tinyPng}" width="100" height="50"></p>`;
    const { html: processed, images } = extractImagesFromHtml(html);
    expect(processed).toContain('\uFFF1IMGF:rImgF1:100:50\uFFF1');
    expect(processed).not.toContain('<img');
    expect(images).toHaveLength(1);
  });

  it('should extract image metadata correctly', () => {
    const html = `<img src="data:image/png;base64,${tinyPng}" width="150" height="30">`;
    const { images } = extractImagesFromHtml(html);
    expect(images[0]).toEqual(expect.objectContaining({
      rId: 'rImgF1',
      filename: 'footerImg1.png',
      ext: 'png',
      mimeType: 'image/png',
      width: 150,
      height: 30
    }));
    expect(images[0].data).toBeInstanceOf(Buffer);
  });

  it('should handle jpeg images with jpg extension', () => {
    const html = `<img src="data:image/jpeg;base64,${tinyPng}" width="50" height="50">`;
    const { images } = extractImagesFromHtml(html);
    expect(images[0].ext).toBe('jpg');
    expect(images[0].mimeType).toBe('image/jpeg');
    expect(images[0].filename).toBe('footerImg1.jpg');
  });

  it('should strip non-base64 images', () => {
    const html = '<img src="https://example.com/logo.png" width="100" height="50">';
    const { html: processed, images } = extractImagesFromHtml(html);
    expect(images).toHaveLength(0);
    expect(processed).not.toContain('<img');
  });

  it('should default dimensions to 100x30 when not specified', () => {
    const html = `<img src="data:image/png;base64,${tinyPng}">`;
    const { images } = extractImagesFromHtml(html);
    expect(images[0].width).toBe(100);
    expect(images[0].height).toBe(30);
  });

  it('should handle multiple images with incremental IDs', () => {
    const html = `<img src="data:image/png;base64,${tinyPng}" width="10" height="10"><img src="data:image/png;base64,${tinyPng}" width="20" height="20">`;
    const { images } = extractImagesFromHtml(html);
    expect(images).toHaveLength(2);
    expect(images[0].rId).toBe('rImgF1');
    expect(images[1].rId).toBe('rImgF2');
    expect(images[1].filename).toBe('footerImg2.png');
  });

  it('should return original HTML unchanged when no images', () => {
    const html = '<p>No images here</p>';
    const { html: processed, images } = extractImagesFromHtml(html);
    expect(processed).toBe(html);
    expect(images).toHaveLength(0);
  });
});

// ========================================================
// buildImageDrawing
// ========================================================
describe('buildImageDrawing()', () => {
  it('should generate valid OOXML inline drawing', () => {
    const result = buildImageDrawing('rImgF1', 100, 50);
    expect(result).toContain('<w:drawing>');
    expect(result).toContain('</w:drawing>');
    expect(result).toContain('<wp:inline');
    expect(result).toContain('</wp:inline>');
  });

  it('should convert pixels to EMU (px * 9525)', () => {
    const result = buildImageDrawing('rImgF1', 100, 50);
    expect(result).toContain(`cx="${100 * 9525}"`);
    expect(result).toContain(`cy="${50 * 9525}"`);
  });

  it('should reference correct relationship ID', () => {
    const result = buildImageDrawing('rImgF2', 10, 10);
    expect(result).toContain('r:embed="rImgF2"');
  });

  it('should include noFill line to suppress borders', () => {
    const result = buildImageDrawing('rImgF1', 10, 10);
    expect(result).toContain('<a:ln><a:noFill/></a:ln>');
  });

  it('should set docPr id from numeric part of rId', () => {
    const result = buildImageDrawing('rImgF3', 10, 10);
    expect(result).toContain('id="3"');
  });

  it('should include required XML namespaces', () => {
    const result = buildImageDrawing('rImgF1', 10, 10);
    expect(result).toContain('xmlns:pic=');
    expect(result).toContain('xmlns:a=');
  });

  it('should use rect preset geometry', () => {
    const result = buildImageDrawing('rImgF1', 10, 10);
    expect(result).toContain('prst="rect"');
  });
});

// ========================================================
// parseBorderStyle
// ========================================================
describe('parseBorderStyle()', () => {
  it('should return null for empty/null input', () => {
    expect(parseBorderStyle(null)).toBeNull();
    expect(parseBorderStyle('')).toBeNull();
    expect(parseBorderStyle(undefined)).toBeNull();
  });

  it('should return null for "border: none"', () => {
    expect(parseBorderStyle('border: none;')).toBeNull();
  });

  it('should return null for "border: 0"', () => {
    expect(parseBorderStyle('border: 0;')).toBeNull();
  });

  it('should return null when no border property present', () => {
    expect(parseBorderStyle('color: red; font-size: 12px;')).toBeNull();
  });

  it('should parse solid border with hex color', () => {
    const result = parseBorderStyle('border: 1px solid #ff0000;');
    expect(result).not.toBeNull();
    expect(result.style).toBe('single');
    expect(result.color).toBe('FF0000');
    expect(result.sz).toBeGreaterThan(0);
  });

  it('should parse dashed border', () => {
    const result = parseBorderStyle('border: 2px dashed #000;');
    expect(result.style).toBe('dashed');
    expect(result.color).toBe('000000');
  });

  it('should parse dotted border', () => {
    const result = parseBorderStyle('border: 1px dotted #ccc;');
    expect(result.style).toBe('dotted');
    expect(result.color).toBe('CCCCCC');
  });

  it('should default to "auto" color when no hex color', () => {
    const result = parseBorderStyle('border: 1px solid;');
    expect(result.color).toBe('auto');
  });

  it('should expand 3-char hex colors', () => {
    const result = parseBorderStyle('border: 1px solid #abc;');
    expect(result.color).toBe('AABBCC');
  });
});

// ========================================================
// buildBorderXml
// ========================================================
describe('buildBorderXml()', () => {
  it('should generate "none" borders when border is null', () => {
    const xml = buildBorderXml(null, ['top', 'bottom']);
    expect(xml).toContain('w:val="none"');
    expect(xml).toContain('<w:top');
    expect(xml).toContain('<w:bottom');
    expect((xml.match(/w:val="none"/g) || []).length).toBe(2);
  });

  it('should generate visible borders when border is provided', () => {
    const xml = buildBorderXml({ sz: 8, color: 'FF0000', style: 'single' }, ['top', 'left']);
    expect(xml).toContain('w:val="single"');
    expect(xml).toContain('w:sz="8"');
    expect(xml).toContain('w:color="FF0000"');
    expect(xml).not.toContain('w:val="none"');
  });
});

// ========================================================
// convertTableToOoxml
// ========================================================
describe('convertTableToOoxml()', () => {
  it('should generate a w:tbl element', () => {
    const result = convertTableToOoxml('<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>');
    expect(result).toContain('<w:tbl>');
    expect(result).toContain('</w:tbl>');
  });

  it('should create correct number of cells', () => {
    const result = convertTableToOoxml('<table><tr><td>A</td><td>B</td><td>C</td></tr></table>');
    expect((result.match(/<w:tc>/g) || []).length).toBe(3);
  });

  it('should create correct number of grid columns', () => {
    const result = convertTableToOoxml('<table><tr><td>A</td><td>B</td></tr></table>');
    expect((result.match(/<w:gridCol/g) || []).length).toBe(2);
  });

  it('should preserve cell text-align right', () => {
    const result = convertTableToOoxml('<table><tr><td style="text-align: right;">R</td></tr></table>');
    expect(result).toContain('<w:jc w:val="right"/>');
  });

  it('should preserve cell text-align left', () => {
    const result = convertTableToOoxml('<table><tr><td style="text-align: left;">L</td></tr></table>');
    expect(result).toContain('<w:jc w:val="left"/>');
  });

  it('should preserve cell text-align center', () => {
    const result = convertTableToOoxml('<table><tr><td style="text-align: center;">C</td></tr></table>');
    expect(result).toContain('<w:jc w:val="center"/>');
  });

  it('should default to left alignment', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('<w:jc w:val="left"/>');
  });

  it('should handle colspan', () => {
    const result = convertTableToOoxml('<table><tr><td colspan="2">Span</td></tr></table>');
    expect(result).toContain('<w:gridSpan w:val="2"/>');
  });

  it('should set no-border styles on all sides (table + cells)', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('<w:tblBorders>');
    expect(result).toContain('<w:tcBorders>');
    const noneCount = (result.match(/w:val="none"/g) || []).length;
    // 6 table borders + 4 cell borders = 10
    expect(noneCount).toBe(10);
  });

  it('should include tblLook to prevent Word default style overrides', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('<w:tblLook');
  });

  it('should apply borders when table has border CSS style', () => {
    const result = convertTableToOoxml('<table style="border: 1px solid #000;"><tr><td>X</td></tr></table>');
    expect(result).toContain('w:val="single"');
    expect(result).toContain('w:color="000000"');
    expect(result).not.toMatch(/w:val="none"/);
  });

  it('should apply borders when table has border HTML attribute', () => {
    const result = convertTableToOoxml('<table border="1"><tr><td>X</td></tr></table>');
    expect(result).toContain('w:val="single"');
    expect(result).not.toMatch(/w:val="none"/);
  });

  it('should not apply borders when border attribute is 0', () => {
    const result = convertTableToOoxml('<table border="0"><tr><td>X</td></tr></table>');
    expect(result).not.toContain('w:val="single"');
    const noneCount = (result.match(/w:val="none"/g) || []).length;
    expect(noneCount).toBeGreaterThan(0);
  });

  it('should apply cell-level border override from cell style', () => {
    const result = convertTableToOoxml(
      '<table><tr><td style="border: 2px solid #f00;">X</td></tr></table>'
    );
    // Table-level should be "none" (no table border)
    expect(result).toContain('<w:tblBorders>');
    // Cell-level should have "single" border (from cell style)
    expect(result).toContain('<w:tcBorders>');
    const tblBorders = result.match(/<w:tblBorders>([\s\S]*?)<\/w:tblBorders>/)[1];
    expect(tblBorders).toContain('w:val="none"');
    const tcBorders = result.match(/<w:tcBorders>([\s\S]*?)<\/w:tcBorders>/)[1];
    expect(tcBorders).toContain('w:val="single"');
    expect(tcBorders).toContain('w:color="FF0000"');
  });

  it('should use 100% width via pct', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('w:w="5000" w:type="pct"');
  });

  it('should strip <p> wrappers inside cells', () => {
    const result = convertTableToOoxml('<table><tr><td><p>Content</p></td></tr></table>');
    expect(result).toContain('Content');
    expect(result).not.toContain('&lt;p');
  });

  it('should handle multiple rows', () => {
    const result = convertTableToOoxml('<table><tr><td>R1</td></tr><tr><td>R2</td></tr></table>');
    expect((result.match(/<w:tr>/g) || []).length).toBe(2);
  });

  it('should return empty string for empty table', () => {
    expect(convertTableToOoxml('<table></table>')).toBe('');
  });

  it('should handle image markers inside cells', () => {
    const result = convertTableToOoxml('<table><tr><td>\uFFF1IMGF:rImgF1:150:30\uFFF1</td></tr></table>');
    expect(result).toContain('w:drawing');
    expect(result).toContain('r:embed="rImgF1"');
  });

  it('should handle <th> header cells', () => {
    const result = convertTableToOoxml('<table><tr><th>Header</th></tr></table>');
    expect(result).toContain('<w:tc>');
    expect(result).toContain('Header');
  });

  it('should set vertical alignment to center', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('<w:vAlign w:val="center"/>');
  });
});

// ========================================================
// convertBlocksToOoxml
// ========================================================
describe('convertBlocksToOoxml()', () => {
  it('should return empty for null/empty/whitespace', () => {
    expect(convertBlocksToOoxml(null)).toBe('');
    expect(convertBlocksToOoxml('')).toBe('');
    expect(convertBlocksToOoxml('   ')).toBe('');
  });

  it('should convert <hr> to border paragraph', () => {
    const result = convertBlocksToOoxml('<hr style="height: 2px; background-color: #1e40af;">');
    expect(result).toContain('<w:pBdr>');
    expect(result).toContain('w:color="1E40AF"');
    expect(result).toContain('w:sz="8"');
  });

  it('should default hr size to 12', () => {
    const result = convertBlocksToOoxml('<hr>');
    expect(result).toContain('w:sz="12"');
  });

  it('should default hr color to auto', () => {
    const result = convertBlocksToOoxml('<hr>');
    expect(result).toContain('w:color="auto"');
  });

  it('should convert <div> with background and small height to border paragraph', () => {
    const result = convertBlocksToOoxml('<div style="height: 4px; background: #993366; margin: 0 0 5px 0;">&nbsp;</div>');
    expect(result).toContain('<w:pBdr>');
    expect(result).toContain('w:color="993366"');
    expect(result).toContain('w:sz="16"');
  });

  it('should convert <div> with background-color and small height to border paragraph', () => {
    const result = convertBlocksToOoxml('<div style="height: 3px; background-color: #a01c5c;">&nbsp;</div>');
    expect(result).toContain('<w:pBdr>');
    expect(result).toContain('w:color="A01C5C"');
    expect(result).toContain('w:sz="12"');
  });

  it('should NOT convert <div> with background but large height to border paragraph', () => {
    const result = convertBlocksToOoxml('<div style="height: 50px; background: #993366;">Content</div>');
    // Should be treated as a regular paragraph, not a border
    expect(result).not.toContain('<w:pBdr>');
    expect(result).toContain('Content');
  });

  it('should create paragraphs from block elements', () => {
    const result = convertBlocksToOoxml('<p>Line 1</p><p>Line 2</p>');
    expect((result.match(/<w:p>/g) || []).length).toBe(2);
  });

  it('should preserve text-align right', () => {
    const result = convertBlocksToOoxml('<p style="text-align: right;">Right</p>');
    expect(result).toContain('<w:jc w:val="right"/>');
  });

  it('should default to left alignment', () => {
    const result = convertBlocksToOoxml('<p>Text</p>');
    expect(result).toContain('<w:jc w:val="left"/>');
  });

  it('should map justify to "both"', () => {
    const result = convertBlocksToOoxml('<p style="text-align: justify;">Text</p>');
    expect(result).toContain('<w:jc w:val="both"/>');
  });

  it('should skip empty blocks', () => {
    expect(convertBlocksToOoxml('<p></p><p>   </p>')).toBe('');
  });

  it('should keep blocks with -pageNumber- placeholder', () => {
    const result = convertBlocksToOoxml('<p>-pageNumber-</p>');
    expect(result).toContain('PAGE');
  });

  it('should keep blocks with -totalPages- placeholder', () => {
    const result = convertBlocksToOoxml('<p>-totalPages-</p>');
    expect(result).toContain('NUMPAGES');
  });

  it('should keep blocks with image markers', () => {
    const result = convertBlocksToOoxml('<p>\uFFF1IMGF:rImgF1:10:10\uFFF1</p>');
    expect(result).toContain('w:drawing');
  });

  // --- Block-level style support ---
  it('should parse margin-top and margin-bottom as paragraph spacing', () => {
    const result = convertBlocksToOoxml('<p style="margin-top: 10px; margin-bottom: 5px;">Spaced</p>');
    expect(result).toContain('w:before="150"'); // 10px * 15 twips
    expect(result).toContain('w:after="75"');   // 5px * 15 twips
  });

  it('should parse line-height as paragraph line spacing', () => {
    const result = convertBlocksToOoxml('<p style="line-height: 1.5;">Text</p>');
    expect(result).toContain('w:line="360"'); // 1.5 * 240
    expect(result).toContain('w:lineRule="auto"');
  });

  it('should parse line-height in px as exact spacing', () => {
    const result = convertBlocksToOoxml('<p style="line-height: 20px;">Text</p>');
    expect(result).toContain('w:line="300"'); // 20px * 15 twips
    expect(result).toContain('w:lineRule="exact"');
  });

  it('should parse text-indent as first line indent', () => {
    const result = convertBlocksToOoxml('<p style="text-indent: 20px;">Indented</p>');
    expect(result).toContain('w:firstLine="300"'); // 20px * 15 twips
  });

  it('should parse padding-left as left indent', () => {
    const result = convertBlocksToOoxml('<p style="padding-left: 10px;">Padded</p>');
    expect(result).toContain('w:left="150"'); // 10px * 15 twips
  });

  it('should use block font-size for default run properties', () => {
    const result = convertBlocksToOoxml('<p style="font-size: 12pt;">Big text</p>');
    // 12pt = 24 half-points
    expect(result).toContain('<w:sz w:val="24"/>');
  });

  it('should use defaultAlign parameter when no inline text-align', () => {
    const result = convertBlocksToOoxml('<p>Centered</p>', 'center');
    expect(result).toContain('<w:jc w:val="center"/>');
  });

  it('should always include w:spacing with default zero spacing', () => {
    const result = convertBlocksToOoxml('<p>No spacing</p>');
    expect(result).toContain('w:before="0"');
    expect(result).toContain('w:after="0"');
    expect(result).toContain('w:line="240"');
    expect(result).toContain('w:lineRule="auto"');
  });

  it('should apply defaultStyle font-size when block has no inline style', () => {
    const result = convertBlocksToOoxml('<p>Text</p>', 'left', 'font-size: 7pt; color: #666;');
    // 7pt = 14 half-points
    expect(result).toContain('<w:sz w:val="14"/>');
    expect(result).toContain('<w:color w:val="666666"/>');
  });

  it('should let block inline style override defaultStyle', () => {
    const result = convertBlocksToOoxml(
      '<p style="font-size: 12pt;">Big</p>', 'left', 'font-size: 7pt;'
    );
    // Block style 12pt = 24 should win over default 7pt = 14
    expect(result).toContain('<w:sz w:val="24"/>');
  });
});

// ========================================================
// buildFlexParagraph
// ========================================================
describe('buildFlexParagraph()', () => {
  it('should return empty for no child spans/divs', () => {
    expect(buildFlexParagraph('bare text without tags')).toBe('');
  });

  it('should create right tab stop for 2-child layout', () => {
    const html = '<div style="display:flex;justify-content:space-between"><span>Left</span><span>Right</span></div>';
    const result = buildFlexParagraph(html);
    expect(result).toContain('<w:tab w:val="right"');
    expect(result).toContain('<w:tab/>');
    expect(result).toContain('Left');
    expect(result).toContain('Right');
  });

  it('should create center + right tab stops for 3-child layout', () => {
    const html = '<div style="display:flex;justify-content:space-between"><span>L</span><span>C</span><span>R</span></div>';
    const result = buildFlexParagraph(html);
    expect(result).toContain('w:val="center"');
    expect(result).toContain('w:val="right"');
  });

  it('should generate a single paragraph', () => {
    const html = '<div style="display:flex;justify-content:space-between"><span>A</span><span>B</span></div>';
    const result = buildFlexParagraph(html);
    expect((result.match(/<w:p>/g) || []).length).toBe(1);
  });
});

// ========================================================
// htmlToOoxml (integration of all converters)
// ========================================================
describe('htmlToOoxml()', () => {
  it('should return empty for null/empty/whitespace', () => {
    expect(htmlToOoxml(null)).toBe('');
    expect(htmlToOoxml('')).toBe('');
    expect(htmlToOoxml('   ')).toBe('');
  });

  it('should convert <a> tags to spans keeping visible text', () => {
    const result = htmlToOoxml('<p><a href="mailto:test@x.com">test@x.com</a></p>');
    expect(result).toContain('test@x.com');
    expect(result).not.toContain('mailto:');
    expect(result).not.toContain('&lt;a');
  });

  it('should preserve <a> inline styles (converted to span)', () => {
    const result = htmlToOoxml('<p><a href="#" style="color: #0000ff;">Link</a></p>');
    expect(result).toContain('<w:color w:val="0000FF"/>');
    expect(result).toContain('Link');
  });

  it('should pass defaultStyle through to paragraphs', () => {
    const result = htmlToOoxml('<p>Small text</p>', 'center', 'font-size: 7pt; color: #666;');
    expect(result).toContain('<w:sz w:val="14"/>'); // 7pt = 14 half-points
    expect(result).toContain('<w:jc w:val="center"/>');
    expect(result).toContain('<w:color w:val="666666"/>');
  });

  it('should convert <br> to paragraph break', () => {
    const result = htmlToOoxml('<p>A<br>B</p>');
    expect((result.match(/<w:p>/g) || []).length).toBeGreaterThanOrEqual(2);
  });

  it('should route <table> blocks to OOXML w:tbl', () => {
    const result = htmlToOoxml('<table><tr><td>Cell</td></tr></table>');
    expect(result).toContain('<w:tbl>');
    expect(result).toContain('Cell');
  });

  it('should handle mixed table + paragraph content', () => {
    const html = '<p>Before</p><table><tr><td>Cell</td></tr></table><p>After</p>';
    const result = htmlToOoxml(html);
    expect(result).toContain('Before');
    expect(result).toContain('<w:tbl>');
    expect(result).toContain('After');
  });

  it('should handle realistic footer with hr + table + page numbers', () => {
    const html = [
      '<hr style="height:2px;background-color:#993366;">',
      '<table><tr>',
      '<td style="text-align:right;">\uFFF1IMGF:rImgF1:150:30\uFFF1</td>',
      '<td style="text-align:left;">Contact info</td>',
      '</tr></table>',
      '<p style="text-align:right;">page -pageNumber- / -totalPages-</p>'
    ].join('');
    const result = htmlToOoxml(html);
    // HR
    expect(result).toContain('<w:pBdr>');
    expect(result).toContain('993366');
    // Table
    expect(result).toContain('<w:tbl>');
    expect(result).toContain('<w:jc w:val="right"/>');
    expect(result).toContain('w:drawing');
    expect(result).toContain('Contact info');
    // Page numbers
    expect(result).toContain('PAGE');
    expect(result).toContain('NUMPAGES');
  });

  it('should handle flex layout', () => {
    const html = '<div style="display: flex; justify-content: space-between;"><span>L</span><span>R</span></div>';
    const result = htmlToOoxml(html);
    expect(result).toContain('L');
    expect(result).toContain('R');
  });
});

// ========================================================
// buildPandocHtml
// ========================================================
describe('buildPandocHtml()', () => {
  it('should return a valid HTML document', () => {
    const result = buildPandocHtml({ htmlContent: '<p>Body</p>', stylesheet: '' });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html>');
    expect(result).toContain('</html>');
  });

  it('should include body content in .document-body', () => {
    const result = buildPandocHtml({ htmlContent: '<p>Content</p>', stylesheet: '' });
    expect(result).toContain('class="document-body"');
    expect(result).toContain('<p>Content</p>');
  });

  it('should include stylesheet', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: '.cls{color:red}' });
    expect(result).toContain('.cls{color:red}');
  });

  it('should include header when provided', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: '', headerContent: '<div>Header</div>' });
    expect(result).toContain('document-header');
    expect(result).toContain('Header');
  });

  it('should omit header section when empty', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: '', headerContent: '' });
    expect(result).not.toContain('<div class="document-header">');
  });

  it('should omit header section when undefined', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: '' });
    expect(result).not.toContain('<div class="document-header">');
  });

  it('should set Arial as base font family', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: '' });
    expect(result).toContain('font-family: Arial');
  });

  it('should inject __HDRBDR__ marker when stylesheet has header border-bottom', () => {
    const css = '.pdf-header { border-bottom: 3px solid #a01c5c; }';
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: css, headerContent: '<div>H</div>' });
    expect(result).toContain('__HDRBDR__');
  });

  it('should NOT inject __HDRBDR__ marker when no border in stylesheet', () => {
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: 'body{color:red}', headerContent: '<div>H</div>' });
    expect(result).not.toContain('__HDRBDR__');
  });

  it('should NOT inject __HDRBDR__ marker when no header content', () => {
    const css = '.pdf-header { border-bottom: 3px solid #a01c5c; }';
    const result = buildPandocHtml({ htmlContent: '<p>X</p>', stylesheet: css });
    expect(result).not.toContain('__HDRBDR__');
  });
});

// ========================================================
// extractHeaderBorder
// ========================================================
describe('extractHeaderBorder()', () => {
  it('should return null for null/empty stylesheet', () => {
    expect(extractHeaderBorder(null)).toBeNull();
    expect(extractHeaderBorder('')).toBeNull();
  });

  it('should extract border from .pdf-header selector', () => {
    const css = '.pdf-header { border-bottom: 3px solid #a01c5c; padding: 10px; }';
    const result = extractHeaderBorder(css);
    expect(result).toEqual({ color: 'A01C5C', size: 12 });
  });

  it('should extract border from header selector', () => {
    const css = 'header { border-bottom: 2px solid #993366; }';
    const result = extractHeaderBorder(css);
    expect(result).toEqual({ color: '993366', size: 8 });
  });

  it('should extract border from .document-header selector', () => {
    const css = '.document-header { border-bottom: 4px solid rgb(160, 28, 92); }';
    const result = extractHeaderBorder(css);
    expect(result).toEqual({ color: 'A01C5C', size: 16 });
  });

  it('should fall back to any border-bottom if no header selector', () => {
    const css = '.separator { border-bottom: 2px solid #0000ff; }';
    const result = extractHeaderBorder(css);
    expect(result).toEqual({ color: '0000FF', size: 8 });
  });

  it('should return null when no border-bottom in stylesheet', () => {
    const css = 'body { color: #333; font-size: 11pt; }';
    expect(extractHeaderBorder(css)).toBeNull();
  });

  it('should handle named colors', () => {
    const css = '.pdf-header { border-bottom: 2px solid red; }';
    const result = extractHeaderBorder(css);
    expect(result).toEqual({ color: 'FF0000', size: 8 });
  });

  it('should use default width when 0px specified', () => {
    const css = 'header { border-bottom: 0px solid #000; }';
    const result = extractHeaderBorder(css);
    // 0 → default 2 (via || 2), 2 * 4 = 8
    expect(result.size).toBe(8);
  });
});

// ========================================================
// injectHeaderBorderIntoDocx
// ========================================================
describe('injectHeaderBorderIntoDocx()', () => {
  // Helper to create a minimal valid DOCX with a marker paragraph
  async function createDocxWithMarker() {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>Header text</w:t></w:r></w:p>
<w:p><w:r><w:t>__HDRBDR__</w:t></w:r></w:p>
<w:p><w:r><w:t>Body content</w:t></w:r></w:p>
<w:sectPr/>
</w:body>
</w:document>`);
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  it('should replace __HDRBDR__ marker with a colored border paragraph', async () => {
    const docxBuffer = await createDocxWithMarker();
    const result = await injectHeaderBorderIntoDocx(docxBuffer, { color: 'A01C5C', size: 12 });
    const { default: JSZip } = await import('jszip');
    const zip = await JSZip.loadAsync(result);
    const docXml = await zip.file('word/document.xml').async('string');
    expect(docXml).not.toContain('__HDRBDR__');
    expect(docXml).toContain('<w:pBdr>');
    expect(docXml).toContain('w:color="A01C5C"');
    expect(docXml).toContain('w:sz="12"');
    expect(docXml).toContain('w:after="120"');
  });

  it('should return unchanged buffer when marker is not found', async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>');
    zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>');
    zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>No marker here</w:t></w:r></w:p></w:body></w:document>');
    const buf = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await injectHeaderBorderIntoDocx(buf, { color: 'FF0000', size: 8 });
    // Should return the original buffer unchanged
    expect(result).toEqual(buf);
  });
});
