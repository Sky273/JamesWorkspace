-- =============================================================================
-- ResumeConverter - Complete Database Schema
-- Exported from production: 2026-03-05
-- PostgreSQL 18.1
-- =============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';
COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';
COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

CREATE FUNCTION public.update_dpo_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- =============================================================================
-- TABLES
-- =============================================================================

-- Firms (organizations using the platform)
CREATE TABLE public.firms (
    id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT customers_id_not_null NOT NULL,
    name character varying(255) CONSTRAINT customers_name_not_null NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    logo_url text,
    logo_data bytea,
    logo_mime_type character varying(50),
    CONSTRAINT firms_pkey PRIMARY KEY (id),
    CONSTRAINT firms_name_key UNIQUE (name),
    CONSTRAINT firms_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

COMMENT ON TABLE public.firms IS 'Firm organizations using the platform (formerly customers)';

-- Users
CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    firm_id uuid,
    firm_name character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    job_title character varying(255),
    phone character varying(50),
    google_id text,
    google_email text,
    google_linked_at timestamp with time zone,
    totp_enabled boolean DEFAULT false,
    totp_secret text,
    totp_backup_codes text,
    totp_pending_secret text,
    totp_pending_backup_codes text,
    totp_enabled_at timestamp with time zone,
    CONSTRAINT users_pkey PRIMARY KEY (id),
    CONSTRAINT users_email_key UNIQUE (email),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'pending'::character varying])::text[])))
);

COMMENT ON TABLE public.users IS 'User accounts with authentication and role-based access';
COMMENT ON COLUMN public.users.google_id IS 'Google account ID for OAuth authentication';
COMMENT ON COLUMN public.users.google_email IS 'Email from Google account (may differ from login email)';
COMMENT ON COLUMN public.users.google_linked_at IS 'Timestamp when Google account was linked';

-- Templates
CREATE TABLE public.templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    popular boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying,
    tags text[],
    preview_image_url text,
    header_content text,
    template_content text NOT NULL,
    footer_content text,
    footer_height integer DEFAULT 25,
    stylesheet text,
    firm_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_pkey PRIMARY KEY (id),
    CONSTRAINT templates_name_key UNIQUE (name),
    CONSTRAINT templates_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

COMMENT ON TABLE public.templates IS 'Resume templates with HTML/CSS styling';
COMMENT ON COLUMN public.templates.firm_id IS 'Optional firm association - NULL means global template visible to all';

-- Resumes
CREATE TABLE public.resumes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    title character varying(255),
    file_name character varying(255),
    resume_file_url text,
    resume_file_size integer,
    resume_file_type character varying(100),
    status character varying(50) DEFAULT 'active'::character varying,
    firm_id uuid,
    firm_name character varying(255),
    skills jsonb,
    industries jsonb,
    tools jsonb,
    soft_skills jsonb,
    skills_cleaned jsonb,
    industries_cleaned jsonb,
    tools_cleaned jsonb,
    soft_skills_cleaned jsonb,
    skills_esco jsonb,
    industries_esco jsonb,
    tools_esco jsonb,
    soft_skills_esco jsonb,
    key_improvements text,
    summary text,
    experience_years integer,
    education_level character varying(100),
    certifications jsonb,
    languages jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    analyzed_at timestamp with time zone,
    original_text text,
    improved_text text,
    original_name character varying(255),
    global_rating integer,
    skills_score integer,
    experience_score integer,
    education_score integer,
    ats_score integer,
    executive_summary_score integer,
    hobbies_languages_score integer,
    improved_global_rating integer,
    improved_skills_score integer,
    improved_experience_score integer,
    improved_education_score integer,
    improved_ats_score integer,
    improved_executive_summary_score integer,
    improved_hobbies_languages_score integer,
    template_id uuid,
    template_name character varying(255),
    improvement_suggestions text,
    analysis_details jsonb,
    improvement_date timestamp with time zone,
    trigram character varying(10),
    improved_key_improvements text,
    improved_skills jsonb,
    improved_industries jsonb,
    improved_tools jsonb,
    improved_soft_skills jsonb,
    resume_file_data bytea,
    current_version integer DEFAULT 0,
    profile_type character varying(20) DEFAULT 'external'::character varying,
    candidate_name character varying(255),
    candidate_email character varying(255),
    consent_status character varying(20) DEFAULT 'pending_consent'::character varying,
    consent_requested_at timestamp with time zone,
    consent_responded_at timestamp with time zone,
    retention_until timestamp with time zone,
    consent_token character varying(64),
    consent_token_expires_at timestamp with time zone,
    consent_reminder_sent_at timestamp with time zone,
    consent_reminder_count integer DEFAULT 0,
    shared_pdf_path character varying(500),
    shared_pdf_token character varying(64),
    CONSTRAINT resumes_pkey PRIMARY KEY (id),
    CONSTRAINT resumes_consent_status_check CHECK (((consent_status)::text = ANY ((ARRAY['not_required'::character varying, 'pending_consent'::character varying, 'active'::character varying, 'refused'::character varying, 'expired'::character varying, 'purged'::character varying, 'error'::character varying])::text[]))),
    CONSTRAINT resumes_profile_type_check CHECK (((profile_type)::text = ANY ((ARRAY['employee'::character varying, 'external'::character varying])::text[]))),
    CONSTRAINT resumes_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying, 'new'::character varying, 'pending'::character varying, 'processing'::character varying, 'analyzed'::character varying, 'improved'::character varying, 'error'::character varying, 'failed'::character varying])::text[])))
);

