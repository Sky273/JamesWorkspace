--
-- PostgreSQL database dump
--

\restrict aFghDJa41USS3XQRYYJ9yoSGXc4Oyot7O9ayZfYSSAbXsoA3CzwbFX9FfNeYapM

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-02-06 01:01:20

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
-- TOC entry 3 (class 3079 OID 17058)
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- TOC entry 5291 (class 0 OID 0)
-- Dependencies: 3
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- TOC entry 2 (class 3079 OID 17047)
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- TOC entry 5292 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- TOC entry 276 (class 1255 OID 17395)
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 221 (class 1259 OID 17139)
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying(255) NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT customers_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- TOC entry 5293 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE customers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.customers IS 'Customer organizations using the platform';


--
-- TOC entry 228 (class 1259 OID 17338)
-- Name: industry_aliases; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.industry_aliases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    canonical_name character varying(255) NOT NULL,
    alias character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.industry_aliases OWNER TO postgres;

--
-- TOC entry 5295 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE industry_aliases; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.industry_aliases IS 'Industry name mappings and aliases';


--
-- TOC entry 234 (class 1259 OID 17442)
-- Name: llm_settings; Type: TABLE; Schema: public; Owner: postgres
--

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


ALTER TABLE public.llm_settings OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 17353)
-- Name: market_facts; Type: TABLE; Schema: public; Owner: postgres
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
    CONSTRAINT market_facts_source_check CHECK (((source)::text = ANY ((ARRAY['france_travail'::character varying, 'adzuna'::character varying])::text[])))
);


ALTER TABLE public.market_facts OWNER TO postgres;

--
-- TOC entry 5298 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE market_facts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.market_facts IS 'Market radar job statistics from various sources';


--
-- TOC entry 230 (class 1259 OID 17376)
-- Name: market_trends; Type: TABLE; Schema: public; Owner: postgres
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
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.market_trends OWNER TO postgres;

--
-- TOC entry 5300 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE market_trends; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.market_trends IS 'Detailed market trends from France Travail API';


--
-- TOC entry 225 (class 1259 OID 17259)
-- Name: missions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.missions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying(500) NOT NULL,
    content text NOT NULL,
    customer_id uuid,
    customer character varying(255),
    status character varying(50) DEFAULT 'active'::character varying,
    keywords jsonb,
    required_skills jsonb,
    preferred_skills jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.missions OWNER TO postgres;

--
-- TOC entry 5302 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE missions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.missions IS 'Job missions/offers for resume adaptation';


--
-- TOC entry 226 (class 1259 OID 17284)
-- Name: resume_adaptations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.resume_adaptations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resume_id uuid,
    mission_id uuid,
    resume_name character varying(255),
    mission_title character varying(500),
    customer_id uuid,
    customer character varying(255),
    adapted_text text NOT NULL,
    adaptation_notes text,
    match_score numeric(5,2),
    status character varying(50) DEFAULT 'draft'::character varying,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    match_analysis jsonb,
    mission_content text,
    CONSTRAINT resume_adaptations_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'processing'::character varying, 'completed'::character varying, 'final'::character varying, 'sent'::character varying, 'archived'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.resume_adaptations OWNER TO postgres;

--
-- TOC entry 5304 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE resume_adaptations; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.resume_adaptations IS 'Adapted resumes tailored to specific missions';


--
-- TOC entry 224 (class 1259 OID 17233)
-- Name: resumes; Type: TABLE; Schema: public; Owner: postgres
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
    customer_id uuid,
    customer_name character varying(255),
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
    CONSTRAINT resumes_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'archived'::character varying, 'new'::character varying, 'pending'::character varying, 'processing'::character varying, 'analyzed'::character varying, 'improved'::character varying, 'error'::character varying, 'failed'::character varying])::text[])))
);


ALTER TABLE public.resumes OWNER TO postgres;

--
-- TOC entry 5306 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE resumes; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.resumes IS 'Resume documents with analysis and extracted data';


--
-- TOC entry 227 (class 1259 OID 17318)
-- Name: rome_metiers; Type: TABLE; Schema: public; Owner: postgres
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


ALTER TABLE public.rome_metiers OWNER TO postgres;

--
-- TOC entry 5308 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE rome_metiers; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.rome_metiers IS 'ROME 4.0 French job classification system';


