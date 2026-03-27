@echo off
echo ============================================
echo   ResumeConverter - Stopping Container
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%cd%\docker\stop-ollama.ps1" -ContainerName "resumeconverter-app"

docker stop resumeconverter-app >nul 2>&1
docker rm resumeconverter-app >nul 2>&1

echo.
echo Container stopped and removed.
echo Ollama memory released. Installed models remain available.
echo Run docker-run.bat to start again.
echo.

pause