import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import './config/loadEnv.js';

// Import safeLog early for global error handlers
import { safeLog } from './utils/logger.backend.js';
let serverInstance = null;

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import { configureAxios } from './config/axios.js';
import { validateEnvironmentOrExit } from './config/envValidation.js';
import { registerFatalProcessHandlers } from './config/processFatalHandlers.js';
import { resolveTrustProxySetting } from './config/trustProxy.js';

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
import { createBodySizeGuardMiddleware } from './middleware/bodySize.middleware.js';
import { globalLimiter } from './middleware/rateLimit.middleware.js';
import { requestContextMiddleware } from './middleware/requestContext.middleware.js';
import { requestLoggingMiddleware } from './middleware/requestLogging.middleware.js';
import { metrics } from './services/metrics.service.js';

const app = express();
const JSON_BODY_LIMIT_BYTES = Number.parseInt(process.env.JSON_BODY_LIMIT_BYTES || '', 10) || (10 * 1024 * 1024);
const URLENCODED_BODY_LIMIT_BYTES = Number.parseInt(process.env.URLENCODED_BODY_LIMIT_BYTES || '', 10) || (1024 * 1024);
registerFatalProcessHandlers(() => serverInstance);

const trustProxySetting = resolveTrustProxySetting();
app.set('trust proxy', trustProxySetting);
safeLog('info', 'Configured trust proxy setting', { trustProxySetting });

// Configure axios with connection pooling
configureAxios();

// ============================================
// MIDDLEWARE SETUP
// ============================================

app.use(requestContextMiddleware);

// Security: CSP via Helmet
configureHelmet(app);

// Security: CORS
configureCors(app);

// Reject oversized requests before parsing so large bodies do not reach the JSON parser.
app.use(createBodySizeGuardMiddleware({
    jsonBodyLimitBytes: JSON_BODY_LIMIT_BYTES,
    urlencodedBodyLimitBytes: URLENCODED_BODY_LIMIT_BYTES
}));

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
app.use(requestLoggingMiddleware);

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





