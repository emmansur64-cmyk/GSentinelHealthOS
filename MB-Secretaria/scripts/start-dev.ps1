Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location "$PSScriptRoot\.."

if (-not (Test-Path "node_modules")) {
  Write-Host "Instalando dependencias..."
  npm install
}

Write-Host "Iniciando MetaBrain en modo desarrollo..."
npm run start:dev
