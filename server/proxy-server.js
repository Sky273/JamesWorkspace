import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import { doubleCsrf } from 'csrf-csrf';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fs from 'fs';
import 'dotenv/config';

// Global error handlers to catch crashes
process.on('uncaughtException', (error) => {
    console.error('🔴🔴🔴 UNCAUGHT EXCEPTION:', error.message);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🔴🔴🔴 UNHANDLED REJECTION:', reason);
});

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import { PORT, ALLOWED_ORIGINS, JWT_SECRET } from './config/constants.js';
import { configureAxios, httpAgent, httpsAgent } from './config/axios.js';
import { validateEnvironmentOrExit } from './config/envValidation.js';

// Validate environment variables at startup
validateEnvironmentOrExit(process.env.NODE_ENV === 'production');

// Import middleware
import { cleanupRateLimitStore } from './middleware/rateLimit.middleware.js';
import metricsMiddleware from './middleware/metrics.middleware.js';
import { cleanupAllCaches } from './services/cache.service.js';

// Import routes
import healthRoutes from './routes/health.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import authRoutes from './routes/auth.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import missionsRoutes from './routes/missions.routes.js';
import resumesRoutes from './routes/resumes.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import customersRoutes from './routes/customers.routes.js';
import llmRoutes from './routes/llm.routes.js';
import adminRoutes from './routes/admin.routes.js';
import adaptationsRoutes from './routes/adaptations.routes.js';
import tagsRoutes from './routes/tags.routes.js';
import usersRoutes from './routes/users.routes.js';
import chatbotRoutes from './routes/chatbot.routes.js';
import marketRadarRoutes from './routes/marketRadar.routes.js';
import romeRoutes from './routes/rome.routes.js';
import docsRoutes from './routes/docs.routes.js';

// Import services
import { metrics } from './services/metrics.service.js';
import { safeLog } from './utils/logger.backend.js';
import { startPeriodicCleanup, stopPeriodicCleanup } from './utils/fileCleanup.js';
import { startBlacklistCleanup, destroyBlacklist } from './services/tokenBlacklist.service.js';
import { swaggerDocument } from './config/swagger.js';
// Market Radar cache cleanup imports
import { cleanupFactsCache } from './services/marketFacts.service.js';
import { cleanupTrendsCache } from './services/marketTrends.service.js';
import { cleanupMetiersCache } from './services/rome.service.js';
// Tags cache cleanup import
import { invalidateTagsCache } from './routes/tags.routes.js';
// PostgreSQL database initialization
import { initializeDatabase, closePool } from './services/database.service.js';

const app = express();

// Configure axios with connection pooling
configureAxios();

// ============================================
// MIDDLEWARE SETUP
// ============================================

// ============================================
// CONTENT SECURITY POLICY
// ============================================
// 
// SECURITY TRADE-OFFS:
// - 'unsafe-inline' and 'unsafe-eval' are required by TinyMCE rich text editor
//   TinyMCE dynamically generates and executes scripts for its functionality.
//   Alternative: Use nonce-based CSP, but TinyMCE doesn't support it natively.
//   Risk mitigation: All user input is sanitized with DOMPurify before rendering.
//
// - PDF.js requires blob: and eval for its worker functionality
//   Risk mitigation: PDF files are processed server-side when possible.
//
// RECOMMENDATIONS FOR FUTURE:
// 1. Monitor TinyMCE updates for nonce/hash CSP support
// 2. Consider server-side PDF text extraction to reduce client-side PDF.js usage
// 3. Implement Subresource Integrity (SRI) for external scripts
// ============================================

