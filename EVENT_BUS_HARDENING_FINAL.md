# EVENT BUS HARDENING FINAL

## Auditoria

El bus real era una lista in-memory sin limite. Cada request con observability habilitada agregaba un evento con `append()`.

## Diseno bounded

Se implemento `collections.deque(maxlen=N)` con default `1000` eventos y override por `OBSERVABILITY_EVENT_BUS_MAX_EVENTS`.

## Implementacion

Cambios:

- FIFO automatico.
- `current_size`.
- `max_size`.
- `dropped_events`.
- Contrato `publish()` y `list()` preservado.
- Sin persistencia, brokers, threads ni loops.

## Memory baseline

Con `1500` requests:

- `event_count=1000`
- `max_size=1000`
- `dropped_events=500`
- no hay crecimiento infinito de eventos retenidos.

## Stress test

Con `1500` requests:

- `bounded=True`
- `stable=True`
- `current_size=1000`
- `dropped_events=500`

## Latencia

Post-hardening:

- Disabled p50/p95/p99: `6.847 / 21.908 / 26.539 ms`
- Enabled p50/p95/p99: `5.216 / 15.603 / 22.352 ms`

No se detecto regresion severa.

## Rollback

Rollback simple por archivos. No hay datos persistentes ni migraciones.

## Riesgos abiertos

- Startup real sigue pendiente por DB/Redis lab.
- Python 3.14 no es version recomendada del repo.
- El bus no tiene TTL temporal, solo limite por cantidad.
- No se probo concurrencia multi-worker.
- 253 warnings en HTTP E2E siguen pendientes.

## Readiness canary

Mejorado: el bus ya no tiene crecimiento infinito en shadow/local.

Todavia no listo para canary persistente hasta:

- disponer DB/Redis lab,
- revisar warnings,
- decidir limite por trafico real,
- validar concurrencia,
- mantener export externo apagado.
