# RUNTIME DRIFT TRACE AUDIT

Fecha: 2026-05-12  
Modo: auditoria solamente, sin cambios de runtime  
Raiz auditada: `E:\GSentinelHealthOS`  
Compose activo: `E:\GSentinelHealthOS\docker-compose.yml`  
Compose project activo: `gsentinelhealthos`  
Red activa: `gsentinelhealthos_gs_prod`

## 1. Resumen ejecutivo

Se audito la trazabilidad entre filesystem, Git, Docker build, image hash y contenedores activos. El runtime real esta sostenido por 17 contenedores Docker del compose project `gsentinelhealthos`.

Hallazgos principales:

- El frontend vivo es `gs_frontend`, sirve `127.0.0.1:3000`, corre Next.js desde la imagen `gsentinelhealthos-frontend:latest`, construida desde `medical-agenda-saas/Dockerfile` con contexto `medical-agenda-saas`.
- `gs_frontend`, `gs_brain`, `gs_api`, `gs_gateway`, `gs_inference_service` y `gs_nlg_service` coinciden con sus tags locales `latest`.
- `gs_decision_service`, `gs_dialogue_engine`, `gs_outbox_scheduler`, `gs_booking_worker_0` y `gs_booking_worker_1` NO coinciden con sus tags locales `latest`: corren image IDs antiguos/sin tag local mientras `latest` apunta a otro build mas nuevo.
- No se detectaron labels con commit Git embebido en las imagenes custom. La trazabilidad Git directa es inexistente: las imagenes solo exponen labels de Docker Compose.
- El worktree local esta muy sucio: `git status --short` reporto 241 entradas, 80 archivos con diff unstaged, 0 staged y 463 untracked. Por lo tanto, el filesystem actual no puede considerarse equivalente al runtime vivo.
- Hay imagenes legacy/orphan de `medical-agenda-saas-*`, imagenes migrate no activas, tags antiguos con guion (`booking-worker-*`) y multiples volumes locales que requieren revision futura antes de cualquier cleanup.

No se reiniciaron contenedores, no se reconstruyeron imagenes, no se editaron `.env`, no se altero Git y no se ejecuto cleanup.

## 2. Codigo exacto actualmente vivo