const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // Required: TinyMCE inline event handlers
                "'unsafe-eval'",   // Required: TinyMCE and PDF.js dynamic code
                "https://cdnjs.cloudflare.com", // PDF.js worker
                "https://unpkg.com",            // PDF.js worker fallback
                "blob:"                          // PDF.js worker blob
            ],
            styleSrc: [
                "'self'",
                "'unsafe-inline'", // Required: TinyMCE dynamic styles
                "https://fonts.googleapis.com",
                "https://unpkg.com",  // Swagger UI styles
                "https://basemaps.cartocdn.com" // MapLibre GL styles
            ],
            fontSrc: [
                "'self'",
                "https://fonts.gstatic.com",
                "https://basemaps.cartocdn.com", // MapLibre GL fonts
                "data:"
            ],
            imgSrc: [
                "'self'",
                "data:",
                "blob:",
                "https:",  // Allow images from any HTTPS source (for resume attachments)
                "https://unpkg.com"  // Swagger UI favicon
            ],
            connectSrc: [
                "'self'",
                "https://api.openai.com",
                "https://api.anthropic.com",
                "https://basemaps.cartocdn.com",     // MapLibre GL - base domain
                "https://*.basemaps.cartocdn.com",   // MapLibre GL - all subdomains (tiles, etc.)
                ...(isProduction ? [] : ["http://localhost:*", "ws://localhost:*"])
            ],
            workerSrc: [
                "'self'",
                "blob:",
                "https://cdnjs.cloudflare.com",
                "https://unpkg.com"
            ],
            frameSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: isProduction ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false, // Required for external resources
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Same-origin requests don't have an Origin header
        // This is normal browser behavior when frontend and API are on the same domain
        // Allow these requests (they are inherently same-origin and safe)
        if (!origin) {
            safeLog('debug', 'CORS: Allowing request without origin (same-origin)');
            return callback(null, true);
        }
        
        // Check if origin is in allowed list
        if (ALLOWED_ORIGINS.includes(origin)) {
            safeLog('debug', 'CORS: Allowing request from allowed origin', { origin });
            return callback(null, true);
        }
        
        // Log all origins for debugging
        safeLog('warn', 'CORS: Rejected request from unauthorized origin', { 
            origin, 
            allowedOrigins: ALLOWED_ORIGINS 
        });
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    exposedHeaders: ['X-Token-Expires-In', 'X-Token-Expiring-Soon']
};

// Apply CORS only to API routes - static files and HTML pages don't need CORS
// This fixes the 400 error when navigating directly to a URL (no Origin header)
app.use('/api', cors(corsOptions));
app.options('/api/*', cors(corsOptions));

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

// ============================================
// CSRF PROTECTION
// ============================================

// Determine if HTTPS is enabled (for secure cookies)
const useSecureCookies = isProduction || process.env.HTTPS_ENABLED === 'true';

// Configure CSRF protection
const csrfProtection = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || JWT_SECRET || 'default-csrf-secret',
    cookieName: 'x-csrf-token',
    cookieOptions: {
        httpOnly: true,
        sameSite: isProduction ? 'strict' : 'lax',
        secure: useSecureCookies,
        path: '/',
        // Allow cookie to work with resumeconverter.net domain in development
        domain: process.env.COOKIE_DOMAIN || undefined
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getTokenFromRequest: (req) => {
        return req.headers['x-csrf-token'];
    },
    getSessionIdentifier: (req) => {
        return req.user?.id || req.sessionID || 'anonymous';
    }
});

const doubleCsrfProtection = csrfProtection.doubleCsrfProtection;
const generateCsrfToken = csrfProtection.generateCsrfToken;

// CSRF token endpoint - MUST be before CSRF protection middleware
app.get('/api/csrf-token', (req, res) => {
    try {
        safeLog('debug', 'CSRF token request', { 
            useSecureCookies,
            protocol: req.protocol,
            secure: req.secure,
            headers: { host: req.headers.host, origin: req.headers.origin }
        });
        const csrfToken = generateCsrfToken(req, res);
        res.json({ csrfToken });
    } catch (error) {
        safeLog('error', 'Error generating CSRF token', { error: error.message });
        res.status(500).json({ error: 'Failed to generate CSRF token' });
    }
});

// ============================================
// SWAGGER API DOCUMENTATION (before CSRF middleware)
// ============================================
// These routes must be before CSRF protection to allow Swagger UI to load properly

