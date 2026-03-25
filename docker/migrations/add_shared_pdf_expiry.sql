-- Migration: Add expiration timestamp to shared resume links
-- Date: 2026-03-25
-- Description: Adds shared_pdf_expires_at and backfills existing shared links to expire after 7 days

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'resumes'
          AND column_name = 'shared_pdf_expires_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN shared_pdf_expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Column shared_pdf_expires_at added to resumes';
    ELSE
        RAISE NOTICE 'Column shared_pdf_expires_at already exists in resumes';
    END IF;
END $$;

UPDATE public.resumes
SET shared_pdf_expires_at = COALESCE(shared_pdf_expires_at, CURRENT_TIMESTAMP + INTERVAL '7 days')
WHERE shared_pdf_token IS NOT NULL;

