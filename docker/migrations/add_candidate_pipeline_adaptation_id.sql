-- Migration: add adaptation_id to candidate_pipeline
-- Date: 2026-04-08
-- Description: stores the selected mission adaptation on pipeline entries

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'candidate_pipeline'
          AND column_name = 'adaptation_id'
    ) THEN
        ALTER TABLE public.candidate_pipeline
            ADD COLUMN adaptation_id uuid;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'candidate_pipeline_adaptation_id_fkey'
          AND conrelid = 'public.candidate_pipeline'::regclass
    ) THEN
        ALTER TABLE public.candidate_pipeline
            ADD CONSTRAINT candidate_pipeline_adaptation_id_fkey
            FOREIGN KEY (adaptation_id)
            REFERENCES public.resume_adaptations(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_candidate_pipeline_adaptation_id
    ON public.candidate_pipeline USING btree (adaptation_id);
