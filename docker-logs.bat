@echo off
echo ============================================
echo   ResumeConverter - Proxy Server Logs
echo   Press Ctrl+C to exit
echo ============================================
echo.

docker exec -it resumeconverter-app tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log
