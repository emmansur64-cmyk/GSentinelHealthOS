# EVENT BUS CONCURRENCY TTL ROLLBACK

## Archivos tocados en esta fase

- [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py)
- [api/app/runtime_integration.py](api/app/runtime_integration.py)
- [api/tests/runtime_event_bus_concurrency.py](api/tests/runtime_event_bus_concurrency.py)
- [api/tests/runtime_event_bus_ttl.py](api/tests/runtime_event_bus_ttl.py)

## Como revertir thread-safety

1. Restaurar [MetaBrain/observability_py/event_bus.py](MetaBrain/observability_py/event_bus.py) a version anterior sin `RLock`.
2. Mantener `deque(maxlen=N)` para no reabrir crecimiento infinito.

## Como desactivar TTL sin revertir codigo

Setear flag runtime:

- `OBSERVABILITY_EVENT_BUS_TTL_ENABLED=false`

Opcionalmente mantener:

- `OBSERVABILITY_EVENT_BUS_TTL_SECONDS=900`

TTL queda inactivo mientras el flag este en `false`.

## Rollback de wiring TTL

Si se desea revertir inyeccion de flags TTL:

- restaurar [api/app/runtime_integration.py](api/app/runtime_integration.py)
  - remover `resolve_event_bus_ttl_enabled`
  - remover `resolve_event_bus_ttl_seconds`

## Comandos seguros de revision

```powershell
git status --short
git diff --name-only
git diff -- MetaBrain/observability_py/event_bus.py api/app/runtime_integration.py api/tests/runtime_event_bus_concurrency.py api/tests/runtime_event_bus_ttl.py
```

## Riesgos del rollback

- Quitar lock reintroduce riesgo de inconsistencias de contador bajo concurrencia.
- Quitar TTL no rompe seguridad de retencion mientras `maxlen` siga activo.
