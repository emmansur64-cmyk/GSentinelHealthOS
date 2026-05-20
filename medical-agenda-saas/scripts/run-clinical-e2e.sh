#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_NAME="$(basename "$0")"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H-%M-%SZ")"
START_HUMAN="$(date -u +"%Y-%m-%d %H:%M:%SZ")"

APP_ROOT=""
COMPOSE_FILE=""
REPORT_ROOT=""
RUN_DIR=""
MAIN_LOG=""
RUNNING_IN_CONTAINER=0
DOCKER_HEALTHCHECK_SKIPPED=false

CURRENT_PHASE="bootstrap"
VERDICT="NO-GO"
FAILED_PHASE=""
FAILED_MESSAGE=""
FAILED_COMMAND=""

declare -a PHASE_RESULTS=()
declare -a DOCKER_SERVICES_USED=("db" "redis-master")

is_container_environment() {
  if [[ -f "/.dockerenv" ]]; then
    return 0
  fi
  local host
  host="$(hostname 2>/dev/null || true)"
  [[ "$host" =~ ^[0-9a-f]{12,}$ ]]
}

safe_mkdir() {
  local dir="$1"
  mkdir -p "$dir" 2>/dev/null || true
}

sanitize_url() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    echo "<missing>"
    return 0
  fi
  # Redact user/password info before @ for redis/postgres/http-like URLs.
  echo "$raw" | sed -E 's#^([a-zA-Z][a-zA-Z0-9+.-]*://)([^/@]+)@#\1***:***@#'
}

write_summary() {
  local end_human
  end_human="$(date -u +"%Y-%m-%d %H:%M:%SZ")"

  local summary_root
  summary_root="$RUN_DIR"
  if [[ -z "$summary_root" ]]; then
    summary_root="/tmp/clinical-e2e-bootstrap-failure-${TIMESTAMP}"
  fi
  safe_mkdir "$summary_root"

  local resolved_app_root
  resolved_app_root="$APP_ROOT"
  if [[ -z "$resolved_app_root" ]]; then
    resolved_app_root="$(pwd)"
  fi

  local commit="<unknown>"
  local branch="<unknown>"
  local worktree_status="<unknown>"
  if command -v git >/dev/null 2>&1; then
    commit="$(git -C "$resolved_app_root" rev-parse --short HEAD 2>/dev/null || echo "<unknown>")"
    branch="$(git -C "$resolved_app_root" branch --show-current 2>/dev/null || echo "<unknown>")"
    worktree_status="$(git -C "$resolved_app_root" status --short 2>/dev/null || echo "<unknown>")"
  fi

  local db_sanitized redis_sanitized
  db_sanitized="$(sanitize_url "${DATABASE_URL:-}")"
  redis_sanitized="$(sanitize_url "${REDIS_URL:-}")"

  {
    echo "# CLINICAL_E2E_RESULT"
    echo
    echo "- fecha_inicio_utc: ${START_HUMAN}"
    echo "- fecha_fin_utc: ${end_human}"
    echo "- commit_actual: ${commit}"
    echo "- rama_actual: ${branch}"
    echo "- execution_mode: $([[ $RUNNING_IN_CONTAINER -eq 1 ]] && echo "container" || echo "host")"
    echo "- app_root_detectado: ${resolved_app_root}"
    echo "- docker_healthcheck_skipped: ${DOCKER_HEALTHCHECK_SKIPPED}"
    echo "- servicios_docker_usados: ${DOCKER_SERVICES_USED[*]}"
    echo "- compose_file: ${COMPOSE_FILE:-<not-detected>}"
    echo
    echo "## Variables presentes/sanitizadas"
    echo "- DATABASE_URL: ${db_sanitized}"
    echo "- REDIS_URL: ${redis_sanitized}"
    echo
    echo "## Resultado por fase"
    if [[ "${#PHASE_RESULTS[@]}" -eq 0 ]]; then
      echo "- No se ejecutaron fases."
    else
      local row phase result
      for row in "${PHASE_RESULTS[@]}"; do
        phase="${row%%|*}"
        result="${row##*|}"
        echo "- ${phase}: ${result}"
      done
    fi
    echo
    if [[ -n "$FAILED_PHASE" ]]; then
      echo "## Error"
      echo "- fase: ${FAILED_PHASE}"
      [[ -n "$FAILED_COMMAND" ]] && echo "- comando: \`${FAILED_COMMAND}\`"
      echo "- detalle: ${FAILED_MESSAGE}"
      echo
    fi
    echo "## Worktree al finalizar"
    if [[ -n "$worktree_status" ]]; then
      echo '```'
      printf "%s\n" "$worktree_status"
      echo '```'
    else
      echo "- limpio"
    fi
    echo
    echo "## Veredicto final"
    echo "- ${VERDICT}"
  } > "${summary_root}/CLINICAL_E2E_RESULT.md"

  if [[ -n "$REPORT_ROOT" ]]; then
    safe_mkdir "$REPORT_ROOT"
    cp "${summary_root}/CLINICAL_E2E_RESULT.md" "${REPORT_ROOT}/CLINICAL_E2E_RESULT.md" 2>/dev/null || true
  fi
}