COMMENT ON TABLE public.resumes IS 'Resume documents with analysis and extracted data';
COMMENT ON COLUMN public.resumes.current_version IS 'Current version number of the improved text (0 if no improved version exists)';
COMMENT ON CONSTRAINT resumes_consent_status_check ON public.resumes IS 'Valid consent statuses: not_required, pending_consent, active, refused, expired, purged, error';

-- Clients
CREATE TABLE public.clients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    firm_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(50) DEFAULT 'prospect'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    address text,
    website character varying(255),
    industry character varying(255),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT clients_pkey PRIMARY KEY (id),
    CONSTRAINT clients_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[]))),
    CONSTRAINT clients_type_check CHECK (((type)::text = ANY ((ARRAY['client'::character varying, 'prospect'::character varying])::text[])))
);

COMMENT ON TABLE public.clients IS 'Client and prospect organizations for CV submissions';

-- Client Contacts
CREATE TABLE public.client_contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(255),
    email character varying(255),
    phone character varying(50),
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT client_contacts_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.client_contacts IS 'Contact persons for clients/prospects';

-- Missions
CREATE TABLE public.missions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(500) NOT NULL,
    content text NOT NULL,
    firm_id uuid,
    firm character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    keywords jsonb,
    required_skills jsonb,
    preferred_skills jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    client_id uuid,
    contact_id uuid,
    CONSTRAINT missions_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.missions IS 'Job missions/offers for resume adaptation';

-- Resume Adaptations
CREATE TABLE public.resume_adaptations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resume_id uuid,
    mission_id uuid,
    resume_name character varying(255),
    candidate_name character varying(255),
    adapted_title character varying(500),
    mission_title character varying(500),
    firm_id uuid,
    firm character varying(255),
    adapted_text text NOT NULL,
    adaptation_notes text,
    match_score numeric(5,2),
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    match_analysis jsonb,
    mission_content text,
    CONSTRAINT resume_adaptations_pkey PRIMARY KEY (id),
    CONSTRAINT resume_adaptations_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'processing'::character varying, 'completed'::character varying, 'final'::character varying, 'sent'::character varying, 'archived'::character varying, 'failed'::character varying])::text[])))
);

COMMENT ON TABLE public.resume_adaptations IS 'Adapted resumes tailored to specific missions';

-- Resume Versions
CREATE TABLE public.resume_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    version_number integer NOT NULL,
    improved_text text NOT NULL,
    improved_global_rating integer,
    improved_skills_score integer,
    improved_experience_score integer,
    improved_education_score integer,
    improved_ats_score integer,
    improved_executive_summary_score integer,
    improved_hobbies_languages_score integer,
    improved_skills jsonb,
    improved_industries jsonb,
    improved_tools jsonb,
    improved_soft_skills jsonb,
    improved_key_improvements text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    change_reason character varying(255),
    CONSTRAINT resume_versions_pkey PRIMARY KEY (id),
    CONSTRAINT unique_resume_version UNIQUE (resume_id, version_number)
);

COMMENT ON TABLE public.resume_versions IS 'Historical versions of improved CV text with associated scores and tags';
COMMENT ON COLUMN public.resume_versions.version_number IS 'Sequential version number starting from 1';
COMMENT ON COLUMN public.resume_versions.change_reason IS 'Reason for version creation: initial_improvement, manual_edit, restore';

-- Resume Submissions
CREATE TABLE public.resume_submissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resume_id uuid NOT NULL,
    client_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    mission_id uuid,
    firm_id uuid NOT NULL,
    sent_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    sent_by uuid,
    notes text,
    status character varying(50) DEFAULT 'sent'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    version_number integer,
    email_html_sent text,
    email_template_id uuid,
    CONSTRAINT resume_submissions_pkey PRIMARY KEY (id),
    CONSTRAINT resume_submissions_status_check CHECK (((status)::text = ANY ((ARRAY['sent'::character varying, 'viewed'::character varying, 'rejected'::character varying, 'accepted'::character varying, 'pending'::character varying])::text[])))
);

COMMENT ON TABLE public.resume_submissions IS 'History of CV submissions to clients/prospects';

-- Resume Comments
CREATE TABLE public.resume_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_name character varying(255) NOT NULL,
    content text NOT NULL,
    is_private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT resume_comments_pkey PRIMARY KEY (id)
);

-- ROME Metiers
CREATE TABLE public.rome_metiers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    code_rome character varying(10) NOT NULL,
    libelle character varying(500) NOT NULL,
    code_ogr character varying(10),
    libelle_ogr character varying(500),
    code_domaine_professionnel character varying(10),
    libelle_domaine_professionnel character varying(500),
    code_grand_domaine character varying(10),
    libelle_grand_domaine character varying(500),
    competences jsonb,
    savoir_faire jsonb,
    savoir_etre jsonb,
    contextes_travail jsonb,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    obsolete boolean DEFAULT false,
    enjeux jsonb,
    macro_savoir_faire jsonb,
    savoirs jsonb,
    CONSTRAINT rome_metiers_pkey PRIMARY KEY (id),
    CONSTRAINT rome_metiers_code_rome_key UNIQUE (code_rome)
);

COMMENT ON TABLE public.rome_metiers IS 'ROME 4.0 French job classification system';

-- Industry Aliases
CREATE TABLE public.industry_aliases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    canonical_name character varying(255) NOT NULL,
    alias character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT industry_aliases_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.industry_aliases IS 'Industry name mappings and aliases';

