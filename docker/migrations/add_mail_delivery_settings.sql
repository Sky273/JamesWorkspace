-- Migration: Add mail delivery settings to llm_settings
-- Date: 2026-04-21
-- Description: Adds persisted GDPR/application mail delivery configuration fields

ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS mail_delivery_provider VARCHAR(20);
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255);
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_port INTEGER;
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN;
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(255);
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_password_encrypted TEXT;
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_from_name VARCHAR(255);
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS smtp_from_email VARCHAR(255);
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS google_gdpr_redirect_uri VARCHAR(500);
