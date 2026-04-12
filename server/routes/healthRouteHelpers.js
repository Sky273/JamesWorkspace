export const MEMORY_WARNING_THRESHOLD_MB = 120;
export const MEMORY_CRITICAL_THRESHOLD_MB = 1024;

export function getCacheBackendSummary(cacheRegistry = {}) {
    const effectiveBackends = Object.values(cacheRegistry)
        .map((stats) => stats?.effectiveBackend || stats?.backend)
        .filter(Boolean);

    if (effectiveBackends.length === 0) {
        return 'unknown';
    }

    const uniqueBackends = [...new Set(effectiveBackends)];
    return uniqueBackends.length === 1 ? uniqueBackends[0] : uniqueBackends.join(',');
}

export function getCacheDiagnosticSummary(cacheRegistry = {}) {
    const registryEntries = Object.values(cacheRegistry);
    const connectedFlags = registryEntries
        .map((stats) => stats?.connected)
        .filter((flag) => typeof flag === 'boolean');
    const configuredBackends = [...new Set(
        registryEntries
            .map((stats) => stats?.configuredBackend)
            .filter(Boolean)
    )];
    const cacheLayers = [...new Set(
        registryEntries
            .map((stats) => stats?.cacheLayer)
            .filter(Boolean)
    )];
    const disabledReasons = [...new Set(
        registryEntries
            .map((stats) => stats?.disabledReason)
            .filter(Boolean)
    )];
    const messages = [...new Set(
        registryEntries
            .map((stats) => stats?.message)
            .filter(Boolean)
    )];
    const applicationCacheActive = registryEntries.some((stats) => stats?.applicationCacheActive === true);
    const effectiveBackend = getCacheBackendSummary(cacheRegistry);
    const configuredBackend = configuredBackends.length === 1
        ? configuredBackends[0]
        : configuredBackends.join(',');

    return {
        backend: effectiveBackend,
        configuredBackend: configuredBackend || null,
        effectiveBackend,
        cacheLayer: cacheLayers.length === 1 ? cacheLayers[0] : cacheLayers.join(',') || null,
        applicationCacheActive,
        connected: connectedFlags.length > 0 ? connectedFlags.every(Boolean) : null,
        fallbackReason: disabledReasons.length === 0 ? null : disabledReasons.join(','),
        message: messages.length === 0 ? null : messages.join(' ')
    };
}

function getCacheStorageBackend(stats = {}) {
    return stats?.storageBackend || stats?.effectiveBackend || stats?.backend || 'unknown';
}

function getApplicationCacheEntries({ cacheRegistry = {}, caches = {} } = {}) {
    return [
        caches?.settings?.cache || cacheRegistry?.settings,
        cacheRegistry?.templates,
        cacheRegistry?.firms,
        cacheRegistry?.clients,
        cacheRegistry?.deals,
        cacheRegistry?.users,
        cacheRegistry?.missions,
        cacheRegistry?.resumes,
        cacheRegistry?.candidatePipeline,
        cacheRegistry?.emailTemplates,
        cacheRegistry?.resumeComments,
        cacheRegistry?.backupSettings,
        cacheRegistry?.jobs,
        cacheRegistry?.gdprAudit,
        caches?.tags || cacheRegistry?.tags,
        cacheRegistry?.resumeGroupedViews,
        cacheRegistry?.missionGroupedViews,
        cacheRegistry?.adaptationGroupedViews,
        caches?.resumeStats,
        caches?.marketFacts,
        caches?.marketTrends,
        caches?.metiers,
        caches?.esco,
        caches?.tokenBlacklist
    ].filter(Boolean);
}

function getCacheActivityScore(stats = {}) {
    return (
        Number(stats?.size || 0) +
        Number(stats?.hits || 0) +
        Number(stats?.misses || 0) +
        Number(stats?.sets || 0) +
        Number(stats?.invalidations || 0) +
        Number(stats?.loads || 0) +
        Number(stats?.entries || 0) +
        Number(stats?.blacklistedTokens || 0) +
        Number(stats?.blacklistedUsers || 0)
    );
}

