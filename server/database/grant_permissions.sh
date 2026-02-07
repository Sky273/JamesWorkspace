#!/bin/bash
# ============================================
# Grant permissions to PostgreSQL user
# Uses environment variables from .env
# ============================================

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | grep 'POSTGRES_' | xargs)
fi

# Check if required variables are set
if [ -z "$POSTGRES_USER" ]; then
    echo "Error: POSTGRES_USER environment variable is not set"
    exit 1
fi

if [ -z "$POSTGRES_DB" ]; then
    echo "Error: POSTGRES_DB environment variable is not set"
    exit 1
fi

echo "Granting permissions to user: $POSTGRES_USER"
echo "Database: $POSTGRES_DB"

# Execute SQL commands using environment variables
psql -U postgres -d "$POSTGRES_DB" << EOF
-- Grant permissions on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $POSTGRES_USER;

-- Grant permissions on sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $POSTGRES_USER;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $POSTGRES_USER;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO $POSTGRES_USER;

-- Verify permissions
SELECT 
    grantee, 
    table_schema, 
    table_name, 
    privilege_type
FROM information_schema.table_privileges
WHERE grantee = '$POSTGRES_USER'
ORDER BY table_name, privilege_type;
EOF

echo ""
echo "✅ Permissions granted successfully to $POSTGRES_USER"
