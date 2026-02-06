/**
 * API Documentation Routes
 * Serves OpenAPI/Swagger documentation
 */

import express from 'express';
import { openApiSpec } from '../docs/openapi.js';

const router = express.Router();

// GET /api/docs - Get OpenAPI specification as JSON
router.get('/', (req, res) => {
    res.json(openApiSpec);
});

// GET /api/docs/ui - Serve Swagger UI HTML
router.get('/ui', (req, res) => {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResumeConverter API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        body { margin: 0; padding: 0; }
        .swagger-ui .topbar { display: none; }
        .swagger-ui .info { margin: 20px 0; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            SwaggerUIBundle({
                url: '/api/docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>
    `;
    res.type('html').send(html);
});

export default router;
