/**
 * PDF Server - Express server for PDF and DOCX generation
 * Uses Puppeteer for PDF generation, Pandoc + LibreOffice for DOCX/DOC conversion
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

// Import generators (module references for testability)
const logger = require('./lib/logger.cjs');
const pdfGen = require('./lib/pdfGenerator.cjs');
const docxGen = require('./lib/docxGenerator.cjs');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 3002;

// ============================================
// CONFIGURATION
// ============================================

const PDF_GENERATION_TIMEOUT = parseInt(process.env.PDF_TIMEOUT || '30000', 10); // 30s default
const MAX_HTML_SIZE = parseInt(process.env.PDF_MAX_HTML_SIZE || '5242880', 10); // 5MB default

// Rate limiting with automatic cleanup
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = parseInt(process.env.PDF_RATE_LIMIT || '300', 10); // 300 requests per minute (100 docs × 3 formats)
let rateLimitCleanupInterval = null;

// Periodic cleanup of rate limit entries to prevent memory leak
function startRateLimitCleanup() {
  rateLimitCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleaned = 0;
    for (const [key, data] of requestCounts.entries()) {
      if (now - data.windowStart > RATE_LIMIT_WINDOW * 2) {
        requestCounts.delete(key);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      logger.log('debug', 'Rate limit cleanup', { entriesRemoved: cleaned, remaining: requestCounts.size });
    }
  }, RATE_LIMIT_WINDOW); // Cleanup every minute
}

function stopRateLimitCleanup() {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(bodyParser.json({ limit: '10mb' }));

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
  
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW) {
      requestCounts.delete(key);
    }
  }
  
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
    logger.log('warn', 'Rate limit exceeded', { ip, count: ipData.count });
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }
  
  next();
}

// Validation middleware for PDF generation
function validatePdfRequest(req, res, next) {
  const { htmlContent, filename } = req.body;
  
  if (!htmlContent || typeof htmlContent !== 'string') {
    logger.log('warn', 'Invalid request: missing or invalid htmlContent');
    return res.status(400).json({ error: 'htmlContent is required and must be a string' });
  }
  
  if (!filename || typeof filename !== 'string') {
    logger.log('warn', 'Invalid request: missing or invalid filename');
    return res.status(400).json({ error: 'filename is required and must be a string' });
  }
  
  if (htmlContent.length > MAX_HTML_SIZE) {
    logger.log('warn', 'HTML content too large', { size: htmlContent.length, max: MAX_HTML_SIZE });
    return res.status(400).json({ error: `HTML content too large. Max size: ${MAX_HTML_SIZE} bytes` });
  }
  
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  if (!sanitizedFilename.endsWith('.pdf')) {
    req.body.filename = sanitizedFilename + '.pdf';
  } else {
    req.body.filename = sanitizedFilename;
  }
  
  next();
}

// Validation middleware for DOCX generation
function validateDocxRequest(req, res, next) {
  const { htmlContent, filename } = req.body;
  
  if (!htmlContent || typeof htmlContent !== 'string') {
    logger.log('warn', 'Invalid request: missing or invalid htmlContent');
    return res.status(400).json({ error: 'htmlContent is required and must be a string' });
  }
  
  if (!filename || typeof filename !== 'string') {
    logger.log('warn', 'Invalid request: missing or invalid filename');
    return res.status(400).json({ error: 'filename is required and must be a string' });
  }
  
  next();
}

// ============================================
// ROUTES
// ============================================

// PDF Generation endpoint
app.post('/generate-pdf', rateLimitMiddleware, validatePdfRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
  const startTime = Date.now();

  try {
    const pdfBuffer = await pdfGen.generatePdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    });

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length
    });
    res.end(pdfBuffer);
    
    const duration = Date.now() - startTime;
    logger.log('info', 'PDF generated successfully', { 
      filename, 
      duration: `${duration}ms`, 
      size: `${Math.round(pdfBuffer.length / 1024)}KB` 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.log('error', 'Error generating PDF', { 
      error: error.message, 
      filename, 
      duration: `${duration}ms`,
      stack: error.stack?.split('\n').slice(0, 3).join(' -> ')
    });
    
    if (error.message?.includes('timeout')) {
      res.status(504).json({ error: 'PDF generation timed out. Try with simpler content.' });
    } else {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
});

// DOCX/DOC Generation endpoint
app.post('/generate-docx', rateLimitMiddleware, validateDocxRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight, format } = req.body;
  const startTime = Date.now();

  try {
    const outputFormat = format === 'doc' ? 'doc' : 'docx';
    
    const docxBuffer = await docxGen.generateDocx({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      format: outputFormat
    });

    // Sanitize filename
    let sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
    const extension = docxGen.getDocExtension(outputFormat);
    
    if (!sanitizedFilename.endsWith(extension)) {
      sanitizedFilename = sanitizedFilename.replace(/\.(docx?|pdf)$/i, '') + extension;
    }

    res.set({
      'Content-Type': docxGen.getDocMimeType(outputFormat),
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
      'Content-Length': docxBuffer.length
    });
    res.end(docxBuffer);

    const duration = Date.now() - startTime;
    logger.log('info', `${outputFormat.toUpperCase()} generated successfully`, { 
      filename: sanitizedFilename, 
      duration: `${duration}ms`, 
      size: `${Math.round(docxBuffer.length / 1024)}KB` 
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.log('error', 'Error generating DOCX', { 
      error: error.message, 
      filename, 
      duration: `${duration}ms`,
      stack: error.stack?.split('\n').slice(0, 3).join(' -> ')
    });
    res.status(500).json({ error: 'Failed to generate DOCX', details: error.message });
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
    rateLimitEntries: requestCounts.size,
    config: {
      timeout: PDF_GENERATION_TIMEOUT,
      rateLimit: RATE_LIMIT_MAX,
      maxHtmlSize: MAX_HTML_SIZE
    }
  });
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'dist')));

// Catch all handler for SPA
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const gracefulShutdown = async (signal) => {
  logger.log('info', `${signal} received, shutting down gracefully`);
  
  // Stop rate limit cleanup interval
  stopRateLimitCleanup();
  
  // Clear rate limit map
  requestCounts.clear();
  
  logger.log('info', 'PDF server shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (process.platform === 'win32') {
  process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
}

process.on('disconnect', () => {
  logger.log('info', 'Parent process disconnected');
  gracefulShutdown('DISCONNECT');
});

// ============================================
// START SERVER
// ============================================

// Export app for testing (supertest)
module.exports = { app };

// Only listen when run directly (not when required by tests)
if (require.main === module) {
  app.listen(PORT, async () => {
    // Start rate limit cleanup to prevent memory leaks
    startRateLimitCleanup();
    
    logger.log('info', `PDF Server started on port ${PORT}`, {
      config: {
        pdfTimeout: PDF_GENERATION_TIMEOUT,
        rateLimit: RATE_LIMIT_MAX,
        maxHtmlSize: MAX_HTML_SIZE
      }
    });
  });
}
