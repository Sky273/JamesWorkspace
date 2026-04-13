ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS allow_user_registration_without_approval boolean DEFAULT false NOT NULL;