| Servicio vivo | Container | Codigo incluido por Dockerfile | Contexto build declarado | Imagen real viva | Puerto host |
|---|---|---|---|---|---|
| frontend | `gs_frontend` | Next.js standalone, `public`, `.next/static`, `prisma` | `./medical-agenda-saas` | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` | `127.0.0.1:3000` |
| api | `gs_api` | `api`, `brain`, `MetaBrain`, `shared`, `alembic` | `.` | `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` | `127.0.0.1:8000` |
| brain | `gs_brain` | `brain`, `MetaBrain`, `shared` | `.` | `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` | `127.0.0.1:8001` |
| gateway | `gs_gateway` | `whatsapp_gateway`, `shared`, preflight scripts | `.` | `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` | `127.0.0.1:8002` |
| dialogue-engine | `gs_dialogue_engine` | `MetaBrain/services/dialogue_engine`, `MetaBrain/services/shared` | `.` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `127.0.0.1:8010` |
| inference-service | `gs_inference_service` | `MetaBrain/services/inference_service`, `MetaBrain/services/shared`, `MetaBrain/cerebro_ai_med` | `.` | `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` | `127.0.0.1:8011` |
| decision-service | `gs_decision_service` | `MetaBrain/services/decision_service`, `MetaBrain/services/shared` | `.` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `127.0.0.1:8012` |
| nlg-service | `gs_nlg_service` | `MetaBrain/services/nlg_service`, `MetaBrain/services/shared` | `.` | `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` | `127.0.0.1:8013` |
| outbox_scheduler | `gs_outbox_scheduler` | `api.Dockerfile`; ademas mount readonly `./scripts:/app/scripts:ro` | `.` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | sin puerto |
| booking_worker_0 | `gs_booking_worker_0` | `api.Dockerfile` | `.` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | sin puerto |
| booking_worker_1 | `gs_booking_worker_1` | `api.Dockerfile` | `.` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | sin puerto |
| db | `gs_db` | upstream `postgres:16-alpine` | no build local | `sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e` | interno `5432/tcp` |
| redis-* | 5 containers Redis | upstream `redis:8.0.2-alpine` | no build local | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | interno `6379/tcp` |

Nota de seguridad: comandos Redis y variables sensibles fueron inspeccionados solo para auditoria y se documentan redactados.

## 3. Mapa filesystem -> git -> Dockerfile -> image -> container

| Servicio | Git/filesystem source | Dockerfile | Hash Dockerfile actual | Imagen viva | Container | Trazabilidad Git directa |
|---|---|---|---|---|---|---|
| frontend | `medical-agenda-saas` | `medical-agenda-saas/Dockerfile` | `54D10EC6A1856C20CFD228B8E1162B4E9DFDC093CD90EA038B280D75B50B82D4` | `sha256:c1eef26b3087...` | `gs_frontend` | No hay commit label |
| api | repo raiz | `docker/api.Dockerfile` | `36A0C4185FF97102145148500836064E63646566E70C889EDFB454EA84EB1B7A` | `sha256:d9868f3e26ba...` | `gs_api` | No hay commit label |
| brain | repo raiz | `docker/brain.Dockerfile` | `B8EE308B580B35E38950576D9F9D6A39264BD2F82E7D636CF67BFE9AFE274B1E` | `sha256:bb85e7d49f10...` | `gs_brain` | No hay commit label |
| gateway | repo raiz | `docker/gateway.Dockerfile` | `5D32C43DB47A88563B70EF09D2D7F4FDB296D2FAA10F5B82D682CF6D356D67F9` | `sha256:a9bb2547b9cb...` | `gs_gateway` | No hay commit label |
| dialogue-engine | repo raiz | `docker/dialogue-engine.Dockerfile` | `EF0A027A3AF4245BC7712587C4E14F4E56147D8D18DF95722EDAE5FB6F6F573F` | `sha256:0bfd3f9b1643...` | `gs_dialogue_engine` | No hay commit label |
| inference-service | repo raiz | `docker/inference-service.Dockerfile` | `63BC10F926E56A8CFB674E11168A7430714C0D2F20E5670BCF936C2516FB0648` | `sha256:0a4281800dcb...` | `gs_inference_service` | No hay commit label |
| decision-service | repo raiz | `docker/decision-service.Dockerfile` | `659A5CC9A0F0AD88340ABA690C9B848364B8C92D36B4831C62C5F8DACFA6813F` | `sha256:dd886d9ee4ec...` | `gs_decision_service` | No hay commit label |
| nlg-service | repo raiz | `docker/nlg-service.Dockerfile` | `58553FF69D741031556D7B7341442F4B24E9832354EE6A893BC2A4E4780952EC` | `sha256:2347f33098d8...` | `gs_nlg_service` | No hay commit label |

Hashes de entrada relevantes:

- `docker-compose.yml`: `14FD00DE9FBF300EDBEA2EFCC903EAC321BDDEE0B630EE538EA714AD2CBAA5C3`
- `requirements.txt`: `61EE71E529998EB9BA76CEAC814185AAFF277A7C2C0833171C0FAF6360D65220`
- `medical-agenda-saas/package.json`: `1212CD9C01D87BAA9991337EA7D9D141CABDEC12F72BC1E65BF9FE5FD991E8AE`
- `medical-agenda-saas/package-lock.json`: `4FD54F3C63D6161F15B3619D93FA9D34636FDD3BAA0C45BAC09BEE36CB3A6FA3`

## 4. Containers activos y sus image hashes reales

| Container | Service | Image ref | Image ID real | Image created UTC | Container started UTC | Command | Ports | Network | Estado |
|---|---|---|---|---|---|---|---|---|---|
| `gs_frontend` | frontend | `gsentinelhealthos-frontend` | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` | `2026-05-09T22:42:57Z` | `2026-05-12T13:25:23Z` | `node server.js` | `127.0.0.1:3000->3000/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_brain` | brain | `gsentinelhealthos-brain` | `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` | `2026-05-09T22:27:13Z` | `2026-05-12T13:25:23Z` | `python brain/main.py` | `127.0.0.1:8001->8001/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_api` | api | `gsentinelhealthos-api` | `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` | `2026-05-09T01:54:56Z` | `2026-05-12T13:25:36Z` | `uvicorn api.app.main:app --host 0.0.0.0 --port 8000` | `127.0.0.1:8000->8000/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_gateway` | gateway | `gsentinelhealthos-gateway` | `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` | `2026-05-09T01:54:56Z` | `2026-05-12T13:25:23Z` | `uvicorn whatsapp_gateway.app.main:app --host 0.0.0.0 --port 8002` | `127.0.0.1:8002->8002/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_inference_service` | inference-service | `gsentinelhealthos-inference-service` | `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` | `2026-05-09T02:24:34Z` | `2026-05-12T13:25:23Z` | `uvicorn services.inference_service.main:app --host 0.0.0.0 --port 8011 --workers 1` | `127.0.0.1:8011->8011/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_nlg_service` | nlg-service | `gsentinelhealthos-nlg-service` | `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` | `2026-05-09T02:29:18Z` | `2026-05-12T13:25:22Z` | `uvicorn services.nlg_service.main:app --host 0.0.0.0 --port 8013 --workers 1` | `127.0.0.1:8013->8013/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_dialogue_engine` | dialogue-engine | `gsentinelhealthos-dialogue-engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `2026-05-08T21:40:45Z` | `2026-05-12T13:25:23Z` | `uvicorn services.dialogue_engine.main:app --host 0.0.0.0 --port 8010 --workers 1` | `127.0.0.1:8010->8010/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_decision_service` | decision-service | `gsentinelhealthos-decision-service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `2026-05-08T21:40:45Z` | `2026-05-12T13:25:23Z` | `uvicorn services.decision_service.main:app --host 0.0.0.0 --port 8012 --workers 1` | `127.0.0.1:8012->8012/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_outbox_scheduler` | outbox_scheduler | `gsentinelhealthos-outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | `python scripts/run_outbox_scheduler.py` | none | `gsentinelhealthos_gs_prod` | running |
| `gs_booking_worker_0` | booking_worker_0 | `gsentinelhealthos-booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | `python -m api.app.booking_queue_worker_main` | none | `gsentinelhealthos_gs_prod` | running |
| `gs_booking_worker_1` | booking_worker_1 | `gsentinelhealthos-booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `2026-05-08T22:31:34Z` | `2026-05-12T13:25:23Z` | `python -m api.app.booking_queue_worker_main` | none | `gsentinelhealthos_gs_prod` | running |
| `gs_db` | db | `postgres:16-alpine` | `sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e` | `2026-04-21T23:10:13Z` | `2026-05-12T13:25:23Z` | `postgres -c max_connections=50 -c shared_buffers=128MB` | internal `5432/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_redis_master` | redis-master | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | `redis-server [redacted auth/config args]` | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_redis_replica` | redis-replica | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | `redis-server [redacted auth/config args]` | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_redis_sentinel_1` | redis-sentinel-1 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | `redis-server [redacted sentinel args]` | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_redis_sentinel_2` | redis-sentinel-2 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | `redis-server [redacted sentinel args]` | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | healthy |
| `gs_redis_sentinel_3` | redis-sentinel-3 | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `2025-05-29T16:02:07Z` | `2026-05-12T13:25:23Z` | `redis-server [redacted sentinel args]` | internal `6379/tcp` | `gsentinelhealthos_gs_prod` | healthy |

