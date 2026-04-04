@echo off
setlocal

set "COMPOSE_FILE=%~dp0docker-compose.redis.yml"
set "SERVICE_NAME=app"
set "CONTAINER_NAME=resumeconverter-app"
set "TARGET_CONTAINER="

echo ============================================
echo   ResumeConverter - Backend Server Logs
echo   Press Ctrl+C to exit
echo ============================================
echo.

for /f "delims=" %%i in ('docker compose -f "%COMPOSE_FILE%" ps -q %SERVICE_NAME% 2^>nul') do (
    set "TARGET_CONTAINER=%%i"
)

if not defined TARGET_CONTAINER (
    for /f "delims=" %%i in ('docker ps -q -f "name=^%CONTAINER_NAME^%" 2^>nul') do (
        set "TARGET_CONTAINER=%%i"
    )
)

if not defined TARGET_CONTAINER (
    echo No running backend container found.
    echo Start the stack with docker-run.bat, then retry.
    exit /b 1
)

echo Following proxy-server logs from container: %TARGET_CONTAINER%
echo.

docker exec -it "%TARGET_CONTAINER%" sh -lc "tail -n 100 -F /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log"
