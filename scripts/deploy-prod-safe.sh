#!/usr/bin/env bash
set -euo pipefail

# Deploy productivo seguro para GSentinelHealthOS.
# Flujo: validaciones -> backup -> fetch/pull -> build -> migraciones -> deploy docker -> validacion.
# Rollback automatico al commit previo si falla luego del pull/deploy.

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

TS="$(date +%Y%m%d_%H%M%S)"
LOG_DIR="$PROJECT_DIR/deploy-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy-prod-safe-$TS.log"

exec > >(tee -a "$LOG_FILE") 2>&1

AUTO_CONFIRM="${AUTO_CONFIRM:-0}"
EXPECTED_BRANCH="${EXPECTED_BRANCH:-main}"
MIN_DISK_MB="${MIN_DISK_MB:-2048}"
BACKUP_ROOT="${BACKUP_ROOT:-/opt/backups/gsentinelhealthos}"

ROLLBACK_REQUIRED=0
SERVICES_TOUCHED=0
REPO_CLEAN_AT_START=0
DEPLOY_PHASE="init"
PREVIOUS_COMMIT=""
CURRENT_BRANCH=""
COMPOSE_FILE="${COMPOSE_FILE:-}"
ROLLBACK_AUDIT_FILE="$LOG_DIR/rollback-audit-$TS.log"

info() { echo "[INFO] $*"; }
warn() { echo "[WARN] $*"; }
error() { echo "[ERROR] $*"; }

sanitize_output() {
  sed -E \
    -e 's#(WHATSAPP_ACCESS_TOKEN=)[^[:space:]]+#\1***REDACTED***#g' \
    -e 's#(WHATSAPP_APP_SECRET=)[^[:space:]]+#\1***REDACTED***#g' \
    -e 's#(DATABASE_URL=)[^[:space:]]+#\1***REDACTED***#g' \
    -e 's#(REDIS_URL=)redis://[^@/[:space:]]+@#\1redis://***:***@#g' \
    -e 's#([Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd][=:][[:space:]]*)[^[:space:],;]+#\1***REDACTED***#g' \
    -e 's#([Tt][Oo][Kk][Ee][Nn][=:][[:space:]]*)[^[:space:],;]+#\1***REDACTED***#g' \
    -e 's#([Ss][Ee][Cc][Rr][Ee][Tt][=:][[:space:]]*)[^[:space:],;]+#\1***REDACTED***#g' \
    -e 's#(Authorization:[[:space:]]*Bearer[[:space:]]+)[^[:space:]]+#\1***REDACTED***#g'
}

rollback() {
  local exit_code="$1"
  if [ "$exit_code" -eq 0 ]; then
    return 0
  fi

  error "Fallo en fase: $DEPLOY_PHASE (exit=$exit_code)"

  if [ "$ROLLBACK_REQUIRED" -eq 1 ] && [ -n "$PREVIOUS_COMMIT" ]; then
    warn "Iniciando rollback al commit anterior: $PREVIOUS_COMMIT"

    {
      echo "timestamp=$(date '+%Y-%m-%dT%H:%M:%S%z')"
      echo "phase=$DEPLOY_PHASE"
      echo "exit_code=$exit_code"
      echo "repo_clean_at_start=$REPO_CLEAN_AT_START"
      echo "current_head=$(git rev-parse HEAD 2>/dev/null || echo unknown)"
      echo "target_commit=$PREVIOUS_COMMIT"
      echo "git_status_begin"
      git status --porcelain=v1 -b || true
      echo "git_status_end"
    } > "$ROLLBACK_AUDIT_FILE"
    chmod 600 "$ROLLBACK_AUDIT_FILE" || true

    if [ "$REPO_CLEAN_AT_START" -ne 1 ]; then
      warn "Rollback de codigo omitido: repo no estaba limpio al inicio"
      return 0
    fi

    if ! git rev-parse --verify "${PREVIOUS_COMMIT}^{commit}" >/dev/null 2>&1; then
      warn "Rollback de codigo omitido: commit objetivo invalido ($PREVIOUS_COMMIT)"
      return 0
    fi

    # Volver al commit anterior en la rama actual.
    git reset --hard "$PREVIOUS_COMMIT"

    if [ "$SERVICES_TOUCHED" -eq 1 ] && [ -n "$COMPOSE_FILE" ] && [ -f "$COMPOSE_FILE" ]; then
      warn "Restaurando servicios con version previa"
      docker compose -f "$COMPOSE_FILE" config >/dev/null
      docker compose -f "$COMPOSE_FILE" up -d --build
      info "Rollback aplicado: codigo y servicios restaurados al commit anterior"
    elif [ "$SERVICES_TOUCHED" -eq 0 ]; then
      info "Rollback de codigo aplicado sin reiniciar servicios (aun no se habia tocado runtime)"
    else
      warn "Rollback parcial: no se encontro compose para relanzar servicios"
    fi
  else
    warn "No se requiere rollback automatico (no hubo cambios aplicados en runtime)"
  fi

  error "Deploy abortado. Revisar log: $LOG_FILE"
  exit "$exit_code"
}

