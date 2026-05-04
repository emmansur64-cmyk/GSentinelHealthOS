# DEPLOY VPS — GSentinelHealthOS

> Guía operativa para mantener el sistema estable en producción (Google Cloud VPS).
> Actualizar este documento cada vez que cambie la arquitectura.

---

## 0. Dominio publico para `medical-agenda-saas`

Estado esperado:

- Dominio: `gsentinelhealth.com.ar`
- DNS A: `34.39.235.83`
- App: `medical-agenda-saas`
- Upstream local: `http://127.0.0.1:3000`
- Healthcheck: `http://127.0.0.1:3000/api/health`

Si el navegador muestra `502 Bad Gateway` de nginx, el dominio esta llegando a la VPS pero nginx no puede conectar con la app. Levantar la app y reconfigurar nginx:

```bash
cd /home/emmansur64/GSentinelHealthOS

# Asegurar que exista .env productivo
test -f medical-agenda-saas/.env || cp medical-agenda-saas/.env.example medical-agenda-saas/.env

# Editar secretos reales antes de produccion:
# JWT_SECRET, POSTGRES_PASSWORD, WhatsApp, IA, etc.
nano medical-agenda-saas/.env

# Deploy de la app y proxy nginx del dominio
DOMAIN=gsentinelhealth.com.ar WEB_PORT=3000 bash scripts/deploy_medical_agenda_domain.sh
```

Verificacion rapida:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep medical-agenda
curl -fsS http://127.0.0.1:3000/api/health
sudo nginx -t
curl -I https://gsentinelhealth.com.ar/
```

Si sigue dando 502:

```bash
docker compose -f medical-agenda-saas/docker-compose.prod.yml logs --tail=120 web
sudo journalctl -u nginx -n 120 --no-pager
sudo grep -R "server_name\|proxy_pass" -n /etc/nginx/sites-enabled /etc/nginx/conf.d
```

---

## 1. Revisar uso de disco

```bash
# Estado general del sistema de archivos
df -h

# Uso de espacio Docker (imágenes, volúmenes, build cache)
docker system df

# Directorios grandes en Docker (requiere sudo)
sudo du -h /var/lib/docker --max-depth=1 | sort -hr

# Script completo de diagnóstico
bash scripts/vps_healthcheck.sh
```

**Causas comunes de disco lleno:**
| Causa | Dónde buscar |
|---|---|
| Logs de contenedores sin límite | `docker system df` → sección "Images/Containers" |
| Imágenes viejas acumuladas | `docker images` → columna SIZE |
| Build cache | `docker builder du` |
| Base de datos creciendo | `sudo du -h /var/lib/docker/volumes/` |
| Redis sin `maxmemory` | `docker exec gs_redis_master redis-cli INFO memory` |

---

## 2. Revisar RAM y contenedores

```bash
# RAM del sistema
free -h

# Uso de recursos por contenedor (snapshot)
docker stats --no-stream

# Ver todos los contenedores (incluyendo detenidos y reiniciando)
docker ps -a

# Ver contenedores que reinician constantemente
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.RestartCount}}"

# Ver logs de un contenedor específico
docker logs gs_api --tail=100 --since=1h
docker logs gs_brain --tail=100 --since=1h
docker logs gs_gateway --tail=100 --since=1h
```

---

## 3. Limpiar Docker sin borrar datos

### Limpieza segura (script automatizado)

```bash
bash scripts/docker_safe_cleanup.sh
```

Este script **SÍ elimina:**
- Contenedores detenidos
- Imágenes sin uso (no referenciadas por ningún contenedor)
- Caché de build

Este script **NO elimina:**
- Volúmenes (`postgres_data`, `redis_master_data`, etc.)
- Contenedores en ejecución
- Imágenes en uso

### Cron semanal (domingos 04:00)

```bash
crontab -e
```

Agregar:

```
0 4 * * 0 /ruta/absoluta/del/proyecto/scripts/docker_safe_cleanup.sh >> /var/log/docker_safe_cleanup.log 2>&1
```

Verificar que el log no crece indefinidamente:

```bash
# Agregar rotación del log de limpieza
cat > /etc/logrotate.d/docker_safe_cleanup << 'EOF'
/var/log/docker_safe_cleanup.log {
    weekly
    rotate 4
    compress
    missingok
    notifempty
}
EOF
```

---

## 4. Cómo hacer deploy

```bash
# Deploy completo (pull + build + restart + limpieza)
bash scripts/deploy_vps.sh

