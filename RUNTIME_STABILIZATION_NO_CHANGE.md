# RUNTIME STABILIZATION NO CHANGE

Fecha/hora local: 2026-05-12 18:49:51 -03:00  
Modo: estabilizacion documental sin cambios  
Proyecto raiz: `E:\GSentinelHealthOS`  
Compose project activo: `gsentinelhealthos`  
Compose file activo: `E:\GSentinelHealthOS\docker-compose.yml`  
Red activa: `gsentinelhealthos_gs_prod`

## 1. Evidencia operacional congelada

Comandos de solo lectura usados:

- `docker ps --no-trunc`
- `docker inspect`
- `docker images --no-trunc`
- `docker image inspect`
- `docker compose ps`
- `docker compose ls`
- `docker network inspect`
- `docker volume ls`
- `git status --short`
- `git rev-parse HEAD`
- `git branch --show-current`
- `git log -5 --oneline`

No se ejecutaron comandos de restart, rebuild, deploy, prune, borrado, tag, checkout, reset, commit ni edicion de archivos de configuracion.

## 2. Estado Git observado

- HEAD: `491379e4f18776d97e7a625d15da1f924a3b3f88`
- Rama: `GsentinelH`
- Ultimos commits:
  - `491379e chore(git): untrack generated artifacts`
  - `d4023af chore(gitignore): exclude generated runtime artifacts`
  - `93bdfde docs(runtime): add runtime integration commit report`
  - `772831f feat(runtime): integrate passive MetaBrain runtime middleware`
  - `b28fdab fix(mongoose): remove duplicate incidentId index definition`

Worktree observado: sucio, con multiples archivos modificados y no trackeados. Este estado refuerza que un rebuild desde filesystem actual no debe asumirse equivalente al runtime activo.

## 3. Runtime vivo actual

El runtime canonico temporal son estos 17 containers activos, tal como estan corriendo ahora:

