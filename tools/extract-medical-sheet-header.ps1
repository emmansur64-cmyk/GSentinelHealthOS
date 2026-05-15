param(
    [string]$TextFile
)

if (-not (Test-Path $TextFile)) {
    Write-Host "TEXT_FILE_NOT_FOUND"
    exit 1
}

$text = Get-Content $TextFile -Raw

# Normalización base
$text = $text.ToLower()
$text = $text -replace '\r', ' '
$text = $text -replace '\n', ' '
$text = $text -replace '\s+', ' '

# Normalizar etiquetas
$text = $text -replace 'm[eé]dico', 'medico'
$text = $text -replace 'matr[ií]cula', 'matricula'
$text = $text -replace 'nombre del medico\s*:', 'nombre del medico '
$text = $text -replace 'especialidad\s*:', 'especialidad '
$text = $text -replace 'matricula\s*:', 'matricula '
$text = $text -replace 'mes\s*:', 'mes '
$text = $text -replace '\s+', ' '

$doctorName = $null
$specialty = $null
$licenseNumber = $null
$month = $null
$year = $null

# Nombre del médico
if ($text -match 'nombre del medico\s+(.+?)\s+especialidad') {
    $doctorName = $matches[1].Trim()
}

# Especialidad
if ($text -match 'especialidad\s+(.+?)\s+matricula') {
    $specialty = $matches[1].Trim()
}

# Matrícula
if ($text -match 'matricula\s+(\d+)') {
    $licenseNumber = $matches[1].Trim()
}

# Mes: toma la palabra después de "mes"
if ($text -match 'mes\s+([a-záéíóúñ]+)') {
    $month = $matches[1].Trim()
}

# Año: toma el primer año de 4 dígitos después del mes
if ($text -match 'mes\s+[a-záéíóúñ]+.*?(\d{4})') {
    $year = [int]$matches[1]
}

$result = [PSCustomObject]@{
    doctorName = $doctorName
    specialty = $specialty
    licenseNumber = $licenseNumber
    month = $month
    year = $year
}

$result | ConvertTo-Json -Depth 5