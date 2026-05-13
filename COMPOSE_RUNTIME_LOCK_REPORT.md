# COMPOSE RUNTIME LOCK REPORT

Fecha: 2026-05-12  
Modo: snapshot documental sin cambios operacionales  
Compose project observado: `gsentinelhealthos`  
Compose activo observado: `E:\GSentinelHealthOS\docker-compose.yml`  
Archivo lock documental generado y luego movido a: `docs/runtime-evidence/docker-compose.runtime-lock.yml`

Nota de correccion de ambiguedad: el lock documental ya no queda en la raiz del proyecto. El unico compose operativo valido sigue siendo `E:\GSentinelHealthOS\docker-compose.yml`.

## 1. Runtime congelado documentado

Se documento el runtime vivo actual de 17 containers activos. El lock documental registra:

- service name,
- container name,
- image/tag exacta documental,
- image ID real observado,
- digest si existe,
- puertos,
- red,
- mounts relevantes,
- command observado o redactado cuando contenia secretos,
- restart policy,
- estado y health.

Este archivo es solo de trazabilidad. No reemplaza ni modifica `docker-compose.yml`. No debe usarse con `docker compose up`, `docker compose down`, `docker compose build` ni ningun deploy.

## 2. Servicios protegidos

Los cinco servicios con drift confirmado entre runtime real y `latest` fueron documentados usando tags canonicos:

| Service | Container | Canonical tag usado |
|---|---|---|
| `outbox_scheduler` | `gs_outbox_scheduler` | `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` |
| `booking_worker_0` | `gs_booking_worker_0` | `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` |
| `booking_worker_1` | `gs_booking_worker_1` | `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` |
| `decision-service` | `gs_decision_service` | `gsentinelhealthos/decision-service:runtime-canonical-20260512` |
| `dialogue-engine` | `gs_dialogue_engine` | `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` |

## 3. Tags canonicos usados

Validacion previa:

- Cada tag canonico existe localmente.
- Cada tag canonico apunta al mismo image ID que el container vivo correspondiente.
- Ningun `latest` critico fue usado para los cinco servicios protegidos dentro del lock documental.

| Canonical tag | Image ID validado |
|---|---|
| `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` |
| `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` |
| `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` |
| `gsentinelhealthos/decision-service:runtime-canonical-20260512` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` |
| `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` |

## 4. Image IDs reales

| Service | Container | Real image ID |
|---|---|---|
| `frontend` | `gs_frontend` | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` |
| `api` | `gs_api` | `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` |
| `brain` | `gs_brain` | `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` |
| `gateway` | `gs_gateway` | `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` |
| `nlg-service` | `gs_nlg_service` | `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` |
| `inference-service` | `gs_inference_service` | `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` |
| `decision-service` | `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` |
| `dialogue-engine` | `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` |
| `outbox_scheduler` | `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` |
| `booking_worker_0` | `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` |
| `booking_worker_1` | `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` |
| `db` | `gs_db` | `sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e` |
| `redis-*` | Redis master/replica/sentinels | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` |

## 5. Servicios aun usando latest

Estos servicios siguen documentados con tags `latest` porque el tag local coincide con el image ID vivo observado:

- `frontend` -> `gsentinelhealthos-frontend:latest`
- `api` -> `gsentinelhealthos-api:latest`
- `brain` -> `gsentinelhealthos-brain:latest`
- `gateway` -> `gsentinelhealthos-gateway:latest`
- `nlg-service` -> `gsentinelhealthos-nlg-service:latest`
- `inference-service` -> `gsentinelhealthos-inference-service:latest`

Upstream documentado con digest:

- `postgres:16-alpine@sha256:5c4a21411ae06f964015aa9b5447b75f686dcded73d231289b75459d7c0b490a`
- `redis:8.0.2-alpine@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b`

## 6. Riesgos abiertos

| Riesgo | Impacto | Servicio | Mitigacion futura |
|---|---|---|---|
| `latest` drift | Recreate podria cambiar codigo vivo | five critical services | Mantener tags canonicos y no usar latest |
| Rebuild accidental | Incorpora worktree actual y cambia imagenes | custom services | Rebuild solo en lab con commit fijo |
| Prune accidental | Puede perder imagenes locales o evidencia historica | all custom images | `docker save` de tags canonicos |
| `compose up --build` | Reemplazo silencioso de runtime | all build services | Prohibir hasta smoke tests |
| Perdida de imagenes locales | Dificulta rollback exacto | critical five | Exportar tar y checksum |
| Secretos en commands Redis | Riesgo de exposicion en auditorias crudas | Redis services | Mantener redaccion en reportes |

## 7. Limitaciones del compose.lock

- Es documental, no operativo.
- No debe ejecutarse con Docker Compose.
- Los comandos Redis fueron redactados para evitar exponer secretos; por eso no es un deploy artifact.
- No incluye variables de entorno reales.
- No valida conectividad ni health en tiempo de ejecucion.
- No sustituye backups de DB, Redis ni uploads.
- No garantiza reproducibilidad desde Git; solo documenta el runtime observado.

## 8. Que NO debe hacerse todavia

- No ejecutar `docker compose up`.
- No ejecutar `docker compose down`.
- No ejecutar `docker compose build`.
- No ejecutar `docker compose pull`.
- No usar `docker-compose.runtime-lock.yml` para deploy.
- No reemplazar `docker-compose.yml`.
- No editar `.env`.
- No cambiar `latest`.
- No recrear containers.
- No ejecutar prune.
- No alterar Git.

## 9. Proximos pasos seguros SIN ejecutar

1. Guardar copia externa de `docker-compose.runtime-lock.yml`.
2. Ejecutar `docker save` de los cinco tags canonicos en una ventana controlada.
3. Generar checksums SHA256 de los tar exportados.
4. Exportar `docker inspect` completo de containers e imagenes.
5. Crear un plan de smoke tests por servicio.
6. Validar los `latest` no confiables en laboratorio.
7. Preparar rollback documentado por service.
8. Recién despues evaluar cleanup selectivo con lista aprobada.

## 10. Confirmacion no-change

Durante esta fase:

- NO se modifico runtime.
- NO se hizo deploy.
- NO se recreo ningun container.
- NO se modifico `docker-compose.yml`.
- NO se edito `.env`.
- NO se tocaron tags.
- NO se hizo rebuild.
- NO se ejecuto compose up/down/build/pull.
- NO se altero Git.
