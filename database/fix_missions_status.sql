-- Fix missions status - remove constraint and change to TEXT
-- Execute with: psql -U postgres -d resumeconverter -f database/fix_missions_status.sql

-- Drop existing constraint
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_status_check;

-- Change column type to TEXT (more flexible)
ALTER TABLE missions ALTER COLUMN status TYPE TEXT;

-- Set default value
ALTER TABLE missions ALTER COLUMN status SET DEFAULT 'active';

-- Verify the change
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'missions' AND column_name = 'status';
