# DOCKER SAVE RUNTIME BACKUP REPORT

Fecha/hora backup: 2026-05-12  
Modo: backup/export mediante `docker save`, sin cambios de runtime  
Compose project: `gsentinelhealthos`  
Compose activo confirmado: `E:\GSentinelHealthOS\docker-compose.yml`  
Carpeta backup: `E:\GSentinelHealthOS\backups\docker-runtime-20260512`

## 1. Imagenes exportadas

Se exportaron cinco imagenes canonicas, una por archivo `.tar`, usando exclusivamente tags `runtime-canonical-20260512`.

| Servicio | Container | Tag canonico usado | Image ID | Archivo tar | Tamano |
|---|---|---|---|---|---|
| `outbox_scheduler` | `gs_outbox_scheduler` | `gsentinelhealthos/outbox_scheduler:runtime-canonical-20260512` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `images/outbox_scheduler-runtime-canonical-20260512.tar` | 1.068 GB |
| `booking_worker_0` | `gs_booking_worker_0` | `gsentinelhealthos/booking_worker_0:runtime-canonical-20260512` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `images/booking_worker_0-runtime-canonical-20260512.tar` | 1.068 GB |
| `booking_worker_1` | `gs_booking_worker_1` | `gsentinelhealthos/booking_worker_1:runtime-canonical-20260512` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `images/booking_worker_1-runtime-canonical-20260512.tar` | 1.068 GB |
| `decision-service` | `gs_decision_service` | `gsentinelhealthos/decision-service:runtime-canonical-20260512` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `images/decision-service-runtime-canonical-20260512.tar` | 0.386 GB |
| `dialogue-engine` | `gs_dialogue_engine` | `gsentinelhealthos/dialogue-engine:runtime-canonical-20260512` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `images/dialogue-engine-runtime-canonical-20260512.tar` | 0.387 GB |

## 2. Checksums SHA256

| Archivo tar | SHA256 |
|---|---|
| `outbox_scheduler-runtime-canonical-20260512.tar` | `0E95D35BAF618512941EA0D2C6AF721F1F2AFB1647CCAD5ADA7FF5ECAE705136` |
| `booking_worker_0-runtime-canonical-20260512.tar` | `FB871E890FE159B360D85DC9AB24610ABE9366C2F343093F74ACC89110738806` |
| `booking_worker_1-runtime-canonical-20260512.tar` | `42C33FFB03B35CF9A9FE1C2C172EA95E51FAE91B51CDF72187045CB5AF1BBE16` |
| `decision-service-runtime-canonical-20260512.tar` | `CAB1E2B231F918C5A05BACBAF6DBD4F2F40D63078523B67F27A66C939E0F8C18` |
| `dialogue-engine-runtime-canonical-20260512.tar` | `C5C76BB41342A13B7894A63E3C74E049133933E5308EE0B41AB6DF9EAB2F9236` |

## 3. Ubicacion backups

Estructura creada:

- `E:\GSentinelHealthOS\backups\docker-runtime-20260512\images`
- `E:\GSentinelHealthOS\backups\docker-runtime-20260512\manifests`
- `E:\GSentinelHealthOS\backups\docker-runtime-20260512\reports`

Manifests generados:

- `manifests/outbox_scheduler-manifest.json`
- `manifests/booking_worker_0-manifest.json`
- `manifests/booking_worker_1-manifest.json`
- `manifests/decision-service-manifest.json`
- `manifests/dialogue-engine-manifest.json`

Cada manifest incluye tag canonico, image ID, created_at, tamano Docker, container asociado, service compose, fecha export, archivo tar, tamano tar y checksum SHA256.

## 4. Validacion previa

Antes de exportar se verifico:

- Los cinco tags canonicos existian.
- Cada tag canonico apuntaba al image ID esperado.
- Cada container vivo seguia usando el mismo image ID esperado.
- Espacio disponible en `E:`: 909.26 GB.
- Los containers seguian `running`.

## 5. Validacion de integridad

Resultado:

- Los cinco archivos `.tar` existen.
- Cada archivo tiene tamano mayor a cero.
- Cada archivo tiene checksum SHA256 generado.
- Los manifests fueron generados correctamente.
- Los tags canonicos siguieron intactos.
- Los image IDs de runtime no cambiaron.
- Los `StartedAt` observados se mantuvieron iguales.

## 6. Runtime intacto

Estado post-backup:

| Container | Image ID post-backup | StartedAt | Status | Health |
|---|---|---|---|---|
| `gs_outbox_scheduler` | `sha256:98cb722fbe069b97fd6bca5bbc206545605da9528bead7427baeae57650e1901` | `2026-05-12T13:25:23.53324078Z` | running | none |
| `gs_booking_worker_0` | `sha256:cd2a08c7b2ab02b9ccc0b641786a99c8aa68c5a2228c4d3c31f20a54d03e93b4` | `2026-05-12T13:25:23.411202158Z` | running | none |
| `gs_booking_worker_1` | `sha256:d713bb4e4f6657b868b5ea197c689cd4a9e85197a25615f558401b738bf07bc2` | `2026-05-12T13:25:23.435610272Z` | running | none |
| `gs_decision_service` | `sha256:dd886d9ee4ecd9c76a01e6642a1495f6b70e03bfdd62cddb0e6f756a165592e7` | `2026-05-12T13:25:23.308665088Z` | running | healthy |
| `gs_dialogue_engine` | `sha256:0bfd3f9b1643fbb8145dfe792aa32f3b14590a354ca4506d11a65f21911d37d5` | `2026-05-12T13:25:23.212652576Z` | running | healthy |

`docker compose ls` sigue mostrando el compose activo unico:

- `E:\GSentinelHealthOS\docker-compose.yml`

## 7. Riesgos restantes

- Los `latest` de estos cinco servicios siguen sin ser la fuente confiable del runtime vivo.
- El backup cubre imagenes, no cubre volumes de DB/Redis/uploads.
- El backup no reemplaza snapshots de datos persistentes.
- Los archivos tar deben copiarse a almacenamiento externo para resiliencia real.
- No se probo restauracion con `docker load` en entorno separado.

## 8. Recomendaciones futuras

1. Copiar `backups\docker-runtime-20260512` a almacenamiento externo.
2. Guardar checksums fuera del host.
3. Probar `docker load` de los tar en un entorno lab aislado.
4. Generar backup separado de volumes persistentes.
5. Mantener prohibido `docker prune` amplio hasta validar backups.
6. No usar `latest` para los cinco servicios criticos en procesos de rollback.

## 9. Confirmacion no-change

Durante esta fase:

- NO se recreo ningun container.
- NO se reinicio ningun container.
- NO se hizo rebuild.
- NO se hizo deploy.
- NO se ejecuto `docker compose up/down/build/pull`.
- NO se modifico compose.
- NO se edito `.env`.
- NO se altero Git.
- NO se borro ninguna imagen.
- NO se borro ningun container.
- NO se ejecuto prune.
- NO se cambiaron tags.
