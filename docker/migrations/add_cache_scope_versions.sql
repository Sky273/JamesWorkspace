-- Migration: Add cache scope versions table
-- Date: 2026-04-12
-- Description: Stores monotonic cache scope versions for database-backed invalidation

CREATE TABLE IF NOT EXISTS public.cache_scope_versions (
    scope VARCHAR(100) PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE public.cache_scope_versions IS 'Monotonic version store for cache scope invalidation';
COMMENT ON COLUMN public.cache_scope_versions.scope IS 'Logical cache scope name';
COMMENT ON COLUMN public.cache_scope_versions.version IS 'Monotonic version for cache key invalidation';
COMMENT ON COLUMN public.cache_scope_versions.updated_at IS 'Timestamp of the last version change';

