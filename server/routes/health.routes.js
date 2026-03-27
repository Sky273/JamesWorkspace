import express from 'express';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY, MINIMAX_API_KEY, MINIMAX_ANTHROPIC_BASE_URL, OLLAMA_BASE_URL } from '../config/constants.js';
import { settingsCache, templatesCache, firmsCache } from '../services/cache.service.js';
import { checkDatabaseHealth } from '../services/health.service.js';
import { getTrendsCacheStats } from '../services/marketTrends.service.js';
import { getFactsCacheStats } from '../services/marketFacts.service.js';
import { getMetiersCacheStats } from '../services/rome.service.js';
import { getEscoCacheStats } from '../services/escoService.js';
import { getTagsCacheStats } from './tags.routes.js';
import { getBlacklistStats } from '../services/tokenBlacklist.service.js';
import { safeLog } from '../utils/logger.backend.js';
import { getStorageStats, getFileCleanupStats } from '../utils/fileCleanup.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const startTime = Date.now();

    const isAdmin = req.cookies?.accessToken ? await (async () => {
        try {
            const { verifyToken } = await import('../services/jwt.service.js');
            const decoded = verifyToken(req.cookies.accessToken);
            return decoded?.role === 'admin';
        } catch {
            return false;
        }
    })() : false;

    const checks = {
        server: { status: 'ok' },
        database: { status: 'unknown' },
        openai: { status: 'unknown' },
        anthropic: { status: 'unknown' },
        minimax: { status: 'unknown' },
        ollama: { status: 'unknown' },
        memory: { status: 'ok' },
        cache: { status: 'ok' }
    };

    let overallStatus = 'healthy';

    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((heapUsedMB / heapTotalMB) * 100);

    checks.server = {
        status: 'ok',
        uptime: `${Math.floor(uptime / 60)} minutes`,
        uptimeSeconds: Math.floor(uptime)
    };

    const MEMORY_WARNING_THRESHOLD_MB = 120;
    const MEMORY_CRITICAL_THRESHOLD_MB = 1024;

    const memoryStatus = heapUsedMB >= MEMORY_CRITICAL_THRESHOLD_MB ? 'critical' :
        heapUsedMB >= MEMORY_WARNING_THRESHOLD_MB ? 'warning' : 'ok';

    checks.memory = {
        status: memoryStatus,
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        heapPercent: `${heapPercent}%`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`
    };

    if (checks.memory.status !== 'ok') {
        overallStatus = checks.memory.status === 'critical' ? 'unhealthy' : 'degraded';
    }

    try {
        const { latency: dbLatency, stats } = await checkDatabaseHealth();
        const dbSizeMB = Math.round(parseInt(stats.db_size) / 1024 / 1024);

        checks.database = {
            status: dbLatency > 1000 ? 'slow' : 'ok',
            message: 'PostgreSQL connected',
            latency: `${dbLatency}ms`,
            size: `${dbSizeMB} MB`,
            tables: {
                resumes: parseInt(stats.resumes_count),
                users: parseInt(stats.users_count),
                missions: parseInt(stats.missions_count)
            }
        };

        if (dbLatency > 1000) {
            overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
        }
    } catch (error) {
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

    if (OPENAI_API_KEY) {
        if (deepCheck) {
            try {
                const openaiStart = Date.now();
                const response = await Promise.race([
                    fetch('https://api.openai.com/v1/models', {
                        method: 'GET',
                        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` }
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                const openaiLatency = Date.now() - openaiStart;

                if (response.ok) {
                    checks.openai = {
                        status: openaiLatency > 2000 ? 'slow' : 'ok',
                        message: 'API connected',
                        latency: `${openaiLatency}ms`
                    };
                } else {
                    checks.openai = {
                        status: 'error',
                        message: `API error: ${response.status}`,
                        latency: `${openaiLatency}ms`
                    };
                    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
                }
            } catch (error) {
                checks.openai = {
                    status: 'error',
                    message: error.message === 'Timeout' ? 'Connection timeout' : 'Connection failed'
                };
            }
        } else {
            checks.openai = { status: 'configured', message: 'API key present (use ?deep=true for connectivity test)' };
        }
    } else {
        checks.openai = { status: 'not_configured', message: 'API key missing' };
    }

    if (ANTHROPIC_API_KEY) {
        if (deepCheck) {
            try {
                const anthropicStart = Date.now();
                const response = await Promise.race([
                    fetch('https://api.anthropic.com/v1/messages', {
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
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
                ]);
                const anthropicLatency = Date.now() - anthropicStart;

                if (response.ok || response.status === 400) {
                    checks.anthropic = {
                        status: anthropicLatency > 2000 ? 'slow' : 'ok',
                        message: 'API connected',
                        latency: `${anthropicLatency}ms`
                    };
                } else {
                    checks.anthropic = {
                        status: 'error',
                        message: `API error: ${response.status}`,
                        latency: `${anthropicLatency}ms`
                    };
                    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
                }
            } catch (error) {
                checks.anthropic = {
                    status: 'error',
                    message: error.message === 'Timeout' ? 'Connection timeout' : 'Connection failed'
                };
            }
        } else {
            checks.anthropic = { status: 'configured', message: 'API key present (use ?deep=true for connectivity test)' };
        }
    } else {
        checks.anthropic = { status: 'not_configured', message: 'API key missing' };
    }

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

    checks.cache = {
        status: 'ok',
        settings: settingsCache.size(),
        templates: templatesCache.size(),
        firms: firmsCache.size()
    };

    const responseTime = Date.now() - startTime;
    const responsePayload = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    if (!isAdmin) {
        return res.status(statusCode).json({
            status: overallStatus,
            timestamp: new Date().toISOString(),
            responseTime: `${responseTime}ms`
        });
    }

    res.status(statusCode).json(responsePayload);
});

