# GHOST PROCESS FINAL AUDIT REPORT

Generated: 2026-05-18 23:59:23 -03:00
Evidence files:
- GHOST_PROCESS_FILE_CHANGE_SNAPSHOT.md
- SYSTEM_GUARD_BRAIN_CODE_AUDIT.md
- HOST_BACKGROUND_PROCESS_AUDIT.md
- DOCKER_BACKGROUND_PROCESS_AUDIT.md
- LIVE_FILE_WRITE_MONITOR_REPORT.md

## Phase 6 - Classification Table

| PID/ID | container | command | user | touches path | writes code/data | classification | should stop | should isolate |
|---|---|---|---|---|---|---|---|---|
| n/a | gsentinel_redis_precanary_lab | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_frontend | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_brain | "python brain/main.py" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_api | "uvicorn api.app.mai…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_redis_sentinel_1 | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_redis_replica | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_db | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_redis_master | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_panel_admin | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_grafana | "/run.sh" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_promtail | "/usr/bin/promtail -…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_outbox_scheduler | "python scripts/run_…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_gateway | "uvicorn whatsapp_ga…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_loki | "/usr/bin/loki -conf…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_nlg_service | "uvicorn services.nl…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_prometheus | "/bin/prometheus --c…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_dialogue_engine | "uvicorn services.di…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_booking_worker_1 | "python -m api.app.b…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_inference_service | "uvicorn services.in…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_decision_service | "uvicorn services.de…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_booking_worker_0 | "python -m api.app.b…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_redis_sentinel_2 | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |
| n/a | gs_redis_sentinel_3 | "docker-entrypoint.s…" | container-default | repo bind mounts per inspect (see docker report) | unknown-from-logs | legitimo runtime (pending deeper per-container fs audit) | NO (per current protocol) | YES (restrict writes + RO mounts for code) |

## Phase 7 - Explicit Answers
1. Existe System Guard?
- No evidencia concluyente de entidad explícita con ese nombre en procesos detectados.
- Ver coincidencias textuales de código en SYSTEM_GUARD_BRAIN_CODE_AUDIT.md.

2. Existe System Brain?
- Sí existe referencia funcional a rain como servicio/componente runtime (contenedor gs_brain).
- No evidencia concluyente de un proceso separado llamado literalmente System Brain auto-modificando código.

3. Están corriendo?
- gs_brain y gs_api aparecen en docker ps (ver DOCKER_BACKGROUND_PROCESS_AUDIT.md).

4. Qué carpetas tocan?
- Potencialmente rutas montadas en contenedores según docker inspect (ver reporte Docker).
- Monitoreo en vivo 60s en MB-Chat/MB-Secretaria/MB-Whatsapp: ver LIVE_FILE_WRITE_MONITOR_REPORT.md.

5. Escriben código o datos?
- No hay evidencia concluyente en logs de escritura explícita de código.
- Clasificación actual: indeterminado sin auditoría de syscall/fs por contenedor.

6. Hay proceso externo/desconocido?
- En host se observaron procesos de sistema y runtime esperado; no surgió firma inequívoca de proceso fantasma con naming guard/brain watcher.

7. Hay watchers de desarrollo corriendo en VPS?
- No evidencia concluyente en host reportado; revisar coincidencias de watch/chokidar en código y comandos activos de contenedores.

8. La IA puede auto-modificar código actualmente?
- Riesgo potencial si contenedores tienen mounts RW sobre código + procesos con capacidades de escritura.
- Evidencia directa de auto-modificación en ventana de 60s: ver reporte live; no concluyente global sin más tiempo de observación.

9. Qué hay que apagar o aislar?
- Aislar primero (sin apagar aún):
  - mounts de código en modo read-only para servicios no compiladores,
  - desactivar watchers dev en entornos VPS,
  - segmentar permisos de escritura a carpetas de datos únicamente.

10. Decisión
- GO CON RESTRICCIONES
- Motivo: no se obtuvo prueba definitiva de proceso fantasma escribiendo código en la ventana observada, pero sí existe superficie de riesgo runtime que debe aislarse.

## Evidence Notes
- Este informe no elimina, no mata procesos, no resetea, no deploya, no toca DB/Redis.
- Toda evidencia cruda está en los 5 archivos .md listados arriba.
