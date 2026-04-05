import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildPartXml,
  getDefaultOoxmlContextFromStylesheet
} = require('../../lib/docxPartInjection.cjs');

describe('docxPartInjection helpers', () => {
  it('parses default OOXML context from stylesheet', () => {
    const result = getDefaultOoxmlContextFromStylesheet('p { text-align: right; font-size: 11pt; color: #123456; line-height: 1.4; }');

    expect(result).toEqual({
      defaultAlign: 'right',
      defaultStyle: 'font-size: 11pt; color: #123456; line-height: 1.4'
    });
  });

  it('builds a namespaced footer xml fragment with embedded image markup', () => {
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    const { xml } = buildPartXml({
      rootTag: 'w:ftr',
      htmlContent: `<p style="text-align:right;"><img src="data:image/png;base64,${tinyPng}" width="10" height="10">Hello</p>`,
      stylesheet: 'p { text-align: right; }'
    });

    expect(xml).toContain('<w:ftr');
    expect(xml).toContain('xmlns:wp=');
    expect(xml).toContain('Hello');
    expect(xml).toContain('w:drawing');
    expect(xml).toContain('<w:jc w:val="right"/>');
  });
});
