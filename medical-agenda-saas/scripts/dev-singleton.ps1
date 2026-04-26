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

Push-Location $projectPath
try {
    & $nextCmd dev --port $Port
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
