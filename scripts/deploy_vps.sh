#!/usr/bin/env bash
# scripts/deploy_vps.sh
# Deploy seguro a VPS: pull código, build, restart, limpieza sin borrar datos.
#
# Uso:
#   bash scripts/deploy_vps.sh
#   COMPOSE_FILE=docker-compose.prod.yml bash scripts/deploy_vps.sh
#
# Requisitos previos:
#   1. .env con todas las variables de producción listo en el directorio del proyecto.
#   2. Backup de BD realizado antes del deploy (ver sección backup abajo).
#   3. Migraciones Alembic probadas en staging.
set -euo pipefail

if ! command -v flock >/dev/null 2>&1; then
  echo "Error: flock no esta disponible en este sistema."
  exit 1
fi

# Evita deploys concurrentes sobre el mismo host.
exec 200>/tmp/deploy.lock
flock -n 200 || {
  echo "Error: ya hay un deploy en ejecucion (lock: /tmp/deploy.lock)."
  exit 1
}

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$PROJECT_DIR"

echo "============================================="
echo " Deploy VPS — $(date '+%Y-%m-%dT%H:%M:%S')"
echo " Directorio: $PROJECT_DIR"
echo " Compose:    $COMPOSE_FILE"
echo "============================================="

echo ""
echo "=== [1/8] Disco antes del deploy ==="
df -h

echo ""
echo "=== [2/8] Pull de código ==="
git pull --ff-only

echo ""
echo "=== [3/8] Build de imágenes ==="
docker compose -f "$COMPOSE_FILE" build

echo ""
echo "=== [4/8] Migraciones de base de datos ==="
# Ejecutar alembic dentro del contenedor api temporalmente
# Si la API no tiene el comando alembic disponible, ejecutar localmente con venv activado
if docker compose -f "$COMPOSE_FILE" run --rm --no-deps api alembic upgrade head 2>/dev/null; then
  echo "  Migraciones aplicadas via contenedor."
else
  echo "  ⚠ No se pudo ejecutar alembic dentro del contenedor."
  echo "  Ejecutar manualmente: source .venv/bin/activate && alembic upgrade head"
fi

echo ""
echo "=== [5/8] Reiniciando servicios ==="
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "=== [6/8] Limpieza de recursos Docker sin uso (sin borrar datos) ==="
docker container prune -f || true
docker image prune -af || true
docker builder prune -af || true

echo ""
echo "=== [7/8] Estado de contenedores ==="
docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "=== [8/8] Disco después del deploy ==="
df -h

echo ""
echo "✅  Deploy completado."
echo ""
echo "Próximos pasos:"
echo "  1. Verificar logs:   docker compose -f $COMPOSE_FILE logs -f --tail=50"
echo "  2. Health check:     bash scripts/vps_healthcheck.sh"
echo "  3. Auditoría logs:   python scripts/audit_logs_sensitive.py --docker gs_api gs_brain gs_gateway"
echo ""
echo "COMANDOS PROHIBIDOS (no ejecutar salvo emergencia controlada):"
echo "  ❌  docker system prune -a --volumes"
echo "  ❌  docker compose down -v"
echo "  ❌  docker volume prune"
echo "  ❌  rm -rf /var/lib/docker"
