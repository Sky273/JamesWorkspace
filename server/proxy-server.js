import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

// Import safeLog early for global error handlers
import { safeLog } from './utils/logger.backend.js';

// Global error handlers to catch crashes
process.on('uncaughtException', (error) => {
    safeLog('error', 'UNCAUGHT EXCEPTION', { message: error.message, stack: error.stack });
});

process.on('unhandledRejection', (reason, promise) => {
    safeLog('error', 'UNHANDLED REJECTION', { reason: String(reason) });
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

// Import middleware
import metricsMiddleware from './middleware/metrics.middleware.js';
import { apmMiddleware } from './middleware/apm.middleware.js';
import { metrics } from './services/metrics.service.js';

const app = express();

// Trust proxy - required when running behind reverse proxy (Docker, Nginx, etc.)
// This enables correct IP detection for rate limiting and logging
// 'loopback' trusts the local loopback interface (127.0.0.1, ::1)
// In production behind a known proxy, you can use 1 or the proxy's IP
app.set('trust proxy', 'loopback');

// Configure axios with connection pooling
configureAxios();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// Security: CSP via Helmet
configureHelmet(app);

// Security: CORS
configureCors(app);

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Cookie parser
app.use(cookieParser());

// Compression
app.use(compression());

// Request logging middleware with proper cleanup and 400 error diagnostics
app.use((req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    
    // Intercept JSON responses to log 400 errors with details
    res.json = function(body) {
        if (res.statusCode === 400) {
            safeLog('warn', '400 Bad Request diagnostic', {
                path: req.path,
                method: req.method,
                origin: req.headers.origin || 'no-origin',
                userAgent: req.headers['user-agent']?.substring(0, 100),
                hasAccessToken: !!req.cookies?.accessToken,
                hasCsrfCookie: !!req.cookies?.['x-csrf-token'],
                contentType: req.headers['content-type'],
                responseBody: JSON.stringify(body).substring(0, 500)
            });
        }
        return originalJson(body);
    };
    
    const finishHandler = () => {
        const duration = Date.now() - start;
        safeLog('info', `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
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
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    const statusCode = err.statusCode || err.status || 500;
    const isProduction = process.env.NODE_ENV === 'production';
    
    safeLog('error', 'Global error handler', { 
        error: err.message, 
        statusCode,
        path: req.path,
        method: req.method,
        stack: isProduction ? undefined : err.stack 
    });
    
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'CORS policy violation' });
    }
    
    // Track error in metrics
    metrics.trackError(req.path, err.name || 'UnknownError');
    
    res.status(statusCode).json({
        error: isProduction ? 'Internal server error' : err.message,
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
startServer(app, __dirname);

export default app;
