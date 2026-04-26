$ErrorActionPreference = "Stop"

function Stop-PortProcess {
    param([int]$Port)

    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if (-not $connections) {
        Write-Host "No hay procesos escuchando en puerto $Port"
        return
    }

    $pids = $connections | Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($pid in $pids) {
        if ($pid -and $pid -ne 0) {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "Proceso PID=$pid detenido (puerto $Port)"
            } catch {
                Write-Host "No se pudo detener PID=$pid en puerto $Port: $($_.Exception.Message)"
            }
        }
    }
}

Write-Host "[1/5] Limpiando procesos en puertos 8000 y 5174..."
Stop-PortProcess -Port 8000
Stop-PortProcess -Port 5174

Write-Host "[2/5] Verificando entorno Python del proyecto..."
$projectPython = "e:\GSentinelHealthOS\.venv\Scripts\python.exe"
if (-not (Test-Path $projectPython)) {
    throw "No se encontro el entorno e:\GSentinelHealthOS\.venv. Crea o restaura ese venv antes de ejecutar el script."
}

Write-Host "[3/5] Activando entorno actual..."
& .\.venv\Scripts\Activate.ps1

Write-Host "[4/5] Instalando dependencias..."
python -m pip install --upgrade pip
pip install -r requirements.txt
pip install "passlib[bcrypt]"

Write-Host "[5/5] Levantando Backend en http://localhost:8000 ..."
python scripts/run_api_server.py
