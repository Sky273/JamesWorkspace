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
echo   URLs: https://localhost and https://localhost:3443
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
