import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

function loadPdfGenerator() {
  delete require.cache[require.resolve('../../lib/pdfGenerator.cjs')];
  return require('../../lib/pdfGenerator.cjs');
}

describe('pdfGenerator', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    delete process.env.PDF_CHROMIUM_ALLOW_NO_SANDBOX;
    delete require.cache[require.resolve('../../lib/pdfGenerator.cjs')];
  });

  it('launches Chromium without no-sandbox by default', async () => {
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn(),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator._internal.getBrowser()).resolves.toBe(fakeBrowser);
    expect(launchSpy).toHaveBeenCalledTimes(1);
    expect(launchSpy.mock.calls[0][0].args).not.toContain('--no-sandbox');
    expect(launchSpy.mock.calls[0][0].args).toContain('--disable-dev-shm-usage');
  }, 10000);

  it('enables no-sandbox only under an explicit flag', async () => {
    process.env.PDF_CHROMIUM_ALLOW_NO_SANDBOX = 'true';

    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn(),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator._internal.getBrowser()).resolves.toBe(fakeBrowser);
    expect(launchSpy.mock.calls[0][0].args).toContain('--no-sandbox');
    expect(launchSpy.mock.calls[0][0].args).toContain('--disable-setuid-sandbox');
  }, 10000);

  it('falls back to no-sandbox when secure Chromium launch fails', async () => {
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn(),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch')
      .mockRejectedValueOnce(new Error('Running as root without --no-sandbox is not supported'))
      .mockResolvedValueOnce(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator._internal.getBrowser()).resolves.toBe(fakeBrowser);
    expect(launchSpy).toHaveBeenCalledTimes(2);
    expect(launchSpy.mock.calls[0][0].args).not.toContain('--no-sandbox');
    expect(launchSpy.mock.calls[1][0].args).toContain('--no-sandbox');
    expect(launchSpy.mock.calls[1][0].args).toContain('--disable-setuid-sandbox');
  }, 10000);

  it('does not fall back to no-sandbox for a generic launch error that merely mentions sandboxing', async () => {
    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch')
      .mockRejectedValue(new Error('Sandbox bootstrap failed because the binary is missing'));

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator._internal.getBrowser()).rejects.toThrow('Sandbox bootstrap failed because the binary is missing');
    expect(launchSpy.mock.calls.length).toBeGreaterThan(0);
    expect(
      launchSpy.mock.calls.every(([options]) => !options.args.includes('--no-sandbox')),
    ).toBe(true);
  }, 10000);

  it('blocks external resource requests during PDF generation', async () => {
    const requestHandlers = {};
    const fakePage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn((event, handler) => {
        requestHandlers[event] = handler;
      }),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake content')),
      close: vi.fn().mockResolvedValue()
    };
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '',
      footerContent: '',
      footerHeight: 25
    });

    expect(fakePage.setRequestInterception).toHaveBeenCalledWith(true);
    expect(requestHandlers.request).toBeTypeOf('function');

    const externalRequest = {
      url: () => 'https://example.com/image.png',
      continue: vi.fn().mockResolvedValue(),
      abort: vi.fn().mockResolvedValue()
    };
    await requestHandlers.request(externalRequest);
    expect(externalRequest.abort).toHaveBeenCalledWith('blockedbyclient');

    const dataRequest = {
      url: () => 'data:image/png;base64,abc',
      continue: vi.fn().mockResolvedValue(),
      abort: vi.fn().mockResolvedValue()
    };
    await requestHandlers.request(dataRequest);
    expect(dataRequest.continue).toHaveBeenCalled();

    const blobRequest = {
      url: () => 'blob:null/1234-5678',
      continue: vi.fn().mockResolvedValue(),
      abort: vi.fn().mockResolvedValue()
    };
    await requestHandlers.request(blobRequest);
    expect(blobRequest.continue).toHaveBeenCalled();
  }, 10000);

  it('retries once with a fresh browser after a retriable Puppeteer failure', async () => {
    const firstPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockRejectedValue(new Error('Target closed')),
      pdf: vi.fn(),
      close: vi.fn().mockResolvedValue()
    };
    const secondPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake content')),
      close: vi.fn().mockResolvedValue()
    };
    const firstBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(firstPage),
      close: vi.fn().mockResolvedValue()
    };
    const secondBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(secondPage),
      close: vi.fn().mockResolvedValue()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch')
      .mockResolvedValueOnce(firstBrowser)
      .mockResolvedValueOnce(secondBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '',
      footerContent: '',
      footerHeight: 25
    })).resolves.toEqual(Buffer.from('%PDF-1.4 fake content'));

    expect(launchSpy).toHaveBeenCalledTimes(2);
    expect(firstBrowser.close).toHaveBeenCalledTimes(1);
    expect(secondPage.pdf).toHaveBeenCalledTimes(1);
  }, 10000);

  it('keeps the native footer path on retry after normalizing the footer fragment', async () => {
    const firstPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockRejectedValue(new Error('Protocol error (Page.printToPDF): Printing failed')),
      close: vi.fn().mockResolvedValue()
    };
    const secondPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fallback ok')),
      close: vi.fn().mockResolvedValue()
    };
    const firstBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(firstPage),
      close: vi.fn().mockResolvedValue()
    };
    const secondBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(secondPage),
      close: vi.fn().mockResolvedValue()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch')
      .mockResolvedValueOnce(firstBrowser)
      .mockResolvedValueOnce(secondBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '<div>Header</div>',
      footerContent: '<html><head><style>.x{color:red}</style></head><body><p>Page -pageNumber- / -totalPages-</p></body></html>',
      footerHeight: 25
    })).resolves.toEqual(Buffer.from('%PDF-1.4 fallback ok'));

    expect(firstPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
      displayHeaderFooter: true
    }));
    expect(secondPage.pdf).toHaveBeenCalledWith(expect.objectContaining({
      displayHeaderFooter: true,
      footerTemplate: expect.stringContaining('<p>Page <span class="pageNumber"></span> / <span class="totalPages"></span></p>')
    }));
  }, 10000);

  it('passes the template stylesheet into the native footer template', async () => {
    const fakePage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 styled footer')),
      close: vi.fn().mockResolvedValue()
    };
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<main>Body</main>',
      stylesheet: '.cv-footer { color: #123456; font-weight: 700; }',
      headerContent: '',
      footerContent: '<footer class="cv-footer">Styled footer</footer>',
      footerHeight: 25
    })).resolves.toEqual(Buffer.from('%PDF-1.4 styled footer'));

    expect(fakePage.pdf).toHaveBeenCalledWith(expect.objectContaining({
      displayHeaderFooter: true,
      footerTemplate: expect.stringContaining('.cv-footer { color: #123456; font-weight: 700; }')
    }));
  }, 10000);

  it('uses footerHeight directly as the reserved bottom margin for body content', async () => {
    const fakePage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 reserved footer space')),
      close: vi.fn().mockResolvedValue()
    };
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<main>Body</main>',
      stylesheet: '',
      headerContent: '',
      footerContent: '<footer>Footer</footer>',
      footerHeight: 80
    })).resolves.toEqual(Buffer.from('%PDF-1.4 reserved footer space'));

    expect(fakePage.pdf).toHaveBeenCalledWith(expect.objectContaining({
      margin: expect.objectContaining({
        bottom: '80mm'
      })
    }));
  }, 10000);

  it('logs advanced page diagnostics when Puppeteer fails', async () => {
    const logger = require('../../lib/logger.cjs');
    const logSpy = vi.spyOn(logger, 'log').mockImplementation(() => {});
    const pageHandlers = {};
    const fakePage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn((event, handler) => {
        pageHandlers[event] = handler;
      }),
      setContent: vi.fn().mockImplementation(async () => {
        pageHandlers.console?.({
          type: () => 'error',
          text: () => 'Failed to load font'
        });
        pageHandlers.pageerror?.(new Error('ReferenceError: foo is not defined'));
        pageHandlers.requestfailed?.({
          url: () => 'https://blocked.example/font.woff2',
          method: () => 'GET',
          resourceType: () => 'font',
          failure: () => ({ errorText: 'net::ERR_BLOCKED_BY_CLIENT' })
        });
        pageHandlers.response?.({
          status: () => 404,
          url: () => 'data:text/plain,missing'
        });
        throw new Error('Renderer exploded');
      }),
      pdf: vi.fn(),
      close: vi.fn().mockResolvedValue()
    };
    const secondPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockRejectedValue(new Error('Still broken')),
      pdf: vi.fn(),
      close: vi.fn().mockResolvedValue()
    };
    const firstBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn().mockResolvedValue()
    };
    const secondBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(secondPage),
      close: vi.fn().mockResolvedValue()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch')
      .mockResolvedValueOnce(firstBrowser)
      .mockResolvedValueOnce(secondBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '',
      footerContent: '',
      footerHeight: 25,
      requestId: 'req-123'
    })).rejects.toThrow('PDF generation failed');

    expect(logSpy).toHaveBeenCalledWith('error', 'Puppeteer PDF generation failed', expect.objectContaining({
      requestId: 'req-123',
      pageDiagnostics: expect.objectContaining({
        consoleErrors: [expect.objectContaining({ text: 'Failed to load font' })],
        pageErrors: [expect.objectContaining({ message: 'ReferenceError: foo is not defined' })],
        requestFailures: [expect.objectContaining({ resourceType: 'font' })],
        httpFailures: [expect.objectContaining({ status: 404 })]
      })
    }));
  }, 10000);

  it('sanitizes debug artifact directories derived from request ids', () => {
    const pdfGenerator = loadPdfGenerator();
    expect(pdfGenerator._internal.sanitizeArtifactPathSegment('../unsafe/req-123')).toBe('unsafe_req-123');
    expect(pdfGenerator._internal.sanitizeArtifactPathSegment('')).toBe('request');
  });

  it('preserves the original failure as error cause when PDF rendering fails', async () => {
    const rootCause = new Error('Protocol error (Page.printToPDF): Rendering failed');
    const fakePage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockRejectedValue(rootCause),
      close: vi.fn().mockResolvedValue()
    };
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(fakePage),
      close: vi.fn().mockResolvedValue()
    };

    const puppeteer = require('puppeteer');
    vi.spyOn(puppeteer, 'launch').mockResolvedValue(fakeBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '',
      footerContent: '',
      footerHeight: 25
    })).rejects.toMatchObject({
      message: expect.stringContaining('PDF generation failed:'),
      cause: rootCause
    });
  }, 10000);

  it('retries once with a fresh browser even for an unclassified first-attempt failure', async () => {
    const firstPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockRejectedValue(new Error('Renderer hiccup')),
      pdf: vi.fn(),
      close: vi.fn().mockResolvedValue()
    };
    const secondPage = {
      setRequestInterception: vi.fn().mockResolvedValue(),
      on: vi.fn(),
      setContent: vi.fn().mockResolvedValue(),
      pdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 recovered')),
      close: vi.fn().mockResolvedValue()
    };
    const firstBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(firstPage),
      close: vi.fn().mockResolvedValue()
    };
    const secondBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      newPage: vi.fn().mockResolvedValue(secondPage),
      close: vi.fn().mockResolvedValue()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch')
      .mockResolvedValueOnce(firstBrowser)
      .mockResolvedValueOnce(secondBrowser);

    const pdfGenerator = loadPdfGenerator();
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator.generatePdf({
      htmlContent: '<p>Hello</p>',
      stylesheet: '',
      headerContent: '',
      footerContent: '',
      footerHeight: 25
    })).resolves.toEqual(Buffer.from('%PDF-1.4 recovered'));

    expect(launchSpy).toHaveBeenCalledTimes(2);
    expect(firstBrowser.close).toHaveBeenCalledTimes(1);
    expect(secondPage.pdf).toHaveBeenCalledTimes(1);
  }, 10000);
});
