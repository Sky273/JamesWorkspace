ALTER TABLE public.llm_settings
ADD COLUMN IF NOT EXISTS llm_model_parameters jsonb DEFAULT '{}'::jsonb;

UPDATE public.llm_settings
SET llm_model_parameters = '{}'::jsonb
WHERE llm_model_parameters IS NULL;

ALTER TABLE public.llm_settings
ALTER COLUMN llm_model_parameters SET NOT NULL;
