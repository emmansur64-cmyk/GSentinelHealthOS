# Runtime Origin Audit

Fecha: 2026-05-12
Repositorio auditado: `E:\GSentinelHealthOS`

## Alcance y reglas

Auditoria solo lectura del origen real del runtime Docker activo. No se reiniciaron containers, no se reconstruyeron imagenes, no se edito `.env`, no se hizo deploy, no se hizo cleanup y no se modificaron puertos.

Los valores sensibles de variables de entorno fueron omitidos. Este reporte lista nombres de variables, rutas, puertos, imagenes, comandos, volumes y evidencia operacional.

## 1. Arquitectura REAL actualmente ejecutandose

Runtime real activo:

- Compose project activo: `gsentinelhealthos`
- Compose file activo: `E:\GSentinelHealthOS\docker-compose.yml`
- Containers en ejecucion: 17
- Red activa usada por los containers: `gsentinelhealthos_gs_prod`
- Frontend activo: `http://127.0.0.1:3000`
- Frontend container: `gs_frontend`
- Frontend origen declarado por compose: `E:\GSentinelHealthOS\medical-agenda-saas`
- Frontend ejecuta codigo baked dentro de imagen Docker, no bind mount.
- DB Docker `gs_db` existe y esta healthy, pero no publica `5432` al host.
- Redis Docker existe y esta healthy, pero no publica `6379` al host.
- PostgreSQL Windows local escucha en host `0.0.0.0:5432` y `:::5432`; no es el container `gs_db`.

Containers activos publicados al host:

| Host port | Container | Servicio | Runtime |
|---:|---|---|---|
| `127.0.0.1:3000` | `gs_frontend` | `frontend` | Next.js standalone |
| `127.0.0.1:8000` | `gs_api` | `api` | Uvicorn / FastAPI |
| `127.0.0.1:8001` | `gs_brain` | `brain` | Python brain orchestrator |
| `127.0.0.1:8002` | `gs_gateway` | `gateway` | Uvicorn / WhatsApp gateway |
| `127.0.0.1:8010` | `gs_dialogue_engine` | `dialogue-engine` | Uvicorn / FastAPI |
| `127.0.0.1:8011` | `gs_inference_service` | `inference-service` | Uvicorn / IA inference |
| `127.0.0.1:8012` | `gs_decision_service` | `decision-service` | Uvicorn / FastAPI |
| `127.0.0.1:8013` | `gs_nlg_service` | `nlg-service` | Uvicorn / IA NLG |

## 2. Mapa completo container -> source

