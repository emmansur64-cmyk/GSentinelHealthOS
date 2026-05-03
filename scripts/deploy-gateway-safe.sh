#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Preflight WhatsApp Gateway =="

./scripts/validate-env.sh
./scripts/backup-production-state.sh

docker info >/dev/null
docker ps --format '{{.Names}}' | grep -q '^sentinel-redis-master$' || {
  echo "ERROR: sentinel-redis-master no está corriendo"
  exit 1
}

docker network inspect gsentinelhealthos_sentinel-network >/dev/null
docker inspect sentinel-redis-master --format '{{json .NetworkSettings.Networks}}' | grep -q 'gsentinelhealthos_sentinel-network' || {
  echo "ERROR: sentinel-redis-master no está en gsentinelhealthos_sentinel-network"
  exit 1
}

echo "== Build gateway =="
docker-compose -f docker-compose.yml build gateway

echo "== Up gateway sin dependencias =="
docker-compose -f docker-compose.yml up -d --no-deps --force-recreate gateway

echo "== Validacion =="
docker exec sentinel-gateway sh -lc 'echo "REDIS_URL=$REDIS_URL"; echo "WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID"; echo "WHATSAPP_BUSINESS_ACCOUNT_ID=$WHATSAPP_BUSINESS_ACCOUNT_ID"; echo "WHATSAPP_APP_SECRET_LENGTH=${#WHATSAPP_APP_SECRET}"'
curl -f http://127.0.0.1:8002/health

BAD_LOGS="$(docker logs --tail=200 sentinel-gateway 2>&1 | grep -E 'localhost:6379|127\.0\.0\.1:6379|redis://redis-master:6379|sentinel-sentinel|MasterNotFoundError|Name or service not known|Firma invalida|Firma inválida|403 Forbidden' || true)"
if [ -n "$BAD_LOGS" ]; then
  echo "ERROR: logs del gateway contienen errores prohibidos"
  echo "$BAD_LOGS"
  exit 1
fi

docker logs --tail=50 sentinel-gateway

echo "Gateway desplegado correctamente sin tocar Redis"
