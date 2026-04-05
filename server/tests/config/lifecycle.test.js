import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCleanupRateLimitStore = vi.fn();
const mockStartRateLimitCleanup = vi.fn();
const mockCleanupAllCaches = vi.fn(async () => {});
const mockStartPeriodicCleanup = vi.fn();
const mockStopPeriodicCleanup = vi.fn();
const mockStartBlacklistCleanup = vi.fn();
const mockDestroyBlacklist = vi.fn();
const mockCleanupFactsCache = vi.fn();
const mockDestroyFactsCache = vi.fn();
const mockStartFactsCacheCleanup = vi.fn();
const mockCleanupTrendsCache = vi.fn();
const mockDestroyTrendsCache = vi.fn();
const mockStartTrendsCacheCleanup = vi.fn();
const mockCleanupMetiersCache = vi.fn();
const mockDestroyMetiersCache = vi.fn();
const mockInvalidateTagsCache = vi.fn();
const mockDestroyTagsCache = vi.fn();
const mockStartTagsCacheCleanup = vi.fn();
const mockDestroyEscoCache = vi.fn();
const mockStartEscoCacheCleanup = vi.fn();
const mockRegisterCacheCleanupFunctions = vi.fn();
const mockStartMemoryMonitor = vi.fn();
const mockStopMemoryMonitor = vi.fn();
const mockInitializeDatabase = vi.fn();
const mockClosePool = vi.fn(async () => {});
const mockStartScheduler = vi.fn();
const mockStopScheduler = vi.fn();
const mockInitBackupScheduler = vi.fn(async () => {});
const mockStopBackupScheduler = vi.fn();
const mockInitBatchJobsWorker = vi.fn(async () => {});
const mockStartBatchJobsWorker = vi.fn();
const mockStopBatchJobsWorker = vi.fn(async () => {});
const mockDestroyCalendarService = vi.fn();
const mockDestroyAuthOauthStates = vi.fn();
const mockStartAuthOauthStatesCleanup = vi.fn();
const mockDestroyMailStatesCleanup = vi.fn();
const mockStartMailStatesCleanup = vi.fn();
const mockDestroyGdprMailStatesCleanup = vi.fn();
const mockStartGdprMailStatesCleanup = vi.fn();
const mockDestroyGoogleapis = vi.fn();
const mockDestroyMjml = vi.fn();
const mockDestroySettingsCache = vi.fn(async () => {});
const mockInitializeLLMAvailabilityState = vi.fn(async () => {});
const mockSafeLog = vi.fn();
const mockHttpAgentDestroy = vi.fn();
const mockHttpsAgentDestroy = vi.fn();

vi.mock('../../utils/logger.backend.js', () => ({
    safeLog: (...args) => mockSafeLog(...args)
}));

vi.mock('../../config/constants.js', () => ({
    PORT: 3001,
    ALLOWED_ORIGINS: ['http://localhost:5173']
}));

vi.mock('../../config/axios.js', () => ({
    httpAgent: { destroy: (...args) => mockHttpAgentDestroy(...args) },
    httpsAgent: { destroy: (...args) => mockHttpsAgentDestroy(...args) }
}));

vi.mock('../../middleware/rateLimit.middleware.js', () => ({
    cleanupRateLimitStore: (...args) => mockCleanupRateLimitStore(...args),
    startRateLimitCleanup: (...args) => mockStartRateLimitCleanup(...args)
}));

vi.mock('../../services/cache.service.js', () => ({
    cleanupAllCaches: (...args) => mockCleanupAllCaches(...args)
}));

vi.mock('../../utils/fileCleanup.js', () => ({
    startPeriodicCleanup: (...args) => mockStartPeriodicCleanup(...args),
    stopPeriodicCleanup: (...args) => mockStopPeriodicCleanup(...args)
}));

vi.mock('../../services/tokenBlacklist.service.js', () => ({
    startBlacklistCleanup: (...args) => mockStartBlacklistCleanup(...args),
    destroyBlacklist: (...args) => mockDestroyBlacklist(...args)
}));

vi.mock('../../services/marketFacts.service.js', () => ({
    cleanupFactsCache: (...args) => mockCleanupFactsCache(...args),
    destroyFactsCache: (...args) => mockDestroyFactsCache(...args),
    startFactsCacheCleanup: (...args) => mockStartFactsCacheCleanup(...args)
}));

vi.mock('../../services/marketTrends.service.js', () => ({
    cleanupTrendsCache: (...args) => mockCleanupTrendsCache(...args),
    destroyTrendsCache: (...args) => mockDestroyTrendsCache(...args),
    startTrendsCacheCleanup: (...args) => mockStartTrendsCacheCleanup(...args)
}));

vi.mock('../../services/rome.service.js', () => ({
    cleanupMetiersCache: (...args) => mockCleanupMetiersCache(...args),
    destroyMetiersCache: (...args) => mockDestroyMetiersCache(...args)
}));

vi.mock('../../services/tagsCache.service.js', () => ({
    invalidateTagsCache: (...args) => mockInvalidateTagsCache(...args),
    destroyTagsCache: (...args) => mockDestroyTagsCache(...args),
    startTagsCacheCleanup: (...args) => mockStartTagsCacheCleanup(...args)
}));

vi.mock('../../services/escoService.js', () => ({
    destroyEscoCache: (...args) => mockDestroyEscoCache(...args),
    startEscoCacheCleanup: (...args) => mockStartEscoCacheCleanup(...args)
}));

