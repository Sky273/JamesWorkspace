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
  
  browserLaunchPromise = puppeteer.launch({
    headless: 'new',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-software-rasterizer'
    ]
  });
  
  browserInstance = await browserLaunchPromise;
  browserLaunchPromise = null;
  
  // Handle browser disconnect
  browserInstance.on('disconnected', () => {
    browserInstance = null;
  });
  
  return browserInstance;
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
async function generatePdf({ htmlContent, stylesheet, headerContent, footerContent, footerHeight }) {
  let page = null;
  
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

    // Set content and wait for resources to load
    await page.setContent(wrappedHtmlContent, { 
      waitUntil: 'networkidle0',
      timeout: 30000
    });

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
    
    log('debug', 'PDF generated', { size: `${Math.round(pdfBuffer.length / 1024)}KB` });
    
    return pdfBuffer;
  } catch (error) {
    log('error', 'Puppeteer PDF generation failed', { error: error.message });
    throw new Error(`PDF generation failed: ${error.message}`);
  } finally {
    // Close the page but keep the browser
    if (page) {
      try {
        await page.close();
      } catch (closeError) {
        log('warn', 'Failed to close page', { error: closeError.message });
      }
    }
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
}

module.exports = { generatePdf, closeBrowser };