-- Market Facts
CREATE TABLE public.market_facts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    keyword character varying(255) NOT NULL,
    location character varying(255),
    region character varying(100),
    source character varying(50) NOT NULL,
    job_count integer DEFAULT 0 NOT NULL,
    date date NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    mean_salary numeric(12,2),
    CONSTRAINT market_facts_pkey PRIMARY KEY (id),
    CONSTRAINT market_facts_source_check CHECK (((source)::text = ANY ((ARRAY['france_travail'::character varying, 'adzuna'::character varying])::text[])))
);

COMMENT ON TABLE public.market_facts IS 'Market radar job statistics from various sources';

-- Market Trends
CREATE TABLE public.market_trends (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    type character varying(50) NOT NULL,
    code_rome character varying(10),
    rome_label character varying(500),
    region character varying(100),
    region_code character varying(10),
    secteur character varying(255),
    date date NOT NULL,
    value numeric(15,2),
    value_label character varying(255),
    metadata jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    collected_at timestamp with time zone DEFAULT now(),
    api_endpoint character varying(255),
    quarter_period character varying(20),
    api_response_hash character varying(64),
    previous_value numeric(15,2),
    CONSTRAINT market_trends_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.market_trends IS 'Detailed market trends from France Travail API';
COMMENT ON COLUMN public.market_trends.collected_at IS 'Timestamp when data was collected from API';
COMMENT ON COLUMN public.market_trends.api_endpoint IS 'API endpoint used for collection (e.g., stat-offres, stat-embauches)';
COMMENT ON COLUMN public.market_trends.quarter_period IS 'Quarter period covered by the data (e.g., Q4 2025)';
COMMENT ON COLUMN public.market_trends.api_response_hash IS 'MD5 hash of raw API response for verification';
COMMENT ON COLUMN public.market_trends.previous_value IS 'Previous value before update, for change tracking';

-- LLM Settings
CREATE TABLE public.llm_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    llm_model character varying(100),
    analysis_prompt text,
    improvement_prompt text,
    match_analysis_prompt text,
    adaptation_prompt text,
    cv_mode character varying(50) DEFAULT 'nominative'::character varying,
    chatbot_enabled character varying(10) DEFAULT 'on'::character varying,
    executive_summary_weight integer DEFAULT 20,
    skills_weight integer DEFAULT 20,
    experience_weight integer DEFAULT 20,
    education_weight integer DEFAULT 15,
    ats_weight integer DEFAULT 15,
    hobbies_languages_weight integer DEFAULT 10,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    dpo_name character varying(255) DEFAULT ''::character varying,
    dpo_email character varying(255) DEFAULT ''::character varying,
    dpo_phone character varying(50) DEFAULT ''::character varying,
    CONSTRAINT llm_settings_pkey PRIMARY KEY (id),
    CONSTRAINT llm_settings_name_key UNIQUE (name),
    CONSTRAINT llm_settings_ats_weight_check CHECK (((ats_weight >= 0) AND (ats_weight <= 100))),
    CONSTRAINT llm_settings_chatbot_enabled_check CHECK (((chatbot_enabled)::text = ANY ((ARRAY['on'::character varying, 'off'::character varying])::text[]))),
    CONSTRAINT llm_settings_cv_mode_check CHECK (((cv_mode)::text = ANY ((ARRAY['nominative'::character varying, 'anonymous'::character varying])::text[]))),
    CONSTRAINT llm_settings_education_weight_check CHECK (((education_weight >= 0) AND (education_weight <= 100))),
    CONSTRAINT llm_settings_executive_summary_weight_check CHECK (((executive_summary_weight >= 0) AND (executive_summary_weight <= 100))),
    CONSTRAINT llm_settings_experience_weight_check CHECK (((experience_weight >= 0) AND (experience_weight <= 100))),
    CONSTRAINT llm_settings_hobbies_languages_weight_check CHECK (((hobbies_languages_weight >= 0) AND (hobbies_languages_weight <= 100))),
    CONSTRAINT llm_settings_skills_weight_check CHECK (((skills_weight >= 0) AND (skills_weight <= 100))),
    CONSTRAINT llm_settings_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);

-- Email Templates
CREATE TABLE public.email_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    firm_id uuid,
    name character varying(255) NOT NULL,
    description text,
    subject_template character varying(500) NOT NULL,
    mjml_content text NOT NULL,
    html_content text,
    is_system boolean DEFAULT false,
    is_default boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_templates_pkey PRIMARY KEY (id),
    CONSTRAINT email_templates_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);

COMMENT ON TABLE public.email_templates IS 'Email templates with MJML content for CV submissions';

-- Token Blacklist
CREATE TABLE public.token_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token_jti text NOT NULL,
    user_id uuid,
    reason text DEFAULT 'logout'::text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT token_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT token_blacklist_jti_key UNIQUE (token_jti)
);

COMMENT ON TABLE public.token_blacklist IS 'Blacklisted JWT tokens for immediate revocation';
COMMENT ON COLUMN public.token_blacklist.token_jti IS 'JWT token ID (jti claim)';
COMMENT ON COLUMN public.token_blacklist.expires_at IS 'Token expiration time - used for cleanup';

-- User Blacklist
CREATE TABLE public.user_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    reason text DEFAULT 'account_deactivated'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_blacklist_pkey PRIMARY KEY (id),
    CONSTRAINT user_blacklist_user_id_key UNIQUE (user_id)
);

COMMENT ON TABLE public.user_blacklist IS 'Blacklisted users - all their tokens are invalid';

