Param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PythonArgs
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$pythonExe = Join-Path $projectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $pythonExe)) {
    throw "No se encontró el intérprete del proyecto en: $pythonExe"
}

Push-Location $projectRoot
try {
    if (-not $PythonArgs -or $PythonArgs.Count -eq 0) {
        & $pythonExe -c "import sys; print(sys.executable); print(sys.version)"
        exit $LASTEXITCODE
    }

    & $pythonExe @PythonArgs
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
