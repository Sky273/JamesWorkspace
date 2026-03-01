const express = require('express');
const puppeteer = require('puppeteer');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 3002;

// ============================================
// LOGGING UTILITY
// ============================================

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CONFIGURED_LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const CONFIGURED_LOG_LEVEL_NUM = LOG_LEVELS[CONFIGURED_LOG_LEVEL] ?? LOG_LEVELS.info;

function log(level, message, data = null) {
    if (LOG_LEVELS[level] > CONFIGURED_LOG_LEVEL_NUM) return;
    
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const prefix = `${timestamp} [${level.toUpperCase().padEnd(5)}] [pdf-server]`;
    
    const logFn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    
    if (data) {
        logFn(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
    } else {
        logFn(`${prefix} ${message}`);
    }
}

// ============================================
// CONFIGURATION
// ============================================

// Browser instance for reuse
let browserInstance = null;
let browserPageCount = 0;
const MAX_PAGES_BEFORE_RESTART = parseInt(process.env.PDF_MAX_PAGES || '50', 10);
const BROWSER_IDLE_TIMEOUT = parseInt(process.env.PDF_IDLE_TIMEOUT || '300000', 10); // 5 min default
const PDF_GENERATION_TIMEOUT = parseInt(process.env.PDF_TIMEOUT || '30000', 10); // 30s default
const MAX_HTML_SIZE = parseInt(process.env.PDF_MAX_HTML_SIZE || '5242880', 10); // 5MB default
let browserIdleTimer = null;

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.PDF_RATE_LIMIT || '30', 10); // 30 requests per minute

// Get or create browser instance
async function getBrowser() {
  // Clear idle timer since we're using the browser
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
    browserIdleTimer = null;
  }
  
  // Restart browser if page count exceeds limit (prevents memory accumulation)
  if (browserInstance && browserPageCount >= MAX_PAGES_BEFORE_RESTART) {
    log('info', `Restarting browser after ${browserPageCount} pages to free memory`);
    await closeBrowser();
  }
  
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--safebrowsing-disable-auto-update',
        '--js-flags=--max-old-space-size=256' // Limit Chrome memory
      ]
    });
    browserPageCount = 0;
    log('info', 'Browser instance created');
  }
  return browserInstance;
}

// Close browser instance
async function closeBrowser() {
  if (browserInstance) {
    try {
      await browserInstance.close();
      log('info', 'Browser instance closed');
    } catch (err) {
      log('error', 'Error closing browser', { error: err.message });
    }
    browserInstance = null;
    browserPageCount = 0;
  }
}

// Schedule browser close after idle timeout
function scheduleBrowserClose() {
  if (browserIdleTimer) {
    clearTimeout(browserIdleTimer);
  }
  browserIdleTimer = setTimeout(async () => {
    log('info', 'Browser idle timeout - closing to free memory');
    await closeBrowser();
  }, BROWSER_IDLE_TIMEOUT);
}

// Middleware to parse JSON requests
app.use(bodyParser.json({ limit: '10mb' }));

// CORS configuration - use environment variable or defaults
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001').split(',').map(s => s.trim());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

// Rate limiting middleware
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  // Clean old entries
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key);
    }
  }
  
  // Check rate limit
  let ipData = requestCounts.get(ip);
  if (!ipData) {
    ipData = { count: 0, windowStart: now };
    requestCounts.set(ip, ipData);
  }
  
  if (now - ipData.windowStart > RATE_LIMIT_WINDOW) {
    ipData.count = 0;
    ipData.windowStart = now;
  }
  
  ipData.count++;
  
  if (ipData.count > RATE_LIMIT_MAX) {
    log('warn', 'Rate limit exceeded', { ip, count: ipData.count });
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  next();
}

