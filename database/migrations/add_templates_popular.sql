-- Migration: Add 'popular' column to templates table
-- Date: 2026-02-05
-- Description: Adds the 'popular' boolean field to mark templates as popular/featured

-- Add the column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'templates' AND column_name = 'popular'
    ) THEN
        ALTER TABLE templates ADD COLUMN popular BOOLEAN DEFAULT false;
        RAISE NOTICE 'Column "popular" added to templates table';
    ELSE
        RAISE NOTICE 'Column "popular" already exists in templates table';
    END IF;
END $$;

-- Create index if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_templates_popular ON templates(popular);

-- Verify the column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'templates' AND column_name = 'popular';
