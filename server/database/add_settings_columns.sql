-- Add missing columns to llm_settings for application settings
-- Execute with: psql -U postgres -d resumeconverter -f database/add_settings_columns.sql

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS cv_mode VARCHAR(50) DEFAULT 'nominative' CHECK (cv_mode IN ('nominative', 'anonymous'));

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS chatbot_enabled VARCHAR(10) DEFAULT 'on' CHECK (chatbot_enabled IN ('on', 'off'));

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS match_analysis_prompt TEXT;

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS adaptation_prompt TEXT;

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS executive_summary_weight INTEGER DEFAULT 20 CHECK (executive_summary_weight >= 0 AND executive_summary_weight <= 100);

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS skills_weight INTEGER DEFAULT 20 CHECK (skills_weight >= 0 AND skills_weight <= 100);

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS experience_weight INTEGER DEFAULT 20 CHECK (experience_weight >= 0 AND experience_weight <= 100);

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS education_weight INTEGER DEFAULT 15 CHECK (education_weight >= 0 AND education_weight <= 100);

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS ats_weight INTEGER DEFAULT 15 CHECK (ats_weight >= 0 AND ats_weight <= 100);

ALTER TABLE llm_settings 
ADD COLUMN IF NOT EXISTS hobbies_languages_weight INTEGER DEFAULT 10 CHECK (hobbies_languages_weight >= 0 AND hobbies_languages_weight <= 100);

-- Verify columns
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'llm_settings' 
ORDER BY ordinal_position;
