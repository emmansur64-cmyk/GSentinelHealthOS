param(
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"

Set-Location -Path $PSScriptRoot\..

if (-not $SkipInstall) {
  npm install
}

npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed

Write-Host "Bootstrap completado" -ForegroundColor Green