import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import './config/loadEnv.js';

// Import safeLog early for global error handlers
import { safeLog } from './utils/logger.backend.js';

// Global error handlers to catch crashes
let serverInstance = null;
let fatalErrorInProgress = false;

const triggerFatalShutdown = (signal, details) => {
    if (fatalErrorInProgress) {
        safeLog('warn', 'Fatal shutdown already in progress', { signal });
        return;
    }

    fatalErrorInProgress = true;
    safeLog('error', 'Fatal process error', { signal, ...details });

    if (serverInstance?.gracefulShutdown) {
        serverInstance.gracefulShutdown(signal, 1);
        return;
    }

    setImmediate(() => {
        process.exit(1);
    });
};

process.on('uncaughtException', (error) => {
    triggerFatalShutdown('UNCAUGHT_EXCEPTION', {
        message: error.message,
        stack: error.stack,
    });
});

process.on('unhandledRejection', (reason) => {
    const normalizedReason = reason instanceof Error
        ? { message: reason.message, stack: reason.stack }
        : { reason: String(reason) };

    triggerFatalShutdown('UNHANDLED_REJECTION', normalizedReason);
});

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import { configureAxios } from './config/axios.js';
import { validateEnvironmentOrExit } from './config/envValidation.js';

// Validate environment variables at startup
validateEnvironmentOrExit(process.env.NODE_ENV === 'production');

// Import modular configuration
import { configureHelmet, configureCors, configureCsrf } from './config/security.js';
import { registerSwaggerRoutes, registerCacheControl, registerApiRoutes, registerProxyRoutes } from './config/routeRegistry.js';
import { configureStaticFiles } from './config/staticFiles.js';
import { startServer } from './config/lifecycle.js';
import { isStripeCheckoutEnabled } from './config/stripe.js';

// Import middleware
import metricsMiddleware from './middleware/metrics.middleware.js';
import { apmMiddleware } from './middleware/apm.middleware.js';
import { globalLimiter } from './middleware/rateLimit.middleware.js';
import { metrics } from './services/metrics.service.js';

const app = express();
const JSON_BODY_LIMIT_BYTES = Number.parseInt(process.env.JSON_BODY_LIMIT_BYTES || '', 10) || (10 * 1024 * 1024);
const URLENCODED_BODY_LIMIT_BYTES = Number.parseInt(process.env.URLENCODED_BODY_LIMIT_BYTES || '', 10) || (1024 * 1024);
const METHODS_WITH_BODIES = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const REQUEST_ID_HEADER = 'x-request-id';

function normalizeRequestId(rawValue) {
    if (typeof rawValue !== 'string') {
        return '';
    }

    const trimmed = rawValue.trim();
    if (!trimmed) {
        return '';
    }

    return trimmed.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 128);
}

function resolveTrustProxySetting() {
    const rawValue = (process.env.TRUST_PROXY || '').trim();
    if (!rawValue) {
        return process.env.NODE_ENV === 'production' ? 1 : 'loopback';
    }

    const normalizedValue = rawValue.toLowerCase();
    if (normalizedValue === 'true') {
        return true;
    }
    if (normalizedValue === 'false') {
        return false;
    }
    if (/^\d+$/.test(rawValue)) {
        return Number.parseInt(rawValue, 10);
    }

    return rawValue;
}

const trustProxySetting = resolveTrustProxySetting();
app.set('trust proxy', trustProxySetting);
safeLog('info', 'Configured trust proxy setting', { trustProxySetting });

// Configure axios with connection pooling
configureAxios();

// ============================================
// MIDDLEWARE SETUP
// ============================================

app.use((req, res, next) => {
    const rawRequestId = Array.isArray(req.headers[REQUEST_ID_HEADER])
        ? req.headers[REQUEST_ID_HEADER][0]
        : req.headers[REQUEST_ID_HEADER];
    const requestId = normalizeRequestId(rawRequestId) || crypto.randomUUID();

    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
});

// Security: CSP via Helmet
configureHelmet(app);

// Security: CORS
configureCors(app);

function getDeclaredContentLength(req) {
    const rawHeader = req.headers['content-length'];
    const headerValue = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
    const parsedContentLength = Number.parseInt(headerValue || '', 10);
    return Number.isFinite(parsedContentLength) && parsedContentLength >= 0 ? parsedContentLength : null;
}

function getBodyLimitBytes(contentType) {
    return contentType.includes('application/x-www-form-urlencoded')
        ? URLENCODED_BODY_LIMIT_BYTES
        : JSON_BODY_LIMIT_BYTES;
}

function summarizeBadRequestBody(body) {
    if (body === null) {
        return { type: 'null' };
    }

    if (body === undefined) {
        return { type: 'undefined' };
    }

    if (Array.isArray(body)) {
        return { type: 'array', length: body.length };
    }

    if (typeof body === 'string') {
        return { type: 'string', length: body.length };
    }

    if (typeof body === 'object') {
        const keys = Object.keys(body);
        const summary = {
            type: 'object',
            keys: keys.slice(0, 10),
            keyCount: keys.length
        };

        if (typeof body.error === 'string') {
            summary.errorType = 'string';
        } else if (body.error && typeof body.error === 'object') {
            summary.errorType = 'object';
            summary.errorKeys = Object.keys(body.error).slice(0, 5);
        }

        if (Array.isArray(body.details)) {
            summary.detailCount = body.details.length;
        }

        return summary;
    }

    return { type: typeof body };
}

