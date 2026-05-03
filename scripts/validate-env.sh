#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

ENV_FILE="${1:-.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: falta $ENV_FILE"
  exit 1
fi

if grep -n $'\r' "$ENV_FILE" >/dev/null 2>&1; then
  echo "ERROR: $ENV_FILE contiene retornos de carro (CRLF). Convertir a LF"
  exit 1
fi

if ! bash -n "$ENV_FILE"; then
  echo "ERROR: $ENV_FILE no es parseable por shell"
  exit 1
fi

if grep -nE '^[A-Za-z_][A-Za-z0-9_]*= ' "$ENV_FILE"; then
  echo "ERROR: hay espacios despues de ="
  exit 1
fi

if grep -nE '^[A-Za-z_][A-Za-z0-9_]*=.*[[:space:]]+$' "$ENV_FILE"; then
  echo "ERROR: hay espacios en blanco al final de linea"
  exit 1
fi

DUPES="$(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE" | cut -d= -f1 | sort | uniq -d)"
if [ -n "$DUPES" ]; then
  echo "ERROR: variables duplicadas: $DUPES"
  exit 1
fi

if grep -nE '^[A-Za-z_][A-Za-z0-9_]*=.*>$' "$ENV_FILE"; then
  echo "ERROR: valor termina con caracter >"
  exit 1
fi

if grep -nE '^WHATSAPP_API_VERSION=.*WHATSAPP_' "$ENV_FILE"; then
  echo "ERROR: linea pegada detectada en WHATSAPP_API_VERSION"
  exit 1
fi

if grep -nE '=[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE"; then
  echo "ERROR: linea pegada detectada (dos asignaciones en una linea)"
  exit 1
fi

if grep -nE '[[:cntrl:]]' "$ENV_FILE" | grep -v $'\t' >/dev/null 2>&1; then
  echo "ERROR: se detectaron caracteres de control sospechosos en $ENV_FILE"
  exit 1
fi

set -a
. "$ENV_FILE"
set +a

for VAR in REDIS_URL WHATSAPP_PHONE_NUMBER_ID WHATSAPP_BUSINESS_ACCOUNT_ID WHATSAPP_ACCESS_TOKEN WHATSAPP_VERIFY_TOKEN WHATSAPP_APP_SECRET WHATSAPP_API_VERSION; do
  if [ -z "${!VAR}" ]; then
    echo "ERROR: falta $VAR"
    exit 1
  fi
done

if [ -n "${REDIS_SENTINELS:-}" ]; then
  echo "ERROR: REDIS_SENTINELS no debe estar configurado para el gateway"
  exit 1
fi

if [ -n "${REDIS_SENTINEL_MASTER:-}" ]; then
  echo "ERROR: REDIS_SENTINEL_MASTER no debe estar configurado para el gateway"
  exit 1
fi

if [ "${WHATSAPP_VERIFY_TOKEN}" != "WABIZ_VERIFY_2026_GSENTINEL" ]; then
  echo "ERROR: WHATSAPP_VERIFY_TOKEN incorrecto"
  exit 1
fi

if [ "${WHATSAPP_API_VERSION}" != "v25.0" ]; then
  echo "ERROR: WHATSAPP_API_VERSION debe ser v25.0"
  exit 1
fi

if [ "$REDIS_URL" != "redis://sentinel-redis-master:6379" ]; then
  echo "ERROR: REDIS_URL debe ser redis://sentinel-redis-master:6379"
  exit 1
fi

if echo "$REDIS_URL" | grep -Eq 'localhost|127\.0\.0\.1'; then
  echo "ERROR: REDIS_URL invalido para Docker production"
  exit 1
fi

if echo "$WHATSAPP_ACCESS_TOKEN" | grep -q '>'; then
  echo "ERROR: WHATSAPP_ACCESS_TOKEN contiene caracter >"
  exit 1
fi

if echo "$WHATSAPP_APP_SECRET" | grep -q '>'; then
  echo "ERROR: WHATSAPP_APP_SECRET contiene caracter >"
  exit 1
fi

if [ "$WHATSAPP_PHONE_NUMBER_ID" != "1093032243892458" ]; then
  echo "ERROR: WHATSAPP_PHONE_NUMBER_ID incorrecto"
  exit 1
fi

if [ "$WHATSAPP_BUSINESS_ACCOUNT_ID" != "967835399226590" ]; then
  echo "ERROR: WHATSAPP_BUSINESS_ACCOUNT_ID incorrecto"
  exit 1
fi

if [ "${WHATSAPP_BUSINESS_ACCOUNT_ID# }" != "$WHATSAPP_BUSINESS_ACCOUNT_ID" ]; then
  echo "ERROR: WHATSAPP_BUSINESS_ACCOUNT_ID tiene espacio inicial"
  exit 1
fi

echo "ENV OK"
