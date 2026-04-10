import express from 'express';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, GLM_API_KEY, GLM_BASE_URL, MINIMAX_API_KEY, MINIMAX_ANTHROPIC_BASE_URL, OLLAMA_BASE_URL } from '../config/constants.js';
import { settingsCache, templatesCache, firmsCache, getCacheRegistryStats } from '../services/cache.service.js';
import { checkDatabaseHealth } from '../services/health.service.js';
import { getTrendsCacheStats } from '../services/marketTrends.service.js';
import { getFactsCacheStats } from '../services/marketFacts.service.js';
import { getMetiersCacheStats } from '../services/rome.service.js';
import { getEscoCacheStats } from '../services/escoService.js';
import { getTagsCacheStats } from '../services/tagsCache.service.js';
import { getBlacklistStats } from '../services/tokenBlacklist.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getStorageStats, getFileCleanupStats } from '../utils/fileCleanup.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { getOcrRuntimeDiagnostics } from '../services/pdfTextExtraction.service.js';
import { getWordExtractionRuntimeDiagnostics } from '../services/wordTextExtraction.service.js';
import { getBatchWorkerRuntimeDiagnostics } from '../services/batchJobsWorker/workerLifecycle.js';
import { getLastBatchExportSummary } from '../services/batchJobsWorker/exportGenerator.js';
import { getLastBatchTextExtractionSummary } from '../services/batchJobsWorker/textExtraction.js';
import { getLastConsentSchedulerSummary } from '../services/consent/scheduler.js';
import { getLastPipelineActivitySummary } from '../services/candidatePipeline.service.js';
import { findUserById } from '../services/users.service.js';
import {
    buildCacheCheck,
    buildDatabaseCheck,
    buildHealthResponsePayload,
    buildMemoryCheck,
    buildMemoryDiagnosticsPayload,
    buildOcrCheck,
    buildPublicHealthResponse,
    buildServerCheck,
    getCacheDiagnosticSummary,
    getHealthStatusCode,
    getInitialHealthChecks,
    getNotConfiguredCheck,
    getConfiguredCheck,
    getFailedConnectivityCheck,
    updateOverallStatus
} from './healthRouteHelpers.js';

const router = express.Router();

function createAdminDiagnosticsRouteHandler(logMessage, errorMessage, handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            safeLog('error', logMessage, { error: error.message, userId: req.user?.id });
            res.status(500).json({ error: errorMessage });
        }
    };
}

function buildStorageDiagnosticsPayload(storageStats, cleanupStats) {
    const totalFiles = Object.values(storageStats).reduce((sum, dir) => sum + dir.fileCount, 0);
    const totalSizeMB = Object.values(storageStats).reduce((sum, dir) => sum + dir.totalSizeMB, 0);
    const roundedTotalSizeMB = Math.round(totalSizeMB * 100) / 100;

    return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        summary: {
            totalFiles,
            totalSizeMB: roundedTotalSizeMB,
            cleanupTimerActive: cleanupStats.timerActive,
            lastCleanupTime: cleanupStats.lastCleanupTime,
            totalFilesDeleted: cleanupStats.totalFilesDeleted
        },
        directories: storageStats,
        cleanupHistory: cleanupStats.cleanupStats,
        metrics: {
            totalFiles,
            totalSizeMB: roundedTotalSizeMB
        }
    };
}

async function runConnectivityCheck({
    fetchUrl,
    fetchOptions,
    timeoutMs = 5000,
    slowThresholdMs = 2000,
    connectedStatuses = []
}) {
    const start = Date.now();
    const response = await Promise.race([
        fetch(fetchUrl, fetchOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs))
    ]);
    const latency = Date.now() - start;
    const isConnected = response.ok || connectedStatuses.includes(response.status);

    return isConnected
        ? { status: latency > slowThresholdMs ? 'slow' : 'ok', message: 'API connected', latency: `${latency}ms` }
        : { status: 'error', message: `API error: ${response.status}`, latency: `${latency}ms` };
}

async function resolveApiConnectivityCheck({
    apiKey,
    deepCheck,
    runDeepCheck
}) {
    if (!apiKey) {
        return getNotConfiguredCheck();
    }

    if (!deepCheck) {
        return getConfiguredCheck();
    }

    try {
        return await runDeepCheck();
    } catch (error) {
        return getFailedConnectivityCheck(error);
    }
}

