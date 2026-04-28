/**
 * Static Files Configuration
 * Pre-compressed file serving, static assets, SPA fallback
 */

import express from 'express';
import path from 'path';
import fs from 'fs';
import { safeLog } from '../utils/logger.backend.js';

const ROOT_UUID_PATH_PATTERN = /^\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function normalizeForPathChecks(filePath) {
    return String(filePath || '').replace(/\\/g, '/');
}

function isHashedAsset(requestPath) {
    const normalizedPath = normalizeForPathChecks(requestPath);
    const fileName = normalizedPath.split('/').pop() || '';
    return (
        /\.[a-z0-9_-]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(normalizedPath)
        || /-[a-z0-9_-]{8,}\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|ico)$/i.test(fileName)
        || normalizedPath.includes('/assets/')
    );
}

function applyStaticCacheHeaders(res, filePath, requestPath = filePath) {
    const normalizedFilePath = normalizeForPathChecks(filePath);
    const normalizedRequestPath = normalizeForPathChecks(requestPath);

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (isHashedAsset(normalizedRequestPath)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return;
    }

    if (normalizedFilePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
        return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
}

function normalizeStaticRequestPath(filePath) {
    return `/${String(filePath || '').replace(/\\/g, '/')}`;
}

function stripCompressionSuffix(filePath) {
    if (filePath.endsWith('.br') || filePath.endsWith('.gz')) {
        return filePath.slice(0, -3);
    }
    return filePath;
}

function buildPrecompressedAssetIndex(distPath) {
    const precompressedAssets = new Map();

    function walkDirectory(directoryPath) {
        let entries = [];
        try {
            entries = fs.readdirSync(directoryPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const entryPath = path.join(directoryPath, entry.name);
            if (entry.isDirectory()) {
                walkDirectory(entryPath);
                continue;
            }

            if (!entry.name.endsWith('.br') && !entry.name.endsWith('.gz')) {
                continue;
            }

            const compressedRequestPath = normalizeStaticRequestPath(
                stripCompressionSuffix(path.relative(distPath, entryPath))
            );
            const cachedEntry = precompressedAssets.get(compressedRequestPath) || { br: false, gzip: false };
            if (entry.name.endsWith('.br')) {
                cachedEntry.br = true;
            } else {
                cachedEntry.gzip = true;
            }
            precompressedAssets.set(compressedRequestPath, cachedEntry);
        }
    }

    walkDirectory(distPath);
    return precompressedAssets;
}

/**
 * Configure static file serving with pre-compression and SPA fallback
 * @param {express.Application} app - Express application
 * @param {string} serverDir - __dirname of the server directory
 */
export function configureStaticFiles(app, serverDir) {
    const configuredDistPath = process.env.STATIC_DIST_DIR;
    const distPath = configuredDistPath
        ? path.resolve(serverDir, '..', configuredDistPath)
        : path.join(serverDir, '..', 'client', 'dist');
    const precompressedAssetIndex = buildPrecompressedAssetIndex(distPath);

    // Serve pre-compressed files (Brotli and Gzip) if available.
    app.use((req, res, next) => {
        if (!req.path.startsWith('/api/') && !req.path.startsWith('/health')) {
            const acceptEncoding = req.headers['accept-encoding'] || '';
            const ext = path.extname(req.path).toLowerCase();
            const mimeType = mimeTypes[ext];
            const cachedVariants = precompressedAssetIndex.get(req.path);
            const originalRequestPath = req.path;
            
            if (cachedVariants?.br && acceptEncoding.includes('br')) {
                applyStaticCacheHeaders(res, originalRequestPath, originalRequestPath);
                res.set('Content-Encoding', 'br');
                res.set('Vary', 'Accept-Encoding');
                if (mimeType) res.set('Content-Type', mimeType);
                req.url = req.url + '.br';
            }
            // Gzip remains the fallback when Brotli is unavailable.
            else if (cachedVariants?.gzip && acceptEncoding.includes('gzip')) {
                applyStaticCacheHeaders(res, originalRequestPath, originalRequestPath);
                res.set('Content-Encoding', 'gzip');
                res.set('Vary', 'Accept-Encoding');
                if (mimeType) res.set('Content-Type', mimeType);
                req.url = req.url + '.gz';
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
            applyStaticCacheHeaders(res, '/logos');
        }
    }));

    // Static file serving with aggressive caching for hashed assets
    app.use(express.static(distPath, {
        etag: true,
        lastModified: true,
        redirect: false,
        setHeaders: (res, filePath) => {
            const uncompressedFilePath = stripCompressionSuffix(filePath);
            applyStaticCacheHeaders(res, uncompressedFilePath, uncompressedFilePath);
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
        // A root UUID path is never a client route. It usually means rendered
        // HTML/CSS referenced a broken relative resource URL.
        if (ROOT_UUID_PATH_PATTERN.test(req.path)) {
            return next();
        }
        // Serve index.html for all other routes (SPA client-side routing)
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
        res.sendFile(path.join(distPath, 'index.html'), (err) => {
            if (err) {
                safeLog('error', 'Error serving index.html', { error: err.message, path: req.path });
                next(err);
            }
        });
    });
}
