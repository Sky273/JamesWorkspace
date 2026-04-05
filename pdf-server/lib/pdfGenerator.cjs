/**
 * PDF Generator using Puppeteer/Chrome
 * Generates high-quality PDFs from HTML content
 */

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const { log } = require('./logger.cjs');
const { buildPuppeteerHtml, buildPuppeteerFooter, normalizePuppeteerFooterContent } = require('./htmlBuilder.cjs');

// Reusable browser instance for performance
let browserInstance = null;
let browserLaunchPromise = null;

const SANDBOX_LAUNCH_ERROR_PATTERNS = [
  /running as root without --no-sandbox/i,
  /no usable sandbox/i,
  /failed to move to new namespace/i,
  /setuid sandbox/i,
  /zygote/i,
  /sandbox/i
];

const COMMON_CHROMIUM_EXECUTABLE_PATHS = process.platform === 'linux'
  ? ['/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium']
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : process.platform === 'win32'
      ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
      ]
      : [];

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

function isSandboxLaunchError(error) {
  const message = String(error?.message || '');
  return SANDBOX_LAUNCH_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function getExecutablePathCandidates() {
  const configuredExecutablePath = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    const normalized = typeof value === 'string' ? value.trim() : '';
    const key = normalized || '<default>';
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    candidates.push(normalized || undefined);
  };

  if (configuredExecutablePath) {
    addCandidate(configuredExecutablePath);
  }

  for (const candidate of COMMON_CHROMIUM_EXECUTABLE_PATHS) {
    addCandidate(candidate);
  }

  try {
    if (typeof puppeteer.executablePath === 'function') {
      addCandidate(puppeteer.executablePath());
    }
  } catch {
    // Ignore bundled executable lookup failures and fall back to other candidates.
  }

  addCandidate(undefined);
  return candidates;
}

function buildLaunchOptions({ executablePath, allowNoSandbox }) {
  const launchOptions = {
    headless: 'new',
    args: [
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  };

  if (allowNoSandbox) {
    launchOptions.args.push('--no-sandbox', '--disable-setuid-sandbox');
  }

  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }

  return launchOptions;
}

function shouldAllowRequest(url) {
  return url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:');
}

