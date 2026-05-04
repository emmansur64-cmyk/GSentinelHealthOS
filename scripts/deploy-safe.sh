#!/bin/bash
set -e

echo "=== BACKUP INICIADO ==="

BACKUP_DIR="/opt/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

# Backup docker compose
cp docker-compose.prod.yml $BACKUP_DIR/

# Backup ENV
cp .env.production $BACKUP_DIR/ || true

# Backup DB
docker exec medical-agenda-postgres pg_dump -U postgres > $BACKUP_DIR/db.sql

echo "=== BACKUP OK ==="

echo "=== DEPLOY ==="

docker compose -f docker-compose.prod.yml pull || true
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

sleep 10

if curl -f http://localhost:8002/health > /dev/null; then
  echo "=== SISTEMA OK ==="
else
  echo "=== FALLÓ → ROLLBACK ==="

  docker compose -f docker-compose.prod.yml down

  cp $BACKUP_DIR/docker-compose.prod.yml ./docker-compose.prod.yml
  cp $BACKUP_DIR/.env.production ./.env.production || true

  docker compose -f docker-compose.prod.yml up -d

  echo "=== ROLLBACK EJECUTADO ==="
fi