| Container | Image runtime | Command | Compose file | Dockerfile | Build context | Source real ejecutado | Mounts relevantes | Ports | Network | Restart |
|---|---|---|---|---|---|---|---|---|---|---|
| `gs_frontend` | `gsentinelhealthos-frontend` `c1eef26b3087` | `node server.js` | `docker-compose.yml` | `medical-agenda-saas/Dockerfile` | `./medical-agenda-saas` | `/app/server.js`, Next standalone baked desde `medical-agenda-saas` | ninguno | `127.0.0.1:3000->3000` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_api` | `gsentinelhealthos-api` `d9868f3e26ba` | `uvicorn api.app.main:app --host 0.0.0.0 --port 8000` | `docker-compose.yml` | `docker/api.Dockerfile` | `.` | `/app/api`, `/app/brain`, `/app/MetaBrain`, `/app/shared`, `/app/alembic` baked | volume `uploads_data:/data/uploads` | `127.0.0.1:8000->8000` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_brain` | `gsentinelhealthos-brain` `bb85e7d49f10` | `python brain/main.py` | `docker-compose.yml` | `docker/brain.Dockerfile` | `.` | `/app/brain`, `/app/MetaBrain`, `/app/shared` baked | volume `uploads_data:/data/uploads` | `127.0.0.1:8001->8001` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_gateway` | `gsentinelhealthos-gateway` `a9bb2547b9cb` | `uvicorn whatsapp_gateway.app.main:app --host 0.0.0.0 --port 8002` | `docker-compose.yml` | `docker/gateway.Dockerfile` | `.` | `/app/whatsapp_gateway`, `/app/shared` baked | volume `uploads_data:/data/uploads` | `127.0.0.1:8002->8002` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_dialogue_engine` | image ID `0bfd3f9b1643` | `uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8010 --workers 1` | `docker-compose.yml` | `docker/dialogue-engine.Dockerfile` | `.` | `/app/MetaBrain/services/dialogue_engine`, `/app/MetaBrain/services/shared` baked | ninguno | `127.0.0.1:8010->8010` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_inference_service` | `gsentinelhealthos-inference-service` `0a4281800dcb` | `uvicorn services.inference_service.main:app --host 0.0.0.0 --port 8011 --workers 1` | `docker-compose.yml` | `docker/inference-service.Dockerfile` | `.` | `/app/MetaBrain/services/inference_service`, `/app/MetaBrain/services/shared`, `/app/MetaBrain/cerebro_ai_med` baked | ninguno | `127.0.0.1:8011->8011` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_decision_service` | image ID `dd886d9ee4ec` | `uvicorn services.decision_service.main:app --host 0.0.0.0 --port 8012 --workers 1` | `docker-compose.yml` | `docker/decision-service.Dockerfile` | `.` | `/app/MetaBrain/services/decision_service`, `/app/MetaBrain/services/shared` baked | ninguno | `127.0.0.1:8012->8012` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_nlg_service` | `gsentinelhealthos-nlg-service` `2347f33098d8` | `uvicorn services.nlg_service.main:app --host 0.0.0.0 --port 8013 --workers 1` | `docker-compose.yml` | `docker/nlg-service.Dockerfile` | `.` | `/app/MetaBrain/services/nlg_service`, `/app/MetaBrain/services/shared` baked | ninguno | `127.0.0.1:8013->8013` | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_db` | `postgres:16-alpine` `667495ca2ac3` | `postgres -c max_connections=50 -c shared_buffers=128MB` | `docker-compose.yml` | image upstream | N/A | PostgreSQL container data | volume `postgres_data`, bind `database/init-multiple-dbs.sql:ro` | internal `5432/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_redis_master` | `redis:8.0.2-alpine` `e74faa347ab0` | `redis-server /usr/local/etc/redis/redis.conf ...` | `docker-compose.yml` | image upstream | N/A | Redis master | volume `redis_master_data`, bind `broker/redis.conf:ro` | internal `6379/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_redis_replica` | `redis:8.0.2-alpine` `e74faa347ab0` | `redis-server /usr/local/etc/redis/redis.conf --replicaof redis-master 6379 ...` | `docker-compose.yml` | image upstream | N/A | Redis replica | volume `redis_replica_data`, bind `broker/redis.conf:ro` | internal `6379/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_redis_sentinel_1` | `redis:8.0.2-alpine` `e74faa347ab0` | `redis-server /tmp/sentinel.conf --sentinel` | `docker-compose.yml` | image upstream | N/A | Redis sentinel | anonymous volume `/data`, bind `broker/sentinel.conf:ro` | internal `6379/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_redis_sentinel_2` | `redis:8.0.2-alpine` `e74faa347ab0` | `redis-server /tmp/sentinel.conf --sentinel` | `docker-compose.yml` | image upstream | N/A | Redis sentinel | anonymous volume `/data`, bind `broker/sentinel.conf:ro` | internal `6379/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_redis_sentinel_3` | `redis:8.0.2-alpine` `e74faa347ab0` | `redis-server /tmp/sentinel.conf --sentinel` | `docker-compose.yml` | image upstream | N/A | Redis sentinel | anonymous volume `/data`, bind `broker/sentinel.conf:ro` | internal `6379/tcp`, no host publish | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_booking_worker_0` | image ID `cd2a08c7b2ab` | `python -m api.app.booking_queue_worker_main` | `docker-compose.yml` | `docker/api.Dockerfile` | `.` | `/app/api`, `/app/brain`, `/app/MetaBrain`, `/app/shared` baked | ninguno | none | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_booking_worker_1` | image ID `d713bb4e4f66` | `python -m api.app.booking_queue_worker_main` | `docker-compose.yml` | `docker/api.Dockerfile` | `.` | `/app/api`, `/app/brain`, `/app/MetaBrain`, `/app/shared` baked | ninguno | none | `gsentinelhealthos_gs_prod` | `unless-stopped` |
| `gs_outbox_scheduler` | image ID `98cb722fbe06` | `python scripts/run_outbox_scheduler.py` | `docker-compose.yml` | `docker/api.Dockerfile` | `.` | API image baked, but `/app/scripts` is bind-mounted from host | bind `E:\GSentinelHealthOS\scripts:/app/scripts:ro` | none | `gsentinelhealthos_gs_prod` | `unless-stopped` |

