#!/usr/bin/env bash
set -Eeuo pipefail

RULE_NAME="${RULE_NAME:-allow-gsentinel-gateway-8002}"
NETWORK="${NETWORK:-default}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v gcloud >/dev/null 2>&1 || die "Falta gcloud CLI. Instalalo o ejecuta este script desde Cloud Shell."

echo "=== Verificando regla firewall ${RULE_NAME} ==="
if gcloud compute firewall-rules describe "$RULE_NAME" >/dev/null 2>&1; then
  echo "La regla ${RULE_NAME} ya existe. No se crea otra."
else
  echo "Creando regla ${RULE_NAME} para tcp:8002 en red ${NETWORK}"
  gcloud compute firewall-rules create "$RULE_NAME" \
    --network "$NETWORK" \
    --allow tcp:8002 \
    --source-ranges 0.0.0.0/0 \
    --description "Allow public WhatsApp webhook traffic to GSentinel gateway on tcp:8002"
fi

echo
echo "=== Regla activa ==="
gcloud compute firewall-rules describe "$RULE_NAME"

