# =============================================================================
# ResumeConverter - Docker Build Script (Windows PowerShell)
# =============================================================================

param(
    [switch]$Build,
    [switch]$Run,
    [switch]$Stop,
    [switch]$Logs,
    [switch]$Shell,
    [switch]$Clean,
    [string]$Tag = "latest"
)

$ImageName = "resumeconverter"
$ContainerName = "resumeconverter-app"

function Wait-AppHealthy {
    Write-Host ""
    Write-Host "Waiting for application container health..." -ForegroundColor Yellow

    for ($attempt = 1; $attempt -le 24; $attempt++) {
        $containerState = docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $ContainerName 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $containerState) {
            Start-Sleep -Seconds 5
            continue
        }

        if ($containerState.Trim() -eq "healthy") {
            Write-Host "Application container is healthy." -ForegroundColor Green
            return
        }

        if ($containerState.Trim() -ne "running" -and $containerState.Trim() -ne "starting") {
            Write-Host "Application container entered unexpected state: $($containerState.Trim())" -ForegroundColor Red
            exit 1
        }

        Write-Host "Health check attempt $attempt pending, current state: $($containerState.Trim())" -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    Write-Host "Application container did not become healthy after startup." -ForegroundColor Red
    exit 1
}

function Sync-PostgresRolePassword {
    Write-Host ""
    Write-Host "Synchronizing PostgreSQL role password inside Docker container..." -ForegroundColor Yellow

    for ($attempt = 1; $attempt -le 24; $attempt++) {
        $postgresState = docker inspect -f "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" resumeconverter-postgres 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $postgresState) {
            Start-Sleep -Seconds 5
            continue
        }

        if ($postgresState.Trim() -ne "healthy") {
            Start-Sleep -Seconds 5
            continue
        }

        powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PWD "docker\sync-postgres-role-password.ps1") -ProjectRoot $PWD
        if ($LASTEXITCODE -eq 0) {
            Write-Host "PostgreSQL role password synchronized." -ForegroundColor Green
            return
        }

        Write-Host "PostgreSQL role sync attempt $attempt failed, retrying..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }

    Write-Host "Failed to synchronize PostgreSQL role password after container startup." -ForegroundColor Red
    exit 1
}

function Show-Help {
    Write-Host ""
    Write-Host "ResumeConverter Docker Management Script" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\docker-build.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Build     Build the Docker image"
    Write-Host "  -Run       Run the container (builds if needed)"
    Write-Host "  -Stop      Stop the running container"
    Write-Host "  -Logs      Show container logs"
    Write-Host "  -Shell     Open a shell in the running container"
    Write-Host "  -Clean     Remove container and image"
    Write-Host "  -Tag       Image tag (default: latest)"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\docker-build.ps1 -Build           # Build the image"
    Write-Host "  .\docker-build.ps1 -Run             # Build and run"
    Write-Host "  .\docker-build.ps1 -Run -Tag v1.7.7 # Run with specific tag"
    Write-Host "  .\docker-build.ps1 -Logs            # View logs"
    Write-Host "  .\docker-build.ps1 -Stop            # Stop container"
    Write-Host "  .\docker-build.ps1 -Clean           # Remove everything"
    Write-Host ""
}

function Build-Image {
    $EnvFile = Join-Path $PWD ".env.docker"
    if (-not (Test-Path $EnvFile)) {
        Write-Host ""
        Write-Host "Missing .env.docker file." -ForegroundColor Red
        Write-Host "Create it from .env.example before building." -ForegroundColor Yellow
        exit 1
    }

    $envLines = Get-Content $EnvFile
    $viteTurnstileSiteKey = (($envLines | Where-Object { $_ -match '^VITE_TURNSTILE_SITE_KEY=' } | Select-Object -First 1) -replace '^VITE_TURNSTILE_SITE_KEY=', '')
    $cloudflareTurnstileSiteKey = (($envLines | Where-Object { $_ -match '^CLOUDFLARE_TURNSTILE_SITE_KEY=' } | Select-Object -First 1) -replace '^CLOUDFLARE_TURNSTILE_SITE_KEY=', '')

    Write-Host ""
    Write-Host "Building Docker image: ${ImageName}:${Tag}" -ForegroundColor Green
    Write-Host "This may take several minutes on first build..." -ForegroundColor Yellow
    Write-Host ""

    docker build `
        --build-arg "VITE_TURNSTILE_SITE_KEY=$viteTurnstileSiteKey" `
        --build-arg "CLOUDFLARE_TURNSTILE_SITE_KEY=$cloudflareTurnstileSiteKey" `
        -t "${ImageName}:${Tag}" `
        -f Dockerfile .

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Build successful!" -ForegroundColor Green
        Write-Host "Image: ${ImageName}:${Tag}" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
}

