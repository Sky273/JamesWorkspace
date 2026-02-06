-- Fix resume_adaptations status constraint
-- Execute with: psql -U postgres -d resumeconverter -f database/fix_adaptations_status_constraint.sql

-- Drop existing constraint
ALTER TABLE resume_adaptations DROP CONSTRAINT IF EXISTS resume_adaptations_status_check;

-- Add new constraint with all required statuses
ALTER TABLE resume_adaptations 
ADD CONSTRAINT resume_adaptations_status_check 
CHECK (status IN ('draft', 'processing', 'completed', 'final', 'sent', 'archived', 'failed'));

-- Update existing 'draft' records to 'completed' if they have adapted_text
UPDATE resume_adaptations 
SET status = 'completed' 
WHERE status = 'draft' AND adapted_text IS NOT NULL AND adapted_text != '';

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'resume_adaptations'::regclass 
AND conname = 'resume_adaptations_status_check';

-- Show current status distribution
SELECT status, COUNT(*) as count 
FROM resume_adaptations 
GROUP BY status 
ORDER BY count DESC;
