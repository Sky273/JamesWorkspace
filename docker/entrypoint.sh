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
else
    echo "Database schema already exists, skipping initialization."
fi

# =============================================================================
# Start all services via Supervisor
# =============================================================================
echo "[4/5] Starting application servers..."
echo ""
echo "=============================================="
echo "  Services:"
echo "  - Proxy Server:  https://localhost:3443"
echo "  - PDF Server:    http://localhost:3002 (internal)"
echo "  - PostgreSQL:    localhost:5432 (internal)"
echo "=============================================="
echo ""
echo "Default login: admin@resumeconverter.local / admin123"
echo ""

# Start supervisor (manages all Node.js processes)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
