import { safeLog } from '../../utils/logger.backend.js';
import { cleanupRateLimitStore, startRateLimitCleanup } from '../../middleware/rateLimit.middleware.js';
import { cleanupAllCaches, handleCacheInvalidationNotification } from '../../services/cache.service.js';
import { startPeriodicCleanup, stopPeriodicCleanup } from '../../utils/fileCleanup.js';
import { startBlacklistCleanup, destroyBlacklist } from '../../services/tokenBlacklist.service.js';
import { cleanupFactsCache, destroyFactsCache, startFactsCacheCleanup } from '../../services/marketFacts.service.js';
import { cleanupTrendsCache, destroyTrendsCache, startTrendsCacheCleanup } from '../../services/marketTrends.service.js';
import { cleanupMetiersCache, destroyMetiersCache } from '../../services/rome.service.js';
import { invalidateTagsCache, destroyTagsCache, startTagsCacheCleanup } from '../../services/tagsCache.service.js';
import { destroyEscoCache, startEscoCacheCleanup } from '../../services/escoService.js';
import { registerCacheCleanupFunctions, startMemoryMonitor, stopMemoryMonitor } from '../../services/memoryMonitor.service.js';
import { startScheduler, stopScheduler } from '../../services/scheduler.service.js';
import { initBackupScheduler, stopBackupScheduler } from '../../services/backup-scheduler.service.js';
import {
    initializeWorker as initBatchJobsWorker,
    startWorker as startBatchJobsWorker,
    stopWorker as stopBatchJobsWorker
} from '../../services/batchJobsWorker/workerLifecycle.js';
import { destroyCalendarService } from '../../services/calendar.service.js';
import { destroyAuthOauthStates, startAuthOauthStatesCleanup } from '../../services/authOauthState.service.js';
import { destroyMailStatesCleanup, startMailStatesCleanup } from '../../services/mailOauthState.service.js';
import { destroyGdprMailStatesCleanup, startGdprMailStatesCleanup } from '../../services/gdprMailOauthState.service.js';
import { destroyGoogleapis } from '../../services/mail/gmailProvider.js';
import { destroyMjml } from '../../services/emailTemplates.service.js';
import { metrics } from '../../services/metrics.service.js';
import { destroySettingsCache } from '../../services/settings.service.js';
import { initializeLLMAvailabilityState } from '../../services/llmAvailability.service.js';
import { subscribeToCacheInvalidations, unsubscribeFromCacheInvalidations } from '../../services/cacheVersion.service.js';

const STARTUP_CACHE_CLEANUPS = [
    cleanupFactsCache,
    cleanupTrendsCache,
    cleanupMetiersCache
];

function isEnvFlagEnabled(envName) {
    return String(process.env[envName] || '').toLowerCase() === 'true';
}

async function cleanupCachesOnStartup() {
    safeLog('info', 'Cleaning all caches on startup');
    try {
        await cleanupAllCaches();
        cleanupFactsCache();
        cleanupTrendsCache();
        cleanupMetiersCache();
        await invalidateTagsCache();
        safeLog('info', 'All caches cleaned successfully');
    } catch (error) {
        safeLog('error', 'Error cleaning caches on startup', { error: error.message });
    }
}

async function startDatabaseRuntimeServices() {
    const report = {
        started: [],
        skipped: [],
        failed: []
    };

    try {
        await subscribeToCacheInvalidations(handleCacheInvalidationNotification);
        report.started.push('cacheInvalidationListener');
        safeLog('info', 'Cache invalidation listener started');
    } catch (error) {
        report.failed.push('cacheInvalidationListener');
        safeLog('warn', 'Failed to start cache invalidation listener', { error: error.message });
    }

    try {
        await initializeLLMAvailabilityState();
        report.started.push('llmAvailabilityState');
        safeLog('info', 'LLM availability state initialized');
    } catch (error) {
        report.failed.push('llmAvailabilityState');
        safeLog('error', 'Failed to initialize LLM availability state', { error: error.message });
    }

    if (isEnvFlagEnabled('E2E_DISABLE_BACKUP_SCHEDULER')) {
        report.skipped.push('backupScheduler');
        safeLog('info', 'Backup Scheduler disabled by environment flag', { envName: 'E2E_DISABLE_BACKUP_SCHEDULER' });
    } else {
        try {
            await initBackupScheduler();
            report.started.push('backupScheduler');
            safeLog('info', 'Backup Scheduler initialized');
        } catch (error) {
            report.failed.push('backupScheduler');
            safeLog('error', 'Failed to initialize Backup Scheduler', { error: error.message });
        }
    }

    if (isEnvFlagEnabled('E2E_DISABLE_GDPR_SCHEDULER')) {
        report.skipped.push('gdprScheduler');
        safeLog('info', 'GDPR Consent Scheduler disabled by environment flag', { envName: 'E2E_DISABLE_GDPR_SCHEDULER' });
    } else {
        startScheduler();
        report.started.push('gdprScheduler');
        safeLog('info', 'GDPR Consent Scheduler started');
    }

    try {
        await initBatchJobsWorker();
        startBatchJobsWorker();
        report.started.push('batchJobsWorker');
        safeLog('info', 'Batch Jobs Worker started');
    } catch (error) {
        report.failed.push('batchJobsWorker');
        safeLog('error', 'Failed to start Batch Jobs Worker', { error: error.message });
    }

    return report;
}

