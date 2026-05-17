# BLOQUE A — CORE INFRA BASELINE (Evidencia real)

Fecha de ejecución: 2026-05-16  
Entorno: preproducción real (sin deploy, sin restart, sin recreación)

## 1) Docker Compose activo

- Archivo principal detectado: `docker-compose.yml` en `E:\GSentinelHealthOS`.
- Validación de sintaxis/estructura: `docker compose config` ejecutado correctamente.
- Servicios declarados (`docker compose config --services`):  
  `redis-master`, `nlg-service`, `db`, `migrate-api`, `redis-replica`, `redis-sentinel-1`, `api`, `booking_worker_0`, `dialogue-engine`, `gateway`, `inference-service`, `booking_worker_1`, `outbox_scheduler`, `redis-sentinel-2`, `brain`, `migrate-frontend`, `decision-service`, `frontend`, `redis-sentinel-3`.

## 2) Servicios definidos vs servicios activos

### Definidos en `docker-compose.yml`

- Infra: `db`, `redis-master`, `redis-replica`, `redis-sentinel-1/2/3`
- App/runtime: `migrate-api`, `api`, `brain`, `gateway`, `frontend`, `migrate-frontend`
- Workers: `booking_worker_0`, `booking_worker_1`, `outbox_scheduler`
- IA auxiliares: `dialogue-engine`, `inference-service`, `decision-service`, `nlg-service`
- Perfil opcional: `panel-admin` (profile `panel`)

### Activos en runtime (`docker ps`)

Activos (Up): `gs_frontend`, `gs_brain`, `gs_api`, `gs_redis_sentinel_1`, `gs_redis_replica`, `gs_db`, `gs_redis_master`, `gs_nlg_service`, `gs_inference_service`, `gs_gateway`, `gs_redis_sentinel_3`, `gs_redis_sentinel_2`, `gs_outbox_scheduler`, `gs_booking_worker_1`, `gs_booking_worker_0`, `gs_decision_service`, `gs_dialogue_engine`.

No activos:
- `gs_migrate_api` = `Exited (255)` (one-shot).
- `gs_migrate_frontend` = `Exited (0)` (one-shot).
- `panel-admin` no activo (perfil no levantado).

## 3) PostgreSQL (evidencia)

- Servicio compose: `db`
- Contenedor runtime: `gs_db`
- Imagen: `postgres:16-alpine`
- Exposición de puertos:
  - Compose: sin `ports` (solo red interna)
  - Runtime: `5432/tcp` interno
- Volúmenes:
  - Nombrado: `gsentinelhealthos_postgres_data` -> `/var/lib/postgresql/data`
  - Bind RO init script: `database/init-multiple-dbs.sql` -> `/docker-entrypoint-initdb.d/init.sql`
- Healthcheck:
  - `pg_isready -U ${DB_USER} -d gsentinel` (runtime healthy)
- Variables requeridas (sin valores):
  - `DB_USER`, `DB_PASSWORD`, `DATABASE_URL` (usada por consumidores)
- Restart policy: `unless-stopped`
- Persistencia:
  - Volumen Docker persistente confirmado (`docker volume inspect`)
- Evidencia de recovery:
  - Logs muestran arranque con recuperación automática WAL tras shutdown no limpio y vuelta a `ready to accept connections`.

## 4) Redis (evidencia)

### `redis-master`
- Contenedor: `gs_redis_master`
- Imagen: `redis:8.0.2-alpine`
- Puerto: interno `6379/tcp` (sin publicación host)
- Volumen: `gsentinelhealthos_redis_master_data` -> `/data`
- Config bind RO: `broker/redis.conf`
- Healthcheck: `redis-cli ... ping` (healthy)
- Restart policy: `unless-stopped`
- Persistencia declarada:
  - `appendonly yes`
  - `appendfsync everysec`
  - reglas `save` RDB
- Evidencia runtime:
  - Logs con `Background saving terminated with success`.

