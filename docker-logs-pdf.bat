@echo off
echo ============================================
echo   ResumeConverter - PDF Server Logs
echo   Press Ctrl+C to exit
echo ============================================
echo.

docker exec -it resumeconverter-app tail -f /var/log/supervisor/pdf-server.out.log /var/log/supervisor/pdf-server.err.log
