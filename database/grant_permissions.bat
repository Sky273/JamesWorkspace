@echo off
REM ============================================
REM Grant permissions to PostgreSQL user (Windows)
REM Uses environment variables from .env
REM ============================================

REM Find PostgreSQL installation
set "PSQL_PATH="
if exist "C:\Program Files\PostgreSQL\16\bin\psql.exe" set "PSQL_PATH=C:\Program Files\PostgreSQL\16\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\15\bin\psql.exe" set "PSQL_PATH=C:\Program Files\PostgreSQL\15\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\14\bin\psql.exe" set "PSQL_PATH=C:\Program Files\PostgreSQL\14\bin\psql.exe"
if exist "C:\Program Files\PostgreSQL\13\bin\psql.exe" set "PSQL_PATH=C:\Program Files\PostgreSQL\13\bin\psql.exe"

if "%PSQL_PATH%"=="" (
    echo Error: PostgreSQL psql.exe not found in standard locations
    echo Please add PostgreSQL bin directory to your PATH or edit this script
    exit /b 1
)

echo Using PostgreSQL: %PSQL_PATH%

REM Load .env file if it exists
cd /d "%~dp0.."
if exist .env (
    for /f "usebackq tokens=1,2 delims==" %%a in (".env") do (
        if not "%%a"=="" (
            set "LINE=%%a"
            setlocal enabledelayedexpansion
            if not "!LINE:~0,1!"=="#" (
                endlocal
                set "%%a=%%b"
            ) else (
                endlocal
            )
        )
    )
)

REM Check if required variables are set
if "%POSTGRES_USER%"=="" (
    echo Error: POSTGRES_USER environment variable is not set in .env
    exit /b 1
)

if "%POSTGRES_DB%"=="" (
    echo Error: POSTGRES_DB environment variable is not set in .env
    exit /b 1
)

echo.
echo Granting permissions to user: %POSTGRES_USER%
echo Database: %POSTGRES_DB%
echo.

REM Execute SQL commands using environment variables
"%PSQL_PATH%" -U postgres -d %POSTGRES_DB% -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %POSTGRES_USER%;"
"%PSQL_PATH%" -U postgres -d %POSTGRES_DB% -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %POSTGRES_USER%;"
"%PSQL_PATH%" -U postgres -d %POSTGRES_DB% -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %POSTGRES_USER%;"
"%PSQL_PATH%" -U postgres -d %POSTGRES_DB% -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO %POSTGRES_USER%;"

echo.
echo Verifying permissions...
"%PSQL_PATH%" -U postgres -d %POSTGRES_DB% -c "SELECT grantee, table_schema, table_name, privilege_type FROM information_schema.table_privileges WHERE grantee = '%POSTGRES_USER%' ORDER BY table_name, privilege_type;"

echo.
echo Permissions granted successfully to %POSTGRES_USER%