trap 'rollback "$?"' EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    error "Comando requerido no disponible: $1"
    exit 1
  fi
}

resolve_compose_file() {
  if [ -n "$COMPOSE_FILE" ]; then
    if [ ! -f "$COMPOSE_FILE" ]; then
      error "COMPOSE_FILE no existe: $COMPOSE_FILE"
      exit 1
    fi
    info "Compose definido por variable: $COMPOSE_FILE"
    return 0
  fi

  # Detectar compose activo desde labels del contenedor gateway si existe.
  if docker ps --format '{{.Names}}' | grep -q '^sentinel-gateway$'; then
    local label
    label="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' sentinel-gateway 2>/dev/null || true)"
    if [ -n "$label" ]; then
      IFS=',' read -r first_compose _ <<< "$label"
      if [ -n "$first_compose" ] && [ -f "$first_compose" ]; then
        COMPOSE_FILE="$first_compose"
        info "Compose detectado desde stack activo: $COMPOSE_FILE"
        return 0
      fi
    fi
  fi

  # Fallback por convencion del repositorio.
  if [ -f "docker-compose.yml" ]; then
    COMPOSE_FILE="docker-compose.yml"
    info "Compose detectado por convencion: $COMPOSE_FILE"
    return 0
  fi

  if [ -f "docker-compose.prod.yml" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    info "Compose detectado por convencion: $COMPOSE_FILE"
    return 0
  fi

  error "No se pudo detectar docker compose productivo"
  exit 1
}

check_git_clean() {
  if ! git diff --quiet; then
    error "Hay cambios locales sin commit (working tree). Abortando."
    exit 1
  fi
  if ! git diff --cached --quiet; then
    error "Hay cambios staged sin commit. Abortando."
    exit 1
  fi
  if [ -n "$(git ls-files --others --exclude-standard -- ':!deploy-logs' ':!deploy-logs/*')" ]; then
    error "Hay archivos no trackeados. Abortando para evitar deploy inconsistente."
    exit 1
  fi
}

validate_prereqs() {
  DEPLOY_PHASE="validaciones_previas"
  info "=== 1) Validaciones previas ==="

  require_cmd git
  require_cmd docker
  require_cmd awk
  require_cmd sed
  require_cmd grep
  require_cmd df

  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  info "Rama actual: $CURRENT_BRANCH"
  if [ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]; then
    error "Rama invalida. Esperada: $EXPECTED_BRANCH"
    exit 1
  fi

  check_git_clean
  REPO_CLEAN_AT_START=1

  local origin_url
  origin_url="$(git remote get-url origin)"
  info "Remote origin detectado"
  if [[ "$origin_url" != git@* && "$origin_url" != ssh://* ]]; then
    error "El remoto origin no es SSH: $origin_url"
    exit 1
  fi

  local free_mb
  free_mb="$(df -Pm . | awk 'NR==2 {print $4}')"
  info "Espacio libre: ${free_mb}MB"
  if [ "$free_mb" -lt "$MIN_DISK_MB" ]; then
    error "Espacio insuficiente (< ${MIN_DISK_MB}MB)"
    exit 1
  fi

  docker info >/dev/null
  info "Docker activo"

  resolve_compose_file

  if [ ! -f ".env" ] && [ ! -f ".env.production" ]; then
    error "No se encontro .env ni .env.production"
    exit 1
  fi

  # Validar env_file(s) declarados en compose sin imprimir secretos.
  local env_files
  env_files="$(awk '
    $1=="env_file:" {in_env=1; next}
    in_env && $1 ~ /^-/ {gsub("-", "", $1); gsub("\"", "", $1); gsub("\047", "", $1); print $1; next}
    in_env && $1 !~ /^-/ {in_env=0}
  ' "$COMPOSE_FILE" | sed 's/^\s*//;s/\s*$//' | sed '/^$/d' | sort -u)"

  if [ -n "$env_files" ]; then
    while IFS= read -r ef; do
      [ -z "$ef" ] && continue
      if [ ! -f "$ef" ]; then
        error "Falta env_file requerido por compose: $ef"
        exit 1
      fi
      info "env_file presente: $ef"
    done <<< "$env_files"
  fi

  docker compose -f "$COMPOSE_FILE" config >/dev/null
  info "docker compose config OK"
}

run_backup() {
  DEPLOY_PHASE="backup"
  info "=== 2) Backup antes de tocar produccion ==="

  mkdir -p "$BACKUP_ROOT"
  chmod 700 "$BACKUP_ROOT"
  local backup_dir="$BACKUP_ROOT/$TS"
  mkdir -p "$backup_dir"
  chmod 700 "$backup_dir"

  info "Backup dir: $backup_dir"

  git rev-parse HEAD > "$backup_dir/git-commit.txt"
  git rev-parse --abbrev-ref HEAD > "$backup_dir/git-branch.txt"
  git remote -v > "$backup_dir/git-remotes.txt"
  chmod 600 "$backup_dir/git-commit.txt" "$backup_dir/git-branch.txt" "$backup_dir/git-remotes.txt"

  # Archivos criticos.
  [ -f ".env" ] && cp ".env" "$backup_dir/.env"
  [ -f ".env.production" ] && cp ".env.production" "$backup_dir/.env.production"
  [ -f "$backup_dir/.env" ] && chmod 600 "$backup_dir/.env"
  [ -f "$backup_dir/.env.production" ] && chmod 600 "$backup_dir/.env.production"

  find . -maxdepth 1 -type f -name 'docker-compose*.yml' -exec cp {} "$backup_dir/" \;
  find "$backup_dir" -maxdepth 1 -type f -name 'docker-compose*.yml' -exec chmod 600 {} \;

  if [ -f "medical-agenda-saas/prisma/schema.prisma" ]; then
    mkdir -p "$backup_dir/medical-agenda-saas/prisma"
    cp "medical-agenda-saas/prisma/schema.prisma" "$backup_dir/medical-agenda-saas/prisma/schema.prisma"
    chmod 600 "$backup_dir/medical-agenda-saas/prisma/schema.prisma"
  fi

  if [ -d "medical-agenda-saas/prisma/migrations" ]; then
    mkdir -p "$backup_dir/medical-agenda-saas/prisma"
    cp -R "medical-agenda-saas/prisma/migrations" "$backup_dir/medical-agenda-saas/prisma/migrations"
    find "$backup_dir/medical-agenda-saas/prisma/migrations" -type d -exec chmod 700 {} \;
    find "$backup_dir/medical-agenda-saas/prisma/migrations" -type f -exec chmod 600 {} \;
  fi

  # Backup DB postgres si el compose la usa y el contenedor esta corriendo.
  local pg_service=""
  if docker compose -f "$COMPOSE_FILE" config --services | grep -q '^postgres$'; then
    pg_service="postgres"
  elif docker compose -f "$COMPOSE_FILE" config --services | grep -q '^db$'; then
    pg_service="db"
  fi

  if [ -n "$pg_service" ]; then
    local pg_cid
    pg_cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$pg_service" || true)"
    if [ -n "$pg_cid" ]; then
      local pg_user pg_db
      pg_user="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$pg_cid" | sed -n 's/^POSTGRES_USER=//p' | head -n1)"
      pg_db="$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$pg_cid" | sed -n 's/^POSTGRES_DB=//p' | head -n1)"
      pg_user="${pg_user:-postgres}"
      pg_db="${pg_db:-postgres}"

      info "Generando backup de Postgres (servicio: $pg_service)"
      docker exec "$pg_cid" sh -lc "pg_dump -U '$pg_user' '$pg_db'" > "$backup_dir/postgres_${pg_service}.sql"
      chmod 600 "$backup_dir/postgres_${pg_service}.sql"
    else
      warn "Servicio postgres detectado en compose, pero no hay contenedor corriendo. Se omite dump."
    fi
  else
    info "Compose sin servicio postgres/db. No se genera dump."
  fi
}

show_confirm() {
  if [ "$AUTO_CONFIRM" = "1" ]; then
    info "AUTO_CONFIRM=1 -> deploy sin prompt interactivo"
    return 0
  fi

  echo
  echo "Se va a desplegar produccion con:"
  echo "- Rama: $CURRENT_BRANCH"
  echo "- Compose: $COMPOSE_FILE"
  echo "- Log: $LOG_FILE"
  echo
  read -r -p "Confirmar deploy? (yes/no): " ans
  if [ "$ans" != "yes" ]; then
    error "Deploy cancelado por usuario"
    exit 1
  fi
}

update_code() {
  DEPLOY_PHASE="actualizacion_controlada"
  info "=== 3) Actualizacion controlada ==="

  PREVIOUS_COMMIT="$(git rev-parse HEAD)"

  git fetch --prune origin

  local pending
  pending="$(git log --oneline "HEAD..origin/$CURRENT_BRANCH" || true)"
  if [ -z "$pending" ]; then
    info "No hay commits pendientes. Se continua con build/deploy."
    return 0
  fi

  info "Commits pendientes:"
  echo "$pending"

  git pull --ff-only origin "$CURRENT_BRANCH"
  ROLLBACK_REQUIRED=1
}

run_node_builds() {
  DEPLOY_PHASE="build_y_dependencias"
  info "=== 4) Build y dependencias ==="

  local node_projects=()

  # Detectar proyecto Node/Next productivo del stack actual.
  if [ -f "medical-agenda-saas/package.json" ]; then
    node_projects+=("medical-agenda-saas")
  fi
  if [ -f "package.json" ]; then
    node_projects+=(".")
  fi

  if [ "${#node_projects[@]}" -eq 0 ]; then
    info "No se detectaron proyectos Node en contexto productivo."
    return 0
  fi

  require_cmd node

  local project
  for project in "${node_projects[@]}"; do
    [ -d "$project" ] || continue

    info "Procesando Node project: $project"
    pushd "$project" >/dev/null

    local pm=""
    if [ -f "package-lock.json" ]; then
      pm="npm"
      require_cmd npm
      npm ci
    elif [ -f "pnpm-lock.yaml" ]; then
      pm="pnpm"
      require_cmd pnpm
      pnpm install --frozen-lockfile
    elif [ -f "yarn.lock" ]; then
      pm="yarn"
      require_cmd yarn
      yarn install --frozen-lockfile
    else
      error "No se encontro lockfile en $project"
      popd >/dev/null
      exit 1
    fi

    # Build real solo si existe script build.
    if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts.build ? 0 : 1)"; then
      case "$pm" in
        npm) npm run build ;;
        pnpm) pnpm run build ;;
        yarn) yarn build ;;
      esac
      info "Build OK en $project"
    else
      warn "No hay script build en $project. Se omite build Node."
    fi

    popd >/dev/null
  done
}

