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
 */
function parseTime(timeStr) {
    const [hours, minutes] = (timeStr || '02:00').split(':').map(Number);
    return { hours, minutes };
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
 */
export async function initBackupScheduler() {
    try {
        const settings = await getBackupSettings();
        
        if (!settings) {
            safeLog('info', '[BackupScheduler] No backup settings found, scheduler not started');
            return;
        }
        
        // Stop existing jobs before reinitializing
        stopAllJobs();
        
        // Daily backup
        if (settings.daily_enabled && settings.host) {
            const cronExpr = buildDailyCron(settings.daily_time);
            cronJobs.daily = cron.schedule(cronExpr, () => executeBackup('daily'), {
                scheduled: true,
                timezone: 'Europe/Paris'
            });
            safeLog('info', '[BackupScheduler] Daily backup scheduled', { 
                cron: cronExpr,
                time: settings.daily_time 
            });
        }
        
        // Weekly backup
        if (settings.weekly_enabled && settings.host) {
            const cronExpr = buildWeeklyCron(settings.weekly_time, settings.weekly_day);
            cronJobs.weekly = cron.schedule(cronExpr, () => executeBackup('weekly'), {
                scheduled: true,
                timezone: 'Europe/Paris'
            });
            const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
            safeLog('info', '[BackupScheduler] Weekly backup scheduled', { 
                cron: cronExpr,
                day: dayNames[settings.weekly_day],
                time: settings.weekly_time 
            });
        }
        
        // Monthly backup
        if (settings.monthly_enabled && settings.host) {
            const cronExpr = buildMonthlyCron(settings.monthly_time, settings.monthly_day);
            cronJobs.monthly = cron.schedule(cronExpr, () => executeBackup('monthly'), {
                scheduled: true,
                timezone: 'Europe/Paris'
            });
            safeLog('info', '[BackupScheduler] Monthly backup scheduled', { 
                cron: cronExpr,
                dayOfMonth: settings.monthly_day,
                time: settings.monthly_time 
            });
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
