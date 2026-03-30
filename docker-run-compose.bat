@echo off
echo ============================================
echo   ResumeConverter - Legacy Alias
echo ============================================
echo.
echo docker-run-compose.bat is now an alias of docker-run.bat.
echo The standard workflow already starts the multi-service stack with external Redis.
echo.
call "%~dp0docker-run.bat"
