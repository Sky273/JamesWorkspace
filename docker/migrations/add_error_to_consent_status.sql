-- Migration: Add 'error' to consent_status check constraint
-- This allows tracking when GDPR consent email sending fails

-- Drop the existing constraint
ALTER TABLE public.resumes DROP CONSTRAINT IF EXISTS resumes_consent_status_check;

-- Add the updated constraint with 'error' included
ALTER TABLE public.resumes ADD CONSTRAINT resumes_consent_status_check 
    CHECK (consent_status IN ('not_required', 'pending_consent', 'active', 'refused', 'expired', 'purged', 'error'));

-- Comment
COMMENT ON CONSTRAINT resumes_consent_status_check ON public.resumes IS 'Valid consent statuses: not_required, pending_consent, active, refused, expired, purged, error';
