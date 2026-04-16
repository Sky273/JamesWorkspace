@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   ResumeConverter - Starting Stack
echo ============================================
echo.

echo Checking host ports...
netsh interface portproxy delete v4tov4 listenport=443 listenaddress=0.0.0.0 >nul 2>&1
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /r /c:":443 .*LISTENING"') do (
    echo   ERROR: Host port 443 is already in use by PID %%p.
    echo   Stop the conflicting service before starting the stack.
    pause
    exit /b 1
)
echo   Host ports 443 and 3443 are available for Docker publishing.
echo.

route print 0.0.0.0 | findstr /C:"NordLynx" >nul 2>&1
if not errorlevel 1 (
    echo   WARNING: Default route is currently using NordLynx.
    echo   Public access via Cloudflare may fail while VPN is the active gateway.
    echo   Disable VPN or configure split tunneling before exposing this host to the internet.
    echo.
)

if not exist "%cd%\data\postgresql" mkdir "%cd%\data\postgresql"
if not exist "%cd%\data\redis" mkdir "%cd%\data\redis"
if not exist "%cd%\uploads" mkdir "%cd%\uploads"
if not exist "%cd%\logs" mkdir "%cd%\logs"
if not exist "%cd%\.env.docker" (
    echo.
    echo Missing .env.docker file.
    echo Create it from .env.example before starting the stack.
    pause
    exit /b 1
)

set "POSTGRES_USER="
set "POSTGRES_PASSWORD="
for /f "tokens=1,* delims==" %%A in ('findstr /b "POSTGRES_USER=" "%cd%\.env.docker"') do set "POSTGRES_USER=%%B"
for /f "tokens=1,* delims==" %%A in ('findstr /b "POSTGRES_PASSWORD=" "%cd%\.env.docker"') do set "POSTGRES_PASSWORD=%%B"

docker compose -f "%cd%\docker-compose.redis.yml" stop app >nul 2>&1
docker compose -f "%cd%\docker-compose.redis.yml" rm -f app >nul 2>&1

docker compose -f "%cd%\docker-compose.redis.yml" up -d postgres redis

if not %ERRORLEVEL% EQU 0 (
    echo.
    echo Failed to start stack!
    echo Run docker-build.bat first if image doesn't exist.
    pause
    exit /b 1
)

echo.
echo Synchronizing PostgreSQL role password inside Docker container...
set "PG_SYNC_OK="
for /L %%i in (1,1,24) do (
    for /f "usebackq delims=" %%s in (`docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" resumeconverter-postgres 2^>nul`) do set "POSTGRES_STATE=%%s"
    if /I "!POSTGRES_STATE!"=="healthy" (
        powershell -NoProfile -ExecutionPolicy Bypass -File "%cd%\docker\sync-postgres-role-password.ps1" -ProjectRoot "%cd%"
        if !ERRORLEVEL! EQU 0 (
            set "PG_SYNC_OK=1"
            goto :postgres_sync_done
        )
        echo PostgreSQL role sync attempt %%i failed, retrying...
    )
    timeout /t 5 /nobreak >nul
)

:postgres_sync_done
if not defined PG_SYNC_OK (
    echo.
    echo Failed to synchronize PostgreSQL role password after container startup!
    pause
    exit /b 1
)

echo PostgreSQL role password synchronized.

echo.
echo Starting application container...
docker compose -f "%cd%\docker-compose.redis.yml" up -d app

if not %ERRORLEVEL% EQU 0 (
    echo.
    echo Failed to start application container!
    pause
    exit /b 1
)

echo.
echo Waiting for application container health...
set "APP_HEALTH_OK="
for /L %%i in (1,1,24) do (
    for /f "usebackq delims=" %%s in (`docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" resumeconverter-app 2^>nul`) do set "CONTAINER_STATE=%%s"
    if /I "!CONTAINER_STATE!"=="healthy" (
        set "APP_HEALTH_OK=1"
        goto :app_ready
    )
    if /I not "!CONTAINER_STATE!"=="running" if /I not "!CONTAINER_STATE!"=="starting" (
        echo Application container entered unexpected state: !CONTAINER_STATE!
        pause
        exit /b 1
    )
    echo Health check attempt %%i pending, current state: !CONTAINER_STATE!
    timeout /t 5 /nobreak >nul
)

:app_ready
if not defined APP_HEALTH_OK (
    echo.
    echo Application container did not become healthy after startup!
    pause
    exit /b 1
)

echo Application container is healthy.

echo.
echo ============================================
echo   Stack started successfully!
echo.
echo   URLs: https://localhost and https://localhost:3443
echo   Admin bootstrap credentials come from DEFAULT_ADMIN_* in .env.docker
echo ============================================
echo.
echo   Commands:
echo   - docker-stop.bat  : Stop the stack
echo   - docker-logs.bat  : View logs
echo ============================================
echo.

pause
