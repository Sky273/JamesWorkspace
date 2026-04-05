/**
 * DOCX OOXML helpers
 * Public facade that preserves the existing API while delegating to focused modules.
 */

const styles = require('./docxOoxml.styles.cjs');
const images = require('./docxOoxml.images.cjs');
const inline = require('./docxOoxml.inline.cjs');
const blocks = require('./docxOoxml.blocks.cjs');

module.exports = {
  ...styles,
  ...images,
  ...inline,
  ...blocks
};
