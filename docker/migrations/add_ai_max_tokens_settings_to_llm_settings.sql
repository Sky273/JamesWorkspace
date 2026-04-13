ALTER TABLE llm_settings
    ADD COLUMN IF NOT EXISTS ai_max_tokens_chatbot_message integer NOT NULL DEFAULT 4000,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_resume_ai_modify integer NOT NULL DEFAULT 8192,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_template_extract integer NOT NULL DEFAULT 32000,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_resume_analysis integer NOT NULL DEFAULT 16000,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_resume_improvement integer NOT NULL DEFAULT 16384,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_resume_adaptation integer NOT NULL DEFAULT 8192,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_resume_match integer NOT NULL DEFAULT 4096,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_profile_search integer NOT NULL DEFAULT 2048,
    ADD COLUMN IF NOT EXISTS ai_max_tokens_profile_analysis integer NOT NULL DEFAULT 3072;

ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_chatbot_message_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_resume_ai_modify_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_template_extract_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_resume_analysis_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_resume_improvement_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_resume_adaptation_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_resume_match_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_profile_search_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_max_tokens_profile_analysis_check;

ALTER TABLE llm_settings
    ADD CONSTRAINT llm_settings_ai_max_tokens_chatbot_message_check CHECK (ai_max_tokens_chatbot_message >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_resume_ai_modify_check CHECK (ai_max_tokens_resume_ai_modify >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_template_extract_check CHECK (ai_max_tokens_template_extract >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_resume_analysis_check CHECK (ai_max_tokens_resume_analysis >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_resume_improvement_check CHECK (ai_max_tokens_resume_improvement >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_resume_adaptation_check CHECK (ai_max_tokens_resume_adaptation >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_resume_match_check CHECK (ai_max_tokens_resume_match >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_profile_search_check CHECK (ai_max_tokens_profile_search >= 1),
    ADD CONSTRAINT llm_settings_ai_max_tokens_profile_analysis_check CHECK (ai_max_tokens_profile_analysis >= 1);
