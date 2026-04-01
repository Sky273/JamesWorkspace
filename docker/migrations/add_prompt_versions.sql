ALTER TABLE public.llm_settings
ADD COLUMN IF NOT EXISTS prompt_versions jsonb DEFAULT '{}'::jsonb;

UPDATE public.llm_settings
SET prompt_versions = '{}'::jsonb
WHERE prompt_versions IS NULL;

ALTER TABLE public.llm_settings
ALTER COLUMN prompt_versions SET NOT NULL;
