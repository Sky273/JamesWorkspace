-- ============================================
-- Recreate llm_settings table with correct structure
-- Based on Airtable LLMSettings table
-- Execute with: psql -U postgres -d resumeconverter -f database/recreate_llm_settings.sql
-- ============================================

-- Drop existing table
DROP TABLE IF EXISTS llm_settings CASCADE;

-- Create llm_settings table with complete structure
CREATE TABLE llm_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Basic info
    name VARCHAR(255) NOT NULL UNIQUE,
    llm_model VARCHAR(100),
    
    -- Prompts (long text fields)
    analysis_prompt TEXT,
    improvement_prompt TEXT,
    match_analysis_prompt TEXT,
    adaptation_prompt TEXT,
    
    -- Application settings
    cv_mode VARCHAR(50) DEFAULT 'nominative' CHECK (cv_mode IN ('nominative', 'anonymous')),
    chatbot_enabled VARCHAR(10) DEFAULT 'on' CHECK (chatbot_enabled IN ('on', 'off')),
    
    -- Weights for scoring (0-100)
    executive_summary_weight INTEGER DEFAULT 20 CHECK (executive_summary_weight >= 0 AND executive_summary_weight <= 100),
    skills_weight INTEGER DEFAULT 20 CHECK (skills_weight >= 0 AND skills_weight <= 100),
    experience_weight INTEGER DEFAULT 20 CHECK (experience_weight >= 0 AND experience_weight <= 100),
    education_weight INTEGER DEFAULT 15 CHECK (education_weight >= 0 AND education_weight <= 100),
    ats_weight INTEGER DEFAULT 15 CHECK (ats_weight >= 0 AND ats_weight <= 100),
    hobbies_languages_weight INTEGER DEFAULT 10 CHECK (hobbies_languages_weight >= 0 AND hobbies_languages_weight <= 100),
    
    -- Metadata
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_llm_settings_name ON llm_settings(name);
CREATE INDEX idx_llm_settings_status ON llm_settings(status);
CREATE INDEX idx_llm_settings_cv_mode ON llm_settings(cv_mode);

-- Create trigger for updated_at
CREATE TRIGGER update_llm_settings_updated_at 
    BEFORE UPDATE ON llm_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings (optional)
INSERT INTO llm_settings (
    name,
    llm_model,
    cv_mode,
    chatbot_enabled,
    executive_summary_weight,
    skills_weight,
    experience_weight,
    education_weight,
    ats_weight,
    hobbies_languages_weight,
    status
) VALUES (
    'Default Settings',
    'gpt-4',
    'nominative',
    'on',
    20,
    20,
    20,
    15,
    15,
    10,
    'active'
) ON CONFLICT (name) DO NOTHING;

-- Verify structure
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'llm_settings' 
ORDER BY ordinal_position;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON llm_settings TO resume_user;
