/**
 * Backup Scheduler Service
 * Handles scheduled database backups using setInterval
 * Checks every minute if a backup should run
 */

import { safeLog } from '../utils/logger.backend.js';
import { getBackupSettings, createBackup } from './backup.service.js';
import { getDpoSettings } from './consent/operations.js';
import {
    buildBackupScheduleSummary,
    createBackupFailureEmailContent,
    getBackupDayName,
    getBackupExecutionKey,
    getParisTime,
    getTodayKey,
    timeMatches
} from './backup-scheduler.utils.js';

let schedulerInterval = null;
let lastExecuted = {
    daily: null,
    weekly: null,
    monthly: null
};

async function executeBackup(type) {
    const startTime = Date.now();
    try {
        safeLog('info', `[BackupScheduler] Starting scheduled ${type} backup`);
        const result = await createBackup(type);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        safeLog('info', `[BackupScheduler] Scheduled ${type} backup completed`, {
            filename: result.filename,
            size: result.size,
            uploaded: result.uploaded,
            durationSeconds: duration
        });
    } catch (error) {
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        safeLog('error', `[BackupScheduler] BACKUP FAILED - Scheduled ${type} backup failed after ${duration}s`, {
            type,
            error: error.message,
            stack: error.stack,
            code: error.code,
            durationSeconds: duration
        });
        await notifyDpoBackupFailure(type, error, duration);
    }
}

async function notifyDpoBackupFailure(type, error, duration) {
    try {
        const dpoSettings = await getDpoSettings();
        const dpoEmail = dpoSettings?.dpo_email;

        if (!dpoEmail) {
            safeLog('warn', '[BackupScheduler] No DPO email configured - cannot send backup failure notification');
            return;
        }

        const { sendEmail } = await import('./mail/gdprMailService.js');
        const emailContent = createBackupFailureEmailContent(type, error, duration);

        await sendEmail({
            to: dpoEmail,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        });

        safeLog('info', '[BackupScheduler] Backup failure notification sent to DPO', { dpoEmail });
    } catch (notifyError) {
        safeLog('error', '[BackupScheduler] Failed to send backup failure notification to DPO', {
            error: notifyError.message
        });
    }
}

async function checkAndExecuteBackups() {
    try {
        const settings = await getBackupSettings();
        if (!settings) {
            return;
        }

        const { hours, minutes, dayOfWeek, dayOfMonth } = getParisTime();
        const todayKey = getTodayKey();

        if (settings.daily_enabled && timeMatches(settings.daily_time, hours, minutes)) {
            const executionKey = getBackupExecutionKey('daily', todayKey);
            if (lastExecuted.daily !== executionKey) {
                lastExecuted.daily = executionKey;
                safeLog('info', '[BackupScheduler] Triggering daily backup', { time: `${hours}:${minutes}`, parisTime: settings.daily_time });
                executeBackup('daily');
            }
        }

        if (settings.weekly_enabled
            && settings.weekly_day === dayOfWeek
            && timeMatches(settings.weekly_time, hours, minutes)) {
            const executionKey = getBackupExecutionKey('weekly', todayKey);
            if (lastExecuted.weekly !== executionKey) {
                lastExecuted.weekly = executionKey;
                safeLog('info', '[BackupScheduler] Triggering weekly backup', { time: `${hours}:${minutes}`, dayOfWeek });
                executeBackup('weekly');
            }
        }

        if (settings.monthly_enabled
            && settings.monthly_day === dayOfMonth
            && timeMatches(settings.monthly_time, hours, minutes)) {
            const executionKey = getBackupExecutionKey('monthly', todayKey);
            if (lastExecuted.monthly !== executionKey) {
                lastExecuted.monthly = executionKey;
                safeLog('info', '[BackupScheduler] Triggering monthly backup', { time: `${hours}:${minutes}`, dayOfMonth });
                executeBackup('monthly');
            }
        }
    } catch (error) {
        safeLog('error', '[BackupScheduler] Error checking backups', { error: error.message });
    }
}

export async function initBackupScheduler() {
    try {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
        }

        let settings;
        try {
            settings = await getBackupSettings();
        } catch (dbError) {
            safeLog('warn', '[BackupScheduler] Could not load backup settings from database', {
                error: dbError.message
            });
            return;
        }

        if (!settings) {
            safeLog('info', '[BackupScheduler] No backup settings found, scheduler not started');
            return;
        }

        safeLog('info', '[BackupScheduler] Loaded backup settings', buildBackupScheduleSummary(settings));

        const hasEnabledBackups = settings.daily_enabled || settings.weekly_enabled || settings.monthly_enabled;
        if (!hasEnabledBackups) {
            safeLog('info', '[BackupScheduler] No backup jobs enabled');
            return;
        }

        schedulerInterval = setInterval(checkAndExecuteBackups, 30 * 1000);

        if (settings.daily_enabled) {
            safeLog('info', '[BackupScheduler] Daily backup scheduled', {
                time: settings.daily_time,
                uploadEnabled: !!settings.host
            });
        }
        if (settings.weekly_enabled) {
            safeLog('info', '[BackupScheduler] Weekly backup scheduled', {
                day: getBackupDayName(settings.weekly_day),
                time: settings.weekly_time,
                uploadEnabled: !!settings.host
            });
        }
        if (settings.monthly_enabled) {
            safeLog('info', '[BackupScheduler] Monthly backup scheduled', {
                dayOfMonth: settings.monthly_day,
                time: settings.monthly_time,
                uploadEnabled: !!settings.host
            });
        }

        safeLog('info', '[BackupScheduler] Backup scheduler initialized (checking every 30s)');
    } catch (error) {
        safeLog('error', '[BackupScheduler] Failed to initialize backup scheduler', {
            error: error.message
        });
    }
}

export async function reloadBackupScheduler() {
    safeLog('info', '[BackupScheduler] Reloading backup scheduler');
    lastExecuted = { daily: null, weekly: null, monthly: null };
    await initBackupScheduler();
}

export function stopBackupScheduler() {
    safeLog('info', '[BackupScheduler] Stopping backup scheduler');
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}

export function getSchedulerStatus() {
    return {
        running: schedulerInterval !== null,
        lastExecuted
    };
}
