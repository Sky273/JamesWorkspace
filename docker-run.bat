@echo off
echo ============================================
echo   ResumeConverter - Starting Container
echo ============================================
echo.

REM Stop and remove existing container if running
docker stop resumeconverter-app 2>nul
docker rm resumeconverter-app 2>nul

REM Start new container
REM Note: Stop local dev server before running Docker to avoid port conflicts
docker run -d ^
    --name resumeconverter-app ^
    -p 3443:3443 ^
    -p 5433:5432 ^
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
