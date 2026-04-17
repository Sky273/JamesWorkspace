import { safeLog } from '../../utils/logger.backend.js';
import {
    cleanupCachesOnStartup,
    registerStartupCacheCleanups,
    startBackgroundCacheCleanups
} from './runtimeMaintenance.cacheBootstrap.js';
import {
    buildNoDatabaseRuntimeReport,
    startDatabaseCleanupServices,
    startDatabaseRuntimeServices
} from './runtimeMaintenance.database.js';
import { startAlwaysOnRuntimeServices } from './runtimeMaintenance.alwaysOn.js';

export async function startRuntimeMaintenance({ dbInitialized }) {
    await cleanupCachesOnStartup();
    registerStartupCacheCleanups();

    const databaseReport = dbInitialized
        ? await startDatabaseRuntimeServices()
        : buildNoDatabaseRuntimeReport();

    startAlwaysOnRuntimeServices({ dbInitialized });
    startBackgroundCacheCleanups();

    if (dbInitialized) {
        startDatabaseCleanupServices();
    }

    safeLog('info', 'Runtime maintenance startup completed', {
        dbInitialized,
        started: databaseReport.started,
        skipped: databaseReport.skipped,
        failed: databaseReport.failed
    });
}
