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
    if [ ! -f "$(pwd)/.env.docker" ]; then
        echo ""
        echo "Missing .env.docker file."
        echo "Create it from .env.example with Docker-specific values before building."
        exit 1
    fi

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

    if [ ! -f "$(pwd)/.env.docker" ]; then
        echo ""
        echo "Missing .env.docker file."
        echo "Create it from .env.example with Docker-specific values before running the container."
        exit 1
    fi

    docker run -d \
        --name $CONTAINER_NAME \
        -p 443:3443 \
        -p 3443:3443 \
        --env-file "$(pwd)/.env.docker" \
        -e CACHE_REDIS_URL="redis://127.0.0.1:6379" \
        -e DISABLE_INTERNAL_REDIS="false" \
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
        echo "  Application URLs: https://localhost and https://localhost:3443"
        echo "  Database: ./data/postgresql (persistent local directory)"
        echo "  Config source:  .env.docker (runtime only, not baked into image)"
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