export async function startRuntimeMaintenance({ dbInitialized }) {
    startRateLimitCleanup();
    startAuthOauthStatesCleanup();
    startMailStatesCleanup();

    await cleanupCachesOnStartup();
    registerCacheCleanupFunctions(STARTUP_CACHE_CLEANUPS);

    const databaseReport = dbInitialized
        ? await startDatabaseRuntimeServices()
        : { started: [], skipped: ['databaseBackedRuntimeServices'], failed: [] };

    startPeriodicCleanup(60 * 60 * 1000, 60 * 60 * 1000, { enableDatabaseTasks: dbInitialized });

    if (dbInitialized) {
        startBlacklistCleanup(60 * 60 * 1000);
    }

    startFactsCacheCleanup();
    startTrendsCacheCleanup();
    startTagsCacheCleanup();
    startEscoCacheCleanup();
    startGdprMailStatesCleanup();
    startMemoryMonitor();

    safeLog('info', 'Runtime maintenance startup completed', {
        dbInitialized,
        started: databaseReport.started,
        skipped: databaseReport.skipped,
        failed: databaseReport.failed
    });
}

async function runShutdownStep(stepName, step) {
    try {
        await step();
        return { stepName, ok: true };
    } catch (error) {
        safeLog('warn', 'Runtime shutdown cleanup step failed', {
            stepName,
            error: error.message
        });
        return { stepName, ok: false, error: error.message };
    }
}

export async function stopRuntimeMaintenance() {
    const shutdownSteps = [
        ['stopMemoryMonitor', () => stopMemoryMonitor()],
        ['cleanupRateLimitStore', () => cleanupRateLimitStore()],
        ['cleanupAllCaches', () => cleanupAllCaches()],
        ['destroyBlacklist', () => destroyBlacklist()],
        ['stopPeriodicCleanup', () => stopPeriodicCleanup()],
        ['stopMetricsPeriodicSave', () => metrics.stopPeriodicSave()],
        ['destroyFactsCache', () => destroyFactsCache()],
        ['destroyTrendsCache', () => destroyTrendsCache()],
        ['destroyMetiersCache', () => destroyMetiersCache()],
        ['destroyTagsCache', () => destroyTagsCache()],
        ['destroyEscoCache', () => destroyEscoCache()],
        ['destroyMailStatesCleanup', () => destroyMailStatesCleanup()],
        ['destroyGdprMailStatesCleanup', () => destroyGdprMailStatesCleanup()],
        ['destroyAuthOauthStates', () => destroyAuthOauthStates()],
        ['destroyGoogleapis', () => destroyGoogleapis()],
        ['destroyCalendarService', () => destroyCalendarService()],
        ['stopBatchJobsWorker', () => stopBatchJobsWorker()],
        ['destroyMjml', () => destroyMjml()],
        ['destroySettingsCache', () => destroySettingsCache()],
        ['stopScheduler', () => stopScheduler()],
        ['stopBackupScheduler', () => stopBackupScheduler()],
        ['unsubscribeFromCacheInvalidations', () => unsubscribeFromCacheInvalidations()]
    ];

    const results = [];
    for (const [stepName, step] of shutdownSteps) {
        results.push(await runShutdownStep(stepName, step));
    }

    const failedSteps = results.filter((result) => !result.ok).map((result) => result.stepName);
    safeLog('info', 'Runtime maintenance shutdown completed', {
        failedSteps
    });
}
