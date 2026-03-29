-- Migration: Add llm_availability_state column to llm_settings
-- Date: 2026-03-29
-- Description: Persists provider/model runtime availability state across restarts

ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS llm_availability_state jsonb DEFAULT '{}'::jsonb;
