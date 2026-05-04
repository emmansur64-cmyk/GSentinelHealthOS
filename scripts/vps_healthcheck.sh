#!/usr/bin/env bash
# scripts/vps_healthcheck.sh
# Diagnóstico rápido del estado del VPS y los contenedores Docker.
#
# Uso: bash scripts/vps_healthcheck.sh
set -euo pipefail

DISK_WARN_PERCENT="${DISK_WARN_PERCENT:-85}"
MEM_WARN_PERCENT="${MEM_WARN_PERCENT:-90}"
STATE_ENV_FILE="${STATE_ENV_FILE:-.env.prod}"

if [ -f "${STATE_ENV_FILE}" ]; then
  set -a
  # shellcheck disable=SC1090
  source "${STATE_ENV_FILE}"
  set +a
fi

DATABASE_URL="${DATABASE_URL:-}"
REDIS_URL_TARGET="${REDIS_URL:-}"

mask_url() {
  local raw="$1"
  if [ -z "$raw" ]; then
    echo "N/A"
    return
  fi
  python3 - "$raw" <<'PY'
import sys
from urllib.parse import urlsplit

value = sys.argv[1]
value = value.replace("postgresql+psycopg://", "postgresql://", 1)
parsed = urlsplit(value)
host = parsed.hostname or "unknown"
port = parsed.port or (5432 if parsed.scheme.startswith("postgres") else 6379)
db = (parsed.path or "/").lstrip("/") or "default"
print(f"{parsed.scheme}://***@{host}:{port}/{db}")
PY
}

echo "============================================="
echo " VPS Health Check — $(date '+%Y-%m-%dT%H:%M:%S')"
echo "============================================="

echo ""
echo "=== DISCO ==="
df -h

DISK_USED_PERCENT="$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')"
if [ -n "${DISK_USED_PERCENT}" ] && [ "${DISK_USED_PERCENT}" -ge "${DISK_WARN_PERCENT}" ]; then
  echo "  ⚠ ALERTA: uso de disco en / = ${DISK_USED_PERCENT}% (umbral ${DISK_WARN_PERCENT}%)"
else
  echo "  OK: uso de disco en / = ${DISK_USED_PERCENT:-N/A}%"
fi

echo ""
echo "=== MEMORIA ==="
free -h

MEM_USED_PERCENT="$(free | awk '/^Mem:/ {if ($2 > 0) printf "%.0f", ($3/$2)*100; else print 0}')"
if [ -n "${MEM_USED_PERCENT}" ] && [ "${MEM_USED_PERCENT}" -ge "${MEM_WARN_PERCENT}" ]; then
  echo "  ⚠ ALERTA: uso de memoria = ${MEM_USED_PERCENT}% (umbral ${MEM_WARN_PERCENT}%)"
else
  echo "  OK: uso de memoria = ${MEM_USED_PERCENT:-N/A}%"
fi

echo ""
echo "=== DOCKER SYSTEM DF ==="
docker system df || true

echo ""
echo "=== POSTGRES (externo o local por DATABASE_URL) ==="
if [ -z "${DATABASE_URL}" ]; then
  echo "  DATABASE_URL no definida en entorno activo."
else
  echo "  Target: $(mask_url "${DATABASE_URL}")"
  if command -v psql >/dev/null 2>&1; then
    PG_LATENCY_MS="$(python3 - <<'PY'
import os
import time
import subprocess

url = os.getenv("DATABASE_URL", "")
if not url:
    print("N/A")
    raise SystemExit(0)

cmd = [
    "psql",
    url,
    "-Atqc",
    "SELECT 1;",
]
start = time.time()
proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
elapsed = int((time.time() - start) * 1000)
if proc.returncode == 0 and proc.stdout.strip() == "1":
    print(str(elapsed))
else:
    print("FAIL")
PY
)"
    if [ "${PG_LATENCY_MS}" = "FAIL" ]; then
      echo "  ALERTA: fallo de conectividad o query en Postgres."
    else
      echo "  OK: Postgres reachable, latencia aproximada ${PG_LATENCY_MS} ms"
    fi
  else
    echo "  Nota: psql no disponible en host; omitiendo prueba SQL directa."
  fi
fi

echo ""
echo "=== CONTENEDORES EN EJECUCIÓN ==="
docker ps

echo ""
echo "=== USO DE RECURSOS (snapshot) ==="
docker stats --no-stream || true

echo ""
echo "=== DIRECTORIOS GRANDES EN /var/lib/docker ==="
sudo -n du -h /var/lib/docker --max-depth=1 2>/dev/null | sort -hr || \
  echo "  (se requiere sudo para ver /var/lib/docker)"

echo ""
echo "=== COLAS REDIS (si el master está activo) ==="
REDIS_CONTAINER="${REDIS_CONTAINER:-}"
if [ -z "${REDIS_CONTAINER}" ]; then
  REDIS_CONTAINER="$(docker ps --filter 'label=com.docker.compose.service=redis-master' --format '{{.Names}}' | head -n1)"
