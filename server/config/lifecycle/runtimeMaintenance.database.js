import { safeLog } from '../../utils/logger.backend.js';
import { handleCacheInvalidationNotification } from '../../services/cache.service.js';
import { startBlacklistCleanup } from '../../services/tokenBlacklist.service.js';
import { startScheduler } from '../../services/scheduler.service.js';
import { initBackupScheduler } from '../../services/backup-scheduler.service.js';
import {
    initializeWorker as initBatchJobsWorker,
    startWorker as startBatchJobsWorker
} from '../../services/batchJobsWorker/workerLifecycle.js';
import { initializeLLMAvailabilityState } from '../../services/llmAvailability.service.js';
import { subscribeToCacheInvalidations } from '../../services/cacheVersion.service.js';

function isEnvFlagEnabled(envName) {
    return String(process.env[envName] || '').toLowerCase() === 'true';
}

export function buildNoDatabaseRuntimeReport() {
    return { started: [], skipped: ['databaseBackedRuntimeServices'], failed: [] };
}

export async function startDatabaseRuntimeServices() {
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

export function startDatabaseCleanupServices() {
    startBlacklistCleanup(60 * 60 * 1000);
}
