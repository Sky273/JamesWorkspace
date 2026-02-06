-- ============================================
-- Grant permissions to resume_user
-- Execute with: psql -U postgres -d resumeconverter -f database/grant_permissions_simple.sql
-- ============================================

-- Grant permissions on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO resume_user;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO resume_user;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO resume_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO resume_user;

-- Verify permissions
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'resume_user'
ORDER BY table_name, privilege_type;
