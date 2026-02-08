@echo off
echo ============================================
echo   ResumeConverter - Building Docker Image
echo ============================================
echo.

docker build -t resumeconverter:latest .

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ============================================
    echo   Build successful!
    echo   Run docker-run.bat to start the container
    echo ============================================
) else (
    echo.
    echo Build failed! Check the errors above.
)

pause
