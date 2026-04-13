--
-- PostgreSQL database dump
--

\restrict IPvDD9n4ZLCUk54EhDkHicSQqRMtkXwbynNeOisko3hnCYYT1TlaXdDHWB08RAI

-- Dumped from database version 18.3 (Ubuntu 18.3-1.pgdg22.04+1)
-- Dumped by pg_dump version 18.3 (Ubuntu 18.3-1.pgdg22.04+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: update_backup_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_backup_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_dpo_settings_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_dpo_settings_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: backup_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    backup_type character varying(20) NOT NULL,
    filename character varying(500) NOT NULL,
    file_size bigint,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    error_message text,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp with time zone,
    uploaded boolean DEFAULT false,
    size_bytes bigint,
    CONSTRAINT backup_history_backup_type_check CHECK (((backup_type)::text = ANY (ARRAY[('daily'::character varying)::text, ('weekly'::character varying)::text, ('monthly'::character varying)::text, ('manual'::character varying)::text]))),
    CONSTRAINT backup_history_status_check CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('running'::character varying)::text, ('success'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: TABLE backup_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.backup_history IS 'History of database backup operations';


--
-- Name: COLUMN backup_history.backup_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_history.backup_type IS 'Type of backup: daily, weekly, monthly, or manual';


--
-- Name: COLUMN backup_history.uploaded; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_history.uploaded IS 'Whether the backup was successfully uploaded to remote server';


--
-- Name: backup_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.backup_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    protocol character varying(10) DEFAULT 'ftp'::character varying,
    host character varying(255),
    port integer DEFAULT 21,
    username character varying(255),
    password text,
    remote_path character varying(500) DEFAULT '/backups'::character varying,
    daily_enabled boolean DEFAULT false,
    daily_time time without time zone DEFAULT '02:00:00'::time without time zone,
    daily_retention integer DEFAULT 7,
    weekly_enabled boolean DEFAULT false,
    weekly_day integer DEFAULT 0,
    weekly_time time without time zone DEFAULT '03:00:00'::time without time zone,
    weekly_retention integer DEFAULT 4,
    monthly_enabled boolean DEFAULT false,
    monthly_day integer DEFAULT 1,
    monthly_time time without time zone DEFAULT '04:00:00'::time without time zone,
    monthly_retention integer DEFAULT 12,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    tls_mode character varying(10) DEFAULT 'explicit'::character varying,
    backup_target character varying(10) DEFAULT 'local'::character varying,
    CONSTRAINT backup_settings_backup_target_check CHECK (((backup_target)::text = ANY ((ARRAY['local'::character varying, 'remote'::character varying])::text[]))),
    CONSTRAINT backup_settings_monthly_day_check CHECK (((monthly_day >= 1) AND (monthly_day <= 28))),
    CONSTRAINT backup_settings_protocol_check CHECK (((protocol)::text = ANY (ARRAY[('ftp'::character varying)::text, ('ftps'::character varying)::text, ('sftp'::character varying)::text]))),
    CONSTRAINT backup_settings_tls_mode_check CHECK (((tls_mode)::text = ANY (ARRAY[('none'::character varying)::text, ('explicit'::character varying)::text, ('implicit'::character varying)::text]))),
    CONSTRAINT backup_settings_weekly_day_check CHECK (((weekly_day >= 0) AND (weekly_day <= 6)))
);


--
-- Name: TABLE backup_settings; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.backup_settings IS 'Configuration for scheduled database backups via FTP/SFTP';


--
-- Name: COLUMN backup_settings.protocol; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_settings.protocol IS 'Connection protocol: ftp, ftps, or sftp';


--
-- Name: COLUMN backup_settings.weekly_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_settings.weekly_day IS 'Day of week for weekly backup: 0=Sunday, 6=Saturday';


--
-- Name: COLUMN backup_settings.monthly_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_settings.monthly_day IS 'Day of month for monthly backup (1-28)';


--
-- Name: COLUMN backup_settings.tls_mode; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.backup_settings.tls_mode IS 'TLS mode for FTP: none (plain), explicit (AUTH TLS), implicit (port 990)';


--
-- Name: batch_job_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_job_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid,
    resume_id uuid,
    file_name character varying(255),
    file_data bytea,
    file_mime_type character varying(100),
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    progress integer DEFAULT 0,
    error_message text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    original_name character varying(255),
    display_name character varying(255),
    relative_path character varying(1024),
    pending_data jsonb,
    source_type character varying(20) DEFAULT 'resume'::character varying,
    adaptation_id uuid
);


--
-- Name: batch_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.batch_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid,
    user_id uuid,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    job_type character varying(50) DEFAULT 'import'::character varying NOT NULL,
    options jsonb DEFAULT '{}'::jsonb,
    total_items integer DEFAULT 0,
    processed_items integer DEFAULT 0,
    success_count integer DEFAULT 0,
    error_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    export_file_path text,
    export_file_name text
);


--
-- Name: candidate_pipeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.candidate_pipeline (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    adaptation_id uuid,
    mission_id uuid,
    client_id uuid,
    stage character varying(50) DEFAULT 'new'::character varying NOT NULL,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    moved_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: client_contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_contacts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    client_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(255),
    email character varying(255),
    phone character varying(50),
    is_primary boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE client_contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.client_contacts IS 'Contact persons for clients/prospects';


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT clients_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text]))),
    CONSTRAINT clients_type_check CHECK (((type)::text = ANY (ARRAY[('client'::character varying)::text, ('prospect'::character varying)::text])))
);


--
-- Name: TABLE clients; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.clients IS 'Client and prospect organizations for CV submissions';


--
-- Name: deal_resumes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deal_resumes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deal_id uuid NOT NULL,
    resume_id uuid NOT NULL,
    added_by uuid NOT NULL,
    added_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    status character varying(50) DEFAULT 'proposed'::character varying
);


--
-- Name: deals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.deals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    client_id uuid,
    contact_id uuid,
    title character varying(255) NOT NULL,
    description text,
    status character varying(50) DEFAULT 'open'::character varying,
    expected_start_date date,
    expected_end_date date,
    budget_min numeric(12,2),
    budget_max numeric(12,2),
    priority character varying(20) DEFAULT 'medium'::character varying,
    tags jsonb DEFAULT '[]'::jsonb,
    notes text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: email_templates; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT email_templates_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: TABLE email_templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.email_templates IS 'Email templates with MJML content for CV submissions';


--
-- Name: firm_gdpr_mail_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firm_gdpr_mail_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    provider character varying(50) DEFAULT 'gmail'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE firm_gdpr_mail_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.firm_gdpr_mail_tokens IS 'Stores Gmail OAuth tokens for GDPR consent email sending at firm level';


