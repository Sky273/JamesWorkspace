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
  }, 10000);
});