async function resolveProviderConnectivityChecks(deepCheck, initialOverallStatus = 'healthy') {
    const providerChecks = [
        {
            key: 'openai',
            apiKey: OPENAI_API_KEY,
            runDeepCheck: () => runConnectivityCheck({
                fetchUrl: 'https://api.openai.com/v1/models',
                fetchOptions: {
                    method: 'GET',
                    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
                }
            })
        },
        {
            key: 'anthropic',
            apiKey: ANTHROPIC_API_KEY,
            runDeepCheck: () => runConnectivityCheck({
                fetchUrl: 'https://api.anthropic.com/v1/messages',
                fetchOptions: {
                    method: 'POST',
                    headers: {
                        'x-api-key': ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-haiku-20240307',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: 'ping' }]
                    })
                },
                connectedStatuses: [400]
            })
        },
        {
            key: 'deepseek',
            apiKey: DEEPSEEK_API_KEY,
            runDeepCheck: () => runConnectivityCheck({
                fetchUrl: `${DEEPSEEK_BASE_URL.replace(/\/$/, '')}/chat/completions`,
                fetchOptions: {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'deepseek-chat',
                        messages: [{ role: 'user', content: 'ping' }],
                        max_tokens: 1
                    })
                },
                connectedStatuses: [400]
            })
        },
        {
            key: 'glm',
            apiKey: GLM_API_KEY,
            runDeepCheck: () => runConnectivityCheck({
                fetchUrl: `${GLM_BASE_URL.replace(/\/$/, '')}/chat/completions`,
                fetchOptions: {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${GLM_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'glm-5',
                        messages: [{ role: 'user', content: 'ping' }],
                        max_tokens: 1
                    })
                },
                connectedStatuses: [400]
            })
        },
        {
            key: 'minimax',
            apiKey: MINIMAX_API_KEY,
            runDeepCheck: () => runConnectivityCheck({
                fetchUrl: `${MINIMAX_ANTHROPIC_BASE_URL.replace(/\/$/, '')}/v1/messages`,
                fetchOptions: {
                    method: 'POST',
                    headers: {
                        'x-api-key': MINIMAX_API_KEY,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'MiniMax-M2.7',
                        max_tokens: 1,
                        messages: [{ role: 'user', content: [{ type: 'text', text: 'ping' }] }]
                    })
                },
                connectedStatuses: [400]
            })
        }
    ];

    const checks = {};
    let overallStatus = initialOverallStatus;

    for (const providerCheck of providerChecks) {
        checks[providerCheck.key] = await resolveApiConnectivityCheck({
            apiKey: providerCheck.apiKey,
            deepCheck,
            runDeepCheck: providerCheck.runDeepCheck
        });
        overallStatus = updateOverallStatus(overallStatus, checks[providerCheck.key].status);
    }

    return { checks, overallStatus };
}

async function resolveAdminHealthAccess(req) {
    const accessToken = req.cookies?.accessToken;
    if (!accessToken) {
        return false;
    }

    try {
        const { verifyToken } = await import('../services/jwt.service.js');
        const decoded = await verifyToken(accessToken);
        if (!decoded?.id) {
            return false;
        }

        const currentUser = await findUserById(decoded.id);
        if (!currentUser) {
            return false;
        }

        return currentUser.role === 'admin' && String(currentUser.status || '').toLowerCase() !== 'inactive';
    } catch {
        return false;
    }
}

