import https from 'https';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { safeLog } from '../utils/logger.backend.js';
import { PORT, ALLOWED_ORIGINS } from './constants.js';
import { initializeDatabase } from '../services/database.service.js';
import { startRuntimeMaintenance } from './lifecycle/runtimeMaintenance.js';

function getPositiveTimeout(envName, defaultValue) {
    const parsed = Number.parseInt(process.env[envName] || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function buildHttpsOptions(serverDir) {
    const certsPath = path.join(serverDir, '..', 'certificates');
    const privateKey = fs.readFileSync(path.join(certsPath, 'private.key'), 'utf8');
    const certificate = fs.readFileSync(path.join(certsPath, 'certificate.crt'), 'utf8');

    return {
        key: privateKey,
        cert: certificate,
        minVersion: 'TLSv1.2',
        secureOptions:
            crypto.constants.SSL_OP_NO_SSLv2 |
            crypto.constants.SSL_OP_NO_SSLv3 |
            crypto.constants.SSL_OP_NO_TLSv1 |
            crypto.constants.SSL_OP_NO_TLSv1_1 |
            crypto.constants.SSL_OP_NO_TICKET,
        ciphers: [
            'ECDHE-ECDSA-AES128-GCM-SHA256',
            'ECDHE-RSA-AES128-GCM-SHA256',
            'ECDHE-ECDSA-AES256-GCM-SHA384',
            'ECDHE-RSA-AES256-GCM-SHA384',
            'ECDHE-ECDSA-CHACHA20-POLY1305',
            'ECDHE-RSA-CHACHA20-POLY1305',
            'DHE-RSA-AES128-GCM-SHA256',
            'DHE-RSA-AES256-GCM-SHA384',
            '!aNULL', '!eNULL', '!EXPORT', '!DES', '!RC4',
            '!3DES', '!MD5', '!PSK', '!SRP', '!CAMELLIA'
        ].join(':'),
        honorCipherOrder: true,
    };
}

export async function onServerStart(server, protocol, port) {
    const requestTimeoutMs = getPositiveTimeout('SERVER_REQUEST_TIMEOUT_MS', 70 * 60 * 1000);
    const keepAliveTimeoutMs = getPositiveTimeout('SERVER_KEEPALIVE_TIMEOUT_MS', 75 * 1000);
    const headersTimeoutMs = getPositiveTimeout('SERVER_HEADERS_TIMEOUT_MS', keepAliveTimeoutMs + 5 * 1000);
    server.timeout = requestTimeoutMs;
    server.keepAliveTimeout = keepAliveTimeoutMs;
    server.headersTimeout = Math.max(headersTimeoutMs, keepAliveTimeoutMs + 1000);

    safeLog('info', 'PROXY SERVER STARTED', {
        port,
        environment: process.env.NODE_ENV || 'development',
        corsOrigins: ALLOWED_ORIGINS,
        protocol,
        requestTimeoutMs,
        keepAliveTimeoutMs: server.keepAliveTimeout,
        headersTimeoutMs: server.headersTimeout,
        modules: ['Health & Metrics', 'Authentication', 'Settings', 'Missions', 'Resumes', 'Templates', 'Firms', 'LLM Proxy', 'Admin'],
        features: ['Rate Limiting', 'CSRF Protection', 'Metrics Tracking', 'Request Logging', 'Compression', 'Security Headers', 'File Cleanup', 'Token Blacklist']
    });

    safeLog('info', 'Initializing PostgreSQL database');
    const dbInitialized = await initializeDatabase();
    if (dbInitialized) {
        safeLog('info', 'PostgreSQL database initialized successfully');
    } else {
        safeLog('error', 'PostgreSQL database initialization failed');
        if (server?.gracefulShutdown) {
            safeLog('error', 'Stopping proxy server because PostgreSQL initialization is required at startup');
            server.gracefulShutdown('DB_INIT_FAILURE', 1);
            return;
        }
    }

    await startRuntimeMaintenance({ dbInitialized });
}

export function createListeningServer(app, serverDir) {
    const httpsEnabled = process.env.HTTPS_ENABLED === 'true';
    const httpsPort = process.env.HTTPS_PORT || 3443;

    if (httpsEnabled) {
        const server = https.createServer(buildHttpsOptions(serverDir), app);
        server.listen(httpsPort, '0.0.0.0', async () => {
            await onServerStart(server, 'HTTPS', httpsPort);
        });
        return server;
    }

    const server = app.listen(PORT, '0.0.0.0', async () => {
        await onServerStart(server, 'HTTP', PORT);
    });
    return server;
}
