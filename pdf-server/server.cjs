/**
 * PDF Server - Express server for PDF and DOCX generation
 * Uses Puppeteer for PDF generation, Pandoc + LibreOffice for DOCX/DOC conversion
 */

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const logger = require('./lib/logger.cjs');
const pdfGen = require('./lib/pdfGenerator.cjs');
const docxGen = require('./lib/docxGenerator.cjs');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 3002;

const PDF_GENERATION_TIMEOUT = parseInt(process.env.PDF_TIMEOUT || '30000', 10);
const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';
const DEV_TEST_FALLBACK_TOKEN = 'dev-test-pdf-server-internal-token-32chars';
const DERIVATION_SALT = 'resumeconverter-pdf-server-internal-token-v1';
const isProduction = process.env.NODE_ENV === 'production';
const configuredPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN || '';

function deriveProductionFallbackToken() {
  const jwtSecret = process.env.JWT_SECRET || '';
  const csrfSecret = process.env.CSRF_SECRET || '';

  if (jwtSecret.length < 32 || csrfSecret.length < 32) {
    return '';
  }

  return Buffer.from(`${jwtSecret}:${csrfSecret}:${DERIVATION_SALT}`).toString('base64url').slice(0, 48);
}

const PDF_SERVER_INTERNAL_TOKEN = configuredPdfToken.length >= 32
  ? configuredPdfToken
  : (!isProduction ? DEV_TEST_FALLBACK_TOKEN : deriveProductionFallbackToken());
const MAX_HTML_SIZE = parseInt(process.env.PDF_MAX_HTML_SIZE || '5242880', 10);
const MAX_STYLESHEET_SIZE = parseInt(process.env.PDF_MAX_STYLESHEET_SIZE || '262144', 10);
const MAX_FRAGMENT_SIZE = parseInt(process.env.PDF_MAX_FRAGMENT_SIZE || '524288', 10);
const MAX_OUTPUT_SIZE = parseInt(process.env.PDF_MAX_OUTPUT_SIZE || '20971520', 10);
const MAX_ACTIVE_JOBS = parseInt(process.env.PDF_MAX_CONCURRENT || '4', 10);
const MIN_FOOTER_HEIGHT = 10;
const MAX_FOOTER_HEIGHT = 120;

const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = parseInt(process.env.PDF_RATE_LIMIT || '300', 10);
let rateLimitCleanupInterval = null;
let activeGenerationJobs = 0;

const DANGEROUS_HTML_PATTERNS = [
  /<script\b/i,
  /<iframe\b/i,
  /<object\b/i,
  /<embed\b/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /\bon[a-z]+\s*=/i
];

const DANGEROUS_CSS_PATTERNS = [
  /@import/i,
  /javascript\s*:/i,
  /expression\s*\(/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /url\s*\(\s*['"]?\s*(?!data:)/i
];

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
  }, RATE_LIMIT_WINDOW);
}

function stopRateLimitCleanup() {
  if (rateLimitCleanupInterval) {
    clearInterval(rateLimitCleanupInterval);
    rateLimitCleanupInterval = null;
  }
}

