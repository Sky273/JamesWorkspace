ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS public_home_enabled boolean;
