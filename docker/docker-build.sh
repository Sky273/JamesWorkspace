#!/bin/bash
# =============================================================================
# ResumeConverter - Docker Build Script (Linux/Mac)
# =============================================================================

IMAGE_NAME="resumeconverter"
CONTAINER_NAME="resumeconverter-app"
TAG="${TAG:-latest}"

wait_app_healthy() {
    echo ""
    echo "Waiting for application container health..."

    for attempt in $(seq 1 24); do
        container_state="$(docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" "$CONTAINER_NAME" 2>/dev/null || true)"
        if [ "$container_state" = "healthy" ]; then
            echo "Application container is healthy."
            return 0
        fi

        if [ "$container_state" != "running" ] && [ "$container_state" != "starting" ]; then
            echo "Application container entered unexpected state: ${container_state:-unknown}"
            exit 1
        fi

        if [ -z "$container_state" ]; then
            sleep 5
            continue
        fi

        echo "Health check attempt $attempt pending, current state: $container_state"
        sleep 5
    done

    echo "Application container did not become healthy after startup."
    exit 1
}

sync_postgres_role_password() {
    local postgres_user postgres_password postgres_db
    postgres_user="$(grep -E '^POSTGRES_USER=' "$(pwd)/.env.docker" | sed 's/^POSTGRES_USER=//')"
    postgres_password="$(grep -E '^POSTGRES_PASSWORD=' "$(pwd)/.env.docker" | sed 's/^POSTGRES_PASSWORD=//')"
    postgres_db="$(grep -E '^POSTGRES_DB=' "$(pwd)/.env.docker" | sed 's/^POSTGRES_DB=//')"
    local escaped_password
    escaped_password="$(printf "%s" "$postgres_password" | sed "s/'/''/g")"

    if [ -z "$postgres_user" ] || [ -z "$postgres_password" ] || [ -z "$postgres_db" ]; then
        echo "POSTGRES_USER, POSTGRES_PASSWORD, or POSTGRES_DB missing from .env.docker."
        exit 1
    fi

    echo ""
    echo "Synchronizing PostgreSQL role password inside Docker container..."

    for attempt in $(seq 1 24); do
        postgres_state="$(docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" resumeconverter-postgres 2>/dev/null || true)"
        if [ "$postgres_state" != "healthy" ]; then
            sleep 5
            continue
        fi

        if docker exec -u postgres resumeconverter-postgres psql -d postgres -v ON_ERROR_STOP=1 -c "ALTER ROLE $postgres_user WITH LOGIN SUPERUSER PASSWORD '$escaped_password';" \
            && docker exec -e "PGPASSWORD=$postgres_password" resumeconverter-postgres psql -h 127.0.0.1 -p 5432 -U "$postgres_user" -d "$postgres_db" -tAc "select 1" >/dev/null; then
            echo "PostgreSQL role password synchronized."
            return 0
        fi

        echo "PostgreSQL role sync attempt $attempt failed, retrying..."
        sleep 5
    done

    echo "Failed to synchronize PostgreSQL role password after container startup."
    exit 1
}

show_help() {
    echo ""
    echo "ResumeConverter Docker Management Script"
    echo "========================================"
    echo ""
    echo "Usage: ./docker-build.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build     Build the Docker image"
    echo "  run       Run the container (builds if needed)"
    echo "  stop      Stop the running container"
    echo "  logs      Show Proxy Server logs (main backend)"
    echo "  logs-pdf  Show PDF Server logs"
    echo "  shell     Open a shell in the running container"
    echo "  clean     Remove container and image"
    echo ""
    echo "Environment variables:"
    echo "  TAG=v1.7.7  Set image tag (default: latest)"
    echo ""
    echo "Examples:"
    echo "  ./docker-build.sh build"
    echo "  ./docker-build.sh run"
    echo "  TAG=v1.7.7 ./docker-build.sh run"
    echo ""
}

