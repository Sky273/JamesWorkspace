import { cleanupRateLimitStore } from '../../middleware/rateLimit.middleware.js';
import { cleanupAllCaches } from '../../services/cache.service.js';
import { stopPeriodicCleanup } from '../../utils/fileCleanup.js';
import { destroyBlacklist } from '../../services/tokenBlacklist.service.js';
import { destroyFactsCache } from '../../services/marketFacts.service.js';
import { destroyTrendsCache } from '../../services/marketTrends.service.js';
import { destroyMetiersCache } from '../../services/rome.service.js';
import { destroyTagsCache } from '../../services/tagsCache.service.js';
import { destroyEscoCache } from '../../services/escoService.js';
import { stopMemoryMonitor } from '../../services/memoryMonitor.service.js';
import { stopScheduler } from '../../services/scheduler.service.js';
import { stopBackupScheduler } from '../../services/backup-scheduler.service.js';
import { stopWorker as stopBatchJobsWorker } from '../../services/batchJobsWorker/workerLifecycle.js';
import { destroyCalendarService } from '../../services/calendar.service.js';
import { destroyAuthOauthStates } from '../../services/authOauthState.service.js';
import { destroyMailStatesCleanup } from '../../services/mailOauthState.service.js';
import { destroyGdprMailStatesCleanup } from '../../services/gdprMailOauthState.service.js';
import { destroyGoogleapis } from '../../services/mail/gmailProvider.js';
import { destroyMjml } from '../../services/emailTemplates.service.js';
import { metrics } from '../../services/metrics.service.js';
import { destroySettingsCache } from '../../services/settings.service.js';
import { unsubscribeFromCacheInvalidations } from '../../services/cacheVersion.service.js';

export function getLocalStateShutdownSteps() {
    return [
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
        ['destroyEscoCache', () => destroyEscoCache()]
    ];
}

export function getServiceShutdownSteps() {
    return [
        ['destroyMailStatesCleanup', () => destroyMailStatesCleanup()],
        ['destroyGdprMailStatesCleanup', () => destroyGdprMailStatesCleanup()],
        ['destroyAuthOauthStates', () => destroyAuthOauthStates()],
        ['destroyGoogleapis', () => destroyGoogleapis()],
        ['destroyCalendarService', () => destroyCalendarService()],
        ['stopBatchJobsWorker', () => stopBatchJobsWorker()],
        ['destroyMjml', () => destroyMjml()],
        ['destroySettingsCache', () => destroySettingsCache()]
    ];
}

export function getDatabaseRuntimeShutdownSteps() {
    return [
        ['stopScheduler', () => stopScheduler()],
        ['stopBackupScheduler', () => stopBackupScheduler()],
        ['unsubscribeFromCacheInvalidations', () => unsubscribeFromCacheInvalidations()]
    ];
}
