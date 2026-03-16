/**
 * Server Lifecycle Management
 * Startup initialization, graceful shutdown, memory monitoring
 */

import https from 'https';
import path from 'path';
import fs from 'fs';
import { safeLog } from '../utils/logger.backend.js';
import { PORT, ALLOWED_ORIGINS } from './constants.js';
import { httpAgent, httpsAgent } from './axios.js';

// Import cleanup/destroy functions
import { cleanupRateLimitStore } from '../middleware/rateLimit.middleware.js';
import { cleanupAllCaches } from '../services/cache.service.js';
import { startPeriodicCleanup, stopPeriodicCleanup } from '../utils/fileCleanup.js';
import { startBlacklistCleanup, destroyBlacklist } from '../services/tokenBlacklist.service.js';
import { cleanupFactsCache, destroyFactsCache } from '../services/marketFacts.service.js';
import { cleanupTrendsCache, destroyTrendsCache } from '../services/marketTrends.service.js';
import { cleanupMetiersCache, destroyMetiersCache } from '../services/rome.service.js';
import { invalidateTagsCache, destroyTagsCache } from '../routes/tags.routes.js';
import { destroyEscoCache } from '../services/escoService.js';
import { initializeDatabase, closePool } from '../services/database.service.js';
import { startScheduler, stopScheduler } from '../services/scheduler.service.js';
import { initBackupScheduler, stopBackupScheduler } from '../services/backup-scheduler.service.js';
import { initBackupTables } from '../services/backup.service.js';
import { initGdprAuditTable } from '../services/gdprAudit.service.js';
import { initResumeCommentsTable } from '../services/resumeComments.service.js';
import { initShareResumeTable } from '../services/shareResume.service.js';
import { initCandidatePipelineTable } from '../services/candidatePipeline.service.js';
import { initDealsTable } from '../services/deals.service.js';
import { initializeWorker as initBatchJobsWorker, startWorker as startBatchJobsWorker, stopWorker as stopBatchJobsWorker } from '../services/batchJobsWorker.service.js';
import { initCalendarTokensTable, destroyCalendarService } from '../services/calendar.service.js';
import { destroyAuthOauthStates } from '../routes/auth.routes.js';
import { destroyMailStatesCleanup } from '../routes/mail.routes.js';
import { destroyGoogleapis } from '../services/mail/gmailProvider.js';
import { destroyMjml } from '../services/emailTemplates.service.js';
import { metrics } from '../services/metrics.service.js';
import { destroySettingsCache } from '../services/settings.service.js';

// ============================================
// MEMORY MONITORING
// ============================================

let memoryMonitorInterval = null;
let marketRadarCleanupInterval = null;

function startMemoryMonitor() {
    memoryMonitorInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const memMB = {
            rss: Math.round(memUsage.rss / 1024 / 1024),
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024)
        };
        
        // Log memory at info level every 5 minutes for monitoring
        safeLog('info', 'Memory usage', memMB);
        
        if (memMB.heapUsed > 500) {
            safeLog('warn', 'High memory usage detected', { heapUsedMB: memMB.heapUsed });
            // Trigger garbage collection if available (requires --expose-gc flag)
            if (global.gc) {
                safeLog('info', 'Triggering garbage collection');
                global.gc();
            }
            // Clear Market Radar caches if memory is high
            cleanupFactsCache();
            cleanupTrendsCache();
            cleanupMetiersCache();
            safeLog('info', 'Market Radar caches cleared due to high memory');
        }
    }, 300000); // Every 5 minutes
}

function cleanupMemoryMonitor() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
    }
    stopMarketRadarCacheCleanup();
}

// ============================================
// MARKET RADAR CACHE CLEANUP
// ============================================

function startMarketRadarCacheCleanup() {
    // Clear caches every 15 minutes to prevent memory buildup
    marketRadarCleanupInterval = setInterval(() => {
        const memUsage = process.memoryUsage();
        const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
        
        // Only clear if memory usage is above 300MB
        if (heapUsedMB > 300) {
            safeLog('info', 'Periodic Market Radar cache cleanup', { heapUsedMB });
            cleanupFactsCache();
            cleanupTrendsCache();
            cleanupMetiersCache();
        }
    }, 15 * 60 * 1000); // 15 minutes
    
    safeLog('info', 'Market Radar cache cleanup scheduled (every 15 min if memory > 300MB)');
}

function stopMarketRadarCacheCleanup() {
    if (marketRadarCleanupInterval) {
        clearInterval(marketRadarCleanupInterval);
        marketRadarCleanupInterval = null;
    }
}

// ============================================
// SERVER STARTUP
// ============================================

/**
 * Called after the HTTP(S) server starts listening
 */
