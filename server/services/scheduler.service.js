/**
 * Scheduler Service
 * Handles scheduled tasks for GDPR consent management
 * - Check for expired consents
 * - Send consent reminders
 * - Purge expired/refused resumes
 */

import { safeLog } from '../utils/logger.backend.js';
import { 
    checkExpiredConsents, 
    sendConsentReminders, 
    purgeExpiredResumes 
} from './consent.service.js';

// Scheduler intervals
let consentCheckInterval = null;
let reminderInterval = null;
let purgeInterval = null;

// Default intervals (in milliseconds)
const CONSENT_CHECK_INTERVAL = 60 * 60 * 1000; // 1 hour
const REMINDER_CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const PURGE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

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
 * Start all scheduled tasks
 */
export function startScheduler() {
    safeLog('info', '[Scheduler] Starting GDPR consent scheduler');

    // Run initial checks after a short delay (let server fully start)
    setTimeout(async () => {
        safeLog('info', '[Scheduler] Running initial consent checks');
        await runConsentCheck();
        await runPurgeCheck();
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

    safeLog('info', '[Scheduler] GDPR consent scheduler started', {
        consentCheckInterval: `${CONSENT_CHECK_INTERVAL / 1000 / 60} minutes`,
        reminderInterval: `${REMINDER_CHECK_INTERVAL / 1000 / 60 / 60} hours`,
        purgeInterval: `${PURGE_CHECK_INTERVAL / 1000 / 60 / 60} hours`
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
        purgedCount: 0
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

    safeLog('info', '[Scheduler] Manual checks completed', results);
    return results;
}

export default {
    startScheduler,
    stopScheduler,
    runAllChecks
};
