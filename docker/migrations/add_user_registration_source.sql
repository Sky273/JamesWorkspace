ALTER TABLE users
ADD COLUMN IF NOT EXISTS registration_source character varying(50);

UPDATE users
SET registration_source = CASE
    WHEN LOWER(COALESCE(email, '')) = 'admin@resumeconverter.local' THEN 'system_seed'
    WHEN LOWER(COALESCE(firm_name, '')) IN ('public registration', 'cabinet test')
        OR LOWER(COALESCE(firm_name, '')) LIKE 'cabinet test %' THEN 'self_service'
    ELSE 'admin_created'
END
WHERE registration_source IS NULL;

ALTER TABLE users
ALTER COLUMN registration_source SET DEFAULT 'admin_created';

ALTER TABLE users
ALTER COLUMN registration_source SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_registration_source_check'
    ) THEN
        ALTER TABLE users
        ADD CONSTRAINT users_registration_source_check
        CHECK ((registration_source)::text = ANY (ARRAY[
            'self_service'::text,
            'admin_created'::text,
            'system_seed'::text
        ]));
    END IF;
END $$;

COMMENT ON COLUMN users.registration_source IS 'Origin of the account lifecycle: self_service, admin_created, or system_seed';