fi
if [ -n "${REDIS_CONTAINER}" ] && docker ps --format '{{.Names}}' | grep -q "^${REDIS_CONTAINER}$"; then
  echo "  whatsapp:incoming  len=$(docker exec "${REDIS_CONTAINER}" redis-cli LLEN whatsapp:incoming 2>/dev/null || echo N/A)"
  echo "  whatsapp:outgoing  len=$(docker exec "${REDIS_CONTAINER}" redis-cli LLEN whatsapp:outgoing 2>/dev/null || echo N/A)"
  echo "  whatsapp:outgoing:dead (DLQ)  len=$(docker exec "${REDIS_CONTAINER}" redis-cli LLEN whatsapp:outgoing:dead 2>/dev/null || echo N/A)"
  echo "  Redis info memory:"
  REDIS_INFO="$(docker exec "${REDIS_CONTAINER}" redis-cli INFO memory 2>/dev/null || true)"
  echo "${REDIS_INFO}" | grep -E "used_memory_human|maxmemory_human|maxmemory_policy|maxmemory:" || true

  REDIS_MAXMEMORY_BYTES="$(echo "${REDIS_INFO}" | awk -F: '/^maxmemory:/{gsub("\\r", "", $2); print $2}')"
  REDIS_POLICY="$(docker exec "${REDIS_CONTAINER}" redis-cli CONFIG GET maxmemory-policy 2>/dev/null | tail -n1 | tr -d '\r')"

  if [ -z "${REDIS_MAXMEMORY_BYTES}" ] || [ "${REDIS_MAXMEMORY_BYTES}" = "0" ]; then
    echo "  ⚠ ALERTA: Redis maxmemory no esta configurado (maxmemory=0)."
  else
    echo "  OK: Redis maxmemory configurado (${REDIS_MAXMEMORY_BYTES} bytes)."
  fi

  if [ "${REDIS_POLICY}" = "noeviction" ]; then
    echo "  OK: Redis maxmemory-policy=${REDIS_POLICY}."
  else
    echo "  ⚠ ALERTA: Redis maxmemory-policy=${REDIS_POLICY:-N/A} (esperado: noeviction)."
  fi
else
  echo "  Contenedor '${REDIS_CONTAINER}' no encontrado o no activo."
fi

echo ""
echo "=== REDIS (externo o local por REDIS_URL) ==="
if [ -z "${REDIS_URL_TARGET}" ]; then
  echo "  REDIS_URL no definida en entorno activo."
elif ! command -v redis-cli >/dev/null 2>&1; then
  echo "  Nota: redis-cli no disponible en host; omitiendo prueba externa."
else
  echo "  Target: $(mask_url "${REDIS_URL_TARGET}")"
  if redis-cli -u "${REDIS_URL_TARGET}" PING >/dev/null 2>&1; then
    echo "  OK: Redis PING"
    REDIS_INFO_EXTERNAL="$(redis-cli -u "${REDIS_URL_TARGET}" INFO memory 2>/dev/null || true)"
    echo "${REDIS_INFO_EXTERNAL}" | grep -E "used_memory_human|maxmemory_human|maxmemory_policy|maxmemory:" || true
    REDIS_MAXMEM_EXTERNAL="$(echo "${REDIS_INFO_EXTERNAL}" | awk -F: '/^maxmemory:/{gsub("\\r", "", $2); print $2}')"
    REDIS_POLICY_EXTERNAL="$(redis-cli -u "${REDIS_URL_TARGET}" CONFIG GET maxmemory-policy 2>/dev/null | tail -n1 | tr -d '\r')"
    if [ -z "${REDIS_MAXMEM_EXTERNAL}" ] || [ "${REDIS_MAXMEM_EXTERNAL}" = "0" ]; then
      echo "  ⚠ ALERTA: Redis externo sin maxmemory (maxmemory=0)."
    else
      echo "  OK: Redis externo maxmemory configurado (${REDIS_MAXMEM_EXTERNAL} bytes)."
    fi
    if [ "${REDIS_POLICY_EXTERNAL}" = "noeviction" ]; then
      echo "  OK: Redis externo maxmemory-policy=${REDIS_POLICY_EXTERNAL}."
    else
      echo "  ⚠ ALERTA: Redis externo maxmemory-policy=${REDIS_POLICY_EXTERNAL:-N/A} (esperado: noeviction)."
    fi
    echo "  DLQ length (externo): $(redis-cli -u "${REDIS_URL_TARGET}" LLEN whatsapp:outgoing:dead 2>/dev/null || echo N/A)"
  else
    echo "  ALERTA: Redis externo no responde PING."
  fi
fi

echo ""
echo "=== VOLUMEN UPLOADS ==="
UPLOADS_VOLUME="$(docker volume ls --filter 'label=com.docker.compose.volume=uploads_data' --format '{{.Name}}' | head -n1)"
if [ -z "${UPLOADS_VOLUME}" ]; then
  echo "  ⚠ ALERTA: no se encontro volumen con label uploads_data."
else
  UPLOADS_MOUNTPOINT="$(docker volume inspect "${UPLOADS_VOLUME}" --format '{{.Mountpoint}}' 2>/dev/null || true)"
  echo "  Volumen: ${UPLOADS_VOLUME}"
  echo "  Mountpoint: ${UPLOADS_MOUNTPOINT:-N/A}"
  if [ -n "${UPLOADS_MOUNTPOINT}" ] && [ -d "${UPLOADS_MOUNTPOINT}" ]; then
    echo "  Contenido (primeros 20):"
    ls -lah "${UPLOADS_MOUNTPOINT}" | head -n 20
  else
    echo "  Nota: mountpoint no accesible desde este host; revisar contenido dentro de un contenedor." 
  fi
fi

echo ""
echo "=== CONTENEDORES CON REINICIOS RECIENTES ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}" 2>/dev/null || docker ps -a || true

echo ""
echo "=== HEALTH ENDPOINTS APP ==="
if command -v curl >/dev/null 2>&1; then
  for endpoint in "http://localhost:8000/api/health/readiness" "http://localhost:8002/health" "http://localhost:8001/health"; do
    if curl -fsS --max-time 5 "$endpoint" >/dev/null 2>&1; then
      echo "  OK: $endpoint"
    else
      echo "  ALERTA: fallo health endpoint $endpoint"
    fi
  done
else
  echo "  Nota: curl no disponible en host; omitiendo health endpoints HTTP."
fi

echo ""
echo "✅  Health check completado."
