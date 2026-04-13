/**
 * Security Configuration
 * CSP (Content Security Policy), CORS, CSRF protection
 */

import helmet from 'helmet';
import cors from 'cors';
import { doubleCsrf } from 'csrf-csrf';
import { ALLOWED_ORIGINS } from './constants.js';
import { safeLog } from '../utils/logger.backend.js';
import { normalizeOrigin } from '../utils/originUtils.js';

const isProduction = process.env.NODE_ENV === 'production';
const cspScriptSources = [
    "'self'",
    "blob:",            // Required: PDF.js worker scripts
    "https://unpkg.com",                      // Swagger UI scripts
    "https://basemaps.cartocdn.com",          // MapLibre GL scripts from style
    "https://*.basemaps.cartocdn.com",        // MapLibre GL scripts from tiles
    "https://challenges.cloudflare.com",      // Cloudflare Turnstile
    // Cloudflare injects inline scripts (Rocket Loader, Email Obfuscation, etc.)
    // These hashes allow the specific Cloudflare-injected scripts without 'unsafe-inline'.
    // Warning: Cloudflare can change these at any time. If new CSP violations appear for
    // inline scripts, add the hash from the browser error or disable Rocket Loader
    // and Email Obfuscation in the Cloudflare dashboard for a permanent fix.
    "'sha256-A1+e72bQn7hPqkdKAAlQSbFpetfFWJBOj5vG34ZrAxU='",  // Cloudflare injected script
    "'sha256-P5AT03Ewswrka26JysiPTKxr4GXeRKQKbPiV4tBCy2k='",  // Cloudflare injected script (variant)
    "'sha256-yZlHOZ5xtWE8Evaf3HFDtJxWosKnkweYfd1MWFsufuI='",  // Cloudflare injected script (variant 2)
    "'sha256-OJ/4e+qcd2xOGOLtsh+uuewAvle/9b2F/3/WwzgLXoE='",  // Cloudflare injected script (variant 3)
    "'sha256-oR7U6/Q03fkV/ymCI4KGJsn1/qEg14weQX35BoNd6/8='",  // Cloudflare injected script (variant 4)
    "'sha256-FID3c60H9c7lktAfbhJ+B/txDAbRaj0JQWM8iPEiRXk='",  // Cloudflare injected script (variant 5)
    "'sha256-nileZXtiIiKtSt6FJjdZt1szHltIjlRss/RxLHOpD0U='",  // Cloudflare injected script (variant 6)
    "'sha256-9/iGFMNY/CbhlXfMrWEY3i4mlcr9rSmQhnjr6XrXZ+Y='",  // Cloudflare injected script (variant 7)
    "'sha256-UFeEB6QOsP3dj5nAthz/Vj+mBX8YsHKuWsej2r/bdtQ='",  // Cloudflare injected script (variant 8)
    "'sha256-qaj05s9NhZOXkIoIZ+kerlMPfSrHx/V6d1npNfWzDPg='",  // Cloudflare injected script (variant 9)
    "'sha256-rhg1WTVNH6IH7t21vpjRMtoTx/6b+Ehu0Ah6+2f5srg='",  // Cloudflare challenge platform inline bootstrap (variant 2)
    "'sha256-xdWZbq58NNjYTvyvH8NKkmmavhR878q1602rldMTf1k='"   // Cloudflare challenge platform inline bootstrap
];

