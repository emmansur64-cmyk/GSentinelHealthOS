#!/bin/bash
set -e

echo "=== VALIDANDO VARIABLES ==="

REQUIRED_VARS=(
  WHATSAPP_PHONE_NUMBER_ID
  WHATSAPP_BUSINESS_ACCOUNT_ID
  WHATSAPP_VERIFY_TOKEN
  WHATSAPP_ACCESS_TOKEN
  REDIS_URL
)

for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR}" ]; then
    echo "ERROR: Falta $VAR"
    exit 1
  fi
done

if [ "${ENV}" = "production" ]; then
  case "${REDIS_URL}" in
    *localhost*|*127.0.0.1*)
      echo "REDIS_URL inválido para Docker production: usar nombre de servicio Redis"
      exit 1
      ;;
  esac
fi

echo "=== VARIABLES OK ==="