--
-- TOC entry 223 (class 1259 OID 17210)
-- Name: templates; Type: TABLE; Schema: public; Owner: postgres
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
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT templates_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])))
);


ALTER TABLE public.templates OWNER TO postgres;

--
-- TOC entry 5310 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE templates; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.templates IS 'Resume templates with HTML/CSS styling';


--
-- TOC entry 222 (class 1259 OID 17155)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    role character varying(50) DEFAULT 'user'::character varying NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying,
    customer_id uuid,
    customer_name character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_login timestamp with time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'user'::character varying])::text[]))),
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'pending'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 5312 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS 'User accounts with authentication and role-based access';


--
-- TOC entry 232 (class 1259 OID 17411)
-- Name: v_active_missions; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_active_missions AS
 SELECT m.id,
    m.title,
    m.content,
    m.customer_id,
    m.customer,
    m.status,
    m.keywords,
    m.required_skills,
    m.preferred_skills,
    m.created_at,
    m.updated_at,
    c.name AS customer_full_name,
    c.status AS customer_status
   FROM (public.missions m
     LEFT JOIN public.customers c ON ((m.customer_id = c.id)))
  WHERE ((m.status)::text = 'active'::text);


ALTER VIEW public.v_active_missions OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 17406)
-- Name: v_active_resumes; Type: VIEW; Schema: public; Owner: postgres
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
    r.customer_id,
    r.customer_name,
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
    c.name AS customer_full_name,
    c.status AS customer_status
   FROM (public.resumes r
     LEFT JOIN public.customers c ON ((r.customer_id = c.id)))
  WHERE ((r.status)::text = 'active'::text);


ALTER VIEW public.v_active_resumes OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 17416)
-- Name: v_adaptations_full; Type: VIEW; Schema: public; Owner: postgres
--

CREATE VIEW public.v_adaptations_full AS
 SELECT ra.id,
    ra.resume_id,
    ra.mission_id,
    ra.resume_name,
    ra.mission_title,
    ra.customer_id,
    ra.customer,
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
    c.name AS customer_full_name
   FROM (((public.resume_adaptations ra
     LEFT JOIN public.resumes r ON ((ra.resume_id = r.id)))
     LEFT JOIN public.missions m ON ((ra.mission_id = m.id)))
     LEFT JOIN public.customers c ON ((ra.customer_id = c.id)));


ALTER VIEW public.v_adaptations_full OWNER TO postgres;

--
-- TOC entry 5038 (class 2606 OID 17152)
-- Name: customers customers_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_name_key UNIQUE (name);


--
-- TOC entry 5040 (class 2606 OID 17150)
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- TOC entry 5095 (class 2606 OID 17349)
-- Name: industry_aliases industry_aliases_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.industry_aliases
    ADD CONSTRAINT industry_aliases_pkey PRIMARY KEY (id);


--
-- TOC entry 5116 (class 2606 OID 17473)
-- Name: llm_settings llm_settings_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.llm_settings
    ADD CONSTRAINT llm_settings_name_key UNIQUE (name);


--
-- TOC entry 5118 (class 2606 OID 17471)
-- Name: llm_settings llm_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.llm_settings
    ADD CONSTRAINT llm_settings_pkey PRIMARY KEY (id);


--
-- TOC entry 5103 (class 2606 OID 17369)
-- Name: market_facts market_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_facts
    ADD CONSTRAINT market_facts_pkey PRIMARY KEY (id);


--
-- TOC entry 5111 (class 2606 OID 17388)
-- Name: market_trends market_trends_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.market_trends
    ADD CONSTRAINT market_trends_pkey PRIMARY KEY (id);


--
-- TOC entry 5074 (class 2606 OID 17273)
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- TOC entry 5081 (class 2606 OID 17297)
-- Name: resume_adaptations resume_adaptations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_pkey PRIMARY KEY (id);


--
-- TOC entry 5067 (class 2606 OID 17246)
-- Name: resumes resumes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_pkey PRIMARY KEY (id);


--
-- TOC entry 5088 (class 2606 OID 17332)
-- Name: rome_metiers rome_metiers_code_rome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rome_metiers
    ADD CONSTRAINT rome_metiers_code_rome_key UNIQUE (code_rome);


