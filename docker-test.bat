@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "CONTAINER=resumeconverter-app"
set "BASE_URL=http://127.0.0.1:3443"

:menu
cls
echo ============================================
echo   ResumeConverter - Docker Test Helper
echo ============================================
echo.
echo Container cible : %CONTAINER%
echo URL locale      : %BASE_URL%
echo.
echo  1. Verifications rapides Docker + container
echo  2. Health checks applicatifs
echo  3. Executer docker-migrate
echo  4. Tests backend
echo  5. Tests client
echo  6. Tests PDF
echo  7. Typecheck
echo  8. Build client
echo  9. Tests E2E
echo 10. Suite complete hors E2E
echo 11. Afficher les logs applicatifs
echo 12. Ouvrir un shell dans le container
echo  0. Quitter
echo.
set /p "CHOICE=Choix: "

if "%CHOICE%"=="1" goto quick_checks
if "%CHOICE%"=="2" goto health_checks
if "%CHOICE%"=="3" goto docker_migrate
if "%CHOICE%"=="4" goto test_backend
if "%CHOICE%"=="5" goto test_client
if "%CHOICE%"=="6" goto test_pdf
if "%CHOICE%"=="7" goto typecheck
if "%CHOICE%"=="8" goto build_client
if "%CHOICE%"=="9" goto test_e2e
if "%CHOICE%"=="10" goto full_suite
if "%CHOICE%"=="11" goto logs
if "%CHOICE%"=="12" goto shell
if "%CHOICE%"=="0" goto end

echo.
echo Choix invalide.
pause
goto menu

:require_docker
docker version >nul 2>&1
if errorlevel 1 (
    echo Docker n'est pas disponible.
    exit /b 1
)
exit /b 0

:require_container
call :require_docker
if errorlevel 1 exit /b 1

for /f "delims=" %%I in ('docker inspect -f "{{.State.Status}}" %CONTAINER% 2^>nul') do set "CONTAINER_STATUS=%%I"
if not defined CONTAINER_STATUS (
    echo Le container %CONTAINER% n'existe pas.
    echo Lance d'abord docker-run.bat
    exit /b 1
)

if /I not "%CONTAINER_STATUS%"=="running" (
    echo Le container %CONTAINER% existe mais n'est pas en cours d'execution.
    echo Etat actuel : %CONTAINER_STATUS%
    exit /b 1
)
exit /b 0

:quick_checks
cls
echo ============================================
echo   Verifications rapides
echo ============================================
echo.
call :require_container
if errorlevel 1 goto pause_and_menu

echo [OK] Docker et container actifs
docker ps --filter "name=%CONTAINER%"
echo.
echo Verifications internes...
docker exec %CONTAINER% sh -lc "node --version && npm --version && pwd && ls /app"
goto pause_and_menu

:health_checks
cls
echo ============================================
echo   Health checks
echo ============================================
echo.
call :require_container
if errorlevel 1 goto pause_and_menu

echo Test HTTP depuis l'hote...
curl -k -I https://127.0.0.1:3443/ >nul 2>&1
if errorlevel 1 (
    echo [WARN] HTTPS local indisponible sur https://127.0.0.1:3443/
) else (
    echo [OK] HTTPS local repond sur https://127.0.0.1:3443/
)

echo.
echo Test HTTP depuis le container...
docker exec %CONTAINER% sh -lc "wget -qO- http://127.0.0.1:3000/api/health || wget -qO- http://127.0.0.1:3443/api/health || true"
echo.
echo Dernieres erreurs proxy:
docker exec %CONTAINER% sh -lc "tail -n 50 /var/log/supervisor/proxy-server.err.log"
goto pause_and_menu

:docker_migrate
cls
echo ============================================
echo   Docker migrate
echo ============================================
echo.
npm run docker-migrate
goto pause_and_menu

:test_backend
cls
echo ============================================
echo   Tests backend
echo ============================================
echo.
npm run test
goto pause_and_menu

:test_client
cls
echo ============================================
echo   Tests client
echo ============================================
echo.
npm run test:client
goto pause_and_menu

:test_pdf
cls
echo ============================================
echo   Tests PDF
echo ============================================
echo.
npm run test:pdf
goto pause_and_menu

:typecheck
cls
echo ============================================
echo   Typecheck
echo ============================================
echo.
npm run typecheck
goto pause_and_menu

:build_client
cls
echo ============================================
echo   Build client
echo ============================================
echo.
npm run build
goto pause_and_menu

:test_e2e
cls
echo ============================================
echo   Tests E2E
echo ============================================
echo.
echo Assure-toi que le container est demarre et accessible avant cette etape.
npm run test:e2e
goto pause_and_menu

:full_suite
cls
echo ============================================
echo   Suite complete hors E2E
echo ============================================
echo.
call :require_container
if errorlevel 1 goto pause_and_menu

call :run_step "docker-migrate" "npm run docker-migrate" || goto step_failed
call :run_step "typecheck" "npm run typecheck" || goto step_failed
call :run_step "tests backend" "npm run test" || goto step_failed
call :run_step "tests client" "npm run test:client" || goto step_failed
call :run_step "tests pdf" "npm run test:pdf" || goto step_failed
call :run_step "build client" "npm run build" || goto step_failed

echo.
echo Suite complete terminee avec succes.
goto pause_and_menu

:logs
cls
echo ============================================
echo   Logs applicatifs
echo ============================================
echo.
call :require_container
if errorlevel 1 goto pause_and_menu
docker exec -it %CONTAINER% sh -lc "tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log /var/log/supervisor/pdf-server.out.log /var/log/supervisor/pdf-server.err.log"
goto menu

:shell
cls
echo ============================================
echo   Shell container
echo ============================================
echo.
call :require_container
if errorlevel 1 goto pause_and_menu
docker exec -it %CONTAINER% /bin/bash
goto menu

:run_step
set "STEP_NAME=%~1"
set "STEP_CMD=%~2"
echo --------------------------------------------
echo Etape: %STEP_NAME%
echo Commande: %STEP_CMD%
echo --------------------------------------------
call %STEP_CMD%
if errorlevel 1 exit /b 1
exit /b 0

:step_failed
echo.
echo Echec dans la suite complete.
goto pause_and_menu

:pause_and_menu
echo.
pause
goto menu

:end
endlocal
exit /b 0
