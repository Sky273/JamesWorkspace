@echo off
echo ============================================
echo   ResumeConverter - Legacy Alias
echo ============================================
echo.
echo docker-stop-compose.bat is now an alias of docker-stop.bat.
echo The standard workflow already stops the full multi-service stack.
echo.
call "%~dp0docker-stop.bat"
