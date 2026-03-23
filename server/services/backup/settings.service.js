/**
 * Backup Settings Service
 * Handles backup settings CRUD and table initialization
 */

import { query } from '../../config/database.js';
import { safeLog } from '../../utils/logger.backend.js';

/**
 * Initialize backup tables if they don't exist
 */
export async function initBackupTables() {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS backup_settings (
                id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
                backup_target VARCHAR(10) DEFAULT 'local' CHECK (backup_target IN ('local', 'remote')),
                protocol VARCHAR(10) DEFAULT 'ftp' CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
                tls_mode VARCHAR(10) DEFAULT 'explicit' CHECK (tls_mode IN ('none', 'explicit', 'implicit')),
                host VARCHAR(255),
                port INTEGER DEFAULT 21,
                username VARCHAR(255),
                password VARCHAR(255),
                remote_path VARCHAR(500) DEFAULT '/',
                daily_enabled BOOLEAN DEFAULT false,
                daily_time VARCHAR(5) DEFAULT '02:00',
                daily_retention INTEGER DEFAULT 7,
                weekly_enabled BOOLEAN DEFAULT false,
                weekly_day INTEGER DEFAULT 0 CHECK (weekly_day >= 0 AND weekly_day <= 6),
                weekly_time VARCHAR(5) DEFAULT '03:00',
                weekly_retention INTEGER DEFAULT 4,
                monthly_enabled BOOLEAN DEFAULT false,
                monthly_day INTEGER DEFAULT 1 CHECK (monthly_day >= 1 AND monthly_day <= 28),
                monthly_time VARCHAR(5) DEFAULT '04:00',
                monthly_retention INTEGER DEFAULT 12,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_settings' AND column_name = 'backup_target') THEN
                    ALTER TABLE backup_settings ADD COLUMN backup_target VARCHAR(10) DEFAULT 'local' CHECK (backup_target IN ('local', 'remote'));
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_settings' AND column_name = 'daily_retention') THEN
                    ALTER TABLE backup_settings ADD COLUMN daily_retention INTEGER DEFAULT 7;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_settings' AND column_name = 'weekly_retention') THEN
                    ALTER TABLE backup_settings ADD COLUMN weekly_retention INTEGER DEFAULT 4;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_settings' AND column_name = 'monthly_retention') THEN
                    ALTER TABLE backup_settings ADD COLUMN monthly_retention INTEGER DEFAULT 12;
                END IF;
            END $$;
        `);

        await query(`
            CREATE TABLE IF NOT EXISTS backup_history (
                id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
                backup_type VARCHAR(20) NOT NULL,
                filename VARCHAR(500) NOT NULL,
                file_size BIGINT,
                size_bytes BIGINT,
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'completed')),
                started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP WITH TIME ZONE,
                error_message TEXT,
                uploaded BOOLEAN DEFAULT false
            )
        `);

        await query(`
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_history' AND column_name = 'type')
                   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_history' AND column_name = 'backup_type') THEN
                    ALTER TABLE backup_history ADD COLUMN backup_type VARCHAR(20);
                    EXECUTE 'UPDATE backup_history SET backup_type = type WHERE backup_type IS NULL';
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_history' AND column_name = 'backup_type') THEN
                    ALTER TABLE backup_history ADD COLUMN backup_type VARCHAR(20);
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_history' AND column_name = 'file_size') THEN
                    ALTER TABLE backup_history ADD COLUMN file_size BIGINT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'backup_history' AND column_name = 'size_bytes') THEN
                    ALTER TABLE backup_history ADD COLUMN size_bytes BIGINT;
                END IF;
                EXECUTE 'UPDATE backup_history SET backup_type = COALESCE(backup_type, ''manual'') WHERE backup_type IS NULL';
                EXECUTE 'UPDATE backup_history SET file_size = COALESCE(file_size, size_bytes) WHERE file_size IS NULL';
                EXECUTE 'UPDATE backup_history SET size_bytes = COALESCE(size_bytes, file_size) WHERE size_bytes IS NULL';
            END $$;
        `);

        await query(`CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON backup_history(started_at DESC)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status)`);

        safeLog('info', 'Backup tables initialized');
    } catch (error) {
        safeLog('error', 'Failed to initialize backup tables', { error: error.message });
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
        return result.rows[0];
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
                settings.password || '',
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
            settings.password || '',
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
