-- Migration: Add webgl_enabled column to llm_settings table
-- Date: 2026-03-22
-- Description: Adds webgl_enabled column to control WebGL background on home page

-- Add webgl_enabled column to llm_settings table
ALTER TABLE llm_settings ADD COLUMN IF NOT EXISTS webgl_enabled VARCHAR(3) DEFAULT 'on';

-- Add constraint to ensure valid values
ALTER TABLE llm_settings ADD CONSTRAINT IF NOT EXISTS llm_settings_webgl_enabled_check 
    CHECK ((webgl_enabled)::text = ANY ((ARRAY['on'::character varying, 'off'::character varying])::text[]));
