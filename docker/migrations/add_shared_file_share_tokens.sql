-- Migration: Add separate original-file share tokens
-- Date: 2026-03-25
-- Description: Adds independent token and expiry fields for original file sharing

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'resumes'
          AND column_name = 'shared_file_token'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN shared_file_token VARCHAR(64);
        RAISE NOTICE 'Column shared_file_token added to resumes';
    ELSE
        RAISE NOTICE 'Column shared_file_token already exists in resumes';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'resumes'
          AND column_name = 'shared_file_expires_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN shared_file_expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Column shared_file_expires_at added to resumes';
    ELSE
        RAISE NOTICE 'Column shared_file_expires_at already exists in resumes';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_resumes_shared_file_token
    ON public.resumes(shared_file_token)
    WHERE shared_file_token IS NOT NULL;
