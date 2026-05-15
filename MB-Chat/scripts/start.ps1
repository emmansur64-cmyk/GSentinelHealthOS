param(
    [string]$ComposeFile = "docker-compose.yml",
    [int]$HealthRetries = 30,
    [int]$HealthDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    Write-Host "[ERROR] Missing .env file. Copy .env.example to .env and set secrets." -ForegroundColor Red
    exit 1
}

Write-Host "[1/4] Validating required env vars..."
$required = @(
    "GROQ_API_KEY",
    "REDIS_URL",
    "NLG_GROQ_ENABLED",
    "NLG_GROQ_MODEL",
    "NLG_GROQ_TEMPERATURE"
)

$envMap = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
    $k, $v = $_.Split("=", 2)
    $envMap[$k.Trim()] = $v.Trim()
}

$missing = @()
foreach ($key in $required) {
    if (-not $envMap.ContainsKey($key) -or [string]::IsNullOrWhiteSpace($envMap[$key])) {
        $missing += $key
    }
}
if ($missing.Count -gt 0) {
    Write-Host "[ERROR] Missing env vars: $($missing -join ', ')" -ForegroundColor Red
    exit 1
}

Write-Host "[2/4] Starting Docker Compose stack..."
docker compose -f $ComposeFile up -d --build

Write-Host "[3/4] Waiting for services..."
$ok = $false
for ($i = 1; $i -le $HealthRetries; $i++) {
    try {
        $health = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -TimeoutSec 5
        if ($health.status -in @("healthy", "degraded")) {
            $ok = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds $HealthDelaySeconds
    }
}

if (-not $ok) {
    Write-Host "[ERROR] Gateway did not become healthy/degraded in time." -ForegroundColor Red
    docker compose -f $ComposeFile ps
    exit 1
}

Write-Host "[4/4] Running health checks..."
$h1 = Invoke-RestMethod -Uri "http://localhost:8080/health" -Method Get -TimeoutSec 8
$h2 = Invoke-RestMethod -Uri "http://localhost:8080/health/redis" -Method Get -TimeoutSec 8
$h3 = Invoke-RestMethod -Uri "http://localhost:8080/health/groq" -Method Get -TimeoutSec 15

Write-Host ""
Write-Host "=== SYSTEM STATUS ===" -ForegroundColor Cyan
Write-Host ("/health        -> {0}" -f $h1.status)
Write-Host ("/health/redis  -> {0}" -f $h2.status)
Write-Host ("/health/groq   -> {0}" -f $h3.status)
Write-Host ""

docker compose -f $ComposeFile ps
