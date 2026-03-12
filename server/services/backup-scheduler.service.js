/**
 * Backup Scheduler Service
 * Handles scheduled database backups using node-cron
 */

import cron from 'node-cron';
import { safeLog } from '../utils/logger.backend.js';
import { getBackupSettings, createBackup } from './backup.service.js';

// Store active cron jobs
const cronJobs = {
    daily: null,
    weekly: null,
    monthly: null
};

/**
 * Convert time string (HH:MM) to cron expression parts
 * Converts from Europe/Paris timezone to UTC for cron execution
 */
function parseTime(timeStr) {
    const [hours, minutes] = (timeStr || '02:00').split(':').map(Number);
    
    // Convert Paris time to UTC (Paris is UTC+1 in winter, UTC+2 in summer)
    // For simplicity, we'll use a fixed offset of -1 hour (winter time)
    // This means 07:40 Paris = 06:40 UTC
    const now = new Date();
    const parisDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
    const utcDate = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const offsetHours = Math.round((parisDate - utcDate) / (1000 * 60 * 60));
    
    // Adjust hours to UTC
    let utcHours = hours - offsetHours;
    if (utcHours < 0) utcHours += 24;
    if (utcHours >= 24) utcHours -= 24;
    
    return { hours: utcHours, minutes, originalHours: hours };
}

/**
 * Build cron expression for daily backup
 * Format: minute hour * * *
 */
function buildDailyCron(time) {
    const { hours, minutes } = parseTime(time);
    return `${minutes} ${hours} * * *`;
}

/**
 * Build cron expression for weekly backup
 * Format: minute hour * * dayOfWeek
 */
function buildWeeklyCron(time, dayOfWeek) {
    const { hours, minutes } = parseTime(time);
    return `${minutes} ${hours} * * ${dayOfWeek}`;
}

/**
 * Build cron expression for monthly backup
 * Format: minute hour dayOfMonth * *
 */
function buildMonthlyCron(time, dayOfMonth) {
    const { hours, minutes } = parseTime(time);
    return `${minutes} ${hours} ${dayOfMonth} * *`;
}

/**
 * Execute backup with error handling
 */
async function executeBackup(type) {
    try {
        safeLog('info', `[BackupScheduler] Starting scheduled ${type} backup`);
        const result = await createBackup(type);
        safeLog('info', `[BackupScheduler] Scheduled ${type} backup completed`, {
            filename: result.filename,
            size: result.size,
            uploaded: result.uploaded
        });
    } catch (error) {
        safeLog('error', `[BackupScheduler] Scheduled ${type} backup failed`, {
            error: error.message
        });
    }
}

/**
 * Stop all cron jobs
 */
function stopAllJobs() {
    for (const [type, job] of Object.entries(cronJobs)) {
        if (job) {
            job.stop();
            cronJobs[type] = null;
            safeLog('debug', `[BackupScheduler] Stopped ${type} backup job`);
        }
    }
}

/**
 * Initialize backup scheduler based on settings
 * Called at server startup and after settings changes
 */