## 3. Mapa compose -> runtime

### `E:\GSentinelHealthOS\docker-compose.yml`

Estado: activo. Es el unico compose project reportado por `docker compose ls`.

Servicios activos:

- Infra: `db`, `redis-master`, `redis-replica`, `redis-sentinel-1`, `redis-sentinel-2`, `redis-sentinel-3`.
- Apps: `api`, `brain`, `gateway`, `frontend`, `booking_worker_0`, `booking_worker_1`, `outbox_scheduler`, `dialogue-engine`, `inference-service`, `decision-service`, `nlg-service`.
- Migradores completados: `migrate-api`, `migrate-frontend` (`Exited (0)`, no runtime persistente).

Build contexts:

- `frontend`, `migrate-frontend`: `./medical-agenda-saas`, Dockerfile `Dockerfile`.
- `api`, `migrate-api`, `booking_worker_0`, `booking_worker_1`, `outbox_scheduler`: `.`, Dockerfile `docker/api.Dockerfile`.
- `brain`: `.`, Dockerfile `docker/brain.Dockerfile`.
- `gateway`: `.`, Dockerfile `docker/gateway.Dockerfile`.
- `dialogue-engine`: `.`, Dockerfile `docker/dialogue-engine.Dockerfile`.
- `inference-service`: `.`, Dockerfile `docker/inference-service.Dockerfile`.
- `decision-service`: `.`, Dockerfile `docker/decision-service.Dockerfile`.
- `nlg-service`: `.`, Dockerfile `docker/nlg-service.Dockerfile`.

`env_file`: no se detecto `env_file` en el compose principal. Las variables se resuelven por sustitucion de compose y `environment`; por comportamiento de Docker Compose, el archivo `.env` del directorio del proyecto participa en la interpolacion.

### `E:\GSentinelHealthOS\docker-compose.runtime-lab.yml`

Estado: no activo ahora.

Servicios declarados:

- `postgres_runtime_lab`: host `127.0.0.1:55432 -> 5432`.
- `redis_runtime_lab`: host `127.0.0.1:56379 -> 6379`.

No hay listeners actuales en `55432` ni `56379`. Existe volume `gsentinel_runtime_lab_postgres_data`, no usado por containers en ejecucion.

### `E:\GSentinelHealthOS\docker-compose.precanary-lab.yml`

Estado: no activo ahora.

Servicios declarados:

- `postgres_precanary_lab`: host `127.0.0.1:55433 -> 5432`.
- `redis_precanary_lab`: host `127.0.0.1:56380 -> 6379`.
- `api_precanary_lab`: host `127.0.0.1:18090 -> 8000`, build context `.`, Dockerfile `docker/api.Dockerfile`, `env_file: .env.runtime_lab_docker`.

No hay listeners actuales en `55433`, `56380` ni `18090`. Existe volume `gsentinel_precanary_lab_postgres_data`, no usado por containers en ejecucion.

### `E:\GSentinelHealthOS\medical-agenda-saas\docker-compose.prod.yml`

Estado: no activo ahora como compose project.

Servicios declarados:

