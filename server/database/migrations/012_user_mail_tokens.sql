-- Migration: Create user_mail_tokens table for OAuth tokens storage
-- Date: 2026-02-12

-- ============================================
-- TABLE: user_mail_tokens
-- Stores encrypted OAuth tokens for email providers (Gmail, Outlook, etc.)
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_mail_tokens (
    id UUID DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail',
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_mail_tokens_provider_check CHECK (provider IN ('gmail', 'outlook')),
    CONSTRAINT user_mail_tokens_unique_user_provider UNIQUE (user_id, provider)
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_mail_tokens_user_id ON public.user_mail_tokens(user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_user_mail_tokens_updated_at ON public.user_mail_tokens;
CREATE TRIGGER update_user_mail_tokens_updated_at
    BEFORE UPDATE ON public.user_mail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_mail_tokens IS 'Encrypted OAuth tokens for email providers (Gmail, Outlook)';
COMMENT ON COLUMN public.user_mail_tokens.access_token_encrypted IS 'AES-256 encrypted access token';
COMMENT ON COLUMN public.user_mail_tokens.refresh_token_encrypted IS 'AES-256 encrypted refresh token';
COMMENT ON COLUMN public.user_mail_tokens.token_expiry IS 'Token expiration timestamp';
COMMENT ON COLUMN public.user_mail_tokens.email IS 'Email address associated with the OAuth account';