Restart policy observado: `unless-stopped` para contenedores activos.

## 5. Tags latest que no coinciden con runtime

| Service | Container | Running image ID | Local latest image ID | Match | Riesgo | Accion recomendada luego |
|---|---|---|---|---|---|---|
| outbox_scheduler | `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2` | No | `latest` no representa runtime real | Validar cambios del build mas nuevo antes de desplegar |
| booking_worker_0 | `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1` | No | worker vivo no coincide con tag local | Validar cola/worker antes de recrear |
| booking_worker_1 | `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81` | No | worker vivo no coincide con tag local | Validar cola/worker antes de recrear |
| decision-service | `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f` | No | build nuevo no desplegado o container stale | Probar `latest` en lab antes de reemplazar |
| dialogue-engine | `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036` | No | build nuevo no desplegado o container stale | Probar `latest` en lab antes de reemplazar |

Servicios que SI coinciden con `latest`: frontend, brain, api, gateway, inference-service, nlg-service, db, Redis.

## 6. Imagenes stale

Imagenes clasificadas como stale por existir un tag `latest` local mas nuevo que el image ID ejecutado:

- `gsentinelhealthos-outbox_scheduler`: runtime `sha256:98cb722fbe069...`, latest local `sha256:33778722e6f...`.
- `gsentinelhealthos-booking_worker_0`: runtime `sha256:cd2a08c7b2ab...`, latest local `sha256:78ad8bc25f17...`.
- `gsentinelhealthos-booking_worker_1`: runtime `sha256:d713bb4e4f66...`, latest local `sha256:472abe98d9d4...`.
- `gsentinelhealthos-decision-service`: runtime `sha256:dd886d9ee4ec...`, latest local `sha256:0a17e788c1e9...`.
- `gsentinelhealthos-dialogue-engine`: runtime `sha256:0bfd3f9b1643...`, latest local `sha256:78f758ad1056...`.

