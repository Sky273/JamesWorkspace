param(
    [string]$ContainerName = 'resumeconverter-app'
)

$provider = ''
$model = ''
$keepAlive = ''

$query = @"
SELECT
  COALESCE(llm_provider, 'openai') AS llm_provider,
  COALESCE(llm_model, '') AS llm_model,
  COALESCE(ollama_keep_alive, '5m') AS ollama_keep_alive
FROM llm_settings
ORDER BY created_at DESC
LIMIT 1;
"@

try {
    $cmd = "psql -U resumeconverter -d resumeconverter -F ',' -Atqc `"$query`""
    $result = & docker exec $ContainerName sh -lc $cmd 2>$null
    if ($LASTEXITCODE -eq 0 -and $result) {
        $parts = ($result | Select-Object -First 1).Split(',', 3)
        if ($parts.Length -ge 1) { $provider = $parts[0].Trim() }
        if ($parts.Length -ge 2) { $model = $parts[1].Trim() }
        if ($parts.Length -ge 3) { $keepAlive = $parts[2].Trim() }
    }
} catch {
}

Write-Output "OLLAMA_PROVIDER=$provider"
Write-Output "OLLAMA_MODEL=$model"
Write-Output "OLLAMA_KEEPALIVE=$keepAlive"