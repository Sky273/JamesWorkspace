const PDF_SERVER_AUTH_HEADER = 'x-internal-service-token';
const DEFAULT_RATE_LIMIT_WINDOW = 60000;
const MIN_FOOTER_HEIGHT = 10;
const MAX_FOOTER_HEIGHT = 120;

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

function resolvePdfServerInternalToken({
  configuredToken = '',
} = {}) {
  if (configuredToken.length >= 32) {
    return configuredToken;
  }

  return '';
}

function sanitizeFilename(filename, extension) {
  const baseName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  if (baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }
  return baseName.replace(/\.(docx?|pdf)$/i, '') + extension;
}

function buildGenerationFailureBody(formatLabel, error) {
  if (error.code === 'OUTPUT_TOO_LARGE') {
    return { status: 413, body: { error: `Generated ${formatLabel} too large.` } };
  }

  if (error.message?.toLowerCase().includes('timeout')) {
    return { status: 504, body: { error: `${formatLabel} generation timed out. Try with simpler content.` } };
  }

  return { status: 500, body: { error: `Failed to generate ${formatLabel}` } };
}

function createRequestCoordinator({
  logger,
  pdfServerInternalToken,
  pdfGenerationTimeout,
  rateLimitMax,
  maxActiveJobs,
  maxHtmlSize,
  maxStylesheetSize,
  maxFragmentSize,
  rateLimitWindow = DEFAULT_RATE_LIMIT_WINDOW
}) {
  const requestCounts = new Map();
  let rateLimitCleanupInterval = null;
  let activeGenerationJobs = 0;

  function containsDangerousPattern(content, patterns) {
    if (!content) return false;
    return patterns.some((pattern) => pattern.test(content));
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

    if (htmlContent.length > maxHtmlSize) {
      logger.log('warn', 'HTML content too large', { size: htmlContent.length, max: maxHtmlSize });
      return res.status(400).json({ error: `HTML content too large. Max size: ${maxHtmlSize} bytes` });
    }

    if (containsDangerousPattern(htmlContent, DANGEROUS_HTML_PATTERNS)) {
      logger.log('warn', 'Dangerous htmlContent rejected');
      return res.status(400).json({ error: 'htmlContent contains unsupported content' });
    }

    if (!validateOptionalStringField(stylesheet, 'stylesheet', maxStylesheetSize, DANGEROUS_CSS_PATTERNS, res)) {
      return;
    }

    if (!validateOptionalStringField(headerContent, 'headerContent', maxFragmentSize, DANGEROUS_HTML_PATTERNS, res)) {
      return;
    }

    if (!validateOptionalStringField(footerContent, 'footerContent', maxFragmentSize, DANGEROUS_HTML_PATTERNS, res)) {
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

  function rateLimitMiddleware(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    for (const [key, data] of requestCounts.entries()) {
      if (now - data.windowStart > rateLimitWindow) {
        requestCounts.delete(key);
      }
    }

    let ipData = requestCounts.get(ip);
    if (!ipData) {
      ipData = { count: 0, windowStart: now };
      requestCounts.set(ip, ipData);
    }

    if (now - ipData.windowStart > rateLimitWindow) {
      ipData.count = 0;
      ipData.windowStart = now;
    }

    ipData.count++;

    if (ipData.count > rateLimitMax) {
      logger.log('warn', 'Rate limit exceeded', { ip, count: ipData.count });
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    next();
  }

  function generationCapacityMiddleware(req, res, next) {
    if (activeGenerationJobs >= maxActiveJobs) {
      logger.log('warn', 'Generation concurrency limit reached', {
        activeGenerationJobs,
        maxActiveJobs,
        path: req.path
      });
      return res.status(503).json({ error: 'Generation server is busy. Please retry shortly.' });
    }

    next();
  }

  function internalServiceAuthMiddleware(req, res, next) {
    if (!pdfServerInternalToken) {
      logger.log('warn', 'PDF server internal token missing; rejecting protected request');
      return res.status(503).json({ error: 'PDF server is not configured for internal authentication.' });
    }

    const providedToken = req.get(PDF_SERVER_AUTH_HEADER);
    if (providedToken !== pdfServerInternalToken) {
      logger.log('warn', 'Invalid internal service token', { path: req.path });
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  }

  function requestTimeoutMiddleware(req, res, next) {
    res.setTimeout(pdfGenerationTimeout + 5000, () => {
      logger.log('warn', 'Request timed out at HTTP layer', { path: req.path });
      if (!res.headersSent) {
        res.status(504).json({ error: 'Document generation timed out.' });
      }
    });
    next();
  }

  async function withGenerationSlot(fn) {
    activeGenerationJobs += 1;
    try {
      return await fn();
    } finally {
      activeGenerationJobs = Math.max(0, activeGenerationJobs - 1);
    }
  }

  function startRateLimitCleanup() {
    rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      for (const [key, data] of requestCounts.entries()) {
        if (now - data.windowStart > rateLimitWindow * 2) {
          requestCounts.delete(key);
          cleaned++;
        }
      }
      if (cleaned > 0) {
        logger.log('debug', 'Rate limit cleanup', { entriesRemoved: cleaned, remaining: requestCounts.size });
      }
    }, rateLimitWindow);
  }

  function stopRateLimitCleanup() {
    if (rateLimitCleanupInterval) {
      clearInterval(rateLimitCleanupInterval);
      rateLimitCleanupInterval = null;
    }
  }

  function clearState() {
    requestCounts.clear();
    activeGenerationJobs = 0;
  }

  function getMetrics() {
    return {
      rateLimitEntries: requestCounts.size,
      activeGenerationJobs
    };
  }

  return {
    clearState,
    getMetrics,
    startRateLimitCleanup,
    stopRateLimitCleanup,
    withGenerationSlot,
    middlewares: {
      generationCapacityMiddleware,
      internalServiceAuthMiddleware,
      rateLimitMiddleware,
      requestTimeoutMiddleware,
      validateDocxRequest,
      validatePdfRequest
    }
  };
}

module.exports = {
  PDF_SERVER_AUTH_HEADER,
  buildGenerationFailureBody,
  createRequestCoordinator,
  resolvePdfServerInternalToken,
  sanitizeFilename
};