function Run-Container {
    $imageExists = docker images -q "${ImageName}:${Tag}"
    if (-not $imageExists) {
        Write-Host "Image not found, building..." -ForegroundColor Yellow
        Build-Image
    }

    Write-Host ""
    Write-Host "Starting container: $ContainerName" -ForegroundColor Green
    Write-Host ""

    $ComposeFile = Join-Path $PWD "docker-compose.redis.yml"
    $DataDir = Join-Path $PWD "data\postgresql"
    $RedisDataDir = Join-Path $PWD "data\redis"
    $UploadsDir = Join-Path $PWD "uploads"
    $LogsDir = Join-Path $PWD "logs"

    if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
    if (-not (Test-Path $RedisDataDir)) { New-Item -ItemType Directory -Path $RedisDataDir -Force | Out-Null }
    if (-not (Test-Path $UploadsDir)) { New-Item -ItemType Directory -Path $UploadsDir -Force | Out-Null }
    if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

    $EnvFile = Join-Path $PWD ".env.docker"
    if (-not (Test-Path $EnvFile)) {
        Write-Host ""
        Write-Host "Missing .env.docker file." -ForegroundColor Red
        Write-Host "Create it from .env.example before running the container." -ForegroundColor Yellow
        exit 1
    }

    docker compose -f "$ComposeFile" stop app >$null 2>&1
    docker compose -f "$ComposeFile" rm -f app >$null 2>&1
    docker compose -f "$ComposeFile" up -d postgres redis

    if ($LASTEXITCODE -eq 0) {
        Sync-PostgresRolePassword
        docker compose -f "$ComposeFile" up -d app
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to start application container!" -ForegroundColor Red
            exit 1
        }
        Wait-AppHealthy

        Write-Host ""
        Write-Host "Container started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "  Application URLs: https://localhost and https://localhost:3443" -ForegroundColor White
        Write-Host "  PostgreSQL:      localhost:5433 -> compose service postgres" -ForegroundColor White
        Write-Host "  Redis:           localhost:6379 -> compose service redis" -ForegroundColor White
        Write-Host "  Database data:   ./data/postgresql" -ForegroundColor White
        Write-Host "  Config source:  .env.docker" -ForegroundColor White
        Write-Host "  Admin bootstrap credentials: configured via DEFAULT_ADMIN_* in .env.docker" -ForegroundColor White
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Commands:"
        Write-Host "  Proxy logs:   docker-logs.bat (or .\docker-build.ps1 -Logs)"
        Write-Host "  PDF logs:     docker-logs-pdf.bat"
        Write-Host "  Stop:         .\docker-build.ps1 -Stop"
        Write-Host "  Shell access: .\docker-build.ps1 -Shell"
        Write-Host ""
    } else {
        Write-Host "Failed to start container!" -ForegroundColor Red
        exit 1
    }
}

function Stop-Container {
    $ComposeFile = Join-Path $PWD "docker-compose.redis.yml"
    Write-Host "Stopping compose stack..." -ForegroundColor Yellow
    docker compose -f "$ComposeFile" down 2>$null
    Write-Host "Stack stopped." -ForegroundColor Green
}

function Show-Logs {
    Write-Host "Showing Proxy Server logs for: $ContainerName" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to exit" -ForegroundColor Yellow
    Write-Host "(For PDF server logs, use: docker-logs-pdf.bat)" -ForegroundColor Gray
    Write-Host ""
    docker exec -it $ContainerName tail -f /var/log/supervisor/proxy-server.out.log /var/log/supervisor/proxy-server.err.log
}

function Open-Shell {
    Write-Host "Opening shell in: $ContainerName" -ForegroundColor Cyan
    docker exec -it $ContainerName /bin/bash
}

function Clean-All {
    Write-Host "Cleaning up Docker resources..." -ForegroundColor Yellow

    $ComposeFile = Join-Path $PWD "docker-compose.redis.yml"
    docker compose -f "$ComposeFile" down 2>$null
    docker rmi "${ImageName}:${Tag}" 2>$null

    Write-Host "Cleanup complete." -ForegroundColor Green
}

if ($Build) {
    Build-Image
} elseif ($Run) {
    Run-Container
} elseif ($Stop) {
    Stop-Container
} elseif ($Logs) {
    Show-Logs
} elseif ($Shell) {
    Open-Shell
} elseif ($Clean) {
    Clean-All
} else {
    Show-Help
}