fail() {
  local message="${1:-unknown failure}"
  FAILED_PHASE="$CURRENT_PHASE"
  FAILED_MESSAGE="$message"
  VERDICT="NO-GO"
  write_summary
  echo "[NO-GO] phase=${CURRENT_PHASE} reason=${message}" >&2
  exit 1
}

on_err() {
  local exit_code=$?
  local line_no="${1:-unknown}"
  FAILED_COMMAND="${BASH_COMMAND:-unknown}"
  fail "Unhandled error (exit=${exit_code}) at line ${line_no}. command=${FAILED_COMMAND}"
}
trap 'on_err ${LINENO}' ERR

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
}

append_phase_result() {
  local phase="$1"
  local result="$2"
  PHASE_RESULTS+=("${phase}|${result}")
}

is_valid_app_root() {
  local candidate="$1"
  [[ -f "${candidate}/package.json" ]] || return 1
  [[ -f "${candidate}/scripts/run-clinical-e2e.sh" ]] || return 1
  [[ -d "${candidate}/prisma" || -d "${candidate}/src" ]] || return 1
  return 0
}

find_app_root() {
  local wd script_dir app_from_script git_root
  wd="$(pwd)"
  if is_valid_app_root "$wd"; then
    echo "$wd"
    return 0
  fi

  if command -v git >/dev/null 2>&1; then
    if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
      if is_valid_app_root "$git_root"; then
        echo "$git_root"
        return 0
      fi
      if is_valid_app_root "${git_root}/medical-agenda-saas"; then
        echo "${git_root}/medical-agenda-saas"
        return 0
      fi
    fi
  fi

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  app_from_script="$(cd "${script_dir}/.." && pwd)"
  if is_valid_app_root "$app_from_script"; then
    echo "$app_from_script"
    return 0
  fi

  fail "Unable to detect application root. Expected package.json + scripts/run-clinical-e2e.sh + prisma/src."
}

find_compose_file() {
  local app_root="$1"
  local dir="$app_root"
  while [[ "$dir" != "/" ]]; do
    if [[ -f "${dir}/docker-compose.yml" ]]; then
      echo "${dir}/docker-compose.yml"
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  echo ""
}

check_service_healthy() {
  local service="$1"
  local cid
  cid="$(docker compose -f "$COMPOSE_FILE" ps -q "$service" 2>/dev/null || true)"
  if [[ -z "$cid" ]]; then
    fail "Service '${service}' not found/running in docker compose."
  fi

  local health
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$cid" 2>/dev/null || true)"
  if [[ "$health" != "healthy" ]]; then
    fail "Service '${service}' is not healthy. current_health=${health}"
  fi
}

