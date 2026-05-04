param(
    [string]$ProjectRoot = "E:\GSentinelHealthOS",
    [string]$VpsUser = "emmansur64",
    [string]$VpsHost = "34.39.235.83",
    [string]$RemotePackagePath = "/tmp/gsentinel-deploy.tgz",
    [string]$SshIdentityFile = "",
    [switch]$BatchMode
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Assert-ExternalSuccess {
  param([string]$StepName)

  if ($LASTEXITCODE -ne 0) {
    throw "$StepName falló (exit code $LASTEXITCODE)"
  }
}

if (-not (Test-Path -Path $ProjectRoot)) {
    throw "ProjectRoot no existe: $ProjectRoot"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$localPackage = Join-Path $env:TEMP "gsentinel-deploy-$timestamp.tgz"
$remoteScriptPath = Join-Path $env:TEMP "gsentinel-remote-deploy-$timestamp.sh"
$sshCliOptions = @()
if ($SshIdentityFile.Trim()) {
    $sshCliOptions += "-i"
    $sshCliOptions += $SshIdentityFile.Trim()
}
if ($BatchMode.IsPresent) {
    $sshCliOptions += "-o"
    $sshCliOptions += "BatchMode=yes"
}

Write-Step "Empaquetando proyecto local (sin .env/.git/venv/node_modules/cache)"
Push-Location $ProjectRoot
try {
  $tarCliOptions = @(
        "-czf", $localPackage,
        "--exclude=.git",
        "--exclude=.git/*",
        "--exclude=.env",
        "--exclude=.env.local",
        "--exclude=.venv",
        "--exclude=.venv/*",
        "--exclude=venv",
        "--exclude=*/venv/*",
        "--exclude=node_modules",
        "--exclude=*/node_modules/*",
        "--exclude=__pycache__",
        "--exclude=*/__pycache__/*",
        "--exclude=*.pyc",
        "--exclude=.pytest_cache",
        "--exclude=.mypy_cache",
        "--exclude=.ruff_cache",
        "--exclude=*.tmp",
        "--exclude=*~",
        "."
    )
      & tar @tarCliOptions
      Assert-ExternalSuccess -StepName "Empaquetado tar"
}
finally {
    Pop-Location
}

if (-not (Test-Path -Path $localPackage)) {
    throw "No se pudo generar paquete: $localPackage"
}

Write-Step "Subiendo paquete a VPS por SCP"
$scpPackageCliOptions = @()
$scpPackageCliOptions += $sshCliOptions
$scpPackageCliOptions += $localPackage
$scpPackageCliOptions += "$VpsUser@$VpsHost`:$RemotePackagePath"
& scp @scpPackageCliOptions
Assert-ExternalSuccess -StepName "SCP de paquete"

$remoteScript = @'
#!/usr/bin/env bash
set -u -o pipefail

APP_DIR="/home/__VPS_USER__/GSentinelHealthOS"
STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/home/__VPS_USER__/GSentinelHealthOS_backup_${STAMP}"
STAGING_DIR="/home/__VPS_USER__/GSentinelHealthOS_staging_${STAMP}"
PACKAGE_PATH="__REMOTE_PACKAGE_PATH__"
VERIFY_URL="https://gsentinelhealth.com.ar/api/health"
MEDICAL_LOCAL_HEALTH="http://localhost:3000/api/health"

if ! command -v curl >/dev/null 2>&1; then
  echo "curl no instalado en VPS" >&2
  exit 1
fi

if [ ! -f "$PACKAGE_PATH" ]; then
  echo "Paquete no encontrado en VPS: $PACKAGE_PATH" >&2
  exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
  DC_CMD="docker-compose"
else
  DC_CMD="docker compose"
fi

mkdir -p "$STAGING_DIR"
tar -xzf "$PACKAGE_PATH" -C "$STAGING_DIR"

HAS_BACKUP=0
if [ -d "$APP_DIR" ]; then
  cp -a "$APP_DIR" "$BACKUP_DIR"
  HAS_BACKUP=1
fi

preserve_env_file() {
  local rel_path="$1"
  local target_dir
  target_dir="$(dirname "$STAGING_DIR/$rel_path")"
  mkdir -p "$target_dir"

  if [ "$HAS_BACKUP" -eq 1 ] && [ -f "$BACKUP_DIR/$rel_path" ]; then
    cp "$BACKUP_DIR/$rel_path" "$STAGING_DIR/$rel_path"
  elif [ -f "$APP_DIR/$rel_path" ]; then
    cp "$APP_DIR/$rel_path" "$STAGING_DIR/$rel_path"
  fi
}

preserve_env_file ".env"
preserve_env_file ".env.prod"
preserve_env_file "medical-agenda-saas/.env"
preserve_env_file "medical-agenda-saas/.env.local"

has_path_changes() {
  local rel_path="$1"
  if [ "$HAS_BACKUP" -eq 0 ]; then
    return 0
  fi

  if [ ! -e "$BACKUP_DIR/$rel_path" ] && [ ! -e "$STAGING_DIR/$rel_path" ]; then
    return 1
  fi

  if [ ! -e "$BACKUP_DIR/$rel_path" ] || [ ! -e "$STAGING_DIR/$rel_path" ]; then
    return 0
  fi

  diff -qr "$BACKUP_DIR/$rel_path" "$STAGING_DIR/$rel_path" >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    return 1
  fi
  return 0
}

SERVICES=()
if has_path_changes "whatsapp_gateway"; then
  SERVICES+=("gateway")
fi
if has_path_changes "brain"; then
  SERVICES+=("brain")
fi
if has_path_changes "api"; then
  SERVICES+=("api")
fi
MEDICAL_CHANGED=0
if has_path_changes "medical-agenda-saas" || has_path_changes "scripts/deploy_medical_agenda_domain.sh"; then
  MEDICAL_CHANGED=1
fi
if has_path_changes "docker" || has_path_changes "docker-compose.yml" || has_path_changes "docker-compose.prod.yml"; then
  SERVICES=("api" "gateway" "brain")
fi

# Deduplicar servicios manteniendo orden.
UNIQ_SERVICES=()
for svc in "${SERVICES[@]}"; do
  skip=0
  for existing in "${UNIQ_SERVICES[@]}"; do
    if [ "$existing" = "$svc" ]; then
      skip=1
      break
    fi
  done
  if [ "$skip" -eq 0 ]; then
    UNIQ_SERVICES+=("$svc")
  fi
done

rollback() {
  echo "*** Iniciando rollback automático ***"
  if [ "$HAS_BACKUP" -ne 1 ] || [ ! -d "$BACKUP_DIR" ]; then
    echo "Rollback no disponible: no hay backup previo" >&2
    return 1
  fi

  mkdir -p "$APP_DIR"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$BACKUP_DIR/" "$APP_DIR/"
  else
    rm -rf "$APP_DIR"
    cp -a "$BACKUP_DIR" "$APP_DIR"
  fi

  cd "$APP_DIR" || return 1
  $DC_CMD up -d --build api gateway brain
  docker ps || true
  return 0
}

run_health_checks() {
  docker ps

  if docker ps --format '{{.Names}}' | grep -q '^gs_gateway$'; then
    if ! curl -fsS "http://localhost:8002/health" >/tmp/gsentinel_gateway_health.txt; then
      echo "Health local gateway falló" >&2
      return 1
    fi
  fi

  if ! curl -fsS "$MEDICAL_LOCAL_HEALTH" >/tmp/medical_agenda_health.txt; then
    echo "Health local medical-agenda-saas falló" >&2
    return 1
  fi

  local doctor_status
  doctor_status="$(curl -sS -o /tmp/medical_doctor_dashboard.html -w "%{http_code}" --max-time 15 "http://localhost:3000/doctor/dashboard" || true)"
  if [ "$doctor_status" = "404" ] || [ "$doctor_status" = "000" ]; then
    echo "Ruta local /doctor/dashboard inválida: HTTP $doctor_status" >&2
    return 1
  fi

  local secretaria_status
  secretaria_status="$(curl -sS -o /tmp/medical_secretaria_dashboard.html -w "%{http_code}" --max-time 15 "http://localhost:3000/secretaria/dashboard" || true)"
  if [ "$secretaria_status" = "404" ] || [ "$secretaria_status" = "000" ]; then
    echo "Ruta local /secretaria/dashboard inválida: HTTP $secretaria_status" >&2
    return 1
  fi

  curl -fsS "$VERIFY_URL" >/tmp/medical_agenda_public_health.txt || return 1

  local public_doctor_status
  public_doctor_status="$(curl -sS -o /tmp/medical_public_doctor_dashboard.html -w "%{http_code}" --max-time 15 "https://gsentinelhealth.com.ar/doctor/dashboard" || true)"
  if [ "$public_doctor_status" = "404" ] || [ "$public_doctor_status" = "000" ]; then
    echo "Ruta pública /doctor/dashboard inválida: HTTP $public_doctor_status" >&2
    return 1
  fi

  local public_secretaria_status
  public_secretaria_status="$(curl -sS -o /tmp/medical_public_secretaria_dashboard.html -w "%{http_code}" --max-time 15 "https://gsentinelhealth.com.ar/secretaria/dashboard" || true)"
  if [ "$public_secretaria_status" = "404" ] || [ "$public_secretaria_status" = "000" ]; then
    echo "Ruta pública /secretaria/dashboard inválida: HTTP $public_secretaria_status" >&2
    return 1
  fi

  return 0
}

mkdir -p "$APP_DIR"
if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "$STAGING_DIR/" "$APP_DIR/"
else
  rm -rf "$APP_DIR"
  cp -a "$STAGING_DIR" "$APP_DIR"
fi
rm -rf "$STAGING_DIR"

cd "$APP_DIR" || exit 1

if [ "${#UNIQ_SERVICES[@]}" -gt 0 ]; then
  echo "Reconstruyendo servicios: ${UNIQ_SERVICES[*]}"
  $DC_CMD up -d --build "${UNIQ_SERVICES[@]}"
else
  echo "Sin cambios en api/brain/gateway: no se reconstruyen servicios"
fi

if [ "$MEDICAL_CHANGED" -eq 1 ]; then
  echo "Reconstruyendo medical-agenda-saas y nginx de dominio"
  bash scripts/deploy_medical_agenda_domain.sh
fi

if ! run_health_checks; then
  echo "Health checks fallaron. Ejecutando rollback..."
  if ! rollback; then
    echo "Rollback falló" >&2
    exit 1
  fi
  echo "Rollback aplicado"
  exit 1
fi

echo "Deploy completado correctamente"
'@

$remoteScript = $remoteScript.Replace("__VPS_USER__", $VpsUser)
$remoteScript = $remoteScript.Replace("__REMOTE_PACKAGE_PATH__", $RemotePackagePath)

Set-Content -Path $remoteScriptPath -Value $remoteScript -Encoding UTF8NoBOM

try {
    Write-Step "Subiendo script remoto de deploy"
    $scpScriptCliOptions = @()
    $scpScriptCliOptions += $sshCliOptions
    $scpScriptCliOptions += $remoteScriptPath
    $scpScriptCliOptions += "$VpsUser@$VpsHost`:/tmp/gsentinel-remote-deploy.sh"
    & scp @scpScriptCliOptions
    Assert-ExternalSuccess -StepName "SCP de script remoto"

    Write-Step "Ejecutando deploy remoto con backup, rebuild selectivo y rollback automático"
    $sshCli = @()
    $sshCli += $sshCliOptions
    $sshCli += "$VpsUser@$VpsHost"
    $sshCli += "bash /tmp/gsentinel-remote-deploy.sh"
    & ssh @sshCli
    Assert-ExternalSuccess -StepName "Ejecución remota del deploy"
}
finally {
    Write-Step "Limpieza de temporales locales"
    Remove-Item -ErrorAction SilentlyContinue $localPackage, $remoteScriptPath
}

Write-Host "`nDeploy finalizado." -ForegroundColor Green