# O manualmente:
git pull --ff-only
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

### Migraciones de base de datos

```bash
# Siempre hacer backup antes de migrar
pg_dump -U $DB_USER gsentinel > backup_pre_migration_$(date +%Y%m%d_%H%M).sql

# Aplicar migraciones
source .venv/bin/activate
alembic upgrade head
alembic current   # debe mostrar "head"
```

### Rollback rápido

```bash
# 1. Bajar servicios sin borrar datos
docker compose -f docker-compose.prod.yml down

# 2. Volver a imagen anterior (editar docker-compose.prod.yml y cambiar tag)
# 3. Levantar de nuevo
docker compose -f docker-compose.prod.yml up -d

# Rollback de migración (solo si la migración es reversible)
alembic downgrade -1
```

---

## 5. Comandos PROHIBIDOS en producción

> ⚠️ Ejecutar estos comandos puede **borrar datos de pacientes, turnos y conversaciones de forma irreversible.**

| Comando | Riesgo | Alternativa segura |
|---|---|---|
| `docker system prune -a --volumes` | Borra TODOS los volúmenes (Postgres + Redis) | `docker image prune -af` |
| `docker compose down -v` | Destruye volúmenes del proyecto | `docker compose down` (sin `-v`) |
| `docker volume prune` | Borra volúmenes sin contenedor activo | Identificar y borrar solo los específicos |
| `rm -rf /var/lib/docker` | Destruye TODA la instalación Docker | Nunca ejecutar |
| `git reset --hard HEAD~N` en rama main | Revierte código en producción sin revisión | Crear rama, revisar diff, luego merge |

### Cuándo sí se puede usar `docker compose down -v`

Solo en entorno de **staging o desarrollo local** para resetear datos de prueba. **Nunca en producción** salvo procedimiento de disaster recovery documentado y aprobado.

---

## 6. Configuración de logs Docker

Todos los servicios en `docker-compose.prod.yml` tienen logs limitados:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"   # Máximo 10 MB por archivo de log
    max-file: "3"     # Máximo 3 archivos → 30 MB total por servicio
```

Para ver logs sin límite de tamaño (desde el host):

```bash
# Logs del gateway (últimas 200 líneas)
docker logs gs_gateway --tail=200

# Logs en tiempo real
docker logs gs_brain -f

# Logs desde hace 30 minutos
docker logs gs_api --since=30m
```

---

## 7. Redis: control de memoria y colas

### Verificar estado de Redis en producción

```bash
# Memoria usada vs límite
docker exec gs_redis_master redis-cli INFO memory | grep -E "used_memory_human|maxmemory_human|maxmemory_policy"

# Largo de colas críticas
docker exec gs_redis_master redis-cli LLEN whatsapp:incoming
docker exec gs_redis_master redis-cli LLEN whatsapp:outgoing
docker exec gs_redis_master redis-cli LLEN whatsapp:outgoing:dead  # DLQ

# Número de keys totales
docker exec gs_redis_master redis-cli DBSIZE
```

### Política de memoria (prod)

El redis-master usa `noeviction` con `maxmemory 512mb`:
- Cuando se llena, Redis **rechaza nuevas escrituras** y devuelve error.
- Esto es **intencional para colas críticas**: es mejor recibir un error que perder mensajes.
- Alertar si la DLQ (`whatsapp:outgoing:dead`) supera 10 mensajes.

### TTL de sesiones WhatsApp

Las sesiones de conversación expiran automáticamente en **24 horas** (`BRAIN_STATE_TTL_SECONDS=86400`).  
Para cambiar el TTL sin redesplegar, ajustar en `.env`:

```bash
# 24 horas (default)
BRAIN_STATE_TTL_SECONDS=86400

# 48 horas
BRAIN_STATE_TTL_SECONDS=172800

# 72 horas (máximo recomendado)
BRAIN_STATE_TTL_SECONDS=259200
```

---

## 8. Archivos de usuarios (uploads)

**Prohibido** guardar imágenes médicas, PDFs, audios o archivos temporales dentro del contenedor.

El volumen `uploads_data` está declarado en `docker-compose.prod.yml`. Montar en el servicio que lo necesite:

```yaml
volumes:
  - uploads_data:/data/uploads
```

Para producción con alto volumen, migrar a **Google Cloud Storage**:

```bash
# Instalar cliente GCS (dentro del contenedor o en scripts)
pip install google-cloud-storage

