#!/bin/bash
# =============================================================================
# ResumeConverter - Container Entrypoint Script
# Starts PostgreSQL, initializes database, then starts all Node.js servers
# =============================================================================

set -e

echo "=============================================="
echo "  ResumeConverter - Starting Container"
echo "=============================================="

cleanup_stale_postgres_state() {
    local pid_file="$PGDATA/postmaster.pid"

    if [ ! -f "$pid_file" ]; then
        return
    fi

    if [ ! -s "$pid_file" ]; then
        echo "Removing empty PostgreSQL PID file left by a previous failed start..."
        rm -f "$pid_file"
        return
    fi

    local postgres_pid
    postgres_pid="$(head -n 1 "$pid_file" 2>/dev/null | tr -d '[:space:]')"

    if [ -z "$postgres_pid" ] || ! kill -0 "$postgres_pid" 2>/dev/null; then
        echo "Removing stale PostgreSQL PID file for non-running process: ${postgres_pid:-unknown}"
        rm -f "$pid_file"
    fi
}

prepare_log_paths() {
    mkdir -p /var/log/supervisor
    mkdir -p /var/log/postgresql
    mkdir -p /app/logs

    touch /var/log/supervisor/supervisord.log
    touch /var/log/supervisor/redis.out.log
    touch /var/log/supervisor/redis.err.log
    touch /var/log/supervisor/proxy-server.out.log
    touch /var/log/supervisor/proxy-server.err.log
    touch /var/log/supervisor/pdf-server.out.log
    touch /var/log/supervisor/pdf-server.err.log
    touch /var/log/postgresql/postgresql-18-main.log
}

prepare_log_paths

resolve_positive_int_with_cap() {
    local raw_value="$1"
    local default_value="$2"
    local max_value="$3"

    if ! [[ "$raw_value" =~ ^[0-9]+$ ]] || [ "$raw_value" -lt 1 ]; then
        echo "$default_value"
        return
    fi

    if [ "$raw_value" -gt "$max_value" ]; then
        echo "$max_value"
        return
    fi

    echo "$raw_value"
}

print_runtime_configuration_summary() {
    local effective_batch_max effective_batch_size
    effective_batch_max="$(resolve_positive_int_with_cap "${BATCH_EXPORT_MAX_OPERATIONS:-}" 300 300)"
    effective_batch_size="$(resolve_positive_int_with_cap "${BATCH_EXPORT_BATCH_SIZE:-}" 100 100)"

    echo "Runtime configuration summary:"
    echo "  - PostgreSQL database: ${POSTGRES_DB:-resumeconverter}"
    echo "  - PostgreSQL user:     ${POSTGRES_USER:-postgres}"
    echo "  - Batch max ops:      ${effective_batch_max}"
    echo "  - Batch batch size:   ${effective_batch_size}"

    if [ -z "${JWT_SECRET:-}" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
        echo "WARN: JWT_SECRET is missing or shorter than 32 characters."
    fi

    if [ -z "${CSRF_SECRET:-}" ] || [ "${#CSRF_SECRET}" -lt 32 ]; then
        echo "WARN: CSRF_SECRET is missing or shorter than 32 characters."
    fi
}

verify_database_bootstrap_state() {
    local default_admin_email escaped_admin_email schema_migrations_exists users_exists default_admin_exists
    default_admin_email="${DEFAULT_ADMIN_EMAIL:-admin@resumeconverter.local}"
    escaped_admin_email="${default_admin_email//\'/\'\'}"
    schema_migrations_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations')::int;" | tr -d '[:space:]')"
    users_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')::int;" | tr -d '[:space:]')"
    default_admin_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
        "SELECT EXISTS (SELECT 1 FROM users WHERE LOWER(email) = LOWER('${escaped_admin_email}'))::int;" | tr -d '[:space:]')"

    if [ "$schema_migrations_exists" != "1" ] || [ "$users_exists" != "1" ] || [ "$default_admin_exists" != "1" ]; then
        echo "ERROR: Database bootstrap verification failed (schema_migrations/users/default admin)."
        exit 1
    fi

    echo "Database bootstrap verification passed."
}

print_runtime_configuration_summary

# =============================================================================
# Generate SSL Certificates (if not mounted)
# =============================================================================
echo "[1/5] Checking SSL certificates..."

CERT_DIR="/app/certificates"
CERT_FILE="$CERT_DIR/certificate.crt"
KEY_FILE="$CERT_DIR/private.key"

if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "Generating self-signed SSL certificate..."
    openssl req -x509 -nodes -days 365 -newkey rsa:4096 -sha256 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=FR/ST=IDF/L=Paris/O=ResumeConverter/CN=localhost"
    echo "SSL certificate generated (RSA 4096 + SHA-256)!"
else
    echo "SSL certificates found, using existing."
fi

# =============================================================================
# Start PostgreSQL
# =============================================================================
echo "[2/5] Starting PostgreSQL..."

# PostgreSQL data directory
PGDATA="/var/lib/postgresql/18/main"

cleanup_stale_postgres_state