--
-- TOC entry 5090 (class 2606 OID 17330)
-- Name: rome_metiers rome_metiers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.rome_metiers
    ADD CONSTRAINT rome_metiers_pkey PRIMARY KEY (id);


--
-- TOC entry 5056 (class 2606 OID 17228)
-- Name: templates templates_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_name_key UNIQUE (name);


--
-- TOC entry 5058 (class 2606 OID 17226)
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- TOC entry 5048 (class 2606 OID 17175)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5050 (class 2606 OID 17173)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 5075 (class 1259 OID 17317)
-- Name: idx_adaptations_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adaptations_created_at ON public.resume_adaptations USING btree (created_at DESC);


--
-- TOC entry 5076 (class 1259 OID 17315)
-- Name: idx_adaptations_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adaptations_customer_id ON public.resume_adaptations USING btree (customer_id);


--
-- TOC entry 5077 (class 1259 OID 17314)
-- Name: idx_adaptations_mission_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adaptations_mission_id ON public.resume_adaptations USING btree (mission_id);


--
-- TOC entry 5078 (class 1259 OID 17313)
-- Name: idx_adaptations_resume_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adaptations_resume_id ON public.resume_adaptations USING btree (resume_id);


--
-- TOC entry 5079 (class 1259 OID 17316)
-- Name: idx_adaptations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_adaptations_status ON public.resume_adaptations USING btree (status);


--
-- TOC entry 5041 (class 1259 OID 17153)
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- TOC entry 5042 (class 1259 OID 17154)
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- TOC entry 5091 (class 1259 OID 17351)
-- Name: idx_industry_aliases_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_industry_aliases_alias ON public.industry_aliases USING btree (alias);


--
-- TOC entry 5092 (class 1259 OID 17350)
-- Name: idx_industry_aliases_canonical; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_industry_aliases_canonical ON public.industry_aliases USING btree (canonical_name);


--
-- TOC entry 5093 (class 1259 OID 17352)
-- Name: idx_industry_aliases_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_industry_aliases_unique ON public.industry_aliases USING btree (canonical_name, alias);


--
-- TOC entry 5112 (class 1259 OID 17476)
-- Name: idx_llm_settings_cv_mode; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_llm_settings_cv_mode ON public.llm_settings USING btree (cv_mode);


--
-- TOC entry 5113 (class 1259 OID 17474)
-- Name: idx_llm_settings_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_llm_settings_name ON public.llm_settings USING btree (name);


--
-- TOC entry 5114 (class 1259 OID 17475)
-- Name: idx_llm_settings_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_llm_settings_status ON public.llm_settings USING btree (status);


--
-- TOC entry 5096 (class 1259 OID 17373)
-- Name: idx_market_facts_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_facts_date ON public.market_facts USING btree (date DESC);


--
-- TOC entry 5097 (class 1259 OID 17374)
-- Name: idx_market_facts_job_count; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_facts_job_count ON public.market_facts USING btree (job_count DESC);


--
-- TOC entry 5098 (class 1259 OID 17370)
-- Name: idx_market_facts_keyword; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_facts_keyword ON public.market_facts USING btree (keyword);


--
-- TOC entry 5099 (class 1259 OID 17371)
-- Name: idx_market_facts_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_facts_location ON public.market_facts USING btree (location);


--
-- TOC entry 5100 (class 1259 OID 17372)
-- Name: idx_market_facts_source; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_facts_source ON public.market_facts USING btree (source);


--
-- TOC entry 5101 (class 1259 OID 17375)
-- Name: idx_market_facts_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_market_facts_unique ON public.market_facts USING btree (keyword, location, source, date);


--
-- TOC entry 5104 (class 1259 OID 17390)
-- Name: idx_market_trends_code_rome; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_trends_code_rome ON public.market_trends USING btree (code_rome);


--
-- TOC entry 5105 (class 1259 OID 17392)
-- Name: idx_market_trends_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_trends_date ON public.market_trends USING btree (date DESC);


--
-- TOC entry 5106 (class 1259 OID 17393)
-- Name: idx_market_trends_metadata; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_trends_metadata ON public.market_trends USING gin (metadata);


--
-- TOC entry 5107 (class 1259 OID 17391)
-- Name: idx_market_trends_region_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_trends_region_code ON public.market_trends USING btree (region_code);