vi.mock('../../services/database.service.js', () => ({
    initializeDatabase: (...args) => mockInitializeDatabase(...args),
    closePool: (...args) => mockClosePool(...args)
}));

vi.mock('../../services/scheduler.service.js', () => ({
    startScheduler: (...args) => mockStartScheduler(...args),
    stopScheduler: (...args) => mockStopScheduler(...args)
}));

vi.mock('../../services/backup-scheduler.service.js', () => ({
    initBackupScheduler: (...args) => mockInitBackupScheduler(...args),
    stopBackupScheduler: (...args) => mockStopBackupScheduler(...args)
}));

vi.mock('../../services/batchJobsWorker/workerLifecycle.js', () => ({
    initializeWorker: (...args) => mockInitBatchJobsWorker(...args),
    startWorker: (...args) => mockStartBatchJobsWorker(...args),
    stopWorker: (...args) => mockStopBatchJobsWorker(...args)
}));

vi.mock('../../services/calendar.service.js', () => ({
    destroyCalendarService: (...args) => mockDestroyCalendarService(...args)
}));

vi.mock('../../routes/auth/index.js', () => ({
    destroyAuthOauthStates: (...args) => mockDestroyAuthOauthStates(...args),
    startAuthOauthStatesCleanup: (...args) => mockStartAuthOauthStatesCleanup(...args)
}));

vi.mock('../../routes/mail.routes.js', () => ({
    destroyMailStatesCleanup: (...args) => mockDestroyMailStatesCleanup(...args),
    startMailStatesCleanup: (...args) => mockStartMailStatesCleanup(...args)
}));

vi.mock('../../routes/gdprMail.routes.js', () => ({
    destroyGdprMailStatesCleanup: (...args) => mockDestroyGdprMailStatesCleanup(...args),
    startGdprMailStatesCleanup: (...args) => mockStartGdprMailStatesCleanup(...args)
}));

vi.mock('../../services/mail/gmailProvider.js', () => ({
    destroyGoogleapis: (...args) => mockDestroyGoogleapis(...args)
}));

vi.mock('../../services/emailTemplates.service.js', () => ({
    destroyMjml: (...args) => mockDestroyMjml(...args)
}));

vi.mock('../../services/settings.service.js', () => ({
    destroySettingsCache: (...args) => mockDestroySettingsCache(...args)
}));

vi.mock('../../services/llmAvailability.service.js', () => ({
    initializeLLMAvailabilityState: (...args) => mockInitializeLLMAvailabilityState(...args)
}));

vi.mock('../../services/memoryMonitor.service.js', () => ({
    registerCacheCleanupFunctions: (...args) => mockRegisterCacheCleanupFunctions(...args),
    startMemoryMonitor: (...args) => mockStartMemoryMonitor(...args),
    stopMemoryMonitor: (...args) => mockStopMemoryMonitor(...args)
}));

vi.mock('../../services/metrics.service.js', () => ({
    metrics: {
        stopPeriodicSave: vi.fn()
    }
}));

import { startServer } from '../../config/lifecycle.js';

describe('Lifecycle config', () => {
    const originalExit = process.exit;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        process.exit = originalExit;
    });

    it('should not start DB-dependent schedulers and workers when database init fails', async () => {
        mockInitializeDatabase.mockResolvedValue(false);

        const server = {
            timeout: 0,
            keepAliveTimeout: 0,
            headersTimeout: 0,
            close: vi.fn()
        };

        const app = {
            listen: vi.fn((port, cb) => {
                setImmediate(cb);
                return server;
            })
        };

        startServer(app, 'C:\\Users\\mail\\CascadeProjects\\ResumeConverter\\server');
        await new Promise(resolve => setImmediate(resolve));
        await new Promise(resolve => setImmediate(resolve));

        expect(mockInitializeDatabase).toHaveBeenCalled();
        expect(mockStartRateLimitCleanup).toHaveBeenCalled();
        expect(mockStartAuthOauthStatesCleanup).toHaveBeenCalled();
        expect(mockStartMailStatesCleanup).toHaveBeenCalled();
        expect(mockInitBackupScheduler).not.toHaveBeenCalled();
        expect(mockStartScheduler).not.toHaveBeenCalled();
        expect(mockInitBatchJobsWorker).not.toHaveBeenCalled();
        expect(mockStartBatchJobsWorker).not.toHaveBeenCalled();
        expect(mockStartFactsCacheCleanup).toHaveBeenCalled();
        expect(mockStartTrendsCacheCleanup).toHaveBeenCalled();
        expect(mockStartTagsCacheCleanup).toHaveBeenCalled();
        expect(mockStartEscoCacheCleanup).toHaveBeenCalled();
        expect(mockStartGdprMailStatesCleanup).toHaveBeenCalled();
        expect(mockRegisterCacheCleanupFunctions).toHaveBeenCalledWith([
            expect.any(Function),
            expect.any(Function),
            expect.any(Function)
        ]);
        expect(mockStartMemoryMonitor).toHaveBeenCalled();
        expect(mockStartPeriodicCleanup).toHaveBeenCalledWith(
            60 * 60 * 1000,
            60 * 60 * 1000,
            { enableDatabaseTasks: false }
        );
        expect(mockStartBlacklistCleanup).not.toHaveBeenCalled();
    });
});
