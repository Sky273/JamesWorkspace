/**
 * Route Registry
 * Registers all API routes and proxy endpoints on the Express app
 */

import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { safeLog } from '../utils/logger.backend.js';
import { swaggerDocument } from './swagger.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { validateBody, generatePdfProxySchema, generateDocxProxySchema } from '../utils/validation.js';
import { getPdfServerAuthHeaders } from '../utils/pdfServerAuth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import healthRoutes from '../routes/health.routes.js';
import metricsRoutes from '../routes/metrics.routes.js';
import authRoutes from '../routes/auth.routes.js';
import settingsRoutes from '../routes/settings.routes.js';
import missionsRoutes from '../routes/missions.routes.js';
import resumesRoutes from '../routes/resumes.routes.js';
import templatesRoutes from '../routes/templates.routes.js';
import firmsRoutes from '../routes/firms.routes.js';
import llmRoutes from '../routes/llm.routes.js';
import adminRoutes from '../routes/admin.routes.js';
import adaptationsRoutes from '../routes/adaptations.routes.js';
import tagsRoutes from '../routes/tags.routes.js';
import usersRoutes from '../routes/users.routes.js';
import chatbotRoutes from '../routes/chatbot.routes.js';
import marketRadarRoutes from '../routes/marketRadar.routes.js';
import romeRoutes from '../routes/rome.routes.js';
import docsRoutes from '../routes/docs.routes.js';
import clientsRoutes from '../routes/clients.routes.js';
import resumeSubmissionsRoutes from '../routes/resumeSubmissions.routes.js';
import mailRoutes from '../routes/mail.routes.js';
import emailTemplatesRoutes from '../routes/emailTemplates.routes.js';
import consentRoutes from '../routes/consent.routes.js';
import gdprMailRoutes from '../routes/gdprMail.routes.js';
import twofaRoutes from '../routes/twofa.routes.js';
import gdprAuditRoutes from '../routes/gdprAudit.routes.js';
import resumeCommentsRoutes from '../routes/resumeComments.routes.js';
import shareRoutes from '../routes/share.routes.js';
import pipelineRoutes from '../routes/pipeline.routes.js';
import calendarRoutes from '../routes/calendar.routes.js';
import backupRoutes from '../routes/backup.routes.js';
import batchExportRoutes from '../routes/batchExport.routes.js';
import batchJobsRoutes from '../routes/batchJobs.routes.js';
import dealsRoutes from '../routes/deals.routes.js';

/**
 * Register Swagger API documentation routes (before CSRF middleware)
 */
export function registerSwaggerRoutes(app) {
    // Swagger JSON endpoint
    app.get('/api/docs', (req, res) => {
        res.set({
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        res.json(swaggerDocument);
    });

    // Serve Swagger UI static assets (externalized JS for CSP compliance)
    app.use('/api/docs/static', express.static(
        path.join(__dirname, '..', 'public'),
        { maxAge: '1d', etag: true }
    ));

    // Swagger UI HTML page (no inline scripts - CSP compliant)
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

/**
 * Register API cache control headers
 */
export function registerCacheControl(app) {
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
}

/**
 * Register all API routes
 */
export function registerApiRoutes(app) {
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

    // Firms routes
    app.use('/api/firms', firmsRoutes);

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

    // Clients routes
    app.use('/api/clients', clientsRoutes);

    // Deals routes
    app.use('/api/deals', dealsRoutes);

    // Resume Submissions routes
    app.use('/api/submissions', resumeSubmissionsRoutes);

    // Mail routes (Gmail OAuth + draft creation)
    app.use('/api/mail', mailRoutes);

    // Email templates routes
    app.use('/api/email-templates', emailTemplatesRoutes);

    // GDPR Consent routes
    app.use('/api/consent', consentRoutes);

    // GDPR Mail configuration routes
    app.use('/api/gdpr/mail', gdprMailRoutes);

    // GDPR Audit Log routes (admin only)
    app.use('/api/gdpr-audit', gdprAuditRoutes);

    // 2FA (Two-Factor Authentication) routes
    app.use('/api/2fa', twofaRoutes);

    // Resume Comments routes (mounted under /api/resumes for REST consistency)
    app.use('/api/resumes', resumeCommentsRoutes);

    // Share routes (public PDF sharing via QR code)
    app.use('/api/share', shareRoutes);

    // Pipeline routes (candidate selection pipeline and interviews)
    app.use('/api/pipeline', pipelineRoutes);

    // Calendar routes (Google Calendar integration)
    app.use('/api/calendar', calendarRoutes);

    // Backup routes (database backup via FTP/SFTP)
    app.use('/api/backup', backupRoutes);

    // Batch export routes (ZIP with multiple PDFs/DOCXs)
    app.use('/api/batch-export', batchExportRoutes);

    // Batch jobs routes (background processing)
    app.use('/api/batch-jobs', batchJobsRoutes);
}

/**
 * Register PDF/DOCX proxy routes
 */
export function registerProxyRoutes(app) {
    const PDF_SERVER_URL = process.env.PDF_SERVER_URL || 'http://localhost:3002';
    const proxyGuards = [
        authenticateToken,
        userRateLimit(20, 15 * 60 * 1000)
    ];

    async function relayBinaryResponse(response, res, fallbackContentType) {
        const contentType = response.headers.get('Content-Type') || fallbackContentType;
        const contentDisposition = response.headers.get('Content-Disposition');
        const contentLength = response.headers.get('Content-Length');

        res.setHeader('Content-Type', contentType);
        if (contentDisposition) {
            res.setHeader('Content-Disposition', contentDisposition);
        }
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        if (response.body) {
            await pipeline(Readable.fromWeb(response.body), res);
            return;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Length', buffer.length.toString());
        res.end(buffer);
    }

    app.post('/generate-pdf', ...proxyGuards, validateBody(generatePdfProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying PDF generation request to PDF server');
            
            const response = await fetch(`${PDF_SERVER_URL}/generate-pdf`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'PDF server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json({ error: errorText });
            }
            await relayBinaryResponse(response, res, 'application/pdf');
        } catch (error) {
            safeLog('error', 'PDF proxy error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate PDF', details: error.message });
            }
        }
    });

    app.post('/generate-docx', ...proxyGuards, validateBody(generateDocxProxySchema), async (req, res) => {
        try {
            safeLog('info', 'Proxying DOCX generation request to PDF server');
            
            const response = await fetch(`${PDF_SERVER_URL}/generate-docx`, {
                method: 'POST',
                headers: getPdfServerAuthHeaders({
                    'Content-Type': 'application/json'
                }),
                body: JSON.stringify(req.body)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                safeLog(response.status === 403 ? 'warn' : 'error', 'DOCX server error', {
                    status: response.status,
                    error: errorText,
                    probableCause: response.status === 403 ? 'PDF_SERVER_INTERNAL_TOKEN mismatch between proxy and PDF server' : undefined
                });
                return res.status(response.status).json({ error: errorText });
            }
            await relayBinaryResponse(
                response,
                res,
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            );
        } catch (error) {
            safeLog('error', 'DOCX proxy error', { error: error.message });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to generate DOCX', details: error.message });
            }
        }
    });
}



