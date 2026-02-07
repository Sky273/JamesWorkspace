-- Add improved_key_improvements column to resumes table
-- Execute with: psql -U postgres -d resumeconverter -f database/add_improved_key_improvements.sql

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_key_improvements TEXT;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'resumes' 
AND column_name = 'improved_key_improvements';
