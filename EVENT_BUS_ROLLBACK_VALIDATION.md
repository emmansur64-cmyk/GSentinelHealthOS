# EVENT BUS ROLLBACK VALIDATION

## Archivos afectados

- `MetaBrain/observability_py/event_bus.py`
- `api/app/runtime_integration.py`
- `api/tests/runtime_memory_baseline.py`
- `api/tests/runtime_event_bus_stress.py`

## Estrategia rollback

Rollback tecnico minimo:

- Revertir `MetaBrain/observability_py/event_bus.py` a lista simple.
- Revertir llamadas a `resolve_event_bus_max_events(...)`.
- Eliminar uso de `stats()` en scripts de baseline/stress.

No hay migraciones, persistencia, brokers ni datos productivos.

## Validacion

- HTTP E2E posterior al cambio: `3 passed`.
- Unit runtime posterior al cambio: `2 passed`.
- Stress local: `bounded=True`, `stable=True`.
- Kill switch/dry-run/shadow permanecen activos en tests.

## Riesgo residual

Rollback reintroduce crecimiento infinito. Solo deberia usarse ante regresion grave del bounded bus.

## Reversion segura

No usar `git reset --hard`. Revisar primero:

```powershell
git diff -- MetaBrain/observability_py/event_bus.py api/app/runtime_integration.py api/tests/runtime_memory_baseline.py api/tests/runtime_event_bus_stress.py
```

Luego revertir solo esos paths si se decide descartar esta fase.
