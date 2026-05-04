#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/GSentinelHealthOS}"
PUBLIC_IP="${PUBLIC_IP:-34.39.235.83}"
WEBHOOK_URL="http://${PUBLIC_IP}:8002/webhook/whatsapp"

REQUIRED_ENV_VARS=(
  JWT_SECRET
  GATEWAY_API_KEY
  BRAIN_API_KEY
  INTERNAL_SERVICES_KEY
  WHATSAPP_VERIFY_TOKEN
  WHATSAPP_ACCESS_TOKEN
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_BUSINESS_ACCOUNT_ID
  WHATSAPP_APP_SECRET
)

die() {
  echo "ERROR: $*" >&2
  exit 1
}

log() {
  echo
  echo "=== $* ==="
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Falta el comando requerido: $1"
}

env_value() {
  local key="$1"
  grep -E "^[[:space:]]*${key}=" .env | tail -n 1 | sed -E "s/^[[:space:]]*${key}=//" | sed -E 's/[[:space:]]+#.*$//' | sed -E 's/^["'\'']?//' | sed -E 's/["'\'']?$//'
}

validate_env() {
  [[ -f .env ]] || die "No existe .env en ${APP_DIR}. Crear el archivo antes de deployar."

  local missing=()
  for key in "${REQUIRED_ENV_VARS[@]}"; do
    if ! grep -Eq "^[[:space:]]*${key}=" .env; then
      missing+=("$key")
      continue
    fi

    local value
    value="$(env_value "$key")"
    if [[ -z "${value//[[:space:]]/}" ]]; then
      missing+=("$key")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    printf 'ERROR: Faltan variables criticas o estan vacias en .env:\n' >&2
    printf ' - %s\n' "${missing[@]}" >&2
    exit 1
  fi
}

log "Preparando deploy GSentinelHealthOS"
require_command git
require_command docker
require_command docker-compose
require_command curl

cd "$APP_DIR" || die "No existe la carpeta esperada: ${APP_DIR}"

log "Actualizando repo"
git pull --ff-only

[[ -f .env ]] || die "No existe .env en ${APP_DIR}. Crear el archivo antes de deployar."
[[ -f docker-compose.yml ]] || die "No existe docker-compose.yml en ${APP_DIR}"
[[ -f MetaBrain/nlu_engine.py ]] || die "No existe MetaBrain/nlu_engine.py. MetaBrain debe estar presente."
validate_env

log "Construyendo imagenes principales"
docker-compose build api brain gateway

log "Levantando infraestructura"
docker-compose up -d \
  postgres \
  redis-master \
  redis-cache \
  redis-metrics \
  redis-replica-1 \
  redis-replica-2 \
  redis-sentinel-1 \
  redis-sentinel-2 \
  redis-sentinel-3

log "Levantando aplicaciones"
docker-compose up -d \
  api \
  brain \
  gateway \
  booking-worker-0 \
  booking-worker-1 \
  outbox-scheduler

log "Ejecutando migraciones"
docker-compose exec -T api alembic upgrade head

log "Estado de contenedores"
docker ps

log "Verificando API local"
curl -fsS http://localhost:8000/api/health/readiness >/tmp/gsentinel-api-readiness.json
cat /tmp/gsentinel-api-readiness.json
echo

log "Verificando Gateway local"
curl -fsS http://localhost:8002/health >/tmp/gsentinel-gateway-health.json
cat /tmp/gsentinel-gateway-health.json
echo

echo
echo "API local OK"
echo "Gateway local OK"
echo "Webhook publico esperado: ${WEBHOOK_URL}"
