# EVENT BUS CONCURRENCY REPORT

Fecha: 2026-05-11
Entorno: local lab

## Configuracion de prueba

- Script: [api/tests/runtime_event_bus_concurrency.py](api/tests/runtime_event_bus_concurrency.py)
- Cola: `max_events=100`
- Datos: eventos sinteticos locales
- Red externa/providers: no usados

## Escenarios ejecutados

1. `10 workers x 100 eventos`
2. `50 workers x 100 eventos`
3. `50 workers x 100 eventos + 8 readers concurrentes`

## Resultados

### Escenario 1

- workers: `10`
- eventos totales: `1000`
- retained: `100`
- dropped_events: `900`
- expired_events: `0`
- total_seen: `1000`
- bounded: `true`
- count_consistent: `true`
- errors: `[]`

### Escenario 2

- workers: `50`
- eventos totales: `5000`
- retained: `100`
- dropped_events: `4900`
- expired_events: `0`
- total_seen: `5000`
- bounded: `true`
- count_consistent: `true`
- errors: `[]`

### Escenario 3

- workers: `50`
- readers: `8`
- eventos totales: `5000`
- retained: `100`
- dropped_events: `4900`
- expired_events: `0`
- total_seen: `5000`
- bounded: `true`
- count_consistent: `true`
- list() estable durante writes: `true`
- errors: `[]`

## Conclusiones

- No se observaron excepciones bajo concurrencia.
- `event_count <= max_events` se mantiene.
- `dropped_events` y `retained` se mantuvieron consistentes.
- Lectura concurrente con `list()` se mantuvo estable durante escritura.
- `trace_id` y `correlation_id` permanecieron presentes en eventos retenidos.

## Riesgos

- Riesgo residual: esta validacion es in-process/local y no reemplaza stress multi-proceso real.
- Mitigacion aplicada: lock liviano (`RLock`) en `publish/list/stats`.
