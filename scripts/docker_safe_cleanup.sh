#!/usr/bin/env bash
# scripts/docker_safe_cleanup.sh
# Limpieza Docker segura: elimina contenedores detenidos, imagenes dangling/no usadas,
# cache de build y redes no usadas. NUNCA borra volumenes ni datos persistentes.
#
# Uso: bash scripts/docker_safe_cleanup.sh
# Cron diario seguro (03:00):
#   0 3 * * * /ruta/absoluta/scripts/docker_safe_cleanup.sh >> /var/log/docker_safe_cleanup.log 2>&1
set -euo pipefail

LOG_FILE="/var/log/docker_safe_cleanup.log"

# Evita ejecuciones concurrentes.
exec 200>/tmp/docker_safe_cleanup.lock
flock -n 200 || {
	echo "[$(date '+%Y-%m-%dT%H:%M:%S')] Limpieza ya en ejecucion. Abortando."
	exit 1
}

touch "$LOG_FILE"
exec >>"$LOG_FILE" 2>&1

echo "============================================="
echo "Docker Safe Cleanup START $(date '+%Y-%m-%dT%H:%M:%S')"
echo "============================================="

echo ""
echo "=== docker system df (ANTES) ==="
docker system df || true

echo ""
echo "=== Limpieza segura: contenedores detenidos ==="
docker container prune -f || true

echo ""
echo "=== Limpieza segura: imagenes dangling/no usadas ==="
docker image prune -f || true

echo ""
echo "=== Limpieza segura: build cache antiguo (>=24h) ==="
docker builder prune -f --filter "until=24h" || true

echo ""
echo "=== Limpieza segura: redes no usadas ==="
docker network prune -f || true

echo ""
echo "=== docker system df (DESPUES) ==="
docker system df || true

echo ""
echo "Docker Safe Cleanup END $(date '+%Y-%m-%dT%H:%M:%S')"
echo "============================================="
