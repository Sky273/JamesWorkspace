/**
 * Tests for PDF Server endpoints
 * Tests health, validation middleware, PDF and DOCX generation routes
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import request from 'supertest';

const require = createRequire(import.meta.url);

process.env.PDF_SERVER_INTERNAL_TOKEN = 'test-pdf-server-internal-token-minimum-32-chars';

const pdfGen = require('../lib/pdfGenerator.cjs');
const docxGen = require('../lib/docxGenerator.cjs');
const logger = require('../lib/logger.cjs');
const { app } = require('../server.cjs');

const origGeneratePdf = pdfGen.generatePdf;
const origCloseBrowser = pdfGen.closeBrowser;
const origGenerateDocx = docxGen.generateDocx;
const origGetDocMimeType = docxGen.getDocMimeType;
const origGetDocExtension = docxGen.getDocExtension;
const origLog = logger.log;

const resetServerModule = () => {
  delete require.cache[require.resolve('../server.cjs')];
  return require('../server.cjs').app;
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

    it('should include memory info', async () => {
      const res = await request(app).get('/health');
      expect(res.body.memory).toBeDefined();
      expect(res.body.memory.rss).toMatch(/MB$/);
      expect(res.body.memory.heapUsed).toMatch(/MB$/);
      expect(res.body.memory.heapTotal).toMatch(/MB$/);
    });

    it('should include config', async () => {
      const res = await request(app).get('/health');
      expect(res.body.config).toBeDefined();
      expect(res.body.config.timeout).toBeDefined();
      expect(res.body.config.rateLimit).toBeDefined();
      expect(res.body.config.maxHtmlSize).toBeDefined();
      expect(res.body.config.maxConcurrentJobs).toBeDefined();
      expect(res.body.config.maxOutputSize).toBeDefined();
    });
  });

  describe('POST /generate-pdf - validation', () => {
    it('should reject requests without the internal token', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf' });
      expect(res.status).toBe(403);
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

    it('should reject dangerous htmlContent', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<img src=x onerror=alert(1)>', filename: 'test.pdf' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('unsupported');
    });

    it('should reject dangerous stylesheet', async () => {
      const res = await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({ htmlContent: '<p>Hello</p>', filename: 'test.pdf', stylesheet: '@import url(https://evil.test/x.css);' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('stylesheet');
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

      await request(app)
        .post('/generate-pdf')
        .set('x-internal-service-token', process.env.PDF_SERVER_INTERNAL_TOKEN)
        .send({
          htmlContent: '<p>Body</p>',
          filename: 'test.pdf',
          stylesheet: '.cls{color:red}',
          headerContent: '<h1>Header</h1>',
          footerContent: '<p>Footer</p>',
          footerHeight: 30
        });

      expect(pdfGen.generatePdf).toHaveBeenCalledWith(expect.objectContaining({
        htmlContent: '<p>Body</p>',
        stylesheet: '.cls{color:red}',
        headerContent: '<h1>Header</h1>',
        footerContent: '<p>Footer</p>',
        footerHeight: 30
      }));
    });

    it('should return 413 when generated PDF exceeds size limit', async () => {
      process.env.PDF_MAX_OUTPUT_SIZE = '3';
      pdfGen.generatePdf.mockResolvedValue(Buffer.from('fake-pdf'));
      const reloadedApp = resetServerModule();

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
      const reloadedApp = resetServerModule();

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
});