run_phase() {
  local phase="$1"
  shift
  local cmd="$*"

  CURRENT_PHASE="$phase"
  local phase_log="${RUN_DIR}/${phase}.log"
  echo "[$(date -u +"%Y-%m-%d %H:%M:%SZ")] [PHASE] ${phase}" | tee -a "$MAIN_LOG"
  echo "$ ${cmd}" | tee -a "$MAIN_LOG"

  if bash -lc "cd \"$APP_ROOT\" && ${cmd}" >"$phase_log" 2>&1; then
    append_phase_result "$phase" "PASS"
    echo "[PASS] ${phase}" | tee -a "$MAIN_LOG"
  else
    append_phase_result "$phase" "FAIL"
    local tail_msg
    tail_msg="$(tail -n 40 "$phase_log" 2>/dev/null || true)"
    FAILED_COMMAND="$cmd"
    fail "Phase '${phase}' failed. See ${phase_log}. Tail:\n${tail_msg}"
  fi
}

CURRENT_PHASE="preflight"

if is_container_environment; then
  RUNNING_IN_CONTAINER=1
fi

APP_ROOT="$(find_app_root)"
COMPOSE_FILE="$(find_compose_file "$APP_ROOT")"
REPORT_ROOT="${APP_ROOT}/reports/clinical-e2e"
RUN_DIR="${REPORT_ROOT}/${TIMESTAMP}"
safe_mkdir "$RUN_DIR"
MAIN_LOG="${RUN_DIR}/run.log"

echo "[INFO] script=${SCRIPT_NAME}" | tee -a "$MAIN_LOG"
echo "[INFO] app_root=${APP_ROOT}" | tee -a "$MAIN_LOG"
echo "[INFO] execution_mode=$([[ $RUNNING_IN_CONTAINER -eq 1 ]] && echo "container" || echo "host")" | tee -a "$MAIN_LOG"
echo "[INFO] compose_file=${COMPOSE_FILE:-<not-detected>}" | tee -a "$MAIN_LOG"
echo "[INFO] report_dir=${RUN_DIR}" | tee -a "$MAIN_LOG"

require_cmd npm
require_cmd npx

if [[ $RUNNING_IN_CONTAINER -eq 0 ]]; then
  require_cmd docker
  require_cmd git
else
  if ! command -v git >/dev/null 2>&1; then
    echo "[WARN] git not available in container; summary commit/branch may be <unknown>." | tee -a "$MAIN_LOG"
  fi
fi

[[ -n "${DATABASE_URL:-}" ]] || fail "Missing required env var: DATABASE_URL"
[[ -n "${REDIS_URL:-}" ]] || fail "Missing required env var: REDIS_URL"

if [[ $RUNNING_IN_CONTAINER -eq 0 ]]; then
  [[ -n "$COMPOSE_FILE" ]] || fail "docker-compose.yml not found in host mode."
  docker compose version >/dev/null 2>&1 || fail "docker compose is not available."
  CURRENT_PHASE="docker_healthcheck"
  echo "[INFO] Validating docker service health: db, redis-master" | tee -a "$MAIN_LOG"
  check_service_healthy "db"
  check_service_healthy "redis-master"
  append_phase_result "docker_healthcheck" "PASS"
else
  DOCKER_HEALTHCHECK_SKIPPED=true
  append_phase_result "docker_healthcheck" "SKIPPED_CONTAINER_MODE"
  echo "[INFO] Container mode detected: skipping docker compose healthcheck. DATABASE_URL/REDIS_URL presence validated." | tee -a "$MAIN_LOG"
fi

run_phase "prisma_generate" "npm run prisma:generate"
run_phase "prisma_deploy" "npm run prisma:deploy"
run_phase "prisma_seed" "npm run prisma:seed"
run_phase "unit_clinical_contracts" "npm run test:all -- doctor-clinical-contract clinical-evidence-guard brain-client"
run_phase "integration_brain" "npm run test:brain"
run_phase "e2e_playwright" "npm run test:e2e"

CURRENT_PHASE="finalize"
VERDICT="GO"
write_summary
echo "[GO] Clinical E2E validation completed successfully."