-- Password Reset Tokens
CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT password_reset_tokens_hash_key UNIQUE (token_hash)
);

COMMENT ON TABLE public.password_reset_tokens IS 'Password reset tokens for forgot password flow';
COMMENT ON COLUMN public.password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (plain token sent via email)';
COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Token expiry (1 hour after creation)';
COMMENT ON COLUMN public.password_reset_tokens.used_at IS 'Timestamp when token was used (one-time use)';

-- User Mail Tokens
CREATE TABLE public.user_mail_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    provider character varying(50) DEFAULT 'gmail'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_mail_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT user_mail_tokens_unique_user_provider UNIQUE (user_id, provider),
    CONSTRAINT user_mail_tokens_provider_check CHECK (((provider)::text = ANY ((ARRAY['gmail'::character varying, 'outlook'::character varying])::text[])))
);

COMMENT ON TABLE public.user_mail_tokens IS 'Encrypted OAuth tokens for email providers (Gmail, Outlook)';
COMMENT ON COLUMN public.user_mail_tokens.access_token_encrypted IS 'AES-256 encrypted access token';
COMMENT ON COLUMN public.user_mail_tokens.refresh_token_encrypted IS 'AES-256 encrypted refresh token';
COMMENT ON COLUMN public.user_mail_tokens.token_expiry IS 'Token expiration timestamp';
COMMENT ON COLUMN public.user_mail_tokens.email IS 'Email address associated with the OAuth account';

-- Firm GDPR Mail Tokens
CREATE TABLE public.firm_gdpr_mail_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    provider character varying(50) DEFAULT 'gmail'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT firm_gdpr_mail_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT firm_gdpr_mail_tokens_firm_id_key UNIQUE (firm_id)
);

COMMENT ON TABLE public.firm_gdpr_mail_tokens IS 'Stores Gmail OAuth tokens for GDPR consent email sending at firm level';

-- Global GDPR Mail Token
CREATE TABLE public.global_gdpr_mail_token (
    id character varying(50) DEFAULT 'global'::character varying NOT NULL,
    provider character varying(50) DEFAULT 'gmail'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT global_gdpr_mail_token_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.global_gdpr_mail_token IS 'Stores a SINGLE global Gmail OAuth token for all GDPR consent emails. Templates are still firm-specific.';

-- GDPR Audit Log
CREATE TABLE public.gdpr_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action character varying(100) NOT NULL,
    category character varying(50) NOT NULL,
    firm_id uuid,
    firm_name character varying(255),
    user_id uuid,
    user_name character varying(255),
    target_type character varying(50),
    target_id uuid,
    target_name character varying(255),
    target_email character varying(255),
    details jsonb DEFAULT '{}'::jsonb,
    ip_address character varying(45),
    user_agent text,
    is_automated boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT gdpr_audit_log_pkey PRIMARY KEY (id)
);

-- User Calendar Tokens
CREATE TABLE public.user_calendar_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT user_calendar_tokens_pkey PRIMARY KEY (id),
    CONSTRAINT user_calendar_tokens_user_id_key UNIQUE (user_id)
);

-- Candidate Pipeline
CREATE TABLE public.candidate_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    mission_id uuid,
    client_id uuid,
    stage character varying(50) DEFAULT 'new'::character varying NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    moved_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT candidate_pipeline_pkey PRIMARY KEY (id),
    CONSTRAINT candidate_pipeline_resume_id_mission_id_key UNIQUE (resume_id, mission_id)
);

-- Pipeline History
CREATE TABLE public.pipeline_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    from_stage character varying(50),
    to_stage character varying(50) NOT NULL,
    changed_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pipeline_history_pkey PRIMARY KEY (id)
);

-- Pipeline Interviews
CREATE TABLE public.pipeline_interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    interview_type character varying(50) DEFAULT 'client'::character varying,
    scheduled_at timestamp with time zone NOT NULL,
    duration_minutes integer DEFAULT 60,
    location character varying(255),
    meeting_link character varying(500),
    attendees jsonb DEFAULT '[]'::jsonb,
    calendar_event_id character varying(255),
    calendar_provider character varying(50),
    status character varying(50) DEFAULT 'scheduled'::character varying,
    outcome character varying(50),
    outcome_notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pipeline_interviews_pkey PRIMARY KEY (id)
);

-- =============================================================================
-- VIEWS
-- =============================================================================

CREATE VIEW public.v_active_resumes AS
 SELECT r.id,
    r.name,
    r.title,
    r.file_name,
    r.resume_file_url,
    r.resume_file_size,
    r.resume_file_type,
    r.status,
    r.firm_id,
    r.firm_name,
    r.skills,
    r.industries,
    r.tools,
    r.soft_skills,
    r.skills_cleaned,
    r.industries_cleaned,
    r.tools_cleaned,
    r.soft_skills_cleaned,
    r.skills_esco,
    r.industries_esco,
    r.tools_esco,
    r.soft_skills_esco,
    r.key_improvements,
    r.summary,
    r.experience_years,
    r.education_level,
    r.certifications,
    r.languages,
    r.created_at,
    r.updated_at,
    r.analyzed_at,
    f.name AS firm_full_name,
    f.status AS firm_status
   FROM (public.resumes r
     LEFT JOIN public.firms f ON ((r.firm_id = f.id)))
  WHERE ((r.status)::text = 'active'::text);

