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
    buildRunProps, buildRuns, parseInlineHtml,
    extractImagesFromHtml, buildImageDrawing,
    convertTableToOoxml, convertBlocksToOoxml, buildFlexParagraph,
    htmlToOoxml, buildPandocHtml
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

  it('should set no-border styles on all sides', () => {
    const result = convertTableToOoxml('<table><tr><td>X</td></tr></table>');
    expect(result).toContain('<w:tblBorders>');
    const noneCount = (result.match(/w:val="none"/g) || []).length;
    expect(noneCount).toBe(6); // top, left, bottom, right, insideH, insideV
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

  it('should strip <a> tags keeping visible text', () => {
    const result = htmlToOoxml('<p><a href="mailto:test@x.com">test@x.com</a></p>');
    expect(result).toContain('test@x.com');
    expect(result).not.toContain('mailto:');
    expect(result).not.toContain('&lt;a');
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
});
