# RUNTIME MULTIWORKER DB REDIS LAB FINAL

Fecha: 2026-05-12

## Resumen ejecutivo

- DB/Redis lab aislados levantados y validados.
- Startup/lifespan real validado en `TestClient` con env lab explícito.
- Stress multi-worker / multi-process quedó bloqueado por timeout de conexión a PostgreSQL durante startup en modo multi-proceso.
- La limitación del event bus por proceso quedó documentada.
- Rollback/shutdown del lab quedó validado.

## DB/Redis lab

Validado con compose dedicado:
- DB: `127.0.0.1:55432`
- Redis: `127.0.0.1:56379`
- Conectividad mínima confirmada:
- `SELECT 1`
- `PING`
- `SET/GET/DEL` sintético

## Startup/lifespan

Validado en [api/tests/test_runtime_startup_lab.py](api/tests/test_runtime_startup_lab.py):
- carga explícita de `.env.runtime_lab`
- startup/shutdown OK
- root body preservado
- liveness OK
- trace/correlation propagados en eventos internos
- no provider calls para root/liveness

## Multi-worker stress

Bloqueado.

Hallazgo concreto:
- Tanto `uvicorn --workers 2` como el fallback multiproceso con `TestClient` fallaron al abrir la DB durante startup.
- Error observado: `psycopg.errors.ConnectionTimeout: connection timeout expired`.
- Se aumentó el timeout configurable a `DATABASE_CONNECT_TIMEOUT_SECONDS=20`, pero el bloqueo persistió.

## Event bus multiprocess

Documentado en [EVENT_BUS_MULTIPROCESS_LIMITATION.md](EVENT_BUS_MULTIPROCESS_LIMITATION.md):
- cada worker tiene su propio bus en memoria
- counters no globales
- impacto en canary: métricas fragmentadas por proceso
- no conviene introducir Redis/Kafka todavía en esta fase

## Latencia

Baselines ya reejecutados con entorno lab:
- [RUNTIME_LATENCY_BASELINE.md](RUNTIME_LATENCY_BASELINE.md)
- Valores previos validados:
- disabled p50/p95/p99: 3.62 / 9.841 / 19.509 ms
- enabled p50/p95/p99: 3.921 / 12.047 / 23.011 ms

## Memoria

Baseline validado en [RUNTIME_MEMORY_BASELINE.md](RUNTIME_MEMORY_BASELINE.md):
- requests: 500
- current_after_kb: 11963.977
- peak_after_kb: 12047.701
- event_count: 500
- event_bus bounded: sí

## Rollback/shutdown

Validado y documentado en [RUNTIME_LAB_SHUTDOWN_ROLLBACK_REPORT.md](RUNTIME_LAB_SHUTDOWN_ROLLBACK_REPORT.md):
- lab compose detenido
- puertos del lab liberados
- proceso Python del lab terminado explícitamente
- sin listeners en 18080/55432/56379
- sin tocar producción

## Riesgos abiertos

- El arranque multi-proceso sigue fallando por timeout de conexión a DB en este host lab.
- Falta una carrera estable multi-worker real antes de canary.
- Falta verificar el mismo escenario con Python 3.12/3.13 si se quiere comparar compatibilidad de dependencias ML.

## Estado final

- DB/Redis lab: validado.
- Startup/lifespan: validado.
- Multi-worker stress: bloqueado con evidencia concreta.
- Event bus multiprocess: documentado.
- Rollback/shutdown: validado.
- Producción, IA clínica y providers externos: no tocados.

## Próximo paso seguro

Resolver el timeout de startup DB en modo multi-proceso o introducir un modo de startup aislado para stress que no dependa de apertura concurrente de Postgres al arrancar varios workers.
