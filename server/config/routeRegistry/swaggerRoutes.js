import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { swaggerDocument } from '../swagger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function registerSwaggerRoutes(app) {
    app.get('/api/docs', (req, res) => {
        res.set({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.json(swaggerDocument);
    });

    app.use('/api/docs/static', express.static(
        path.join(__dirname, '..', '..', 'public'),
        { maxAge: '1d', etag: true }
    ));

    app.get('/api/docs/ui', (req, res) => {
        res.set({
            'Content-Type': 'text/html',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ResumeConverter API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css" integrity="sha384-rcbEi6xgdPk0iWkAQzT2F3FeBJXdG+ydrawGlfHAFIZG7wU6aKbQaRewysYpmrlW" crossorigin="anonymous" />
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
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js" integrity="sha384-NXtFPpN61oWCuN4D42K6Zd5Rt2+uxeIT36R7kpXBuY9tLnZorzrJ4ykpqwJfgjpZ" crossorigin="anonymous" charset="UTF-8"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-standalone-preset.js" integrity="sha384-qr68CD0cvHa88PmVu7e1a58Ego4qvKtcvcLdS2a8Mo5zILI01gyIV9jVwJk7X2NU" crossorigin="anonymous" charset="UTF-8"></script>
    <script src="/api/docs/static/swagger-init.js"></script>
</body>
</html>
        `);
    });
}
