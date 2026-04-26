param(
    [ValidateSet('start', 'stop', 'status', 'restart')]
    [string]$Action = 'start',
    [int]$HostPort = 5174,
    [int]$RemotePort = 5001,
    [int]$ApiPort = 8000,
    [int]$TimeoutSeconds = 60,
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$hostPrefix = Join-Path $repoRoot 'dashboard-ui'
$remotePrefix = Join-Path $repoRoot 'gsentinel-dashboard-mf'

$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) {
    throw 'npm.cmd no encontrado en PATH.'
}

function Test-PortListening {
    param([int]$Port)

    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Stop-ByPort {
    param(
        [int]$Port,
        [string]$Name,
        [switch]$ForceStop
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        Write-Host "[$Name] No hay proceso escuchando en puerto $Port."
        return
    }

    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        try {
            if ($ForceStop) {
                Stop-Process -Id $processId -Force -ErrorAction Stop
            } else {
                Stop-Process -Id $processId -ErrorAction Stop
            }
            Write-Host "[$Name] Proceso $processId detenido (puerto $Port)."
        } catch {
            Write-Host "[$Name] No se pudo detener proceso $processId en puerto ${Port}: $($_.Exception.Message)"
        }
    }
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [string]$Name,
        [int]$TimeoutSec
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
                Write-Host "[$Name] OK ($($resp.StatusCode)) -> $Url"
                return $true
            }
        } catch {
            # Retry until timeout.
        }
        Start-Sleep -Milliseconds 700
    }

    Write-Host "[$Name] TIMEOUT esperando $Url"
    return $false
}

function Start-MfStack {
    if (-not (Test-Path $hostPrefix)) {
        throw "No existe host project: $hostPrefix"
    }
    if (-not (Test-Path $remotePrefix)) {
        throw "No existe remote project: $remotePrefix"
    }

    if (Test-PortListening -Port $RemotePort) {
        Write-Host "[remote] Puerto $RemotePort ya en uso. Se asume remote activo."
    } else {
        Start-Process -FilePath $npmCmd -ArgumentList @(
            '--prefix',
            $remotePrefix,
            'run',
            'dev'
        ) -WorkingDirectory $repoRoot | Out-Null
        Write-Host "[remote] Iniciado en segundo plano."
    }

    if (Test-PortListening -Port $HostPort) {
        Write-Host "[host] Puerto $HostPort ya en uso. Se asume host activo."
    } else {
        Start-Process -FilePath $npmCmd -ArgumentList @(
            '--prefix',
            $hostPrefix,
            'run',
            'dev:mf:host',
            '--',
            '--strictPort',
            '--port',
            "$HostPort"
        ) -WorkingDirectory $repoRoot | Out-Null
        Write-Host "[host] Iniciado en segundo plano."
    }

    $remoteOk = Wait-HttpReady -Url "http://localhost:$RemotePort/assets/remoteEntry.js" -Name 'remote' -TimeoutSec $TimeoutSeconds
    $hostOk = Wait-HttpReady -Url "http://localhost:$HostPort/" -Name 'host' -TimeoutSec $TimeoutSeconds

    Write-Host ''
    Write-Host 'Estado final stack MF:'
    Write-Host "- Remote dashboard: http://localhost:$RemotePort/"
    Write-Host "- Remote entry:     http://localhost:$RemotePort/assets/remoteEntry.js"
    Write-Host "- Host shell:       http://localhost:$HostPort/"
    Write-Host "- API backend:      http://localhost:$ApiPort/"

    if (-not ($remoteOk -and $hostOk)) {
        throw 'El stack MF no quedo saludable. Revisa puertos/procesos y vuelve a intentar.'
    }
}

function Show-MfStatus {
    $remoteListening = Test-PortListening -Port $RemotePort
    $hostListening = Test-PortListening -Port $HostPort
    $apiListening = Test-PortListening -Port $ApiPort

    Write-Host 'Estado de puertos:'
    Write-Host "- remote:$RemotePort = $remoteListening"
    Write-Host "- host:$HostPort = $hostListening"
    Write-Host "- api:$ApiPort = $apiListening"

    if ($remoteListening) {
        [void](Wait-HttpReady -Url "http://localhost:$RemotePort/assets/remoteEntry.js" -Name 'remote' -TimeoutSec 5)
    }
    if ($hostListening) {
        [void](Wait-HttpReady -Url "http://localhost:$HostPort/" -Name 'host' -TimeoutSec 5)
    }
}

function Stop-MfStack {
    Stop-ByPort -Port $HostPort -Name 'host' -ForceStop:$Force
    Stop-ByPort -Port $RemotePort -Name 'remote' -ForceStop:$Force
    Write-Host 'Stack MF detenido.'
}

switch ($Action) {
    'start' {
        Start-MfStack
        break
    }
    'stop' {
        Stop-MfStack
        break
    }
    'status' {
        Show-MfStatus
        break
    }
    'restart' {
        Stop-MfStack
        Start-MfStack
        break
    }
}
