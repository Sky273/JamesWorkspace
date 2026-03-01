-- Migration: Add 2FA (TOTP) columns to users table
-- Implements Time-based One-Time Password authentication

-- Add 2FA columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_secret TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_backup_codes TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_pending_backup_codes TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster 2FA lookups
CREATE INDEX IF NOT EXISTS idx_users_totp_enabled ON public.users(totp_enabled) WHERE totp_enabled = TRUE;

-- Comment
COMMENT ON COLUMN public.users.totp_enabled IS 'Whether 2FA is enabled for this user';
COMMENT ON COLUMN public.users.totp_secret IS 'Encrypted TOTP secret key';
COMMENT ON COLUMN public.users.totp_backup_codes IS 'Encrypted JSON array of backup codes';
COMMENT ON COLUMN public.users.totp_pending_secret IS 'Temporary secret during 2FA setup (before verification)';
COMMENT ON COLUMN public.users.totp_pending_backup_codes IS 'Temporary backup codes during 2FA setup';
COMMENT ON COLUMN public.users.totp_enabled_at IS 'Timestamp when 2FA was enabled';
