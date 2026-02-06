-- ============================================
-- ResumeConverter PostgreSQL Database Schema
-- Migration from Airtable to PostgreSQL
-- ============================================

-- NOTE: Create the database manually before running this script:
-- CREATE DATABASE resumeconverter WITH ENCODING = 'UTF8';
-- Then connect to it and run this script.

-- Alternatively, if running with superuser privileges:
-- DROP DATABASE IF EXISTS resumeconverter;
-- CREATE DATABASE resumeconverter WITH ENCODING = 'UTF8' LC_COLLATE = 'en_US.UTF-8' LC_CTYPE = 'en_US.UTF-8' TEMPLATE = template0;
-- Then connect: psql -U postgres -d resumeconverter -f init_postgresql.sql

-- Enable UUID extension for generating unique IDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_trgm for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- DROP EXISTING OBJECTS (for idempotent script)
-- ============================================

-- Drop views first (depend on tables)
DROP VIEW IF EXISTS v_adaptations_full CASCADE;
DROP VIEW IF EXISTS v_active_missions CASCADE;
DROP VIEW IF EXISTS v_active_resumes CASCADE;

-- Drop triggers (depend on function)
DROP TRIGGER IF EXISTS update_market_trends_updated_at ON market_trends;
DROP TRIGGER IF EXISTS update_market_facts_updated_at ON market_facts;
DROP TRIGGER IF EXISTS update_rome_metiers_updated_at ON rome_metiers;
DROP TRIGGER IF EXISTS update_resume_adaptations_updated_at ON resume_adaptations;
DROP TRIGGER IF EXISTS update_missions_updated_at ON missions;
DROP TRIGGER IF EXISTS update_resumes_updated_at ON resumes;
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
DROP TRIGGER IF EXISTS update_llm_settings_updated_at ON llm_settings;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;

-- Drop function
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop tables in reverse order of dependencies (child tables first)
DROP TABLE IF EXISTS resume_adaptations CASCADE;
DROP TABLE IF EXISTS market_trends CASCADE;
DROP TABLE IF EXISTS market_facts CASCADE;
DROP TABLE IF EXISTS industry_aliases CASCADE;
DROP TABLE IF EXISTS rome_metiers CASCADE;
DROP TABLE IF EXISTS missions CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS templates CASCADE;
DROP TABLE IF EXISTS llm_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- ============================================
-- TABLE: customers
-- Stores customer/organization information
-- ============================================
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_name ON customers(name);
CREATE INDEX idx_customers_status ON customers(status);

-- ============================================
-- TABLE: users
-- Stores user accounts with authentication
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255), -- Denormalized for quick access
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_customer_id ON users(customer_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);

-- ============================================
-- TABLE: llm_settings
-- Stores LLM configuration and prompts
-- ============================================
CREATE TABLE llm_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic')),
    model VARCHAR(100) NOT NULL,
    temperature DECIMAL(3,2) DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
    max_tokens INTEGER DEFAULT 4000,
    system_prompt TEXT,
    user_prompt_template TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    use_case VARCHAR(100), -- 'analysis', 'improvement', 'adaptation', etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_settings_name ON llm_settings(name);
CREATE INDEX idx_llm_settings_use_case ON llm_settings(use_case);
CREATE INDEX idx_llm_settings_status ON llm_settings(status);

-- ============================================
-- TABLE: templates
-- Stores resume templates with HTML/CSS
-- ============================================
CREATE TABLE templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    popular BOOLEAN DEFAULT false,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    tags TEXT[], -- Array of tags
    preview_image_url TEXT,
    header_content TEXT,
    template_content TEXT NOT NULL,
    footer_content TEXT,
    footer_height INTEGER DEFAULT 25,
    stylesheet TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_popular ON templates(popular);
CREATE INDEX idx_templates_tags ON templates USING GIN(tags);

