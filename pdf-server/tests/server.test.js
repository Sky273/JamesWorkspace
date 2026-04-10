/**
 * Tests for PDF Server endpoints
 * Tests health, validation middleware, PDF and DOCX generation routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';

const require = createRequire(import.meta.url);

const validPdfServerToken = 'test-pdf-server-internal-token-minimum-32-chars';
process.env.PDF_SERVER_INTERNAL_TOKEN = validPdfServerToken;

const pdfGen = require('../lib/pdfGenerator.cjs');
const docxGen = require('../lib/docxGenerator.cjs');
const logger = require('../lib/logger.cjs');
const serverModule = require('../server.cjs');
const { app } = serverModule;

const origGeneratePdf = pdfGen.generatePdf;
const origCloseBrowser = pdfGen.closeBrowser;
const origGenerateDocx = docxGen.generateDocx;
const origGetDocMimeType = docxGen.getDocMimeType;
const origGetDocExtension = docxGen.getDocExtension;
const origLog = logger.log;

const resetServerModule = (token = process.env.PDF_SERVER_INTERNAL_TOKEN) => {
  if (token === null) {
    delete process.env.PDF_SERVER_INTERNAL_TOKEN;
  } else {
    process.env.PDF_SERVER_INTERNAL_TOKEN = token;
  }
  delete require.cache[require.resolve('../server.cjs')];
  return require('../server.cjs');
};

describe('PDF Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pdfGen.generatePdf = vi.fn();
    pdfGen.closeBrowser = vi.fn();
    docxGen.generateDocx = vi.fn();
    docxGen.getDocMimeType = vi.fn((fmt) =>
      fmt === 'doc' ? 'application/msword'
        : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    docxGen.getDocExtension = vi.fn((fmt) => fmt === 'doc' ? '.doc' : '.docx');
    logger.log = vi.fn();
  });

  afterEach(() => {
    pdfGen.generatePdf = origGeneratePdf;
    pdfGen.closeBrowser = origCloseBrowser;
    docxGen.generateDocx = origGenerateDocx;
    docxGen.getDocMimeType = origGetDocMimeType;
    docxGen.getDocExtension = origGetDocExtension;
    logger.log = origLog;
    delete process.env.PDF_MAX_OUTPUT_SIZE;
    delete process.env.PDF_MAX_CONCURRENT;
    delete process.env.PDF_SERVER_HEALTH_VERBOSE;
    delete process.env.PDF_SERVER_REQUEST_TIMEOUT_MS;
    delete process.env.PDF_TIMEOUT;
    process.env.PDF_SERVER_INTERNAL_TOKEN = validPdfServerToken;
    delete require.cache[require.resolve('../server.cjs')];
  });

  describe('GET /health', () => {
    it('should return 200 with status ok', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('should include uptime', async () => {
      const res = await request(app).get('/health');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.uptime).toMatch(/\d+h \d+m/);
    });

    it('should stay minimal by default', async () => {
      const res = await request(app).get('/health');
      expect(res.body.memory).toBeUndefined();
      expect(res.body.config).toBeUndefined();
      expect(res.body.rateLimitEntries).toBeUndefined();
      expect(res.body.activeGenerationJobs).toBeUndefined();
    });

    it('should expose diagnostics only when verbose health is enabled', async () => {
      process.env.PDF_SERVER_HEALTH_VERBOSE = 'true';
      const { app: verboseApp } = resetServerModule();
      const res = await request(verboseApp).get('/health');

      expect(res.body.memory).toBeDefined();
      expect(res.body.config).toBeDefined();
      expect(res.body.rateLimitEntries).toBeDefined();
      expect(res.body.activeGenerationJobs).toBeDefined();
    });
  });

  describe('unknown routes', () => {
    it('returns 404 when no embedded dist frontend is present', async () => {
      const res = await request(app).get('/not-a-real-route');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Not found' });
    });
  });

  describe('POST /generate-pdf - validation', () => {
    it('should reject requests without the internal token', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf' });
      expect(res.status).toBe(403);
    });

    it('should return 503 when the internal token is not configured', async () => {
      const { app: missingTokenApp } = resetServerModule(null);

      const res = await request(missingTokenApp)
        .post('/generate-pdf')
        .set('x-internal-service-token', 'anything-goes')
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf' });

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'PDF server is not configured for internal authentication.'
      });
      expect(pdfGen.generatePdf).not.toHaveBeenCalled();
    });

    it('should return 503 when the internal token is too short', async () => {
      const { app: invalidTokenApp } = resetServerModule('short-token');

      const res = await request(invalidTokenApp)
        .post('/generate-pdf')
        .set('x-internal-service-token', 'anything-goes')
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf' });

      expect(res.status).toBe(503);
      expect(res.body).toEqual({
        error: 'PDF server is not configured for internal authentication.'
      });
      expect(pdfGen.generatePdf).not.toHaveBeenCalled();
    });

    it('should reject missing htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ filename: 'test.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('htmlContent');
    });

    it('should reject non-string htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: 123, filename: 'test.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('htmlContent');
    });

    it('should reject missing filename', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('filename');
    });

    it('should reject non-string filename', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 42 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('filename');
    });

    it('should reject oversized HTML content', async () => {
      const bigHtml = 'x'.repeat(6 * 1024 * 1024);
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: bigHtml, filename: 'big.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('too large');
    });

    it('should reject oversized requests before parsing', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .set('Content-Type', 'application/json')
        .set('Content-Length', String(11 * 1024 * 1024))
        .send('{"htmlContent":"<p>Hello</p>","filename":"test.pdf"}');

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Request body too large');
    });

    it('should reject dangerous htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<img src=x onerror=alert(1)>', filename: 'test.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unsupported');
    });

    it('should reject external resources in htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<img src="https://evil.test/a.png">', filename: 'test.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('external resources');
    });

    it('should reject dangerous stylesheet', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf', stylesheet: '@import url(https://evil.test/x.css);' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stylesheet');
    });

    it('should allow inline style attributes in htmlContent', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<p style="color:#123456;font-weight:600">Hello</p>',
          filename: 'test.pdf'
        });

      expect(res.status).toBe(200);
    });

    it('should allow embedded style tags in htmlContent', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<style>.title { color: #123456; }</style><p class="title">Hello</p>',
          filename: 'test.pdf'
        });

      expect(res.status).toBe(200);
    });

    it('should allow inline styles in headerContent', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<p>Hello</p>',
          filename: 'test.pdf',
          headerContent: '<div style="font-size:12px;color:#666">Header</div>'
        });

      expect(res.status).toBe(200);
    });

    it('should reject external resources embedded in htmlContent tags', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<img src="https://evil.test/bg.png"><p>Hello</p>',
          filename: 'test.pdf'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('external resources');
    });

    it('should reject entity-encoded javascript payloads in htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<a href="java&#x73;cript:alert(1)">Hello</a>',
          filename: 'test.pdf'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unsupported');
    });

    it('should reject external resources embedded in headerContent tags', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<p>Hello</p>',
          filename: 'test.pdf',
          headerContent: '<img src="https://evil.test/header.png" alt="header">'
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('external resources');
    });

    it('should reject invalid footerHeight', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf', footerHeight: 'abc' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('footerHeight');
    });
  });

  describe('POST /generate-pdf - generation', () => {
    it('should return PDF buffer on success', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 fake content');
      pdfGen.generatePdf.mockResolvedValue(fakePdf);

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      expect(res.headers['content-disposition']).toContain('test.pdf');
      expect(res.body).toBeDefined();
    });

    it('should sanitize filename', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'my file (1).pdf' });

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('my_file__1_.pdf');
    });

    it('should add .pdf extension if missing', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'doc' });

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('.pdf');
    });

    it('should pass all options to generatePdf', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .set('x-request-id', 'proxy-request-123')
        .send({
          htmlContent: '<p>Body</p>',
          filename: 'test.pdf',
          stylesheet: '.cls{color:red}',
          headerContent: '<h1>Header</h1>',
          footerContent: '<p>Footer</p>',
          footerHeight: 30
        });

      expect(pdfGen.generatePdf).toHaveBeenCalledWith(expect.objectContaining({
        requestId: 'proxy-request-123',
        htmlContent: '<p>Body</p>',
        filename: 'test.pdf',
        stylesheet: '.cls{color:red}',
        headerContent: '<h1>Header</h1>',
        footerContent: '<p>Footer</p>',
        footerHeight: 30
      }));
      expect(res.headers['x-pdf-debug-id']).toBe('proxy-request-123');
    });

    it('should sanitize and bound x-request-id before exposing it', async () => {
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake'));
      const rawRequestId = `  ../${'a'.repeat(200)}?drop=table  `;
      const expectedRequestId = serverModule._internal.sanitizeRequestDebugId(rawRequestId);
      const { app: reloadedApp } = resetServerModule();

      const res = await request(reloadedApp)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .set('x-request-id', rawRequestId)
        .send({
          htmlContent: '<p>Body</p>',
          filename: 'test.pdf'
        });

      expect(res.status).toBe(200);
      expect(res.headers['x-pdf-debug-id']).toBe(expectedRequestId);
      expect(res.headers['x-pdf-debug-id'].length).toBeLessThanOrEqual(128);
      expect(pdfGen.generatePdf).toHaveBeenCalledWith(expect.objectContaining({
        requestId: expectedRequestId
      }));
    });

    it('should return 413 when generated PDF exceeds size limit', async () => {
      process.env.PDF_MAX_OUTPUT_SIZE = '3';
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake-pdf'));
      const { app: reloadedApp } = resetServerModule();

      const res = await request(reloadedApp)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.pdf' });

      expect(res.status).toBe(413);
    });

    it('should return 500 on generation error', async () => {
      pdfGen.generatePdf.mockRejectedValue(new Error('Chrome crashed'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.pdf' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to generate PDF');
      expect(res.body.details).toBeUndefined();
      expect(res.headers['x-pdf-debug-id']).toBeTruthy();
      expect(logger.log).toHaveBeenCalledWith('error', 'Error generating PDF', expect.objectContaining({
        requestId: expect.any(String),
        filename: 'test.pdf',
        htmlLength: '<p>X</p>'.length
      }));
    });

    it('should handle non-Error PDF generation failures defensively', async () => {
      pdfGen.generatePdf.mockRejectedValueOnce(null);

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.pdf' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to generate PDF' });
    });

    it('should return 504 on timeout error', async () => {
      pdfGen.generatePdf.mockRejectedValue(new Error('Navigation timeout exceeded'));

      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.pdf' });

      expect(res.status).toBe(504);
      expect(res.body.error).toContain('timed out');
    });
  });

  describe('POST /generate-docx - validation', () => {
    it('should reject missing htmlContent', async () => {
      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ filename: 'test.docx' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('htmlContent');
    });

    it('should reject missing filename', async () => {
      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('filename');
    });

    it('should reject invalid format', async () => {
      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.docx', format: 'rtf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('format');
    });

    it('should reject oversized requests before parsing', async () => {
      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .set('Content-Type', 'application/json')
        .set('Content-Length', String(11 * 1024 * 1024))
        .send('{"htmlContent":"<p>Hello</p>","filename":"test.docx"}');

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Request body too large');
    });
  });

  describe('POST /generate-docx - DOCX generation', () => {
    it('should return DOCX buffer on success', async () => {
      const fakeDocx = Buffer.from('PK\x03\x04fake docx');
      docxGen.generateDocx.mockResolvedValue(fakeDocx);

      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.docx', format: 'docx' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('wordprocessingml.document');
      expect(res.headers['content-disposition']).toContain('.docx');
    });

    it('should default to docx format', async () => {
      docxGen.generateDocx.mockResolvedValue(Buffer.from('fake'));

      await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.docx' });

      expect(docxGen.generateDocx).toHaveBeenCalledWith(expect.objectContaining({
        format: 'docx'
      }));
    });

    it('should sanitize filename and ensure correct extension', async () => {
      docxGen.generateDocx.mockResolvedValue(Buffer.from('fake'));

      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'my doc.pdf', format: 'docx' });

      expect(res.status).toBe(200);
      expect(res.headers['content-disposition']).toContain('.docx');
    });

    it('should pass all options to generateDocx', async () => {
      docxGen.generateDocx.mockResolvedValue(Buffer.from('fake'));

      await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<p>Body</p>',
          filename: 'test.docx',
          stylesheet: '.cls{color:red}',
          headerContent: '<h1>Header</h1>',
          footerContent: '<p>Footer</p>',
          footerHeight: 25,
          format: 'docx'
        });

      expect(docxGen.generateDocx).toHaveBeenCalledWith(expect.objectContaining({
        htmlContent: '<p>Body</p>',
        stylesheet: '.cls{color:red}',
        headerContent: '<h1>Header</h1>',
        footerContent: '<p>Footer</p>',
        footerHeight: 25,
        format: 'docx'
      }));
    });

    it('should return 413 when generated DOCX exceeds size limit', async () => {
      process.env.PDF_MAX_OUTPUT_SIZE = '3';
      docxGen.generateDocx.mockResolvedValue(Buffer.from('fake-docx'));
      const { app: reloadedApp } = resetServerModule();

      const res = await request(reloadedApp)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.docx' });

      expect(res.status).toBe(413);
    });

    it('should return 500 on generation error', async () => {
      docxGen.generateDocx.mockRejectedValue(new Error('Pandoc failed'));

      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.docx' });

      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Failed to generate DOCX');
      expect(res.body.details).toBeUndefined();
    });

    it('should handle non-Error DOCX generation failures defensively', async () => {
      docxGen.generateDocx.mockRejectedValueOnce('unexpected failure');

      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.docx' });

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Failed to generate DOCX' });
    });
  });

  describe('POST /generate-docx - DOC generation', () => {
    it('should return DOC buffer when format=doc', async () => {
      const fakeDoc = Buffer.from('fake doc content');
      docxGen.generateDocx.mockResolvedValue(fakeDoc);

      const res = await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.doc', format: 'doc' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('msword');
      expect(res.headers['content-disposition']).toContain('.doc');
    });

    it('should pass format=doc to generateDocx', async () => {
      docxGen.generateDocx.mockResolvedValue(Buffer.from('fake'));

      await request(app)
        .post('/generate-docx')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>X</p>', filename: 'test.doc', format: 'doc' });

      expect(docxGen.generateDocx).toHaveBeenCalledWith(expect.objectContaining({
        format: 'doc'
      }));
    });
  });

  describe('internal helpers', () => {
    it('exposes dedicated-token resolution without compatibility fallbacks', () => {
      expect(serverModule._internal.buildGenerationFailureBody).toBeTypeOf('function');
      expect(serverModule._internal.resolvePdfServerInternalToken).toBeTypeOf('function');
      expect(serverModule._internal.resolvePdfServerInternalToken({
        configuredToken: 't'.repeat(32)
      })).toBe('t'.repeat(32));
      expect(serverModule._internal.resolvePdfServerInternalToken({
        configuredToken: ''
      })).toBe('');
    });

    it('prefers PDF_SERVER_REQUEST_TIMEOUT_MS over legacy PDF_TIMEOUT', () => {
      process.env.PDF_SERVER_REQUEST_TIMEOUT_MS = '45000';
      process.env.PDF_TIMEOUT = '15000';

      const reloadedServer = resetServerModule();

      expect(reloadedServer._internal.PDF_GENERATION_TIMEOUT).toBe(45000);
    });

    it('falls back to legacy PDF_TIMEOUT when the canonical timeout is unset', () => {
      process.env.PDF_TIMEOUT = '15000';

      const reloadedServer = resetServerModule();

      expect(reloadedServer._internal.PDF_GENERATION_TIMEOUT).toBe(15000);
    });
  });
});
