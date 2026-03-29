ALTER TABLE public.llm_settings
    DROP CONSTRAINT IF EXISTS llm_settings_llm_provider_check;

ALTER TABLE public.llm_settings
    ADD CONSTRAINT llm_settings_llm_provider_check
    CHECK ((llm_provider)::text = ANY (
        ARRAY[
            'openai'::text,
            'anthropic'::text,
            'deepseek'::text,
            'minimax'::text,
            'ollama'::text
        ]
    ));
