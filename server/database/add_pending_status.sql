-- Add 'pending' status to users table
-- Execute with: psql -U postgres -d resumeconverter -f database/add_pending_status.sql

-- Drop the existing constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;

-- Add new constraint with 'pending' status
ALTER TABLE users 
ADD CONSTRAINT users_status_check 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Verify the constraint
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'users'::regclass 
AND conname = 'users_status_check';
