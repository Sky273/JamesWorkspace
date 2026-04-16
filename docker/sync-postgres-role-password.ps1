param(
    [string]$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
)

$envFile = Join-Path $ProjectRoot ".env.docker"
if (-not (Test-Path $envFile)) {
    Write-Error "Missing .env.docker file at $envFile."
    exit 1
}

$envLines = Get-Content $envFile
$postgresUser = (($envLines | Where-Object { $_ -match '^POSTGRES_USER=' } | Select-Object -First 1) -replace '^POSTGRES_USER=', '')
$postgresPassword = (($envLines | Where-Object { $_ -match '^POSTGRES_PASSWORD=' } | Select-Object -First 1) -replace '^POSTGRES_PASSWORD=', '')
$postgresDb = (($envLines | Where-Object { $_ -match '^POSTGRES_DB=' } | Select-Object -First 1) -replace '^POSTGRES_DB=', '')

if (-not $postgresUser -or -not $postgresPassword -or -not $postgresDb) {
    Write-Error "POSTGRES_USER, POSTGRES_PASSWORD, or POSTGRES_DB missing from .env.docker."
    exit 1
}

$escapedPassword = $postgresPassword -replace "'", "''"
$sql = "ALTER ROLE {0} WITH LOGIN SUPERUSER PASSWORD '{1}';" -f $postgresUser, $escapedPassword

docker exec -u postgres resumeconverter-postgres psql -d postgres -v ON_ERROR_STOP=1 -c $sql
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

docker exec -e "PGPASSWORD=$postgresPassword" resumeconverter-postgres psql -h 127.0.0.1 -p 5432 -U $postgresUser -d $postgresDb -tAc "select 1" | Out-Null
exit $LASTEXITCODE
