-- =============================================================================
-- Migration: Create token_blacklist table for persistent token revocation
-- Date: 2026-02-22
-- =============================================================================

-- Token blacklist table
CREATE TABLE IF NOT EXISTS public.token_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token_jti TEXT NOT NULL,
    user_id uuid,
    reason TEXT DEFAULT 'logout',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT token_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT token_blacklist_jti_key UNIQUE (token_jti)
);

-- User blacklist table (for blocking all tokens of a user)
CREATE TABLE IF NOT EXISTS public.user_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    reason TEXT DEFAULT 'account_deactivated',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT user_blacklist_user_id_key UNIQUE (user_id),
    CONSTRAINT user_blacklist_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_blacklist_jti ON public.token_blacklist(token_jti);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON public.token_blacklist(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_blacklist_user_id ON public.user_blacklist(user_id);

-- Comments
COMMENT ON TABLE public.token_blacklist IS 'Blacklisted JWT tokens for immediate revocation';
COMMENT ON TABLE public.user_blacklist IS 'Blacklisted users - all their tokens are invalid';
COMMENT ON COLUMN public.token_blacklist.token_jti IS 'JWT token ID (jti claim)';
COMMENT ON COLUMN public.token_blacklist.expires_at IS 'Token expiration time - used for cleanup';