export async function initBackupScheduler() {
    try {
        let settings;
        try {
            settings = await getBackupSettings();
        } catch (dbError) {
            // Table might not exist yet or DB connection issue
            safeLog('warn', '[BackupScheduler] Could not load backup settings from database', {
                error: dbError.message
            });
            return;
        }
        
        if (!settings) {
            safeLog('info', '[BackupScheduler] No backup settings found, scheduler not started');
            return;
        }
        
        // Log settings for debugging
        safeLog('info', '[BackupScheduler] Loaded backup settings', {
            host: settings.host ? '***configured***' : 'NOT SET',
            daily_enabled: settings.daily_enabled,
            daily_time: settings.daily_time,
            weekly_enabled: settings.weekly_enabled,
            weekly_day: settings.weekly_day,
            weekly_time: settings.weekly_time,
            monthly_enabled: settings.monthly_enabled,
            monthly_day: settings.monthly_day,
            monthly_time: settings.monthly_time
        });
        
        // Stop existing jobs before reinitializing
        stopAllJobs();
        
        // Daily backup
        if (settings.daily_enabled) {
            if (!settings.host) {
                safeLog('warn', '[BackupScheduler] Daily backup enabled but no FTP/SFTP host configured - backups will be local only');
            }
            const cronExpr = buildDailyCron(settings.daily_time);
            const { hours: utcHours, minutes, originalHours } = parseTime(settings.daily_time);
            safeLog('debug', '[BackupScheduler] Creating daily cron job', { cronExpr, parisTime: settings.daily_time, utcHours, minutes });
            cronJobs.daily = cron.schedule(cronExpr, () => executeBackup('daily'), {
                scheduled: false
            });
            cronJobs.daily.start();
            safeLog('info', '[BackupScheduler] Daily backup scheduled and started', { 
                cron: cronExpr,
                parisTime: settings.daily_time,
                utcTime: `${String(utcHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
                uploadEnabled: !!settings.host
            });
        } else {
            safeLog('debug', '[BackupScheduler] Daily backup not enabled');
        }
        
        // Weekly backup
        if (settings.weekly_enabled) {
            if (!settings.host) {
                safeLog('warn', '[BackupScheduler] Weekly backup enabled but no FTP/SFTP host configured - backups will be local only');
            }
            const cronExpr = buildWeeklyCron(settings.weekly_time, settings.weekly_day);
            safeLog('debug', '[BackupScheduler] Creating weekly cron job', { cronExpr });
            cronJobs.weekly = cron.schedule(cronExpr, () => executeBackup('weekly'), {
                scheduled: false
            });
            cronJobs.weekly.start();
            const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            safeLog('info', '[BackupScheduler] Weekly backup scheduled and started', { 
                cron: cronExpr,
                day: dayNames[settings.weekly_day],
                time: settings.weekly_time,
                uploadEnabled: !!settings.host
            });
        } else {
            safeLog('debug', '[BackupScheduler] Weekly backup not enabled');
        }
        
        // Monthly backup
        if (settings.monthly_enabled) {
            if (!settings.host) {
                safeLog('warn', '[BackupScheduler] Monthly backup enabled but no FTP/SFTP host configured - backups will be local only');
            }
            const cronExpr = buildMonthlyCron(settings.monthly_time, settings.monthly_day);
            safeLog('debug', '[BackupScheduler] Creating monthly cron job', { cronExpr });
            cronJobs.monthly = cron.schedule(cronExpr, () => executeBackup('monthly'), {
                scheduled: false
            });
            cronJobs.monthly.start();
            safeLog('info', '[BackupScheduler] Monthly backup scheduled and started', { 
                cron: cronExpr,
                dayOfMonth: settings.monthly_day,
                time: settings.monthly_time,
                uploadEnabled: !!settings.host
            });
        } else {
            safeLog('debug', '[BackupScheduler] Monthly backup not enabled');
        }
        
        const activeJobs = Object.entries(cronJobs)
            .filter(([, job]) => job !== null)
            .map(([type]) => type);
        
        if (activeJobs.length > 0) {
            safeLog('info', '[BackupScheduler] Backup scheduler initialized', { 
                activeJobs 
            });
        } else {
            safeLog('info', '[BackupScheduler] No backup jobs enabled');
        }
        
    } catch (error) {
        safeLog('error', '[BackupScheduler] Failed to initialize backup scheduler', {
            error: error.message
        });
    }
}

/**
 * Reload scheduler (call after settings change)
 */
export async function reloadBackupScheduler() {
    safeLog('info', '[BackupScheduler] Reloading backup scheduler');
    await initBackupScheduler();
}

/**
 * Stop backup scheduler
 */
export function stopBackupScheduler() {
    safeLog('info', '[BackupScheduler] Stopping backup scheduler');
    stopAllJobs();
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
    return {
        daily: cronJobs.daily !== null,
        weekly: cronJobs.weekly !== null,
        monthly: cronJobs.monthly !== null
    };
}

export default {
    initBackupScheduler,
    reloadBackupScheduler,
    stopBackupScheduler,
    getSchedulerStatus
};
