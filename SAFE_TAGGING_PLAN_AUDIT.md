# SAFE TAGGING PLAN AUDIT

Fecha: 2026-05-12  
Modo: auditoria y planificacion solamente  
Proyecto compose activo: `gsentinelhealthos`  
Compose file activo: `E:\GSentinelHealthOS\docker-compose.yml`  
Runtime activo: 17 containers  
Objetivo: preservar el runtime canonico actual sin alterar imagenes, containers ni tags.

## 1. Runtime canonico actual

El runtime canonico temporal es el conjunto de containers actualmente activos y sus image IDs reales. No debe inferirse desde `latest` para los servicios criticos stale.

| Service | Container | Current tag/ref | Real image ID | Digest | Latest match | Runtime canonical | Riesgo |
|---|---|---|---|---|---|---|---|
| frontend | `gs_frontend` | `gsentinelhealthos-frontend` | `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` | none | yes | yes | medio |
| brain | `gs_brain` | `gsentinelhealthos-brain` | `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` | none | yes | yes | medio |
| api | `gs_api` | `gsentinelhealthos-api` | `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` | none | yes | yes | medio |
| gateway | `gs_gateway` | `gsentinelhealthos-gateway` | `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` | none | yes | yes | medio |
| inference-service | `gs_inference_service` | `gsentinelhealthos-inference-service` | `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` | none | yes | yes | medio |
| nlg-service | `gs_nlg_service` | `gsentinelhealthos-nlg-service` | `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` | none | yes | yes | medio |
| outbox_scheduler | `gs_outbox_scheduler` | `gsentinelhealthos-outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | none | no | yes | critico |
| booking_worker_0 | `gs_booking_worker_0` | `gsentinelhealthos-booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | none | no | yes | critico |
| booking_worker_1 | `gs_booking_worker_1` | `gsentinelhealthos-booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | none | no | yes | critico |
| decision-service | `gs_decision_service` | `gsentinelhealthos-decision-service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | none | no | yes | critico |
| dialogue-engine | `gs_dialogue_engine` | `gsentinelhealthos-dialogue-engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | none | no | yes | critico |
| db | `gs_db` | `postgres:16-alpine` | `sha256:667495ca2ac33180ad3690178da1bf274f481d0c43849d4c1941f0176983bd2e` | `postgres@sha256:5c4a21411ae06f964015aa9b5447b75f686dcded73d231289b75459d7c0b490a` | yes | yes | alto por data |
| redis-master | `gs_redis_master` | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b` | yes | yes | alto por estado/config |
| redis-replica | `gs_redis_replica` | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b` | yes | yes | alto por estado/config |
| redis-sentinel-1 | `gs_redis_sentinel_1` | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b` | yes | yes | medio |
| redis-sentinel-2 | `gs_redis_sentinel_2` | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b` | yes | yes | medio |
| redis-sentinel-3 | `gs_redis_sentinel_3` | `redis:8.0.2-alpine` | `sha256:e74faa347ab0b6a3c1b040834a35ea5f20e3aa02460db4bb9d5b4685f3dd3baf` | `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b` | yes | yes | medio |

Source of truth temporal: los `Real image ID` de esta tabla, no los tags `latest` para los cinco servicios stale.

## 2. Imagenes que deben preservarse

Preservacion critica:

- `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` para `gs_outbox_scheduler`
- `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` para `gs_booking_worker_0`
- `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` para `gs_booking_worker_1`
- `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` para `gs_decision_service`
- `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` para `gs_dialogue_engine`

Preservacion recomendada para trazabilidad completa:

- `sha256:c1eef26b3087b1964b50f7c64ab40a4b34c0aa238732ac08600e6536afa39c2a` frontend
- `sha256:d9868f3e26bac5665211287a713e9b8d64ee14001211c74c471e1d56b30a49e7` api
- `sha256:bb85e7d49f10362835655c6612e0d9f7acdd39757ffd3f0a0d106436e4fefa00` brain
- `sha256:a9bb2547b9cbbe78c8a548ee89d665013061569fe5fb184369cb3ba593b026b8` gateway
- `sha256:0a4281800dcb607be4c2fb70fbdd37742bc55c8aa65304854cad0e03d5714d14` inference-service
- `sha256:2347f33098d8d3da63ee4156cf0f3cb3ebde5d6825bb9aaef054a8ec6d3542f2` nlg-service

Upstream con digest ya disponible:

- Postgres: `postgres@sha256:5c4a21411ae06f964015aa9b5447b75f686dcded73d231289b75459d7c0b490a`
- Redis: `redis@sha256:48501c5ad00d5563bc30c075c7bcef41d7d98de3e9a1e6c752068c66f0a8463b`

## 3. Image IDs criticas

Las cinco image IDs criticas no tienen repo digest y no coinciden con `latest`. Si se pierde la referencia container o se ejecuta cleanup agresivo, se pierde la capacidad sencilla de recrear exactamente ese runtime.

| Container | Image ID critica | Por que es critica |
|---|---|---|
| `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | Scheduler vivo no coincide con `latest`; ademas usa bind mount de scripts |
| `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | Worker vivo no coincide con `latest` |
| `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | Worker vivo no coincide con `latest` |
| `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | Servicio MetaBrain vivo no coincide con `latest` |
| `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | Servicio MetaBrain vivo no coincide con `latest` |

