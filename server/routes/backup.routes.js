/**
 * Backup Routes
 * API endpoints for database backup management
 */

import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { safeLog } from '../utils/logger.backend.js';
import { validateBody, updateBackupSettingsSchema, testBackupConnectionSchema, restoreBackupSchema } from '../utils/validation.js';
import { securityLog, getRequestMetadata, LOG_LEVELS, SECURITY_EVENTS } from '../services/security.service.js';
import {
    getBackupSettings,
    saveBackupSettings,
    getBackupHistory,
    deleteHistoryEntry,
    testConnection,
    listRemoteBackups,
    createBackup,
    restoreBackup
} from '../services/backup.service.js';
import { reloadBackupScheduler, getSchedulerStatus } from '../services/backup-scheduler.service.js';

const router = express.Router();

// All backup routes require admin authentication
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/backup/settings
 * Get backup configuration
 */
router.get('/settings', async (req, res) => {
    try {
        const settings = await getBackupSettings();
        const schedulerStatus = getSchedulerStatus();
        
        // Don't send password to client
        if (settings) {
            const { password, ...safeSettings } = settings;
            return res.json({
                ...safeSettings,
                hasPassword: !!password,
                schedulerStatus
            });
        }
        
        res.json({ 
            settings: null,
            schedulerStatus 
        });
    } catch (error) {
        safeLog('error', 'Failed to get backup settings', { error: error.message });
        res.status(500).json({ error: 'Failed to get backup settings' });
    }
});

/**
 * PUT /api/backup/settings
 * Update backup configuration
 */
router.put('/settings', validateBody(updateBackupSettingsSchema), async (req, res) => {
    try {
        const {
            backup_target,
            protocol,
            tls_mode,
            host,
            port,
            username,
            password,
            remote_path,
            daily_enabled,
            daily_time,
            daily_retention,
            weekly_enabled,
            weekly_day,
            weekly_time,
            weekly_retention,
            monthly_enabled,
            monthly_day,
            monthly_time,
            monthly_retention
        } = req.body;
        
        // Get existing settings to preserve password if not provided
        const existingSettings = await getBackupSettings();
        
        const settings = await saveBackupSettings({
            backup_target: backup_target || 'local',
            protocol: protocol || 'ftp',
            tls_mode: tls_mode || 'explicit',
            host: host || '',
            port: port || (protocol === 'sftp' ? 22 : 21),
            username: username || '',
            password: password || (existingSettings?.password) || '',
            remote_path: remote_path || '/backups',
            daily_enabled: daily_enabled || false,
            daily_time: daily_time || '02:00',
            daily_retention: daily_retention || 7,
            weekly_enabled: weekly_enabled || false,
            weekly_day: weekly_day ?? 0,
            weekly_time: weekly_time || '03:00',
            weekly_retention: weekly_retention || 4,
            monthly_enabled: monthly_enabled || false,
            monthly_day: monthly_day || 1,
            monthly_time: monthly_time || '04:00',
            monthly_retention: monthly_retention || 12
        });
        
        // Reload scheduler with new settings
        await reloadBackupScheduler();
        
        // Don't send password back
        const { password: pwd, ...safeSettings } = settings;
        
        safeLog('info', 'Backup settings updated', { 
            userId: req.user.id,
            host: settings.host,
            protocol: settings.protocol
        });
        
        res.json({
            ...safeSettings,
            hasPassword: !!pwd,
            schedulerStatus: getSchedulerStatus()
        });
    } catch (error) {
        safeLog('error', 'Failed to save backup settings', { error: error.message });
        res.status(500).json({ error: 'Failed to save backup settings' });
    }
});

/**
 * POST /api/backup/test-connection
 * Test FTP/SFTP connection
 */
