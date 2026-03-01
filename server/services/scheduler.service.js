/**
 * Scheduler Service
 * Handles scheduled tasks for GDPR consent management
 * - Check for expired consents
 * - Send consent reminders
 * - Purge expired/refused resumes
 * - Proactive GDPR token refresh (weekly)
 */

import { safeLog } from '../utils/logger.backend.js';
import { 
    checkExpiredConsents, 
    sendConsentReminders, 
    purgeExpiredResumes 
} from './consent.service.js';
import { proactiveTokenRefresh } from './mail/gdprMailService.js';

// Scheduler intervals
let consentCheckInterval = null;
let reminderInterval = null;
let purgeInterval = null;
let tokenRefreshInterval = null;

// Default intervals (in milliseconds)
const CONSENT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const REMINDER_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const PURGE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_REFRESH_INTERVAL = 7 * 24 * 60 * 60 * 1000; // 7 days (weekly)

/**
 * Run consent expiration check
 */
async function runConsentCheck() {
    try {
        const expiredCount = await checkExpiredConsents();
        if (expiredCount > 0) {
            safeLog('info', '[Scheduler] Consent check completed', { expiredCount });
        }
    } catch (error) {
        safeLog('error', '[Scheduler] Consent check failed', { error: error.message });
    }
}

/**
 * Run reminder sending
 */
async function runReminderCheck() {
    try {
        const sentCount = await sendConsentReminders();
        if (sentCount > 0) {
            safeLog('info', '[Scheduler] Reminders sent', { sentCount });
        }
    } catch (error) {
        safeLog('error', '[Scheduler] Reminder check failed', { error: error.message });
    }
}

/**
 * Run purge of expired/refused resumes
 */
async function runPurgeCheck() {
    try {
        const purgedCount = await purgeExpiredResumes();
        if (purgedCount > 0) {
            safeLog('info', '[Scheduler] Purge completed', { purgedCount });
        }
    } catch (error) {
        safeLog('error', '[Scheduler] Purge check failed', { error: error.message });
    }
}

/**
 * Run proactive GDPR token refresh
 * This keeps the Google OAuth refresh token active and prevents expiration
 */
async function runTokenRefresh() {
    try {
        const result = await proactiveTokenRefresh();
        if (result.success) {
            safeLog('info', '[Scheduler] GDPR token refresh completed', { 
                email: result.email,
                message: result.message 
            });
        } else {
            safeLog('warn', '[Scheduler] GDPR token refresh issue', { message: result.message });
        }
    } catch (error) {
        safeLog('error', '[Scheduler] GDPR token refresh failed', { error: error.message });
    }
}

/**
 * Start all scheduled tasks
 */
export function startScheduler() {
    safeLog('info', '[Scheduler] Starting GDPR consent scheduler');

    // Run initial checks after a short delay (let server fully start)
    setTimeout(async () => {
        safeLog('info', '[Scheduler] Running initial consent checks');
        await runConsentCheck();
        await runPurgeCheck();
        // Also run token refresh on startup to ensure token is valid
        await runTokenRefresh();
    }, 30000); // 30 seconds after startup

    // Schedule periodic consent expiration checks
    consentCheckInterval = setInterval(runConsentCheck, CONSENT_CHECK_INTERVAL);
    if (consentCheckInterval.unref) {
        consentCheckInterval.unref(); // Don't keep process alive for this
    }

    // Schedule periodic reminder checks
    reminderInterval = setInterval(runReminderCheck, REMINDER_CHECK_INTERVAL);
    if (reminderInterval.unref) {
        reminderInterval.unref();
    }

    // Schedule periodic purge checks
    purgeInterval = setInterval(runPurgeCheck, PURGE_CHECK_INTERVAL);
    if (purgeInterval.unref) {
        purgeInterval.unref();
    }

    // Schedule weekly GDPR token refresh (keeps refresh token active)
    tokenRefreshInterval = setInterval(runTokenRefresh, TOKEN_REFRESH_INTERVAL);
    if (tokenRefreshInterval.unref) {
        tokenRefreshInterval.unref();
    }

    safeLog('info', '[Scheduler] GDPR consent scheduler started', {
        consentCheckInterval: `${CONSENT_CHECK_INTERVAL / 1000 / 60} minutes`,
        reminderInterval: `${REMINDER_CHECK_INTERVAL / 1000 / 60 / 60} hours`,
        purgeInterval: `${PURGE_CHECK_INTERVAL / 1000 / 60 / 60} hours`,
        tokenRefreshInterval: `${TOKEN_REFRESH_INTERVAL / 1000 / 60 / 60 / 24} days`
    });
}

/**
 * Stop all scheduled tasks (for graceful shutdown)
 */
export function stopScheduler() {
    safeLog('info', '[Scheduler] Stopping GDPR consent scheduler');

    if (consentCheckInterval) {
        clearInterval(consentCheckInterval);
        consentCheckInterval = null;
    }

    if (reminderInterval) {
        clearInterval(reminderInterval);
        reminderInterval = null;
    }

    if (purgeInterval) {
        clearInterval(purgeInterval);
        purgeInterval = null;
    }

    if (tokenRefreshInterval) {
        clearInterval(tokenRefreshInterval);
        tokenRefreshInterval = null;
    }

    safeLog('info', '[Scheduler] GDPR consent scheduler stopped');
}

/**
 * Manually trigger all checks (for testing/admin)
 */
export async function runAllChecks() {
    safeLog('info', '[Scheduler] Running all checks manually');
    
    const results = {
        expiredCount: 0,
        remindersSent: 0,
        purgedCount: 0,
        tokenRefresh: null
    };

    try {
        results.expiredCount = await checkExpiredConsents();
    } catch (error) {
        safeLog('error', '[Scheduler] Manual consent check failed', { error: error.message });
    }

    try {
        results.remindersSent = await sendConsentReminders();
    } catch (error) {
        safeLog('error', '[Scheduler] Manual reminder check failed', { error: error.message });
    }

    try {
        results.purgedCount = await purgeExpiredResumes();
    } catch (error) {
        safeLog('error', '[Scheduler] Manual purge check failed', { error: error.message });
    }

    try {
        results.tokenRefresh = await proactiveTokenRefresh();
    } catch (error) {
        safeLog('error', '[Scheduler] Manual token refresh failed', { error: error.message });
        results.tokenRefresh = { success: false, message: error.message };
    }

    safeLog('info', '[Scheduler] Manual checks completed', results);
    return results;
}

export default {
    startScheduler,
    stopScheduler,
    runAllChecks
};