## 4. Tags latest no confiables

| Tag `latest` local | ID apuntado por latest | ID real vivo | Evaluacion |
|---|---|---|---|
| `gsentinelhealthos-outbox_scheduler:latest` | `sha256:33778722e6f67a2d33a905e265b70cde4aea88a591e22522e8edf000330d69c2` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | no confiable para runtime |
| `gsentinelhealthos-booking_worker_0:latest` | `sha256:78ad8bc25f175d4fc0851ebcfd81d8eb401acd14f5cad993102a3706b3e861c1` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | no confiable para runtime |
| `gsentinelhealthos-booking_worker_1:latest` | `sha256:472abe98d9d437ab4021a32767ff634a6472563634c0c070a3a42cc5b4ff8b81` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | no confiable para runtime |
| `gsentinelhealthos-decision-service:latest` | `sha256:0a17e788c1e98143acdfad27bdd65cf21ea1d0b15247adc35376dfdb39c6908f` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | no confiable para runtime |
| `gsentinelhealthos-dialogue-engine:latest` | `sha256:78f758ad1056d22d6f0cf548ccbfc73a08f61dfb761bdc65dd4caa398c5e9036` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | no confiable para runtime |

## 5. Naming strategy recomendada

Convencion recomendada: usar un namespace local claro, fechado, sin sobrescribir `latest`.

Formato:

`gsentinelhealthos/<service>:runtime-canonical-20260512`

Para evitar ambiguedad entre servicios con guion/underscore, el nombre del service debe copiar exactamente el service de compose:

- `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512`
- `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512`
- `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512`
- `gsentinelhealthos/decision-service:runtime-canonical-20260512`
- `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512`

Tags opcionales secundarios, solo despues de aplicar el principal:

- `gsentinelhealthos/<service>:rollback-safe-20260512`
- `gsentinelhealthos/<service>:pre-stabilization-runtime`

No recomendado:

- Reusar `latest`.
- Usar nombres genericos como `backup`, `old`, `stable`.
- Taggear solo por container name si difiere del service compose.
- Crear tags que oculten la diferencia entre `booking_worker_0` y `booking-worker-0`.

Razon de esta estrategia:

- No pisa `latest`.
- Deja claro que es runtime observado, no build validado nuevo.
- Facilita rollback por service.
- Reduce confusion con imagenes legacy.
- Permite construir un futuro `compose.lock` con referencias estables.

## 6. Riesgos operacionales

- `latest` no representa el runtime de cinco servicios criticos.
- Un operador podria ejecutar `docker compose up -d` y provocar recreacion con imagen distinta.
- Un `docker compose up -d --build` incorporaria el worktree actual, que esta sucio.
- Un cleanup podria eliminar imagenes sin tag que siguen siendo la unica referencia exacta del runtime canonico.
- Las imagenes custom no tienen digest remoto ni labels Git suficientes para reconstruccion forense exacta.

Nivel de riesgo actual: critico para los cinco servicios stale; alto para estabilidad general hasta crear tags canonicos y backup.

## 7. Riesgos de prune

| Accion | Impacto potencial |
|---|---|
| `docker image prune` | Puede remover imagenes dangling no usadas por containers detenidos; riesgo aumenta si antes se recrea o elimina un container critico |
| `docker system prune` | Riesgo alto de perder evidencia, caches, networks/containers detenidos e imagenes no referenciadas |
| `docker image prune -a` | Riesgo critico: podria borrar imagenes no taggeadas o no referenciadas por tags estables |
| `docker volume prune` | Riesgo critico para datos si hay volumes clasificados incorrectamente |

Las cinco imagenes criticas estan protegidas solo mientras los containers vivos sigan referenciandolas. Esa proteccion es insuficiente para una estabilizacion formal.

## 8. Riesgos de rebuild

Un rebuild futuro sin limpieza Git puede:

- incorporar cambios locales no revisados,
- cambiar dependencias,
- cambiar Dockerfiles modificados,
- producir imagenes que no se parezcan al runtime actual,
- reemplazar accidentalmente tags `latest` ya inconsistentes.

No ejecutar rebuild hasta tener:

- tags canonicos creados,
- backup/export de imagenes criticas,
- worktree controlado,
- plan de smoke tests,
- rollback probado.

## 9. Riesgos de deploy

Un deploy/recreate podria:

- reemplazar scheduler, workers, decision-service y dialogue-engine por `latest` no equivalente,
- alterar comportamiento de colas, decisiones MetaBrain o dialogo,
- dificultar rollback si las imagenes antiguas quedan sin tag,
- activar builds no desplegados como `api_precanary_lab` por error operacional.

