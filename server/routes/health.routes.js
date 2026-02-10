import express from 'express';
import { OPENAI_API_KEY, ANTHROPIC_API_KEY } from '../config/constants.js';
import { settingsCache, templatesCache, firmsCache } from '../services/cache.service.js';
import { query as dbQuery } from '../config/database.js';
import { getTrendsCacheStats } from '../services/marketTrends.service.js';
import { getFactsCacheStats } from '../services/marketFacts.service.js';
import { getMetiersCacheStats } from '../services/rome.service.js';
import { getEscoCacheStats } from '../services/escoService.js';
import { getTagsCacheStats } from './tags.routes.js';
import { getBlacklistStats } from '../services/tokenBlacklist.service.js';

const router = express.Router();

// Comprehensive health check endpoint
router.get('/', async (req, res) => {
    const startTime = Date.now();
    const checks = {
        server: { status: 'ok' },
        database: { status: 'unknown' },
        openai: { status: 'unknown' },
        anthropic: { status: 'unknown' },
        memory: { status: 'ok' },
        cache: { status: 'ok' }
    };
    
    let overallStatus = 'healthy';
    
    // 1. Server uptime and memory
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
    
    // Memory thresholds in MB (absolute values for better control)
    const MEMORY_WARNING_THRESHOLD_MB = 60;  // Warning at 60 MB
    const MEMORY_CRITICAL_THRESHOLD_MB = 100; // Critical at 100 MB
    
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
    
    // 2. Check PostgreSQL connectivity with detailed stats
    try {
        const dbStart = Date.now();
        const [connResult, statsResult] = await Promise.race([
            Promise.all([
                dbQuery('SELECT 1 as connected'),
                dbQuery(`
                    SELECT 
                        (SELECT count(*) FROM resumes) as resumes_count,
                        (SELECT count(*) FROM users) as users_count,
                        (SELECT count(*) FROM missions) as missions_count,
                        pg_database_size(current_database()) as db_size
                `)
            ]),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
        ]);
        const dbLatency = Date.now() - dbStart;
        const stats = statsResult.rows[0];
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
            message: error.message === 'Timeout' ? 'Connection timeout' : 'Connection failed'
        };
        overallStatus = 'unhealthy';
    }
    
    // 3. Check OpenAI API
    if (OPENAI_API_KEY) {
        checks.openai = { status: 'configured', message: 'API key present' };
    } else {
        checks.openai = { status: 'not_configured', message: 'API key missing' };
    }
    
    // 4. Check Anthropic API
    if (ANTHROPIC_API_KEY) {
        checks.anthropic = { status: 'configured', message: 'API key present' };
    } else {
        checks.anthropic = { status: 'not_configured', message: 'API key missing' };
    }
    
    // 5. Cache status
    checks.cache = {
        status: 'ok',
        settings: settingsCache.size(),
        templates: templatesCache.size(),
        firms: firmsCache.size()
    };
    
    const responseTime = Date.now() - startTime;
    
    const response = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks,
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
    };
    
    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
    res.status(statusCode).json(response);
});

// Detailed memory and cache statistics endpoint
router.get('/memory', async (req, res) => {
    const memoryUsage = process.memoryUsage();
    
    // Get all cache stats
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
    
    // Calculate estimated memory usage per cache
    const estimatedMemory = {
        simpleCache: {
            estimated: `${Math.round((cacheStats.simpleCache.settings + cacheStats.simpleCache.templates + cacheStats.simpleCache.customers) * 1)} KB`,
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
                (cacheStats.simpleCache.customers || 0) +
                (cacheStats.trends.size || 0) +
                (cacheStats.facts.size || 0) +
                (cacheStats.metiers.size || 0) +
                (cacheStats.esco.size || 0),
            gcAvailable: typeof global.gc === 'function'
        }
    });
});

export default router;
