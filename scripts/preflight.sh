#!/bin/sh
set -e

echo "=== PREFLIGHT CHECK ==="

if echo "$REDIS_URL" | grep -Eq "localhost|127\.0\.0\.1"; then
  echo "ERROR: REDIS_URL no puede ser localhost en Docker"
  exit 1
fi

if [ -z "$WHATSAPP_PHONE_NUMBER_ID" ]; then
  echo "ERROR: falta WHATSAPP_PHONE_NUMBER_ID"
  exit 1
fi

if [ -z "$WHATSAPP_BUSINESS_ACCOUNT_ID" ]; then
  echo "ERROR: falta WHATSAPP_BUSINESS_ACCOUNT_ID"
  exit 1
fi

echo "=== PREFLIGHT OK ==="