export function getApplicationCacheDiagnosticSummary({ cacheRegistry = {}, caches = {} } = {}) {
    const registryEntries = Object.values(cacheRegistry);
    const applicationEntries = getApplicationCacheEntries({ cacheRegistry, caches });

    const configuredBackends = [...new Set(
        applicationEntries
            .map((stats) => stats?.configuredBackend)
            .filter(Boolean)
    )];
    const cacheLayers = [...new Set(
        applicationEntries
            .map((stats) => stats?.cacheLayer)
            .filter(Boolean)
    )];
    const disabledReasons = [...new Set(
        applicationEntries
            .map((stats) => stats?.disabledReason)
            .filter(Boolean)
    )];
    const connectedFlags = applicationEntries
        .map((stats) => stats?.connected)
        .filter((flag) => typeof flag === 'boolean');

    const backendBreakdown = applicationEntries.reduce((accumulator, stats) => {
        const storageBackend = getCacheStorageBackend(stats);
        if (!accumulator[storageBackend]) {
            accumulator[storageBackend] = {
                caches: 0,
                activityScore: 0,
                size: 0
            };
        }

        accumulator[storageBackend].caches += 1;
        accumulator[storageBackend].activityScore += getCacheActivityScore(stats);
        accumulator[storageBackend].size += Number(stats?.size || 0);
        return accumulator;
    }, {});

    const rankedBackends = Object.entries(backendBreakdown)
        .sort((left, right) => {
            const activityDelta = right[1].activityScore - left[1].activityScore;
            if (activityDelta !== 0) {
                return activityDelta;
            }
            return right[1].size - left[1].size;
        });

    const fallbackDiagnostics = getCacheDiagnosticSummary(cacheRegistry);
    const configuredBackend = configuredBackends.length === 1
        ? configuredBackends[0]
        : configuredBackends.join(',') || fallbackDiagnostics.configuredBackend;
    const effectiveBackend = rankedBackends[0]?.[0] || fallbackDiagnostics.effectiveBackend;
    const connected = connectedFlags.length > 0 ? connectedFlags.some(Boolean) : fallbackDiagnostics.connected;
    const applicationCacheActive = applicationEntries.some((stats) => stats?.applicationCacheActive === true);
    const fallbackReason = disabledReasons.length === 0 ? null : disabledReasons.join(',');

    let message = applicationEntries
        .map((stats) => stats?.message)
        .find(Boolean) || fallbackDiagnostics.message;

    if (configuredBackend === 'redis' && effectiveBackend === 'memory' && connected) {
        message = 'Application cache active in memory mode. Redis is configured and reachable, but the active cache paths are currently using in-process memory storage.';
    } else if (configuredBackend === 'redis' && effectiveBackend === 'memory' && !connected) {
        message = 'Application cache active in memory mode. Redis is configured but not currently available to serve the active cache paths.';
    } else if (configuredBackend === 'redis' && effectiveBackend === 'redis' && applicationEntries.some((stats) => getCacheStorageBackend(stats) === 'memory')) {
        message = 'Application cache active across Redis and in-process memory. Local memory caches remain active for cache paths that are not backed by Redis.';
    }

    return {
        backend: effectiveBackend,
        configuredBackend: configuredBackend || null,
        effectiveBackend,
        cacheLayer: cacheLayers.length === 1 ? cacheLayers[0] : cacheLayers.join(',') || null,
        applicationCacheActive,
        connected,
        fallbackReason,
        message,
        backendBreakdown
    };
}

export function getApplicationCacheUsageSummary({ cacheRegistry = {}, caches = {} } = {}) {
    const applicationEntries = getApplicationCacheEntries({ cacheRegistry, caches });
    const summary = applicationEntries.reduce((accumulator, stats) => {
        accumulator.hits += Number(stats?.hits || 0);
        accumulator.misses += Number(stats?.misses || 0);
        accumulator.sets += Number(stats?.sets || 0);
        accumulator.invalidations += Number(stats?.invalidations || 0);
        accumulator.size += Number(stats?.size || 0);
        return accumulator;
    }, {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        size: 0
    });

    const totalLookups = summary.hits + summary.misses;

    return {
        ...summary,
        totalLookups,
        hitRate: totalLookups > 0 ? summary.hits / totalLookups : 0
    };
}

export function getCacheUsageSummary(cacheRegistry = {}) {
    const registryEntries = Object.values(cacheRegistry);
    const summary = registryEntries.reduce((accumulator, stats) => {
        accumulator.hits += Number(stats?.hits || 0);
        accumulator.misses += Number(stats?.misses || 0);
        accumulator.sets += Number(stats?.sets || 0);
        accumulator.invalidations += Number(stats?.invalidations || 0);
        accumulator.size += Number(stats?.size || 0);
        return accumulator;
    }, {
        hits: 0,
        misses: 0,
        sets: 0,
        invalidations: 0,
        size: 0
    });

    const totalLookups = summary.hits + summary.misses;

    return {
        ...summary,
        totalLookups,
        hitRate: totalLookups > 0 ? summary.hits / totalLookups : 0
    };
}