## 7. Builds que nunca llegaron al runtime

| Imagen local | Image ID | Creada | Clasificacion | Evidencia |
|---|---|---|---|---|
| `gsentinelhealthos-api_precanary_lab:latest` | `sha256:06b10aa090cf02feb680316b8c9747417452a0470e2ba421a6e4f8348d98bc52` | 2026-05-12 12:53 -0300 | build lab no desplegado | Ningun container activo la usa |
| `gsentinelhealthos-outbox_scheduler:latest` | `sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2` | 2026-05-08 21:36 -0300 | latest no desplegado | Container corre `sha256:98cb722fbe069...` |
| `gsentinelhealthos-booking_worker_0:latest` | `sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1` | 2026-05-08 21:36 -0300 | latest no desplegado | Container corre `sha256:cd2a08c7b2ab...` |
| `gsentinelhealthos-booking_worker_1:latest` | `sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81` | 2026-05-08 21:36 -0300 | latest no desplegado | Container corre `sha256:d713bb4e4f665...` |
| `gsentinelhealthos-decision-service:latest` | `sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f` | 2026-05-08 22:17 -0300 | latest no desplegado | Container corre `sha256:dd886d9ee4ec...` |
| `gsentinelhealthos-dialogue-engine:latest` | `sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036` | 2026-05-08 22:17 -0300 | latest no desplegado | Container corre `sha256:0bfd3f9b1643...` |

## 8. Containers desactualizados

Contenedores potencialmente desactualizados por no coincidir con el tag local `latest`:

- `gs_outbox_scheduler`
- `gs_booking_worker_0`
- `gs_booking_worker_1`
- `gs_decision_service`
- `gs_dialogue_engine`

Esto no demuestra por si solo que el runtime sea incorrecto. Demuestra que el tag `latest` local no describe exactamente lo que esta ejecutandose. Cualquier recreacion futura de esos servicios podria cambiar codigo efectivo aunque no se editen archivos.

## 9. Imagenes basura/historicas candidatas

Clasificacion conservadora, sin borrar nada:

| Imagen | Clasificacion | Motivo | Riesgo cleanup |
|---|---|---|---|
| `medical-agenda-saas-web:latest` | legacy/orphan | Project label `medical-agenda-saas`, ningun container activo | Revisar antes de borrar |
| `medical-agenda-saas-brain:latest` | legacy/orphan | Project label `medical-agenda-saas`, ningun container activo | Revisar antes de borrar |
| `medical-agenda-saas-bootstrap:latest` | legacy/orphan | Project label `medical-agenda-saas`, ningun container activo | Revisar antes de borrar |
| `medical-agenda-saas-appointment-lifecycle:latest` | legacy/orphan | Project label `medical-agenda-saas`, ningun container activo | Revisar antes de borrar |
| `gsentinelhealthos-booking-worker-0:latest` | legacy name | Usa guion, distinto de `booking_worker_0`; no usado | Revisar antes de borrar |
| `gsentinelhealthos-booking-worker-1:latest` | legacy name | Usa guion, distinto de `booking_worker_1`; no usado | Revisar antes de borrar |
| `gsentinelhealthos-outbox-scheduler:latest` | legacy name | Usa guion, distinto de `outbox_scheduler`; no usado | Revisar antes de borrar |
| `gsentinelhealthos-migrate-api:latest` | migrate/inactive | Asociada a servicio migrate no activo | No borrar sin revisar migraciones |
| `gsentinelhealthos-migrate-frontend:latest` | migrate/inactive | Asociada a servicio migrate no activo | No borrar sin revisar bootstrap/migraciones |
| `postgres:15-alpine` | upstream legacy | No usado por runtime activo | Bajo, pero validar dependencias externas |
| `redis:7-alpine` | upstream legacy | No usado por runtime activo | Bajo, pero validar stacks externos |
| `redis:7.2.5-alpine` | upstream legacy | No usado por runtime activo | Bajo, pero validar stacks externos |
| `alpine:latest` | base/helper | No usado por contenedores activos | Bajo |

