-- Migration: Add missing metadata columns to resume_adaptations
-- Date: 2026-03-23
-- Description: Adds candidate_name and adapted_title to align existing databases with the canonical schema

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'resume_adaptations'
          AND column_name = 'candidate_name'
    ) THEN
        ALTER TABLE public.resume_adaptations ADD COLUMN candidate_name VARCHAR(255);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'resume_adaptations'
          AND column_name = 'adapted_title'
    ) THEN
        ALTER TABLE public.resume_adaptations ADD COLUMN adapted_title VARCHAR(500);
    END IF;
END $$;