// ============================================
// CONTENT SECURITY POLICY
// ============================================
// 
// SECURITY TRADE-OFFS:
// - 'unsafe-inline' in style-src-elem and style-src-attr is required by
//   Tiptap/ProseMirror and UI libraries for dynamic styles.
//   Removed from the broad style-src directive for stricter auditing.
//   This has NO XSS risk (styles cannot execute scripts).
//
// - PDF.js requires blob: for its worker functionality.
//   Risk mitigation: PDF files are processed server-side when possible.
//
// CSP HARDENING (achieved):
// - NO 'unsafe-eval' in scriptSrc (TinyMCE replaced by Tiptap which does not use eval)
// - NO 'unsafe-inline' in scriptSrc (Swagger UI script externalized)
// - NO 'unsafe-inline' in scriptSrcAttr (no inline event handlers)
// - object-src 'none' blocks plugins like Flash
// - base-uri 'self' prevents base tag hijacking
// - frame-ancestors 'self' prevents clickjacking
//
// IMPLEMENTED:
// 1. Server-side PDF text extraction (POST /api/resumes/extract-pdf) reduces client-side PDF.js usage
// 2. Subresource Integrity (SRI) for Swagger UI external scripts/styles (routeRegistry.js)
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
                scriptSrc: cspScriptSources,
                scriptSrcElem: cspScriptSources,
                scriptSrcAttr: ["'none'"], // No inline event handlers allowed
                styleSrc: [
                    "'self'",
                    "https://fonts.googleapis.com",
                    "https://unpkg.com",  // Swagger UI styles
                    "https://basemaps.cartocdn.com", // MapLibre GL styles
                    "https://*.basemaps.cartocdn.com", // MapLibre GL styles from subdomains
                    "https://challenges.cloudflare.com" // Cloudflare Turnstile
                ],
                // CSP Level 3: granular style directives replace broad 'unsafe-inline' in styleSrc
                styleSrcElem: [
                    "'self'",
                    "'unsafe-inline'", // Required: UI libraries dynamically inject <style> elements
                    "https://fonts.googleapis.com",
                    "https://unpkg.com",
                    "https://basemaps.cartocdn.com",
                    "https://*.basemaps.cartocdn.com",
                    "https://challenges.cloudflare.com"
                ],
                styleSrcAttr: [
                    "'unsafe-inline'" // Required: Tiptap/ProseMirror sets inline style attributes
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
                    "https://unpkg.com",                     // Swagger UI favicon
                    "https://basemaps.cartocdn.com",         // MapLibre GL map tiles
                    "https://*.basemaps.cartocdn.com"        // MapLibre GL map tiles from subdomains
                ],
                connectSrc: [
                    "'self'",
                    "blob:", // Required for MapLibre GL
                    "https://api.openai.com",
                    "https://api.anthropic.com",
                    "https://challenges.cloudflare.com", // Cloudflare Turnstile verification assets
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
                childSrc: ["'self'", "blob:", "https://challenges.cloudflare.com"], // For iframes and workers
                frameSrc: ["'self'", "https://challenges.cloudflare.com"],
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
            const normalizedOrigin = normalizeOrigin(origin);

            if (ALLOWED_ORIGINS.includes(normalizedOrigin)) {
                safeLog('debug', 'CORS: Allowing request from allowed origin', {
                    origin,
                    normalizedOrigin
                });
                return callback(null, true);
            }
            
            // Log all origins for debugging
            safeLog('warn', 'CORS: Rejected request from unauthorized origin', { 
                origin, 
                normalizedOrigin,
                allowedOrigins: ALLOWED_ORIGINS 
            });
            const corsError = new Error('Not allowed by CORS');
            corsError.statusCode = 403;
            corsError.code = 'CORS_ORIGIN_DENIED';
            callback(corsError);
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
    const csrfCookieOptions = {
        httpOnly: true,
        sameSite: isProduction ? 'strict' : 'lax',
        secure: useSecureCookies,
        path: '/',
        // Allow cookie to work with resumeconverter.net domain in development
        domain: process.env.COOKIE_DOMAIN || undefined
    };

    // Configure CSRF protection
    const csrfProtection = doubleCsrf({
        getSecret: () => {
            if (!process.env.CSRF_SECRET) {
                throw new Error('CSRF_SECRET environment variable is required');
            }
            return process.env.CSRF_SECRET;
        },
        cookieName: 'x-csrf-token',
        cookieOptions: csrfCookieOptions,
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
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.set('Pragma', 'no-cache');
            res.json({ csrfToken });
        } catch (error) {
            safeLog('error', 'Error generating CSRF token', { error: error.message });
            res.status(500).json({ error: 'Failed to generate CSRF token' });
        }
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
        '/api/auth/register'
    ];

    // Paths that start with these prefixes are exempt from CSRF (public consent response)
    const csrfExemptPrefixes = [
        '/api/consent/respond/',  // Public consent response page (no auth required)
        '/api/gdpr/mail/callback'  // OAuth callback for GDPR Gmail
    ];

    // Safe HTTP methods that should never require CSRF validation
    const csrfSafeMethods = ['GET', 'HEAD', 'OPTIONS', 'PROPFIND'];

    // Apply CSRF protection conditionally
    app.use((req, res, next) => {
        // CSRF only applies to API mutations. Ignore static/site probes entirely.
        if (!req.path.startsWith('/api/')) {
            return next();
        }
        // Skip CSRF completely for safe methods (GET, HEAD, OPTIONS, PROPFIND)
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
            res.clearCookie('x-csrf-token', csrfCookieOptions);
            return res.status(403).json({ 
                error: 'Invalid CSRF token',
                message: 'Please refresh the page and try again'
            });
        }
        next(err);
    });

    safeLog('info', 'CSRF protection enabled');
}


