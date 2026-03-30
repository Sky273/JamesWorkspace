-- Migration: Canonicalize llm_settings around a single settings_key
-- Description: Introduces a unique canonical settings row keyed by settings_key='default'

ALTER TABLE public.llm_settings
    ADD COLUMN IF NOT EXISTS settings_key character varying(50);

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            ORDER BY
                CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST,
                id DESC
        ) AS rn
    FROM public.llm_settings
)
UPDATE public.llm_settings AS ls
SET
    settings_key = 'default',
    name = 'Default Settings',
    status = 'active'
FROM ranked
WHERE ls.id = ranked.id
  AND ranked.rn = 1
  AND ls.settings_key IS NULL;

DELETE FROM public.llm_settings
WHERE settings_key IS DISTINCT FROM 'default';

UPDATE public.llm_settings
SET
    settings_key = 'default',
    name = 'Default Settings',
    status = 'active'
WHERE settings_key IS NULL;

ALTER TABLE public.llm_settings
    ALTER COLUMN settings_key SET DEFAULT 'default';

ALTER TABLE public.llm_settings
    ALTER COLUMN settings_key SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'llm_settings_settings_key_key'
          AND conrelid = 'public.llm_settings'::regclass
    ) THEN
        ALTER TABLE public.llm_settings
            ADD CONSTRAINT llm_settings_settings_key_key UNIQUE (settings_key);
    END IF;
END $$;
