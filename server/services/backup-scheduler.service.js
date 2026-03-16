/**
 * Backup Scheduler Service
 * Handles scheduled database backups using setInterval
 * Checks every minute if a backup should run
 */

import { safeLog } from '../utils/logger.backend.js';
import { getBackupSettings, createBackup } from './backup.service.js';

// Store scheduler state
let schedulerInterval = null;
let lastExecuted = {
    daily: null,
    weekly: null,
    monthly: null
};

/**
 * Parse time string (HH:MM or HH:MM:SS) to hours and minutes
 */
function parseTime(timeStr) {
    const [hours, minutes] = (timeStr || '02:00').split(':').map(Number);
    return { hours, minutes };
}

/**
 * Get current time in Paris timezone
 */
function getParisTime() {
    const now = new Date();
    const parisStr = now.toLocaleString('en-US', { 
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const [hours, minutes] = parisStr.split(':').map(Number);
    const dayOfWeek = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getDay();
    const dayOfMonth = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })).getDate();
    return { hours, minutes, dayOfWeek, dayOfMonth };
}

/**
 * Check if time matches (within the same minute)
 */
function timeMatches(configTime, currentHours, currentMinutes) {
    const { hours, minutes } = parseTime(configTime);
    return hours === currentHours && minutes === currentMinutes;
}

/**
 * Get today's date string for tracking executed backups
 */
function getTodayKey() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Execute backup with error handling
 * Ensures errors are always logged and never fail silently
 */
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
        // Log error with full details - never fail silently
        safeLog('error', `[BackupScheduler] BACKUP FAILED - Scheduled ${type} backup failed after ${duration}s`, {
            type,
            error: error.message,
            stack: error.stack,
            code: error.code,
            durationSeconds: duration
        });
    }
}

/**
 * Check and execute scheduled backups
 */
async function checkAndExecuteBackups() {
    try {
        const settings = await getBackupSettings();
        if (!settings) return;
        
        const { hours, minutes, dayOfWeek, dayOfMonth } = getParisTime();
        const todayKey = getTodayKey();
        
        // Daily backup
        if (settings.daily_enabled && timeMatches(settings.daily_time, hours, minutes)) {
            if (lastExecuted.daily !== todayKey) {
                lastExecuted.daily = todayKey;
                safeLog('info', '[BackupScheduler] Triggering daily backup', { time: `${hours}:${minutes}`, parisTime: settings.daily_time });
                executeBackup('daily');
            }
        }
        
        // Weekly backup (check day of week)
        if (settings.weekly_enabled && 
            settings.weekly_day === dayOfWeek && 
            timeMatches(settings.weekly_time, hours, minutes)) {
            const weekKey = `${todayKey}-weekly`;
            if (lastExecuted.weekly !== weekKey) {
                lastExecuted.weekly = weekKey;
                safeLog('info', '[BackupScheduler] Triggering weekly backup', { time: `${hours}:${minutes}`, dayOfWeek });
                executeBackup('weekly');
            }
        }
        
        // Monthly backup (check day of month)
        if (settings.monthly_enabled && 
            settings.monthly_day === dayOfMonth && 
            timeMatches(settings.monthly_time, hours, minutes)) {
            const monthKey = `${todayKey}-monthly`;
            if (lastExecuted.monthly !== monthKey) {
                lastExecuted.monthly = monthKey;
                safeLog('info', '[BackupScheduler] Triggering monthly backup', { time: `${hours}:${minutes}`, dayOfMonth });
                executeBackup('monthly');
            }
        }
    } catch (error) {
        safeLog('error', '[BackupScheduler] Error checking backups', { error: error.message });
    }
}

/**
 * Initialize backup scheduler based on settings
 * Uses setInterval to check every minute if a backup should run
 */
export async function initBackupScheduler() {
    try {
        // Stop existing interval if any
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
        
        // Log settings for debugging
        const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
        safeLog('info', '[BackupScheduler] Loaded backup settings', {
            host: settings.host ? '***configured***' : 'NOT SET',
            daily_enabled: settings.daily_enabled,
            daily_time: settings.daily_time,
            weekly_enabled: settings.weekly_enabled,
            weekly_day: settings.weekly_day,
            weekly_day_name: dayNames[settings.weekly_day],
            weekly_time: settings.weekly_time,
            monthly_enabled: settings.monthly_enabled,
            monthly_day: settings.monthly_day,
            monthly_time: settings.monthly_time
        });
        
        // Check if any backup is enabled
        const hasEnabledBackups = settings.daily_enabled || settings.weekly_enabled || settings.monthly_enabled;
        
        if (!hasEnabledBackups) {
            safeLog('info', '[BackupScheduler] No backup jobs enabled');
            return;
        }
        
        // Start interval to check every 30 seconds
        schedulerInterval = setInterval(checkAndExecuteBackups, 30 * 1000);
        
        // Log scheduled times
        if (settings.daily_enabled) {
            safeLog('info', '[BackupScheduler] Daily backup scheduled', { 
                time: settings.daily_time,
                uploadEnabled: !!settings.host
            });
        }
        if (settings.weekly_enabled) {
            safeLog('info', '[BackupScheduler] Weekly backup scheduled', { 
                day: dayNames[settings.weekly_day],
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

/**
 * Reload scheduler (call after settings change)
 */
export async function reloadBackupScheduler() {
    safeLog('info', '[BackupScheduler] Reloading backup scheduler');
    // Reset last executed to allow re-triggering if time changed
    lastExecuted = { daily: null, weekly: null, monthly: null };
    await initBackupScheduler();
}

/**
 * Stop backup scheduler
 */
export function stopBackupScheduler() {
    safeLog('info', '[BackupScheduler] Stopping backup scheduler');
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
    }
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
    return {
        running: schedulerInterval !== null,
        lastExecuted
    };
}

export default {
    initBackupScheduler,
    reloadBackupScheduler,
    stopBackupScheduler,
    getSchedulerStatus
};
