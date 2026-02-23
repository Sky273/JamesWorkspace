-- Migration: Add GDPR consent columns to resumes table
-- Date: 2026-02-23
-- Description: Adds consent management fields for GDPR compliance

-- ============================================
-- 1. Add profile type column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'profile_type'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN profile_type VARCHAR(20) DEFAULT 'external';
        ALTER TABLE public.resumes ADD CONSTRAINT resumes_profile_type_check 
            CHECK (profile_type IN ('employee', 'external'));
        RAISE NOTICE 'Column profile_type added to resumes';
    ELSE
        RAISE NOTICE 'Column profile_type already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 2. Add candidate name column (real name, distinct from potentially anonymized 'name')
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'candidate_name'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN candidate_name VARCHAR(255);
        RAISE NOTICE 'Column candidate_name added to resumes';
    ELSE
        RAISE NOTICE 'Column candidate_name already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 3. Add candidate email column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'candidate_email'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN candidate_email VARCHAR(255);
        RAISE NOTICE 'Column candidate_email added to resumes';
    ELSE
        RAISE NOTICE 'Column candidate_email already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 4. Add consent status column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_status'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_status VARCHAR(20) DEFAULT 'pending_consent';
        ALTER TABLE public.resumes ADD CONSTRAINT resumes_consent_status_check 
            CHECK (consent_status IN ('not_required', 'pending_consent', 'active', 'refused', 'expired', 'purged'));
        RAISE NOTICE 'Column consent_status added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_status already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 5. Add consent date columns
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_requested_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_requested_at TIMESTAMPTZ;
        RAISE NOTICE 'Column consent_requested_at added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_requested_at already exists in resumes';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_responded_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_responded_at TIMESTAMPTZ;
        RAISE NOTICE 'Column consent_responded_at added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_responded_at already exists in resumes';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'retention_until'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN retention_until TIMESTAMPTZ;
        RAISE NOTICE 'Column retention_until added to resumes';
    ELSE
        RAISE NOTICE 'Column retention_until already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 6. Add consent token columns
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_token'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_token VARCHAR(64);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_resumes_consent_token ON public.resumes(consent_token) WHERE consent_token IS NOT NULL;
        RAISE NOTICE 'Column consent_token added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_token already exists in resumes';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_token_expires_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_token_expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Column consent_token_expires_at added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_token_expires_at already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 7. Add reminder tracking columns
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_reminder_sent_at'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_reminder_sent_at TIMESTAMPTZ;
        RAISE NOTICE 'Column consent_reminder_sent_at added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_reminder_sent_at already exists in resumes';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resumes' 
        AND column_name = 'consent_reminder_count'
    ) THEN
        ALTER TABLE public.resumes ADD COLUMN consent_reminder_count INTEGER DEFAULT 0;
        RAISE NOTICE 'Column consent_reminder_count added to resumes';
    ELSE
        RAISE NOTICE 'Column consent_reminder_count already exists in resumes';
    END IF;
END $$;

-- ============================================
-- 8. Create indexes for consent queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_resumes_consent_status ON public.resumes(consent_status);
CREATE INDEX IF NOT EXISTS idx_resumes_profile_type ON public.resumes(profile_type);
CREATE INDEX IF NOT EXISTS idx_resumes_retention_until ON public.resumes(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resumes_consent_requested_at ON public.resumes(consent_requested_at) WHERE consent_requested_at IS NOT NULL;

-- ============================================
-- 9. Update existing resumes to have default consent status
-- ============================================
-- Set existing resumes to 'not_required' (grandfathered in) or leave as pending
-- This is a one-time migration - new resumes will have proper consent flow
UPDATE public.resumes 
SET consent_status = 'not_required', 
    profile_type = 'external'
WHERE consent_status IS NULL;

RAISE NOTICE 'GDPR consent columns migration completed successfully';
