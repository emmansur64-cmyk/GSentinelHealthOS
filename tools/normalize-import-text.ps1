param(
    [string]$InputFile
)

if (-not (Test-Path $InputFile)) {
    Write-Host "INPUT_FILE_NOT_FOUND"
    exit 1
}

$text = Get-Content $InputFile -Raw

$text = $text.ToLower()

$text = $text -replace '\r', ' '
$text = $text -replace '\n', ' '

$text = $text -replace '\s+', ' '

$text = $text -replace '[^\p{L}\p{N}\s]', ' '

$text = $text -replace '\bdoctor\b', 'dr'
$text = $text -replace '\bdoctora\b', 'dra'

$output = "$InputFile.cleaned.txt"

$text | Out-File $output -Encoding utf8

Write-Host "NORMALIZATION_OK"
Write-Host $output