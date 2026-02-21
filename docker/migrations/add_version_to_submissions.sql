-- Migration: Add version_number to resume_submissions table
-- Date: 2026-02-21
-- Description: Stores the CV version number when a resume is sent to a client

-- Add version_number column to resume_submissions if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'resume_submissions' 
        AND column_name = 'version_number'
    ) THEN
        ALTER TABLE public.resume_submissions ADD COLUMN version_number integer;
        RAISE NOTICE 'Column version_number added to resume_submissions';
    ELSE
        RAISE NOTICE 'Column version_number already exists in resume_submissions';
    END IF;
END $$;

-- Update the view to include version_number
DROP VIEW IF EXISTS public.v_resume_submissions_full;

CREATE VIEW public.v_resume_submissions_full AS
SELECT rs.id,
    rs.resume_id,
    rs.client_id,
    rs.contact_id,
    rs.mission_id,
    rs.firm_id,
    rs.sent_at,
    rs.sent_by,
    rs.notes,
    rs.status,
    rs.version_number,
    rs.created_at,
    r.name AS resume_name,
    r.title AS resume_title,
    c.name AS client_name,
    c.type AS client_type,
    cc.name AS contact_name,
    cc.email AS contact_email,
    m.title AS mission_title,
    u.name AS sent_by_name,
    f.name AS firm_name
FROM public.resume_submissions rs
LEFT JOIN public.resumes r ON rs.resume_id = r.id
LEFT JOIN public.clients c ON rs.client_id = c.id
LEFT JOIN public.client_contacts cc ON rs.contact_id = cc.id
LEFT JOIN public.missions m ON rs.mission_id = m.id
LEFT JOIN public.users u ON rs.sent_by = u.id
LEFT JOIN public.firms f ON rs.firm_id = f.id;

COMMENT ON VIEW public.v_resume_submissions_full IS 'Full view of resume submissions with related entity names and version number';