CREATE VIEW public.v_active_missions AS
 SELECT m.id,
    m.title,
    m.content,
    m.firm_id,
    m.firm,
    m.status,
    m.keywords,
    m.required_skills,
    m.preferred_skills,
    m.created_at,
    m.updated_at,
    f.name AS firm_full_name,
    f.status AS firm_status
   FROM (public.missions m
     LEFT JOIN public.firms f ON ((m.firm_id = f.id)))
  WHERE ((m.status)::text = 'active'::text);

CREATE VIEW public.v_adaptations_full AS
 SELECT ra.id,
    ra.resume_id,
    ra.mission_id,
    ra.resume_name,
    ra.mission_title,
    ra.firm_id,
    ra.firm,
    ra.adapted_text,
    ra.adaptation_notes,
    ra.match_score,
    ra.status,
    ra.created_at,
    ra.updated_at,
    r.name AS resume_full_name,
    r.title AS resume_title,
    m.title AS mission_full_title,
    m.content AS mission_content,
    f.name AS firm_full_name
   FROM (((public.resume_adaptations ra
     LEFT JOIN public.resumes r ON ((ra.resume_id = r.id)))
     LEFT JOIN public.missions m ON ((ra.mission_id = m.id)))
     LEFT JOIN public.firms f ON ((ra.firm_id = f.id)));

CREATE VIEW public.v_clients_with_contacts AS
 SELECT c.id,
    c.firm_id,
    c.name,
    c.type,
    c.status,
    c.address,
    c.website,
    c.industry,
    c.notes,
    c.created_at,
    c.updated_at,
    c.created_by,
    f.name AS firm_name,
    ( SELECT count(*) AS count
           FROM public.client_contacts cc
          WHERE (cc.client_id = c.id)) AS contacts_count,
    ( SELECT count(*) AS count
           FROM public.resume_submissions rs
          WHERE (rs.client_id = c.id)) AS submissions_count
   FROM (public.clients c
     LEFT JOIN public.firms f ON ((c.firm_id = f.id)));

COMMENT ON VIEW public.v_clients_with_contacts IS 'Clients with contact and submission counts';

CREATE VIEW public.v_resume_submissions_full AS
 SELECT rs.id,
    rs.resume_id,
    rs.client_id,
    rs.contact_id,
    rs.mission_id,
    rs.firm_id,
    rs.sent_at,
    rs.sent_by,
    rs.notes,
    rs.status,
    rs.version_number,
    rs.created_at,
    r.name AS resume_name,
    r.title AS resume_title,
    c.name AS client_name,
    c.type AS client_type,
    cc.name AS contact_name,
    cc.email AS contact_email,
    m.title AS mission_title,
    u.name AS sent_by_name,
    f.name AS firm_name
   FROM ((((((public.resume_submissions rs
     LEFT JOIN public.resumes r ON ((rs.resume_id = r.id)))
     LEFT JOIN public.clients c ON ((rs.client_id = c.id)))
     LEFT JOIN public.client_contacts cc ON ((rs.contact_id = cc.id)))
     LEFT JOIN public.missions m ON ((rs.mission_id = m.id)))
     LEFT JOIN public.users u ON ((rs.sent_by = u.id)))
     LEFT JOIN public.firms f ON ((rs.firm_id = f.id)));

COMMENT ON VIEW public.v_resume_submissions_full IS 'Full view of resume submissions with related entity names and version number';

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Firms indexes
CREATE INDEX idx_firms_name ON public.firms USING btree (name);
CREATE INDEX idx_firms_status ON public.firms USING btree (status);

-- Users indexes
CREATE INDEX idx_users_email ON public.users USING btree (email);
CREATE INDEX idx_users_firm_id ON public.users USING btree (firm_id);
CREATE UNIQUE INDEX idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);
CREATE INDEX idx_users_role ON public.users USING btree (role);
CREATE INDEX idx_users_status ON public.users USING btree (status);
CREATE INDEX idx_users_totp_enabled ON public.users USING btree (totp_enabled) WHERE (totp_enabled = true);

-- Templates indexes
CREATE INDEX idx_templates_name ON public.templates USING btree (name);
CREATE INDEX idx_templates_status ON public.templates USING btree (status);
CREATE INDEX idx_templates_popular ON public.templates USING btree (popular);
CREATE INDEX idx_templates_tags ON public.templates USING gin (tags);
CREATE INDEX idx_templates_firm_id ON public.templates USING btree (firm_id);

-- Resumes indexes
CREATE INDEX idx_resumes_name ON public.resumes USING btree (name);
CREATE INDEX idx_resumes_firm_id ON public.resumes USING btree (firm_id);
CREATE INDEX idx_resumes_status ON public.resumes USING btree (status);
CREATE INDEX idx_resumes_title ON public.resumes USING btree (title);
CREATE INDEX idx_resumes_created_at ON public.resumes USING btree (created_at DESC);
CREATE INDEX idx_resumes_skills ON public.resumes USING gin (skills);
CREATE INDEX idx_resumes_industries ON public.resumes USING gin (industries);
CREATE INDEX idx_resumes_consent_token ON public.resumes USING btree (consent_token) WHERE (consent_token IS NOT NULL);
CREATE INDEX idx_resumes_consent_status ON public.resumes USING btree (consent_status);
CREATE INDEX idx_resumes_profile_type ON public.resumes USING btree (profile_type);
CREATE INDEX idx_resumes_retention_until ON public.resumes USING btree (retention_until) WHERE (retention_until IS NOT NULL);
CREATE INDEX idx_resumes_consent_requested_at ON public.resumes USING btree (consent_requested_at) WHERE (consent_requested_at IS NOT NULL);
CREATE INDEX idx_resumes_shared_pdf_token ON public.resumes USING btree (shared_pdf_token) WHERE (shared_pdf_token IS NOT NULL);