## 10. Riesgos de recreacion de containers

Containers que no deben recrearse todavia:

- `gs_outbox_scheduler`
- `gs_booking_worker_0`
- `gs_booking_worker_1`
- `gs_decision_service`
- `gs_dialogue_engine`

Razon: cada uno corre una image ID distinta del tag `latest` local. Recreate no es una operacion neutra para ellos.

## 11. Estrategia futura de tagging

Plan propuesto, sin ejecutar:

1. Reconfirmar `docker ps --no-trunc` y `docker inspect` inmediatamente antes de taggear.
2. Crear tags canonicos por image ID, no por `latest`.
3. Usar formato `gsentinelhealthos/<service>:runtime-canonical-20260512`.
4. Para cada tag, verificar con `docker image inspect` que apunta al image ID esperado.
5. Documentar en un `compose.lock` manual cada service -> image canonical tag -> sha256.
6. No cambiar `latest` en esta fase.
7. No recrear containers en esta fase.

Comandos futuros sugeridos, NO ejecutados:

```powershell
docker tag sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901 gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512
docker tag sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4 gsentinelhealthos/booking_worker_0:runtime-canonical-20260512
docker tag sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2 gsentinelhealthos/booking_worker_1:runtime-canonical-20260512
docker tag sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7 gsentinelhealthos/decision-service:runtime-canonical-20260512
docker tag sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5 gsentinelhealthos/dialogue-engine:runtime-canonical-20260512
```

Tambien se recomienda taggear los servicios coincidentes para snapshot completo, pero la prioridad inmediata son los cinco criticos.

## 12. Estrategia futura de rollback

Rollback futuro recomendado:

1. Usar tags canonicos, no `latest`.
2. Mantener tabla service -> tag canonico -> image ID.
3. Crear compose lock separado que use tags canonicos.
4. Probar rollback en entorno lab antes de tocar runtime principal.
5. Documentar healthcheck esperado por servicio.
6. Para DB/Redis, rollback de imagen no sustituye backup de datos; los volumes requieren estrategia propia.

## 13. Estrategia futura de backup

Antes de cualquier deploy o cleanup:

1. Exportar inspect completo de containers e imagenes.
2. Guardar `docker compose config` y `docker compose ps`.
3. Crear tags canonicos.
4. Ejecutar `docker save` de las cinco imagenes criticas hacia archivos versionados fuera del runtime.
5. Guardar checksums de esos tar.
6. Respaldar volumes persistentes de DB/Redis/uploads con procedimiento separado.

Comando conceptual futuro, NO ejecutado:

```powershell
docker save -o runtime-canonical-20260512-critical-images.tar `
  gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512 `
  gsentinelhealthos/booking_worker_0:runtime-canonical-20260512 `
  gsentinelhealthos/booking_worker_1:runtime-canonical-20260512 `
  gsentinelhealthos/decision-service:runtime-canonical-20260512 `
  gsentinelhealthos/dialogue-engine:runtime-canonical-20260512
```

## 14. Acciones prohibidas temporales

Hasta que se apliquen tags canonicos y backup:

- NO ejecutar `docker tag`.
- NO ejecutar `docker compose up -d`.
- NO ejecutar `docker compose up -d --build`.
- NO ejecutar `docker compose build`.
- NO ejecutar `docker compose down`.
- NO ejecutar `docker compose pull`.
- NO ejecutar `docker image prune`.
- NO ejecutar `docker system prune`.
- NO ejecutar `docker image rm`.
- NO borrar containers.
- NO recrear containers.
- NO editar compose.
- NO editar `.env`.
- NO hacer rebuild.
- NO hacer deploy.
- NO cambiar `latest`.
- NO alterar Git.

## 15. Plan futuro sugerido SIN EJECUTAR

1. Exportar reporte final de runtime y tagging plan.
2. Backup de `docker-compose.yml` y resultado de `docker compose config`.
3. Backup de image IDs reales y metadata `docker inspect`.
4. Crear tags canonicos para las cinco imagenes criticas.
5. Verificar tags contra image IDs exactos.
6. Ejecutar `docker save` opcional de tags canonicos.
7. Generar `compose.lock` manual con tags canonicos.
8. Mantener `latest` congelado: no confiar en `latest` ni sobrescribirlo.
9. Ejecutar smoke tests en entorno separado.
10. Preparar estrategia rollback por servicio.
11. Solo despues, planear estabilizacion/recreate selectivo si pasa validacion.

## 16. Confirmacion no-change

Durante esta auditoria:

- NO se ejecuto `docker tag`.
- NO se modificaron imagenes.
- NO se recrearon containers.
- NO se hizo rebuild.
- NO se hizo deploy.
- NO se ejecuto `docker compose up/down`.
- NO se borraron imagenes.
- NO se borraron containers.
- NO se edito compose.
- NO se edito `.env`.
- NO se cambio `latest`.
- NO se altero Git.
