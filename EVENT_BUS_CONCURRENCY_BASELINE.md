# EVENT BUS CONCURRENCY BASELINE

Fecha: 2026-05-11

## Scripts ejecutados

- `python api/tests/runtime_event_bus_concurrency.py`
- `python api/tests/runtime_event_bus_ttl.py`

## Baseline de concurrencia

- Escenarios: `10x100`, `50x100`, `50x100 + lectura concurrente`
- `max_events=100`
- Resultado global:
  - no exceptions
  - bounded queue respetada
  - counters consistentes
  - `trace_id/correlation_id` presentes

## Baseline TTL

- Configuracion test: `max_events=3`, `ttl_enabled=true`, `ttl_seconds=1`
- Resultado:
  - eventos viejos expiraron correctamente
  - `expired_events=2`
  - `dropped_events=1`
  - separation `expired != dropped` confirmada
  - bounded queue respetada

## Resumen numerico

- Concurrency run maxima:
  - published: `5000`
  - retained: `100`
  - dropped_events: `4900`
  - expired_events: `0`
  - total_seen: `5000`

- TTL run:
  - retained: `3`
  - dropped_events: `1`
  - expired_events: `2`

## Conclusion

Concurrencia local validada y TTL opcional validado sin regresion funcional del bus acotado.