-- Clients indexes
CREATE INDEX idx_clients_firm_id ON public.clients USING btree (firm_id);
CREATE INDEX idx_clients_type ON public.clients USING btree (type);
CREATE INDEX idx_clients_name ON public.clients USING btree (name);

-- Client Contacts indexes
CREATE INDEX idx_client_contacts_client_id ON public.client_contacts USING btree (client_id);

-- Missions indexes
CREATE INDEX idx_missions_title ON public.missions USING btree (title);
CREATE INDEX idx_missions_firm_id ON public.missions USING btree (firm_id);
CREATE INDEX idx_missions_status ON public.missions USING btree (status);
CREATE INDEX idx_missions_created_at ON public.missions USING btree (created_at DESC);
CREATE INDEX idx_missions_keywords ON public.missions USING gin (keywords);
CREATE INDEX idx_missions_client_id ON public.missions USING btree (client_id);
CREATE INDEX idx_missions_contact_id ON public.missions USING btree (contact_id);

-- Resume Adaptations indexes
CREATE INDEX idx_adaptations_resume_id ON public.resume_adaptations USING btree (resume_id);
CREATE INDEX idx_adaptations_mission_id ON public.resume_adaptations USING btree (mission_id);
CREATE INDEX idx_adaptations_firm_id ON public.resume_adaptations USING btree (firm_id);
CREATE INDEX idx_adaptations_status ON public.resume_adaptations USING btree (status);
CREATE INDEX idx_adaptations_created_at ON public.resume_adaptations USING btree (created_at DESC);

-- Resume Versions indexes
CREATE INDEX idx_resume_versions_resume_id ON public.resume_versions USING btree (resume_id);
CREATE INDEX idx_resume_versions_created_at ON public.resume_versions USING btree (created_at DESC);
CREATE INDEX idx_resume_versions_version_number ON public.resume_versions USING btree (resume_id, version_number DESC);

-- Resume Submissions indexes
CREATE INDEX idx_resume_submissions_firm_id ON public.resume_submissions USING btree (firm_id);
CREATE INDEX idx_resume_submissions_client_id ON public.resume_submissions USING btree (client_id);
CREATE INDEX idx_resume_submissions_resume_id ON public.resume_submissions USING btree (resume_id);
CREATE INDEX idx_resume_submissions_mission_id ON public.resume_submissions USING btree (mission_id);
CREATE INDEX idx_resume_submissions_sent_at ON public.resume_submissions USING btree (sent_at DESC);

-- Resume Comments indexes
CREATE INDEX idx_resume_comments_resume_id ON public.resume_comments USING btree (resume_id);
CREATE INDEX idx_resume_comments_user_id ON public.resume_comments USING btree (user_id);
CREATE INDEX idx_resume_comments_created_at ON public.resume_comments USING btree (created_at DESC);

-- ROME indexes
CREATE INDEX idx_rome_code ON public.rome_metiers USING btree (code_rome);
CREATE INDEX idx_rome_libelle ON public.rome_metiers USING btree (libelle);
CREATE INDEX idx_rome_domaine ON public.rome_metiers USING btree (code_domaine_professionnel);
CREATE INDEX idx_rome_grand_domaine ON public.rome_metiers USING btree (code_grand_domaine);
CREATE INDEX idx_rome_competences ON public.rome_metiers USING gin (competences);

-- Industry Aliases indexes
CREATE INDEX idx_industry_aliases_canonical ON public.industry_aliases USING btree (canonical_name);
CREATE INDEX idx_industry_aliases_alias ON public.industry_aliases USING btree (alias);
CREATE UNIQUE INDEX idx_industry_aliases_unique ON public.industry_aliases USING btree (canonical_name, alias);

-- Market Facts indexes
CREATE INDEX idx_market_facts_keyword ON public.market_facts USING btree (keyword);
CREATE INDEX idx_market_facts_location ON public.market_facts USING btree (location);
CREATE INDEX idx_market_facts_source ON public.market_facts USING btree (source);
CREATE INDEX idx_market_facts_date ON public.market_facts USING btree (date DESC);
CREATE INDEX idx_market_facts_job_count ON public.market_facts USING btree (job_count DESC);
CREATE UNIQUE INDEX idx_market_facts_unique ON public.market_facts USING btree (keyword, location, source, date);

-- Market Trends indexes
CREATE INDEX idx_market_trends_type ON public.market_trends USING btree (type);
CREATE INDEX idx_market_trends_code_rome ON public.market_trends USING btree (code_rome);
CREATE INDEX idx_market_trends_region_code ON public.market_trends USING btree (region_code);
CREATE INDEX idx_market_trends_date ON public.market_trends USING btree (date DESC);
CREATE INDEX idx_market_trends_metadata ON public.market_trends USING gin (metadata);
CREATE UNIQUE INDEX idx_market_trends_unique ON public.market_trends USING btree (type, code_rome, region_code);
CREATE INDEX idx_market_trends_collected_at ON public.market_trends USING btree (collected_at DESC);
CREATE INDEX idx_market_trends_audit ON public.market_trends USING btree (type, region_code, code_rome, collected_at DESC);

