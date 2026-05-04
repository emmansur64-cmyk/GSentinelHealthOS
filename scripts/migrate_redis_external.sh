#!/usr/bin/env bash
# scripts/migrate_redis_external.sh
# Migracion segura de Redis local -> Redis externo con rollback documentado.

set -euo pipefail

if ! command -v flock >/dev/null 2>&1; then
  echo "Error: flock no esta disponible en este sistema."
  exit 1
fi

exec 202>/tmp/migrate_redis_external.lock
flock -n 202 || {
  echo "Error: ya existe una migracion de Redis en ejecucion."
  exit 1
}

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STATE_ENV_FILE="${STATE_ENV_FILE:-.env.prod}"
REDIS_SERVICE="${REDIS_SERVICE:-redis-master}"
REDIS_CONTAINER="${REDIS_CONTAINER:-gs_redis_master}"
DEPENDENT_SERVICES="${DEPENDENT_SERVICES:-gateway brain booking_worker_0 booking_worker_1 outbox_scheduler}"
CONFIRM_WINDOW="${CONFIRM_WINDOW:-no}"
EXTERNAL_REDIS_URL="${EXTERNAL_REDIS_URL:-}"

require_var() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    echo "Error: variable requerida no definida: $name"
    exit 1
  fi
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"

  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

main() {
  require_var EXTERNAL_REDIS_URL

  if [ "$CONFIRM_WINDOW" != "yes" ]; then
    echo "Error: define CONFIRM_WINDOW=yes para ejecutar en ventana de baja actividad."
    exit 1
  fi

  if ! command -v redis-cli >/dev/null 2>&1; then
    echo "Error: redis-cli no esta disponible en host."
    exit 1
  fi

  echo "[1/9] Pausar consumidores antes del corte"
  docker compose -f "$COMPOSE_FILE" stop $DEPENDENT_SERVICES

  echo "[2/9] Inspeccionar colas locales antes de migrar"
  if docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
    echo "  incoming=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN whatsapp:incoming 2>/dev/null || echo N/A)"
    echo "  outgoing=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN whatsapp:outgoing 2>/dev/null || echo N/A)"
    echo "  dlq=$(docker exec "$REDIS_CONTAINER" redis-cli LLEN whatsapp:outgoing:dead 2>/dev/null || echo N/A)"
  else
    echo "  Aviso: contenedor local de Redis no encontrado: ${REDIS_CONTAINER}"
  fi

  echo "[3/9] Snapshot de Redis local (best effort)"
  docker compose -f "$COMPOSE_FILE" exec -T "$REDIS_SERVICE" redis-cli BGSAVE || true

  echo "[4/9] Validar conectividad Redis externo"
  redis-cli -u "$EXTERNAL_REDIS_URL" PING >/dev/null

  echo "[5/9] Escribir REDIS_URL en ${STATE_ENV_FILE} (sin imprimir valor)"
  upsert_env_var "$STATE_ENV_FILE" "REDIS_URL" "$EXTERNAL_REDIS_URL"

  echo "[6/9] Reiniciar servicios dependientes de Redis"
  docker compose -f "$COMPOSE_FILE" --env-file "$STATE_ENV_FILE" up -d --no-deps $DEPENDENT_SERVICES

  echo "[7/9] Validaciones Redis en destino"
  echo "  ping=$(redis-cli -u "$EXTERNAL_REDIS_URL" PING 2>/dev/null || echo FAIL)"
  echo "  incoming=$(redis-cli -u "$EXTERNAL_REDIS_URL" LLEN whatsapp:incoming 2>/dev/null || echo N/A)"
  echo "  outgoing=$(redis-cli -u "$EXTERNAL_REDIS_URL" LLEN whatsapp:outgoing 2>/dev/null || echo N/A)"
  echo "  dlq=$(redis-cli -u "$EXTERNAL_REDIS_URL" LLEN whatsapp:outgoing:dead 2>/dev/null || echo N/A)"
  redis-cli -u "$EXTERNAL_REDIS_URL" INFO memory 2>/dev/null | grep -E "used_memory_human|maxmemory_human|maxmemory_policy|maxmemory:" || true

  echo "[8/9] Checklist funcional sugerido"
  echo "  - TTL de sesiones"
  echo "  - Dedupe con TTL"
  echo "  - Locks"
  echo "  - Incoming queue"
  echo "  - Outgoing queue"
  echo "  - DLQ"

  echo "[9/9] Rollback rapido (si algo falla)"
  echo "  1) Restaurar REDIS_URL previa en ${STATE_ENV_FILE}"
  echo "  2) docker compose -f ${COMPOSE_FILE} --env-file ${STATE_ENV_FILE} up -d --no-deps ${DEPENDENT_SERVICES}"
  echo "  3) No borrar volumen local de Redis"

  echo "Migracion Redis completada sin comandos destructivos."
}

main "$@"
