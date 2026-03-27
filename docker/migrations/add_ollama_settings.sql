ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS llm_provider character varying(20) DEFAULT 'openai',
    ADD COLUMN IF NOT EXISTS ollama_base_url character varying(500) DEFAULT 'http://127.0.0.1:11434',
    ADD COLUMN IF NOT EXISTS ollama_vision_model character varying(100) DEFAULT '',
    ADD COLUMN IF NOT EXISTS ollama_keep_alive character varying(50) DEFAULT '5m',
    ADD COLUMN IF NOT EXISTS ollama_num_ctx integer DEFAULT 8192;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_llm_provider_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_llm_provider_check
            CHECK ((llm_provider)::text = ANY (ARRAY['openai'::text, 'anthropic'::text, 'ollama'::text]));
    END IF;
END $$;