router.post('/test-connection', validateBody(testBackupConnectionSchema), async (req, res) => {
    try {
        const { protocol, tls_mode, host, port, username, password, remote_path } = req.body;
        
        safeLog('info', 'Test connection request received', {
            protocol,
            tls_mode,
            host,
            port,
            username,
            hasPassword: !!password,
            remote_path
        });
        
        // If no password provided, try to use existing one
        let testPassword = password;
        if (!testPassword) {
            const existingSettings = await getBackupSettings();
            testPassword = existingSettings?.password;
            safeLog('info', 'Using existing password from settings', { 
                hasExistingPassword: !!testPassword 
            });
        }
        
        if (!host || !username) {
            return res.status(400).json({ 
                success: false, 
                message: 'Host and username are required' 
            });
        }
        
        const connectionParams = {
            protocol: protocol || 'ftp',
            tls_mode: tls_mode || 'explicit',
            host,
            port: port || (protocol === 'sftp' ? 22 : 21),
            username,
            password: testPassword,
            remote_path: remote_path || '/backups'
        };
        
        safeLog('info', 'Calling testConnection with params', {
            ...connectionParams,
            password: connectionParams.password ? '***' : 'MISSING'
        });
        
        const result = await testConnection(connectionParams);
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Connection test failed', { error: error.message });
        res.status(500).json({ success: false, message: 'Connection test failed' });
    }
});

/**
 * POST /api/backup/run
 * Trigger manual backup
 */
router.post('/run', async (req, res) => {
    try {
        safeLog('info', 'Manual backup triggered', { userId: req.user.id });
        
        const result = await createBackup('manual');
        
        res.json({
            success: true,
            ...result
        });
    } catch (error) {
        safeLog('error', 'Manual backup failed', { error: error.message });
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

/**
 * GET /api/backup/history
 * Get backup history
 */
router.get('/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        const history = await getBackupHistory(limit, offset);
        
        res.json(history);
    } catch (error) {
        safeLog('error', 'Failed to get backup history', { error: error.message });
        res.status(500).json({ error: 'Failed to get backup history' });
    }
});

/**
 * DELETE /api/backup/history/:id
 * Delete a backup history entry
 */
router.delete('/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        await deleteHistoryEntry(id);
        
        res.json({ success: true });
    } catch (error) {
        safeLog('error', 'Failed to delete history entry', { error: error.message });
        res.status(500).json({ error: 'Failed to delete history entry' });
    }
});

/**
 * GET /api/backup/list-remote
 * List backups on remote server
 */
router.get('/list-remote', async (req, res) => {
    try {
        const settings = await getBackupSettings();
        
        if (!settings || !settings.host) {
            return res.json({ 
                success: false, 
                files: [], 
                message: 'Backup settings not configured' 
            });
        }
        
        const result = await listRemoteBackups(settings);
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Failed to list remote backups', { error: 'Failed to list remote backups' });
        res.status(500).json({ 
            success: false, 
            files: [] 
        });
    }
});

/**
 * POST /api/backup/restore
 * Restore database from backup
 */
router.post('/restore', validateBody(restoreBackupSchema), async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename) {
            return res.status(400).json({ 
                success: false, 
                message: 'Filename is required' 
            });
        }
        
        safeLog('warn', 'Database restore initiated', { 
            userId: req.user.id,
            filename 
        });
        
        const result = await restoreBackup(filename);
        
        securityLog(LOG_LEVELS.SECURITY, SECURITY_EVENTS.BACKUP_RESTORE, {
            ...getRequestMetadata(req),
            restoredBy: req.user?.id,
            action: 'BACKUP_RESTORE',
            message: 'Database restored from backup',
            metadata: { filename }
        });
        
        safeLog('info', 'Database restore completed', { filename });
        
        res.json(result);
    } catch (error) {
        safeLog('error', 'Database restore failed', { error: 'Database restore failed' });
        res.status(500).json({ 
            success: false 
        });
    }
});

/**
 * GET /api/backup/scheduler-status
 * Get scheduler status
 */
router.get('/scheduler-status', async (req, res) => {
    try {
        const status = getSchedulerStatus();
        res.json(status);
    } catch (_error) {
        res.status(500).json({ error: 'Failed to get scheduler status' });
    }
});

export default router;