// Swagger JSON endpoint
app.get('/api/docs', (req, res) => {
    res.set({
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    res.json(swaggerDocument);
});

// Swagger UI HTML page
app.get('/api/docs/ui', (req, res) => {
    res.set({
        'Content-Type': 'text/html',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
    });
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResumeConverter API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" />
    <link rel="icon" type="image/png" href="https://unpkg.com/swagger-ui-dist@5.18.2/favicon-32x32.png" sizes="32x32" />
    <style>
        html {
            box-sizing: border-box;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin: 0;
            background: #fafafa;
        }
        .swagger-ui .topbar {
            background-color: #1a1a2e;
            padding: 10px 0;
        }
        .swagger-ui .topbar .download-url-wrapper .select-label {
            color: #fff;
        }
        .swagger-ui .topbar .download-url-wrapper input[type=text] {
            border: 2px solid #4a4a6a;
            background: #2a2a4a;
            color: #fff;
        }
        .swagger-ui .info .title {
            color: #1a1a2e;
        }
        .swagger-ui .info .title small.version-stamp {
            background-color: #4a90d9;
        }
        .swagger-ui .opblock.opblock-get .opblock-summary-method {
            background: #61affe;
        }
        .swagger-ui .opblock.opblock-post .opblock-summary-method {
            background: #49cc90;
        }
        .swagger-ui .opblock.opblock-put .opblock-summary-method {
            background: #fca130;
        }
        .swagger-ui .opblock.opblock-delete .opblock-summary-method {
            background: #f93e3e;
        }
        .swagger-ui .btn.authorize {
            color: #49cc90;
            border-color: #49cc90;
        }
        .swagger-ui .btn.authorize svg {
            fill: #49cc90;
        }
        .swagger-ui section.models {
            border: 1px solid rgba(59,65,81,.3);
            border-radius: 4px;
        }
        .swagger-ui section.models .model-container {
            background: rgba(0,0,0,.03);
        }
        .topbar-wrapper img {
            content: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h5v7h7v9H6z"/><path d="M8 12h8v2H8zm0 4h8v2H8z"/></svg>');
            height: 40px;
        }
        .topbar-wrapper span {
            color: white;
            font-size: 1.2em;
            margin-left: 10px;
        }
        #swagger-ui {
            min-height: 100vh;
        }
        .loading-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: sans-serif;
            color: #3b4151;
        }
        .loading-spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4a90d9;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin-right: 15px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div id="swagger-ui">
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <span>Loading API Documentation...</span>
        </div>
    </div>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" charset="UTF-8"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
    <script>
        window.onload = () => {
            try {
                window.ui = SwaggerUIBundle({
                    url: window.location.origin + '/api/docs',
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIStandalonePreset
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: 'StandaloneLayout',
                    docExpansion: 'list',
                    filter: true,
                    showExtensions: true,
                    showCommonExtensions: true,
                    syntaxHighlight: {
                        activate: true,
                        theme: 'monokai'
                    },
                    requestInterceptor: (req) => {
                        // Add credentials for authenticated endpoints
                        req.credentials = 'include';
                        return req;
                    },
                    onComplete: () => {
                        console.log('Swagger UI loaded successfully');
                    },
                    onFailure: (err) => {
                        console.error('Swagger UI failed to load:', err);
                        document.getElementById('swagger-ui').innerHTML = 
                            '<div class="loading-container" style="color: #f93e3e;">' +
                            '<span>Failed to load API documentation. Please refresh the page.</span></div>';
                    }
                });
            } catch (err) {
                console.error('Error initializing Swagger UI:', err);
                document.getElementById('swagger-ui').innerHTML = 
                    '<div class="loading-container" style="color: #f93e3e;">' +
                    '<span>Error loading API documentation: ' + err.message + '</span></div>';
            }
        };
    </script>
</body>
</html>
    `);
});

// Debug middleware to log requests before CSRF
app.use((req, res, next) => {
    if (req.path.includes('/api/adaptations')) {
        safeLog('debug', 'Before CSRF', { path: req.path, method: req.method });
    }
    next();
});

// ============================================
// CSRF BYPASS FOR AUTH ROUTES AND SAFE METHODS
// ============================================
// These routes need to work without CSRF token on first load:
// - /api/auth/signin - User login (first action, no CSRF yet)
// - /api/auth/refresh - Token refresh (called on page load before CSRF fetch)
// - /api/auth/me - Get current user (GET, already excluded by ignoredMethods)
// - /api/auth/logout - Logout (should work even if CSRF is stale)
// - /api/auth/register - User registration (first action, no CSRF yet)
const csrfExemptPaths = [
    '/api/auth/signin',
    '/api/auth/refresh',
    '/api/auth/logout',
    '/api/auth/register',
    '/generate-pdf'  // PDF generation proxy - internal server-to-server call
];

// Safe HTTP methods that should never require CSRF validation
const csrfSafeMethods = ['GET', 'HEAD', 'OPTIONS'];

// Apply CSRF protection conditionally
app.use((req, res, next) => {
    // Skip CSRF completely for safe methods (GET, HEAD, OPTIONS)
    // This prevents 400 errors from corrupted/expired CSRF cookies on page load
    if (csrfSafeMethods.includes(req.method)) {
        return next();
    }
    // Skip CSRF for exempt paths (auth routes)
    if (csrfExemptPaths.includes(req.path)) {
        safeLog('debug', 'CSRF bypassed for exempt path', { path: req.path, method: req.method });
        return next();
    }
    // Apply CSRF protection for all other routes (POST, PUT, DELETE, PATCH)
    safeLog('debug', 'Applying CSRF protection', { path: req.path, method: req.method });
    doubleCsrfProtection(req, res, next);
});

// CSRF error handler - must be right after CSRF middleware
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf') || err.message?.includes('CSRF')) {
        safeLog('error', 'CSRF Error', { 
            error: err.message, 
            method: req.method, 
            path: req.path,
            hasCsrfCookie: !!req.cookies?.['x-csrf-token'],
            hasCsrfHeader: !!req.headers['x-csrf-token']
        });
        // Clear the corrupted CSRF cookie to allow fresh token generation
        res.clearCookie('x-csrf-token', { path: '/' });
        return res.status(403).json({ 
            error: 'Invalid CSRF token',
            message: 'Please refresh the page and try again'
        });
    }
    next(err);
});

safeLog('info', 'CSRF protection enabled');

// ============================================
// API CACHE CONTROL
// ============================================
// Prevent browser/proxy caching of API responses to avoid stale 400 errors
app.use('/api', (req, res, next) => {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
    });
    next();
});

// ============================================
// ROUTES
// ============================================

// Health check
app.use('/health', healthRoutes);

// Metrics endpoints
app.use('/api/metrics', metricsRoutes);

// Authentication routes
app.use('/api/auth', authRoutes);

// Settings routes
app.use('/api/settings', settingsRoutes);

// Missions routes
app.use('/api/missions', missionsRoutes);

// Resumes routes
app.use('/api/resumes', resumesRoutes);

// Templates routes
app.use('/api/templates', templatesRoutes);

// Customers routes
app.use('/api/customers', customersRoutes);

// LLM proxy routes
app.use('/api/llm', llmRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Adaptations routes
app.use('/api/adaptations', adaptationsRoutes);

// Tags routes
app.use('/api/tags', tagsRoutes);

// Users routes
app.use('/api/users', usersRoutes);

// Chatbot routes
app.use('/api/chatbot', chatbotRoutes);

// Market Radar routes
app.use('/api/market-radar', marketRadarRoutes);

// Rome 4.0 routes
app.use('/api/rome', romeRoutes);

// API Documentation routes
app.use('/api/docs', docsRoutes);

// ============================================
// PDF SERVER PROXY
// ============================================
// Proxy requests to the PDF server running on port 3002
const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://localhost:3002';

app.post('/generate-pdf', async (req, res) => {
    try {
        safeLog('info', 'Proxying PDF generation request to PDF server');
        
        const response = await fetch(`${PDF_SERVER_URL}/generate-pdf`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(req.body)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            safeLog('error', 'PDF server error', { status: response.status, error: errorText });
            return res.status(response.status).json({ error: errorText });
        }
        
        // Stream the PDF response back to the client
        res.setHeader('Content-Type', 'application/pdf');
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
            res.setHeader('Content-Disposition', contentDisposition);
        }
        
        const buffer = await response.arrayBuffer();
        res.send(Buffer.from(buffer));
    } catch (error) {
        safeLog('error', 'PDF proxy error', { error: error.message });
        res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
    }
});

// ============================================
// STATIC FILES & SPA FALLBACK
// ============================================

// Serve static files from the dist directory (production build)
const distPath = path.join(__dirname, '..', 'client', 'dist');

// MIME types for pre-compressed files
const mimeTypes = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.xml': 'application/xml',
    '.txt': 'text/plain',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

// Serve pre-compressed files (Brotli and Gzip) if available
// This middleware checks for .br and .gz versions of requested files
app.use((req, res, next) => {
    // Only for static assets (JS, CSS, etc.)
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
        const acceptEncoding = req.headers['accept-encoding'] || '';
        const filePath = path.join(distPath, req.path);
        const ext = path.extname(req.path).toLowerCase();
        const mimeType = mimeTypes[ext];
        
        // Try Brotli first (better compression)
        if (acceptEncoding.includes('br')) {
            const brPath = filePath + '.br';
            if (fs.existsSync(brPath)) {
                res.set('Content-Encoding', 'br');
                res.set('Vary', 'Accept-Encoding');
                if (mimeType) res.set('Content-Type', mimeType);
                req.url = req.url + '.br';
            }
        }
        // Fallback to Gzip
        else if (acceptEncoding.includes('gzip')) {
            const gzPath = filePath + '.gz';
            if (fs.existsSync(gzPath)) {
                res.set('Content-Encoding', 'gzip');
                res.set('Vary', 'Accept-Encoding');
                if (mimeType) res.set('Content-Type', mimeType);
                req.url = req.url + '.gz';
            }
        }
    }
    next();
});

// Static file serving with aggressive caching for hashed assets
app.use(express.static(distPath, {
    etag: true,
    lastModified: true,
    redirect: false,
    setHeaders: (res, filePath) => {
        // Hashed assets (contain hash in filename) - cache for 1 year
        if (filePath.match(/\.[a-f0-9]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // Assets directory (Vite build output) - cache for 1 year
        else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // HTML files - no cache (always fetch fresh for SPA)
        else if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
        // Other static files - cache for 1 day
        else {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
}));

// SPA fallback - serve index.html for all non-API routes
// This handles client-side routing (React Router)
app.get('*', (req, res, next) => {
    // Skip API routes - they should return 404 if not found
    if (req.path.startsWith('/api/')) {
        return next();
    }
    // Skip if requesting a file with extension (assets, images, etc.)
    if (path.extname(req.path) && req.path !== '/') {
        return next();
    }
    // Serve index.html for all other routes (SPA client-side routing)
    res.sendFile(path.join(distPath, 'index.html'), (err) => {
        if (err) {
            safeLog('error', 'Error serving index.html', { error: err.message, path: req.path });
            next(err);
        }
    });
});

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

// HTTPS Configuration
const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

let server;

if (HTTPS_ENABLED) {
    // Load SSL certificates
    const certsPath = path.join(__dirname, '..', 'certificates');
    const privateKey = fs.readFileSync(path.join(certsPath, 'private.key'), 'utf8');
    const certificate = fs.readFileSync(path.join(certsPath, 'certificate.crt'), 'utf8');
    
    const httpsOptions = {
        key: privateKey,
        cert: certificate
    };
    
    server = https.createServer(httpsOptions, app);
    server.listen(HTTPS_PORT, async () => {
        await onServerStart('HTTPS', HTTPS_PORT);
    });
} else {
    server = app.listen(PORT, async () => {
        await onServerStart('HTTP', PORT);
    });
}

async function onServerStart(protocol, port) {
    // Clean all caches on startup
    console.log('\n🧹 Cleaning all caches on startup...');
    try {
        await cleanupAllCaches();
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        invalidateTagsCache();
        console.log('✅ All caches cleaned successfully\n');
    } catch (error) {
        console.error('⚠️  Error cleaning caches on startup:', error);
    }
    
    // Set server timeouts to 70 minutes for long-running requests (trends collection can take up to 1 hour)
    const SEVENTY_MINUTES = 70 * 60 * 1000;
    server.timeout = SEVENTY_MINUTES;
    server.keepAliveTimeout = SEVENTY_MINUTES;
    server.headersTimeout = SEVENTY_MINUTES + 10000; // Slightly higher than keepAliveTimeout
    
    console.log('\n=================================');
    console.log('🚀 PROXY SERVER STARTED');
    console.log('=================================');
    console.log(`📡 Port: ${port}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔒 CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log('=================================');
    console.log('📋 Modular Architecture:');
    console.log('  ✅ Health & Metrics');
    console.log('  ✅ Authentication');
    console.log('  ✅ Settings');
    console.log('  ✅ Missions');
    console.log('  ✅ Resumes');
    console.log('  ✅ Templates');
    console.log('  ✅ Customers');
    console.log('  ✅ LLM Proxy');
    console.log('  ✅ Admin');
    console.log('=================================');
    console.log('🔧 Features Enabled:');
    console.log('  ✅ Rate Limiting');
    console.log('  ✅ CSRF Protection');
    console.log('  ✅ Metrics Tracking');
    console.log('  ✅ Request Logging');
    console.log('  ✅ Compression');
    console.log('  ✅ Security Headers');
    console.log('  ✅ File Cleanup (hourly)');
    console.log('  ✅ Token Blacklist');
    console.log('=================================\n');
    
    // Initialize PostgreSQL database connection
    console.log('🔌 Initializing PostgreSQL database...');
    const dbInitialized = await initializeDatabase();
    if (dbInitialized) {
        console.log('✅ PostgreSQL database initialized successfully\n');
    } else {
        console.error('❌ PostgreSQL database initialization failed - check logs\n');
    }
    
    // Start periodic cleanup of temporary files
    startPeriodicCleanup(60 * 60 * 1000, 60 * 60 * 1000); // Every hour, delete files older than 1 hour
    
    // Start periodic cleanup of expired blacklisted tokens
    startBlacklistCleanup(60 * 60 * 1000); // Every hour
    
    // Start periodic cleanup of Market Radar caches (every 15 minutes)
    startMarketRadarCacheCleanup();
    
    console.log(`🔐 Protocol: ${protocol}`);
}

// Graceful shutdown with proper cleanup
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} signal received: initiating graceful shutdown`);
    
    // Force exit timer - use unref() so it doesn't keep process alive
    const forceExitTimer = setTimeout(() => {
        safeLog('error', 'Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
    forceExitTimer.unref(); // Don't keep process alive waiting for this timer
    
    // Stop accepting new connections
    server.close(async () => {
        console.log('✅ HTTP server closed');
        
        // Cleanup intervals and caches
        cleanupMemoryMonitor();
        cleanupRateLimitStore();
        cleanupAllCaches();
        destroyBlacklist();
        stopPeriodicCleanup();
        stopMarketRadarCacheCleanup();
        metrics.stopPeriodicSave();
        
        // Cleanup Market Radar caches (large data sets)
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        console.log('✅ Market Radar caches cleaned up');
        
        // Close PostgreSQL connection pool
        try {
            await closePool();
            console.log('✅ PostgreSQL connection pool closed');
        } catch (error) {
            console.error('⚠️  Error closing PostgreSQL pool:', error.message);
        }
        
        // Destroy HTTP agents to close all sockets
        if (httpAgent) {
            httpAgent.destroy();
            console.log('✅ HTTP agent destroyed');
        }
        if (httpsAgent) {
            httpsAgent.destroy();
            console.log('✅ HTTPS agent destroyed');
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            console.log('✅ Garbage collection triggered');
        }
        
        // Clear the force exit timer
        clearTimeout(forceExitTimer);
        
        console.log('✅ Graceful shutdown complete');
        
        // Use setImmediate to ensure all cleanup is done before exiting
        setImmediate(() => {
            process.exit(0);
        });
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Memory monitoring with garbage collection hints
const memoryMonitorInterval = setInterval(() => {
    const memUsage = process.memoryUsage();
    const memMB = {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Log memory at info level every 5 minutes for monitoring
    safeLog('info', 'Memory usage', memMB);
    
    if (memMB.heapUsed > 500) {
        safeLog('warn', 'High memory usage detected', { heapUsedMB: memMB.heapUsed });
        // Trigger garbage collection if available (requires --expose-gc flag)
        if (global.gc) {
            safeLog('info', 'Triggering garbage collection');
            global.gc();
        }
        // Clear Market Radar caches if memory is high
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        safeLog('info', 'Market Radar caches cleared due to high memory');
    }
}, 300000); // Every 5 minutes

// Market Radar cache cleanup interval (every 15 minutes)
let marketRadarCleanupInterval = null;

function startMarketRadarCacheCleanup() {
    // Clear caches every 15 minutes to prevent memory buildup
    marketRadarCleanupInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        // Only clear if memory usage is above 300MB
        if (heapUsedMB > 300) {
            safeLog('info', 'Periodic Market Radar cache cleanup', { heapUsedMB });
            cleanupFactsCache();
            cleanupTrendsCache();
            cleanupMetiersCache();
        }
    }, 15 * 60 * 1000); // 15 minutes
    
    safeLog('info', 'Market Radar cache cleanup scheduled (every 15 min if memory > 300MB)');
}

function stopMarketRadarCacheCleanup() {
    if (marketRadarCleanupInterval) {
        clearInterval(marketRadarCleanupInterval);
        marketRadarCleanupInterval = null;
    }
}

// Cleanup interval on shutdown
const cleanupMemoryMonitor = () => {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
    }
    stopMarketRadarCacheCleanup();
};

export default app;
