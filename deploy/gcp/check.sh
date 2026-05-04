#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-$HOME/GSentinelHealthOS}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "Falta docker"
command -v docker-compose >/dev/null 2>&1 || die "Falta docker-compose"
command -v curl >/dev/null 2>&1 || die "Falta curl"

cd "$APP_DIR" || die "No existe la carpeta esperada: ${APP_DIR}"
[[ -f docker-compose.yml ]] || die "No existe docker-compose.yml en ${APP_DIR}"

echo "=== Contenedores ==="
docker-compose ps

echo
echo "=== API readiness ==="
curl -fsS http://localhost:8000/api/health/readiness
echo

echo
echo "=== Gateway health ==="
curl -fsS http://localhost:8002/health
echo

echo
echo "=== Redis desde api ==="
docker-compose exec -T api python - <<'PY'
import os, redis
url = os.getenv("REDIS_URL")
print("REDIS_URL =", url)
r = redis.Redis.from_url(url)
print("PING =", r.ping())
PY

echo
echo "=== Logs sentinel-api ==="
docker logs --tail=40 sentinel-api

echo
echo "=== Logs sentinel-gateway ==="
docker logs --tail=40 sentinel-gateway

echo
echo "=== Logs sentinel-brain ==="
docker logs --tail=40 sentinel-brain

