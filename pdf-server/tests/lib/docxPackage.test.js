import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  attachDocumentPart,
  buildSectPrWithReference
} = require('../../lib/docxPackage.cjs');

describe('docxPackage', () => {
  it('builds a sectPr wrapper around a reference', () => {
    const xml = buildSectPrWithReference('<w:footerReference w:type="default" r:id="rId9"/>');

    expect(xml).toContain('<w:sectPr>');
    expect(xml).toContain('w:footerReference');
    expect(xml).toContain('w:header="720"');
    expect(xml).toContain('w:footer="720"');
  });

  it('attaches a footer relationship and updates document.xml', async () => {
    const files = new Map([
      ['word/_rels/document.xml.rels', '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="x" Target="styles.xml"/></Relationships>'],
      ['word/document.xml', '<w:document><w:body><w:p/><w:sectPr /></w:body></w:document>']
    ]);
    const zip = {
      file(name, value) {
        if (value !== undefined) {
          files.set(name, value);
          return this;
        }
        return {
          async: async () => files.get(name)
        };
      }
    };

    const attached = await attachDocumentPart(zip, {
      partFileName: 'footer1.xml',
      relationshipType: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
      referenceXml: '<w:footerReference w:type="default" r:id="__RID__"/>',
      marginAttr: 'w:footer'
    });

    expect(attached).toBe(true);
    expect(files.get('word/_rels/document.xml.rels')).toContain('Target="footer1.xml"');
    expect(files.get('word/document.xml')).toContain('w:footerReference');
    expect(files.get('word/document.xml')).toContain('w:footer="720"');
  });
});
