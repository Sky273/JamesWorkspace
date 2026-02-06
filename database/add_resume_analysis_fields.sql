-- Add missing analysis fields to resumes table (based on Airtable Resumes table)
-- Execute with: psql -U postgres -d resumeconverter -f database/add_resume_analysis_fields.sql

-- Add text fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS original_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_text TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS original_name VARCHAR(255);

-- Add score fields (original analysis)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS global_rating INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS skills_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS experience_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS education_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS ats_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS executive_summary_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS hobbies_languages_score INTEGER;

-- Add improved scores (after improvement)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_global_rating INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_skills_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_experience_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_education_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_ats_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_executive_summary_score INTEGER;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improved_hobbies_languages_score INTEGER;

-- Add template and formatting fields
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id) ON DELETE SET NULL;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);

-- Add improvement suggestions and analysis details
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improvement_suggestions TEXT;
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS analysis_details JSONB;

-- Add dates
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS improvement_date TIMESTAMP WITH TIME ZONE;

-- Add trigram for anonymous mode
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS trigram VARCHAR(10);

-- Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'resumes' 
AND column_name IN (
    'original_text', 'improved_text', 'original_name',
    'global_rating', 'skills_score', 'experience_score', 
    'education_score', 'ats_score', 'executive_summary_score', 
    'hobbies_languages_score'
)
ORDER BY column_name;
