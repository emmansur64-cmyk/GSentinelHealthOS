param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Stop-ByPort {
    param(
        [int]$Port,
        [string]$Name
    )

    $listeners = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if (-not $listeners) {
        Write-Host "[$Name] No hay proceso escuchando en puerto $Port."
        return
    }

    $processIds = $listeners | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($processId in $processIds) {
        try {
            if ($Force) {
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

Stop-ByPort -Port 8000 -Name "api"
Stop-ByPort -Port 5174 -Name "frontend"

Write-Host ""
Write-Host "Parada completada."
