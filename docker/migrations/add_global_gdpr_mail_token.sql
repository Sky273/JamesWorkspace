-- Migration: Add global GDPR mail token table
-- This table stores a SINGLE OAuth token for sending ALL GDPR consent emails
-- The token is global (not per-firm) but templates remain firm-specific

CREATE TABLE IF NOT EXISTS global_gdpr_mail_token (
    id VARCHAR(50) PRIMARY KEY DEFAULT 'global',
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail',
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_global_gdpr_mail_token_updated_at ON global_gdpr_mail_token;
CREATE TRIGGER update_global_gdpr_mail_token_updated_at
    BEFORE UPDATE ON global_gdpr_mail_token
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE global_gdpr_mail_token IS 'Stores a SINGLE global Gmail OAuth token for all GDPR consent emails. Templates are still firm-specific.';

-- Migrate existing data from firm_gdpr_mail_tokens if any exists
-- Take the most recently updated token as the global one
INSERT INTO global_gdpr_mail_token (id, provider, access_token_encrypted, refresh_token_encrypted, token_expiry, email, created_at, updated_at)
SELECT 'global', provider, access_token_encrypted, refresh_token_encrypted, token_expiry, email, created_at, updated_at
FROM firm_gdpr_mail_tokens
ORDER BY updated_at DESC
LIMIT 1
ON CONFLICT (id) DO NOTHING;
