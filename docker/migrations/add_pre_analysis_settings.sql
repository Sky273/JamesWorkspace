ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS pre_analysis_enabled boolean DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS pre_analysis_prompt text;
