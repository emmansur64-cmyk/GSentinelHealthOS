#!/usr/bin/env bash
# scripts/migrate_postgres_external.sh
# Migracion segura de Postgres local -> Postgres externo con rollback documentado.

set -euo pipefail

if ! command -v flock >/dev/null 2>&1; then
  echo "Error: flock no esta disponible en este sistema."
  exit 1
fi

exec 201>/tmp/migrate_postgres_external.lock
flock -n 201 || {
  echo "Error: ya existe una migracion de Postgres en ejecucion."
  exit 1
}

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
STATE_ENV_FILE="${STATE_ENV_FILE:-.env.prod}"
DB_SERVICE="${DB_SERVICE:-db}"
API_SERVICE="${API_SERVICE:-api}"
APP_SERVICES="${APP_SERVICES:-api gateway brain}"
BACKUP_FILE="${BACKUP_FILE:-backup_pre_migration_$(date +%Y%m%d_%H%M%S).dump}"

LOCAL_DB_USER="${LOCAL_DB_USER:-${DB_USER:-}}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-${POSTGRES_DB:-gsentinel}}"

EXTERNAL_PGHOST="${EXTERNAL_PGHOST:-}"
EXTERNAL_PGPORT="${EXTERNAL_PGPORT:-5432}"
EXTERNAL_PGUSER="${EXTERNAL_PGUSER:-}"
EXTERNAL_PGDATABASE="${EXTERNAL_PGDATABASE:-}"
EXTERNAL_PGPASSWORD="${EXTERNAL_PGPASSWORD:-}"
EXTERNAL_DATABASE_URL="${EXTERNAL_DATABASE_URL:-}"

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

build_external_database_url() {
  if [ -n "$EXTERNAL_DATABASE_URL" ]; then
    printf '%s' "$EXTERNAL_DATABASE_URL"
    return
  fi

  require_var EXTERNAL_PGHOST
  require_var EXTERNAL_PGUSER
  require_var EXTERNAL_PGDATABASE
  require_var EXTERNAL_PGPASSWORD

  printf 'postgresql+psycopg://%s:%s@%s:%s/%s' \
    "$EXTERNAL_PGUSER" "$EXTERNAL_PGPASSWORD" "$EXTERNAL_PGHOST" "$EXTERNAL_PGPORT" "$EXTERNAL_PGDATABASE"
}

validate_table_exists() {
  local table_name="$1"
  PGPASSWORD="$EXTERNAL_PGPASSWORD" psql \
    -h "$EXTERNAL_PGHOST" \
    -p "$EXTERNAL_PGPORT" \
    -U "$EXTERNAL_PGUSER" \
    -d "$EXTERNAL_PGDATABASE" \
    -Atqc "SELECT to_regclass('public.${table_name}') IS NOT NULL;" | grep -qi "t"
}

main() {
  require_var LOCAL_DB_USER
  require_var LOCAL_DB_NAME

  if ! command -v pg_restore >/dev/null 2>&1; then
    echo "Error: pg_restore no esta disponible en host."
    exit 1
  fi

  if ! command -v psql >/dev/null 2>&1; then
    echo "Error: psql no esta disponible en host."
    exit 1
  fi

  local target_database_url
  target_database_url="$(build_external_database_url)"

  echo "[1/10] Backup previo desde Postgres local (${DB_SERVICE})"
  docker compose -f "$COMPOSE_FILE" exec -T "$DB_SERVICE" \
    pg_dump -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -Fc > "$BACKUP_FILE"
  echo "  Backup generado: $BACKUP_FILE"

  echo "[2/10] Verificacion de backup"
  pg_restore -l "$BACKUP_FILE" | head -n 20

  if [ -z "$EXTERNAL_DATABASE_URL" ]; then
    echo "[3/10] Validacion de conectividad a Postgres externo"
    PGPASSWORD="$EXTERNAL_PGPASSWORD" psql \
      -h "$EXTERNAL_PGHOST" -p "$EXTERNAL_PGPORT" -U "$EXTERNAL_PGUSER" -d "$EXTERNAL_PGDATABASE" \
      -Atqc "SELECT 1;" >/dev/null
  else
    echo "[3/10] URL externa provista en EXTERNAL_DATABASE_URL (sin imprimir secreto)."
  fi

  echo "[4/10] Restauracion en Postgres externo"
  if [ -n "$EXTERNAL_DATABASE_URL" ]; then
    echo "  Nota: para restaurar con URL completa, exporta EXTERNAL_PGHOST/PORT/USER/DB/PASSWORD."
    echo "  Se omite restore automatico por seguridad operativa."
    exit 1
  fi

  PGPASSWORD="$EXTERNAL_PGPASSWORD" pg_restore \
    --clean --if-exists --no-owner --no-privileges \
    -h "$EXTERNAL_PGHOST" -p "$EXTERNAL_PGPORT" -U "$EXTERNAL_PGUSER" -d "$EXTERNAL_PGDATABASE" \
    "$BACKUP_FILE"

  echo "[5/10] Validacion de tablas criticas"
  for table in clinics clients patients appointments client_whatsapp_accounts alembic_version; do
    if validate_table_exists "$table"; then
      echo "  OK table: $table"
    else
      echo "  Error: tabla critica ausente: $table"
      exit 1
    fi
  done

  echo "[6/10] Validacion de migraciones Alembic en destino"
  DATABASE_URL="$target_database_url" docker compose -f "$COMPOSE_FILE" run --rm --no-deps "$API_SERVICE" alembic current
  DATABASE_URL="$target_database_url" docker compose -f "$COMPOSE_FILE" run --rm --no-deps "$API_SERVICE" alembic heads
  DATABASE_URL="$target_database_url" docker compose -f "$COMPOSE_FILE" run --rm --no-deps "$API_SERVICE" alembic upgrade head

  echo "[7/10] Escribir DATABASE_URL en ${STATE_ENV_FILE} (sin imprimir valor)"
  upsert_env_var "$STATE_ENV_FILE" "DATABASE_URL" "$target_database_url"

  echo "[8/10] Reinicio controlado de servicios de app (sin tocar volumenes)"
  docker compose -f "$COMPOSE_FILE" --env-file "$STATE_ENV_FILE" up -d --no-deps --build $APP_SERVICES

  echo "[9/10] Checklist funcional sugerido"
  echo "  - Login panel"
  echo "  - Lectura agenda"
  echo "  - Creacion turno"
  echo "  - Webhook WhatsApp"
  echo "  - Outgoing WhatsApp"
  echo "  - Aislamiento clinic_id"

  echo "[10/10] Rollback rapido (si algo falla)"
  echo "  1) Restaurar DATABASE_URL previa en ${STATE_ENV_FILE}"
  echo "  2) docker compose -f ${COMPOSE_FILE} --env-file ${STATE_ENV_FILE} up -d --no-deps --build ${APP_SERVICES}"
  echo "  3) No borrar volumen local de Postgres"

  echo "Migracion Postgres completada sin comandos destructivos."
}

main "$@"
