# RUNTIME CANONICAL TAG EXECUTION

Fecha/hora local: 2026-05-12 19:08:53 -03:00  
Proyecto compose: `gsentinelhealthos`  
Operacion ejecutada: tagging canonico controlado de imagenes vivas  
Alcance: 5 containers criticos stale  
Runtime alterado: no

## 1. Containers protegidos

Se protegieron con tags canonicos las imagenes exactas actualmente usadas por:

- `gs_outbox_scheduler`
- `gs_booking_worker_0`
- `gs_booking_worker_1`
- `gs_decision_service`
- `gs_dialogue_engine`

## 2. Image IDs protegidas

| Container | Image ID protegida |
|---|---|
| `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` |
| `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` |
| `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` |
| `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` |
| `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` |

## 3. Tags creados

Se crearon los siguientes tags. No se uso ni se modifico `latest`.

| Image ID | Canonical tag creado |
|---|---|
| `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` |
| `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` |
| `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` |
| `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `gsentinelhealthos/decision-service:runtime-canonical-20260512` |
| `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` |

## 4. Validacion pre-tag

Antes de taggear se verifico:

- Los cinco containers existian y estaban `running`.
- Los image IDs activos coincidian exactamente con los hashes canonicos esperados.
- Los tags canonicos de destino no existian.
- No habia necesidad de sobrescribir ningun tag.

Resultado pre-tag:

| Container | Expected image ID | Actual image ID | Match | StartedAt pre-tag | Health |
|---|---|---|---|---|---|
| `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | same | yes | `2026-05-12T13:25:23.53324078Z` | none |
| `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | same | yes | `2026-05-12T13:25:23.411202158Z` | none |
| `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | same | yes | `2026-05-12T13:25:23.435610272Z` | none |
| `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | same | yes | `2026-05-12T13:25:23.308665088Z` | healthy |
| `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | same | yes | `2026-05-12T13:25:23.212652576Z` | healthy |

## 5. Validacion post-tag

Se valido con `docker image inspect` que cada tag canonico nuevo apunta al image ID esperado:

| Canonical tag | Expected ID | Actual ID | Match |
|---|---|---|---|
| `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | same | yes |
| `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | same | yes |
| `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | same | yes |
| `gsentinelhealthos/decision-service:runtime-canonical-20260512` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | same | yes |
| `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | same | yes |

## 6. Confirmacion de runtime intacto

Validacion posterior sobre containers:

| Container | Container ID | Image ID post-tag | StartedAt post-tag | Status | Health | Ports | Network |
|---|---|---|---|---|---|---|---|
| `gs_outbox_scheduler` | `6be8bf2cad17...` | `sha256:98cb722fbe069...` | `2026-05-12T13:25:23.53324078Z` | running | none | none | `gsentinelhealthos_gs_prod` |
| `gs_booking_worker_0` | `916b747b913e...` | `sha256:cd2a08c7b2ab...` | `2026-05-12T13:25:23.411202158Z` | running | none | none | `gsentinelhealthos_gs_prod` |
| `gs_booking_worker_1` | `9e9998599202...` | `sha256:d713bb4e4f665...` | `2026-05-12T13:25:23.435610272Z` | running | none | none | `gsentinelhealthos_gs_prod` |
| `gs_decision_service` | `d41e5def3282...` | `sha256:dd886d9ee4ec...` | `2026-05-12T13:25:23.308665088Z` | running | healthy | `127.0.0.1:8012->8012/tcp` | `gsentinelhealthos_gs_prod` |
| `gs_dialogue_engine` | `8fe59e633525...` | `sha256:0bfd3f9b1643...` | `2026-05-12T13:25:23.212652576Z` | running | healthy | `127.0.0.1:8010->8010/tcp` | `gsentinelhealthos_gs_prod` |

Conclusion:

- Containers no fueron recreados.
- `StartedAt` no cambio.
- Image IDs runtime no cambiaron.
- Puertos no cambiaron.
- Network no cambio.
- No se ejecuto compose.
- No se modifico `latest`.

## 7. Matriz de proteccion

| Service | Container | Real image ID | Old tag/ref | New canonical tag | Runtime safe | Latest trusted | Risk level |
|---|---|---|---|---|---|---|---|
| outbox_scheduler | `gs_outbox_scheduler` | `sha256:98cb722fbe069...` | `gsentinelhealthos-outbox_scheduler` | `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` | yes | no | critico mitigado parcialmente |
| booking_worker_0 | `gs_booking_worker_0` | `sha256:cd2a08c7b2ab...` | `gsentinelhealthos-booking_worker_0` | `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` | yes | no | critico mitigado parcialmente |
| booking_worker_1 | `gs_booking_worker_1` | `sha256:d713bb4e4f665...` | `gsentinelhealthos-booking_worker_1` | `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` | yes | no | critico mitigado parcialmente |
| decision-service | `gs_decision_service` | `sha256:dd886d9ee4ec...` | `gsentinelhealthos-decision-service` | `gsentinelhealthos/decision-service:runtime-canonical-20260512` | yes | no | critico mitigado parcialmente |
| dialogue-engine | `gs_dialogue_engine` | `sha256:0bfd3f9b1643...` | `gsentinelhealthos-dialogue-engine` | `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` | yes | no | critico mitigado parcialmente |

## 8. Riesgos restantes

- Los tags `latest` de estos cinco servicios siguen sin representar el runtime real.
- El compose actual no usa todavia los tags canonicos.
- No se genero `compose.lock`.
- No se hizo `docker save` de las imagenes canonicas.
- No se tocaron volumes ni se hizo backup de datos.
- Rebuild/recreate sigue prohibido hasta validacion formal.

## 9. Proximos pasos recomendados SIN ejecutar

1. Generar un `compose.lock` manual apuntando a los tags canonicos.
2. Exportar metadata completa con `docker inspect` de imagenes y containers.
3. Ejecutar `docker save` de los cinco tags canonicos para backup offline.
4. Definir smoke tests por servicio antes de cualquier recreate.
5. Validar en lab los `latest` no confiables antes de decidir si reemplazan al runtime.
6. Recién despues evaluar cleanup selectivo, nunca `prune` amplio.

## 10. Restricciones finales

Continua prohibido:

- `docker compose up`
- `docker compose build`
- `docker compose pull`
- `docker compose down`
- `docker system prune`
- `docker image prune`
- `docker container rm`
- rebuild
- redeploy
- recreacion manual
- cambios compose
- cambios env
- cambios Git

## 11. Confirmacion final

- NO se recreo ningun container.
- NO se hizo rebuild.
- NO se hizo deploy.
- NO se tocaron tags `latest`.
- NO se modifico compose.
- NO se edito `.env`.
- NO se borro ninguna imagen.
- NO se borro ningun container.
- NO se ejecuto prune.
- NO se altero Git.