async function onServerStart(server, protocol, port) {
    // Clean all caches on startup
    safeLog('info', 'Cleaning all caches on startup');
    try {
        await cleanupAllCaches();
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        invalidateTagsCache();
        safeLog('info', 'All caches cleaned successfully');
    } catch (error) {
        safeLog('error', 'Error cleaning caches on startup', { error: error.message });
    }
    
    // Set server timeouts to 70 minutes for long-running requests (trends collection can take up to 1 hour)
    const SEVENTY_MINUTES = 70 * 60 * 1000;
    server.timeout = SEVENTY_MINUTES;
    server.keepAliveTimeout = SEVENTY_MINUTES;
    server.headersTimeout = SEVENTY_MINUTES + 10000; // Slightly higher than keepAliveTimeout
    
    safeLog('info', 'PROXY SERVER STARTED', {
        port,
        environment: process.env.NODE_ENV || 'development',
        corsOrigins: ALLOWED_ORIGINS,
        protocol,
        modules: ['Health & Metrics', 'Authentication', 'Settings', 'Missions', 'Resumes', 'Templates', 'Firms', 'LLM Proxy', 'Admin'],
        features: ['Rate Limiting', 'CSRF Protection', 'Metrics Tracking', 'Request Logging', 'Compression', 'Security Headers', 'File Cleanup', 'Token Blacklist']
    });
    
    // Initialize PostgreSQL database connection
    safeLog('info', 'Initializing PostgreSQL database');
    const dbInitialized = await initializeDatabase();
    if (dbInitialized) {
        safeLog('info', 'PostgreSQL database initialized successfully');
        
        // Initialize tables
        const tableInits = [
            { fn: initGdprAuditTable, name: 'GDPR Audit Log' },
            { fn: initResumeCommentsTable, name: 'Resume Comments' },
            { fn: initShareResumeTable, name: 'Share Resume' },
            { fn: initCandidatePipelineTable, name: 'Candidate Pipeline' },
            { fn: initDealsTable, name: 'Deals' },
            { fn: initCalendarTokensTable, name: 'Calendar tokens' },
            { fn: initBackupTables, name: 'Backup' }
        ];
        
        for (const { fn, name } of tableInits) {
            try {
                await fn();
                safeLog('info', `${name} table initialized`);
            } catch (error) {
                safeLog('error', `Failed to initialize ${name} table`, { error: error.message });
            }
        }
        
        // Start backup scheduler (scheduled database backups via FTP/SFTP)
        // Must be after initBackupTables since it reads from backup_settings table
        try {
            await initBackupScheduler();
            safeLog('info', 'Backup Scheduler initialized');
        } catch (error) {
            safeLog('error', 'Failed to initialize Backup Scheduler', { error: error.message });
        }
    } else {
        safeLog('error', 'PostgreSQL database initialization failed');
    }
    
    // Start periodic cleanup of temporary files
    startPeriodicCleanup(60 * 60 * 1000, 60 * 60 * 1000); // Every hour, delete files older than 1 hour
    
    // Start periodic cleanup of expired blacklisted tokens
    startBlacklistCleanup(60 * 60 * 1000); // Every hour
    
    // Start periodic cleanup of Market Radar caches (every 15 minutes)
    startMarketRadarCacheCleanup();
    
    // Start GDPR consent scheduler (checks for expired consents, sends reminders, purges)
    startScheduler();
    safeLog('info', 'GDPR Consent Scheduler started');
    
    // Initialize and start batch jobs worker
    try {
        await initBatchJobsWorker();
        startBatchJobsWorker();
        safeLog('info', 'Batch Jobs Worker started');
    } catch (error) {
        safeLog('error', 'Failed to start Batch Jobs Worker', { error: error.message });
    }
    
    // Start memory monitoring
    startMemoryMonitor();
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
            // Minimum TLS 1.2 (TLS 1.0 and 1.1 are deprecated)
            minVersion: 'TLSv1.2',
            // Strong cipher suites only (Mozilla Intermediate compatibility)
            // Ordered by preference: ECDHE > DHE, AES-GCM > AES-CBC, SHA384 > SHA256
            ciphers: [
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-ECDSA-CHACHA20-POLY1305',
                'ECDHE-RSA-CHACHA20-POLY1305',
                'DHE-RSA-AES128-GCM-SHA256',
                'DHE-RSA-AES256-GCM-SHA384'
            ].join(':'),
            // Prefer server cipher order
            honorCipherOrder: true,
            // Disable session tickets for forward secrecy
            // (optional, can be enabled if session resumption is needed)
            // secureOptions: require('constants').SSL_OP_NO_TICKET
        };
        
        server = https.createServer(httpsOptions, app);
        server.listen(HTTPS_PORT, async () => {
            await onServerStart(server, 'HTTPS', HTTPS_PORT);
        });
    } else {
        server = app.listen(PORT, async () => {
            await onServerStart(server, 'HTTP', PORT);
        });
    }

    // Configure graceful shutdown
    const gracefulShutdown = async (signal) => {
        safeLog('info', 'Graceful shutdown initiated', { signal });
        
        // Force exit timer - use unref() so it doesn't keep process alive
        const forceExitTimer = setTimeout(() => {
            safeLog('error', 'Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
        forceExitTimer.unref(); // Don't keep process alive waiting for this timer
        
        // Stop accepting new connections
        server.close(async () => {
            safeLog('info', 'HTTP server closed');
            
            // Cleanup intervals and caches
            cleanupMemoryMonitor();
            cleanupRateLimitStore();
            cleanupAllCaches();
            destroyBlacklist();
            stopPeriodicCleanup();
            stopMarketRadarCacheCleanup();
            metrics.stopPeriodicSave();
            
            // Destroy all caches (clears data AND intervals)
            destroyFactsCache();
            destroyTrendsCache();
            destroyMetiersCache();
            destroyTagsCache();
            destroyEscoCache();
            destroyMailStatesCleanup();
            destroyAuthOauthStates();
            destroyGoogleapis();
            destroyCalendarService();
            await stopBatchJobsWorker();
            destroyMjml();
            destroySettingsCache();
            stopScheduler();
            stopBackupScheduler();
            safeLog('info', 'All caches destroyed');
            
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
            
            // Clear the force exit timer
            clearTimeout(forceExitTimer);
            
            safeLog('info', 'Graceful shutdown complete');
            
            // Use setImmediate to ensure all cleanup is done before exiting
            setImmediate(() => {
                process.exit(0);
            });
        });
    };

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
