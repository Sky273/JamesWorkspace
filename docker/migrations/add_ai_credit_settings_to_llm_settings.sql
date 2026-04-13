ALTER TABLE llm_settings
    ADD COLUMN IF NOT EXISTS firm_initial_credits integer NOT NULL DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS ai_credit_chatbot_message integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS ai_credit_resume_ai_modify integer NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS ai_credit_template_extract integer NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS ai_credit_resume_analysis integer NOT NULL DEFAULT 25,
    ADD COLUMN IF NOT EXISTS ai_credit_resume_improvement integer NOT NULL DEFAULT 75,
    ADD COLUMN IF NOT EXISTS ai_credit_resume_adaptation integer NOT NULL DEFAULT 50,
    ADD COLUMN IF NOT EXISTS ai_credit_resume_match integer NOT NULL DEFAULT 8,
    ADD COLUMN IF NOT EXISTS ai_credit_profile_search integer NOT NULL DEFAULT 12,
    ADD COLUMN IF NOT EXISTS ai_credit_profile_analysis integer NOT NULL DEFAULT 25;

ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_firm_initial_credits_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_chatbot_message_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_resume_ai_modify_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_template_extract_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_resume_analysis_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_resume_improvement_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_resume_adaptation_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_resume_match_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_profile_search_check;
ALTER TABLE llm_settings DROP CONSTRAINT IF EXISTS llm_settings_ai_credit_profile_analysis_check;

ALTER TABLE llm_settings
    ADD CONSTRAINT llm_settings_firm_initial_credits_check CHECK (firm_initial_credits >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_chatbot_message_check CHECK (ai_credit_chatbot_message >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_resume_ai_modify_check CHECK (ai_credit_resume_ai_modify >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_template_extract_check CHECK (ai_credit_template_extract >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_resume_analysis_check CHECK (ai_credit_resume_analysis >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_resume_improvement_check CHECK (ai_credit_resume_improvement >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_resume_adaptation_check CHECK (ai_credit_resume_adaptation >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_resume_match_check CHECK (ai_credit_resume_match >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_profile_search_check CHECK (ai_credit_profile_search >= 0),
    ADD CONSTRAINT llm_settings_ai_credit_profile_analysis_check CHECK (ai_credit_profile_analysis >= 0);