- `redis`: host default `127.0.0.1:6380 -> 6379`.
- `postgres`: host default `127.0.0.1:55432 -> 5432`.
- `bootstrap`: build context `.`, Dockerfile `Dockerfile`, `env_file: .env`.
- `web`: build context `.`, Dockerfile `Dockerfile`, host default `${WEB_PORT:-3000}:3000`, `env_file: .env`.
- `appointment-lifecycle`: build context `.`, Dockerfile `Dockerfile`, `env_file: .env`.

Riesgo potencial: `web` usa `3000` por default y colisionaria con `gs_frontend` si se levanta sin override.

## 4. Frontend real activo

Evidencia:

- Container: `gs_frontend`.
- Puerto: `127.0.0.1:3000 -> 3000/tcp`.
- HTTP `/`: status 200, `X-Powered-By: Next.js`, titulo `GSentinelHealth OS`.
- Compose service: `frontend`.
- Compose build context: `./medical-agenda-saas`.
- Dockerfile: `medical-agenda-saas/Dockerfile`.
- Container working dir: `/app`.
- Container user: `nextjs`.
- Entrypoint: `docker-entrypoint.sh`.
- Command: `node server.js`.
- `next.config.ts`: `output: "standalone"`.
- Dentro del container existen `/app/server.js`, `/app/.next`, `/app/package.json`, `/app/next.config.ts`.
- `package.json` dentro del container: `name=medical-agenda-saas`, `version=0.1.0`, `next=16.2.2`, `react=19.2.4`.
- Mounts: ninguno.

Conclusion:

El frontend real activo esta servido desde una imagen Docker baked creada desde `E:\GSentinelHealthOS\medical-agenda-saas`. No esta leyendo el filesystem actual por bind mount. Cambios locales en `medical-agenda-saas` no se reflejan en runtime hasta rebuild/recreate. La ruta `E:\GSentinelHealthOS\Panel GSentinelHS` no participa del runtime y no existe actualmente.

Riesgo de stale build:

- Imagen `gsentinelhealthos-frontend` creada `2026-05-09T22:42:57Z`.
- Container iniciado `2026-05-12T13:25:23Z`.
- Como no hay bind mount, puede existir drift entre el filesystem actual y el codigo baked en la imagen.

## 5. Backend/services reales activos

| Servicio | Container | Origen codigo | Runtime | Health |
|---|---|---|---|---|
| API | `gs_api` | `api`, `brain`, `MetaBrain`, `shared`, `alembic` baked por `docker/api.Dockerfile` | Uvicorn `api.app.main:app` | healthy |
| Brain | `gs_brain` | `brain`, `MetaBrain`, `shared` baked por `docker/brain.Dockerfile` | `python brain/main.py` | healthy |
| Gateway | `gs_gateway` | `whatsapp_gateway`, `shared` baked por `docker/gateway.Dockerfile` | Uvicorn `whatsapp_gateway.app.main:app` | healthy |
| Dialogue | `gs_dialogue_engine` | `MetaBrain/services/dialogue_engine`, `MetaBrain/services/shared` baked | Uvicorn | healthy |
| Inference | `gs_inference_service` | `MetaBrain/services/inference_service`, `MetaBrain/services/shared`, `MetaBrain/cerebro_ai_med` baked | Uvicorn | healthy |
| Decision | `gs_decision_service` | `MetaBrain/services/decision_service`, `MetaBrain/services/shared` baked | Uvicorn | healthy |
| NLG | `gs_nlg_service` | `MetaBrain/services/nlg_service`, `MetaBrain/services/shared` baked | Uvicorn | healthy |
| Booking workers | `gs_booking_worker_0`, `gs_booking_worker_1` | API image baked | Python module worker | no healthcheck |
| Outbox scheduler | `gs_outbox_scheduler` | API image baked plus host bind `/app/scripts` | Python script | no healthcheck |

## 6. Variables env activas

No se reproducen valores. Solo nombres detectados por container.

