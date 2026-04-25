import express from 'express';
import path from 'path';
import swaggerUiDist from 'swagger-ui-dist';
import { fileURLToPath } from 'url';
import { openApiDocument } from '../openapi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerUiAssetPath = swaggerUiDist.getAbsoluteFSPath();
const publicAssetPath = path.join(__dirname, '..', '..', 'public');

const noStoreHeaders = {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
};

function renderSwaggerHtml() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResumeConverter API Documentation</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css">
    <link rel="icon" type="image/png" href="/api/docs/assets/favicon-32x32.png" sizes="32x32">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js" charset="UTF-8" defer></script>
    <script src="/api/docs/assets/swagger-ui-standalone-preset.js" charset="UTF-8" defer></script>
    <script src="/api/docs/assets/swagger-initializer.js" charset="UTF-8" defer></script>
</body>
</html>`;
}

function renderSwaggerInitializer() {
    return `/* global SwaggerUIBundle, SwaggerUIStandalonePreset */
window.addEventListener('load', function () {
    window.ui = SwaggerUIBundle({
        url: '/api/docs',
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
        requestInterceptor: function (request) {
            request.credentials = 'include';
            return request;
        }
    });
});`;
}

export function registerSwaggerRoutes(app) {
    app.get('/api/docs', (_req, res) => {
        res.set(noStoreHeaders);
        res.type('application/json');
        res.json(openApiDocument);
    });

    app.get('/api/docs/ui', (_req, res) => {
        res.set(noStoreHeaders);
        res.type('text/html');
        res.send(renderSwaggerHtml());
    });

    app.get('/api/docs/assets/swagger-initializer.js', (_req, res) => {
        res.set({
            'Cache-Control': 'public, max-age=86400, immutable'
        });
        res.type('application/javascript');
        res.send(renderSwaggerInitializer());
    });

    app.use('/api/docs/assets', express.static(swaggerUiAssetPath, {
        etag: true,
        immutable: true,
        maxAge: '1d'
    }));

    app.use('/api/docs/static', express.static(publicAssetPath, {
        etag: true,
        maxAge: '1d'
    }));
}
