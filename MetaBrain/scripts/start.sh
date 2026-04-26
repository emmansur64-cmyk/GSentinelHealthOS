#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.yml}"

if [[ ! -f .env ]]; then
  echo "[ERROR] Missing .env file. Copy .env.example to .env and set secrets."
  exit 1
fi

echo "[1/4] Validating required env vars..."
required=(
  GROQ_API_KEY
  WHATSAPP_APP_SECRET
  WHATSAPP_VERIFY_TOKEN
  REDIS_URL
  NLG_GROQ_ENABLED
  NLG_GROQ_MODEL
  NLG_GROQ_TEMPERATURE
)

for key in "${required[@]}"; do
  if ! grep -qE "^${key}=" .env; then
    echo "[ERROR] Missing env var: ${key}"
    exit 1
  fi
done

echo "[2/4] Starting Docker Compose stack..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[3/4] Waiting for gateway health..."
for _ in $(seq 1 30); do
  if curl -fsS "http://localhost:8080/health" >/dev/null; then
    break
  fi
  sleep 2
done

echo "[4/4] Running health checks..."
echo "/health"
curl -fsS "http://localhost:8080/health"
echo
echo "/health/redis"
curl -fsS "http://localhost:8080/health/redis"
echo
echo "/health/groq"
curl -fsS "http://localhost:8080/health/groq"
echo

docker compose -f "$COMPOSE_FILE" ps
