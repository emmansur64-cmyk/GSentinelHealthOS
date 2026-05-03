#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if git -C "$SCRIPT_DIR" rev-parse --show-toplevel >/dev/null 2>&1; then
	REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
else
	REPO_ROOT="$DEFAULT_REPO_ROOT"
fi

cd "${1:-$REPO_ROOT}"

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