| Container | Variables relevantes |
|---|---|
| `gs_frontend` | `DATABASE_URL`, `REDIS_URL`, `BRAIN_API_URL`, `BRAIN_API_KEY`, `BRAIN_TIMEOUT_MS`, `JWT_SECRET`, `GROQ_API_KEY`, `GROQ_BASE_URL`, `GROQ_MODEL`, `DOCUMENT_AI_*`, `DOCTOR_CHAT_GROQ_API_KEY`, `WHATSAPP_API_VERSION`, `WHATSAPP_AUTO_BOOT_WORKERS`, `PORT`, `HOSTNAME`, `NODE_ENV`, `NEXT_TELEMETRY_DISABLED` |
| `gs_api` | `DATABASE_URL`, `REDIS_URL`, `REDIS_SENTINELS`, `JWT_*`, `BRAIN_API_KEY`, `GATEWAY_API_KEY`, `WHATSAPP_*`, `META_*`, `SECRET_ENCRYPTION_KEY`, `RATE_LIMIT_PER_MINUTE`, `ENV`, `LOG_LEVEL` |
| `gs_brain` | `DATABASE_URL`, `REDIS_URL`, `API_BASE_URL`, `BRAIN_*`, `DIALOGUE_ENGINE_URL`, `INFERENCE_SERVICE_URL`, `DECISION_SERVICE_URL`, `NLG_SERVICE_URL`, `INTERNAL_SERVICES_KEY`, `ENV`, `LOG_LEVEL` |
| `gs_gateway` | `DATABASE_URL`, `REDIS_URL`, `WHATSAPP_*`, `GATEWAY_HOST`, `GATEWAY_PORT`, `ENABLE_WHATSAPP_GATEWAY`, `SECRET_ENCRYPTION_KEY`, `ENV`, `LOG_LEVEL` |
| `gs_inference_service`, `gs_dialogue_engine`, `gs_decision_service`, `gs_nlg_service` | `REDIS_URL`, `INTERNAL_SERVICES_KEY`, `ENV`, `LOG_LEVEL`, Python runtime variables |
| `gs_db` | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `PGDATA` |
| `gs_redis_master`, `gs_redis_replica` | `REDIS_PASSWORD` plus Redis image vars |
| `gs_booking_worker_*`, `gs_outbox_scheduler` | `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `BRAIN_API_KEY`, `GATEWAY_API_KEY`, queue/scheduler vars |

Env files detectados en filesystem:

| Archivo | Estado |
|---|---|
| `.env` | Activo para interpolacion del compose principal por convencion Docker Compose; no aparece como `env_file`. |
| `.env.example` | Documentacion/template, no runtime directo. |
| `.env.runtime_lab` | Lab host, no activo ahora. |
| `.env.runtime_lab_docker` | Referenciado por `docker-compose.precanary-lab.yml`, no activo ahora. |
| `MetaBrain/.env.example` | Template, no runtime directo. |
| `MetaBrain/cerebro_ai_med/.env.example` | Template, no runtime directo. |
| `MetaBrain/services/nlg_service/.env.example` | Template, no runtime directo. |

Conflicto env relevante:

- `medical-agenda-saas/docker-compose.prod.yml` espera un `.env` relativo a `medical-agenda-saas`; no se detecto `medical-agenda-saas/.env` con `rg --files`. Ese compose no esta activo.
- El compose activo usa `.env` raiz para muchas variables de runtime, incluyendo frontend, API, brain, gateway, Redis y Postgres.

## 7. Volumes y persistencia

Volumes usados por containers en ejecucion:

| Volume | Usado por | Persistencia |
|---|---|---|
| `gsentinelhealthos_postgres_data` | `gs_db` | Datos PostgreSQL Docker del stack principal. |
| `gsentinelhealthos_redis_master_data` | `gs_redis_master` | Datos Redis master. |
| `gsentinelhealthos_redis_replica_data` | `gs_redis_replica` | Datos Redis replica. |
| `gsentinelhealthos_uploads_data` | `gs_api`, `gs_brain`, `gs_gateway` | Uploads compartidos. |
| `703c697e...`, `fd71a40...`, `d6e03b...` | sentinels Redis | Anonymous volumes `/data` de sentinels. |

Volumes existentes no usados por containers en ejecucion:

- `gsentinel_runtime_lab_postgres_data`
- `gsentinel_precanary_lab_postgres_data`
- `medical-agenda-saas_medical_agenda_postgres_data`
- `database_gsentinel_postgres_data`
- `gsentinelhealthos_redis_cache_data`
- `gsentinelhealthos_redis_data`
- `gsentinelhealthos_redis_metrics_data`
- `gsentinelhealthos_redis_replica1_data`
- `gsentinelhealthos_redis_replica2_data`
- Muchos volumes anonimos hash-like no usados por containers activos.

No se borro ningun volume.

## 8. Networks Docker

Networks detectadas:

| Network | Estado | Containers |
|---|---|---|
| `gsentinelhealthos_gs_prod` | activa | 17 containers del runtime actual |
| `gsentinelhealthos_default` | sin containers | legacy/huérfana del proyecto compose |
| `gsentinelhealthos_sentinel-network` | sin containers | legacy/huérfana del proyecto compose |
| `bridge`, `host`, `none` | Docker defaults | sistema Docker |

`gsentinelhealthos_gs_prod`:

- Driver: `bridge`
- Subnet: `172.20.0.0/16`
- IPv6: disabled
- Containers: `gs_frontend`, `gs_api`, `gs_brain`, `gs_gateway`, `gs_dialogue_engine`, `gs_inference_service`, `gs_decision_service`, `gs_nlg_service`, Redis, Postgres, workers y scheduler.

## 9. Riesgos detectados

- Frontend baked sin bind mount: cambios locales no impactan runtime hasta rebuild. Riesgo de drift entre filesystem y container.
- `gs_dialogue_engine`, `gs_decision_service`, `gs_booking_worker_0`, `gs_booking_worker_1`, `gs_outbox_scheduler` corren image IDs directos/antiguos, mientras existen tags `latest` diferentes para algunos servicios. Riesgo de drift imagen-tag.
- `localhost:5432` del host es PostgreSQL Windows local, no `gs_db`. Riesgo alto para tests o herramientas host que asumen DB Docker.
- Redis Docker no esta publicado en `localhost:6379`. Herramientas host que esperen Redis en host fallaran o conectaran a otro proceso si aparece.
- `.env` raiz contiene muchas variables para multiples dominios. Riesgo de acoplamiento accidental entre API, frontend, gateway y workers.
- `docker compose config` imprime secretos resueltos. Debe evitarse en reportes sin sanitizacion.
- Existen volumes legacy/lab no usados; riesgo de borrar datos si se hace cleanup sin clasificacion.
- Existen imagenes `medical-agenda-saas-*` no activas, potencialmente legacy.

## 10. Drift arquitectonico

Drift filesystem vs runtime:

- Runtime activo usa imagenes baked. El filesystem actual puede diferir del codigo que corre.
- `gs_frontend` contiene copia baked de `medical-agenda-saas` dentro de `/app`; no usa bind mount.
- `gs_outbox_scheduler` si usa bind mount de `E:\GSentinelHealthOS\scripts` sobre `/app/scripts`, por lo que ese servicio si depende de filesystem host para scripts.

Drift rutas esperadas:

- `E:\GSentinelHealthOS\Panel GSentinelHS` no existe y no participa del runtime.
- Frontend vivo proviene de `medical-agenda-saas`.

Drift imagen-tag:

- `gs_dialogue_engine` corre `0bfd3f9b1643`, pero el tag local `gsentinelhealthos-dialogue-engine:latest` apunta a `78f758ad1056`.
- `gs_decision_service` corre `dd886d9ee4ec`, pero el tag local `gsentinelhealthos-decision-service:latest` apunta a `0a17e788c1e9`.
- Workers/scheduler corren image IDs que no coinciden con los tags hyphen/underscore mas recientes visibles en `docker images`.

Drift DB/Redis:

- Docker `gs_db` y Redis estan vivos dentro de Docker, pero host `localhost:5432` y `localhost:6379` no representan esos servicios.

## 11. Servicios legacy

Potencialmente legacy o no activos:

- `medical-agenda-saas/docker-compose.prod.yml`: no activo ahora; sus imagenes `medical-agenda-saas-web`, `medical-agenda-saas-brain`, `medical-agenda-saas-bootstrap`, `medical-agenda-saas-appointment-lifecycle` existen pero no corren.
- `docker-compose.runtime-lab.yml`: no activo ahora; volume lab persiste.
- `docker-compose.precanary-lab.yml`: no activo ahora; imagen `gsentinelhealthos-api_precanary_lab` existe y volume precanary persiste.
- Networks `gsentinelhealthos_default` y `gsentinelhealthos_sentinel-network`: sin containers.
- Volumes `database_gsentinel_postgres_data`, `medical-agenda-saas_medical_agenda_postgres_data`, `gsentinel_runtime_lab_postgres_data`, `gsentinel_precanary_lab_postgres_data`: no usados por runtime actual.

## 12. Servicios huerfanos

Containers huerfanos activos: no detectados. `docker ps -a` muestra containers del proyecto `gsentinelhealthos`; migradores terminados pertenecen al mismo compose.

Recursos huerfanos/no usados:

- Networks sin containers: `gsentinelhealthos_default`, `gsentinelhealthos_sentinel-network`.
- Volumes no usados por containers activos listados en seccion 7.
- Imagenes no usadas por containers activos: familia `medical-agenda-saas-*`, algunas imagenes antiguas de workers/scheduler y tags `latest` que no corresponden al container corriendo.

## 13. Que codigo realmente esta vivo

Codigo vivo por imagen:

- `medical-agenda-saas`: vivo en `gs_frontend`, baked en imagen `gsentinelhealthos-frontend`.
- `api`: vivo en `gs_api`, workers y scheduler via `docker/api.Dockerfile`.
- `brain`: vivo en `gs_brain` y parcialmente baked en API image.
- `whatsapp_gateway`: vivo en `gs_gateway`.
- `shared`: vivo en API/gateway/brain por Dockerfiles.
- `MetaBrain/services/dialogue_engine`: vivo en `gs_dialogue_engine`.
- `MetaBrain/services/inference_service`: vivo en `gs_inference_service`.
- `MetaBrain/services/decision_service`: vivo en `gs_decision_service`.
- `MetaBrain/services/nlg_service`: vivo en `gs_nlg_service`.
- `MetaBrain/cerebro_ai_med`: vivo dentro de `gs_inference_service`.
- `scripts/run_outbox_scheduler.py`: vivo en `gs_outbox_scheduler` via bind mount de `scripts`.
- `database/init-multiple-dbs.sql`: montado read-only en `gs_db` init path.
- `broker/redis.conf`, `broker/sentinel.conf`: montados read-only en Redis/Redis Sentinel.

## 14. Que codigo NO participa del runtime actual

No participa directamente del runtime activo:

- `E:\GSentinelHealthOS\Panel GSentinelHS`: no existe.
- `MetaBrain` Nest local (`MetaBrain/src/main.ts`): no hay proceso Node/Nest local activo; codigo puede estar baked parcialmente en imagenes Python, pero no corre como Nest en host.
- `medical-agenda-saas/docker-compose.prod.yml` stack: no activo.
- Runtime lab/precanary compose files: no activos.
- `.env.runtime_lab`, `.env.runtime_lab_docker`: no activos en compose actual.
- Imagenes `medical-agenda-saas-*`: no tienen containers activos.
- Puertos lab `55432`, `55433`, `56379`, `56380`, `18090`: no escuchan.

## 15. Riesgos de consolidacion

- Si se consolida frontend, primero decidir si la fuente canonica es `medical-agenda-saas` o una ruta restaurada `Panel GSentinelHS`.
- Si se borra `medical-agenda-saas`, se rompe la capacidad de rebuild del frontend activo.
- Si se borra `MetaBrain`, se rompe rebuild de servicios `dialogue`, `inference`, `decision`, `nlg` y posiblemente API/brain.
- Si se borra `scripts`, puede romper `gs_outbox_scheduler` inmediatamente porque usa bind mount.
- Si se borra `broker`, puede romper Redis/Redis Sentinel al recrear o reiniciar.
- Si se borra `database`, puede afectar init/recreate de Postgres.
- Si se hace retag/rebuild sin plan, containers que hoy corren image IDs antiguos pueden cambiar comportamiento.

## 16. Riesgos de borrar carpetas

No borrar sin plan:

- `medical-agenda-saas`: source del frontend activo.
- `api`: source de API/workers/scheduler.
- `brain`: source del brain service.
- `MetaBrain`: source de servicios IA y componentes baked.
- `shared`: dependencia compartida de varios Dockerfiles.
- `whatsapp_gateway`: source del gateway.
- `docker`: Dockerfiles activos.
- `broker`: configs Redis montadas.
- `database`: init SQL montado.
- `scripts`: bind mount activo de scheduler.
- `alembic`: migraciones baked en API image.

Carpetas/recursos candidatos a revision futura, no cleanup automatico:

- Volumes lab/precanary.
- Imagenes `medical-agenda-saas-*` no activas.
- Networks sin containers.

## 17. Riesgos de multiples env

- `.env` raiz alimenta el compose principal y contiene variables de API, frontend, gateway, WhatsApp, Meta, Redis, DB, seed y llaves internas.
- `medical-agenda-saas/docker-compose.prod.yml` espera `.env` local al subproyecto, pero no se detecto `medical-agenda-saas/.env`; si se levanta desde esa carpeta, puede comportarse distinto.
- `.env.runtime_lab` y `.env.runtime_lab_docker` tienen configuracion lab/precanary separada; no deben mezclarse con stack activo.
- Variables `DATABASE_URL`/`REDIS_URL` aparecen en multiples contextos con significados distintos: host, Docker network, lab y frontend.
- Variables `GROQ`, `WHATSAPP`, `META`, `JWT`, `BRAIN_API_KEY`, `INTERNAL_SERVICES_KEY` estan presentes en containers runtime; cualquier reporte debe sanitizarlas.

## 18. Recomendacion tecnica futura

Sin ejecutar cambios ahora:

1. Declarar una matriz canonica de runtime: `source path`, `Dockerfile`, `image tag`, `container`, `port`, `volume`, `env source`.
2. Decidir oficialmente si `medical-agenda-saas` es el frontend canonico o si se debe restaurar `Panel GSentinelHS`.
3. Versionar/etiquetar imagenes con hash de commit o build id para evitar drift de `latest`.
4. Documentar que el frontend runtime es baked y requiere rebuild/recreate para reflejar cambios locales.
5. Separar `.env` por dominio o generar un mapa de consumo por servicio para reducir acoplamiento.
6. Resolver la ambiguedad `localhost:5432`: publicar un puerto lab claro o documentar que host `5432` no es Docker.
7. Antes de cualquier cleanup, crear allowlist de volumes vivos y snapshot/backup de volumes no usados.
8. Evitar `docker compose config` sin sanitizacion en auditorias compartibles.

## Evidencia ejecutada

Comandos usados:

- `docker ps`
- `docker inspect`
- `docker image inspect`
- `docker images`
- `docker network ls`
- `docker network inspect`
- `docker volume ls`
- `docker volume inspect`
- `docker compose ls`
- `docker compose ps`
- `Get-NetTCPConnection`
- `rg --files` para compose/env files
- `Select-String` sobre compose/Dockerfiles
- `docker exec gs_frontend` para `pwd`, `ls`, `package.json` y archivos Next standalone

Acciones no realizadas:

- No `docker compose up`.
- No `docker compose down`.
- No restart.
- No rebuild.
- No prune.
- No kill.
- No edicion de `.env`.
- No cambio de puertos.
- No deploy.