router.get('/', async (req, res) => {
    const startTime = Date.now();
    const isAdmin = await resolveAdminHealthAccess(req);

    const checks = getInitialHealthChecks();

    let overallStatus = 'healthy';

    checks.server = buildServerCheck(process.uptime());
    checks.memory = buildMemoryCheck(process.memoryUsage());
    overallStatus = updateOverallStatus(overallStatus, checks.memory.status);

    try {
        const { latency: dbLatency, stats } = await checkDatabaseHealth();
        checks.database = buildDatabaseCheck(dbLatency, stats);
        overallStatus = updateOverallStatus(overallStatus, checks.database.status);
    } catch {
        checks.database = {
            status: 'error',
            message: 'Connection failed'
        };
        overallStatus = 'unhealthy';
    }

    const requestedDeepCheck = req.query.deep === 'true';
    const deepCheck = requestedDeepCheck && isAdmin;

    if (requestedDeepCheck && !isAdmin) {
        safeLog('warn', 'Ignored unauthorized deep health check request', {
            path: req.path,
            ip: req.ip
        });
    }

    const providerChecks = await resolveProviderConnectivityChecks(deepCheck, overallStatus);
    Object.assign(checks, providerChecks.checks);
    overallStatus = providerChecks.overallStatus;

    if (OLLAMA_BASE_URL) {
        if (deepCheck) {
            try {
                const response = await Promise.race([
                    fetch(new URL('/api/tags', OLLAMA_BASE_URL).toString(), { method: 'GET' }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000))
                ]);
                checks.ollama = {
                    status: response.ok ? 'ok' : 'error',
                    message: response.ok ? 'Ollama reachable' : `Ollama error: ${response.status}`
                };
            } catch {
                checks.ollama = { status: 'error', message: 'Ollama unreachable' };
            }
        } else {
            checks.ollama = getConfiguredCheck();
        }
    } else {
        checks.ollama = getNotConfiguredCheck();
    }

    const responseTime = Date.now() - startTime;
    const statusCode = getHealthStatusCode(overallStatus);

    if (!isAdmin) {
        return res.status(statusCode).json(buildPublicHealthResponse({ overallStatus, responseTime }));
    }

    const [settingsCacheSize, templatesCacheSize, firmsCacheSize, cacheRegistry] = await Promise.all([
        settingsCache.size(),
        templatesCache.size(),
        firmsCache.size(),
        getCacheRegistryStats()
    ]);

    const cacheDiagnostics = getCacheDiagnosticSummary(cacheRegistry);

    checks.cache = buildCacheCheck({
        cacheDiagnostics,
        settingsCacheSize,
        templatesCacheSize,
        firmsCacheSize,
        cacheRegistry
    });

    try {
        const [ocrDiagnostics, wordDiagnostics] = await Promise.all([
            getOcrRuntimeDiagnostics(),
            getWordExtractionRuntimeDiagnostics()
        ]);
        checks.ocr = buildOcrCheck(ocrDiagnostics, wordDiagnostics);
    } catch (error) {
        checks.ocr = {
            status: 'error',
            message: error.message || 'OCR diagnostics unavailable'
        };
    }

    try {
        const batchWorkerDiagnostics = getBatchWorkerRuntimeDiagnostics();
        checks.batchWorker = {
            status: batchWorkerDiagnostics.workerRunning || batchWorkerDiagnostics.intervalActive ? 'ok' : 'degraded',
            ...batchWorkerDiagnostics
        };
    } catch (error) {
        checks.batchWorker = {
            status: 'error',
            message: error.message || 'Batch worker diagnostics unavailable'
        };
    }

    checks.recentBatchActivity = {
        status: 'ok',
        export: getLastBatchExportSummary(),
        textExtraction: getLastBatchTextExtractionSummary()
    };

    checks.recentConsentActivity = {
        status: 'ok',
        scheduler: getLastConsentSchedulerSummary()
    };

    checks.recentPipelineActivity = {
        status: 'ok',
        pipeline: getLastPipelineActivitySummary()
    };

    const responsePayload = buildHealthResponsePayload({
        overallStatus,
        responseTime,
        checks,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    });

    res.status(statusCode).json(responsePayload);
});

router.get('/memory', authenticateToken, requireAdmin, createAdminDiagnosticsRouteHandler(
    'Failed to get memory diagnostics',
    'Failed to get memory diagnostics',
    async (req, res) => {
    const memoryUsage = process.memoryUsage();
    const [settingsCacheSize, templatesCacheSize, firmsCacheSize, cacheRegistry] = await Promise.all([
        settingsCache.size(),
        templatesCache.size(),
        firmsCache.size(),
        getCacheRegistryStats()
    ]);

    const cacheStats = {
        simpleCache: {
            ...getCacheDiagnosticSummary(cacheRegistry),
            settings: settingsCacheSize,
            templates: templatesCacheSize,
            firms: firmsCacheSize,
            registry: cacheRegistry
        },
        trends: getTrendsCacheStats(),
        facts: getFactsCacheStats(),
        metiers: getMetiersCacheStats(),
        esco: getEscoCacheStats(),
        tags: getTagsCacheStats(),
        security: getBlacklistStats()
    };

    res.json(buildMemoryDiagnosticsPayload({
        memoryUsage,
        cacheStats
    }));
    }
));

router.get('/storage', authenticateToken, requireAdmin, createAdminDiagnosticsRouteHandler(
    'Failed to get storage stats',
    'Failed to get storage statistics',
    async (req, res) => {
        const storageStats = await getStorageStats();
        const cleanupStats = getFileCleanupStats();
        const payload = buildStorageDiagnosticsPayload(storageStats, cleanupStats);

        res.json({
            status: payload.status,
            timestamp: payload.timestamp,
            summary: payload.summary,
            directories: payload.directories,
            cleanupHistory: payload.cleanupHistory
        });

        safeLog('info', 'Storage stats requested', {
            userId: req.user?.id,
            totalFiles: payload.metrics.totalFiles,
            totalSizeMB: payload.metrics.totalSizeMB
        });
    }
));

export default router;