run_migrations() {
  DEPLOY_PHASE="migraciones"
  info "=== 5) Migraciones ==="

  if [ -f "medical-agenda-saas/prisma/schema.prisma" ] && [ -d "medical-agenda-saas/prisma/migrations" ]; then
    info "Prisma detectado en medical-agenda-saas"
    pushd medical-agenda-saas >/dev/null
    require_cmd npx
    npx prisma migrate deploy --schema prisma/schema.prisma
    popd >/dev/null
    info "Prisma migrate deploy OK"
  else
    info "No se detectaron migraciones Prisma para ejecutar"
  fi
}

run_docker_deploy() {
  DEPLOY_PHASE="docker_deploy"
  info "=== 6) Docker deploy ==="

  docker compose -f "$COMPOSE_FILE" config >/dev/null

  # Solo levantar tras build/migraciones exitosas.
  SERVICES_TOUCHED=1
  docker compose -f "$COMPOSE_FILE" up -d --build

  ROLLBACK_REQUIRED=1
}

post_validate() {
  DEPLOY_PHASE="validacion_posterior"
  info "=== 7) Validacion posterior ==="

  docker compose -f "$COMPOSE_FILE" ps

  local services
  services="$(docker compose -f "$COMPOSE_FILE" config --services)"

  info "Logs recientes de servicios criticos"
  while IFS= read -r svc; do
    [ -z "$svc" ] && continue
    if echo "$svc" | grep -Eiq 'api|brain|gateway|front|worker|redis|db|postgres'; then
      echo "----- logs: $svc -----"
      docker compose -f "$COMPOSE_FILE" logs --tail=40 "$svc" 2>&1 | sanitize_output || true
    fi
  done <<< "$services"

  info "Health checks HTTP locales"
  local ok=0
  local url
  for url in \
    "http://127.0.0.1:8000/api/health" \
    "http://127.0.0.1:8000/health" \
    "http://127.0.0.1:8001/health" \
    "http://127.0.0.1:8002/health" \
    "http://127.0.0.1:3000/api/health"; do
    if curl -fsS --max-time 6 "$url" >/dev/null 2>&1; then
      info "Health OK: $url"
      ok=$((ok+1))
    fi
  done
  if [ "$ok" -eq 0 ]; then
    warn "No se encontro endpoint health HTTP respondiendo"
  fi

  local running_services
  running_services="$(docker compose -f "$COMPOSE_FILE" ps --services --filter status=running || true)"

  local required_patterns=("redis" "db|postgres" "worker" "front|web")
  local pattern
  for pattern in "${required_patterns[@]}"; do
    if echo "$services" | grep -Eiq "$pattern"; then
      if ! echo "$running_services" | grep -Eiq "$pattern"; then
        error "Servicios requeridos no estan arriba para patron: $pattern"
        exit 1
      fi
    fi
  done

  info "Estado final validado"
}

main() {
  info "Log de deploy: $LOG_FILE"

  validate_prereqs
  run_backup
  show_confirm
  update_code
  run_node_builds
  run_migrations
  run_docker_deploy
  post_validate

  DEPLOY_PHASE="complete"
  ROLLBACK_REQUIRED=0

  info "Deploy productivo seguro completado"
  info "Log disponible en: $LOG_FILE"
}

main "$@"
