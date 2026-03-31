/**
 * Backup Settings Service
 * Handles backup settings CRUD and table initialization
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';
import { assertSchemaRequirements } from '../schemaVerification.service.js';
import { decryptSecret, encryptSecret } from '../../utils/secretCrypto.js';

const BACKUP_SECRET_OPTIONS = {
    envVarNames: ['BACKUP_SECRET_ENCRYPTION_KEY', 'MAIL_TOKEN_ENCRYPTION_KEY'],
    purpose: 'backup-settings'
};

/**
 * Verify backup schema is present
 */
export async function initBackupTables() {
    try {
        await assertSchemaRequirements({
            context: 'backup',
            tables: ['backup_settings', 'backup_history'],
            columns: {
                backup_settings: ['backup_target', 'daily_retention', 'weekly_retention', 'monthly_retention'],
                backup_history: ['backup_type', 'file_size', 'size_bytes']
            },
            indexes: ['idx_backup_history_started_at', 'idx_backup_history_status']
        });

        safeLog('info', 'Backup schema verified');
    } catch (error) {
        safeLog('error', 'Failed to verify backup schema', { error: error.message });
        throw error;
    }
}

/**
 * Get backup settings from database
 */
export async function getBackupSettings() {
    try {
        const result = await query('SELECT * FROM backup_settings LIMIT 1');
        if (result.rows.length === 0) {
            return null;
        }
        const settings = result.rows[0];
        return {
            ...settings,
            password: settings.password ? decryptSecret(settings.password, BACKUP_SECRET_OPTIONS) : ''
        };
    } catch (error) {
        safeLog('error', 'Failed to get backup settings', { error: error.message });
        throw error;
    }
}

/**
 * Save backup settings to database
 */
export async function saveBackupSettings(settings) {
    try {
        const existingSettings = await getBackupSettings();
        const encryptedPassword = settings.password
            ? encryptSecret(settings.password, BACKUP_SECRET_OPTIONS)
            : '';

        if (existingSettings) {
            const result = await query(`
                UPDATE backup_settings SET
                    backup_target = $1,
                    protocol = $2,
                    tls_mode = $3,
                    host = $4,
                    port = $5,
                    username = $6,
                    password = $7,
                    remote_path = $8,
                    daily_enabled = $9,
                    daily_time = $10,
                    daily_retention = $11,
                    weekly_enabled = $12,
                    weekly_day = $13,
                    weekly_time = $14,
                    weekly_retention = $15,
                    monthly_enabled = $16,
                    monthly_day = $17,
                    monthly_time = $18,
                    monthly_retention = $19
                WHERE id = $20
                RETURNING *
            `, [
                settings.backup_target || 'local',
                settings.protocol || 'ftp',
                settings.tls_mode || 'explicit',
                settings.host || '',
                settings.port || 21,
                settings.username || '',
                encryptedPassword,
                settings.remote_path || '/backups',
                settings.daily_enabled || false,
                settings.daily_time || '02:00',
                settings.daily_retention || 7,
                settings.weekly_enabled || false,
                settings.weekly_day || 0,
                settings.weekly_time || '03:00',
                settings.weekly_retention || 4,
                settings.monthly_enabled || false,
                settings.monthly_day || 1,
                settings.monthly_time || '04:00',
                settings.monthly_retention || 12,
                existingSettings.id
            ]);
            return result.rows[0];
        }

        const result = await query(`
            INSERT INTO backup_settings (
                backup_target, protocol, tls_mode, host, port, username, password, remote_path,
                daily_enabled, daily_time, daily_retention,
                weekly_enabled, weekly_day, weekly_time, weekly_retention,
                monthly_enabled, monthly_day, monthly_time, monthly_retention
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *
        `, [
            settings.backup_target || 'local',
            settings.protocol || 'ftp',
            settings.tls_mode || 'explicit',
                settings.host || '',
                settings.port || 21,
                settings.username || '',
                encryptedPassword,
                settings.remote_path || '/backups',
                settings.daily_enabled || false,
                settings.daily_time || '02:00',
            settings.daily_retention || 7,
            settings.weekly_enabled || false,
            settings.weekly_day || 0,
            settings.weekly_time || '03:00',
            settings.weekly_retention || 4,
            settings.monthly_enabled || false,
            settings.monthly_day || 1,
            settings.monthly_time || '04:00',
            settings.monthly_retention || 12
        ]);
        return result.rows[0];
    } catch (error) {
        safeLog('error', 'Failed to save backup settings', { error: error.message });
        throw error;
    }
}
