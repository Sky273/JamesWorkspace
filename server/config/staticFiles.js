/**
 * Static Files Configuration
 * Pre-compressed file serving, static assets, SPA fallback
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { safeLog } from '../utils/logger.backend.js';

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

/**
 * Configure static file serving with pre-compression and SPA fallback
 * @param {express.Application} app - Express application
 * @param {string} serverDir - __dirname of the server directory
 */
export function configureStaticFiles(app, serverDir) {
    const distPath = path.join(serverDir, '..', 'client', 'dist');

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
                    res.set('X-Content-Type-Options', 'nosniff');
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
                    res.set('X-Content-Type-Options', 'nosniff');
                    res.set('Content-Encoding', 'gzip');
                    res.set('Vary', 'Accept-Encoding');
                    if (mimeType) res.set('Content-Type', mimeType);
                    req.url = req.url + '.gz';
                }
            }
        }
        next();
    });

    // Serve logos from uploads/logos directory (persisted in Docker)
    const logosPath = path.join(serverDir, '..', 'uploads', 'logos');
    app.use('/logos', express.static(logosPath, {
        etag: true,
        lastModified: true,
        setHeaders: (res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
        }
    }));

    // Static file serving with aggressive caching for hashed assets
    app.use(express.static(distPath, {
        etag: true,
        lastModified: true,
        redirect: false,
        setHeaders: (res, filePath) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
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
    app.get('/*splat', (req, res, next) => {
        // Skip API routes - they should return 404 if not found
        if (req.path.startsWith('/api/')) {
            return next();
        }
        // Skip if requesting a file with extension (assets, images, etc.)
        if (path.extname(req.path) && req.path !== '/') {
            return next();
        }
        // Serve index.html for all other routes (SPA client-side routing)
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'), (err) => {
            if (err) {
                safeLog('error', 'Error serving index.html', { error: err.message, path: req.path });
                next(err);
            }
        });
    });
}