function buildBadRequestDiagnostic(req, body) {
    return {
        path: req.path,
        method: req.method,
        contentType: req.headers['content-type'],
        origin: req.headers.origin || 'no-origin',
        responseSummary: summarizeBadRequestBody(body)
    };
}

// Reject oversized requests before parsing so large bodies do not reach the JSON parser.
app.use((req, res, next) => {
    if (!METHODS_WITH_BODIES.has(req.method)) {
        return next();
    }

    const contentType = (req.headers['content-type'] || '').toLowerCase();
    const parsesJsonOrFormBody = contentType.includes('json') || contentType.includes('application/x-www-form-urlencoded');
    if (!parsesJsonOrFormBody) {
        return next();
    }

    const contentLength = getDeclaredContentLength(req);
    if (contentLength === null) {
        return next();
    }

    const bodyLimitBytes = getBodyLimitBytes(contentType);
    if (contentLength > bodyLimitBytes) {
        safeLog('warn', 'Request body rejected before parsing', {
            requestId: req.requestId,
            path: req.path,
            method: req.method,
            contentLength,
            bodyLimitBytes
        });
        return res.status(413).json({ error: 'Request body too large' });
    }

    next();
});

if (isStripeCheckoutEnabled()) {
    // Stripe requires the exact raw request body to verify webhook signatures.
    app.use('/api/billing/stripe', async (req, res, next) => {
        try {
            const module = await import('./routes/stripeWebhook.routes.js');
            return module.default(req, res, next);
        } catch (error) {
            return next(error);
        }
    });
}

// Body parsing middleware
app.use(express.json({ limit: `${JSON_BODY_LIMIT_BYTES}b` }));
app.use(express.urlencoded({ extended: true, limit: `${URLENCODED_BODY_LIMIT_BYTES}b` }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Request logging middleware with proper cleanup and 400 error diagnostics
app.use((req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    let badRequestDiagnosticLogged = false;

    const logBadRequestDiagnostic = (body) => {
        if (badRequestDiagnosticLogged || res.statusCode !== 400) {
            return;
        }

        const shouldQuietExpectedE2EAuthValidation =
            process.env.E2E_QUIET_EXPECTED_WARNINGS === 'true'
            && ['/signin', '/register', '/refresh', '/forgot-password', '/reset-password'].includes(req.path);
        if (shouldQuietExpectedE2EAuthValidation) {
            return;
        }

        badRequestDiagnosticLogged = true;
        safeLog('warn', '400 Bad Request diagnostic', {
            requestId: req.requestId,
            ...buildBadRequestDiagnostic(req, body)
        });
    };
    
    // Intercept JSON responses to log 400 errors with details
    res.json = function(body) {
        logBadRequestDiagnostic(body);
        return originalJson(body);
    };

    res.send = function(body) {
        const responseType = res.getHeader('Content-Type');
        const looksJson = typeof body === 'object'
            || (typeof body === 'string' && String(responseType || '').toLowerCase().includes('application/json'));
        if (looksJson) {
            logBadRequestDiagnostic(body);
        }
        return originalSend(body);
    };
    
    const finishHandler = () => {
        const duration = Date.now() - start;
        safeLog('info', 'HTTP request completed', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration
        });
        // Remove listener to prevent memory leak
        res.removeListener('finish', finishHandler);
    };
    res.on('finish', finishHandler);
    next();
});

// Metrics tracking middleware
app.use(metricsMiddleware);

// APM (Application Performance Monitoring) middleware
app.use(apmMiddleware);

// ============================================
// SWAGGER (before CSRF middleware)
// ============================================
registerSwaggerRoutes(app);

// ============================================
// CSRF PROTECTION
// ============================================
configureCsrf(app);

// ============================================
// API CACHE CONTROL
// ============================================
registerCacheControl(app);

// ============================================
// GLOBAL API RATE LIMITING
// ============================================
app.use('/api', globalLimiter);

// ============================================
// ROUTES
// ============================================
registerApiRoutes(app);
registerProxyRoutes(app);

// ============================================
// STATIC FILES & SPA FALLBACK
// ============================================
configureStaticFiles(app, __dirname);

// ============================================
// ERROR HANDLING
// ============================================

// 404 handler for API routes
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found', requestId: req.requestId });
});

// Global error handler
app.use((err, req, res, _next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Request body too large', requestId: req.requestId });
    }

    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    safeLog('error', 'Global error handler', { 
        requestId: req.requestId,
        error: err.message, 
        statusCode,
        path: req.path,
        method: req.method,
        stack: isProduction ? undefined : err.stack 
    });
    
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'CORS policy violation', requestId: req.requestId });
    }
    
    // Track error in metrics
    metrics.trackError(err, req.path);
    
    res.status(statusCode).json({
        error: isProduction ? 'Internal server error' : err.message,
        requestId: req.requestId,
        statusCode,
        ...(isProduction ? {} : { 
            path: req.path,
            stack: err.stack?.split('\n').slice(0, 5)
        })
    });
});

// ============================================
// SERVER STARTUP
// ============================================
serverInstance = startServer(app, __dirname);

export default app;





