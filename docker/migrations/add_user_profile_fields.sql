-- Migration: Add job_title and phone fields to users table
-- Date: 2026-02-21

-- Add job_title column (function/role of the user)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS job_title VARCHAR(255);

-- Add phone column (phone number)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

-- Add comments
COMMENT ON COLUMN public.users.job_title IS 'Job title or function of the user (e.g., Consultant, Manager)';
COMMENT ON COLUMN public.users.phone IS 'Phone number of the user';
