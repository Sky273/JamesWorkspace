-- Fix resumes status constraint to accept all required statuses
-- Execute with: psql -U postgres -d resumeconverter -f database/fix_resumes_status_constraint.sql

-- Drop the existing constraint
ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_status_check;

-- Add new constraint with all required statuses
ALTER TABLE resumes 
ADD CONSTRAINT resumes_status_check 
CHECK (status IN ('active', 'inactive', 'archived', 'pending', 'processing', 'analyzed', 'improved', 'error'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'resumes'::regclass 
AND conname = 'resumes_status_check';
