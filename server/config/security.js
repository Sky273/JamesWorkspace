/**
 * Security Configuration
 * CSP (Content Security Policy), CORS, CSRF protection
 */

import helmet from 'helmet';
import cors from 'cors';
import { doubleCsrf } from 'csrf-csrf';
import { ALLOWED_ORIGINS, JWT_SECRET } from './constants.js';
import { safeLog } from '../utils/logger.backend.js';

const isProduction = process.env.NODE_ENV === 'production';

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
// SECURITY ENHANCEMENTS:
// - 'strict-dynamic' allows trusted scripts to load other scripts (modern browsers)
// - object-src 'none' blocks plugins like Flash
// - base-uri 'self' prevents base tag hijacking
// - frame-ancestors 'self' prevents clickjacking
//
// RECOMMENDATIONS FOR FUTURE:
// 1. Monitor TinyMCE updates for nonce/hash CSP support
// 2. Consider server-side PDF text extraction to reduce client-side PDF.js usage
// 3. Implement Subresource Integrity (SRI) for external scripts
// ============================================

export function configureHelmet(app) {
    app.use(helmet({
        // HSTS - Force HTTPS for 1 year, include subdomains
        hsts: {
            maxAge: 31536000, // 1 year in seconds
            includeSubDomains: true,
            preload: true // Allow submission to browser preload lists
        },
        contentSecurityPolicy: {
            directives: {
                // STRICT CSP: default-src 'none' requires explicit directives for all resource types
                defaultSrc: ["'none'"],
                scriptSrc: [
                    "'self'",
                    "https://basemaps.cartocdn.com", // MapLibre GL scripts from style
                    "https://*.basemaps.cartocdn.com" // MapLibre GL scripts from tiles
                ],
                scriptSrcAttr: ["'none'"], // Block inline event handlers (not used in app)
                styleSrc: [
                    "'self'",
                    "'unsafe-inline'", // Required: TinyMCE dynamic styles (cannot be removed per TinyMCE docs)
                    "https://fonts.googleapis.com",
                    "https://unpkg.com",  // Swagger UI styles
                    "https://basemaps.cartocdn.com", // MapLibre GL styles
                    "https://*.basemaps.cartocdn.com" // MapLibre GL styles from subdomains
                ],
                fontSrc: [
                    "'self'",
                    "https://fonts.gstatic.com",
                    "https://basemaps.cartocdn.com", // MapLibre GL fonts
                    "https://*.basemaps.cartocdn.com", // MapLibre GL fonts from subdomains
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
                    "blob:", // Required for TinyMCE and MapLibre GL
                    "https://api.openai.com",
                    "https://api.anthropic.com",
                    "https://basemaps.cartocdn.com",     // MapLibre GL - base domain
                    "https://*.basemaps.cartocdn.com",   // MapLibre GL - all subdomains (tiles, etc.)
                    ...(isProduction ? [] : ["http://localhost:*", "ws://localhost:*"])
                ],
                workerSrc: [
                    "'self'",
                    "blob:",
                    "https://basemaps.cartocdn.com",     // MapLibre GL workers
                    "https://*.basemaps.cartocdn.com"    // MapLibre GL workers from subdomains
                ],
                childSrc: ["'self'", "blob:"], // For iframes and workers
                frameSrc: ["'self'"],
                frameAncestors: ["'self'"], // Prevent clickjacking
                objectSrc: ["'none'"],      // Block plugins (Flash, Java, etc.)
                mediaSrc: ["'self'"],       // Audio/video sources
                manifestSrc: ["'self'"],    // Web app manifests
                baseUri: ["'self'"],        // Prevent base tag hijacking
                formAction: ["'self'"],
                upgradeInsecureRequests: isProduction ? [] : null
            }
        },
        crossOriginEmbedderPolicy: false, // Required for external resources
        crossOriginResourcePolicy: { policy: "cross-origin" }
    }));
}

// ============================================
// CORS CONFIGURATION
// ============================================

export function configureCors(app) {
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
    app.options('/api/*path', cors(corsOptions));
}

// ============================================
// CSRF PROTECTION
// ============================================

export function configureCsrf(app) {
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
        '/generate-pdf',  // PDF generation proxy - internal server-to-server call
        '/generate-docx'  // DOCX generation proxy - internal server-to-server call
    ];

    // Paths that start with these prefixes are exempt from CSRF (public consent response)
    const csrfExemptPrefixes = [
        '/api/consent/respond/',  // Public consent response page (no auth required)
        '/api/gdpr/mail/callback'  // OAuth callback for GDPR Gmail
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
        // Skip CSRF for exempt prefixes (public consent routes)
        if (csrfExemptPrefixes.some(prefix => req.path.startsWith(prefix))) {
            safeLog('debug', 'CSRF bypassed for exempt prefix', { path: req.path, method: req.method });
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
}