// Validation middleware for PDF generation
function validatePdfRequest(req, res, next) {
  const { htmlContent, filename } = req.body;
  
  // Check required fields
  if (!htmlContent || typeof htmlContent !== 'string') {
    log('warn', 'Invalid request: missing or invalid htmlContent');
    return res.status(400).json({ error: 'htmlContent is required and must be a string' });
  }
  
  if (!filename || typeof filename !== 'string') {
    log('warn', 'Invalid request: missing or invalid filename');
    return res.status(400).json({ error: 'filename is required and must be a string' });
  }
  
  // Check size limits
  if (htmlContent.length > MAX_HTML_SIZE) {
    log('warn', 'HTML content too large', { size: htmlContent.length, max: MAX_HTML_SIZE });
    return res.status(400).json({ error: `HTML content too large. Max size: ${MAX_HTML_SIZE} bytes` });
  }
  
  // Sanitize filename (prevent path traversal)
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  if (!sanitizedFilename.endsWith('.pdf')) {
    req.body.filename = sanitizedFilename + '.pdf';
  } else {
    req.body.filename = sanitizedFilename;
  }
  
  next();
}

// Endpoint to generate PDF from HTML content
app.post('/generate-pdf', rateLimitMiddleware, validatePdfRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight: customFooterHeight } = req.body;
  const startTime = Date.now();

  let page = null;
  let timeoutId = null;
  try {
    const styleTag = stylesheet && stylesheet.trim() !== '' ? `<style>${stylesheet}</style>` : '';
    
    // Build the main body content with header integrated (header only on first page approach)
    // Footer will use Puppeteer's native footer for proper page handling
    const headerSection = headerContent ? `<header class="pdf-header">${headerContent}</header>` : '';
    
    // Check if footer exists early for body padding calculation
    const hasFooterContent = footerContent && footerContent.trim() !== '';
    // Calculate footer height for body padding (to prevent overlap)
    // Add 20mm extra padding to ensure content doesn't reach the footer zone
    const bodyPaddingBottom = hasFooterContent ? Math.min((customFooterHeight || 25) + 20, 250) : 0;
    
    const layoutStyles = `
      <style>
        @page {
          margin-bottom: ${bodyPaddingBottom}mm;
        }
        html, body {
          margin: 0;
          padding: 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        .pdf-header {
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .pdf-body {
          /* Content will respect @page margin */
        }
      </style>
    `;
    
    const wrappedHtmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  ${styleTag}
  ${layoutStyles}
</head>
<body>
  ${headerSection}
  <main class="pdf-body">${htmlContent}</main>
</body>
</html>`;

    const browser = await getBrowser();
    page = await browser.newPage();
    
    await page.setContent(wrappedHtmlContent, { waitUntil: 'networkidle0' });
    
    // Use custom footer height from template, or default
    // A4 page is 297mm tall, so max footer height must leave room for content (top margin 15mm + min content area)
    // Max safe footer height: 297 - 15 (top) - 30 (min content) = 252mm, rounded to 250mm
    // Reuse hasFooterContent from above
    const hasFooter = hasFooterContent;
    // The margin-bottom must be at least equal to the footer height
    // Add 15mm extra to ensure content doesn't overlap
    const footerHeight = hasFooter ? Math.min((customFooterHeight || 25) + 15, 250) : 10; // mm
    log('debug', 'PDF generation params', { footerHeight, customFooterHeight, bodyPaddingBottom });
    
    const pdfOptions = {
      format: 'A4',
      printBackground: true,
      scale: 1,
      margin: { 
        top: '15mm', 
        right: '10mm', 
        bottom: `${footerHeight}mm`, 
        left: '10mm' 
      }
    };
    
    // Add footer using Puppeteer's native displayHeaderFooter
    if (hasFooter) {
      pdfOptions.displayHeaderFooter = true;
      pdfOptions.headerTemplate = '<span></span>'; // Empty header (we use inline header)
      // Puppeteer footer needs -webkit-print-color-adjust for backgrounds to render
      // Also convert hr with inline background-color to div for better PDF rendering
      let processedFooter = footerContent
        .replace(/<hr([^>]*?)style="([^"]*?)height:\s*(\d+)px;?\s*([^"]*?)background-color:\s*([^;"]+);?([^"]*?)"([^>]*?)>/gi, 
          '<div style="height: $3px; background-color: $5; $2$4$6 -webkit-print-color-adjust: exact; print-color-adjust: exact;"></div>');
      
      // Replace page number placeholders with Puppeteer's special classes
      processedFooter = processedFooter
        .replace(/-pageNumber-/gi, '<span class="pageNumber"></span>')
        .replace(/-totalPages-/gi, '<span class="totalPages"></span>');
      
      pdfOptions.footerTemplate = `
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; margin: 0; padding: 0; }
        </style>
        <div style="width: 100%; font-size: 8px; padding: 2mm 10mm; box-sizing: border-box; -webkit-print-color-adjust: exact; line-height: 1.2;">
          ${processedFooter}
        </div>
      `;
    }
    
    const pdfBuffer = await page.pdf(pdfOptions);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
    
    const duration = Date.now() - startTime;
    log('info', 'PDF generated successfully', { filename, duration: `${duration}ms`, size: `${Math.round(pdfBuffer.length / 1024)}KB` });
  } catch (error) {
    const duration = Date.now() - startTime;
    log('error', 'Error generating PDF', { 
      error: error.message, 
      filename, 
      duration: `${duration}ms`,
      stack: error.stack?.split('\n').slice(0, 3).join(' -> ')
    });
    
    // Send appropriate error response
    if (error.message?.includes('timeout')) {
      res.status(504).json({ error: 'PDF generation timed out. Try with simpler content.' });
    } else if (error.message?.includes('Protocol error')) {
      res.status(503).json({ error: 'PDF service temporarily unavailable. Please retry.' });
    } else {
      res.status(500).json({ error: 'Failed to generate PDF' });
    }
  } finally {
    // Clear timeout if set
    if (timeoutId) clearTimeout(timeoutId);
    
    if (page) {
      await page.close().catch(() => {});
      browserPageCount++;
      // Schedule browser close after idle period
      scheduleBrowserClose();
    }
  }
});

// Health/monitoring endpoint
app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  
  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    browser: {
      active: !!browserInstance,
      pageCount: browserPageCount,
      maxBeforeRestart: MAX_PAGES_BEFORE_RESTART
    },
    config: {
      timeout: PDF_GENERATION_TIMEOUT,
      rateLimit: RATE_LIMIT_MAX,
      maxHtmlSize: MAX_HTML_SIZE
    }
  });
});

// Serve static files from the React app (Vite uses 'dist' folder)
app.use(express.static(path.join(__dirname, 'dist')));

// Catch all handler for any requests that don't match the above
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  log('info', `${signal} received, shutting down gracefully`);
  await closeBrowser();
  log('info', 'PDF server shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Windows-specific: handle SIGBREAK
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

// Handle when parent process disconnects (IPC channel closed)
process.on('disconnect', () => {
  log('info', 'Parent process disconnected');
  gracefulShutdown('DISCONNECT');
});

app.listen(PORT, async () => {
  // Clean browser cache on startup
  log('info', 'Cleaning PDF server cache on startup...');
  try {
    if (browserInstance) {
      await closeBrowser();
      log('info', 'Browser cache cleaned successfully');
    }
  } catch (error) {
    log('error', 'Error cleaning browser cache on startup', { error: error.message });
  }
  
  log('info', `PDF Server started on port ${PORT}`, {
    config: {
      maxPages: MAX_PAGES_BEFORE_RESTART,
      idleTimeout: BROWSER_IDLE_TIMEOUT,
      pdfTimeout: PDF_GENERATION_TIMEOUT,
      rateLimit: RATE_LIMIT_MAX
    }
  });
});
