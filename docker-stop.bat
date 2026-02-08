@echo off
echo ============================================
echo   ResumeConverter - Stopping Container
echo ============================================
echo.

docker stop resumeconverter-app
docker rm resumeconverter-app

echo.
echo Container stopped and removed.
echo Run docker-run.bat to start again.
echo.

pause
