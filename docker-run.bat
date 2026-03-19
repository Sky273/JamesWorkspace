@echo off
echo ============================================
echo   ResumeConverter - Starting Container
echo ============================================
echo.

REM ============================================
REM Port Proxy Setup for Cloudflare/External Access
REM Cloudflare (Full SSL) connects to origin on port 443.
REM Freebox NAT forwards WAN:443 to LAN:443.
REM Portproxy forwards port 443 to localhost:3443 (Docker).
REM This avoids conflicts with Docker's own port 3443 binding.
REM Requires: Freebox NAT WAN 443 -> LAN 443 (not 3443)
REM ============================================
echo Configuring port forwarding (443 -^> localhost:3443)...
netsh interface portproxy delete v4tov4 listenport=3443 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy delete v4tov4 listenport=443 listenaddress=0.0.0.0 >nul 2>&1
netsh interface portproxy add v4tov4 listenport=443 listenaddress=0.0.0.0 connectport=3443 connectaddress=127.0.0.1
if errorlevel 1 goto :portproxy_fail
echo   Port proxy: 0.0.0.0:443 -^> 127.0.0.1:3443
goto :portproxy_done
:portproxy_fail
echo   WARNING: Port proxy failed. Run this script as Administrator
echo   for external access via Cloudflare/internet.
:portproxy_done
echo.

REM Stop and remove existing container if running
docker stop resumeconverter-app 2>nul
docker rm resumeconverter-app 2>nul

REM Create data directories if they don't exist
if not exist "%cd%\data\postgresql" mkdir "%cd%\data\postgresql"
if not exist "%cd%\uploads" mkdir "%cd%\uploads"
if not exist "%cd%\logs" mkdir "%cd%\logs"

REM Start new container
REM Note: Stop local dev server before running Docker to avoid port conflicts
REM PostgreSQL data is persisted in ./data/postgresql (survives rebuilds)
docker run -d ^
    --name resumeconverter-app ^
    -p 3443:3443 ^
    -p 5433:5432 ^
    -v "%cd%\data\postgresql:/var/lib/postgresql/18/main" ^
    -v "%cd%\uploads:/app/uploads" ^
    -v "%cd%\logs:/app/logs" ^
    --restart unless-stopped ^
    resumeconverter:latest

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   Container started successfully!
    echo.
    echo   URL: https://localhost:3443
    echo   Login: admin@resumeconverter.local
    echo   Password: admin123
    echo ============================================
    echo.
    echo   Commands:
    echo   - docker-stop.bat  : Stop the container
    echo   - docker-logs.bat  : View logs
    echo ============================================
) else (
    echo.
    echo Failed to start container!
    echo Run docker-build.bat first if image doesn't exist.
)

pause