# Configurar autenticación
export GOOGLE_APPLICATION_CREDENTIALS=/ruta/service_account.json
```

---

## 9. Checklist de validación post-deploy

```bash
# 1. Todos los servicios levantados
docker compose -f docker-compose.prod.yml ps

# 2. Health checks
curl -s http://localhost:8000/api/health/readiness | python3 -m json.tool
curl -s http://localhost:8002/health || echo "gateway sin /health"

# 3. Logs sin errores críticos (últimos 5 min)
docker logs gs_api --since=5m 2>&1 | grep -i "error\|critical\|exception" | head -20
docker logs gs_brain --since=5m 2>&1 | grep -i "error\|critical\|exception" | head -20
docker logs gs_gateway --since=5m 2>&1 | grep -i "error\|critical\|exception" | head -20

# 4. Auditoría de logs: sin tokens/secrets expuestos
python scripts/audit_logs_sensitive.py --docker gs_api gs_brain gs_gateway

# 5. Colas Redis funcionando
docker exec gs_redis_master redis-cli LLEN whatsapp:incoming
docker exec gs_redis_master redis-cli LLEN whatsapp:outgoing:dead  # debe ser 0 o mínimo

# 6. Gateway responde webhook
curl -s "http://localhost:8002/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=TEST&hub.challenge=ok"
```

---

*GSentinelHealthOS — Operaciones VPS — Actualizado 2026-04-29*

---

## 10. Migracion segura a Postgres externo (faseada)

Objetivo: mover Postgres fuera de la VPS de app sin perdida de datos y con rollback rapido.

### Pre-migracion

```bash
# 1) Exportar variables destino (NO imprimir secrets)
export EXTERNAL_PGHOST=host_externo
export EXTERNAL_PGPORT=5432
export EXTERNAL_PGUSER=usuario
export EXTERNAL_PGDATABASE=gsentinel
export EXTERNAL_PGPASSWORD='***'

# 2) Usuario/base local para backup desde servicio db
export DB_USER=sentinel
export LOCAL_DB_NAME=gsentinel

# 3) Ejecutar migracion segura
bash scripts/migrate_postgres_external.sh
```

### Validaciones obligatorias

1. Login panel.
2. Lectura agenda.
3. Creacion de turno.
4. Webhook WhatsApp.
5. Outgoing WhatsApp.
6. Aislamiento por clinic_id.

### Rollback Postgres

```bash
# 1) Restaurar DATABASE_URL previa en .env.prod
# 2) Reiniciar solo app
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps --build api gateway brain
```

No borrar volumen local de Postgres durante la ventana de fallback.

---

## 11. Migracion segura a Redis externo (despues de Postgres)

Objetivo: mover colas/locks/sesiones fuera de VPS con ventana de baja actividad.

### Pre-migracion

```bash
export CONFIRM_WINDOW=yes
export EXTERNAL_REDIS_URL='redis://host_externo:6379'
bash scripts/migrate_redis_external.sh
```

### Validaciones obligatorias

1. Redis PING.
2. TTL de sesiones.
3. Dedupe con TTL.
4. Locks.
5. whatsapp:incoming.
6. whatsapp:outgoing.
7. whatsapp:outgoing:dead (DLQ).

### Rollback Redis

```bash
# 1) Restaurar REDIS_URL previa en .env.prod
# 2) Reiniciar servicios dependientes de Redis
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps gateway brain booking_worker_0 booking_worker_1 outbox_scheduler
```

No borrar volumen local de Redis durante la ventana de fallback.

---

## 12. Modo local vs externo (Compose)

- Modo local (default):
  - DATABASE_URL fallback a db interno.
  - REDIS_URL fallback a redis-master interno.
- Modo externo:
  - Definir DATABASE_URL y REDIS_URL en .env.prod.
  - Reiniciar solo servicios de app (api/gateway/brain/workers/scheduler).

Ejemplo seguro de activacion:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --no-deps --build api gateway brain booking_worker_0 booking_worker_1 outbox_scheduler
```

---

## 13. Fase de limpieza controlada (7 dias)

No eliminar Postgres/Redis locales inmediatamente.

Mantener fallback local por 7 dias con monitoreo:

1. Backups externos validados.
2. E2E WhatsApp real estable.
3. Sin errores criticos en logs.
4. Sin regresiones multi-clinica.

Luego de 7 dias estables:

- Comentar servicios locales de estado en compose o moverlos a perfil local.
- Mantener documentacion para reactivar fallback local en incidente.
- Prohibido borrar volumenes en esta fase.
