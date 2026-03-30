#!/bin/bash
# =============================================================================
# ResumeConverter - Docker Build Script (Linux/Mac)
# =============================================================================

IMAGE_NAME="resumeconverter"
CONTAINER_NAME="resumeconverter-app"
TAG="${TAG:-latest}"

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
    echo ""
    echo "Building Docker image: ${IMAGE_NAME}:${TAG}"
    echo "This may take several minutes on first build..."
    echo ""

    docker build -t "${IMAGE_NAME}:${TAG}" -f Dockerfile .

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
    if docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
        echo "Stopping existing container..."
        docker stop $CONTAINER_NAME 2>/dev/null
        docker rm $CONTAINER_NAME 2>/dev/null
    fi

    if ! docker images -q "${IMAGE_NAME}:${TAG}" | grep -q .; then
        echo "Image not found, building..."
        build_image
    fi

    echo ""
    echo "Starting container: $CONTAINER_NAME"
    echo ""

    mkdir -p "$(pwd)/data/postgresql"
    mkdir -p "$(pwd)/uploads"
    mkdir -p "$(pwd)/logs"

    JWT_SECRET_VAL="${JWT_SECRET:-docker-jwt-secret-change-in-production-min32chars}"
    JWT_REFRESH_SECRET_VAL="${JWT_REFRESH_SECRET:-docker-jwt-refresh-secret-change-in-production-min32chars}"
    REFRESH_TOKEN_SECRET_VAL="${REFRESH_TOKEN_SECRET:-docker-refresh-token-secret-change-in-production-min32chars}"
    CSRF_SECRET_VAL="${CSRF_SECRET:-docker-csrf-secret-change-in-production-min32chars}"
    PDF_SERVER_INTERNAL_TOKEN_VAL="${PDF_SERVER_INTERNAL_TOKEN:-docker-pdf-server-internal-token-change-in-production-min32chars}"

    docker run -d \
        --name $CONTAINER_NAME \
        -p 3443:3443 \
        -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
        -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
        -e JWT_SECRET="${JWT_SECRET_VAL}" \
        -e JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET_VAL}" \
        -e REFRESH_TOKEN_SECRET="${REFRESH_TOKEN_SECRET_VAL}" \
        -e CSRF_SECRET="${CSRF_SECRET_VAL}" \
        -e PDF_SERVER_INTERNAL_TOKEN="${PDF_SERVER_INTERNAL_TOKEN_VAL}" \
        -e GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID}" \
        -e GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET}" \
        -e MAIL_TOKEN_ENCRYPTION_KEY="${MAIL_TOKEN_ENCRYPTION_KEY}" \
        -v "$(pwd)/data/postgresql:/var/lib/postgresql/18/main" \
        -v "$(pwd)/uploads:/app/uploads" \
        -v "$(pwd)/logs:/app/logs" \
        --restart unless-stopped \
        "${IMAGE_NAME}:${TAG}"

    if [ $? -eq 0 ]; then
        echo ""
        echo "Container started successfully!"
        echo ""
        echo "============================================"
        echo "  Application URL: https://localhost:3443"
        echo "  Database: ./data/postgresql (persistent local directory)"
        echo "  Default login:   admin@resumeconverter.local"
        echo "  Default password: admin123"
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
    echo "Stopping container: $CONTAINER_NAME"
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null
    echo "Container stopped."
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
    docker stop $CONTAINER_NAME 2>/dev/null
    docker rm $CONTAINER_NAME 2>/dev/null
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
