-- Add logo_data and logo_mime_type columns to firms table
-- This stores the logo directly in the database for better persistence

ALTER TABLE firms ADD COLUMN IF NOT EXISTS logo_data BYTEA;
ALTER TABLE firms ADD COLUMN IF NOT EXISTS logo_mime_type VARCHAR(50);

COMMENT ON COLUMN firms.logo_data IS 'Binary data of the firm logo';
COMMENT ON COLUMN firms.logo_mime_type IS 'MIME type of the logo (e.g., image/png, image/jpeg)';