## 10. Imagenes dangling

Se detectaron imagenes activas sin RepoTag local en contenedores vivos:

- `sha256:98cb722fbe069...` usada por `gs_outbox_scheduler`
- `sha256:d713bb4e4f665...` usada por `gs_booking_worker_1`
- `sha256:cd2a08c7b2ab...` usada por `gs_booking_worker_0`
- `sha256:dd886d9ee4ec...` usada por `gs_decision_service`
- `sha256:0bfd3f9b1643...` usada por `gs_dialogue_engine`

Estas imagenes NO son basura mientras los contenedores sigan corriendo. Borrarlas/prunearlas podria dificultar rollback o inspeccion forense.

## 11. Drift filesystem vs runtime

Evidencia Git local:

- `git rev-parse HEAD`: `93bdfde0334960adba279bbe66233a1f25701f8e`
- Rama: `GsentinelH`
- `git status --short`: 241 entradas.
- `git diff --name-only`: 80 archivos modificados unstaged.
- `git diff --cached --name-only`: 0 archivos staged.
- `git ls-files --others --exclude-standard`: 463 untracked.

Conclusion: el filesystem actual contiene cambios locales que no estan necesariamente dentro de ninguna imagen viva. Como las imagenes fueron horneadas y no hay bind mounts de codigo para frontend/api/brain/gateway/MetaBrain services, esos cambios locales no impactan automaticamente el runtime.

Excepcion operacional: `gs_outbox_scheduler` monta `./scripts:/app/scripts:ro`; por lo tanto los cambios locales en `scripts` pueden afectar ese container si el proceso lee esos archivos desde el mount durante ejecucion o en reinicios internos del proceso. No se modifico ni reinicio nada para comprobar comportamiento.

## 12. Drift git HEAD vs runtime

HEAD actual: `93bdfde0334960adba279bbe66233a1f25701f8e` (`docs(runtime): add runtime integration commit report`).

No existe label de commit Git en imagenes custom. Por lo tanto:

- No se puede afirmar que ninguna imagen viva corresponda exactamente a `HEAD`.
- No se puede afirmar que los builds vivos sean reproducibles desde el worktree actual, porque hay cambios locales masivos.
- Si se reconstruye ahora desde el filesystem actual, el resultado probablemente no sera identico a las imagenes vivas de 2026-05-08/2026-05-09.

## 13. Servicios reproducibles

Reproducibles desde declaracion Docker/Compose, pero no bit-a-bit verificables contra Git:

- `frontend`: compose declara contexto `./medical-agenda-saas` y Dockerfile `Dockerfile`; imagen viva coincide con tag local `latest`.
- `api`: contexto `.`, Dockerfile `docker/api.Dockerfile`; imagen viva coincide con tag local `latest`.
- `brain`: contexto `.`, Dockerfile `docker/brain.Dockerfile`; imagen viva coincide con tag local `latest`.
- `gateway`: contexto `.`, Dockerfile `docker/gateway.Dockerfile`; imagen viva coincide con tag local `latest`.
- `inference-service`: contexto `.`, Dockerfile `docker/inference-service.Dockerfile`; imagen viva coincide con tag local `latest`.
- `nlg-service`: contexto `.`, Dockerfile `docker/nlg-service.Dockerfile`; imagen viva coincide con tag local `latest`.

Reproducibilidad limitada por falta de:

- label Git commit,
- digest remoto,
- SBOM,
- build args/version lock embebidos,
- worktree limpio.

## 14. Servicios no reproducibles

No reproducibles de forma confiable sin trabajo adicional:

- `decision-service`: container corre una imagen sin tag local que no coincide con `gsentinelhealthos-decision-service:latest`.
- `dialogue-engine`: container corre una imagen sin tag local que no coincide con `gsentinelhealthos-dialogue-engine:latest`.
- `outbox_scheduler`: container corre una imagen sin tag local que no coincide con `gsentinelhealthos-outbox_scheduler:latest` y ademas monta `./scripts` en runtime.
- `booking_worker_0`: container corre una imagen sin tag local que no coincide con `gsentinelhealthos-booking_worker_0:latest`.
- `booking_worker_1`: container corre una imagen sin tag local que no coincide con `gsentinelhealthos-booking_worker_1:latest`.