build_image() {
    if [ ! -f "$(pwd)/.env.docker" ]; then
        echo ""
        echo "Missing .env.docker file."
        echo "Create it from .env.example before building."
        exit 1
    fi

    local vite_turnstile_site_key cloudflare_turnstile_site_key
    vite_turnstile_site_key="$(grep -E '^VITE_TURNSTILE_SITE_KEY=' "$(pwd)/.env.docker" | sed 's/^VITE_TURNSTILE_SITE_KEY=//')"
    cloudflare_turnstile_site_key="$(grep -E '^CLOUDFLARE_TURNSTILE_SITE_KEY=' "$(pwd)/.env.docker" | sed 's/^CLOUDFLARE_TURNSTILE_SITE_KEY=//')"

    echo ""
    echo "Building Docker image: ${IMAGE_NAME}:${TAG}"
    echo "This may take several minutes on first build..."
    echo ""

    docker build \
        --build-arg "VITE_TURNSTILE_SITE_KEY=${vite_turnstile_site_key}" \
        --build-arg "CLOUDFLARE_TURNSTILE_SITE_KEY=${cloudflare_turnstile_site_key}" \
        -t "${IMAGE_NAME}:${TAG}" \
        -f Dockerfile .

    if [ $? -eq 0 ]; then
        echo ""
        echo "Build successful!"
        echo "Image: ${IMAGE_NAME}:${TAG}"
    else
        echo ""
        echo "Build failed!"
        exit 1
    fi
}

run_container() {
    if ! docker images -q "${IMAGE_NAME}:${TAG}" | grep -q .; then
        echo "Image not found, building..."
        build_image
    fi

    echo ""
    echo "Starting container: $CONTAINER_NAME"
    echo ""

    local compose_file
    compose_file="$(pwd)/docker-compose.redis.yml"

    mkdir -p "$(pwd)/data/postgresql"
    mkdir -p "$(pwd)/data/redis"
    mkdir -p "$(pwd)/uploads"
    mkdir -p "$(pwd)/logs"

    if [ ! -f "$(pwd)/.env.docker" ]; then
        echo ""
        echo "Missing .env.docker file."
        echo "Create it from .env.example before running the container."
        exit 1
    fi

    docker compose -f "$compose_file" stop app >/dev/null 2>&1 || true
    docker compose -f "$compose_file" rm -f app >/dev/null 2>&1 || true
    docker compose -f "$compose_file" up -d postgres redis

    if [ $? -eq 0 ]; then
        sync_postgres_role_password
        docker compose -f "$compose_file" up -d app
        if [ $? -ne 0 ]; then
            echo "Failed to start application container!"
            exit 1
        fi
        wait_app_healthy

        echo ""
        echo "Container started successfully!"
        echo ""
        echo "============================================"
        echo "  Application URLs: https://localhost and https://localhost:3443"
        echo "  PostgreSQL:      localhost:5433 -> compose service postgres"
        echo "  Redis:           localhost:6379 -> compose service redis"
        echo "  Database data:   ./data/postgresql"
        echo "  Config source:  .env.docker"
        echo "  Admin bootstrap credentials: configured via DEFAULT_ADMIN_* in .env.docker"
        echo "============================================"
        echo ""
        echo "Commands:"
        echo "  Proxy logs:   ./docker-build.sh logs"
        echo "  PDF logs:     ./docker-build.sh logs-pdf"
        echo "  Stop:         ./docker-build.sh stop"
        echo "  Shell access: ./docker-build.sh shell"
        echo ""
    else
        echo "Failed to start container!"
        exit 1
    fi
}

stop_container() {
    echo "Stopping compose stack..."
    docker compose -f "$(pwd)/docker-compose.redis.yml" down 2>/dev/null || true
    echo "Stack stopped."
}

show_logs() {
    echo "Showing Proxy Server logs for: $CONTAINER_NAME"
    echo "Press Ctrl+C to exit"
    echo "(For PDF server logs, use: ./docker-build.sh logs-pdf)"
    echo ""
    docker exec -it $CONTAINER_NAME tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log
}

show_logs_pdf() {
    echo "Showing PDF Server logs for: $CONTAINER_NAME"
    echo "Press Ctrl+C to exit"
    echo ""
    docker exec -it $CONTAINER_NAME tail -f /var/log/supervisor/pdf-server.out.log /var/log/supervisor/pdf-server.err.log
}

open_shell() {
    echo "Opening shell in: $CONTAINER_NAME"
    docker exec -it $CONTAINER_NAME /bin/bash
}

clean_all() {
    echo "Cleaning up Docker resources..."
    docker compose -f "$(pwd)/docker-compose.redis.yml" down 2>/dev/null || true
    docker rmi "${IMAGE_NAME}:${TAG}" 2>/dev/null
    echo "Cleanup complete."
}

case "$1" in
    build)
        build_image
        ;;
    run)
        run_container
        ;;
    stop)
        stop_container
        ;;
    logs)
        show_logs
        ;;
    logs-pdf)
        show_logs_pdf
        ;;
    shell)
        open_shell
        ;;
    clean)
        clean_all
        ;;
    *)
        show_help
        ;;
esac
