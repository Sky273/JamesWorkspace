import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('pdfGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete require.cache[require.resolve('../../lib/pdfGenerator.cjs')];
  });

  it('retries browser launch after an initial launch failure', async () => {
    const firstError = new Error('Chrome missing');
    const fakeBrowser = {
      isConnected: vi.fn(() => true),
      on: vi.fn(),
      close: vi.fn()
    };

    const puppeteer = require('puppeteer');
    const launchSpy = vi.spyOn(puppeteer, 'launch')
      .mockRejectedValueOnce(firstError)
      .mockResolvedValueOnce(fakeBrowser);

    const pdfGenerator = require('../../lib/pdfGenerator.cjs');
    pdfGenerator._internal.resetBrowserState();

    await expect(pdfGenerator._internal.getBrowser()).rejects.toThrow('Chrome missing');
    await expect(pdfGenerator._internal.getBrowser()).resolves.toBe(fakeBrowser);
    expect(launchSpy).toHaveBeenCalledTimes(2);
  });
});
