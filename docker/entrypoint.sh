#!/bin/bash
# =============================================================================
# ResumeConverter - Container Entrypoint Script
# Waits for external PostgreSQL, initializes schema, then starts Node.js servers
# =============================================================================

set -e

echo "=============================================="
echo "  ResumeConverter - Starting Container"
echo "=============================================="

prepare_log_paths() {
    mkdir -p /var/log/supervisor
    mkdir -p /app/logs

    touch /var/log/supervisor/supervisord.log
    touch /var/log/supervisor/proxy-server.out.log
    touch /var/log/supervisor/proxy-server.err.log
    touch /var/log/supervisor/pdf-server.out.log
    touch /var/log/supervisor/pdf-server.err.log
}

prepare_log_paths

looks_like_placeholder_secret() {
    local value="$1"
    local normalized
    normalized="$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')"

    [[ "$normalized" == *"change-this-in-production"* ]] \
        || [[ "$normalized" == *"your-super-secret"* ]] \
        || [[ "$normalized" == *"your-secure-password"* ]] \
        || [[ "$normalized" == *"your-google-client"* ]] \
        || [[ "$normalized" == *"your-64-character-hex"* ]] \
        || [[ "$normalized" == *"your-domain.com"* ]] \
        || [[ "$normalized" == *"your-client-id"* ]] \
        || [[ "$normalized" == *"your-client-secret"* ]] \
        || [[ "$normalized" == *"your-openai-api-key"* ]] \
        || [[ "$normalized" == *"your-anthropic-api-key"* ]]
}

generate_runtime_secret() {
    openssl rand -hex 32
}

ensure_runtime_secret() {
    local var_name="$1"
    local current_value="${!var_name:-}"

    if [ -z "$current_value" ] || [ "${#current_value}" -lt 32 ] || looks_like_placeholder_secret "$current_value"; then
        local generated_secret
        generated_secret="$(generate_runtime_secret)"
        export "$var_name=$generated_secret"
        echo "Generated runtime value for $var_name."
    fi
}

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
    echo "  - PostgreSQL host:     ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432}"
    echo "  - PostgreSQL database: ${POSTGRES_DB:-resumeconverter}"
    echo "  - PostgreSQL user:     ${POSTGRES_USER:-postgres}"
    echo "  - Redis cache:         ${CACHE_REDIS_URL:-redis://redis:6379}"
    echo "  - Batch max ops:       ${effective_batch_max}"
    echo "  - Batch batch size:    ${effective_batch_size}"

    if [ -z "${JWT_SECRET:-}" ] || [ "${#JWT_SECRET}" -lt 32 ]; then
        echo "WARN: JWT_SECRET is missing or shorter than 32 characters."
    fi

    if [ -z "${CSRF_SECRET:-}" ] || [ "${#CSRF_SECRET}" -lt 32 ]; then
        echo "WARN: CSRF_SECRET is missing or shorter than 32 characters."
    fi
}

wait_for_postgres() {
    local host="${POSTGRES_HOST:-postgres}"
    local port="${POSTGRES_PORT:-5432}"
    local user="${POSTGRES_USER:-resumeconverter}"

    until pg_isready -h "$host" -p "$port" -U "$user" >/dev/null 2>&1; do
        echo "Waiting for PostgreSQL at ${host}:${port}..."
        sleep 2
    done

    echo "PostgreSQL is ready!"
}

verify_database_bootstrap_state() {
    local default_admin_email escaped_admin_email schema_migrations_exists users_exists default_admin_exists
    local host="${POSTGRES_HOST:-postgres}"
    local port="${POSTGRES_PORT:-5432}"

    default_admin_email="${DEFAULT_ADMIN_EMAIL:-admin@resumeconverter.local}"
    escaped_admin_email="${default_admin_email//\'/\'\'}"
    schema_migrations_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$host" -p "$port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'schema_migrations')::int;" | tr -d '[:space:]')"
    users_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$host" -p "$port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')::int;" | tr -d '[:space:]')"
    default_admin_exists="$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$host" -p "$port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAqc \
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
echo "[1/4] Checking SSL certificates..."

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
# Wait for external PostgreSQL
# =============================================================================
echo "[2/4] Waiting for PostgreSQL..."
wait_for_postgres

# =============================================================================
# Normalize runtime secrets before spawning Supervisor-managed services
# =============================================================================
echo "[3/4] Preparing shared internal service secrets..."

ensure_runtime_secret "JWT_SECRET"
ensure_runtime_secret "CSRF_SECRET"
ensure_runtime_secret "REFRESH_TOKEN_SECRET"

if [ -z "$PDF_SERVER_INTERNAL_TOKEN" ] || [ "${#PDF_SERVER_INTERNAL_TOKEN}" -lt 32 ] || looks_like_placeholder_secret "$PDF_SERVER_INTERNAL_TOKEN"; then
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
echo "[4/4] Running docker-migrate..."
node server/scripts/docker-migrate.js
node server/scripts/ensure-default-admin.js
verify_database_bootstrap_state

# =============================================================================
# Start all services via Supervisor
# =============================================================================
echo "Starting application servers..."
echo ""
echo "=============================================="
echo "  Services:"
echo "  - PostgreSQL:    ${POSTGRES_HOST:-postgres}:${POSTGRES_PORT:-5432} (external container)"
echo "  - Redis Cache:   ${CACHE_REDIS_URL:-redis://redis:6379} (external container)"
echo "  - Proxy Server:  https://localhost:3443"
echo "  - PDF Server:    http://localhost:3002 (internal)"
echo "=============================================="
echo ""
echo "Admin bootstrap credentials: configured via DEFAULT_ADMIN_*"
echo ""

exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
