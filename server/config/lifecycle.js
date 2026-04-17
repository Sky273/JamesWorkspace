/**
 * Server Lifecycle Management
 * Startup initialization, graceful shutdown, memory monitoring
 */

import https from 'https';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { safeLog } from '../utils/logger.backend.js';
import { PORT, ALLOWED_ORIGINS } from './constants.js';
import { httpAgent, httpsAgent } from './axios.js';
import { startRuntimeMaintenance, stopRuntimeMaintenance } from './lifecycle/runtimeMaintenance.js';

import { initializeDatabase, closePool } from '../services/database.service.js';

// ============================================
// MEMORY MONITORING
// ============================================

function getPositiveTimeout(envName, defaultValue) {
    const parsed = Number.parseInt(process.env[envName] || '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

// ============================================
// SERVER STARTUP
// ============================================

/**
 * Called after the HTTP(S) server starts listening
 */
async function onServerStart(server, protocol, port) {
    // Keep request timeout configurable for long-running collection jobs, but keep idle connection
    // timeouts short to reduce socket retention and slow-client exposure.
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
    
    // Initialize PostgreSQL database connection
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

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

/**
 * Start the server and configure graceful shutdown
 * @param {express.Application} app - Express application
 * @param {string} serverDir - __dirname of the server directory
 * @returns {http.Server|https.Server} The server instance
 */
export function startServer(app, serverDir) {
    const HTTPS_ENABLED = process.env.HTTPS_ENABLED === 'true';
    const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

    let server;

    if (HTTPS_ENABLED) {
        // Load SSL certificates
        const certsPath = path.join(serverDir, '..', 'certificates');
        const privateKey = fs.readFileSync(path.join(certsPath, 'private.key'), 'utf8');
        const certificate = fs.readFileSync(path.join(certsPath, 'certificate.crt'), 'utf8');
        
        // Strong TLS configuration - only allow secure cipher suites
        // Reference: https://wiki.mozilla.org/Security/Server_Side_TLS
        const httpsOptions = {
            key: privateKey,
            cert: certificate,
            // Minimum TLS 1.2 (TLS 1.0 and 1.1 are deprecated - RFC 8996)
            minVersion: 'TLSv1.2',
            // Belt-and-suspenders: explicitly disable deprecated protocols via OpenSSL flags
            // This guards against any OpenSSL fallback behavior
            secureOptions:
                crypto.constants.SSL_OP_NO_SSLv2 |
                crypto.constants.SSL_OP_NO_SSLv3 |
                crypto.constants.SSL_OP_NO_TLSv1 |
                crypto.constants.SSL_OP_NO_TLSv1_1 |
                crypto.constants.SSL_OP_NO_TICKET,  // Disable session tickets for forward secrecy
            // Strong cipher suites only (Mozilla Intermediate compatibility)
            // Ordered by preference: ECDHE > DHE, AES-GCM > AES-CBC, SHA384 > SHA256
            // Explicit exclusions prevent any OpenSSL defaults from leaking weak ciphers
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
            // Prefer server cipher order
            honorCipherOrder: true,
        };
        
        server = https.createServer(httpsOptions, app);
        server.listen(HTTPS_PORT, '0.0.0.0', async () => {
            await onServerStart(server, 'HTTPS', HTTPS_PORT);
        });
    } else {
        server = app.listen(PORT, '0.0.0.0', async () => {
            await onServerStart(server, 'HTTP', PORT);
        });
    }

    // Configure graceful shutdown
    let shutdownInProgress = false;
    const gracefulShutdown = async (signal, exitCode = 0) => {
        if (shutdownInProgress) {
            safeLog('warn', 'Graceful shutdown already in progress', { signal, exitCode });
            return;
        }

        shutdownInProgress = true;
        safeLog('info', 'Graceful shutdown initiated', { signal, exitCode });
        
        // Force exit timer - use unref() so it doesn't keep process alive
        const forceExitTimer = setTimeout(() => {
            safeLog('error', 'Forced shutdown after timeout', { exitCode });
            process.exit(1);
        }, 10000);
        forceExitTimer.unref();
        
        // Stop accepting new connections
        server.close(async (closeError) => {
            if (closeError && closeError.code !== 'ERR_SERVER_NOT_RUNNING') {
                safeLog('error', 'Error while closing HTTP server', {
                    error: closeError.message,
                    code: closeError.code,
                    exitCode,
                });
                clearTimeout(forceExitTimer);
                setImmediate(() => {
                    process.exit(exitCode || 1);
                });
                return;
            }

            safeLog('info', 'HTTP server closed');
            await stopRuntimeMaintenance();
            
            // Close PostgreSQL connection pool
            try {
                await closePool();
                safeLog('info', 'PostgreSQL connection pool closed');
            } catch (error) {
                safeLog('error', 'Error closing PostgreSQL pool', { error: error.message });
            }
            
            // Destroy HTTP agents to close all sockets
            if (httpAgent) {
                httpAgent.destroy();
                safeLog('debug', 'HTTP agent destroyed');
            }
            if (httpsAgent) {
                httpsAgent.destroy();
                safeLog('debug', 'HTTPS agent destroyed');
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
                safeLog('debug', 'Garbage collection triggered');
            }
            
            clearTimeout(forceExitTimer);
            safeLog('info', 'Graceful shutdown complete', { exitCode });
            
            setImmediate(() => {
                process.exit(exitCode);
            });
        });
    };

    server.gracefulShutdown = gracefulShutdown;

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Windows-specific: handle SIGBREAK (Ctrl+Break) and process exit
    if (process.platform === 'win32') {
        process.on('SIGBREAK', () => gracefulShutdown('SIGBREAK'));
    }

    // Handle uncaught process termination (e.g., parent process killed)
    process.on('exit', (code) => {
        if (code !== 0) {
            safeLog('warn', 'Process exiting with non-zero code', { code });
        }
    });

    // Handle when parent process disconnects (IPC channel closed)
    process.on('disconnect', () => {
        safeLog('info', 'Parent process disconnected, initiating shutdown');
        gracefulShutdown('DISCONNECT');
    });

    return server;
}
