-- Migration: Add match_analysis and mission_content to resume_adaptations
-- Date: 2026-02-05

-- Add match_analysis column (JSONB for storing the full analysis object)
ALTER TABLE resume_adaptations 
ADD COLUMN IF NOT EXISTS match_analysis JSONB;

-- Add mission_content column (TEXT for storing the mission description)
ALTER TABLE resume_adaptations 
ADD COLUMN IF NOT EXISTS mission_content TEXT;

-- Add comment
COMMENT ON COLUMN resume_adaptations.match_analysis IS 'JSON object containing match analysis (strengths, gaps, keywords, recommendations)';
COMMENT ON COLUMN resume_adaptations.mission_content IS 'Cached mission content at time of adaptation';