router.get('/memory', authenticateToken, requireAdmin, async (req, res) => {
    const memoryUsage = process.memoryUsage();

    const cacheStats = {
        simpleCache: {
            settings: settingsCache.size(),
            templates: templatesCache.size(),
            firms: firmsCache.size()
        },
        trends: getTrendsCacheStats(),
        facts: getFactsCacheStats(),
        metiers: getMetiersCacheStats(),
        esco: getEscoCacheStats(),
        tags: getTagsCacheStats(),
        security: getBlacklistStats()
    };

    const estimatedMemory = {
        simpleCache: {
            estimated: `${Math.round((cacheStats.simpleCache.settings + cacheStats.simpleCache.templates + cacheStats.simpleCache.firms) * 1)} KB`,
            details: cacheStats.simpleCache
        },
        trends: {
            estimated: `${Math.round((cacheStats.trends.size || 0) * 0.5)} KB`,
            details: cacheStats.trends
        },
        facts: {
            estimated: `${Math.round((cacheStats.facts.size || 0) * 0.5)} KB`,
            details: cacheStats.facts
        },
        metiers: {
            estimated: `${Math.round((cacheStats.metiers.size || 0) * 0.5)} KB`,
            details: cacheStats.metiers
        },
        esco: {
            estimated: `${Math.round((cacheStats.esco.size || 0) * 0.5)} KB`,
            details: cacheStats.esco
        },
        tags: {
            estimated: 'Variable',
            details: cacheStats.tags
        },
        security: {
            estimated: `${Math.round((cacheStats.security.blacklistedTokens + cacheStats.security.blacklistedUsers) * 0.1)} KB`,
            details: cacheStats.security
        }
    };

    res.json({
        timestamp: new Date().toISOString(),
        process: {
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
            arrayBuffers: `${Math.round((memoryUsage.arrayBuffers || 0) / 1024 / 1024)} MB`
        },
        caches: estimatedMemory,
        summary: {
            totalCacheEntries:
                (cacheStats.simpleCache.settings || 0) +
                (cacheStats.simpleCache.templates || 0) +
                (cacheStats.simpleCache.firms || 0) +
                (cacheStats.trends.size || 0) +
                (cacheStats.facts.size || 0) +
                (cacheStats.metiers.size || 0) +
                (cacheStats.esco.size || 0),
            gcAvailable: typeof global.gc === 'function'
        }
    });
});

router.get('/storage', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const storageStats = await getStorageStats();
        const cleanupStats = getFileCleanupStats();

        const totalFiles = Object.values(storageStats).reduce((sum, dir) => sum + dir.fileCount, 0);
        const totalSizeMB = Object.values(storageStats).reduce((sum, dir) => sum + dir.totalSizeMB, 0);

        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles,
                totalSizeMB: Math.round(totalSizeMB * 100) / 100,
                cleanupTimerActive: cleanupStats.timerActive,
                lastCleanupTime: cleanupStats.lastCleanupTime,
                totalFilesDeleted: cleanupStats.totalFilesDeleted
            },
            directories: storageStats,
            cleanupHistory: cleanupStats.cleanupStats
        });

        safeLog('info', 'Storage stats requested', {
            userId: req.user?.id,
            totalFiles,
            totalSizeMB: Math.round(totalSizeMB * 100) / 100
        });
    } catch (error) {
        safeLog('error', 'Failed to get storage stats', { error: error.message });
        res.status(500).json({ error: 'Failed to get storage statistics' });
    }
});

export default router;