--
-- Name: firms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firms (
    id uuid DEFAULT public.uuid_generate_v4() CONSTRAINT customers_id_not_null NOT NULL,
    name character varying(255) CONSTRAINT customers_name_not_null NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    credits integer DEFAULT 1000 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    logo_url text,
    logo_data bytea,
    logo_mime_type character varying(50),
    CONSTRAINT firms_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: TABLE firms; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.firms IS 'Firm organizations using the platform (formerly customers)';


--
-- Name: COLUMN firms.logo_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firms.logo_data IS 'Binary data of the firm logo';


--
-- Name: COLUMN firms.logo_mime_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.firms.logo_mime_type IS 'MIME type of the logo (e.g., image/png, image/jpeg)';


--
-- Name: firm_credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firm_credit_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    user_id uuid,
    action_type character varying(100) NOT NULL,
    credits_delta integer NOT NULL,
    balance_after integer NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    related_transaction_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT firm_credit_transactions_pkey PRIMARY KEY (id),
    CONSTRAINT firm_credit_transactions_credits_delta_check CHECK ((credits_delta <> 0))
);


--
-- Name: gdpr_audit_log; Type: TABLE; Schema: public; Owner: -
--

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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: global_gdpr_mail_token; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.global_gdpr_mail_token (
    id character varying(50) DEFAULT 'global'::character varying NOT NULL,
    provider character varying(50) DEFAULT 'gmail'::character varying NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    email character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE global_gdpr_mail_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.global_gdpr_mail_token IS 'Stores a SINGLE global Gmail OAuth token for all GDPR consent emails. Templates are still firm-specific.';


--
-- Name: industry_aliases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.industry_aliases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    canonical_name character varying(255) NOT NULL,
    alias character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE industry_aliases; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.industry_aliases IS 'Industry name mappings and aliases';


--
-- Name: llm_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.llm_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    settings_key character varying(50) DEFAULT 'default'::character varying NOT NULL,
    llm_provider character varying(20) DEFAULT 'openai'::character varying,
    llm_model character varying(100),
    ollama_base_url character varying(500) DEFAULT 'http://127.0.0.1:11434'::character varying,
    ollama_vision_model character varying(100) DEFAULT ''::character varying,
    ollama_keep_alive character varying(50) DEFAULT '5m'::character varying,
    ollama_num_ctx integer DEFAULT 8192,
    llm_availability_state jsonb DEFAULT '{}'::jsonb,
    llm_model_parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    prompt_versions jsonb DEFAULT '{}'::jsonb NOT NULL,
    analysis_prompt text,
    improvement_prompt text,
    match_analysis_prompt text,
    adaptation_prompt text,
    pre_analysis_enabled boolean DEFAULT false NOT NULL,
    pre_analysis_prompt text,
    cv_mode character varying(50) DEFAULT 'nominative'::character varying,
    chatbot_enabled character varying(10) DEFAULT 'on'::character varying,
    executive_summary_weight integer DEFAULT 20,
    skills_weight integer DEFAULT 20,
    experience_weight integer DEFAULT 20,
    education_weight integer DEFAULT 15,
    ats_weight integer DEFAULT 15,
    hobbies_languages_weight integer DEFAULT 10,
    profile_matching_local_skill_weight integer DEFAULT 6,
    profile_matching_local_tool_weight integer DEFAULT 4,
    profile_matching_local_industry_weight integer DEFAULT 3,
    profile_matching_local_softskill_weight integer DEFAULT 2,
    profile_matching_local_title_exact_weight integer DEFAULT 5,
    profile_matching_local_title_token_weight integer DEFAULT 2,
    profile_matching_local_coverage_multiplier integer DEFAULT 3,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    dpo_name character varying(255) DEFAULT ''::character varying,
    dpo_email character varying(255) DEFAULT ''::character varying,
    dpo_phone character varying(50) DEFAULT ''::character varying,
    webgl_enabled character varying(3) DEFAULT 'on'::character varying,
    firm_initial_credits integer DEFAULT 1000 NOT NULL,
    ai_credit_chatbot_message integer DEFAULT 1 NOT NULL,
    ai_credit_resume_ai_modify integer DEFAULT 5 NOT NULL,
    ai_credit_template_extract integer DEFAULT 15 NOT NULL,
    ai_credit_resume_analysis integer DEFAULT 25 NOT NULL,
    ai_credit_resume_improvement integer DEFAULT 75 NOT NULL,
    ai_credit_resume_adaptation integer DEFAULT 50 NOT NULL,
    ai_credit_resume_match integer DEFAULT 8 NOT NULL,
    ai_credit_profile_search integer DEFAULT 12 NOT NULL,
    ai_credit_profile_analysis integer DEFAULT 25 NOT NULL,
    ai_max_tokens_chatbot_message integer DEFAULT 4000 NOT NULL,
    ai_max_tokens_resume_ai_modify integer DEFAULT 8192 NOT NULL,
    ai_max_tokens_template_extract integer DEFAULT 32000 NOT NULL,
    ai_max_tokens_resume_analysis integer DEFAULT 16000 NOT NULL,
    ai_max_tokens_resume_improvement integer DEFAULT 16384 NOT NULL,
    ai_max_tokens_resume_adaptation integer DEFAULT 8192 NOT NULL,
    ai_max_tokens_resume_match integer DEFAULT 4096 NOT NULL,
    ai_max_tokens_profile_search integer DEFAULT 2048 NOT NULL,
    ai_max_tokens_profile_analysis integer DEFAULT 3072 NOT NULL,
    CONSTRAINT llm_settings_ats_weight_check CHECK (((ats_weight >= 0) AND (ats_weight <= 100))),
    CONSTRAINT llm_settings_ai_credit_chatbot_message_check CHECK ((ai_credit_chatbot_message >= 0)),
    CONSTRAINT llm_settings_ai_credit_profile_analysis_check CHECK ((ai_credit_profile_analysis >= 0)),
    CONSTRAINT llm_settings_ai_credit_profile_search_check CHECK ((ai_credit_profile_search >= 0)),
    CONSTRAINT llm_settings_ai_credit_resume_adaptation_check CHECK ((ai_credit_resume_adaptation >= 0)),
    CONSTRAINT llm_settings_ai_credit_resume_ai_modify_check CHECK ((ai_credit_resume_ai_modify >= 0)),
    CONSTRAINT llm_settings_ai_credit_resume_analysis_check CHECK ((ai_credit_resume_analysis >= 0)),
    CONSTRAINT llm_settings_ai_credit_resume_improvement_check CHECK ((ai_credit_resume_improvement >= 0)),
    CONSTRAINT llm_settings_ai_credit_resume_match_check CHECK ((ai_credit_resume_match >= 0)),
    CONSTRAINT llm_settings_ai_credit_template_extract_check CHECK ((ai_credit_template_extract >= 0)),
    CONSTRAINT llm_settings_ai_max_tokens_chatbot_message_check CHECK ((ai_max_tokens_chatbot_message >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_profile_analysis_check CHECK ((ai_max_tokens_profile_analysis >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_profile_search_check CHECK ((ai_max_tokens_profile_search >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_resume_adaptation_check CHECK ((ai_max_tokens_resume_adaptation >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_resume_ai_modify_check CHECK ((ai_max_tokens_resume_ai_modify >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_resume_analysis_check CHECK ((ai_max_tokens_resume_analysis >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_resume_improvement_check CHECK ((ai_max_tokens_resume_improvement >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_resume_match_check CHECK ((ai_max_tokens_resume_match >= 1)),
    CONSTRAINT llm_settings_ai_max_tokens_template_extract_check CHECK ((ai_max_tokens_template_extract >= 1)),
    CONSTRAINT llm_settings_chatbot_enabled_check CHECK (((chatbot_enabled)::text = ANY (ARRAY[('on'::character varying)::text, ('off'::character varying)::text]))),
    CONSTRAINT llm_settings_cv_mode_check CHECK (((cv_mode)::text = ANY (ARRAY[('nominative'::character varying)::text, ('anonymous'::character varying)::text]))),
    CONSTRAINT llm_settings_education_weight_check CHECK (((education_weight >= 0) AND (education_weight <= 100))),
    CONSTRAINT llm_settings_executive_summary_weight_check CHECK (((executive_summary_weight >= 0) AND (executive_summary_weight <= 100))),
    CONSTRAINT llm_settings_experience_weight_check CHECK (((experience_weight >= 0) AND (experience_weight <= 100))),
    CONSTRAINT llm_settings_firm_initial_credits_check CHECK ((firm_initial_credits >= 0)),
    CONSTRAINT llm_settings_hobbies_languages_weight_check CHECK (((hobbies_languages_weight >= 0) AND (hobbies_languages_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_coverage_multiplier_check CHECK (((profile_matching_local_coverage_multiplier >= 0) AND (profile_matching_local_coverage_multiplier <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_industry_weight_check CHECK (((profile_matching_local_industry_weight >= 0) AND (profile_matching_local_industry_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_skill_weight_check CHECK (((profile_matching_local_skill_weight >= 0) AND (profile_matching_local_skill_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_softskill_weight_check CHECK (((profile_matching_local_softskill_weight >= 0) AND (profile_matching_local_softskill_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_title_exact_weight_check CHECK (((profile_matching_local_title_exact_weight >= 0) AND (profile_matching_local_title_exact_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_title_token_weight_check CHECK (((profile_matching_local_title_token_weight >= 0) AND (profile_matching_local_title_token_weight <= 100))),
    CONSTRAINT llm_settings_profile_matching_local_tool_weight_check CHECK (((profile_matching_local_tool_weight >= 0) AND (profile_matching_local_tool_weight <= 100))),
    CONSTRAINT llm_settings_llm_provider_check CHECK (((llm_provider)::text = ANY (ARRAY[('openai'::character varying)::text, ('anthropic'::character varying)::text, ('huggingface'::character varying)::text, ('gemma'::character varying)::text, ('deepseek'::character varying)::text, ('glm'::character varying)::text, ('minimax'::character varying)::text, ('ollama'::character varying)::text]))),
    CONSTRAINT llm_settings_webgl_enabled_check CHECK (((webgl_enabled)::text = ANY (ARRAY[('on'::character varying)::text, ('off'::character varying)::text]))),
    CONSTRAINT llm_settings_skills_weight_check CHECK (((skills_weight >= 0) AND (skills_weight <= 100))),
    CONSTRAINT llm_settings_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: market_facts; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT market_facts_source_check CHECK (((source)::text = ANY (ARRAY[('france_travail'::character varying)::text, ('adzuna'::character varying)::text])))
);


--
-- Name: TABLE market_facts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.market_facts IS 'Market radar job statistics from various sources';


--
-- Name: market_trends; Type: TABLE; Schema: public; Owner: -
--

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
    previous_value numeric(15,2)
);


--
-- Name: TABLE market_trends; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.market_trends IS 'Detailed market trends from France Travail API';


--
-- Name: COLUMN market_trends.collected_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_trends.collected_at IS 'Timestamp when data was collected from API';


--
-- Name: COLUMN market_trends.api_endpoint; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_trends.api_endpoint IS 'API endpoint used for collection (e.g., stat-offres, stat-embauches)';


--
-- Name: COLUMN market_trends.quarter_period; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_trends.quarter_period IS 'Quarter period covered by the data (e.g., Q4 2025)';


--
-- Name: COLUMN market_trends.api_response_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_trends.api_response_hash IS 'MD5 hash of raw API response for verification';


--
-- Name: COLUMN market_trends.previous_value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.market_trends.previous_value IS 'Previous value before update, for change tracking';


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

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
    deal_id uuid
);


--
-- Name: TABLE missions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.missions IS 'Job missions/offers for resume adaptation';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE password_reset_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.password_reset_tokens IS 'Password reset tokens for forgot password flow';


--
-- Name: COLUMN password_reset_tokens.token_hash; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.password_reset_tokens.token_hash IS 'SHA-256 hash of the reset token (plain token sent via email)';


--
-- Name: COLUMN password_reset_tokens.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.password_reset_tokens.expires_at IS 'Token expiry (1 hour after creation)';


--
-- Name: COLUMN password_reset_tokens.used_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.password_reset_tokens.used_at IS 'Timestamp when token was used (one-time use)';


--
-- Name: pipeline_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pipeline_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    from_stage character varying(50),
    to_stage character varying(50) NOT NULL,
    changed_by uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: pipeline_interviews; Type: TABLE; Schema: public; Owner: -
--

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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: resume_adaptations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_adaptations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resume_id uuid,
    mission_id uuid,
    resume_name character varying(255),
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
    candidate_name character varying(255),
    adapted_title character varying(500),
    CONSTRAINT resume_adaptations_status_check CHECK (((status)::text = ANY (ARRAY[('draft'::character varying)::text, ('processing'::character varying)::text, ('completed'::character varying)::text, ('final'::character varying)::text, ('sent'::character varying)::text, ('archived'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: TABLE resume_adaptations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resume_adaptations IS 'Adapted resumes tailored to specific missions';


--
-- Name: resume_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.resume_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    resume_id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_name character varying(255) NOT NULL,
    content text NOT NULL,
    is_private boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: resume_submissions; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT resume_submissions_status_check CHECK (((status)::text = ANY (ARRAY[('sent'::character varying)::text, ('viewed'::character varying)::text, ('rejected'::character varying)::text, ('accepted'::character varying)::text, ('pending'::character varying)::text])))
);


--
-- Name: TABLE resume_submissions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resume_submissions IS 'History of CV submissions to clients/prospects';


--
-- Name: resume_versions; Type: TABLE; Schema: public; Owner: -
--

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
    change_reason character varying(255)
);


--
-- Name: TABLE resume_versions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resume_versions IS 'Historical versions of improved CV text with associated scores and tags';


--
-- Name: COLUMN resume_versions.version_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.resume_versions.version_number IS 'Sequential version number starting from 1';


--
-- Name: COLUMN resume_versions.change_reason; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.resume_versions.change_reason IS 'Reason for version creation: initial_improvement, manual_edit, restore';


--
-- Name: resumes; Type: TABLE; Schema: public; Owner: -
--

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
    shared_pdf_expires_at timestamp with time zone,
    shared_file_token character varying(64),
    shared_file_expires_at timestamp with time zone,
    relative_path character varying(1024),
    CONSTRAINT resumes_consent_status_check CHECK (((consent_status)::text = ANY (ARRAY[('not_required'::character varying)::text, ('pending_consent'::character varying)::text, ('active'::character varying)::text, ('refused'::character varying)::text, ('expired'::character varying)::text, ('purged'::character varying)::text, ('error'::character varying)::text]))),
    CONSTRAINT resumes_profile_type_check CHECK (((profile_type)::text = ANY (ARRAY[('employee'::character varying)::text, ('external'::character varying)::text]))),
    CONSTRAINT resumes_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('archived'::character varying)::text, ('new'::character varying)::text, ('pending'::character varying)::text, ('processing'::character varying)::text, ('analyzed'::character varying)::text, ('improved'::character varying)::text, ('error'::character varying)::text, ('failed'::character varying)::text])))
);


--
-- Name: TABLE resumes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.resumes IS 'Resume documents with analysis and extracted data';


--
-- Name: COLUMN resumes.current_version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.resumes.current_version IS 'Current version number of the improved text (0 if no improved version exists)';


--
-- Name: CONSTRAINT resumes_consent_status_check ON resumes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON CONSTRAINT resumes_consent_status_check ON public.resumes IS 'Valid consent statuses: not_required, pending_consent, active, refused, expired, purged, error';


--
-- Name: skill_evidence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_evidence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    candidate_id uuid NOT NULL,
    skill_id uuid NOT NULL,
    analysis_phase character varying(20) DEFAULT 'initial'::character varying NOT NULL,
    evidence_score numeric(6,4),
    confidence numeric(6,4),
    duration_months integer,
    recency_score numeric(6,4),
    depth_score numeric(6,4),
    diversity_score numeric(6,4),
    proof_level character varying(20),
    proof_score numeric(6,4),
    occurrence_count_estimate integer,
    context_count_estimate integer,
    justification text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skill_evidence_pkey PRIMARY KEY (id),
    CONSTRAINT skill_evidence_analysis_phase_check CHECK (((analysis_phase)::text = ANY ((ARRAY['initial'::character varying, 'improved'::character varying])::text[]))),
    CONSTRAINT skill_evidence_proof_level_check CHECK (((proof_level IS NULL) OR ((proof_level)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))))
);


--
-- Name: skill_occurrences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skill_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_evidence_id uuid NOT NULL,
    source_type character varying(50),
    project_name character varying(255),
    duration_months integer,
    context text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skill_occurrences_pkey PRIMARY KEY (id)
);


--
-- Name: skills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    normalized_name character varying(255) NOT NULL,
    category character varying(30) DEFAULT 'skill'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skills_pkey PRIMARY KEY (id),
    CONSTRAINT skills_category_check CHECK (((category)::text = ANY ((ARRAY['skill'::character varying, 'tool'::character varying, 'soft_skill'::character varying])::text[])))
);


--
-- Name: rome_metiers; Type: TABLE; Schema: public; Owner: -
--

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
    savoirs jsonb
);


--
-- Name: TABLE rome_metiers; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.rome_metiers IS 'ROME 4.0 French job classification system';


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    id integer NOT NULL,
    migration_name character varying(255) NOT NULL,
    applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.schema_migrations IS 'Tracks applied database migrations';


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schema_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schema_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schema_migrations_id_seq OWNED BY public.schema_migrations.id;


--
-- Name: templates; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT templates_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text])))
);


--
-- Name: TABLE templates; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.templates IS 'Resume templates with HTML/CSS styling';


--
-- Name: COLUMN templates.firm_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.templates.firm_id IS 'Optional firm association - NULL means global template visible to all';


--
-- Name: token_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.token_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token_jti text NOT NULL,
    user_id uuid,
    reason text DEFAULT 'logout'::text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE token_blacklist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.token_blacklist IS 'Blacklisted JWT tokens for immediate revocation';


--
-- Name: COLUMN token_blacklist.token_jti; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.token_blacklist.token_jti IS 'JWT token ID (jti claim)';


--
-- Name: COLUMN token_blacklist.expires_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.token_blacklist.expires_at IS 'Token expiration time - used for cleanup';


--
-- Name: user_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_blacklist (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    reason text DEFAULT 'account_deactivated'::text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: TABLE user_blacklist; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_blacklist IS 'Blacklisted users - all their tokens are invalid';


--
-- Name: user_calendar_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_calendar_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text,
    token_expiry timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_mail_tokens; Type: TABLE; Schema: public; Owner: -
--

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
    CONSTRAINT user_mail_tokens_provider_check CHECK (((provider)::text = ANY (ARRAY[('gmail'::character varying)::text, ('outlook'::character varying)::text])))
);


--
-- Name: TABLE user_mail_tokens; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_mail_tokens IS 'Encrypted OAuth tokens for email providers (Gmail, Outlook)';


--
-- Name: COLUMN user_mail_tokens.access_token_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_mail_tokens.access_token_encrypted IS 'AES-256 encrypted access token';


--
-- Name: COLUMN user_mail_tokens.refresh_token_encrypted; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_mail_tokens.refresh_token_encrypted IS 'AES-256 encrypted refresh token';


--
-- Name: COLUMN user_mail_tokens.token_expiry; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_mail_tokens.token_expiry IS 'Token expiration timestamp';


--
-- Name: COLUMN user_mail_tokens.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_mail_tokens.email IS 'Email address associated with the OAuth account';


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

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
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY (ARRAY[('admin'::character varying)::text, ('localAdmin'::character varying)::text, ('user'::character varying)::text]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('pending'::character varying)::text])))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'User accounts with authentication and role-based access';


--
-- Name: COLUMN users.google_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.google_id IS 'Google account ID for OAuth authentication';


--
-- Name: COLUMN users.google_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.google_email IS 'Email from Google account (may differ from login email)';


--
-- Name: COLUMN users.google_linked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.google_linked_at IS 'Timestamp when Google account was linked';


--
-- Name: v_active_missions; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: v_active_resumes; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: v_adaptations_full; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: v_clients_with_contacts; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: VIEW v_clients_with_contacts; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_clients_with_contacts IS 'Clients with contact and submission counts';


--
-- Name: v_resume_submissions_full; Type: VIEW; Schema: public; Owner: -
--

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


--
-- Name: VIEW v_resume_submissions_full; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.v_resume_submissions_full IS 'Full view of resume submissions with related entity names and version number';


--
-- Name: schema_migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations ALTER COLUMN id SET DEFAULT nextval('public.schema_migrations_id_seq'::regclass);


--
-- Name: backup_history backup_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_history
    ADD CONSTRAINT backup_history_pkey PRIMARY KEY (id);


--
-- Name: backup_settings backup_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.backup_settings
    ADD CONSTRAINT backup_settings_pkey PRIMARY KEY (id);


--
-- Name: batch_job_items batch_job_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_job_items
    ADD CONSTRAINT batch_job_items_pkey PRIMARY KEY (id);


--
-- Name: batch_jobs batch_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_jobs
    ADD CONSTRAINT batch_jobs_pkey PRIMARY KEY (id);


--
-- Name: candidate_pipeline candidate_pipeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_pkey PRIMARY KEY (id);


--
-- Name: candidate_pipeline candidate_pipeline_resume_id_mission_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_resume_id_mission_id_key UNIQUE (resume_id, mission_id);


--
-- Name: client_contacts client_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: deal_resumes deal_resumes_deal_id_resume_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_resumes
    ADD CONSTRAINT deal_resumes_deal_id_resume_id_key UNIQUE (deal_id, resume_id);


--
-- Name: deal_resumes deal_resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_resumes
    ADD CONSTRAINT deal_resumes_pkey PRIMARY KEY (id);


--
-- Name: deals deals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_pkey PRIMARY KEY (id);


--
-- Name: email_templates email_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_pkey PRIMARY KEY (id);


--
-- Name: firm_gdpr_mail_tokens firm_gdpr_mail_tokens_firm_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_gdpr_mail_tokens
    ADD CONSTRAINT firm_gdpr_mail_tokens_firm_id_key UNIQUE (firm_id);


--
-- Name: firm_gdpr_mail_tokens firm_gdpr_mail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_gdpr_mail_tokens
    ADD CONSTRAINT firm_gdpr_mail_tokens_pkey PRIMARY KEY (id);


--
-- Name: firms firms_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firms
    ADD CONSTRAINT firms_name_key UNIQUE (name);


--
-- Name: firms firms_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firms
    ADD CONSTRAINT firms_pkey PRIMARY KEY (id);


--
-- Name: gdpr_audit_log gdpr_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gdpr_audit_log
    ADD CONSTRAINT gdpr_audit_log_pkey PRIMARY KEY (id);


--
-- Name: global_gdpr_mail_token global_gdpr_mail_token_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.global_gdpr_mail_token
    ADD CONSTRAINT global_gdpr_mail_token_pkey PRIMARY KEY (id);


--
-- Name: industry_aliases industry_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.industry_aliases
    ADD CONSTRAINT industry_aliases_pkey PRIMARY KEY (id);


--
-- Name: llm_settings llm_settings_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_settings
    ADD CONSTRAINT llm_settings_name_key UNIQUE (name);


--
-- Name: llm_settings llm_settings_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_settings
    ADD CONSTRAINT llm_settings_settings_key_key UNIQUE (settings_key);


--
-- Name: llm_settings llm_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.llm_settings
    ADD CONSTRAINT llm_settings_pkey PRIMARY KEY (id);


--
-- Name: market_facts market_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_facts
    ADD CONSTRAINT market_facts_pkey PRIMARY KEY (id);


--
-- Name: market_trends market_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.market_trends
    ADD CONSTRAINT market_trends_pkey PRIMARY KEY (id);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_hash_key UNIQUE (token_hash);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: pipeline_history pipeline_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_history
    ADD CONSTRAINT pipeline_history_pkey PRIMARY KEY (id);


--
-- Name: pipeline_interviews pipeline_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_interviews
    ADD CONSTRAINT pipeline_interviews_pkey PRIMARY KEY (id);


--
-- Name: resume_adaptations resume_adaptations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_pkey PRIMARY KEY (id);


--
-- Name: resume_comments resume_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_comments
    ADD CONSTRAINT resume_comments_pkey PRIMARY KEY (id);


--
-- Name: resume_submissions resume_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_pkey PRIMARY KEY (id);


--
-- Name: resume_versions resume_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_pkey PRIMARY KEY (id);


--
-- Name: resumes resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (id);


--
-- Name: rome_metiers rome_metiers_code_rome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rome_metiers
    ADD CONSTRAINT rome_metiers_code_rome_key UNIQUE (code_rome);


--
-- Name: rome_metiers rome_metiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rome_metiers
    ADD CONSTRAINT rome_metiers_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_migration_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_migration_name_key UNIQUE (migration_name);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: token_blacklist token_blacklist_jti_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_jti_key UNIQUE (token_jti);


--
-- Name: token_blacklist token_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.token_blacklist
    ADD CONSTRAINT token_blacklist_pkey PRIMARY KEY (id);


--
-- Name: resume_versions unique_resume_version; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT unique_resume_version UNIQUE (resume_id, version_number);


--
-- Name: user_blacklist user_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_pkey PRIMARY KEY (id);


--
-- Name: user_blacklist user_blacklist_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_user_id_key UNIQUE (user_id);


--
-- Name: user_calendar_tokens user_calendar_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendar_tokens
    ADD CONSTRAINT user_calendar_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_calendar_tokens user_calendar_tokens_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendar_tokens
    ADD CONSTRAINT user_calendar_tokens_user_id_key UNIQUE (user_id);


--
-- Name: user_mail_tokens user_mail_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mail_tokens
    ADD CONSTRAINT user_mail_tokens_pkey PRIMARY KEY (id);


--
-- Name: user_mail_tokens user_mail_tokens_unique_user_provider; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mail_tokens
    ADD CONSTRAINT user_mail_tokens_unique_user_provider UNIQUE (user_id, provider);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_adaptations_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptations_created_at ON public.resume_adaptations USING btree (created_at DESC);


--
-- Name: idx_adaptations_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptations_firm_id ON public.resume_adaptations USING btree (firm_id);


--
-- Name: idx_adaptations_mission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptations_mission_id ON public.resume_adaptations USING btree (mission_id);


--
-- Name: idx_adaptations_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptations_resume_id ON public.resume_adaptations USING btree (resume_id);


--
-- Name: idx_adaptations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adaptations_status ON public.resume_adaptations USING btree (status);


--
-- Name: idx_backup_history_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_history_started_at ON public.backup_history USING btree (started_at DESC);


--
-- Name: idx_backup_history_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_backup_history_status ON public.backup_history USING btree (status);


--
-- Name: idx_batch_job_items_job_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_job_items_job_id ON public.batch_job_items USING btree (job_id);


--
-- Name: idx_batch_job_items_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_job_items_status ON public.batch_job_items USING btree (status);


--
-- Name: idx_batch_jobs_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_jobs_firm_id ON public.batch_jobs USING btree (firm_id);


--
-- Name: idx_batch_jobs_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_jobs_status ON public.batch_jobs USING btree (status);


--
-- Name: idx_batch_jobs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_batch_jobs_user_id ON public.batch_jobs USING btree (user_id);


--
-- Name: idx_candidate_pipeline_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_client_id ON public.candidate_pipeline USING btree (client_id);


--
-- Name: idx_candidate_pipeline_adaptation_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_adaptation_id ON public.candidate_pipeline USING btree (adaptation_id);


--
-- Name: idx_candidate_pipeline_mission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_mission_id ON public.candidate_pipeline USING btree (mission_id);


--
-- Name: idx_candidate_pipeline_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_resume_id ON public.candidate_pipeline USING btree (resume_id);


--
-- Name: idx_candidate_pipeline_stage; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_candidate_pipeline_stage ON public.candidate_pipeline USING btree (stage);


--
-- Name: idx_client_contacts_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_contacts_client_id ON public.client_contacts USING btree (client_id);


--
-- Name: idx_clients_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_firm_id ON public.clients USING btree (firm_id);


--
-- Name: idx_clients_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_name ON public.clients USING btree (name);


--
-- Name: idx_clients_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_clients_type ON public.clients USING btree (type);


--
-- Name: idx_deal_resumes_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_resumes_deal_id ON public.deal_resumes USING btree (deal_id);


--
-- Name: idx_deal_resumes_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deal_resumes_resume_id ON public.deal_resumes USING btree (resume_id);


--
-- Name: idx_deals_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_client_id ON public.deals USING btree (client_id);


--
-- Name: idx_deals_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_firm_id ON public.deals USING btree (firm_id);


--
-- Name: idx_deals_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_priority ON public.deals USING btree (priority);


--
-- Name: idx_deals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_deals_status ON public.deals USING btree (status);


--
-- Name: idx_email_templates_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_firm_id ON public.email_templates USING btree (firm_id);


--
-- Name: idx_email_templates_is_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_is_system ON public.email_templates USING btree (is_system);


--
-- Name: idx_email_templates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_email_templates_status ON public.email_templates USING btree (status);


--
-- Name: idx_firm_gdpr_mail_tokens_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firm_gdpr_mail_tokens_firm_id ON public.firm_gdpr_mail_tokens USING btree (firm_id);


--
-- Name: idx_firms_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firms_name ON public.firms USING btree (name);


--
-- Name: idx_firm_credit_transactions_action_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firm_credit_transactions_action_type ON public.firm_credit_transactions USING btree (action_type);


--
-- Name: idx_firm_credit_transactions_firm_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firm_credit_transactions_firm_created_at ON public.firm_credit_transactions USING btree (firm_id, created_at DESC);


--
-- Name: idx_firm_credit_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firm_credit_transactions_user_id ON public.firm_credit_transactions USING btree (user_id);


--
-- Name: idx_firms_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_firms_status ON public.firms USING btree (status);


--
-- Name: idx_gdpr_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_action ON public.gdpr_audit_log USING btree (action);


--
-- Name: idx_gdpr_audit_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_category ON public.gdpr_audit_log USING btree (category);


--
-- Name: idx_gdpr_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_created_at ON public.gdpr_audit_log USING btree (created_at DESC);


--
-- Name: idx_gdpr_audit_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_firm_id ON public.gdpr_audit_log USING btree (firm_id);


--
-- Name: idx_gdpr_audit_is_automated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_is_automated ON public.gdpr_audit_log USING btree (is_automated);


--
-- Name: idx_gdpr_audit_target_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gdpr_audit_target_email ON public.gdpr_audit_log USING btree (target_email);


--
-- Name: idx_industry_aliases_alias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_industry_aliases_alias ON public.industry_aliases USING btree (alias);


--
-- Name: idx_industry_aliases_canonical; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_industry_aliases_canonical ON public.industry_aliases USING btree (canonical_name);


--
-- Name: idx_industry_aliases_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_industry_aliases_unique ON public.industry_aliases USING btree (canonical_name, alias);


--
-- Name: idx_llm_settings_cv_mode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_settings_cv_mode ON public.llm_settings USING btree (cv_mode);


--
-- Name: idx_llm_settings_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_settings_name ON public.llm_settings USING btree (name);


--
-- Name: idx_llm_settings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_llm_settings_status ON public.llm_settings USING btree (status);


--
-- Name: idx_market_facts_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_facts_date ON public.market_facts USING btree (date DESC);


--
-- Name: idx_market_facts_job_count; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_facts_job_count ON public.market_facts USING btree (job_count DESC);


--
-- Name: idx_market_facts_keyword; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_facts_keyword ON public.market_facts USING btree (keyword);


--
-- Name: idx_market_facts_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_facts_location ON public.market_facts USING btree (location);


--
-- Name: idx_market_facts_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_facts_source ON public.market_facts USING btree (source);


--
-- Name: idx_market_facts_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_market_facts_unique ON public.market_facts USING btree (keyword, location, source, date);


--
-- Name: idx_market_trends_audit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_audit ON public.market_trends USING btree (type, region_code, code_rome, collected_at DESC);


--
-- Name: idx_market_trends_code_rome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_code_rome ON public.market_trends USING btree (code_rome);


--
-- Name: idx_market_trends_collected_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_collected_at ON public.market_trends USING btree (collected_at DESC);


--
-- Name: idx_market_trends_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_date ON public.market_trends USING btree (date DESC);


--
-- Name: idx_market_trends_metadata; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_metadata ON public.market_trends USING gin (metadata);


--
-- Name: idx_market_trends_region_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_region_code ON public.market_trends USING btree (region_code);


--
-- Name: idx_market_trends_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_market_trends_type ON public.market_trends USING btree (type);


--
-- Name: idx_market_trends_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_market_trends_unique ON public.market_trends USING btree (type, code_rome, region_code);


--
-- Name: idx_missions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_client_id ON public.missions USING btree (client_id);


--
-- Name: idx_missions_contact_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_contact_id ON public.missions USING btree (contact_id);


--
-- Name: idx_missions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_created_at ON public.missions USING btree (created_at DESC);


--
-- Name: idx_missions_deal_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_deal_id ON public.missions USING btree (deal_id);


--
-- Name: idx_missions_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_firm_id ON public.missions USING btree (firm_id);


--
-- Name: idx_missions_keywords; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_keywords ON public.missions USING gin (keywords);


--
-- Name: idx_missions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_status ON public.missions USING btree (status);


--
-- Name: idx_missions_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_missions_title ON public.missions USING btree (title);


--
-- Name: idx_password_reset_tokens_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens USING btree (expires_at);


--
-- Name: idx_password_reset_tokens_hash; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_hash ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_tokens_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_password_reset_tokens_user ON public.password_reset_tokens USING btree (user_id);


--
-- Name: idx_pipeline_history_pipeline_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_history_pipeline_id ON public.pipeline_history USING btree (pipeline_id);


--
-- Name: idx_pipeline_interviews_pipeline_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_interviews_pipeline_id ON public.pipeline_interviews USING btree (pipeline_id);


--
-- Name: idx_pipeline_interviews_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pipeline_interviews_scheduled_at ON public.pipeline_interviews USING btree (scheduled_at);


--
-- Name: idx_resume_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_comments_created_at ON public.resume_comments USING btree (created_at DESC);


--
-- Name: idx_resume_comments_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_comments_resume_id ON public.resume_comments USING btree (resume_id);


--
-- Name: idx_resume_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_comments_user_id ON public.resume_comments USING btree (user_id);


--
-- Name: idx_resume_submissions_client_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_submissions_client_id ON public.resume_submissions USING btree (client_id);


--
-- Name: idx_resume_submissions_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_submissions_firm_id ON public.resume_submissions USING btree (firm_id);


--
-- Name: idx_resume_submissions_mission_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_submissions_mission_id ON public.resume_submissions USING btree (mission_id);


--
-- Name: idx_resume_submissions_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_submissions_resume_id ON public.resume_submissions USING btree (resume_id);


--
-- Name: idx_resume_submissions_sent_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_submissions_sent_at ON public.resume_submissions USING btree (sent_at DESC);


--
-- Name: idx_resume_versions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_versions_created_at ON public.resume_versions USING btree (created_at DESC);


--
-- Name: idx_resume_versions_resume_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_versions_resume_id ON public.resume_versions USING btree (resume_id);


--
-- Name: idx_resume_versions_version_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resume_versions_version_number ON public.resume_versions USING btree (resume_id, version_number DESC);


--
-- Name: idx_resumes_consent_requested_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_consent_requested_at ON public.resumes USING btree (consent_requested_at) WHERE (consent_requested_at IS NOT NULL);


--
-- Name: idx_resumes_consent_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_consent_status ON public.resumes USING btree (consent_status);


--
-- Name: idx_resumes_consent_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_consent_token ON public.resumes USING btree (consent_token) WHERE (consent_token IS NOT NULL);


--
-- Name: idx_resumes_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_created_at ON public.resumes USING btree (created_at DESC);


--
-- Name: idx_resumes_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_firm_id ON public.resumes USING btree (firm_id);


--
-- Name: idx_resumes_industries; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_industries ON public.resumes USING gin (industries);


--
-- Name: idx_resumes_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_name ON public.resumes USING btree (name);


--
-- Name: idx_resumes_profile_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_profile_type ON public.resumes USING btree (profile_type);


--
-- Name: idx_resumes_retention_until; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_retention_until ON public.resumes USING btree (retention_until) WHERE (retention_until IS NOT NULL);


--
-- Name: idx_resumes_shared_pdf_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_shared_pdf_token ON public.resumes USING btree (shared_pdf_token) WHERE (shared_pdf_token IS NOT NULL);

--
-- Name: idx_resumes_shared_file_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_shared_file_token ON public.resumes USING btree (shared_file_token) WHERE (shared_file_token IS NOT NULL);


--
-- Name: idx_resumes_skills; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_skills ON public.resumes USING gin (skills);


--
-- Name: idx_resumes_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_status ON public.resumes USING btree (status);


--
-- Name: idx_resumes_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_resumes_title ON public.resumes USING btree (title);


--
-- Name: idx_skill_evidence_candidate_phase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_evidence_candidate_phase ON public.skill_evidence USING btree (candidate_id, analysis_phase);


--
-- Name: idx_skill_evidence_candidate_skill_phase_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_skill_evidence_candidate_skill_phase_unique ON public.skill_evidence USING btree (candidate_id, skill_id, analysis_phase);


--
-- Name: idx_skill_evidence_skill_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_evidence_skill_id ON public.skill_evidence USING btree (skill_id);


--
-- Name: idx_skill_occurrences_skill_evidence_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_skill_occurrences_skill_evidence_id ON public.skill_occurrences USING btree (skill_evidence_id);


--
-- Name: idx_skills_normalized_category_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_skills_normalized_category_unique ON public.skills USING btree (normalized_name, category);


--
-- Name: idx_rome_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rome_code ON public.rome_metiers USING btree (code_rome);


--
-- Name: idx_rome_competences; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rome_competences ON public.rome_metiers USING gin (competences);


--
-- Name: idx_rome_domaine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rome_domaine ON public.rome_metiers USING btree (code_domaine_professionnel);


--
-- Name: idx_rome_grand_domaine; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rome_grand_domaine ON public.rome_metiers USING btree (code_grand_domaine);


--
-- Name: idx_rome_libelle; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rome_libelle ON public.rome_metiers USING btree (libelle);


--
-- Name: idx_templates_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_firm_id ON public.templates USING btree (firm_id);


--
-- Name: idx_templates_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_name ON public.templates USING btree (name);


--
-- Name: idx_templates_name_firm_id_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_templates_name_firm_id_unique ON public.templates USING btree (name, firm_id) WHERE (firm_id IS NOT NULL);


--
-- Name: idx_templates_name_global_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_templates_name_global_unique ON public.templates USING btree (name) WHERE (firm_id IS NULL);


--
-- Name: idx_templates_popular; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_popular ON public.templates USING btree (popular);


--
-- Name: idx_templates_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_status ON public.templates USING btree (status);


--
-- Name: idx_templates_tags; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_templates_tags ON public.templates USING gin (tags);


--
-- Name: idx_token_blacklist_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_blacklist_expires ON public.token_blacklist USING btree (expires_at);


--
-- Name: idx_token_blacklist_jti; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_token_blacklist_jti ON public.token_blacklist USING btree (token_jti);


--
-- Name: idx_user_blacklist_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_blacklist_user_id ON public.user_blacklist USING btree (user_id);


--
-- Name: idx_user_calendar_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_calendar_tokens_user_id ON public.user_calendar_tokens USING btree (user_id);


--
-- Name: idx_user_mail_tokens_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_mail_tokens_user_id ON public.user_mail_tokens USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_firm_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_firm_id ON public.users USING btree (firm_id);


--
-- Name: idx_users_google_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_users_google_id ON public.users USING btree (google_id) WHERE (google_id IS NOT NULL);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- Name: idx_users_totp_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_totp_enabled ON public.users USING btree (totp_enabled) WHERE (totp_enabled = true);


--
-- Name: backup_settings trigger_backup_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_backup_settings_updated_at BEFORE UPDATE ON public.backup_settings FOR EACH ROW EXECUTE FUNCTION public.update_backup_settings_updated_at();


--
-- Name: client_contacts update_client_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: clients update_clients_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: firms update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.firms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_templates update_email_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_email_templates_updated_at BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: firm_gdpr_mail_tokens update_firm_gdpr_mail_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_firm_gdpr_mail_tokens_updated_at BEFORE UPDATE ON public.firm_gdpr_mail_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: global_gdpr_mail_token update_global_gdpr_mail_token_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_global_gdpr_mail_token_updated_at BEFORE UPDATE ON public.global_gdpr_mail_token FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: llm_settings update_llm_settings_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_llm_settings_updated_at BEFORE UPDATE ON public.llm_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: market_facts update_market_facts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_market_facts_updated_at BEFORE UPDATE ON public.market_facts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: market_trends update_market_trends_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_market_trends_updated_at BEFORE UPDATE ON public.market_trends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: missions update_missions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resume_adaptations update_resume_adaptations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_resume_adaptations_updated_at BEFORE UPDATE ON public.resume_adaptations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: resumes update_resumes_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: rome_metiers update_rome_metiers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_rome_metiers_updated_at BEFORE UPDATE ON public.rome_metiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: templates update_templates_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: user_mail_tokens update_user_mail_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_mail_tokens_updated_at BEFORE UPDATE ON public.user_mail_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: batch_job_items batch_job_items_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_job_items
    ADD CONSTRAINT batch_job_items_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.batch_jobs(id) ON DELETE CASCADE;


--
-- Name: batch_job_items batch_job_items_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_job_items
    ADD CONSTRAINT batch_job_items_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE SET NULL;


--
-- Name: batch_jobs batch_jobs_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_jobs
    ADD CONSTRAINT batch_jobs_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: batch_jobs batch_jobs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.batch_jobs
    ADD CONSTRAINT batch_jobs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: candidate_pipeline candidate_pipeline_adaptation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_adaptation_id_fkey FOREIGN KEY (adaptation_id) REFERENCES public.resume_adaptations(id) ON DELETE SET NULL;


--
-- Name: candidate_pipeline candidate_pipeline_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: candidate_pipeline candidate_pipeline_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.candidate_pipeline
    ADD CONSTRAINT candidate_pipeline_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: client_contacts client_contacts_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: clients clients_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: clients clients_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: deal_resumes deal_resumes_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_resumes
    ADD CONSTRAINT deal_resumes_added_by_fkey FOREIGN KEY (added_by) REFERENCES public.users(id);


--
-- Name: deal_resumes deal_resumes_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_resumes
    ADD CONSTRAINT deal_resumes_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE CASCADE;


--
-- Name: deal_resumes deal_resumes_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deal_resumes
    ADD CONSTRAINT deal_resumes_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: deals deals_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: deals deals_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE SET NULL;


--
-- Name: deals deals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: deals deals_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.deals
    ADD CONSTRAINT deals_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: email_templates email_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: email_templates email_templates_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT email_templates_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: firm_gdpr_mail_tokens firm_gdpr_mail_tokens_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_gdpr_mail_tokens
    ADD CONSTRAINT firm_gdpr_mail_tokens_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: firm_credit_transactions firm_credit_transactions_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_credit_transactions
    ADD CONSTRAINT firm_credit_transactions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: firm_credit_transactions firm_credit_transactions_related_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_credit_transactions
    ADD CONSTRAINT firm_credit_transactions_related_transaction_id_fkey FOREIGN KEY (related_transaction_id) REFERENCES public.firm_credit_transactions(id) ON DELETE SET NULL;


--
-- Name: firm_credit_transactions firm_credit_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm_credit_transactions
    ADD CONSTRAINT firm_credit_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: missions missions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;


--
-- Name: missions missions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE SET NULL;


--
-- Name: missions missions_deal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_deal_id_fkey FOREIGN KEY (deal_id) REFERENCES public.deals(id) ON DELETE SET NULL;


--
-- Name: missions missions_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: pipeline_history pipeline_history_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_history
    ADD CONSTRAINT pipeline_history_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.candidate_pipeline(id) ON DELETE CASCADE;


--
-- Name: pipeline_interviews pipeline_interviews_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pipeline_interviews
    ADD CONSTRAINT pipeline_interviews_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.candidate_pipeline(id) ON DELETE CASCADE;


--
-- Name: resume_adaptations resume_adaptations_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;


--
-- Name: resume_adaptations resume_adaptations_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: resume_adaptations resume_adaptations_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: resume_comments resume_comments_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_comments
    ADD CONSTRAINT resume_comments_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: resume_submissions resume_submissions_client_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;


--
-- Name: resume_submissions resume_submissions_contact_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE CASCADE;


--
-- Name: resume_submissions resume_submissions_email_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_email_template_id_fkey FOREIGN KEY (email_template_id) REFERENCES public.email_templates(id) ON DELETE SET NULL;


--
-- Name: resume_submissions resume_submissions_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE CASCADE;


--
-- Name: resume_submissions resume_submissions_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE SET NULL;


--
-- Name: resume_submissions resume_submissions_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: resume_submissions resume_submissions_sent_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_submissions
    ADD CONSTRAINT resume_submissions_sent_by_fkey FOREIGN KEY (sent_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: resume_versions resume_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: resume_versions resume_versions_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resume_versions
    ADD CONSTRAINT resume_versions_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- Name: resumes resumes_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;


--
-- Name: resumes resumes_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;


--
-- Name: templates templates_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;


--
-- Name: user_blacklist user_blacklist_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_blacklist
    ADD CONSTRAINT user_blacklist_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_calendar_tokens user_calendar_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_calendar_tokens
    ADD CONSTRAINT user_calendar_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_mail_tokens user_mail_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_mail_tokens
    ADD CONSTRAINT user_mail_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firms(id) ON DELETE SET NULL;

--
-- Name: cache_scope_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS public.cache_scope_versions (
    scope character varying(100) NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cache_scope_versions_pkey PRIMARY KEY (scope)
);


--
-- PostgreSQL database dump complete
--

\unrestrict IPvDD9n4ZLCUk54EhDkHicSQqRMtkXwbynNeOisko3hnCYYT1TlaXdDHWB08RAI


