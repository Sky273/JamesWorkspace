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
    Write-Host ""
    Write-Host "Building Docker image: ${ImageName}:${Tag}" -ForegroundColor Green
    Write-Host "This may take several minutes on first build..." -ForegroundColor Yellow
    Write-Host ""

    docker build -t "${ImageName}:${Tag}" -f Dockerfile .

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
    $existing = docker ps -aq -f name=$ContainerName
    if ($existing) {
        Write-Host "Stopping existing container..." -ForegroundColor Yellow
        docker stop $ContainerName 2>$null
        docker rm $ContainerName 2>$null
    }

    $imageExists = docker images -q "${ImageName}:${Tag}"
    if (-not $imageExists) {
        Write-Host "Image not found, building..." -ForegroundColor Yellow
        Build-Image
    }

    Write-Host ""
    Write-Host "Starting container: $ContainerName" -ForegroundColor Green
    Write-Host ""

    $DataDir = Join-Path $PWD "data\postgresql"
    $UploadsDir = Join-Path $PWD "uploads"
    $LogsDir = Join-Path $PWD "logs"

    if (-not (Test-Path $DataDir)) { New-Item -ItemType Directory -Path $DataDir -Force | Out-Null }
    if (-not (Test-Path $UploadsDir)) { New-Item -ItemType Directory -Path $UploadsDir -Force | Out-Null }
    if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

    $JwtSecret = if ($env:JWT_SECRET) { $env:JWT_SECRET } else { "docker-jwt-secret-change-in-production-min32chars" }
    $JwtRefreshSecret = if ($env:JWT_REFRESH_SECRET) { $env:JWT_REFRESH_SECRET } else { "docker-jwt-refresh-secret-change-in-production-min32chars" }
    $RefreshTokenSecret = if ($env:REFRESH_TOKEN_SECRET) { $env:REFRESH_TOKEN_SECRET } else { "docker-refresh-token-secret-change-in-production-min32chars" }
    $CsrfSecret = if ($env:CSRF_SECRET) { $env:CSRF_SECRET } else { "docker-csrf-secret-change-in-production-min32chars" }
    $PdfServerInternalToken = if ($env:PDF_SERVER_INTERNAL_TOKEN) { $env:PDF_SERVER_INTERNAL_TOKEN } else { "docker-pdf-server-internal-token-change-in-production-min32chars" }

    docker run -d `
        --name $ContainerName `
        -p 3443:3443 `
        -e OPENAI_API_KEY=$env:OPENAI_API_KEY `
        -e ANTHROPIC_API_KEY=$env:ANTHROPIC_API_KEY `
        -e JWT_SECRET="$JwtSecret" `
        -e JWT_REFRESH_SECRET="$JwtRefreshSecret" `
        -e REFRESH_TOKEN_SECRET="$RefreshTokenSecret" `
        -e CSRF_SECRET="$CsrfSecret" `
        -e PDF_SERVER_INTERNAL_TOKEN="$PdfServerInternalToken" `
        -e GOOGLE_CLIENT_ID=$env:GOOGLE_CLIENT_ID `
        -e GOOGLE_CLIENT_SECRET=$env:GOOGLE_CLIENT_SECRET `
        -e MAIL_TOKEN_ENCRYPTION_KEY=$env:MAIL_TOKEN_ENCRYPTION_KEY `
        -v "${DataDir}:/var/lib/postgresql/18/main" `
        -v "${UploadsDir}:/app/uploads" `
        -v "${LogsDir}:/app/logs" `
        --restart unless-stopped `
        "${ImageName}:${Tag}"

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Container started successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "  Application URL: https://localhost:3443" -ForegroundColor White
        Write-Host "  Database: ./data/postgresql (persistent local directory)" -ForegroundColor White
        Write-Host "  Default login:   admin@resumeconverter.local" -ForegroundColor White
        Write-Host "  Default password: admin123" -ForegroundColor White
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
    Write-Host "Stopping container: $ContainerName" -ForegroundColor Yellow
    docker stop $ContainerName 2>$null
    docker rm $ContainerName 2>$null
    Write-Host "Container stopped." -ForegroundColor Green
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

    docker stop $ContainerName 2>$null
    docker rm $ContainerName 2>$null
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