-- ============================================
-- TABLE: resumes
-- Stores resume documents and analysis data
-- ============================================
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    file_name VARCHAR(255),
    resume_file_url TEXT,
    resume_file_size INTEGER,
    resume_file_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived', 'new', 'pending', 'processing', 'analyzed', 'improved', 'error', 'failed')),
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer_name VARCHAR(255), -- Denormalized
    
    -- Analysis data (JSON fields)
    skills JSONB,
    industries JSONB,
    tools JSONB,
    soft_skills JSONB,
    
    -- Cleaned tags (after LLM processing)
    skills_cleaned JSONB,
    industries_cleaned JSONB,
    tools_cleaned JSONB,
    soft_skills_cleaned JSONB,
    
    -- ESCO mappings
    skills_esco JSONB,
    industries_esco JSONB,
    tools_esco JSONB,
    soft_skills_esco JSONB,
    
    -- Analysis fields
    key_improvements TEXT,
    summary TEXT,
    experience_years INTEGER,
    education_level VARCHAR(100),
    certifications JSONB,
    languages JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    analyzed_at TIMESTAMP WITH TIME ZONE,
    
    -- Original and improved text content
    original_text TEXT,
    improved_text TEXT,
    original_name VARCHAR(255),
    
    -- Analysis scores
    global_rating INTEGER,
    skills_score INTEGER,
    experience_score INTEGER,
    education_score INTEGER,
    ats_score INTEGER,
    executive_summary_score INTEGER,
    hobbies_languages_score INTEGER,
    
    -- Improved scores
    improved_global_rating INTEGER,
    improved_skills_score INTEGER,
    improved_experience_score INTEGER,
    improved_education_score INTEGER,
    improved_ats_score INTEGER,
    improved_executive_summary_score INTEGER,
    improved_hobbies_languages_score INTEGER,
    
    -- Template reference
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    template_name VARCHAR(255),
    
    -- Improvement details
    improvement_suggestions TEXT,
    analysis_details JSONB,
    improvement_date TIMESTAMP WITH TIME ZONE,
    trigram VARCHAR(10),
    improved_key_improvements TEXT,
    
    -- Improved tags
    improved_skills JSONB,
    improved_industries JSONB,
    improved_tools JSONB,
    improved_soft_skills JSONB,
    
    -- Binary file storage
    resume_file_data BYTEA
);

COMMENT ON TABLE resumes IS 'Resume documents with analysis and extracted data';

CREATE INDEX idx_resumes_name ON resumes(name);
CREATE INDEX idx_resumes_customer_id ON resumes(customer_id);
CREATE INDEX idx_resumes_status ON resumes(status);
CREATE INDEX idx_resumes_title ON resumes(title);
CREATE INDEX idx_resumes_created_at ON resumes(created_at DESC);
CREATE INDEX idx_resumes_skills ON resumes USING GIN(skills);
CREATE INDEX idx_resumes_industries ON resumes USING GIN(industries);

-- ============================================
-- TABLE: missions (job offers)
-- Stores job missions/offers
-- ============================================
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer VARCHAR(255), -- Denormalized
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'closed')),
    
    -- Extracted keywords for matching
    keywords JSONB,
    required_skills JSONB,
    preferred_skills JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_missions_title ON missions(title);
CREATE INDEX idx_missions_customer_id ON missions(customer_id);
CREATE INDEX idx_missions_status ON missions(status);
CREATE INDEX idx_missions_created_at ON missions(created_at DESC);
CREATE INDEX idx_missions_keywords ON missions USING GIN(keywords);

