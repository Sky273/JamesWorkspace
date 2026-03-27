param(
    [string]$ContainerName = 'resumeconverter-app'
)

Write-Host 'Releasing Ollama models from memory only...'
Write-Host 'Installed Ollama models are preserved on disk.'

$psJson = $null
try {
    $psJson = & docker exec $ContainerName sh -lc "curl -fsS http://127.0.0.1:11434/api/ps" 2>$null
} catch {
}

if ($LASTEXITCODE -ne 0 -or -not $psJson) {
    Write-Host '  Ollama runtime not reachable; skipping model unload.'
    exit 0
}

try {
    $status = $psJson | ConvertFrom-Json
    $models = @($status.models | ForEach-Object { $_.name } | Where-Object { $_ })
    if (-not $models.Count) {
        Write-Host '  No Ollama model currently loaded in memory.'
        exit 0
    }

    foreach ($model in $models) {
        & docker exec $ContainerName ollama stop $model 1>$null 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  Unloaded Ollama model $model from memory."
        } else {
            Write-Host "  WARNING: Failed to unload Ollama model $model."
        }
    }
} catch {
    Write-Host '  WARNING: Could not parse Ollama runtime status; skipping model unload.'
}