-- LLM Settings indexes
CREATE INDEX idx_llm_settings_name ON public.llm_settings USING btree (name);
CREATE INDEX idx_llm_settings_status ON public.llm_settings USING btree (status);
CREATE INDEX idx_llm_settings_cv_mode ON public.llm_settings USING btree (cv_mode);

-- Email Templates indexes
CREATE INDEX idx_email_templates_firm_id ON public.email_templates USING btree (firm_id);
CREATE INDEX idx_email_templates_is_system ON public.email_templates USING btree (is_system);
CREATE INDEX idx_email_templates_status ON public.email_templates USING btree (status);

-- Token Blacklist indexes
CREATE INDEX idx_token_blacklist_jti ON public.token_blacklist USING btree (token_jti);
CREATE INDEX idx_token_blacklist_expires ON public.token_blacklist USING btree (expires_at);

-- User Blacklist indexes
CREATE INDEX idx_user_blacklist_user_id ON public.user_blacklist USING btree (user_id);

-- Password Reset Tokens indexes
CREATE INDEX idx_password_reset_tokens_hash ON public.password_reset_tokens USING btree (token_hash);
CREATE INDEX idx_password_reset_tokens_user ON public.password_reset_tokens USING btree (user_id);
CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);

-- User Mail Tokens indexes
CREATE INDEX idx_user_mail_tokens_user_id ON public.user_mail_tokens USING btree (user_id);

-- Firm GDPR Mail Tokens indexes
CREATE INDEX idx_firm_gdpr_mail_tokens_firm_id ON public.firm_gdpr_mail_tokens USING btree (firm_id);

-- GDPR Audit Log indexes
CREATE INDEX idx_gdpr_audit_action ON public.gdpr_audit_log USING btree (action);
CREATE INDEX idx_gdpr_audit_category ON public.gdpr_audit_log USING btree (category);
CREATE INDEX idx_gdpr_audit_firm_id ON public.gdpr_audit_log USING btree (firm_id);
CREATE INDEX idx_gdpr_audit_created_at ON public.gdpr_audit_log USING btree (created_at DESC);
CREATE INDEX idx_gdpr_audit_target_email ON public.gdpr_audit_log USING btree (target_email);
CREATE INDEX idx_gdpr_audit_is_automated ON public.gdpr_audit_log USING btree (is_automated);

-- User Calendar Tokens indexes
CREATE INDEX idx_user_calendar_tokens_user_id ON public.user_calendar_tokens USING btree (user_id);

-- Candidate Pipeline indexes
CREATE INDEX idx_candidate_pipeline_resume_id ON public.candidate_pipeline USING btree (resume_id);
CREATE INDEX idx_candidate_pipeline_mission_id ON public.candidate_pipeline USING btree (mission_id);
CREATE INDEX idx_candidate_pipeline_client_id ON public.candidate_pipeline USING btree (client_id);
CREATE INDEX idx_candidate_pipeline_stage ON public.candidate_pipeline USING btree (stage);

-- Pipeline History indexes
CREATE INDEX idx_pipeline_history_pipeline_id ON public.pipeline_history USING btree (pipeline_id);

-- Pipeline Interviews indexes
CREATE INDEX idx_pipeline_interviews_pipeline_id ON public.pipeline_interviews USING btree (pipeline_id);
CREATE INDEX idx_pipeline_interviews_scheduled_at ON public.pipeline_interviews USING btree (scheduled_at);

-- =============================================================================
-- FOREIGN KEYS
-- =============================================================================

-- Users FK
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;

-- Templates FKs
ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;

-- Resumes FKs
ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;

-- Clients FKs
ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Client Contacts FK
ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

-- Missions FKs
ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE SET NULL;

-- Resume Adaptations FKs
ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;

-- Resume Versions FKs
ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Resume Submissions FKs
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;

-- Resume Comments FK
ALTER TABLE ONLY public.resume_comments
    ADD CONSTRAINT resume_comments_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;

-- Email Templates FKs
ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- User Blacklist FK
ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Password Reset Tokens FK
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- User Mail Tokens FK
ALTER TABLE ONLY public.user_mail_tokens
    ADD CONSTRAINT user_mail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Firm GDPR Mail Tokens FK
ALTER TABLE ONLY public.firm_gdpr_mail_tokens
    ADD CONSTRAINT firm_gdpr_mail_tokens_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;

-- User Calendar Tokens FK
ALTER TABLE ONLY public.user_calendar_tokens
    ADD CONSTRAINT user_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Candidate Pipeline FKs
ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;

-- Pipeline History FK
ALTER TABLE ONLY public.pipeline_history
    ADD CONSTRAINT pipeline_history_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.candidate_pipeline(id) ON DELETE CASCADE;

