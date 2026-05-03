#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "== Containers =="
docker ps --format 'table {{.Names}}\t{{.Networks}}\t{{.Status}}' | grep -E 'sentinel-gateway|sentinel-redis' || true

echo "== Gateway networks =="
docker inspect sentinel-gateway --format '{{json .NetworkSettings.Networks}}' || true

echo "== Gateway env =="
docker exec sentinel-gateway sh -lc '
	SAFE_REDIS_URL="$REDIS_URL"
	if echo "$SAFE_REDIS_URL" | grep -q "@"; then
		SAFE_REDIS_URL="$(echo "$SAFE_REDIS_URL" | sed -E "s#(redis://)[^@]+@#\1***:***@#")"
	fi
	echo "REDIS_URL=$SAFE_REDIS_URL"
	echo "WHATSAPP_PHONE_NUMBER_ID=$WHATSAPP_PHONE_NUMBER_ID"
	echo "WHATSAPP_BUSINESS_ACCOUNT_ID=$WHATSAPP_BUSINESS_ACCOUNT_ID"
	echo "WHATSAPP_APP_SECRET_LENGTH=${#WHATSAPP_APP_SECRET}"
' || true

echo "== Health =="
curl -f http://127.0.0.1:8002/health || true
echo
curl -f http://127.0.0.1:8002/health/whatsapp || true
echo

echo "== Gateway logs =="
docker logs --tail=80 sentinel-gateway || true

echo "== Nginx webhook config =="
grep -n "webhook" /etc/nginx/sites-enabled/medical-agenda-saas.conf || true

echo "== Nginx webhook access =="
grep "webhook" /var/log/nginx/access.log | tail -20 || true