app.use(bodyParser.json({ limit: '10mb' }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3001')
  .split(',')
  .map(s => s.trim());
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

function sanitizeFilename(filename, extension) {
  const baseName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  if (baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }
  return baseName.replace(/\.(docx?|pdf)$/i, '') + extension;
}

function containsDangerousPattern(content, patterns) {
  if (!content) return false;
  return patterns.some(pattern => pattern.test(content));
}

function validateOptionalStringField(value, fieldName, maxSize, patterns, res) {
  if (value === undefined || value === null || value === '') {
    return true;
  }

  if (typeof value !== 'string') {
    logger.log('warn', 'Invalid request field type', { fieldName });
    res.status(400).json({ error: `${fieldName} must be a string when provided` });
    return false;
  }

  if (value.length > maxSize) {
    logger.log('warn', 'Request field too large', { fieldName, size: value.length, maxSize });
    res.status(400).json({ error: `${fieldName} too large` });
    return false;
  }

  if (patterns && containsDangerousPattern(value, patterns)) {
    logger.log('warn', 'Dangerous content rejected', { fieldName });
    res.status(400).json({ error: `${fieldName} contains unsupported content` });
    return false;
  }

  return true;
}

function normalizeFooterHeight(rawHeight) {
  if (rawHeight === undefined || rawHeight === null || rawHeight === '') {
    return 25;
  }

  const parsed = Number(rawHeight);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.min(Math.max(Math.round(parsed), MIN_FOOTER_HEIGHT), MAX_FOOTER_HEIGHT);
}

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

function generationCapacityMiddleware(req, res, next) {
  if (activeGenerationJobs >= MAX_ACTIVE_JOBS) {
    logger.log('warn', 'Generation concurrency limit reached', {
      activeGenerationJobs,
      maxActiveJobs: MAX_ACTIVE_JOBS,
      path: req.path
    });
    return res.status(503).json({ error: 'Generation server is busy. Please retry shortly.' });
  }

  next();
}

function internalServiceAuthMiddleware(req, res, next) {
  if (!PDF_SERVER_INTERNAL_TOKEN) {
    logger.log('warn', 'PDF server internal token missing; rejecting protected request');
    return res.status(503).json({ error: 'PDF server is not configured for internal authentication.' });
  }

  const providedToken = req.get(PDF_SERVER_AUTH_HEADER);
  if (providedToken !== PDF_SERVER_INTERNAL_TOKEN) {
    logger.log('warn', 'Invalid internal service token', { path: req.path });
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}

function requestTimeoutMiddleware(req, res, next) {
  res.setTimeout(PDF_GENERATION_TIMEOUT + 5000, () => {
    logger.log('warn', 'Request timed out at HTTP layer', { path: req.path });
    if (!res.headersSent) {
      res.status(504).json({ error: 'Document generation timed out.' });
    }
  });
  next();
}

function validateDocumentRequest(req, res, next) {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body || {};

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

  if (containsDangerousPattern(htmlContent, DANGEROUS_HTML_PATTERNS)) {
    logger.log('warn', 'Dangerous htmlContent rejected');
    return res.status(400).json({ error: 'htmlContent contains unsupported content' });
  }

  if (!validateOptionalStringField(stylesheet, 'stylesheet', MAX_STYLESHEET_SIZE, DANGEROUS_CSS_PATTERNS, res)) {
    return;
  }

  if (!validateOptionalStringField(headerContent, 'headerContent', MAX_FRAGMENT_SIZE, DANGEROUS_HTML_PATTERNS, res)) {
    return;
  }

  if (!validateOptionalStringField(footerContent, 'footerContent', MAX_FRAGMENT_SIZE, DANGEROUS_HTML_PATTERNS, res)) {
    return;
  }

  const normalizedFooterHeight = normalizeFooterHeight(footerHeight);
  if (normalizedFooterHeight === null) {
    logger.log('warn', 'Invalid footerHeight');
    return res.status(400).json({ error: 'footerHeight must be a finite number' });
  }

  req.body.footerHeight = normalizedFooterHeight;
  next();
}

function validatePdfRequest(req, res, next) {
  validateDocumentRequest(req, res, () => {
    req.body.filename = sanitizeFilename(req.body.filename, '.pdf');
    next();
  });
}

function validateDocxRequest(req, res, next) {
  validateDocumentRequest(req, res, () => {
    const { format } = req.body;
    if (format !== undefined && format !== 'doc' && format !== 'docx') {
      logger.log('warn', 'Invalid document format', { format });
      return res.status(400).json({ error: 'format must be either doc or docx' });
    }

    req.body.filename = sanitizeFilename(req.body.filename, format === 'doc' ? '.doc' : '.docx');
    next();
  });
}

async function withGenerationSlot(fn) {
  activeGenerationJobs += 1;
  try {
    return await fn();
  } finally {
    activeGenerationJobs = Math.max(0, activeGenerationJobs - 1);
  }
}

function ensureOutputWithinLimit(buffer, formatLabel) {
  if (buffer.length > MAX_OUTPUT_SIZE) {
    const error = new Error(`${formatLabel} output too large`);
    error.code = 'OUTPUT_TOO_LARGE';
    throw error;
  }
}

app.post('/generate-pdf', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validatePdfRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
  const startTime = Date.now();

  try {
    const pdfBuffer = await withGenerationSlot(() => pdfGen.generatePdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight
    }));

    ensureOutputWithinLimit(pdfBuffer, 'PDF');

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

    if (error.code === 'OUTPUT_TOO_LARGE') {
      res.status(413).json({ error: 'Generated PDF too large.' });
    } else if (error.message?.toLowerCase().includes('timeout')) {
      res.status(504).json({ error: 'PDF generation timed out. Try with simpler content.' });
    } else {
      res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
  }
});

app.post('/generate-docx', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validateDocxRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight, format } = req.body;
  const startTime = Date.now();

  try {
    const outputFormat = format === 'doc' ? 'doc' : 'docx';

    const docxBuffer = await withGenerationSlot(() => docxGen.generateDocx({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      format: outputFormat
    }));

    ensureOutputWithinLimit(docxBuffer, outputFormat.toUpperCase());

    const sanitizedFilename = sanitizeFilename(filename, docxGen.getDocExtension(outputFormat));

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

    if (error.code === 'OUTPUT_TOO_LARGE') {
      res.status(413).json({ error: 'Generated document too large.' });
    } else if (error.message?.toLowerCase().includes('timeout')) {
      res.status(504).json({ error: 'Document generation timed out. Try with simpler content.' });
    } else {
      res.status(500).json({ error: 'Failed to generate DOCX', details: error.message });
    }
  }
});

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
    activeGenerationJobs,
    config: {
      timeout: PDF_GENERATION_TIMEOUT,
      rateLimit: RATE_LIMIT_MAX,
      maxHtmlSize: MAX_HTML_SIZE,
      maxStylesheetSize: MAX_STYLESHEET_SIZE,
      maxFragmentSize: MAX_FRAGMENT_SIZE,
      maxOutputSize: MAX_OUTPUT_SIZE,
      maxConcurrentJobs: MAX_ACTIVE_JOBS
    }
  });
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const gracefulShutdown = async (signal) => {
  logger.log('info', `${signal} received, shutting down gracefully`);
  stopRateLimitCleanup();
  requestCounts.clear();
  try {
    await pdfGen.closeBrowser?.();
  } catch (error) {
    logger.log('warn', 'Failed to close browser during shutdown', { error: error.message });
  }
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

module.exports = { app };

if (require.main === module) {
  if (!PDF_SERVER_INTERNAL_TOKEN || PDF_SERVER_INTERNAL_TOKEN.length < 32) {
    throw new Error('CRITICAL: PDF_SERVER_INTERNAL_TOKEN must be set and at least 32 characters long, or derivable from valid JWT_SECRET and CSRF_SECRET.');
  }

  if (!configuredPdfToken) {
    process.env.PDF_SERVER_INTERNAL_TOKEN = PDF_SERVER_INTERNAL_TOKEN;
    logger.log(
      'warn',
      isProduction
        ? 'PDF_SERVER_INTERNAL_TOKEN missing; using compatibility fallback derived from JWT_SECRET and CSRF_SECRET'
        : 'PDF_SERVER_INTERNAL_TOKEN missing; using development/test fallback token'
    );
  }

  app.listen(PORT, async () => {
    startRateLimitCleanup();
    logger.log('info', `PDF Server started on port ${PORT}`, {
      config: {
        pdfTimeout: PDF_GENERATION_TIMEOUT,
        rateLimit: RATE_LIMIT_MAX,
        maxHtmlSize: MAX_HTML_SIZE,
        maxStylesheetSize: MAX_STYLESHEET_SIZE,
        maxFragmentSize: MAX_FRAGMENT_SIZE,
        maxOutputSize: MAX_OUTPUT_SIZE,
        maxConcurrentJobs: MAX_ACTIVE_JOBS
      }
    });
  });
}
