$ErrorActionPreference = 'Stop'

$projectPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$projectPathAlt = $projectPath -replace '\\', '/'
$projectRegex = [regex]::Escape($projectPath)
$projectAltRegex = [regex]::Escape($projectPathAlt)

$targets = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object {
        $cmd = $_.CommandLine
        if (-not $cmd) {
            return $false
        }

        $isNextDev = $cmd -match 'next' -and $cmd -match '(^|\s|\\)dev(\s|$)'
        $isThisProject = $cmd -match $projectRegex -or $cmd -match $projectAltRegex

        return $isNextDev -and $isThisProject
    }

if (-not $targets -or $targets.Count -eq 0) {
    Write-Host "No hay instancias Next.js dev activas para este proyecto."
    exit 0
}

foreach ($proc in $targets) {
    Write-Host "Deteniendo Next.js PID $($proc.ProcessId)..." -ForegroundColor Cyan
    Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
}

Write-Host "Instancias Next.js detenidas correctamente." -ForegroundColor Green