function isRetriableBrowserError(error) {
  const message = String(error?.message || '');
  return RETRIABLE_BROWSER_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

function getPdfDebugArtifactsDir() {
  const configuredDir = String(process.env.PDF_DEBUG_ARTIFACTS_DIR || '').trim();
  return configuredDir || null;
}

function truncateValue(value, maxLength = 300) {
  const text = String(value || '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function pushLimitedEvent(events, event, limit = 8) {
  if (events.length >= limit) {
    return;
  }
  events.push(event);
}

async function writeDebugArtifacts({ requestId, wrappedHtmlContent, htmlContent, diagnostics, error, filename }) {
  const artifactsDir = getPdfDebugArtifactsDir();
  if (!artifactsDir || !requestId) {
    return null;
  }

  const targetDir = path.join(artifactsDir, requestId);
  await fs.mkdir(targetDir, { recursive: true });

  const metadata = {
    requestId,
    filename,
    error: error?.message,
    errorName: error?.name,
    errorCode: error?.code,
    diagnostics
  };

  await Promise.all([
    fs.writeFile(path.join(targetDir, 'wrapped-document.html'), wrappedHtmlContent || '', 'utf8'),
    fs.writeFile(path.join(targetDir, 'source-fragment.html'), htmlContent || '', 'utf8'),
    fs.writeFile(path.join(targetDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8')
  ]);

  return targetDir;
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
  
  const executablePathCandidates = getExecutablePathCandidates();
  const preferredNoSandbox = shouldAllowChromiumNoSandbox();

  browserLaunchPromise = (async () => {
    const launchErrors = [];

    try {
      for (const executablePath of executablePathCandidates) {
        const secureLaunchOptions = buildLaunchOptions({
          executablePath,
          allowNoSandbox: preferredNoSandbox
        });

        try {
          const browser = await puppeteer.launch(secureLaunchOptions);
          browserInstance = browser;

          browserInstance.on('disconnected', () => {
            browserInstance = null;
          });

          return browserInstance;
        } catch (error) {
          launchErrors.push({
            executablePath: executablePath || '<default>',
            allowNoSandbox: preferredNoSandbox,
            error: error.message
          });

          const canRetryWithoutSandbox = !preferredNoSandbox && isSandboxLaunchError(error);
          if (!canRetryWithoutSandbox) {
            continue;
          }

          log('warn', 'Chromium secure launch failed; retrying immediately with no-sandbox fallback', {
            executablePath: executablePath || '<default>',
            error: error.message
          });

          try {
            const browser = await puppeteer.launch(buildLaunchOptions({
              executablePath,
              allowNoSandbox: true
            }));
            browserInstance = browser;

            log('warn', 'Chromium launch recovered with no-sandbox fallback', {
              executablePath: executablePath || '<default>'
            });

            browserInstance.on('disconnected', () => {
              browserInstance = null;
            });

            return browserInstance;
          } catch (retryError) {
            launchErrors.push({
              executablePath: executablePath || '<default>',
              allowNoSandbox: true,
              error: retryError.message
            });
            continue;
          }
        }
      }

      const lastError = launchErrors.length > 0
        ? new Error(launchErrors[launchErrors.length - 1].error)
        : new Error('Unknown Chromium launch failure');
      lastError.launchAttempts = launchErrors;
      throw lastError;
    } catch (error) {
      browserInstance = null;
      log('error', 'Failed to launch Chromium for PDF generation', {
        error: error.message,
        launchAttempts: error.launchAttempts || undefined
      });
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
async function generatePdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight, signal, filename, requestId } = {}) {
  async function runGenerationAttempt(attemptNumber) {
  let page = null;
  let requestHandler = null;
  let abortHandler = null;
  let pageErrorHandler = null;
  let requestFailedHandler = null;
  let consoleHandler = null;
  let responseHandler = null;
  let aborted = false;
  let stage = 'initializing';
  let wrappedHtmlContent = '';
  let footerRenderMode = 'none';
  let normalizedFooterContent = '';
  const pageDiagnostics = {
    pageErrors: [],
    requestFailures: [],
    consoleErrors: [],
    httpFailures: []
  };

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
    normalizedFooterContent = hasFooterContent ? normalizePuppeteerFooterContent(footerContent) : '';
    footerRenderMode = hasFooterContent ? 'native-template' : 'none';
    stage = 'building-html';
    
    // Build the complete HTML document
    wrappedHtmlContent = buildPuppeteerHtml({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight: customFooterHeight,
      hasFooter: hasFooterContent
    });
    
    log('debug', 'Puppeteer PDF generation', { 
      htmlLength: wrappedHtmlContent.length, 
      hasHeader: !!headerContent, 
      hasFooter: hasFooterContent,
      footerHeight: customFooterHeight,
      footerRenderMode
    });

    const browser = await getBrowser();
    stage = 'opening-page';
    page = await browser.newPage();

    if (aborted) {
      await closePageOnAbort();
      throw abortError();
    }

    stage = 'configuring-interception';
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
    pageErrorHandler = (pageError) => {
      pushLimitedEvent(pageDiagnostics.pageErrors, {
        message: truncateValue(pageError?.message),
        stackTop: truncateValue(pageError?.stack?.split('\n').slice(0, 3).join(' -> '))
      });
    };
    requestFailedHandler = (request) => {
      pushLimitedEvent(pageDiagnostics.requestFailures, {
        url: truncateValue(request.url()),
        method: request.method?.(),
        resourceType: request.resourceType?.(),
        failureText: truncateValue(request.failure()?.errorText)
      });
    };
    consoleHandler = (message) => {
      if (message.type?.() !== 'error' && message.type?.() !== 'warning') {
        return;
      }
      pushLimitedEvent(pageDiagnostics.consoleErrors, {
        type: message.type?.(),
        text: truncateValue(message.text?.())
      });
    };
    responseHandler = (response) => {
      if (response.status() < 400) {
        return;
      }
      pushLimitedEvent(pageDiagnostics.httpFailures, {
        status: response.status(),
        url: truncateValue(response.url())
      });
    };
    page.on('pageerror', pageErrorHandler);
    page.on('requestfailed', requestFailedHandler);
    page.on('console', consoleHandler);
    page.on('response', responseHandler);

    // Set content and wait for resources to load
    stage = 'setting-content';
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
    if (normalizedFooterContent && footerRenderMode === 'native-template') {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<span></span>'; // Empty header (we use inline header)
      pdfOptions.footerTemplate = buildPuppeteerFooter(normalizedFooterContent);
    }

    stage = 'rendering-pdf';
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
    const diagnostics = {
      stage,
      requestId,
      attempt: attemptNumber,
      retriable: isRetriableBrowserError(error),
      footerRenderMode,
      htmlLength: typeof htmlContent === 'string' ? htmlContent.length : 0,
      stylesheetLength: typeof stylesheet === 'string' ? stylesheet.length : 0,
      headerLength: typeof headerContent === 'string' ? headerContent.length : 0,
      footerLength: typeof footerContent === 'string' ? footerContent.length : 0,
      normalizedFooterLength: normalizedFooterContent.length,
      wrappedHtmlLength: wrappedHtmlContent.length,
      hasFooter: Boolean(footerContent && footerContent.trim()),
      footerHeight: footerHeight || 25,
      diagnostics: pageDiagnostics
    };
    let artifactPath = null;
    try {
      artifactPath = await writeDebugArtifacts({
        requestId,
        wrappedHtmlContent,
        htmlContent,
        diagnostics,
        error,
        filename
      });
    } catch (artifactError) {
      log('warn', 'Failed to write PDF debug artifacts', {
        requestId,
        filename,
        error: artifactError.message
      });
    }
    log('error', 'Puppeteer PDF generation failed', {
      requestId,
      filename,
      attempt: attemptNumber,
      stage,
      retriable: isRetriableBrowserError(error),
      error: error.message,
      errorName: error?.name,
      errorCode: error?.code,
      footerRenderMode,
      htmlLength: diagnostics.htmlLength,
      stylesheetLength: diagnostics.stylesheetLength,
      headerLength: diagnostics.headerLength,
      footerLength: diagnostics.footerLength,
      normalizedFooterLength: diagnostics.normalizedFooterLength,
      wrappedHtmlLength: diagnostics.wrappedHtmlLength,
      hasFooter: diagnostics.hasFooter,
      footerHeight: diagnostics.footerHeight,
      pageDiagnostics,
      artifactPath,
      stackTop: error.stack?.split('\n').slice(0, 4).join(' -> ')
    });
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    if (signal && abortHandler) {
      signal.removeEventListener('abort', abortHandler);
    }

    if (page && requestHandler) {
      removeListener(page, 'request', requestHandler);
    }
    if (page && pageErrorHandler) {
      removeListener(page, 'pageerror', pageErrorHandler);
    }
    if (page && requestFailedHandler) {
      removeListener(page, 'requestfailed', requestFailedHandler);
    }
    if (page && consoleHandler) {
      removeListener(page, 'console', consoleHandler);
    }
    if (page && responseHandler) {
      removeListener(page, 'response', responseHandler);
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
    return await runGenerationAttempt(1);
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError' || error?.code === 'ABORT_ERR') {
      throw error;
    }

    log('warn', 'Retrying PDF generation with a fresh browser after first-attempt failure', {
      requestId,
      filename,
      retriable: isRetriableBrowserError(error),
      error: error.message
    });
    await discardBrowserInstance();
    return runGenerationAttempt(2);
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
    isSandboxLaunchError,
    getExecutablePathCandidates,
    shouldAllowRequest,
    isRetriableBrowserError,
    resetBrowserState() {
      browserInstance = null;
      browserLaunchPromise = null;
    }
  }
};
