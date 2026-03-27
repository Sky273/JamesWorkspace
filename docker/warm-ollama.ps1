param(
    [string]$ContainerName = 'resumeconverter-app'
)

Write-Host 'Waiting for Ollama service to become ready...'
Write-Host 'The startup step only preloads the configured model into memory.'
Write-Host 'It does not pull or delete installed models.'

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    & docker exec $ContainerName sh -lc "curl -fsS http://127.0.0.1:11434/api/tags >/dev/null" 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
        $ready = $true
        break
    }
    Start-Sleep -Seconds 2
}

if (-not $ready) {
    Write-Host '  WARNING: Ollama did not become ready during startup.'
    exit 0
}

Write-Host '  Ollama is ready.'

$provider = ''
$model = ''
$keepAlive = '5m'

try {
    $result = & docker exec $ContainerName psql -U resumeconverter -d resumeconverter -F ',' -Atqc "SELECT COALESCE(llm_provider, 'openai'), COALESCE(llm_model, ''), COALESCE(ollama_keep_alive, '5m') FROM llm_settings ORDER BY created_at DESC LIMIT 1;" 2>$null
    if ($LASTEXITCODE -eq 0 -and $result) {
        $parts = ($result | Select-Object -First 1).Split(',', 3)
        if ($parts.Length -ge 1) { $provider = $parts[0].Trim() }
        if ($parts.Length -ge 2) { $model = $parts[1].Trim() }
        if ($parts.Length -ge 3 -and $parts[2].Trim()) { $keepAlive = $parts[2].Trim() }
    }
} catch {
}

if ($provider -ne 'ollama' -or [string]::IsNullOrWhiteSpace($model)) {
    Write-Host '  No Ollama model configured for memory preload.'
    exit 0
}

$tagsJson = & docker exec $ContainerName sh -lc "curl -fsS http://127.0.0.1:11434/api/tags" 2>$null
if ($LASTEXITCODE -ne 0 -or -not $tagsJson) {
    Write-Host '  WARNING: Unable to list installed Ollama models.'
    exit 0
}

try {
    $tags = $tagsJson | ConvertFrom-Json
    $installedModels = @($tags.models | ForEach-Object { $_.name })
    if ($installedModels -notcontains $model) {
        Write-Host "  WARNING: Configured Ollama model $model is not installed; skipping preload."
        exit 0
    }
} catch {
    Write-Host '  WARNING: Could not parse installed Ollama models; skipping preload.'
    exit 0
}

Write-Host "  Preloading Ollama model $model into memory..."
$payload = @{ model = $model; prompt = 'Warm up'; stream = $false; keep_alive = $keepAlive } | ConvertTo-Json -Compress
$tempFile = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tempFile, $payload, [System.Text.UTF8Encoding]::new($false))
    & docker cp $tempFile "${ContainerName}:/tmp/ollama-warm.json" 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: Failed to copy warm-up payload into container."
        exit 0
    }

    & docker exec $ContainerName sh -lc "curl -fsS -H 'Content-Type: application/json' --data-binary @/tmp/ollama-warm.json http://127.0.0.1:11434/api/generate >/dev/null && rm -f /tmp/ollama-warm.json" 1>$null 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: Failed to preload Ollama model $model."
        exit 0
    }
} finally {
    Remove-Item $tempFile -ErrorAction SilentlyContinue
}

$psJson = & docker exec $ContainerName sh -lc "curl -fsS http://127.0.0.1:11434/api/ps" 2>$null
if ($LASTEXITCODE -eq 0 -and $psJson) {
    try {
        $status = $psJson | ConvertFrom-Json
        $runningModels = @($status.models | ForEach-Object { $_.name })
        if ($runningModels -contains $model) {
            Write-Host "  Ollama model $model is loaded in memory and ready."
        } else {
            Write-Host "  WARNING: Warm-up request completed, but $model is not listed as loaded."
        }
    } catch {
        Write-Host "  Ollama model $model preload request sent."
    }
} else {
    Write-Host "  Ollama model $model preload request sent."
}