-- Pipeline Interviews FK
ALTER TABLE ONLY public.pipeline_interviews
    ADD CONSTRAINT pipeline_interviews_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.candidate_pipeline(id) ON DELETE CASCADE;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_resume_adaptations_updated_at BEFORE UPDATE ON public.resume_adaptations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_rome_metiers_updated_at BEFORE UPDATE ON public.rome_metiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_market_facts_updated_at BEFORE UPDATE ON public.market_facts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_market_trends_updated_at BEFORE UPDATE ON public.market_trends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_llm_settings_updated_at BEFORE UPDATE ON public.llm_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_mail_tokens_updated_at BEFORE UPDATE ON public.user_mail_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_firm_gdpr_mail_tokens_updated_at BEFORE UPDATE ON public.firm_gdpr_mail_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_global_gdpr_mail_token_updated_at BEFORE UPDATE ON public.global_gdpr_mail_token FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- MIGRATIONS TRACKING TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schema_migrations (
    id SERIAL PRIMARY KEY,
    migration_name character varying(255) NOT NULL UNIQUE,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations';

-- =============================================================================
-- DEFAULT DATA
-- =============================================================================

-- Insert default firm
INSERT INTO public.firms (name, status) VALUES ('Default', 'active') ON CONFLICT (name) DO NOTHING;

-- Insert default admin user (password: admin123)
INSERT INTO public.users (email, password, name, role, status, firm_id, firm_name)
SELECT 'admin@resumeconverter.local', 
       '$2a$10$Tu2BJ9BAaPwAiXD64tIuKO3wM4eyec0oUflaatmSQbxO87L3/r0De', 
       'Admin', 
       'admin', 
       'active',
       f.id,
       f.name
FROM public.firms f WHERE f.name = 'Default'
ON CONFLICT (email) DO NOTHING;

-- Insert default LLM settings
INSERT INTO public.llm_settings (name, llm_model, cv_mode, chatbot_enabled, status) VALUES
('Default', 'gpt-4', 'nominative', 'on', 'active')
ON CONFLICT (name) DO NOTHING;

-- Insert default system email template
INSERT INTO public.email_templates (
    id,
    firm_id,
    name,
    description,
    subject_template,
    mjml_content,
    is_system,
    is_default,
    status
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,
    'Template par défaut',
    'Template système professionnel avec tous les mots-clés disponibles. Utilisez ce modèle comme base pour créer vos propres templates.',
    'Candidature - {{resume.name}} - {{resume.title}}',
    '<mjml>
  <mj-head>
    <mj-title>Email Template</mj-title>
    <mj-preview>Candidature</mj-preview>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.6" color="#333333" />
    </mj-attributes>
    <mj-raw>
      <meta charset="UTF-8" />
    </mj-raw>
  </mj-head>
  <mj-body background-color="#f4f4f4">
    <mj-section background-color="#ffffff" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="24px" font-weight="bold" color="#1f2937">
          {{firm.name}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="30px 20px">
      <mj-column>
        <mj-text>Bonjour {{contact.firstName}},</mj-text>
        <mj-text padding-top="20px">Je me permets de vous adresser le profil de <strong>{{resume.name}}</strong>, <strong>{{resume.title}}</strong>, qui pourrait correspondre aux besoins de <strong>{{client.name}}</strong>.</mj-text>
        <mj-text padding-top="20px">Vous trouverez son CV en pièce jointe (version {{resume.version}}).</mj-text>
        <mj-text padding-top="20px">Je reste à votre entière disposition pour organiser un échange ou vous fournir des informations complémentaires.</mj-text>
        <mj-text padding-top="30px">Cordialement,</mj-text>
        <mj-text padding-top="10px" font-weight="bold">{{user.name}}</mj-text>
        <mj-text color="#6b7280">{{firm.name}}</mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#f9fafb" padding="20px">
      <mj-column>
        <mj-text align="center" font-size="12px" color="#9ca3af">{{date.todayLong}}</mj-text>
        <mj-text align="center" font-size="11px" color="#9ca3af" padding-top="10px">Ce message et ses pièces jointes sont confidentiels et destinés exclusivement à leur destinataire.</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>',
    true,
    true,
    'active'
) ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- BACKUP TABLES
-- =============================================================================

-- Backup settings table
CREATE TABLE IF NOT EXISTS backup_settings (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    protocol VARCHAR(10) DEFAULT 'ftp' CHECK (protocol IN ('ftp', 'ftps', 'sftp')),
    tls_mode VARCHAR(10) DEFAULT 'explicit' CHECK (tls_mode IN ('none', 'explicit', 'implicit')),
    host VARCHAR(255),
    port INTEGER DEFAULT 21,
    username VARCHAR(255),
    password TEXT,
    remote_path VARCHAR(500) DEFAULT '/backups',
    daily_enabled BOOLEAN DEFAULT false,
    daily_time TIME DEFAULT '02:00',
    daily_retention INTEGER DEFAULT 7,
    weekly_enabled BOOLEAN DEFAULT false,
    weekly_day INTEGER DEFAULT 0 CHECK (weekly_day >= 0 AND weekly_day <= 6),
    weekly_time TIME DEFAULT '03:00',
    weekly_retention INTEGER DEFAULT 4,
    monthly_enabled BOOLEAN DEFAULT false,
    monthly_day INTEGER DEFAULT 1 CHECK (monthly_day >= 1 AND monthly_day <= 28),
    monthly_time TIME DEFAULT '04:00',
    monthly_retention INTEGER DEFAULT 12,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE backup_settings IS 'Configuration for scheduled database backups via FTP/SFTP';

-- Backup history table
CREATE TABLE IF NOT EXISTS backup_history (
    id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
    backup_type VARCHAR(20) NOT NULL CHECK (backup_type IN ('daily', 'weekly', 'monthly', 'manual')),
    filename VARCHAR(500) NOT NULL,
    file_size BIGINT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    uploaded BOOLEAN DEFAULT false
);

COMMENT ON TABLE backup_history IS 'History of database backup operations';

CREATE INDEX IF NOT EXISTS idx_backup_history_started_at ON backup_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(status);

-- Trigger for backup_settings updated_at
CREATE OR REPLACE FUNCTION update_backup_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_backup_settings_updated_at ON backup_settings;
CREATE TRIGGER trigger_backup_settings_updated_at
    BEFORE UPDATE ON backup_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_backup_settings_updated_at();

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
