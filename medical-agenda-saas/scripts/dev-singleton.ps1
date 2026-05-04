param(
    [switch]$ForceRestart,
    [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectPathAlt = $projectPath -replace '\\', '/'

function Get-NextDevProcesses {
    $projectRegex = [regex]::Escape($projectPath)
    $projectAltRegex = [regex]::Escape($projectPathAlt)

    Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
        Where-Object {
            $cmd = $_.CommandLine
            if (-not $cmd) {
                return $false
            }

            $isNextDev = $cmd -match 'next' -and $cmd -match '(^|\s|\\)dev(\s|$)'
            $isThisProject = $cmd -match $projectRegex -or $cmd -match $projectAltRegex

            return $isNextDev -and $isThisProject
        } |
        Sort-Object ProcessId
}

function Get-ExcludedTcpPortRanges {
    $output = netsh interface ipv4 show excludedportrange protocol=tcp 2>$null
    foreach ($line in $output) {
        if ($line -match '^\s*(\d+)\s+(\d+)\s*$') {
            [pscustomobject]@{
                Start = [int]$matches[1]
                End = [int]$matches[2]
            }
        }
    }
}

function Test-PortExcluded {
    param([int]$CandidatePort)

    foreach ($range in Get-ExcludedTcpPortRanges) {
        if ($CandidatePort -ge $range.Start -and $CandidatePort -le $range.End) {
            return $true
        }
    }

    return $false
}

function Test-PortListening {
    param([int]$CandidatePort)

    $connection = Get-NetTCPConnection -LocalPort $CandidatePort -ErrorAction SilentlyContinue |
        Where-Object { $_.State -eq 'Listen' } |
        Select-Object -First 1

    return $null -ne $connection
}

function Resolve-DevPort {
    param([int]$RequestedPort)

    $candidate = $RequestedPort
    while ($candidate -lt 65535) {
        if (-not (Test-PortExcluded -CandidatePort $candidate) -and -not (Test-PortListening -CandidatePort $candidate)) {
            return $candidate
        }
        $candidate++
    }

    throw "No se encontro un puerto TCP disponible para Next.js."
}

$existing = @(Get-NextDevProcesses)

if ($existing.Count -gt 0 -and -not $ForceRestart) {
    Write-Host "Next.js dev ya esta en ejecucion para este proyecto." -ForegroundColor Yellow
    foreach ($proc in $existing) {
        Write-Host "- PID $($proc.ProcessId)" -ForegroundColor Yellow
    }
    Write-Host "No se inicia otra instancia para evitar conflictos de lock/puerto." -ForegroundColor Yellow
    Write-Host "Usa 'npm run dev:restart' para reiniciar o 'npm run dev:stop' para detener." -ForegroundColor Yellow
    exit 0
}

if ($existing.Count -gt 0 -and $ForceRestart) {
    foreach ($proc in $existing) {
        Write-Host "Deteniendo instancia Next.js PID $($proc.ProcessId)..." -ForegroundColor Cyan
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
    }

    Start-Sleep -Milliseconds 300
}

$nextCmd = Join-Path $projectPath 'node_modules/.bin/next.cmd'
if (-not (Test-Path $nextCmd)) {
    throw "No se encontro next.cmd en $nextCmd. Ejecuta 'npm install' en el proyecto."
}

$resolvedPort = Resolve-DevPort -RequestedPort $Port
if ($resolvedPort -ne $Port) {
    Write-Host "Puerto $Port no disponible para Next.js (ocupado o reservado por Windows)." -ForegroundColor Yellow
    Write-Host "Usando puerto disponible $resolvedPort." -ForegroundColor Yellow
}

Push-Location $projectPath
try {
    & $nextCmd dev --port $resolvedPort
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
