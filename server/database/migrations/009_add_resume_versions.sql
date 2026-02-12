-- Migration: Add resume versions table for CV versioning system
-- Date: 2026-02-12
-- Description: Creates a table to store historical versions of improved CV text

-- ============================================
-- ENSURE UUID EXTENSION IS AVAILABLE
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CREATE RESUME VERSIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS resume_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resume_id UUID NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    improved_text TEXT NOT NULL,
    
    -- Scores at the time of this version
    improved_global_rating INTEGER,
    improved_skills_score INTEGER,
    improved_experience_score INTEGER,
    improved_education_score INTEGER,
    improved_ats_score INTEGER,
    improved_executive_summary_score INTEGER,
    improved_hobbies_languages_score INTEGER,
    
    -- Improved tags at the time of this version
    improved_skills JSONB,
    improved_industries JSONB,
    improved_tools JSONB,
    improved_soft_skills JSONB,
    improved_key_improvements TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    change_reason VARCHAR(255), -- 'initial_improvement', 'manual_edit', 'restore'
    
    -- Ensure unique version numbers per resume
    CONSTRAINT unique_resume_version UNIQUE(resume_id, version_number)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_resume_versions_resume_id ON resume_versions(resume_id);
CREATE INDEX IF NOT EXISTS idx_resume_versions_created_at ON resume_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_versions_version_number ON resume_versions(resume_id, version_number DESC);

-- ============================================
-- ADD CURRENT VERSION COLUMN TO RESUMES
-- ============================================

ALTER TABLE resumes ADD COLUMN IF NOT EXISTS current_version INTEGER DEFAULT 0;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE resume_versions IS 'Historical versions of improved CV text with associated scores and tags';
COMMENT ON COLUMN resume_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN resume_versions.change_reason IS 'Reason for version creation: initial_improvement, manual_edit, restore';
COMMENT ON COLUMN resumes.current_version IS 'Current version number of the improved text (0 if no improved version exists)';