# Check if data directory is empty or not a valid cluster (first run with mounted volume)
if [ ! -f "$PGDATA/PG_VERSION" ]; then
    echo "Initializing PostgreSQL cluster in mounted volume..."
    
    # Ensure directory exists and has correct permissions
    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"
    
    # Initialize the cluster as postgres user
    su - postgres -c "/usr/lib/postgresql/18/bin/initdb -D $PGDATA --encoding=UTF8 --locale=C"
    
    # Configure PostgreSQL for connections
    echo "host all all 127.0.0.1/32 md5" >> "$PGDATA/pg_hba.conf"
    echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
    echo "listen_addresses='*'" >> "$PGDATA/postgresql.conf"
    
    # Start PostgreSQL
    su - postgres -c "/usr/lib/postgresql/18/bin/pg_ctl start -D $PGDATA -l /var/log/postgresql/postgresql-18-main.log -w"
    
    # Create user and database
    echo "Creating database user and database..."
    su - postgres -c "psql -c \"CREATE USER $POSTGRES_USER WITH SUPERUSER PASSWORD '$POSTGRES_PASSWORD';\""
    su - postgres -c "createdb -O $POSTGRES_USER $POSTGRES_DB"
    
    echo "PostgreSQL cluster initialized!"
else
    # Fix permissions for mounted data directory (required when mounting from host)
    chown -R postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"

    cleanup_stale_postgres_state
    
    # Start PostgreSQL using pg_ctl directly (more reliable with mounted volumes)
    su - postgres -c "/usr/lib/postgresql/18/bin/pg_ctl start -D $PGDATA -l /var/log/postgresql/postgresql-18-main.log -w"
fi

# Wait for PostgreSQL to be ready
until pg_isready -h 127.0.0.1 -p 5432 -U resumeconverter; do
    echo "Waiting for PostgreSQL to start..."
    sleep 2
done
echo "PostgreSQL is ready!"

# =============================================================================
# Normalize internal PDF auth token before spawning Supervisor-managed services
# =============================================================================
echo "[3/5] Preparing shared internal service secrets..."

if [ -z "$PDF_SERVER_INTERNAL_TOKEN" ] || [ "${#PDF_SERVER_INTERNAL_TOKEN}" -lt 32 ]; then
    if [ -n "$JWT_SECRET" ] && [ "${#JWT_SECRET}" -ge 32 ] && [ -n "$CSRF_SECRET" ] && [ "${#CSRF_SECRET}" -ge 32 ]; then
        PDF_SERVER_INTERNAL_TOKEN="$(printf '%s' "${JWT_SECRET}:${CSRF_SECRET}:resumeconverter-pdf-server-internal-token-v1" | base64 | tr '+/' '-_' | tr -d '=\n' | cut -c1-48)"
        export PDF_SERVER_INTERNAL_TOKEN
        echo "Derived shared PDF_SERVER_INTERNAL_TOKEN from JWT_SECRET and CSRF_SECRET."
    fi
fi

if [ -z "$PDF_SERVER_INTERNAL_TOKEN" ] || [ "${#PDF_SERVER_INTERNAL_TOKEN}" -lt 32 ]; then
    echo "ERROR: PDF_SERVER_INTERNAL_TOKEN is missing or too short, and no compatible fallback could be derived."
    exit 1
fi

# =============================================================================
# Initialize / migrate database schema outside the web runtime
# =============================================================================
echo "[4/5] Running docker-migrate..."
node server/scripts/docker-migrate.js
node server/scripts/ensure-default-admin.js
verify_database_bootstrap_state

# =============================================================================
# Start all services via Supervisor
# =============================================================================
echo "[5/5] Starting application servers..."

SUPERVISOR_CONF="/etc/supervisor/conf.d/supervisord.conf"
if [ "$DISABLE_INTERNAL_REDIS" = "true" ]; then
    echo "Internal Redis disabled; using external/shared Redis backend."
    awk '
        BEGIN { skip = 0 }
        /^\[program:redis\]/ { skip = 1; next }
        skip && /^\[program:/ { skip = 0 }
        !skip { print }
    ' "$SUPERVISOR_CONF" > /tmp/supervisord-runtime.conf
    SUPERVISOR_CONF="/tmp/supervisord-runtime.conf"
fi

echo ""
echo "=============================================="
echo "  Services:"
if [ "$DISABLE_INTERNAL_REDIS" = "true" ]; then
    echo "  - Redis Cache:   $CACHE_REDIS_URL (external)"
else
    echo "  - Redis Cache:   redis://127.0.0.1:6379 (internal)"
fi
echo "  - Proxy Server:  https://localhost:3443"
echo "  - PDF Server:    http://localhost:3002 (internal)"
echo "  - PostgreSQL:    localhost:5432 (internal)"
echo "=============================================="
echo ""
echo "Default login: admin@resumeconverter.local / admin123"
echo ""

# Start supervisor (manages all Node.js processes)
exec /usr/bin/supervisord -c "$SUPERVISOR_CONF"
