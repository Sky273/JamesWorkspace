-- Migration: Add webgl_enabled column to llm_settings table
-- Date: 2026-03-22
-- Description: Adds webgl_enabled column to control WebGL background on home page

-- Add webgl_enabled column to llm_settings table
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS webgl_enabled VARCHAR(3) DEFAULT 'on';

-- Add constraint to ensure valid values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_webgl_enabled_check'
          AND conrelid = 'public.llm_settings'::regclass
    ) THEN
        ALTER TABLE llm_settings
        ADD CONSTRAINT llm_settings_webgl_enabled_check
        CHECK ((webgl_enabled)::text = ANY ((ARRAY['on'::character varying, 'off'::character varying])::text[]));
    END IF;
END $$;
