-- Add logo_url column to firms table
-- This allows each firm to have a custom logo for email templates

ALTER TABLE firms ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN firms.logo_url IS 'URL of the firm logo for email templates';