## 15. Riesgos criticos

- `latest` inconsistente: recrear servicios afectados podria cambiar el codigo ejecutado aunque el operador crea que esta preservando runtime actual.
- Falta de commit labels: no hay trazabilidad directa de imagen a Git commit.
- Worktree sucio: un rebuild futuro desde filesystem actual no representa necesariamente el runtime vivo.
- Imagenes activas sin tag: un cleanup/prune podria eliminar evidencia necesaria para rollback o comparacion.

## 16. Riesgos moderados

- Imagenes legacy de `medical-agenda-saas-*` pueden inducir confusion operacional.
- Tags legacy con guion y tags actuales con underscore conviven (`booking-worker-*` vs `booking_worker_*`, `outbox-scheduler` vs `outbox_scheduler`).
- Migrate images existen pero no estan activas; no deben tratarse como basura sin revisar flujo de migraciones.
- Multiples volumes locales no activos o de labs previos requieren inventario antes de limpieza.

## 17. Riesgos de cleanup

No ejecutar `docker image prune`, `docker system prune`, ni borrado manual sin plan porque:

- Hay imagenes dangling actualmente usadas por contenedores vivos.
- Hay volumes que podrian contener datos persistentes de runtime, labs o stacks legacy.
- Hay imagenes migrate/inactivas que podrian ser necesarias para procedimientos controlados.
- Las imagenes legacy pueden ser evidencia de estados anteriores.

Volumes observados relevantes:

- Activos por compose: `gsentinelhealthos_postgres_data`, `gsentinelhealthos_redis_master_data`, `gsentinelhealthos_redis_replica_data`, `gsentinelhealthos_uploads_data`.
- Posibles legacy/lab: `gsentinel_precanary_lab_postgres_data`, `gsentinel_runtime_lab_postgres_data`, `medical-agenda-saas_medical_agenda_postgres_data`, `database_gsentinel_postgres_data`, multiples IDs anonimos.

## 18. Riesgos de rebuild

Un rebuild inmediato desde el filesystem actual podria incorporar:

- cambios unstaged en backend, Dockerfiles, compose, frontend y MetaBrain,
- archivos no trackeados,
- cambios en `medical-agenda-saas/package.json` y `package-lock.json`,
- cambios en `requirements.txt` o requirements de servicios,
- cambios en Dockerfiles ya modificados localmente.

Sin worktree limpio y sin etiqueta de commit, un rebuild no seria comparable con el runtime activo.

## 19. Riesgos de deploy

Un deploy/recreate futuro puede:

- reemplazar `decision-service`, `dialogue-engine`, workers y scheduler por los tags `latest` locales mas nuevos,
- alterar comportamiento de colas/scheduler sin cambio visible en Git,
- perder la capacidad de inspeccionar imagenes vivas antiguas si se limpia antes,
- activar cambios locales no revisados si el deploy construye desde el filesystem actual.

## 20. Recomendacion tecnica futura sin ejecutar cambios

Antes de cualquier cleanup, rebuild o deploy:

1. Congelar evidencia: exportar `docker inspect` de contenedores vivos e image IDs vivos, especialmente los 5 que no coinciden con `latest`.
2. Crear tags forenses locales para las imagenes vivas sin tag, con nombres fechados y no ambiguos.
3. Limpiar/ordenar Git en una rama controlada antes de reconstruir.
4. Incorporar labels de build: `org.opencontainers.image.revision`, `org.opencontainers.image.created`, `org.opencontainers.image.source`.
5. Evitar `latest` como fuente de verdad operacional; usar tags con commit corto o timestamp.
6. Probar en lab los `latest` no desplegados antes de recrear `decision-service`, `dialogue-engine`, workers y scheduler.
7. Documentar explicitamente que `Panel GSentinelHS` no participa del runtime actual y que el frontend real proviene de `medical-agenda-saas`.

## Evidencia de no modificacion

Durante esta auditoria se ejecutaron comandos de inspeccion Docker/Git/filesystem y se genero este reporte. No se ejecutaron comandos de reinicio, rebuild, deploy, checkout, commit, prune, borrado, cambio de tags, edicion de `.env`, ni modificacion de runtime.
