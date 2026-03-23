-- Migration: Add backup_settings and backup_history tables
-- Date: 2026-03-08
-- Description: Tables for scheduled database backups via FTP/SFTP

-- Backup settings table
CREATE TABLE IF NOT EXISTS backup_settings (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    protocol VARCHAR(10) DEFAULT 'ftp' CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
    host VARCHAR(255),
    port INTEGER DEFAULT 21,
    username VARCHAR(255),
    password TEXT,
    remote_path VARCHAR(500) DEFAULT '/backups',
    daily_enabled BOOLEAN DEFAULT false,
    daily_time TIME DEFAULT '02:00',
    daily_retention INTEGER DEFAULT 7,
    weekly_enabled BOOLEAN DEFAULT false,
    weekly_day INTEGER DEFAULT 0 CHECK (weekly_day >= 0 AND weekly_day <= 6),
    weekly_time TIME DEFAULT '03:00',
    weekly_retention INTEGER DEFAULT 4,
    monthly_enabled BOOLEAN DEFAULT false,
    monthly_day INTEGER DEFAULT 1 CHECK (monthly_day >= 1 AND monthly_day <= 28),
    monthly_time TIME DEFAULT '04:00',
    monthly_retention INTEGER DEFAULT 12,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE backup_settings IS 'Configuration for scheduled database backups via FTP/SFTP';
COMMENT ON COLUMN backup_settings.protocol IS 'Connection protocol: ftp, ftps, or sftp';
COMMENT ON COLUMN backup_settings.weekly_day IS 'Day of week for weekly backup: 0=Sunday, 6=Saturday';
COMMENT ON COLUMN backup_settings.monthly_day IS 'Day of month for monthly backup (1-28)';

-- Backup history table (canonical schema)
CREATE TABLE IF NOT EXISTS backup_history (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    backup_type VARCHAR(20),
    filename VARCHAR(500) NOT NULL,
    file_size BIGINT,
    size_bytes BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    uploaded BOOLEAN DEFAULT false
);

-- Align older variants of backup_history with the canonical schema.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_history' AND column_name = 'type'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_history' AND column_name = 'backup_type'
    ) THEN
        ALTER TABLE backup_history ADD COLUMN backup_type VARCHAR(20);
        EXECUTE 'UPDATE backup_history SET backup_type = type WHERE backup_type IS NULL';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_history' AND column_name = 'backup_type'
    ) THEN
        ALTER TABLE backup_history ADD COLUMN backup_type VARCHAR(20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_history' AND column_name = 'file_size'
    ) THEN
        ALTER TABLE backup_history ADD COLUMN file_size BIGINT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'backup_history' AND column_name = 'size_bytes'
    ) THEN
        ALTER TABLE backup_history ADD COLUMN size_bytes BIGINT;
    END IF;

    EXECUTE 'UPDATE backup_history SET backup_type = COALESCE(backup_type, ''manual'') WHERE backup_type IS NULL';
    EXECUTE 'UPDATE backup_history SET file_size = COALESCE(file_size, size_bytes) WHERE file_size IS NULL';
    EXECUTE 'UPDATE backup_history SET size_bytes = COALESCE(size_bytes, file_size) WHERE size_bytes IS NULL';

    ALTER TABLE backup_history ALTER COLUMN backup_type SET NOT NULL;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'backup_history' AND constraint_name = 'backup_history_backup_type_check'
    ) THEN
        ALTER TABLE backup_history ADD CONSTRAINT backup_history_backup_type_check
        CHECK (backup_type IN ('daily', 'weekly', 'monthly', 'manual'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'backup_history' AND constraint_name = 'backup_history_status_check'
    ) THEN
        ALTER TABLE backup_history ADD CONSTRAINT backup_history_status_check
        CHECK (status IN ('pending', 'running', 'success', 'failed', 'completed'));
    END IF;
END $$;

COMMENT ON TABLE backup_history IS 'History of database backup operations';
COMMENT ON COLUMN backup_history.backup_type IS 'Type of backup: daily, weekly, monthly, or manual';
COMMENT ON COLUMN backup_history.file_size IS 'Backup file size in bytes';
COMMENT ON COLUMN backup_history.uploaded IS 'Whether the backup was successfully uploaded to remote server';

CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON backup_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);

CREATE OR REPLACE FUNCTION update_backup_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backup_settings_updated_at ON backup_settings;
CREATE TRIGGER trigger_backup_settings_updated_at
    BEFORE UPDATE ON backup_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_settings_updated_at();
