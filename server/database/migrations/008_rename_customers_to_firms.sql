-- Migration: Rename customers to firms
-- Date: 2026-02-10
-- Description: Rename 'customers' table to 'firms' and update all related columns/references
-- This prepares for future 'customer' concept that will be different from 'firm'
-- This script is idempotent and can be run multiple times safely

BEGIN;

-- ============================================
-- STEP 1: Rename the main table (if not already renamed)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
        ALTER TABLE public.customers RENAME TO firms;
        RAISE NOTICE 'Table customers renamed to firms';
    ELSE
        RAISE NOTICE 'Table customers does not exist (already renamed or never existed)';
    END IF;
END $$;

-- Update table comment (safe to run multiple times)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firms') THEN
        COMMENT ON TABLE public.firms IS 'Firm organizations using the platform (formerly customers)';
    END IF;
END $$;

-- ============================================
-- STEP 2: Rename constraints on firms table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_pkey') THEN
        ALTER TABLE public.firms RENAME CONSTRAINT customers_pkey TO firms_pkey;
        RAISE NOTICE 'Constraint customers_pkey renamed to firms_pkey';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_name_key') THEN
        ALTER TABLE public.firms RENAME CONSTRAINT customers_name_key TO firms_name_key;
        RAISE NOTICE 'Constraint customers_name_key renamed to firms_name_key';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_status_check') THEN
        ALTER TABLE public.firms RENAME CONSTRAINT customers_status_check TO firms_status_check;
        RAISE NOTICE 'Constraint customers_status_check renamed to firms_status_check';
    END IF;
END $$;

-- ============================================
-- STEP 3: Rename indexes on firms table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_name') THEN
        ALTER INDEX idx_customers_name RENAME TO idx_firms_name;
        RAISE NOTICE 'Index idx_customers_name renamed to idx_firms_name';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_customers_status') THEN
        ALTER INDEX idx_customers_status RENAME TO idx_firms_status;
        RAISE NOTICE 'Index idx_customers_status renamed to idx_firms_status';
    END IF;
END $$;

-- ============================================
-- STEP 4: Rename columns in users table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'customer_id') THEN
        ALTER TABLE public.users RENAME COLUMN customer_id TO firm_id;
        RAISE NOTICE 'Column users.customer_id renamed to firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'customer_name') THEN
        ALTER TABLE public.users RENAME COLUMN customer_name TO firm_name;
        RAISE NOTICE 'Column users.customer_name renamed to firm_name';
    END IF;
END $$;

-- ============================================
-- STEP 5: Rename columns in resumes table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'customer_id') THEN
        ALTER TABLE public.resumes RENAME COLUMN customer_id TO firm_id;
        RAISE NOTICE 'Column resumes.customer_id renamed to firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'customer_name') THEN
        ALTER TABLE public.resumes RENAME COLUMN customer_name TO firm_name;
        RAISE NOTICE 'Column resumes.customer_name renamed to firm_name';
    END IF;
END $$;

-- ============================================
-- STEP 6: Rename columns in missions table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'customer_id') THEN
        ALTER TABLE public.missions RENAME COLUMN customer_id TO firm_id;
        RAISE NOTICE 'Column missions.customer_id renamed to firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'customer') THEN
        ALTER TABLE public.missions RENAME COLUMN customer TO firm;
        RAISE NOTICE 'Column missions.customer renamed to firm';
    END IF;
END $$;

-- ============================================
-- STEP 7: Rename columns in resume_adaptations table (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resume_adaptations' AND column_name = 'customer_id') THEN
        ALTER TABLE public.resume_adaptations RENAME COLUMN customer_id TO firm_id;
        RAISE NOTICE 'Column resume_adaptations.customer_id renamed to firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resume_adaptations' AND column_name = 'customer') THEN
        ALTER TABLE public.resume_adaptations RENAME COLUMN customer TO firm;
        RAISE NOTICE 'Column resume_adaptations.customer renamed to firm';
    END IF;
END $$;

-- ============================================
-- STEP 8: Rename indexes referencing customer (if they exist with old names)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_users_customer_id') THEN
        ALTER INDEX idx_users_customer_id RENAME TO idx_users_firm_id;
        RAISE NOTICE 'Index idx_users_customer_id renamed to idx_users_firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_resumes_customer_id') THEN
        ALTER INDEX idx_resumes_customer_id RENAME TO idx_resumes_firm_id;
        RAISE NOTICE 'Index idx_resumes_customer_id renamed to idx_resumes_firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_missions_customer_id') THEN
        ALTER INDEX idx_missions_customer_id RENAME TO idx_missions_firm_id;
        RAISE NOTICE 'Index idx_missions_customer_id renamed to idx_missions_firm_id';
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_adaptations_customer_id') THEN
        ALTER INDEX idx_adaptations_customer_id RENAME TO idx_adaptations_firm_id;
        RAISE NOTICE 'Index idx_adaptations_customer_id renamed to idx_adaptations_firm_id';
    END IF;
END $$;

-- ============================================
-- STEP 9: Drop and recreate views with new column names
-- ============================================

-- Drop existing views (safe - IF EXISTS)
DROP VIEW IF EXISTS public.v_active_resumes;
DROP VIEW IF EXISTS public.v_active_missions;
DROP VIEW IF EXISTS public.v_adaptations_full;

