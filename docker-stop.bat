@echo off
echo ============================================
echo   ResumeConverter - Stopping Container
echo ============================================
echo.

docker stop resumeconverter-app >nul 2>&1
docker rm resumeconverter-app >nul 2>&1

echo.
echo Container stopped and removed.
echo Run docker-run.bat to start again.
echo.

pause