--
-- TOC entry 5108 (class 1259 OID 17389)
-- Name: idx_market_trends_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_market_trends_type ON public.market_trends USING btree (type);


--
-- TOC entry 5109 (class 1259 OID 17394)
-- Name: idx_market_trends_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_market_trends_unique ON public.market_trends USING btree (type, code_rome, region_code);


--
-- TOC entry 5068 (class 1259 OID 17282)
-- Name: idx_missions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_missions_created_at ON public.missions USING btree (created_at DESC);


--
-- TOC entry 5069 (class 1259 OID 17280)
-- Name: idx_missions_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_missions_customer_id ON public.missions USING btree (customer_id);


--
-- TOC entry 5070 (class 1259 OID 17283)
-- Name: idx_missions_keywords; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_missions_keywords ON public.missions USING gin (keywords);


--
-- TOC entry 5071 (class 1259 OID 17281)
-- Name: idx_missions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_missions_status ON public.missions USING btree (status);


--
-- TOC entry 5072 (class 1259 OID 17279)
-- Name: idx_missions_title; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_missions_title ON public.missions USING btree (title);


--
-- TOC entry 5059 (class 1259 OID 17256)
-- Name: idx_resumes_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_created_at ON public.resumes USING btree (created_at DESC);


--
-- TOC entry 5060 (class 1259 OID 17253)
-- Name: idx_resumes_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_customer_id ON public.resumes USING btree (customer_id);


--
-- TOC entry 5061 (class 1259 OID 17258)
-- Name: idx_resumes_industries; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_industries ON public.resumes USING gin (industries);


--
-- TOC entry 5062 (class 1259 OID 17252)
-- Name: idx_resumes_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_name ON public.resumes USING btree (name);


--
-- TOC entry 5063 (class 1259 OID 17257)
-- Name: idx_resumes_skills; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_skills ON public.resumes USING gin (skills);


--
-- TOC entry 5064 (class 1259 OID 17254)
-- Name: idx_resumes_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_status ON public.resumes USING btree (status);


--
-- TOC entry 5065 (class 1259 OID 17255)
-- Name: idx_resumes_title; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_resumes_title ON public.resumes USING btree (title);


--
-- TOC entry 5082 (class 1259 OID 17333)
-- Name: idx_rome_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rome_code ON public.rome_metiers USING btree (code_rome);


--
-- TOC entry 5083 (class 1259 OID 17337)
-- Name: idx_rome_competences; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rome_competences ON public.rome_metiers USING gin (competences);


--
-- TOC entry 5084 (class 1259 OID 17335)
-- Name: idx_rome_domaine; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rome_domaine ON public.rome_metiers USING btree (code_domaine_professionnel);


--
-- TOC entry 5085 (class 1259 OID 17336)
-- Name: idx_rome_grand_domaine; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rome_grand_domaine ON public.rome_metiers USING btree (code_grand_domaine);


--
-- TOC entry 5086 (class 1259 OID 17334)
-- Name: idx_rome_libelle; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_rome_libelle ON public.rome_metiers USING btree (libelle);


--
-- TOC entry 5051 (class 1259 OID 17229)
-- Name: idx_templates_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_name ON public.templates USING btree (name);


--
-- TOC entry 5052 (class 1259 OID 17231)
-- Name: idx_templates_popular; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_popular ON public.templates USING btree (popular);


--
-- TOC entry 5053 (class 1259 OID 17230)
-- Name: idx_templates_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_status ON public.templates USING btree (status);


--
-- TOC entry 5054 (class 1259 OID 17232)
-- Name: idx_templates_tags; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_templates_tags ON public.templates USING gin (tags);


--
-- TOC entry 5043 (class 1259 OID 17182)
-- Name: idx_users_customer_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_customer_id ON public.users USING btree (customer_id);


--
-- TOC entry 5044 (class 1259 OID 17181)
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- TOC entry 5045 (class 1259 OID 17183)
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- TOC entry 5046 (class 1259 OID 17184)
-- Name: idx_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_users_status ON public.users USING btree (status);