-- Recreate v_active_resumes view (only if firms table exists and has firm_id column in resumes)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firms')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'firm_id') THEN
        
        EXECUTE '
        CREATE OR REPLACE VIEW public.v_active_resumes AS
        SELECT r.id,
            r.name,
            r.title,
            r.file_name,
            r.resume_file_url,
            r.resume_file_size,
            r.resume_file_type,
            r.status,
            r.firm_id,
            r.firm_name,
            r.skills,
            r.industries,
            r.tools,
            r.soft_skills,
            r.skills_cleaned,
            r.industries_cleaned,
            r.tools_cleaned,
            r.soft_skills_cleaned,
            r.skills_esco,
            r.industries_esco,
            r.tools_esco,
            r.soft_skills_esco,
            r.key_improvements,
            r.summary,
            r.experience_years,
            r.education_level,
            r.certifications,
            r.languages,
            r.created_at,
            r.updated_at,
            r.analyzed_at,
            f.name AS firm_full_name,
            f.status AS firm_status
        FROM public.resumes r
            LEFT JOIN public.firms f ON r.firm_id = f.id
        WHERE r.status = ''active''';
        
        RAISE NOTICE 'View v_active_resumes recreated with firm columns';
    END IF;
END $$;

-- Recreate v_active_missions view
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firms')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'firm_id') THEN
        
        EXECUTE '
        CREATE OR REPLACE VIEW public.v_active_missions AS
        SELECT m.id,
            m.title,
            m.content,
            m.firm_id,
            m.firm,
            m.status,
            m.keywords,
            m.required_skills,
            m.preferred_skills,
            m.created_at,
            m.updated_at,
            f.name AS firm_full_name,
            f.status AS firm_status
        FROM public.missions m
            LEFT JOIN public.firms f ON m.firm_id = f.id
        WHERE m.status = ''active''';
        
        RAISE NOTICE 'View v_active_missions recreated with firm columns';
    END IF;
END $$;

-- Recreate v_adaptations_full view
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'firms')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resume_adaptations' AND column_name = 'firm_id') THEN
        
        EXECUTE '
        CREATE OR REPLACE VIEW public.v_adaptations_full AS
        SELECT ra.id,
            ra.resume_id,
            ra.mission_id,
            ra.resume_name,
            ra.mission_title,
            ra.firm_id,
            ra.firm,
            ra.adapted_text,
            ra.adaptation_notes,
            ra.match_score,
            ra.status,
            ra.created_at,
            ra.updated_at,
            r.name AS resume_full_name,
            r.title AS resume_title,
            m.title AS mission_full_title,
            m.content AS mission_content,
            f.name AS firm_full_name
        FROM public.resume_adaptations ra
            LEFT JOIN public.resumes r ON ra.resume_id = r.id
            LEFT JOIN public.missions m ON ra.mission_id = m.id
            LEFT JOIN public.firms f ON ra.firm_id = f.id';
        
        RAISE NOTICE 'View v_adaptations_full recreated with firm columns';
    END IF;
END $$;

-- ============================================
-- STEP 10: Update foreign key constraints (if they exist)
-- ============================================
DO $$
BEGIN
    -- Drop old FK constraints if they exist
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_customer_id_fkey') THEN
        ALTER TABLE public.users DROP CONSTRAINT users_customer_id_fkey;
        RAISE NOTICE 'Dropped constraint users_customer_id_fkey';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resumes_customer_id_fkey') THEN
        ALTER TABLE public.resumes DROP CONSTRAINT resumes_customer_id_fkey;
        RAISE NOTICE 'Dropped constraint resumes_customer_id_fkey';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'missions_customer_id_fkey') THEN
        ALTER TABLE public.missions DROP CONSTRAINT missions_customer_id_fkey;
        RAISE NOTICE 'Dropped constraint missions_customer_id_fkey';
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resume_adaptations_customer_id_fkey') THEN
        ALTER TABLE public.resume_adaptations DROP CONSTRAINT resume_adaptations_customer_id_fkey;
        RAISE NOTICE 'Dropped constraint resume_adaptations_customer_id_fkey';
    END IF;
END $$;

-- Add new FK constraints (only if they don't already exist)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_firm_id_fkey') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'firm_id') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added constraint users_firm_id_fkey';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add users_firm_id_fkey: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resumes_firm_id_fkey') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name = 'firm_id') THEN
        ALTER TABLE public.resumes ADD CONSTRAINT resumes_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added constraint resumes_firm_id_fkey';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add resumes_firm_id_fkey: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'missions_firm_id_fkey') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'missions' AND column_name = 'firm_id') THEN
        ALTER TABLE public.missions ADD CONSTRAINT missions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added constraint missions_firm_id_fkey';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add missions_firm_id_fkey: %', SQLERRM;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resume_adaptations_firm_id_fkey') 
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resume_adaptations' AND column_name = 'firm_id') THEN
        ALTER TABLE public.resume_adaptations ADD CONSTRAINT resume_adaptations_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added constraint resume_adaptations_firm_id_fkey';
    END IF;
EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not add resume_adaptations_firm_id_fkey: %', SQLERRM;
END $$;

-- ============================================
-- STEP 11: Commit transaction
-- ============================================
COMMIT;

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 008 completed successfully!';
    RAISE NOTICE 'customers table renamed to firms';
    RAISE NOTICE '========================================';
END $$;

-- ============================================
-- VERIFICATION QUERIES (run after migration to verify)
-- ============================================
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('firms', 'customers');
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name LIKE '%firm%';
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'resumes' AND column_name LIKE '%firm%';
-- SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'missions' AND column_name LIKE '%firm%';
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%firm%';
