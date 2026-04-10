const crypto = require('crypto');
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

const DANGEROUS_RESOURCE_PATTERNS = [
  /<(?:img|iframe|object|embed|source|audio|video|track)\b[^>]*(?:src|data|poster)\s*=\s*['"]?\s*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i,
  /<(?:img|source)\b[^>]*\bsrcset\s*=\s*['"][^'"]*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i,
  /<link\b[^>]*href\s*=\s*['"]?\s*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i,
  /<base\b[^>]*href\s*=\s*['"]?\s*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i,
  /<meta\b[^>]*http-equiv\s*=\s*['"]?refresh['"]?[^>]*content\s*=\s*['"][^"]*url\s*=\s*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i,
  /\b(?:src|href|data|poster|action|formaction|xlink:href)\s*=\s*['"]?\s*(?:https?:|file:|ftp:|chrome:|blob:|\/\/)/i
];

const DANGEROUS_CSS_PATTERNS = [
  /@import/i,
  /javascript\s*:/i,
  /expression\s*\(/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /url\s*\(\s*['"]?\s*(?!data:)/i
];

function decodeHtmlEntities(value) {
  if (typeof value !== 'string' || value.length === 0 || !value.includes('&')) {
    return value;
  }

  return value
    .replace(/&#(\d+);?/gi, (_, code) => {
      const parsed = Number.parseInt(code, 10);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => {
      const parsed = Number.parseInt(code, 16);
      return Number.isFinite(parsed) ? String.fromCodePoint(parsed) : _;
    })
    .replace(/&(quot|apos|amp|lt|gt);/gi, (match, entity) => {
      switch (entity.toLowerCase()) {
        case 'quot':
          return '"';
        case 'apos':
          return '\'';
        case 'amp':
          return '&';
        case 'lt':
          return '<';
        case 'gt':
          return '>';
        default:
          return match;
      }
    });
}

function createAbortError(message) {
  const error = new Error(message);
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function containsDangerousResourceReference(content) {
  if (!content) {
    return false;
  }

  const decodedContent = decodeHtmlEntities(content);
  return DANGEROUS_RESOURCE_PATTERNS.some((pattern) => pattern.test(content) || pattern.test(decodedContent));
}

function extractEmbeddedCssFragments(content) {
  if (typeof content !== 'string' || content.length === 0) {
    return [];
  }

  const fragments = [];
  const styleTagPattern = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  const styleAttrPattern = /\bstyle\s*=\s*(['"])([\s\S]*?)\1/gi;

  for (const match of content.matchAll(styleTagPattern)) {
    if (match[1]) {
      fragments.push(match[1]);
    }
  }

  for (const match of content.matchAll(styleAttrPattern)) {
    if (match[2]) {
      fragments.push(match[2]);
    }
  }

  return fragments;
}

function containsDangerousEmbeddedCss(content) {
  if (!content) {
    return false;
  }

  return extractEmbeddedCssFragments(content).some((fragment) => (
    DANGEROUS_CSS_PATTERNS.some((pattern) => pattern.test(fragment) || pattern.test(decodeHtmlEntities(fragment)))
  ));
}

function resolvePdfServerInternalToken({
  configuredToken = '',
} = {}) {
  if (configuredToken.length >= 32) {
    return configuredToken;
  }

  return '';
}

function tokensMatch(expectedToken, providedToken) {
  const expected = typeof expectedToken === 'string' ? Buffer.from(expectedToken, 'utf8') : Buffer.alloc(0);
  const provided = typeof providedToken === 'string' ? Buffer.from(providedToken, 'utf8') : Buffer.alloc(0);

  if (expected.length === 0 || expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

function sanitizeFilename(filename, extension) {
  const baseName = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 255);
  if (baseName.toLowerCase().endsWith(extension)) {
    return baseName;
  }
  return baseName.replace(/\.(docx?|pdf)$/i, '') + extension;
}

function buildGenerationFailureBody(formatLabel, error) {
  const normalizedError = error && typeof error === 'object'
    ? error
    : { message: String(error || ''), code: null, name: null };

  if (normalizedError?.name === 'AbortError' || normalizedError?.code === 'ABORT_ERR') {
    return { status: 504, body: { error: `${formatLabel} generation timed out. Try with simpler content.` } };
  }

  if (normalizedError?.code === 'OUTPUT_TOO_LARGE') {
    return { status: 413, body: { error: `Generated ${formatLabel} too large.` } };
  }

  if (String(normalizedError?.message || '').toLowerCase().includes('timeout')) {
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
    const decodedContent = decodeHtmlEntities(content);
    return patterns.some((pattern) => pattern.test(content) || pattern.test(decodedContent));
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

    if (containsDangerousResourceReference(htmlContent)) {
      logger.log('warn', 'External htmlContent resource rejected');
      return res.status(400).json({ error: 'htmlContent contains unsupported external resources' });
    }

    if (containsDangerousEmbeddedCss(htmlContent)) {
      logger.log('warn', 'Dangerous htmlContent CSS rejected');
      return res.status(400).json({ error: 'htmlContent contains unsupported CSS' });
    }

    if (!validateOptionalStringField(stylesheet, 'stylesheet', maxStylesheetSize, DANGEROUS_CSS_PATTERNS, res)) {
      return;
    }

    if (!validateOptionalStringField(headerContent, 'headerContent', maxFragmentSize, DANGEROUS_HTML_PATTERNS, res)) {
      return;
    }

    if (headerContent && containsDangerousResourceReference(headerContent)) {
      logger.log('warn', 'External headerContent resource rejected');
      return res.status(400).json({ error: 'headerContent contains unsupported external resources' });
    }

    if (headerContent && containsDangerousEmbeddedCss(headerContent)) {
      logger.log('warn', 'Dangerous headerContent CSS rejected');
      return res.status(400).json({ error: 'headerContent contains unsupported CSS' });
    }

    if (!validateOptionalStringField(footerContent, 'footerContent', maxFragmentSize, DANGEROUS_HTML_PATTERNS, res)) {
      return;
    }

    if (footerContent && containsDangerousResourceReference(footerContent)) {
      logger.log('warn', 'External footerContent resource rejected');
      return res.status(400).json({ error: 'footerContent contains unsupported external resources' });
    }

    if (footerContent && containsDangerousEmbeddedCss(footerContent)) {
      logger.log('warn', 'Dangerous footerContent CSS rejected');
      return res.status(400).json({ error: 'footerContent contains unsupported CSS' });
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
    if (!tokensMatch(pdfServerInternalToken, providedToken)) {
      logger.log('warn', 'Invalid internal service token', { path: req.path });
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  }

  function requestTimeoutMiddleware(req, res, next) {
    const controller = new AbortController();
    let cleanedUp = false;
    let timeoutId = null;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      req.removeListener('aborted', onAborted);
      res.removeListener('finish', cleanup);
      res.removeListener('close', onClose);
    };

    const abortWithReason = (reason) => {
      if (controller.signal.aborted) {
        return;
      }

      controller.abort(reason);
    };

    const onAborted = () => {
      abortWithReason(createAbortError('Client aborted request.'));
      cleanup();
    };

    const onClose = () => {
      if (!res.writableEnded) {
        abortWithReason(createAbortError('Client disconnected.'));
      }
      cleanup();
    };

    timeoutId = setTimeout(() => {
      logger.log('warn', 'Request timed out before generation completed', { path: req.path });
      abortWithReason(createAbortError('Document generation timed out.'));
    }, pdfGenerationTimeout);

    req.generationAbortController = controller;
    req.generationAbortSignal = controller.signal;
    req.generationAbortCleanup = cleanup;

    req.on('aborted', onAborted);
    res.on('finish', cleanup);
    res.on('close', onClose);
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
  decodeHtmlEntities,
  resolvePdfServerInternalToken,
  sanitizeFilename,
  tokensMatch
};
