-- Migration: Add GDPR mail tokens table for firm-level Gmail configuration
-- This table stores OAuth tokens for sending GDPR consent emails via Gmail

CREATE TABLE IF NOT EXISTS firm_gdpr_mail_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'gmail',
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_expiry TIMESTAMP WITH TIME ZONE,
    email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(firm_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_firm_gdpr_mail_tokens_firm_id ON firm_gdpr_mail_tokens(firm_id);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_firm_gdpr_mail_tokens_updated_at ON firm_gdpr_mail_tokens;
CREATE TRIGGER update_firm_gdpr_mail_tokens_updated_at
    BEFORE UPDATE ON firm_gdpr_mail_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comment
COMMENT ON TABLE firm_gdpr_mail_tokens IS 'Stores Gmail OAuth tokens for GDPR consent email sending at firm level';
