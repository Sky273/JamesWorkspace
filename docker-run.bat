@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   ResumeConverter - Starting Stack
echo ============================================
echo.

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

docker compose -f "%cd%\docker-compose.redis.yml" down >nul 2>&1
docker stop resumeconverter-app 2>nul
docker rm resumeconverter-app 2>nul
docker stop resumeconverter-redis 2>nul
docker rm resumeconverter-redis 2>nul

if not exist "%cd%\data\postgresql" mkdir "%cd%\data\postgresql"
if not exist "%cd%\data\redis" mkdir "%cd%\data\redis"
if not exist "%cd%\uploads" mkdir "%cd%\uploads"
if not exist "%cd%\logs" mkdir "%cd%\logs"

docker compose -f "%cd%\docker-compose.redis.yml" up -d

if not %ERRORLEVEL% EQU 0 (
    echo.
    echo Failed to start stack!
    echo Run docker-build.bat first if image doesn't exist.
    pause
    exit /b 1
)




echo.
echo ============================================
echo   Stack started successfully!
echo.
echo   URL: https://localhost:3443
echo   Login: admin@resumeconverter.local
echo   Password: admin123
echo ============================================
echo.
echo   Commands:
echo   - docker-stop.bat  : Stop the stack
echo   - docker-logs.bat  : View logs
echo ============================================
echo.

pause
