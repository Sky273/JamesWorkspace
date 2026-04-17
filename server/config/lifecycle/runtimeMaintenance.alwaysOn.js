import { startRateLimitCleanup } from '../../middleware/rateLimit.middleware.js';
import { startPeriodicCleanup } from '../../utils/fileCleanup.js';
import { startMemoryMonitor } from '../../services/memoryMonitor.service.js';
import { startAuthOauthStatesCleanup } from '../../services/authOauthState.service.js';
import { startMailStatesCleanup } from '../../services/mailOauthState.service.js';
import { startGdprMailStatesCleanup } from '../../services/gdprMailOauthState.service.js';

export function startAlwaysOnRuntimeServices({ dbInitialized }) {
    startRateLimitCleanup();
    startAuthOauthStatesCleanup();
    startMailStatesCleanup();
    startPeriodicCleanup(60 * 60 * 1000, 60 * 60 * 1000, { enableDatabaseTasks: dbInitialized });
    startGdprMailStatesCleanup();
    startMemoryMonitor();
}
