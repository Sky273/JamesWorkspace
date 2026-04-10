import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const {
  buildGenerationFailureBody,
  createRequestCoordinator,
  decodeHtmlEntities,
  resolvePdfServerInternalToken,
  sanitizeFilename,
  tokensMatch
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
    expect(buildGenerationFailureBody('PDF', null)).toEqual({
      status: 500,
      body: { error: 'Failed to generate PDF' }
    });
    const abortError = new Error('Document generation timed out.');
    abortError.name = 'AbortError';
    abortError.code = 'ABORT_ERR';
    expect(buildGenerationFailureBody('PDF', abortError)).toEqual({
      status: 504,
      body: { error: 'PDF generation timed out. Try with simpler content.' }
    });
    expect(buildGenerationFailureBody('DOCX', new Error('Navigation timeout exceeded'))).toEqual({
      status: 504,
      body: { error: 'DOCX generation timed out. Try with simpler content.' }
    });
    expect(buildGenerationFailureBody('DOCX', 'Navigation timeout exceeded')).toEqual({
      status: 504,
      body: { error: 'DOCX generation timed out. Try with simpler content.' }
    });
  });

  it('compares internal tokens with constant-time semantics prerequisites', () => {
    expect(tokensMatch('x'.repeat(32), 'x'.repeat(32))).toBe(true);
    expect(tokensMatch('x'.repeat(32), 'y'.repeat(32))).toBe(false);
    expect(tokensMatch('x'.repeat(32), 'short')).toBe(false);
    expect(tokensMatch('', '')).toBe(false);
  });

  it('decodes common HTML entities before inspection', () => {
    expect(decodeHtmlEntities('java&#x73;cript:alert(1)')).toBe('javascript:alert(1)');
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('rejects external srcset resources during document validation', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<img srcset="https://evil.test/a.png 1x" src="data:image/png;base64,AAAA">',
        filename: 'test.pdf'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects dangerous embedded CSS while preserving inline-style support in principle', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<p style="background-image:url(https://evil.test/a.png)">Hello</p>',
        filename: 'test.pdf'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects entity-encoded external resource references during document validation', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<img src="https&#x3a;//evil.test/a.png">',
        filename: 'test.pdf'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects entity-encoded dangerous CSS in stylesheets', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<p>Hello</p>',
        filename: 'test.pdf',
        stylesheet: 'body { background-image: url(https&#x3a;//evil.test/a.png); }'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects entity-encoded external base href declarations', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<base href="https&#x3a;//evil.test/"><p>Hello</p>',
        filename: 'test.pdf'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects entity-encoded external resources inside embedded css fragments', () => {
    const coordinator = createRequestCoordinator({
      logger: { log: () => {} },
      pdfServerInternalToken: 't'.repeat(32),
      pdfGenerationTimeout: 30000,
      rateLimitMax: 10,
      maxActiveJobs: 2,
      maxHtmlSize: 1024 * 1024,
      maxStylesheetSize: 50_000,
      maxFragmentSize: 50_000
    });
    const req = {
      body: {
        htmlContent: '<style>body { background-image: url(https&#x3a;//evil.test/a.png); }</style><p>Hello</p>',
        filename: 'test.pdf'
      }
    };
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    coordinator.middlewares.validatePdfRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
