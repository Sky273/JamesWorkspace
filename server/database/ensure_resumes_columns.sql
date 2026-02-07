-- Ensure all required columns exist in resumes table
-- Execute with: psql -U postgres -d resumeconverter -f database/ensure_resumes_columns.sql

-- Text fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS original_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Original analysis scores (INTEGER)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS global_rating INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ats_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS executive_summary_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS hobbies_languages_score INTEGER;

-- Improved scores (INTEGER) - after LLM improvement
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_global_rating INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_skills_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_experience_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_education_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_ats_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_executive_summary_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_hobbies_languages_score INTEGER;

-- Key improvements (suggestions from LLM)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS key_improvements TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_key_improvements TEXT;

-- Tags (JSONB arrays)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS industries JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS tools JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS soft_skills JSONB;

-- Cleaned tags
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills_cleaned JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS industries_cleaned JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS tools_cleaned JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS soft_skills_cleaned JSONB;

-- ESCO mappings
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills_esco JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS industries_esco JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS tools_esco JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS soft_skills_esco JSONB;

-- Improved tags (after LLM improvement)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_skills JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_industries JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_tools JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_soft_skills JSONB;

-- Other fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_years INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_level VARCHAR(100);
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS certifications JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS languages JSONB;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS trigram VARCHAR(10);

-- Template fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS template_id UUID;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);

-- Dates
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improvement_date TIMESTAMP WITH TIME ZONE;

-- Fix status constraint to accept all required statuses
DO $$
BEGIN
    -- Drop existing constraint if it exists
    ALTER TABLE resumes DROP CONSTRAINT IF EXISTS resumes_status_check;
    
    -- Add new constraint with all statuses
    ALTER TABLE resumes ADD CONSTRAINT resumes_status_check 
        CHECK (status IN ('active', 'inactive', 'archived', 'new', 'pending', 'processing', 'analyzed', 'improved', 'error', 'failed'));
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Could not update status constraint: %', SQLERRM;
END $$;

-- Verify all columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'resumes' 
ORDER BY ordinal_position;
