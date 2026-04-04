import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildGenerationFailureBody,
  resolvePdfServerInternalToken,
  sanitizeFilename
} = require('../../lib/requestGuards.cjs');

describe('requestGuards', () => {
  it('returns the configured dedicated internal token when valid', () => {
    const token = resolvePdfServerInternalToken({
      configuredToken: 't'.repeat(32)
    });

    expect(token).toBe('t'.repeat(32));
  });

  it('returns an empty token when no dedicated internal token is configured', () => {
    const token = resolvePdfServerInternalToken({
      configuredToken: ''
    });

    expect(token).toBe('');
  });

  it('sanitizes filenames while preserving the requested extension', () => {
    expect(sanitizeFilename('my file (1).pdf', '.pdf')).toBe('my_file__1_.pdf');
    expect(sanitizeFilename('resume.final', '.docx')).toBe('resume.final.docx');
  });

  it('builds sanitized public failure bodies', () => {
    expect(buildGenerationFailureBody('PDF', new Error('secret path leak'))).toEqual({
      status: 500,
      body: { error: 'Failed to generate PDF' }
    });
    expect(buildGenerationFailureBody('DOCX', new Error('Navigation timeout exceeded'))).toEqual({
      status: 504,
      body: { error: 'DOCX generation timed out. Try with simpler content.' }
    });
  });
});
