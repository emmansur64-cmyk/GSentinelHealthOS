Param(
    [switch]$RunTox,
    [string]$ToxEnv = "py311-outbox"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Verificando Python 3.11..."
$py311 = $null
try {
    $py311 = py -3.11 -c "import sys; print(sys.executable)" 2>$null
} catch {
    $py311 = $null
}

if (-not $py311) {
    Write-Host "Python 3.11 no encontrado. Intentando instalar con winget..."
    winget install -e --id Python.Python.3.11 --accept-source-agreements --accept-package-agreements

    Write-Host "Revalidando Python 3.11..."
    $py311 = py -3.11 -c "import sys; print(sys.executable)"
}

Write-Host "Python 3.11 detectado en: $py311"

Write-Host "[2/4] Instalando tox en el entorno actual..."
python -m pip install --upgrade pip
python -m pip install tox

Write-Host "[3/4] Verificando que tox detecte python3.11..."
python -m tox -av

if ($RunTox) {
    Write-Host "[4/4] Ejecutando tox -e $ToxEnv ..."
    python -m tox -e $ToxEnv
} else {
    Write-Host "[4/4] Listo. Ejecuta manualmente: python -m tox -e $ToxEnv"
}
