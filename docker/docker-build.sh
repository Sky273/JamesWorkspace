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
    echo "  logs      Show container logs"
    echo "  shell     Open a shell in the running container"
    echo "  clean     Remove container and image"
    echo ""
    echo "Environment variables:"
    echo "  TAG=v1.5.7  Set image tag (default: latest)"
    echo ""
    echo "Examples:"
    echo "  ./docker-build.sh build"
    echo "  ./docker-build.sh run"
    echo "  TAG=v1.5.7 ./docker-build.sh run"
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
    # Check if container exists
    if docker ps -aq -f name=$CONTAINER_NAME | grep -q .; then
        echo "Stopping existing container..."
        docker stop $CONTAINER_NAME 2>/dev/null
        docker rm $CONTAINER_NAME 2>/dev/null
    fi
    
    # Check if image exists, build if not
    if ! docker images -q "${IMAGE_NAME}:${TAG}" | grep -q .; then
        echo "Image not found, building..."
        build_image
    fi
    
    echo ""
    echo "Starting container: $CONTAINER_NAME"
    echo ""
    
    # Create named volume for PostgreSQL data persistence
    docker volume create resumeconverter-pgdata 2>/dev/null
    
    docker run -d \
        --name $CONTAINER_NAME \
        -p 3443:3443 \
        -e OPENAI_API_KEY="${OPENAI_API_KEY}" \
        -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
        -e JWT_SECRET="docker-jwt-secret-$(date +%s)" \
        -e JWT_REFRESH_SECRET="docker-jwt-refresh-$(date +%s)" \
        -v "resumeconverter-pgdata:/var/lib/postgresql/14/main" \
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
        echo "  Database Volume: resumeconverter-pgdata (persistent)"
        echo "  Default login:   admin@resumeconverter.local"
        echo "  Default password: admin123"
        echo "============================================"
        echo ""
        echo "Commands:"
        echo "  View logs:    ./docker-build.sh logs"
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
    echo "Showing logs for: $CONTAINER_NAME"
    echo "Press Ctrl+C to exit"
    echo ""
    docker logs -f $CONTAINER_NAME
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

# Main logic
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
