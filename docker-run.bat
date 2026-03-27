@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   ResumeConverter - Starting Container
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

docker stop resumeconverter-app 2>nul
docker rm resumeconverter-app 2>nul

if not exist "%cd%\data\postgresql" mkdir "%cd%\data\postgresql"
if not exist "%cd%\uploads" mkdir "%cd%\uploads"
if not exist "%cd%\logs" mkdir "%cd%\logs"

docker run -d ^
    --name resumeconverter-app ^
    -p 3443:3443 ^
    -p 5433:5432 ^
    -v "%cd%\data\postgresql:/var/lib/postgresql/18/main" ^
    -v "%cd%\uploads:/app/uploads" ^
    -v "%cd%\logs:/app/logs" ^
    --restart unless-stopped ^
    resumeconverter:latest

if not %ERRORLEVEL% EQU 0 (
    echo.
    echo Failed to start container!
    echo Run docker-build.bat first if image doesn't exist.
    pause
    exit /b 1
)




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
echo.

pause