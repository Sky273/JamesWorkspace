-- =============================================================================
-- Migration: Create password_reset_tokens table for forgot password flow
-- Date: 2026-03-19
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT password_reset_tokens_hash_key UNIQUE (token_hash),
    CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_hash ON public.password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON public.password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at);

-- Comments
COMMENT ON TABLE public.password_reset_tokens IS 'Password reset tokens for forgot password flow';
COMMENT ON COLUMN public.password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (plain token sent via email)';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Token expiry (1 hour after creation)';
COMMENT ON COLUMN public.password_reset_tokens.used_at IS 'Timestamp when token was used (one-time use)';
