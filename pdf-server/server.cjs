/**
 * PDF Server - Express server for PDF and DOCX generation
 * Uses Puppeteer for PDF generation, Pandoc + LibreOffice for DOCX/DOC conversion
 */

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const logger = require('./lib/logger.cjs');
const pdfGen = require('./lib/pdfGenerator.cjs');
const docxGen = require('./lib/docxGenerator.cjs');
const { registerFrontendRoutes } = require('./lib/frontendRoutes.cjs');
const {
  DEV_TEST_FALLBACK_TOKEN,
  buildGenerationFailureBody,
  createRequestCoordinator,
  derivePdfServerFallbackToken,
  resolvePdfServerInternalToken
} = require('./lib/requestGuards.cjs');

const app = express();
const PORT = process.env.PDF_SERVER_PORT || 3002;
const DIST_DIR = path.join(__dirname, 'dist');
const DIST_INDEX_PATH = path.join(DIST_DIR, 'index.html');

const PDF_GENERATION_TIMEOUT = parseInt(process.env.PDF_TIMEOUT || '30000', 10);
const isProduction = process.env.NODE_ENV === 'production';
const configuredPdfToken = process.env.PDF_SERVER_INTERNAL_TOKEN || '';
const PDF_SERVER_INTERNAL_TOKEN = resolvePdfServerInternalToken({
  configuredToken: configuredPdfToken,
  isProduction,
  jwtSecret: process.env.JWT_SECRET || '',
  csrfSecret: process.env.CSRF_SECRET || ''
});
const MAX_HTML_SIZE = parseInt(process.env.PDF_MAX_HTML_SIZE || '5242880', 10);
const MAX_STYLESHEET_SIZE = parseInt(process.env.PDF_MAX_STYLESHEET_SIZE || '262144', 10);
const MAX_FRAGMENT_SIZE = parseInt(process.env.PDF_MAX_FRAGMENT_SIZE || '524288', 10);
const MAX_OUTPUT_SIZE = parseInt(process.env.PDF_MAX_OUTPUT_SIZE || '20971520', 10);
const MAX_ACTIVE_JOBS = parseInt(process.env.PDF_MAX_CONCURRENT || '4', 10);
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = parseInt(process.env.PDF_RATE_LIMIT || '300', 10);

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

app.post('/generate-pdf', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validatePdfRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight } = req.body;
  const startTime = Date.now();

  try {
    const pdfBuffer = await requestCoordinator.withGenerationSlot(() => pdfGen.generatePdf({
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

    const failure = buildGenerationFailureBody('PDF', error);
    res.status(failure.status).json(failure.body);
  }
});

app.post('/generate-docx', internalServiceAuthMiddleware, requestTimeoutMiddleware, rateLimitMiddleware, generationCapacityMiddleware, validateDocxRequest, async (req, res) => {
  const { htmlContent, filename, stylesheet, headerContent, footerContent, footerHeight, format } = req.body;
  const startTime = Date.now();

  try {
    const outputFormat = format === 'doc' ? 'doc' : 'docx';

    const docxBuffer = await requestCoordinator.withGenerationSlot(() => docxGen.generateDocx({
      htmlContent,
      stylesheet,
      headerContent,
      footerContent,
      footerHeight,
      format: outputFormat
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

    const failure = buildGenerationFailureBody('DOCX', error);
    res.status(failure.status).json(failure.body);
  }
});

app.get('/health', (req, res) => {
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();
  const metrics = requestCoordinator.getMetrics();

  res.json({
    status: 'ok',
    uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB'
    },
    rateLimitEntries: metrics.rateLimitEntries,
    activeGenerationJobs: metrics.activeGenerationJobs,
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
    derivePdfServerFallbackToken,
    buildGenerationFailureBody,
    DIST_DIR,
    DIST_INDEX_PATH,
    registerProcessHandlers
  }
};

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
