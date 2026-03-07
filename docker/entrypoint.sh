#!/bin/bash
# =============================================================================
# ResumeConverter - Container Entrypoint Script
# Starts PostgreSQL, initializes database, then starts all Node.js servers
# =============================================================================

set -e

echo "=============================================="
echo "  ResumeConverter - Starting Container"
echo "=============================================="

# =============================================================================
# Generate SSL Certificates (if not mounted)
# =============================================================================
echo "[1/5] Checking SSL certificates..."

CERT_DIR="/app/certificates"
CERT_FILE="$CERT_DIR/certificate.crt"
KEY_FILE="$CERT_DIR/private.key"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=FR/ST=IDF/L=Paris/O=ResumeConverter/CN=localhost"
    echo "SSL certificate generated!"
else
    echo "SSL certificates found, using existing."
fi

# =============================================================================
# Start PostgreSQL
# =============================================================================
echo "[2/5] Starting PostgreSQL..."
service postgresql start

# Wait for PostgreSQL to be ready
until pg_isready -h 127.0.0.1 -p 5432 -U resumeconverter; do
    echo "Waiting for PostgreSQL to start..."
    sleep 2
done
echo "PostgreSQL is ready!"

# =============================================================================
# Initialize Database Schema (if not already done)
# =============================================================================
echo "[3/5] Checking database schema..."

# Check if tables exist, if not run init script
TABLES_EXIST=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -tAc "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users');")

if [ "$TABLES_EXIST" = "f" ]; then
    echo "Initializing database schema..."
    PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -f /docker-entrypoint-initdb.d/init-db.sql
    echo "Database schema initialized!"
    
    # Mark all migrations as applied (fresh install has everything)
    echo "Marking all migrations as applied..."
    for migration_file in /docker-entrypoint-initdb.d/migrations/*.sql; do
        if [ -f "$migration_file" ]; then
            migration_name=$(basename "$migration_file")
            PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -c \
                "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name') ON CONFLICT (migration_name) DO NOTHING;"
        fi
    done
    echo "All migrations marked as applied."
else
    echo "Database schema already exists."
    
    # Ensure schema_migrations table exists (for older databases)
    PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -c \
        "CREATE TABLE IF NOT EXISTS public.schema_migrations (
            id SERIAL PRIMARY KEY,
            migration_name character varying(255) NOT NULL UNIQUE,
            applied_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
        );" 2>/dev/null || true
    
    # Run pending migrations
    echo "Checking for pending migrations..."
    MIGRATIONS_APPLIED=0
    for migration_file in /docker-entrypoint-initdb.d/migrations/*.sql; do
        if [ -f "$migration_file" ]; then
            migration_name=$(basename "$migration_file")
            
            # Check if migration was already applied
            ALREADY_APPLIED=$(PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -tAc \
                "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE migration_name = '$migration_name');")
            
            if [ "$ALREADY_APPLIED" = "f" ]; then
                echo "  Applying migration: $migration_name"
                if PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -f "$migration_file" 2>/dev/null; then
                    PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -c \
                        "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name');"
                    MIGRATIONS_APPLIED=$((MIGRATIONS_APPLIED + 1))
                else
                    echo "  Warning: Migration $migration_name may have partially failed (some changes might already exist)"
                    # Still mark as applied to avoid re-running
                    PGPASSWORD=$POSTGRES_PASSWORD psql -h 127.0.0.1 -U $POSTGRES_USER -d $POSTGRES_DB -c \
                        "INSERT INTO schema_migrations (migration_name) VALUES ('$migration_name') ON CONFLICT (migration_name) DO NOTHING;"
                fi
            fi
        fi
    done
    
    if [ $MIGRATIONS_APPLIED -gt 0 ]; then
        echo "$MIGRATIONS_APPLIED migration(s) applied."
    else
        echo "No pending migrations."
    fi
fi

# =============================================================================
# Start all services via Supervisor
# =============================================================================
echo "[4/5] Starting application servers..."
echo ""
echo "=============================================="
echo "  Services:"
echo "  - Proxy Server:  https://localhost:443"
echo "  - PDF Server:    http://localhost:3002 (internal)"
echo "  - PostgreSQL:    localhost:5432 (internal)"
echo "=============================================="
echo ""
echo "Default login: admin@resumeconverter.local / admin123"
echo ""

# Start supervisor (manages all Node.js processes)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