### `redis-replica`
- Contenedor: `gs_redis_replica`
- Imagen: `redis:8.0.2-alpine`
- Puerto: interno `6379/tcp`
- Volumen: `gsentinelhealthos_redis_replica_data` -> `/data`
- Healthcheck: `redis-cli ... ping` (healthy)
- Restart policy: `unless-stopped`
- Replica de `redis-master` configurada por `--replicaof`.

### Sentinel / failover
- Contenedores: `gs_redis_sentinel_1`, `2`, `3`
- Imagen: `redis:8.0.2-alpine`
- Config: `broker/sentinel.conf`
- Quorum: `sentinel monitor mymaster redis-master 6379 2`
- Healthcheck: `redis-cli -p 26379 ping`
- Restart policy: `unless-stopped`
- Sentinel existe y está activo en runtime.

## 5) Redes Docker

- Red principal: `gsentinelhealthos_gs_prod` (`bridge`, `Internal=false`)
- Servicios conectados: 17 contenedores activos (incluye db, redis, sentinels, api, brain, workers, gateway, frontend, servicios IA).
- Exposición externa efectiva:
  - Publicados en `127.0.0.1`: `3000`, `8000`, `8001`, `8002`, `8010`, `8011`, `8012`, `8013`.
  - DB/Redis no publicados al host.
- Redes adicionales detectadas: `gsentinelhealthos_default`, `gsentinelhealthos_sentinel-network` (no usadas por el compose principal actual).

## 6) Volúmenes

Volúmenes core declarados en compose:
- `postgres_data` -> runtime: `gsentinelhealthos_postgres_data`
- `redis_master_data` -> runtime: `gsentinelhealthos_redis_master_data`
- `redis_replica_data` -> runtime: `gsentinelhealthos_redis_replica_data`
- `uploads_data` -> runtime: `gsentinelhealthos_uploads_data`

Riesgo de pérdida:
- Si se eliminan estos volúmenes, hay pérdida de estado persistente (DB/Redis/archivos).
- No se ejecutó ninguna operación destructiva sobre volúmenes.

## 7) Servicios dependientes de PostgreSQL

Por `depends_on db` y/o `DATABASE_URL`:
- `migrate-api`
- `api`
- `brain`
- `gateway`
- `frontend`
- `migrate-frontend`
- `booking_worker_0`
- `booking_worker_1`
- `outbox_scheduler`

## 8) Servicios dependientes de Redis

Por `depends_on redis-master` y/o `REDIS_URL`/`REDIS_SENTINELS`:
- `api`
- `brain`
- `gateway`
- `frontend`
- `booking_worker_0`
- `booking_worker_1`
- `outbox_scheduler`
- `dialogue-engine`
- `inference-service`
- `decision-service`
- `nlg-service`
- `redis-replica` (depende de `redis-master`)
- `redis-sentinel-1/2/3` (depende de `redis-master` y `redis-replica`)

## 9) Diferencias compose declarado vs runtime real

1. `panel-admin` declarado pero no activo (profile no habilitado).
2. `migrate-api` declarado como one-shot, quedó en `Exited (255)` en último ciclo observado.
3. `migrate-frontend` declarado one-shot, finalizó `Exited (0)`.
4. `docker-compose.yml` actualmente en worktree con cambios previos no relacionados (existían antes de esta intervención).
5. Los nuevos healthchecks de workers (añadidos en esta sesión) están declarados, pero runtime sigue mostrando `["NONE"]` hasta una recreación autorizada.

## 10) Runtime base (Dockerfiles relevantes)

- `docker/api.Dockerfile`:
  - Base `python:3.11.11-slim-bookworm`
  - Usuario no-root `appuser`
  - Incluye `postgresql-client`
- `docker/brain.Dockerfile`:
  - Base `python:3.11.11-slim-bookworm`
  - Usuario no-root `appuser`

Observación: se copia carpeta `MetaBrain` en imágenes `api`/`brain`, pero para Bloque A se toma como artefacto físico de build; la operación activa está dividida en MB-Chat / MB-Secretaria / MB-Whatsapp según contexto indicado.
