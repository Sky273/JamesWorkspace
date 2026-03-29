ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS profile_matching_local_skill_weight integer DEFAULT 6,
    ADD COLUMN IF NOT EXISTS profile_matching_local_tool_weight integer DEFAULT 4,
    ADD COLUMN IF NOT EXISTS profile_matching_local_industry_weight integer DEFAULT 3,
    ADD COLUMN IF NOT EXISTS profile_matching_local_softskill_weight integer DEFAULT 2,
    ADD COLUMN IF NOT EXISTS profile_matching_local_title_exact_weight integer DEFAULT 5,
    ADD COLUMN IF NOT EXISTS profile_matching_local_title_token_weight integer DEFAULT 2,
    ADD COLUMN IF NOT EXISTS profile_matching_local_coverage_multiplier integer DEFAULT 3;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_skill_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_skill_weight_check
            CHECK (profile_matching_local_skill_weight >= 0 AND profile_matching_local_skill_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_tool_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_tool_weight_check
            CHECK (profile_matching_local_tool_weight >= 0 AND profile_matching_local_tool_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_industry_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_industry_weight_check
            CHECK (profile_matching_local_industry_weight >= 0 AND profile_matching_local_industry_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_softskill_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_softskill_weight_check
            CHECK (profile_matching_local_softskill_weight >= 0 AND profile_matching_local_softskill_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_title_exact_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_title_exact_weight_check
            CHECK (profile_matching_local_title_exact_weight >= 0 AND profile_matching_local_title_exact_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_title_token_weight_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_title_token_weight_check
            CHECK (profile_matching_local_title_token_weight >= 0 AND profile_matching_local_title_token_weight <= 100);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_profile_matching_local_coverage_multiplier_check'
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_profile_matching_local_coverage_multiplier_check
            CHECK (profile_matching_local_coverage_multiplier >= 0 AND profile_matching_local_coverage_multiplier <= 100);
    END IF;
END $$;
