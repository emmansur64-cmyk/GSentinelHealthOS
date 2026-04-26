$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    throw "Python venv no encontrado en $pythonExe"
}

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) {
    throw "npm.cmd no encontrado en PATH"
}

$newFrontendPath = Join-Path $repoRoot "medical-agenda-saas"
if (-not (Test-Path $newFrontendPath)) {
    throw "No se encontro frontend nuevo en $newFrontendPath"
}

function Test-PortListening {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 30
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method Get -TimeoutSec 5 -ErrorAction Stop
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $true
            }
        }
        catch {
        }

        Start-Sleep -Milliseconds 500
    }

    return $false
}

if (Test-PortListening -Port 3000) {
    Write-Host "[frontend] Puerto 3000 ya en uso. Se asume frontend nuevo activo."
} else {
    Start-Process -FilePath $npmCmd -ArgumentList @("--prefix", "medical-agenda-saas", "run", "dev") -WorkingDirectory $repoRoot | Out-Null
    Write-Host "[frontend] Frontend nuevo iniciado en segundo plano (http://localhost:3000)."
}

if (-not (Wait-HttpReady -Url "http://127.0.0.1:3000/login" -TimeoutSeconds 60)) {
    throw "El frontend nuevo no quedo listo en http://127.0.0.1:3000/login."
}

Write-Host ""
Write-Host "Stack local listo:"
Write-Host "- Login UI:   http://localhost:3000/login"
Write-Host "- Dashboard:  http://localhost:3000/"
Write-Host "- API nueva:  http://localhost:3000/api/*"
