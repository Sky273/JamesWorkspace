@echo off
setlocal

echo ============================================
echo   ResumeConverter - Build Docker Image
echo ============================================
echo.

set "SCRIPT_DIR=%~dp0"
set "PS_SCRIPT=%SCRIPT_DIR%docker\docker-build.ps1"
set "RUN_SCRIPT=%SCRIPT_DIR%docker-run.bat"

if not exist "%PS_SCRIPT%" (
    echo PowerShell script not found: %PS_SCRIPT%
    exit /b 1
)

if not exist "%RUN_SCRIPT%" (
    echo Run script not found: %RUN_SCRIPT%
    exit /b 1
)

echo [1/2] Building Docker image...
powershell -ExecutionPolicy Bypass -File "%PS_SCRIPT%" -Build
if errorlevel 1 (
    echo.
    echo Build failed! Check the errors above.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting stack via docker-run.bat...
call "%RUN_SCRIPT%"
if errorlevel 1 (
    echo.
    echo Stack startup failed! Check the errors above.
    pause
    exit /b 1
)
