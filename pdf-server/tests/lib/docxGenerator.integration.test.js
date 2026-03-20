/**
 * Integration tests for DOCX Generator – Footer injection
 * Tests injectFooterIntoDocx with real JSZip DOCX manipulation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  _internal: { injectFooterIntoDocx }
} = require('../../lib/docxGenerator.cjs');

/**
 * Create a minimal valid DOCX buffer using JSZip
 * Mimics what Pandoc would generate
 */
async function createMinimalDocx(opts = {}) {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  const sectPr = opts.sectPr ?? '<w:sectPr />';

  zip.file('[Content_Types].xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '</Types>'
  ].join('\n'));

  zip.file('_rels/.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    '</Relationships>'
  ].join('\n'));

  zip.file('word/_rels/document.xml.rels', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '</Relationships>'
  ].join('\n'));

  zip.file('word/document.xml', [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
    '            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<w:body><w:p><w:r><w:t>Test</w:t></w:r></w:p>',
    sectPr,
    '</w:body></w:document>'
  ].join('\n'));

  zip.file('word/styles.xml', '<?xml version="1.0"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>');

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('injectFooterIntoDocx()', () => {
  it('should add footer1.xml to the DOCX archive', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Footer text</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const files = Object.keys(zip.files);

    expect(files).toContain('word/footer1.xml');
  });

  it('should register footer in [Content_Types].xml', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const ct = await zip.file('[Content_Types].xml').async('string');

    expect(ct).toContain('footer1.xml');
    expect(ct).toContain('wordprocessingml.footer+xml');
  });

  it('should add footer relationship in document.xml.rels', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const rels = await zip.file('word/_rels/document.xml.rels').async('string');

    expect(rels).toContain('footer1.xml');
    expect(rels).toContain('relationships/footer');
  });

  it('should wire footerReference into document.xml sectPr', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const doc = await zip.file('word/document.xml').async('string');

    expect(doc).toContain('w:footerReference');
    expect(doc).toContain('w:type="default"');
  });

  it('should replace self-closing <w:sectPr /> with full sectPr', async () => {
    const docx = await createMinimalDocx({ sectPr: '<w:sectPr />' });
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const doc = await zip.file('word/document.xml').async('string');

    expect(doc).not.toContain('<w:sectPr />');
    expect(doc).toContain('<w:sectPr>');
    expect(doc).toContain('w:footerReference');
    expect(doc).toContain('<w:pgSz');
    expect(doc).toContain('<w:pgMar');
  });

  it('should inject into existing sectPr with children', async () => {
    const sectPr = '<w:sectPr w:rsidR="001"><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
    const docx = await createMinimalDocx({ sectPr });
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const doc = await zip.file('word/document.xml').async('string');

    expect(doc).toContain('w:footerReference');
    expect(doc).toContain('w:rsidR="001"');
  });

  it('should generate valid footer XML with page numbers', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p style="text-align: right;">page -pageNumber- / -totalPages-</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('xmlns:w=');
    expect(footer).toContain('xmlns:r=');
    expect(footer).toContain('PAGE');
    expect(footer).toContain('NUMPAGES');
    expect(footer).toContain('<w:jc w:val="right"/>');
  });

  it('should generate table OOXML in footer for table HTML', async () => {
    const docx = await createMinimalDocx();
    const html = '<table><tr><td style="text-align:right;">Logo</td><td style="text-align:left;">Contact</td></tr></table>';
    const result = await injectFooterIntoDocx(docx, html);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('<w:tbl>');
    expect(footer).toContain('<w:jc w:val="right"/>');
    expect(footer).toContain('<w:jc w:val="left"/>');
    expect(footer).toContain('Logo');
    expect(footer).toContain('Contact');
  });

  it('should embed base64 images in word/media/ and create rels', async () => {
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const html = `<p><img src="data:image/png;base64,${tinyPng}" width="100" height="30"></p>`;

    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, html);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const files = Object.keys(zip.files);

    // Image file embedded
    expect(files.some(f => f.startsWith('word/media/footerImg'))).toBe(true);

    // Footer rels created
    expect(files).toContain('word/_rels/footer1.xml.rels');
    const footerRels = await zip.file('word/_rels/footer1.xml.rels').async('string');
    expect(footerRels).toContain('relationships/image');
    expect(footerRels).toContain('rImgF1');

    // Content type registered
    const ct = await zip.file('[Content_Types].xml').async('string');
    expect(ct).toContain('Extension="png"');

    // Footer XML has drawing
    const footer = await zip.file('word/footer1.xml').async('string');
    expect(footer).toContain('w:drawing');
    expect(footer).toContain('xmlns:wp=');
  });

  it('should not add wp namespace when no images', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>No images</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).not.toContain('xmlns:wp=');
  });

  it('should not create footer1.xml.rels when no images', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Text only</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const files = Object.keys(zip.files);

    expect(files).not.toContain('word/_rels/footer1.xml.rels');
  });

  it('should be idempotent (not duplicate footer on second call)', async () => {
    const docx = await createMinimalDocx();
    const first = await injectFooterIntoDocx(docx, '<p>Footer v1</p>');
    const second = await injectFooterIntoDocx(first, '<p>Footer v2</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(second);
    const rels = await zip.file('word/_rels/document.xml.rels').async('string');

    // Should only have one footer relationship
    const footerRefCount = (rels.match(/footer1\.xml/g) || []).length;
    expect(footerRefCount).toBe(1);
  });

  it('should handle complex footer with table + image + page numbers', async () => {
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const html = [
      '<table style="width:100%"><tr>',
      `<td style="text-align:right;"><p><img src="data:image/png;base64,${tinyPng}" width="150" height="30"></p></td>`,
      '<td style="text-align:left;"><p>- contact : <a href="mailto:test@example.com">test@example.com</a></p></td>',
      '</tr></table>',
      '<p style="text-align: right;"> page -pageNumber- / -totalPages-</p>'
    ].join('');

    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, html);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    // Table
    expect(footer).toContain('<w:tbl>');
    expect(footer).toContain('<w:jc w:val="right"/>');
    expect(footer).toContain('<w:jc w:val="left"/>');
    // Image
    expect(footer).toContain('w:drawing');
    expect(footer).toContain('r:embed="rImgF1"');
    // Link text preserved (tag stripped)
    expect(footer).toContain('test@example.com');
    // Page numbers
    expect(footer).toContain('PAGE');
    expect(footer).toContain('NUMPAGES');
    // No raw HTML leak
    expect(footer).not.toMatch(/<a\s/);
    expect(footer).not.toMatch(/<img\s/);
    expect(footer).not.toMatch(/<table/);
  });

  it('should return a valid Buffer', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Footer</p>');

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should use default alignment from stylesheet', async () => {
    const docx = await createMinimalDocx();
    const stylesheet = 'body { text-align: center; font-size: 8pt; }';
    const result = await injectFooterIntoDocx(docx, '<p>Centered text</p>', stylesheet);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('<w:jc w:val="center"/>');
    expect(footer).toContain('Centered text');
  });

  it('should default to left alignment without stylesheet', async () => {
    const docx = await createMinimalDocx();
    const result = await injectFooterIntoDocx(docx, '<p>Left text</p>');

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('<w:jc w:val="left"/>');
  });

  it('should decode HTML entities in footer text', async () => {
    const docx = await createMinimalDocx();
    const html = '<p>100&nbsp;500&nbsp;&euro; &bull; RCS n&deg; 499</p>';
    const result = await injectFooterIntoDocx(docx, html);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('\u20AC');  // euro sign
    expect(footer).toContain('\u2022');  // bullet
    expect(footer).toContain('\u00B0');  // degree
    expect(footer).toContain('\u00A0');  // nbsp
    expect(footer).not.toContain('&euro;');
    expect(footer).not.toContain('&bull;');
    expect(footer).not.toContain('&deg;');
  });

  it('should decode accented character entities', async () => {
    const docx = await createMinimalDocx();
    const html = '<p>R&eacute;sum&eacute; - Exp&eacute;rience fran&ccedil;aise</p>';
    const result = await injectFooterIntoDocx(docx, html);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(result);
    const footer = await zip.file('word/footer1.xml').async('string');

    expect(footer).toContain('R\u00E9sum\u00E9');
    expect(footer).toContain('fran\u00E7aise');
    expect(footer).not.toContain('&eacute;');
    expect(footer).not.toContain('&ccedil;');
  });
});
