# EVENT BUS CONCURRENCY TTL FINAL

## Auditoria

- Auditoria de thread-safety completada: [EVENT_BUS_CONCURRENCY_AUDIT.md](EVENT_BUS_CONCURRENCY_AUDIT.md)
- Riesgo real identificado: secuencia no atomica `len -> dropped++ -> append` sin lock.

## Concurrencia

- Validacion local completada con [api/tests/runtime_event_bus_concurrency.py](api/tests/runtime_event_bus_concurrency.py).
- Escenarios `10x100`, `50x100`, y lectura concurrente durante escritura.
- Sin excepciones y con contadores consistentes.

## Thread-safety

- Mitigacion aplicada en [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py):
  - `threading.RLock`
  - proteccion de `publish/list/stats`
  - snapshot consistente en `list()`

## TTL policy

- Politica documentada en [EVENT_BUS_TTL_POLICY.md](EVENT_BUS_TTL_POLICY.md).
- `maxlen` sigue siendo defensa primaria.
- TTL opcional, cleanup oportunista, sin background thread.

## TTL implementation

- Implementado en [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py).
- Defaults seguros:
  - `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=false`
  - `OBSERVABILITY_EVENT_BUS_TTL_SECONDS=900`
- Contador separado `expired_events` via `diagnostics()`.

## Baselines

- Concurrency baseline: [EVENT_BUS_CONCURRENCY_BASELINE.md](EVENT_BUS_CONCURRENCY_BASELINE.md)
- Memoria: [RUNTIME_MEMORY_BASELINE.md](RUNTIME_MEMORY_BASELINE.md)
- Latencia: [RUNTIME_LATENCY_BASELINE.md](RUNTIME_LATENCY_BASELINE.md)
- HTTP E2E: [RUNTIME_HTTP_E2E_REPORT.md](RUNTIME_HTTP_E2E_REPORT.md)

## Rollback

- Plan de rollback especifico: [EVENT_BUS_CONCURRENCY_TTL_ROLLBACK.md](EVENT_BUS_CONCURRENCY_TTL_ROLLBACK.md)

## Riesgos abiertos

- Prueba multi-proceso/multi-worker real aun pendiente.
- Startup completo sigue condicionado por servicios lab (DB/Redis) fuera del scope de esta fase.

## Readiness canary

- Readiness mejorado para canary controlado local.
- Precondicion recomendada antes de canary persistente: validacion multi-worker en entorno lab equivalente al runtime objetivo.
