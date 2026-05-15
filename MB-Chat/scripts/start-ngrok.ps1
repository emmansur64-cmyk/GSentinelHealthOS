param(
    [string]$Port = "8080"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
    Write-Host "ngrok is not installed. Install from https://ngrok.com/download" -ForegroundColor Red
    exit 1
}

Write-Host "Starting ngrok tunnel for http://localhost:$Port"
ngrok http "http://localhost:$Port"
