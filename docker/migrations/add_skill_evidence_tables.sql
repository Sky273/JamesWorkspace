-- Migration: Add skill evidence persistence tables
-- Date: 2026-04-10
-- Description: Persists evidence-backed skills, tools, and soft skills for resumes

CREATE TABLE IF NOT EXISTS public.skills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    normalized_name character varying(255) NOT NULL,
    category character varying(30) DEFAULT 'skill'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skills_pkey PRIMARY KEY (id),
    CONSTRAINT skills_category_check CHECK (((category)::text = ANY ((ARRAY['skill'::character varying, 'tool'::character varying, 'soft_skill'::character varying])::text[])))
);

CREATE TABLE IF NOT EXISTS public.skill_evidence (
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

CREATE TABLE IF NOT EXISTS public.skill_occurrences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    skill_evidence_id uuid NOT NULL,
    source_type character varying(50),
    project_name character varying(255),
    duration_months integer,
    context text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT skill_occurrences_pkey PRIMARY KEY (id)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'skill_evidence'
          AND constraint_name = 'skill_evidence_candidate_id_fkey'
    ) THEN
        ALTER TABLE public.skill_evidence
            ADD CONSTRAINT skill_evidence_candidate_id_fkey
            FOREIGN KEY (candidate_id) REFERENCES public.resumes(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'skill_evidence'
          AND constraint_name = 'skill_evidence_skill_id_fkey'
    ) THEN
        ALTER TABLE public.skill_evidence
            ADD CONSTRAINT skill_evidence_skill_id_fkey
            FOREIGN KEY (skill_id) REFERENCES public.skills(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_schema = 'public'
          AND table_name = 'skill_occurrences'
          AND constraint_name = 'skill_occurrences_skill_evidence_id_fkey'
    ) THEN
        ALTER TABLE public.skill_occurrences
            ADD CONSTRAINT skill_occurrences_skill_evidence_id_fkey
            FOREIGN KEY (skill_evidence_id) REFERENCES public.skill_evidence(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_normalized_category_unique
    ON public.skills USING btree (normalized_name, category);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_evidence_candidate_skill_phase_unique
    ON public.skill_evidence USING btree (candidate_id, skill_id, analysis_phase);

CREATE INDEX IF NOT EXISTS idx_skill_evidence_candidate_phase
    ON public.skill_evidence USING btree (candidate_id, analysis_phase);

CREATE INDEX IF NOT EXISTS idx_skill_evidence_skill_id
    ON public.skill_evidence USING btree (skill_id);

CREATE INDEX IF NOT EXISTS idx_skill_occurrences_skill_evidence_id
    ON public.skill_occurrences USING btree (skill_evidence_id);
