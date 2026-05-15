param(
    [string]$TextFile
)

if (-not (Test-Path $TextFile)) {
    Write-Host "TEXT_FILE_NOT_FOUND"
    exit 1
}

$text = Get-Content $TextFile -Raw

$text = $text.ToLower()
$text = $text -replace '\r', ' '
$text = $text -replace '\n', ' '
$text = $text -replace '\s+', ' '

$text = $text -replace 'm[eé]dico', 'medico'
$text = $text -replace 'matr[ií]cula', 'matricula'
$text = $text -replace 'mi[eé]rcoles', 'miercoles'

$text = $text -replace 'nombre del medico\s*:', 'nombre del medico '
$text = $text -replace 'especialidad\s*:', 'especialidad '
$text = $text -replace 'matricula\s*:', 'matricula '
$text = $text -replace 'mes\s*:', 'mes '

$doctorName = $null
$specialty = $null
$licenseNumber = $null
$month = $null
$year = $null

if ($text -match 'nombre del medico\s+(.+?)\s+especialidad') {
    $doctorName = $matches[1].Trim()
}

if ($text -match 'especialidad\s+(.+?)\s+matricula') {
    $specialty = $matches[1].Trim()
}

if ($text -match 'matricula\s+(\d+)') {
    $licenseNumber = $matches[1].Trim()
}

if ($text -match 'mes\s+([a-záéíóúñ]+)') {
    $month = $matches[1].Trim()
}

if ($text -match 'mes\s+[a-záéíóúñ]+.*?(\d{4})') {
    $year = [int]$matches[1]
}

$weekdays = @(
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabado",
    "domingo"
)

$weeklyPattern = @()

foreach ($day in $weekdays) {
    $timeRanges = @()

    $regex = "$day\s+(\d{1,2})\s*a\s*(\d{1,2})"

    $matchesForDay = [regex]::Matches($text, $regex)

    foreach ($m in $matchesForDay) {
        $startHour = [int]$m.Groups[1].Value
        $endHour = [int]$m.Groups[2].Value

        $timeRanges += [PSCustomObject]@{
            start = ("{0:D2}:00" -f $startHour)
            end   = ("{0:D2}:00" -f $endHour)
        }
    }

    if ($timeRanges.Count -gt 0) {
        $weeklyPattern += [PSCustomObject]@{
            weekday = $day
            timeRanges = $timeRanges
        }
    }
}

$result = [PSCustomObject]@{
    doctor = [PSCustomObject]@{
        name = $doctorName
        specialty = $specialty
        licenseNumber = $licenseNumber
    }
    period = [PSCustomObject]@{
        month = $month
        year = $year
    }
    weeklyPattern = $weeklyPattern
}

$result | ConvertTo-Json -Depth 10