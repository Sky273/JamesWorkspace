-- Migration: Add tls_mode column to backup_settings
-- Date: 2026-03-08
-- Description: Add TLS mode option for FTP connections (none, explicit, implicit)

-- Add tls_mode column (without CHECK constraint first for compatibility)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'backup_settings' AND column_name = 'tls_mode'
    ) THEN
        ALTER TABLE backup_settings ADD COLUMN tls_mode VARCHAR(10) DEFAULT 'explicit';
    END IF;
END $$;

-- Add CHECK constraint separately
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'backup_settings' AND constraint_name = 'backup_settings_tls_mode_check'
    ) THEN
        ALTER TABLE backup_settings ADD CONSTRAINT backup_settings_tls_mode_check 
        CHECK (tls_mode IN ('none', 'explicit', 'implicit'));
    END IF;
EXCEPTION WHEN duplicate_object THEN
    -- Constraint already exists, ignore
    NULL;
END $$;

COMMENT ON COLUMN backup_settings.tls_mode IS 'TLS mode for FTP: none (plain), explicit (AUTH TLS), implicit (port 990)';