| Container | Service | Tag/ref declarado | Image ID real canonico temporal | Image created UTC | Container started UTC | Estado | Ports | Network | Restart |
|---|---|---|---|---|---|---|---|---|---|
| `gs_frontend` | frontend | `gsentinelhealthos-frontend` | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` | `2026-05-09T22:42:57Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:3000->3000/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_brain` | brain | `gsentinelhealthos-brain` | `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` | `2026-05-09T22:27:13Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:8001->8001/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_nlg_service` | nlg-service | `gsentinelhealthos-nlg-service` | `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` | `2026-05-09T02:29:18Z` | `2026-05-12T13:25:22Z` | running/healthy | `127.0.0.1:8013->8013/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_inference_service` | inference-service | `gsentinelhealthos-inference-service` | `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` | `2026-05-09T02:24:34Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:8011->8011/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_gateway` | gateway | `gsentinelhealthos-gateway` | `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` | `2026-05-09T01:54:56Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:8002->8002/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_api` | api | `gsentinelhealthos-api` | `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` | `2026-05-09T01:54:56Z` | `2026-05-12T13:25:36Z` | running/healthy | `127.0.0.1:8000->8000/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_redis_sentinel_3` | redis-sentinel-3 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_redis_sentinel_1` | redis-sentinel-1 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_redis_sentinel_2` | redis-sentinel-2 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_redis_replica` | redis-replica | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_redis_master` | redis-master | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_db` | db | `postgres:16-alpine` | `sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e` | `2026-04-21T23:10:13Z` | `2026-05-12T13:25:23Z` | running/healthy | internal `5432/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_outbox_scheduler` | outbox_scheduler | `gsentinelhealthos-outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | running/no healthcheck | none | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_booking_worker_1` | booking_worker_1 | `gsentinelhealthos-booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | running/no healthcheck | none | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_booking_worker_0` | booking_worker_0 | `gsentinelhealthos-booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | running/no healthcheck | none | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_decision_service` | decision-service | `gsentinelhealthos-decision-service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `2026-05-08T21:40:45Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:8012->8012/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |
| `gs_dialogue_engine` | dialogue-engine | `gsentinelhealthos-dialogue-engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `2026-05-08T21:40:45Z` | `2026-05-12T13:25:23Z` | running/healthy | `127.0.0.1:8010->8010/tcp` | `gsentinelhealthos_gs_prod` | unless-stopped |

## 4. Mounts y volumes asociados

| Container | Mounts observados |
|---|---|
| `gs_frontend` | sin mounts |
| `gs_brain` | volume `gsentinelhealthos_uploads_data` -> `/data/uploads` |
| `gs_api` | volume `gsentinelhealthos_uploads_data` -> `/data/uploads` |
| `gs_gateway` | volume `gsentinelhealthos_uploads_data` -> `/data/uploads` |
| `gs_nlg_service` | sin mounts |
| `gs_inference_service` | sin mounts |
| `gs_decision_service` | sin mounts |
| `gs_dialogue_engine` | sin mounts |
| `gs_outbox_scheduler` | bind `E:\GSentinelHealthOS\scripts` -> `/app/scripts:ro` |
| `gs_booking_worker_0` | sin mounts |
| `gs_booking_worker_1` | sin mounts |
| `gs_db` | bind `database/init-multiple-dbs.sql` -> init SQL `:ro`; volume `gsentinelhealthos_postgres_data` -> `/var/lib/postgresql/data` |
| `gs_redis_master` | bind `broker/redis.conf` -> `/usr/local/etc/redis/redis.conf:ro`; volume `gsentinelhealthos_redis_master_data` -> `/data` |
| `gs_redis_replica` | bind `broker/redis.conf` -> `/usr/local/etc/redis/redis.conf:ro`; volume `gsentinelhealthos_redis_replica_data` -> `/data` |
| `gs_redis_sentinel_1` | bind `broker/sentinel.conf` -> sentinel config `:ro`; anonymous volume -> `/data` |
| `gs_redis_sentinel_2` | bind `broker/sentinel.conf` -> sentinel config `:ro`; anonymous volume -> `/data` |
| `gs_redis_sentinel_3` | bind `broker/sentinel.conf` -> sentinel config `:ro`; anonymous volume -> `/data` |

Volumes nombrados relevantes:

- `gsentinelhealthos_postgres_data`
- `gsentinelhealthos_redis_master_data`
- `gsentinelhealthos_redis_replica_data`
- `gsentinelhealthos_uploads_data`
- Volumes legacy/lab observados: `gsentinel_precanary_lab_postgres_data`, `gsentinel_runtime_lab_postgres_data`, `medical-agenda-saas_medical_agenda_postgres_data`, `database_gsentinel_postgres_data`, otros anonimos.

## 5. Healthchecks

| Container | Healthcheck |
|---|---|
| `gs_frontend` | GET local `/` via Node fetch |
| `gs_api` | GET local `/api/health/liveness` |
| `gs_brain` | GET local `/health` |
| `gs_gateway` | GET local `/health` |
| `gs_dialogue_engine` | GET local `/health` |
| `gs_inference_service` | GET local `/health` |
| `gs_decision_service` | GET local `/health` |
| `gs_nlg_service` | GET local `/health` |
| `gs_db` | `pg_isready -U sentinel -d gsentinel` |
| `gs_redis_master` | `redis-cli ... ping` con password por env |
| `gs_redis_replica` | `redis-cli ... ping` con password por env |
| `gs_redis_sentinel_1/2/3` | `redis-cli -p 26379 ping` |
| `gs_outbox_scheduler` | sin healthcheck |
| `gs_booking_worker_0` | sin healthcheck |
| `gs_booking_worker_1` | sin healthcheck |

## 6. Runtime canonico actual

Hasta completar una estabilizacion formal, los image IDs reales listados en la seccion 3 deben considerarse la fuente de verdad temporal.

Containers que representan runtime vivo actual:

- `gs_frontend`
- `gs_api`
- `gs_brain`
- `gs_gateway`
- `gs_nlg_service`
- `gs_inference_service`
- `gs_decision_service`
- `gs_dialogue_engine`
- `gs_outbox_scheduler`
- `gs_booking_worker_0`
- `gs_booking_worker_1`
- `gs_db`
- `gs_redis_master`
- `gs_redis_replica`
- `gs_redis_sentinel_1`
- `gs_redis_sentinel_2`
- `gs_redis_sentinel_3`

## 7. Tags latest no confiables

Estos tags locales `latest` NO deben considerarse runtime real porque no coinciden con el image ID que corre el container:

| Tag local | Latest local actual | Runtime real |
|---|---|---|
| `gsentinelhealthos-outbox_scheduler:latest` | `sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` |
| `gsentinelhealthos-booking_worker_0:latest` | `sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` |
| `gsentinelhealthos-booking_worker_1:latest` | `sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` |
| `gsentinelhealthos-decision-service:latest` | `sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` |
| `gsentinelhealthos-dialogue-engine:latest` | `sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` |

Implicacion: recrear esos containers podria cambiar el codigo vivo aunque no se edite ningun archivo.

## 8. Builds candidatos, no runtime

Estas imagenes existen localmente pero no representan el runtime vivo actual:

- `gsentinelhealthos-api_precanary_lab:latest` -> `sha256:06b10aa090cf02feb680316b8c9747417452a0470e2ba421a6e4f8348d98bc52`
- `gsentinelhealthos-migrate-api:latest` -> `sha256:e4a9a1ed2466904983c0b885718b82bf1dea8362693c16ea5c0562149d603f7c`
- `gsentinelhealthos-migrate-frontend:latest` -> `sha256:419d5a810071e5c7f92cd75cd6d8ffb0d9d1207cdb120c41c560d77347bccfd0`
- Latest locales no desplegados para `outbox_scheduler`, `booking_worker_0`, `booking_worker_1`, `decision-service`, `dialogue-engine`
- Imagenes legacy `medical-agenda-saas-*`
- Imagenes legacy con guion: `gsentinelhealthos-outbox-scheduler`, `gsentinelhealthos-booking-worker-0`, `gsentinelhealthos-booking-worker-1`

Tratamiento recomendado: candidatas o historicas, nunca runtime canonico hasta validar y desplegar formalmente.

## 9. Matriz de riesgo

| Item | Tipo | Estado actual | Riesgo si se recrea | Riesgo si se borra | Riesgo si se rebuildea | Recomendacion |
|---|---|---|---|---|---|---|
| `gs_outbox_scheduler` | scheduler | corre image ID sin coincidir con `latest`; mount `./scripts` | Critico: podria pasar a build distinto | Critico: se pierde runtime/evidencia | Alto: filesystem sucio y scripts montados | No recrear; congelar image ID antes |
| `gs_booking_worker_0` | worker | corre image ID distinto a `latest` | Critico: cambio silencioso de worker | Critico | Alto | No recrear; validar cola en lab |
| `gs_booking_worker_1` | worker | corre image ID distinto a `latest` | Critico: cambio silencioso de worker | Critico | Alto | No recrear; validar cola en lab |
| `gs_decision_service` | MetaBrain service | corre image ID distinto a `latest` | Critico: puede cambiar decision runtime | Critico | Alto | No recrear; smoke test de latest aparte |
| `gs_dialogue_engine` | MetaBrain service | corre image ID distinto a `latest` | Critico: puede cambiar dialogue runtime | Critico | Alto | No recrear; smoke test de latest aparte |
| `gs_frontend` | Next.js frontend | coincide con `latest` | Medio: rebuild podria incluir cambios locales | Alto | Alto | Mantener intacto; no rebuild |
| `gs_api` | backend API | coincide con `latest` | Medio | Alto | Alto | Mantener intacto; no rebuild |
| `gs_brain` | brain service | coincide con `latest` | Medio | Alto | Alto | Mantener intacto |
| `gs_gateway` | gateway | coincide con `latest` | Medio | Alto | Alto | Mantener intacto |
| `gs_inference_service` | IA inference service | coincide con `latest` | Medio | Alto | Alto | Mantener intacto; no activar cambios |
| `gs_nlg_service` | NLG service | coincide con `latest` | Medio | Alto | Alto | Mantener intacto |
| `gs_db` | PostgreSQL | upstream image; volume persistente | Alto: riesgo de downtime/db init edge | Critico: perdida de data si se toca volume | Bajo para imagen, critico para data | No recrear sin backup |
| Redis master/replica/sentinels | Redis HA | upstream image; volumes/config bind | Alto: failover/config drift | Critico si se borra data | Medio | No tocar sin backup |
| `gsentinelhealthos-api_precanary_lab:latest` | build candidato | no desplegado | Bajo si no se usa; alto si se confunde con runtime | Medio | Desconocido | Documentar como candidato |
| Imagenes legacy | historico/orphan | no runtime activo | Bajo para runtime, alto para trazabilidad | Medio/desconocido | Desconocido | No borrar hasta inventario final |

## 10. Acciones prohibidas temporales

Hasta estabilizacion formal, NO ejecutar:

- `docker compose up -d`
- `docker compose up -d --build`
- `docker compose down`
- `docker compose pull`
- `docker compose build`
- `docker container rm`
- `docker image rm`
- `docker system prune`
- `docker image prune`
- `docker volume prune`
- `docker tag`
- `git checkout`
- `git reset`
- `git clean`
- `npm install` masivo
- cambios de `.env`
- cambios de compose

Motivo: cualquiera de estas acciones puede romper la correspondencia actual container -> image ID real o activar builds no desplegados.

## 11. Plan futuro de estabilizacion sin ejecutar

Plan propuesto para una ventana controlada posterior:

1. Backup/export de evidencia:
   - guardar `docker inspect` completo de containers e imagenes activas,
   - guardar `docker compose config`,
   - guardar inventario de volumes y networks.
2. Tag seguro de imagenes canonicas actuales:
   - crear tags forenses para image IDs vivos, especialmente los 5 no coincidentes con `latest`.
3. Generacion de `compose.lock` operativo:
   - mapear cada servicio a image digest/hash canonico en vez de depender de `latest`.
4. Comparacion formal `latest` vs runtime:
   - revisar diffs de Docker history, Dockerfiles y source asociado.
5. Rebuild controlado en entorno separado:
   - usar worktree limpio y commit fijo,
   - incluir labels OCI con commit, source, fecha y version.
6. Smoke tests:
   - healthchecks,
   - endpoints HTTP,
   - workers/colas,
   - scheduler,
   - DB/Redis connectivity,
   - frontend 127.0.0.1:3000.
7. Recreacion selectiva solo si pasa validacion:
   - empezar por servicios sin estado,
   - no tocar DB/Redis sin backup.
8. Rollback documentado:
   - rollback por image ID/tag forense,
   - rollback de compose lock,
   - verificacion de puertos.
9. Cleanup recien despues de backup y validacion:
   - borrar solo imagenes/volumes clasificados,
   - nunca usar prune amplio sin lista aprobada.

## 12. Criterio de completitud

Este reporte responde:

- Runtime vivo: 17 containers del project `gsentinelhealthos`, listados con image IDs reales.
- Que no tocar: los containers vivos, las imagenes activas, volumes persistentes, compose, `.env` y Git.
- Containers peligrosos de recrear: `gs_outbox_scheduler`, `gs_booking_worker_0`, `gs_booking_worker_1`, `gs_decision_service`, `gs_dialogue_engine`.
- Tags que mienten: los 5 `latest` no coincidentes listados en la seccion 7.
- Imagenes candidatas pero no runtime: `api_precanary_lab`, migrate images, latest no desplegados y legacy images.
- Pasos futuros seguros: backup/export, tags forenses, compose lock, rebuild separado, smoke tests, recreacion selectiva y rollback.
- Acciones prohibidas: listadas explicitamente en la seccion 10.

## 13. Confirmacion no-change

Durante esta preparacion:

- NO se modifico runtime.
- NO se reinicio nada.
- NO se recrearon containers.
- NO se hizo rebuild.
- NO se hizo deploy.
- NO se ejecuto `docker compose up/down`.
- NO se hizo prune.
- NO se borraron imagenes.
- NO se borraron containers.
- NO se cambiaron tags.
- NO se edito `.env`.
- NO se altero Git.