--
-- TOC entry 5126 (class 2620 OID 17396)
-- Name: customers update_customers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5135 (class 2620 OID 17477)
-- Name: llm_settings update_llm_settings_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_llm_settings_updated_at BEFORE UPDATE ON public.llm_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5133 (class 2620 OID 17404)
-- Name: market_facts update_market_facts_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_market_facts_updated_at BEFORE UPDATE ON public.market_facts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5134 (class 2620 OID 17405)
-- Name: market_trends update_market_trends_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_market_trends_updated_at BEFORE UPDATE ON public.market_trends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5130 (class 2620 OID 17401)
-- Name: missions update_missions_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5131 (class 2620 OID 17402)
-- Name: resume_adaptations update_resume_adaptations_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_resume_adaptations_updated_at BEFORE UPDATE ON public.resume_adaptations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5129 (class 2620 OID 17400)
-- Name: resumes update_resumes_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_resumes_updated_at BEFORE UPDATE ON public.resumes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5132 (class 2620 OID 17403)
-- Name: rome_metiers update_rome_metiers_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_rome_metiers_updated_at BEFORE UPDATE ON public.rome_metiers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5128 (class 2620 OID 17399)
-- Name: templates update_templates_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON public.templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5127 (class 2620 OID 17397)
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- TOC entry 5122 (class 2606 OID 17274)
-- Name: missions missions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5123 (class 2606 OID 17308)
-- Name: resume_adaptations resume_adaptations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5124 (class 2606 OID 17303)
-- Name: resume_adaptations resume_adaptations_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- TOC entry 5125 (class 2606 OID 17298)
-- Name: resume_adaptations resume_adaptations_resume_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resume_adaptations
    ADD CONSTRAINT resume_adaptations_resume_id_fkey FOREIGN KEY (resume_id) REFERENCES public.resumes(id) ON DELETE CASCADE;


--
-- TOC entry 5120 (class 2606 OID 17247)
-- Name: resumes resumes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5121 (class 2606 OID 17489)
-- Name: resumes resumes_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.resumes
    ADD CONSTRAINT resumes_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.templates(id) ON DELETE SET NULL;


--
-- TOC entry 5119 (class 2606 OID 17176)
-- Name: users users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- TOC entry 5294 (class 0 OID 0)
-- Dependencies: 221
-- Name: TABLE customers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.customers TO resume_user;


--
-- TOC entry 5296 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE industry_aliases; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.industry_aliases TO resume_user;


--
-- TOC entry 5297 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE llm_settings; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.llm_settings TO resume_user;


--
-- TOC entry 5299 (class 0 OID 0)
-- Dependencies: 229
-- Name: TABLE market_facts; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.market_facts TO resume_user;


--
-- TOC entry 5301 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE market_trends; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.market_trends TO resume_user;


--
-- TOC entry 5303 (class 0 OID 0)
-- Dependencies: 225
-- Name: TABLE missions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.missions TO resume_user;


--
-- TOC entry 5305 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE resume_adaptations; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resume_adaptations TO resume_user;


--
-- TOC entry 5307 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE resumes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.resumes TO resume_user;


--
-- TOC entry 5309 (class 0 OID 0)
-- Dependencies: 227
-- Name: TABLE rome_metiers; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.rome_metiers TO resume_user;


--
-- TOC entry 5311 (class 0 OID 0)
-- Dependencies: 223
-- Name: TABLE templates; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.templates TO resume_user;


--
-- TOC entry 5313 (class 0 OID 0)
-- Dependencies: 222
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.users TO resume_user;


--
-- TOC entry 5314 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE v_active_missions; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_active_missions TO resume_user;


--
-- TOC entry 5315 (class 0 OID 0)
-- Dependencies: 231
-- Name: TABLE v_active_resumes; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_active_resumes TO resume_user;


--
-- TOC entry 5316 (class 0 OID 0)
-- Dependencies: 233
-- Name: TABLE v_adaptations_full; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.v_adaptations_full TO resume_user;


--
-- TOC entry 2164 (class 826 OID 17425)
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,USAGE ON SEQUENCES TO resume_user;


--
-- TOC entry 2163 (class 826 OID 17424)
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO resume_user;


-- Completed on 2026-02-06 01:01:20

--
-- PostgreSQL database dump complete
--

\unrestrict aFghDJa41USS3XQRYYJ9yoSGXc4Oyot7O9ayZfYSSAbXsoA3CzwbFX9FfNeYapM

