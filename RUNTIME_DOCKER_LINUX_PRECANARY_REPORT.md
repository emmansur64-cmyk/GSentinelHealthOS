# RUNTIME DOCKER LINUX PRECANARY REPORT

Fecha: 2026-05-12
Scope: validacion production-like en entorno aislado Docker/Linux.
Objetivo: confirmar seguridad de runtime para canary SIN deploy productivo.

## 1) Diagnostico final

Resultado del hallazgo previo:
- El timeout de startup DB en multi-proceso quedo corregido con retry bounded + backoff + jitter + timeout explicito.
- El bloqueo WinError 10022 es de Windows nativo (socket-sharing/spawn de uvicorn), no de runtime DB.
- En Docker/Linux el modelo multi-worker arranca estable.

Evidencia directa (logs contenedor API):
- `Started parent process [1]`
- `Started server process [8]`
- `Started server process [9]`
- `SELECT 1` concurrente en ambos workers
- `Application startup complete` en ambos workers

## 2) Riesgos reales restantes

1. Healthcheck del `docker/api.Dockerfile` valida readiness sin exigir status code 200 (posible falso positivo en otros escenarios).
2. Inicializacion de engine DB sigue en import-time por proceso (aceptable en Linux con mitigaciones actuales, pero puede amplificar conexion inicial en escalados altos).
3. Metricas in-memory/event bus son per-worker (no globales).
4. Tabla `notification_outbox` no existe en DB lab aislada (readiness retorna `status=ready` con `outbox.status=unknown`; esperado para este laboratorio).

## 3) Diferencias Windows vs Linux

Windows nativo:
- `uvicorn --workers N` puede fallar con `WinError 10022` por modelo spawn/socket sharing.
- No bloquea produccion Linux/Docker.

Linux/Docker:
- Multiproceso real de uvicorn funcional.
- Startup concurrente DB estable con fix aplicado.
- Lifecycle y reinicios del servicio correctos.

## 4) Estado multi-worker

Estado: OK (Linux/Docker)

Evidencia:
- Contenedor API iniciado con `--workers 2`.
- Workers detectados en logs (`[8]` y `[9]`).
- Startup/lifespan exitoso en ambos workers.

## 5) Estado DB pool

Configuracion validada en lab:
- `DATABASE_POOL_SIZE=2`
- `DATABASE_CONNECT_TIMEOUT_SECONDS=20`
- Retry bounded + backoff + jitter en validacion startup DB.

Pruebas:
- `SELECT 1` concurrente en startup multi-worker: OK.
- Caida DB simulada (`docker stop postgres`) y recuperacion (`docker start postgres`): readiness recupera 200 al volver DB.

Evidencia:
- During DB down: excepciones en readiness (esperado).
- After DB start: primer intento de readiness vuelve a 200.

## 6) Estado Redis

- Redis aislado docker conectado (`redis_connected=true` en readiness).
- No se realizaron llamadas a providers externos.
- No se activo IA clinica.

## 7) Estado graceful shutdown

Estado: OK

Evidencia:
- `Shutting down`
- `Waiting for application shutdown`
- `Application shutdown complete`
- `Finished server process [...]`
- `Stopping parent process [1]`

Adicional:
- Se agrego cierre explicito del engine DB en shutdown (`close_async_database_runtime()`), invocado desde `shutdown_runtime_checks`.

## 8) Estado metrics/event bus

Hallazgo clave:
- Event bus y contadores en memoria son per-worker.
- No hay agregacion global nativa entre workers.
- Queue depths basadas en Redis si son globales.

Conclusiones operativas:
- Para canary inicial, es aceptable operar con metrica per-worker + señales globales Redis.
- Para SLO global estricto, se requiere agregador compartido (Redis INCRBY / Prometheus / stream).

## 9) Riesgos de canary

Riesgo bajo/medio:
1. Falso positivo potencial en healthcheck de imagen base (mitigado en compose pre-canary por healthcheck de liveness con status 200 estricto).
2. Falta de agregacion global de metricas in-memory (no bloqueante para canary inicial controlado).
3. DB lab sin outbox schema completo (no bloqueante para objetivo runtime).

## 10) Evidencia operativa resumida

Comandos clave ejecutados:
- `docker compose -f docker-compose.precanary-lab.yml up -d --build --wait`
- `docker compose -f docker-compose.precanary-lab.yml logs --tail=200 api_precanary_lab`
- `python -c <load liveness 120 req, concurrencia 12>`
- `docker stop gsentinel_postgres_precanary_lab`
- `docker start gsentinel_postgres_precanary_lab`
- `docker compose -f docker-compose.precanary-lab.yml restart api_precanary_lab`
- `docker compose -f docker-compose.precanary-lab.yml down`

Resultados:
- Liveness: 200 estable.
- Readiness: 200 con header interno, redis conectado.
- Carga controlada (liveness, 120 req, C=12):
  - p50: 40.17 ms
  - p95: 223.96 ms
  - p99: 237.27 ms
  - errores: 0 (120/120 status 200)
- Sin listeners residuales tras teardown en 18090/55433/56380.

## 11) Veredicto y proximo paso seguro

Veredicto: **PRE-CANARY READY (Linux/Docker)**

Se cumple evidencia real de:
- multi-worker Linux/Docker estable,
- startup concurrente estable,
- readiness/liveness confiables,
- shutdown limpio,
- recuperacion segura del servicio y reconexion DB,
- sin timeouts DB en escenario validado,
- sin workers colgados observados en pruebas funcionales.

Siguiente paso seguro:
1. Ejecutar canary controlado en Linux (no Windows nativo) con observabilidad reforzada.
2. Mantener `DATABASE_POOL_SIZE` conservador por worker durante canary.
3. Planificar fase posterior de metricas globales si se exige agregacion cross-worker estricta.
