param(
    [switch]$EnableSSR
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path $PSScriptRoot
Set-Location $repoRoot

$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Python venv no encontrado en $pythonExe"
}

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if ($EnableSSR -and -not $npmCmd) {
    throw "npm.cmd no encontrado en PATH (requerido para iniciar SSR)"
}

function Test-PortListening {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Test-ProcessByCommandLine {
    param([string]$Pattern)

    $match = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern } |
        Select-Object -First 1

    return $null -ne $match
}

$startFrontendBackendScript = Join-Path $repoRoot "scripts/start_frontend_backend.ps1"
if (-not (Test-Path $startFrontendBackendScript)) {
    throw "No se encontró $startFrontendBackendScript"
}

$startArgs = @("-ExecutionPolicy", "Bypass", "-File", $startFrontendBackendScript)

Write-Host "[core] Levantando API + Frontend..."
& powershell @startArgs

if (Test-PortListening -Port 8002) {
    Write-Host "[gateway] Puerto 8002 ya en uso. Se asume Gateway activo."
} else {
    Start-Process -FilePath $pythonExe -ArgumentList @("-m", "uvicorn", "whatsapp_gateway.app.main:app", "--host", "0.0.0.0", "--port", "8002") -WorkingDirectory $repoRoot | Out-Null
    Write-Host "[gateway] Gateway iniciado en segundo plano (http://localhost:8002)."
}

if (Test-ProcessByCommandLine -Pattern "brain[\\/]main\.py") {
    Write-Host "[brain] Worker ya en ejecución."
} else {
    Start-Process -FilePath $pythonExe -ArgumentList @("-m", "brain.main") -WorkingDirectory $repoRoot | Out-Null
    Write-Host "[brain] Worker iniciado en segundo plano."
}

if ($EnableSSR) {
    Write-Host "[ssr] Omitido: SSR legacy de dashboard-ui fue retirado."
}

Write-Host ""
Write-Host "Stack completo levantado:"
Write-Host "- Frontend login: http://localhost:3000/login"
Write-Host "- Frontend dashboard: http://localhost:3000/"
Write-Host "- API nueva: http://localhost:3000/api/*"
Write-Host "- Gateway: http://localhost:8002/health"
Write-Host "- Brain: worker en background"
if ($EnableSSR) {
    Write-Host "- SSR: no aplica (arquitectura nueva en medical-agenda-saas)"
}
