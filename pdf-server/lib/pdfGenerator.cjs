/**
 * PDF Generator using Puppeteer/Chrome
 * Generates high-quality PDFs from HTML content
 */

const puppeteer = require('puppeteer');
const { log } = require('./logger.cjs');
const { buildPuppeteerHtml, buildPuppeteerFooter } = require('./htmlBuilder.cjs');

// Reusable browser instance for performance
let browserInstance = null;
let browserLaunchPromise = null;

const RETRIABLE_BROWSER_ERROR_PATTERNS = [
  /target closed/i,
  /session closed/i,
  /browser has disconnected/i,
  /navigating frame was detached/i,
  /execution context was destroyed/i,
  /connection closed/i,
  /protocol error/i
];

function createAbortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function shouldAllowChromiumNoSandbox() {
  return String(process.env.PDF_CHROMIUM_ALLOW_NO_SANDBOX || '').toLowerCase() === 'true';
}

function shouldAllowRequest(url) {
  return url.startsWith('about:') || url.startsWith('data:');
}

function isRetriableBrowserError(error) {
  const message = String(error?.message || '');
  return RETRIABLE_BROWSER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

async function discardBrowserInstance() {
  const browser = browserInstance;
  browserInstance = null;
  browserLaunchPromise = null;

  if (!browser) {
    return;
  }

  try {
    await browser.close();
  } catch (closeError) {
    log('warn', 'Failed to discard browser instance', { error: closeError.message });
  }
}

function removeListener(emitter, eventName, handler) {
  if (!emitter || !handler) {
    return;
  }

  if (typeof emitter.off === 'function') {
    emitter.off(eventName, handler);
    return;
  }

  if (typeof emitter.removeListener === 'function') {
    emitter.removeListener(eventName, handler);
  }
}

/**
 * Get or create a browser instance
 * @returns {Promise<Browser>} Puppeteer browser instance
 */
async function getBrowser() {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }
  
  // Prevent multiple simultaneous launches
  if (browserLaunchPromise) {
    return browserLaunchPromise;
  }
  
  const configuredExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const launchOptions = {
    headless: 'new',
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  };

  if (shouldAllowChromiumNoSandbox()) {
    launchOptions.args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  if (configuredExecutablePath) {
    launchOptions.executablePath = configuredExecutablePath;
  }

  browserLaunchPromise = (async () => {
    try {
      const browser = await puppeteer.launch(launchOptions);
      browserInstance = browser;

      // Handle browser disconnect
      browserInstance.on('disconnected', () => {
        browserInstance = null;
      });

      return browserInstance;
    } catch (error) {
      browserInstance = null;
      throw error;
    } finally {
      browserLaunchPromise = null;
    }
  })();

  return browserLaunchPromise;
}

/**
 * Generate PDF from HTML content using Puppeteer/Chrome
 * @param {Object} options - Generation options
 * @param {string} options.htmlContent - Main body HTML content
 * @param {string} options.stylesheet - Custom CSS stylesheet
 * @param {string} options.headerContent - Header HTML content
 * @param {string} options.footerContent - Footer HTML content
 * @param {number} options.footerHeight - Custom footer height in mm
 * @returns {Promise<Buffer>} PDF buffer
 */
async function generatePdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, signal } = {}) {
  async function runGenerationAttempt() {
  let page = null;
  let requestHandler = null;
  let abortHandler = null;
  let aborted = false;

  const abortError = () => {
    const reason = signal?.reason;
    if (reason instanceof Error) {
      return reason;
    }

    if (typeof reason === 'string' && reason.length > 0) {
      return createAbortError(reason);
    }

    return createAbortError('PDF generation aborted.');
  };

  const closePageOnAbort = async () => {
    aborted = true;
    if (!page) {
      return;
    }

    try {
      await page.close();
      page = null;
    } catch (closeError) {
      log('debug', 'Failed to close page during abort', { error: closeError.message });
    }
  };

  if (signal?.aborted) {
    throw abortError();
  }

  abortHandler = () => {
    void closePageOnAbort();
  };

  if (signal) {
    signal.addEventListener('abort', abortHandler, { once: true });
  }
  
  try {
    const hasFooterContent = footerContent && footerContent.trim() !== '';
    const customFooterHeight = footerHeight || 25;
    
    // Build the complete HTML document
    const wrappedHtmlContent = buildPuppeteerHtml({
      htmlContent,
      stylesheet,
      headerContent,
      footerHeight: customFooterHeight,
      hasFooter: hasFooterContent
    });
    
    log('debug', 'Puppeteer PDF generation', { 
      htmlLength: wrappedHtmlContent.length, 
      hasHeader: !!headerContent, 
      hasFooter: hasFooterContent,
      footerHeight: customFooterHeight
    });

    const browser = await getBrowser();
    page = await browser.newPage();

    if (aborted) {
      await closePageOnAbort();
      throw abortError();
    }

    await page.setRequestInterception(true);
    if (aborted) {
      await closePageOnAbort();
      throw abortError();
    }

    requestHandler = (request) => {
      const url = request.url();
      if (shouldAllowRequest(url)) {
        request.continue().catch(() => {});
        return;
      }

      request.abort('blockedbyclient').catch(() => {});
    };
    page.on('request', requestHandler);

    // Set content and wait for resources to load
    await page.setContent(wrappedHtmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    if (aborted) {
      throw abortError();
    }

    // Calculate footer height for margins
    // The margin-bottom must be at least equal to the footer height + padding
    const footerMargin = hasFooterContent ? Math.min(customFooterHeight + 15, 250) : 10;

    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      scale: 1,
      margin: {
        top: '15mm',
        right: '10mm',
        bottom: `${footerMargin}mm`,
        left: '10mm'
      },
      timeout: 30000
    };

    // Add footer using Puppeteer's native displayHeaderFooter
    if (hasFooterContent) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<span></span>'; // Empty header (we use inline header)
      pdfOptions.footerTemplate = buildPuppeteerFooter(footerContent);
    }

    const pdfBuffer = await page.pdf(pdfOptions);
    if (aborted) {
      throw abortError();
    }
    
    log('debug', 'PDF generated', { size: `${Math.round(pdfBuffer.length / 1024)}KB` });
    
    return pdfBuffer;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ABORT_ERR' || aborted) {
      throw abortError();
    }
    log('error', 'Puppeteer PDF generation failed', { error: error.message });
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    if (page && requestHandler) {
      removeListener(page, 'request', requestHandler);
    }

    // Close the page but keep the browser
    if (page) {
      try {
        await page.close();
        page = null;
      } catch (closeError) {
        log('warn', 'Failed to close page', { error: closeError.message });
      }
    }
  }
  }

  try {
    return await runGenerationAttempt();
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      throw error;
    }

    if (!isRetriableBrowserError(error)) {
      throw error;
    }

    log('warn', 'Retrying PDF generation with a fresh browser after retriable Puppeteer failure', {
      error: error.message
    });
    await discardBrowserInstance();
    return runGenerationAttempt();
  }
}

/**
 * Close the browser instance (call on server shutdown)
 */
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      browserInstance = null;
      log('info', 'Browser instance closed');
    } catch (error) {
      log('warn', 'Failed to close browser', { error: error.message });
    }
  }
  browserLaunchPromise = null;
}

module.exports = {
  generatePdf,
  closeBrowser,
  _internal: {
    getBrowser,
    shouldAllowChromiumNoSandbox,
    shouldAllowRequest,
    isRetriableBrowserError,
    resetBrowserState() {
      browserInstance = null;
      browserLaunchPromise = null;
    }
  }
};
