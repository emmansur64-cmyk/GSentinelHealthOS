#!/bin/bash
set -e

cd "${1:-$HOME/GSentinelHealthOS}"

STAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="/opt/backups/gsentinelhealthos/$STAMP"

mkdir -p "$BACKUP_DIR"

cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml"
cp .env "$BACKUP_DIR/.env"
cp .env.production "$BACKUP_DIR/.env.production" 2>/dev/null || true
cp /etc/nginx/sites-enabled/medical-agenda-saas.conf "$BACKUP_DIR/medical-agenda-saas.conf" 2>/dev/null || true

docker ps --format "table {{.Names}}\t{{.Networks}}\t{{.Status}}" > "$BACKUP_DIR/docker-ps.txt" 2>&1 || true
docker network ls > "$BACKUP_DIR/docker-network-ls.txt" 2>&1 || true
docker inspect sentinel-gateway > "$BACKUP_DIR/sentinel-gateway.inspect.json" 2>&1 || true
docker logs --tail=200 sentinel-gateway > "$BACKUP_DIR/sentinel-gateway.logs.txt" 2>&1 || true

echo "Backup creado en $BACKUP_DIR"