-- ============================================
-- TABLE: resume_adaptations
-- Stores adapted resumes for specific missions
-- ============================================
CREATE TABLE resume_adaptations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resume_id UUID REFERENCES resumes(id) ON DELETE CASCADE,
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    
    -- Linked data (denormalized for performance)
    resume_name VARCHAR(255),
    mission_title VARCHAR(500),
    mission_content TEXT,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    customer VARCHAR(255),
    
    -- Adaptation content
    adapted_text TEXT NOT NULL,
    adaptation_notes TEXT,
    match_score DECIMAL(5,2), -- 0-100
    match_analysis JSONB, -- Full match analysis object
    
    -- Status
    status VARCHAR(50) DEFAULT 'completed' CHECK (status IN ('draft', 'processing', 'completed', 'final', 'sent', 'archived', 'failed')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_adaptations_resume_id ON resume_adaptations(resume_id);
CREATE INDEX idx_adaptations_mission_id ON resume_adaptations(mission_id);
CREATE INDEX idx_adaptations_customer_id ON resume_adaptations(customer_id);
CREATE INDEX idx_adaptations_status ON resume_adaptations(status);
CREATE INDEX idx_adaptations_created_at ON resume_adaptations(created_at DESC);

-- ============================================
-- TABLE: rome_metiers
-- Stores ROME 4.0 job classifications
-- ============================================
CREATE TABLE rome_metiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code_rome VARCHAR(10) NOT NULL UNIQUE,
    libelle VARCHAR(500) NOT NULL,
    obsolete BOOLEAN DEFAULT FALSE,
    code_ogr VARCHAR(10),
    libelle_ogr VARCHAR(500),
    code_domaine_professionnel VARCHAR(10),
    libelle_domaine_professionnel VARCHAR(500),
    code_grand_domaine VARCHAR(10),
    libelle_grand_domaine VARCHAR(500),
    
    -- Competences and skills (JSONB for flexibility)
    competences JSONB,
    enjeux JSONB,
    macro_savoir_faire JSONB,
    savoirs JSONB,
    savoir_faire JSONB,
    savoir_etre JSONB,
    contextes_travail JSONB,
    
    -- Full API response for reference
    raw_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rome_code ON rome_metiers(code_rome);
CREATE INDEX idx_rome_libelle ON rome_metiers(libelle);
CREATE INDEX idx_rome_domaine ON rome_metiers(code_domaine_professionnel);
CREATE INDEX idx_rome_grand_domaine ON rome_metiers(code_grand_domaine);
CREATE INDEX idx_rome_competences ON rome_metiers USING GIN(competences);

-- ============================================
-- TABLE: industry_aliases
-- Stores industry name mappings and aliases
-- ============================================
CREATE TABLE industry_aliases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canonical_name VARCHAR(255) NOT NULL,
    alias VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_industry_aliases_canonical ON industry_aliases(canonical_name);
CREATE INDEX idx_industry_aliases_alias ON industry_aliases(alias);
CREATE UNIQUE INDEX idx_industry_aliases_unique ON industry_aliases(canonical_name, alias);

-- ============================================
-- TABLE: market_facts
-- Stores market radar data (job market statistics)
-- ============================================
CREATE TABLE market_facts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keyword VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    region VARCHAR(100),
    source VARCHAR(50) NOT NULL CHECK (source IN ('france_travail', 'adzuna')),
    job_count INTEGER NOT NULL DEFAULT 0,
    mean_salary NUMERIC(12, 2),
    date DATE NOT NULL,
    
    -- Additional metadata as JSONB for flexibility
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_market_facts_keyword ON market_facts(keyword);
CREATE INDEX idx_market_facts_location ON market_facts(location);
CREATE INDEX idx_market_facts_source ON market_facts(source);
CREATE INDEX idx_market_facts_date ON market_facts(date DESC);
CREATE INDEX idx_market_facts_job_count ON market_facts(job_count DESC);
CREATE UNIQUE INDEX idx_market_facts_unique ON market_facts(keyword, location, source, date);

-- ============================================
-- TABLE: market_trends
-- Stores market trends data from France Travail API
-- ============================================
CREATE TABLE market_trends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(50) NOT NULL, -- 'demandeur', 'offre', 'embauche', 'tension', 'salaire', 'dynamique'
    code_rome VARCHAR(10),
    rome_label VARCHAR(500),
    region VARCHAR(100),
    region_code VARCHAR(10),
    secteur VARCHAR(255),
    date DATE NOT NULL,
    
    -- Main value
    value DECIMAL(15,2),
    value_label VARCHAR(255),
    
    -- Metadata (contains detailed breakdown by characteristics, periods, etc.)
    metadata JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_market_trends_type ON market_trends(type);
CREATE INDEX idx_market_trends_code_rome ON market_trends(code_rome);
CREATE INDEX idx_market_trends_region_code ON market_trends(region_code);
CREATE INDEX idx_market_trends_date ON market_trends(date DESC);
CREATE INDEX idx_market_trends_metadata ON market_trends USING GIN(metadata);
CREATE UNIQUE INDEX idx_market_trends_unique ON market_trends(type, code_rome, region_code);

-- ============================================
-- TRIGGERS FOR UPDATED_AT
-- Automatically update updated_at timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to all tables with updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_settings_updated_at BEFORE UPDATE ON llm_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON resumes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resume_adaptations_updated_at BEFORE UPDATE ON resume_adaptations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rome_metiers_updated_at BEFORE UPDATE ON rome_metiers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_facts_updated_at BEFORE UPDATE ON market_facts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_trends_updated_at BEFORE UPDATE ON market_trends
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Active resumes with customer info
CREATE VIEW v_active_resumes AS
SELECT 
    r.*,
    c.name as customer_full_name,
    c.status as customer_status
FROM resumes r
LEFT JOIN customers c ON r.customer_id = c.id
WHERE r.status = 'active';

-- View: Active missions with customer info
CREATE VIEW v_active_missions AS
SELECT 
    m.*,
    c.name as customer_full_name,
    c.status as customer_status
FROM missions m
LEFT JOIN customers c ON m.customer_id = c.id
WHERE m.status = 'active';

-- View: Resume adaptations with full context
CREATE VIEW v_adaptations_full AS
SELECT 
    ra.*,
    r.name as resume_full_name,
    r.title as resume_title,
    m.title as mission_full_title,
    m.content as mission_content,
    c.name as customer_full_name
FROM resume_adaptations ra
LEFT JOIN resumes r ON ra.resume_id = r.id
LEFT JOIN missions m ON ra.mission_id = m.id
LEFT JOIN customers c ON ra.customer_id = c.id;

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Insert default LLM settings
INSERT INTO llm_settings (name, provider, model, temperature, max_tokens, use_case, system_prompt, user_prompt_template) VALUES
('Default Analysis', 'openai', 'gpt-4', 0.7, 4000, 'analysis', 
 'You are an expert resume analyzer. Extract key information from resumes.',
 'Analyze this resume and extract skills, experience, and key information: {text}'),
('Default Improvement', 'anthropic', 'claude-3-5-sonnet-20241022', 0.7, 4000, 'improvement',
 'You are an expert resume writer. Improve resume text while maintaining accuracy.',
 'Improve this resume section: {text}'),
('Default Adaptation', 'openai', 'gpt-4', 0.7, 4000, 'adaptation',
 'You are an expert at adapting resumes to match job descriptions.',
 'Adapt this resume for this job: Resume: {resume} Job: {job}');

-- ============================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================

COMMENT ON DATABASE resumeconverter IS 'ResumeConverter application database - migrated from Airtable';

COMMENT ON TABLE customers IS 'Customer organizations using the platform';
COMMENT ON TABLE users IS 'User accounts with authentication and role-based access';
COMMENT ON TABLE llm_settings IS 'LLM configuration for AI-powered features';
COMMENT ON TABLE templates IS 'Resume templates with HTML/CSS styling';
COMMENT ON TABLE resumes IS 'Resume documents with analysis and extracted data';
COMMENT ON TABLE missions IS 'Job missions/offers for resume adaptation';
COMMENT ON TABLE resume_adaptations IS 'Adapted resumes tailored to specific missions';
COMMENT ON TABLE rome_metiers IS 'ROME 4.0 French job classification system';
COMMENT ON TABLE industry_aliases IS 'Industry name mappings and aliases';
COMMENT ON TABLE market_facts IS 'Market radar job statistics from various sources';
COMMENT ON TABLE market_trends IS 'Detailed market trends from France Travail API';

-- ============================================
-- GRANT PERMISSIONS (adjust as needed)
-- ============================================

-- Create application user (adjust password in production)
-- CREATE USER resumeconverter_app WITH PASSWORD 'change_this_password';
-- GRANT CONNECT ON DATABASE resumeconverter TO resumeconverter_app;
-- GRANT USAGE ON SCHEMA public TO resumeconverter_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resumeconverter_app;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resumeconverter_app;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

-- Script execution completed successfully!
-- Tables created: 11
-- Views created: 3
-- Triggers created: 10
-- Indexes created: 50+
--
-- Next steps:
--   1. Review and adjust permissions
--   2. Create application database user
--   3. Update connection strings in .env
--   4. Migrate data from Airtable
--   5. Update proxy-server.js to use PostgreSQL
