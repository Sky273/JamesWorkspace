-- =============================================================================
-- Migration: Add Google OAuth columns for MFA/SSO to users table
-- Date: 2026-02-22
-- =============================================================================

-- Add Google ID column (unique identifier from Google)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_id TEXT;

-- Add Google email (may differ from account email)
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_email TEXT;

-- Add Google link timestamp
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS google_linked_at TIMESTAMP WITH TIME ZONE;

-- Comment on new columns
COMMENT ON COLUMN public.users.google_id IS 'Google account ID for OAuth authentication';
COMMENT ON COLUMN public.users.google_email IS 'Email from Google account (may differ from login email)';
COMMENT ON COLUMN public.users.google_linked_at IS 'Timestamp when Google account was linked';

-- Index for faster lookup by Google ID
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON public.users(google_id) WHERE google_id IS NOT NULL;
