@echo off
echo ============================================
echo   ResumeConverter - Stopping Stack
echo ============================================
echo.

docker compose -f "%cd%\docker-compose.redis.yml" down >nul 2>&1
docker stop resumeconverter-app >nul 2>&1
docker rm resumeconverter-app >nul 2>&1
docker stop resumeconverter-redis >nul 2>&1
docker rm resumeconverter-redis >nul 2>&1

echo.
echo Stack stopped and removed.
echo Run docker-run.bat to start again.
echo.

pause
