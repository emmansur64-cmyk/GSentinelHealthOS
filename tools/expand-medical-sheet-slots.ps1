param(
    [string]$TextFile
)

if (-not (Test-Path $TextFile)) {
    Write-Host "TEXT_FILE_NOT_FOUND"
    exit 1
}

$rawJson = powershell -ExecutionPolicy Bypass -File "E:\GSentinelHealthOS\tools\extract-medical-sheet-full.ps1" -TextFile $TextFile
$data = $rawJson | ConvertFrom-Json

$monthMap = @{
    "enero" = 1
    "febrero" = 2
    "marzo" = 3
    "abril" = 4
    "mayo" = 5
    "junio" = 6
    "julio" = 7
    "agosto" = 8
    "septiembre" = 9
    "setiembre" = 9
    "octubre" = 10
    "noviembre" = 11
    "diciembre" = 12
}

$weekdayMap = @{
    "domingo" = [DayOfWeek]::Sunday
    "lunes" = [DayOfWeek]::Monday
    "martes" = [DayOfWeek]::Tuesday
    "miercoles" = [DayOfWeek]::Wednesday
    "miércoles" = [DayOfWeek]::Wednesday
    "jueves" = [DayOfWeek]::Thursday
    "viernes" = [DayOfWeek]::Friday
    "sabado" = [DayOfWeek]::Saturday
    "sábado" = [DayOfWeek]::Saturday
}

if (-not $data.period.month -or -not $monthMap.ContainsKey($data.period.month)) {
    Write-Host "INVALID_MONTH"
    exit 1
}

if (-not $data.period.year) {
    Write-Host "INVALID_YEAR"
    exit 1
}

$monthNumber = $monthMap[$data.period.month]
$year = [int]$data.period.year
$daysInMonth = [DateTime]::DaysInMonth($year, $monthNumber)

$generatedSlots = @()

foreach ($pattern in $data.weeklyPattern) {

    if (-not $weekdayMap.ContainsKey($pattern.weekday)) {
        continue
    }

    $targetDay = $weekdayMap[$pattern.weekday]

    for ($day = 1; $day -le $daysInMonth; $day++) {

        $date = Get-Date -Year $year -Month $monthNumber -Day $day

        if ($date.DayOfWeek -eq $targetDay) {

            foreach ($range in $pattern.timeRanges) {
                $generatedSlots += [PSCustomObject]@{
                    date = $date.ToString("yyyy-MM-dd")
                    weekday = $pattern.weekday
                    start = $range.start
                    end = $range.end
                }
            }
        }
    }
}

$result = [PSCustomObject]@{
    doctor = $data.doctor
    period = [PSCustomObject]@{
        month = $data.period.month
        monthNumber = $monthNumber
        year = $year
    }
    weeklyPattern = $data.weeklyPattern
    generatedSlots = $generatedSlots
}

$result | ConvertTo-Json -Depth 20