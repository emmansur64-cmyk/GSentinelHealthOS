# EVENT BUS TTL POLICY

## Objetivo

Definir retencion temporal segura sin romper compatibilidad ni introducir hilos de limpieza.

## Decision

TTL implementado de forma opcional y conservadora.

- Defensa principal: `deque(maxlen=N)`
- Defensa adicional: TTL oportunista
- Compatibilidad preservada: `publish()` y `list()`
- No background thread

## Flags propuestas

- `OBSERVABILITY_EVENT_BUS_MAX_EVENTS=1000`
- `OBSERVABILITY_EVENT_BUS_TTL_SECONDS=900`
- `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=false`

No se modifico `.env` real en esta fase.

## Comportamiento

### Maxlen

- Sigue activo siempre.
- Al desbordar: incrementa `dropped_events` y conserva los eventos mas recientes.

### TTL

- Solo aplica si `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=true`.
- Expira eventos por edad (`timestamp <= now - ttl_seconds`).
- Limpieza oportunista en:
  - `publish()`
  - `list()`
  - `stats()`
  - `diagnostics()`

## Contadores

- `dropped_events`: overflow por `maxlen`
- `expired_events`: expirados por TTL

Se mantienen separados para no mezclar causas.

## Costos esperados

- `publish()`: O(k) solo por expiraciones consecutivas al frente; O(1) promedio.
- `list()`: snapshot en memoria + limpieza TTL oportunista.
- `stats()`: costo bajo, sin I/O.
- lock: `RLock` corto de grano fino.

## Riesgo de overhead

- Bajo para cargas habituales.
- TTL desactivado por default evita impacto no requerido.
- Sin bloqueo de I/O dentro del lock.

## Impacto en observability

- Sin cambio de contrato HTTP para `stats()`.
- Metricas extendidas disponibles por `diagnostics()` para pruebas internas.

## Rollback

- Desactivar TTL por flag: `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=false`.
- Reversion de codigo: restaurar [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py) y wiring en [api/app/runtime_integration.py](api/app/runtime_integration.py).
