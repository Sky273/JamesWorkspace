/**
 * PDF Server - Express server for PDF and DOCX generation
 * Uses Puppeteer for PDF generation, Pandoc + LibreOffice for DOCX/DOC conversion
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { randomUUID } = require('crypto');

const logger = require('./lib/logger.cjs');
const pdfGen = require('./lib/pdfGenerator.cjs');
const docxGen = require('./lib/docxGenerator.cjs');
const { registerFrontendRoutes } = require('./lib/frontendRoutes.cjs');
const {
  buildGenerationFailureBody,
  createRequestCoordinator,
  resolvePdfServerInternalToken
} = require('./lib/requestGuards.cjs');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 3002;
const DIST_DIR = path.join(__dirname, 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');

function parsePositiveIntegerEnvValue(value) {
  const parsed = parseInt(value || '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

const PDF_GENERATION_TIMEOUT = parsePositiveIntegerEnvValue(process.env.PDF_SERVER_REQUEST_TIMEOUT_MS)
  || parsePositiveIntegerEnvValue(process.env.PDF_TIMEOUT)
  || 30000;
const isProduction = process.env.NODE_ENV === 'production';
const configuredPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN || '';
const PDF_SERVER_INTERNAL_TOKEN = resolvePdfServerInternalToken({
  configuredToken: configuredPdfToken
});
const MAX_HTML_SIZE = parseInt(process.env.PDF_MAX_HTML_SIZE || '5242880', 10);
const MAX_STYLESHEET_SIZE = parseInt(process.env.PDF_MAX_STYLESHEET_SIZE || '262144', 10);
const MAX_FRAGMENT_SIZE = parseInt(process.env.PDF_MAX_FRAGMENT_SIZE || '524288', 10);
const MAX_OUTPUT_SIZE = parseInt(process.env.PDF_MAX_OUTPUT_SIZE || '20971520', 10);
const MAX_ACTIVE_JOBS = parseInt(process.env.PDF_MAX_CONCURRENT || '4', 10);
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = parseInt(process.env.PDF_RATE_LIMIT || '300', 10);
const HEALTH_VERBOSE = String(process.env.PDF_SERVER_HEALTH_VERBOSE || '').toLowerCase() === 'true';
const parsedMaxRequestBodyBytes = parseInt(
  process.env.PDF_MAX_REQUEST_BODY_BYTES || `${MAX_HTML_SIZE + MAX_STYLESHEET_SIZE + (2 * MAX_FRAGMENT_SIZE) + (256 * 1024)}`,
  10
);
const MAX_REQUEST_BODY_BYTES = Number.isInteger(parsedMaxRequestBodyBytes) && parsedMaxRequestBodyBytes > 0
  ? parsedMaxRequestBodyBytes
  : 10485760;
const METHODS_WITH_BODIES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

app.use((req, res, next) => {
  if (!METHODS_WITH_BODIES.has(req.method)) {
    return next();
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return next();
  }

  const contentLengthHeader = req.headers['content-length'];
  if (!contentLengthHeader) {
    return next();
  }

  const contentLength = parseInt(contentLengthHeader, 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BODY_BYTES) {
    logger.log('warn', 'Request body rejected before parsing', {
      path: req.path,
      method: req.method,
      contentLength,
      maxRequestBodyBytes: MAX_REQUEST_BODY_BYTES
    });
    return res.status(413).json({ error: 'Request body too large' });
  }

  next();
});

app.use(bodyParser.json({ limit: `${MAX_REQUEST_BODY_BYTES}b` }));

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
const requestCoordinator = createRequestCoordinator({
  logger,
  pdfServerInternalToken: PDF_SERVER_INTERNAL_TOKEN,
  pdfGenerationTimeout: PDF_GENERATION_TIMEOUT,
  rateLimitMax: RATE_LIMIT_MAX,
  maxActiveJobs: MAX_ACTIVE_JOBS,
  maxHtmlSize: MAX_HTML_SIZE,
  maxStylesheetSize: MAX_STYLESHEET_SIZE,
  maxFragmentSize: MAX_FRAGMENT_SIZE,
  rateLimitWindow: RATE_LIMIT_WINDOW
});
const {
  generationCapacityMiddleware,
  internalServiceAuthMiddleware,
  rateLimitMiddleware,
  requestTimeoutMiddleware,
  validateDocxRequest,
  validatePdfRequest
} = requestCoordinator.middlewares;

function ensureOutputWithinLimit(buffer, formatLabel) {
  if (buffer.length > MAX_OUTPUT_SIZE) {
    const error = new Error(`${formatLabel} output too large`);
    error.code = 'OUTPUT_TOO_LARGE';
    throw error;
  }
}

function isAbortError(error) {
  return error?.name === 'AbortError' || error?.code === 'ABORT_ERR';
}

function isClientDisconnectAbort(signal) {
  const reason = signal?.reason;
  const message = String(reason?.message || '').toLowerCase();
  return message.includes('client disconnected') || message.includes('client aborted');
}

function isTimeoutAbort(signal, error) {
  const reason = signal?.reason;
  const message = reason?.message || error?.message || '';
  return message.toLowerCase().includes('timed out');
}

function normalizeThrownError(error) {
  if (error instanceof Error) {
    return error;
  }

  const normalized = new Error(typeof error === 'string' ? error : 'Unknown error');
  normalized.originalError = error;
  return normalized;
}

function sanitizeRequestDebugId(value) {
  const text = String(value || '').trim();
  if (!text) {
    return randomUUID();
  }

  const sanitized = text
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_./-]+|[_./-]+$/g, '');
  const bounded = sanitized.slice(0, 128);
  return bounded || randomUUID();
}

function getRequestDebugId(req) {
  const headerValue = req.headers['x-request-id'];
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return sanitizeRequestDebugId(headerValue);
  }
  if (Array.isArray(headerValue) && typeof headerValue[0] === 'string' && headerValue[0].trim()) {
    return sanitizeRequestDebugId(headerValue[0]);
  }
  return randomUUID();
}

function buildRequestDebugContext(req, filename) {
  return {
    requestId: getRequestDebugId(req),
    filename,
    htmlLength: typeof req.body?.htmlContent === 'string' ? req.body.htmlContent.length : 0,
    stylesheetLength: typeof req.body?.stylesheet === 'string' ? req.body.stylesheet.length : 0,
    headerLength: typeof req.body?.headerContent === 'string' ? req.body.headerContent.length : 0,
    footerLength: typeof req.body?.footerContent === 'string' ? req.body.footerContent.length : 0,
    hasFooter: Boolean(req.body?.footerContent && String(req.body.footerContent).trim()),
    footerHeight: Number.isFinite(req.body?.footerHeight) ? req.body.footerHeight : null
  };
}

app.post('/generate-pdf', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validatePdfRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
  const startTime = Date.now();
  const abortSignal = req.generationAbortSignal;
  const cleanupAbortContext = req.generationAbortCleanup;
  const debugContext = buildRequestDebugContext(req, filename);
  res.setHeader('x-pdf-debug-id', debugContext.requestId);

  try {
    const pdfBuffer = await requestCoordinator.withGenerationSlot(() => pdfGen.generatePdf({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      filename,
      requestId: debugContext.requestId,
      signal: abortSignal
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
      ...debugContext,
      duration: `${duration}ms`,
      size: `${Math.round(pdfBuffer.length / 1024)}KB`
    });
  } catch (error) {
    const normalizedError = normalizeThrownError(error);
    if (isClientDisconnectAbort(abortSignal)) {
      return;
    }

    if (isAbortError(normalizedError) || isTimeoutAbort(abortSignal, normalizedError)) {
      const duration = Date.now() - startTime;
      logger.log('warn', 'PDF generation aborted', {
        ...debugContext,
        duration: `${duration}ms`,
        reason: abortSignal?.reason?.message || normalizedError.message
      });
      if (!res.headersSent) {
        res.status(504).json({ error: 'PDF generation timed out.' });
      }
      return;
    }

    const duration = Date.now() - startTime;
    logger.log('error', 'Error generating PDF', {
      ...debugContext,
      error: normalizedError.message,
      duration: `${duration}ms`,
      stack: normalizedError.stack?.split('\n').slice(0, 3).join(' -> ')
    });

    const failure = buildGenerationFailureBody('PDF', normalizedError);
    res.status(failure.status).json(failure.body);
  } finally {
    cleanupAbortContext?.();
  }
});

app.post('/generate-docx', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validateDocxRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight, format } = req.body;
  const startTime = Date.now();
  const abortSignal = req.generationAbortSignal;
  const cleanupAbortContext = req.generationAbortCleanup;
  const debugContext = buildRequestDebugContext(req, filename);
  res.setHeader('x-pdf-debug-id', debugContext.requestId);

  try {
    const outputFormat = format === 'doc' ? 'doc' : 'docx';

    const docxBuffer = await requestCoordinator.withGenerationSlot(() => docxGen.generateDocx({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      format: outputFormat,
      signal: abortSignal
    }));

    ensureOutputWithinLimit(docxBuffer, outputFormat.toUpperCase());

    const sanitizedFilename = filename;

    res.set({
      'Content-Type': docxGen.getDocMimeType(outputFormat),
      'Content-Disposition': `attachment; filename="${sanitizedFilename}"`,
      'Content-Length': docxBuffer.length
    });
    res.end(docxBuffer);

    const duration = Date.now() - startTime;
    logger.log('info', `${outputFormat.toUpperCase()} generated successfully`, {
      ...debugContext,
      filename: sanitizedFilename,
      duration: `${duration}ms`,
      size: `${Math.round(docxBuffer.length / 1024)}KB`
    });
  } catch (error) {
    const normalizedError = normalizeThrownError(error);
    if (isClientDisconnectAbort(abortSignal)) {
      return;
    }

    if (isAbortError(normalizedError) || isTimeoutAbort(abortSignal, normalizedError)) {
      const duration = Date.now() - startTime;
      logger.log('warn', 'DOCX generation aborted', {
        ...debugContext,
        duration: `${duration}ms`,
        reason: abortSignal?.reason?.message || normalizedError.message
      });
      if (!res.headersSent) {
        res.status(504).json({ error: 'Document generation timed out.' });
      }
      return;
    }

    const duration = Date.now() - startTime;
    logger.log('error', 'Error generating DOCX', {
      ...debugContext,
      error: normalizedError.message,
      duration: `${duration}ms`,
      stack: normalizedError.stack?.split('\n').slice(0, 3).join(' -> ')
    });

    const failure = buildGenerationFailureBody('DOCX', normalizedError);
    res.status(failure.status).json(failure.body);
  } finally {
    cleanupAbortContext?.();
  }
});

app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const payload = {
    status: 'ok',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
  };

  if (HEALTH_VERBOSE) {
    const memUsage = process.memoryUsage();
    const metrics = requestCoordinator.getMetrics();

    payload.memory = {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    };
    payload.rateLimitEntries = metrics.rateLimitEntries;
    payload.activeGenerationJobs = metrics.activeGenerationJobs;
    payload.config = {
      timeout: PDF_GENERATION_TIMEOUT,
      rateLimit: RATE_LIMIT_MAX,
      maxHtmlSize: MAX_HTML_SIZE,
      maxStylesheetSize: MAX_STYLESHEET_SIZE,
      maxFragmentSize: MAX_FRAGMENT_SIZE,
      maxOutputSize: MAX_OUTPUT_SIZE,
      maxConcurrentJobs: MAX_ACTIVE_JOBS
    };
  }

  res.json(payload);
});

app.use((error, req, res, next) => {
  if (error?.type === 'entity.too.large') {
    logger.log('warn', 'JSON body exceeded parser limit', {
      path: req.path,
      maxRequestBodyBytes: MAX_REQUEST_BODY_BYTES
    });
    return res.status(413).json({ error: 'Request body too large' });
  }
  next(error);
});

registerFrontendRoutes({
  app,
  fs,
  distDir: DIST_DIR,
  distIndexPath: DIST_INDEX_PATH
});

const gracefulShutdown = async (signal) => {
  logger.log('info', `${signal} received, shutting down gracefully`);
  requestCoordinator.stopRateLimitCleanup();
  requestCoordinator.clearState();
  try {
    await pdfGen.closeBrowser?.();
  } catch (error) {
    logger.log('warn', 'Failed to close browser during shutdown', { error: error.message });
  }
  logger.log('info', 'PDF server shutdown complete');
  process.exit(0);
};

function registerProcessHandlers() {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  if (process.platform === 'win32') {
    process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
  }
  process.on('disconnect', () => {
    logger.log('info', 'Parent process disconnected');
    gracefulShutdown('DISCONNECT');
  });
}

module.exports = {
  app,
  _internal: {
    resolvePdfServerInternalToken,
    buildGenerationFailureBody,
    sanitizeRequestDebugId,
    PDF_GENERATION_TIMEOUT,
    DIST_DIR,
    DIST_INDEX_PATH,
    registerProcessHandlers
  }
};

if (require.main === module) {
  if (!PDF_SERVER_INTERNAL_TOKEN || PDF_SERVER_INTERNAL_TOKEN.length < 32) {
    throw new Error('CRITICAL: PDF_SERVER_INTERNAL_TOKEN must be set and at least 32 characters long. Use a dedicated secret for proxy-to-PDF authentication.');
  }

  app.listen(PORT, async () => {
    registerProcessHandlers();
    requestCoordinator.startRateLimitCleanup();
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