export function getInitialHealthChecks() {
    return {
        server: { status: 'ok' },
        database: { status: 'unknown' },
        openai: { status: 'unknown' },
        anthropic: { status: 'unknown' },
        deepseek: { status: 'unknown' },
        glm: { status: 'unknown' },
        minimax: { status: 'unknown' },
        ollama: { status: 'unknown' },
        memory: { status: 'ok' },
        cache: { status: 'ok' },
        ocr: { status: 'unknown' }
    };
}

export function buildServerCheck(uptimeSeconds) {
    return {
        status: 'ok',
        uptime: `${Math.floor(uptimeSeconds / 60)} minutes`,
        uptimeSeconds: Math.floor(uptimeSeconds)
    };
}

export function buildMemoryCheck(memoryUsage) {
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const heapPercent = Math.round((heapUsedMB / heapTotalMB) * 100);

    const status = heapUsedMB >= MEMORY_CRITICAL_THRESHOLD_MB
        ? 'critical'
        : heapUsedMB >= MEMORY_WARNING_THRESHOLD_MB
            ? 'warning'
            : 'ok';

    return {
        status,
        heapUsed: `${heapUsedMB} MB`,
        heapTotal: `${heapTotalMB} MB`,
        heapPercent: `${heapPercent}%`,
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`
    };
}

export function updateOverallStatus(currentStatus, checkStatus) {
    if (checkStatus === 'critical') {
        return 'unhealthy';
    }
    if (checkStatus === 'warning' || checkStatus === 'slow' || checkStatus === 'error') {
        return currentStatus === 'healthy' ? 'degraded' : currentStatus;
    }
    return currentStatus;
}

export function buildDatabaseCheck(dbLatency, stats) {
    const dbSizeMB = Math.round(parseInt(stats.db_size, 10) / 1024 / 1024);

    return {
        status: dbLatency > 1000 ? 'slow' : 'ok',
        message: 'PostgreSQL connected',
        latency: `${dbLatency}ms`,
        size: `${dbSizeMB} MB`,
        tables: {
            resumes: parseInt(stats.resumes_count, 10),
            users: parseInt(stats.users_count, 10),
            missions: parseInt(stats.missions_count, 10)
        }
    };
}

export function buildHealthResponsePayload({ overallStatus, responseTime, checks, environment, version }) {
    return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        checks,
        version,
        environment
    };
}

export function buildPublicHealthResponse({ overallStatus, responseTime }) {
    return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`
    };
}

export function getHealthStatusCode(overallStatus) {
    return overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
}

export function buildCacheCheck({ cacheDiagnostics, settingsCacheSize, templatesCacheSize, firmsCacheSize, cacheRegistry }) {
    return {
        status: 'ok',
        backend: cacheDiagnostics.backend,
        configuredBackend: cacheDiagnostics.configuredBackend,
        effectiveBackend: cacheDiagnostics.effectiveBackend,
        cacheLayer: cacheDiagnostics.cacheLayer,
        applicationCacheActive: cacheDiagnostics.applicationCacheActive,
        connected: cacheDiagnostics.connected,
        fallbackReason: cacheDiagnostics.fallbackReason,
        message: cacheDiagnostics.message,
        settings: settingsCacheSize,
        templates: templatesCacheSize,
        firms: firmsCacheSize,
        registry: cacheRegistry
    };
}

export function buildOcrCheck(ocrDiagnostics, wordDiagnostics) {
    return {
        status: ocrDiagnostics.status,
        preferredEngine: ocrDiagnostics.preferredEngine,
        tesseractCliAvailable: ocrDiagnostics.tesseractCliAvailable,
        pdftoppmAvailable: ocrDiagnostics.pdftoppmAvailable,
        sofficeAvailable: wordDiagnostics.sofficeAvailable,
        wordOcrFallbackAvailable: wordDiagnostics.wordOcrFallbackAvailable,
        pythonCommand: ocrDiagnostics.pythonCommand,
        advancedBackend: ocrDiagnostics.advancedBackend,
        advancedBackendAvailable: ocrDiagnostics.advancedBackendAvailable,
        message: [ocrDiagnostics.notes, wordDiagnostics.notes].filter(Boolean).join(' | ')
    };
}

export function buildMemoryDiagnosticsPayload({ memoryUsage, cacheStats }) {
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

    return {
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
    };
}

export function getConfiguredCheck() {
    return { status: 'configured', message: 'API key present (use ?deep=true for connectivity test)' };
}

export function getNotConfiguredCheck() {
    return { status: 'not_configured', message: 'API key missing' };
}

export function getFailedConnectivityCheck(error) {
    return {
        status: 'error',
        message: error.message === 'Timeout' ? 'Connection timeout' : 'Connection failed'
    };
}
