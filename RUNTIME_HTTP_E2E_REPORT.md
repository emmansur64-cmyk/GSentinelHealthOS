# RUNTIME HTTP E2E REPORT

## Comando

```powershell
.\.venv_runtime_lab\Scripts\python.exe -m pytest api/tests/test_runtime_integration.py -v
```

## Resultado

```text
3 passed, 253 warnings in 1.89s
```

## Tests ejecutados

- `test_root_body_is_preserved_and_trace_context_is_recorded`
- `test_kill_switch_and_safe_fallback_do_not_block_liveness`
- `test_shadow_counters_do_not_alter_output`

## Tests failed

- Ninguno en modo HTTP sin lifespan externo.

## Startup/lifespan

El startup real completo queda bloqueado por servicios externos:

- Postgres `db` no resuelve con `.env` original.
- Redis no disponible en lab al usar DB SQLite local.

Por seguridad, los tests HTTP E2E validan el middleware real con `TestClient` sin entrar al lifespan externo y con `initialize_runtime_integration_state()` explicito. Esto valida rutas, middleware, trace/correlation, safe fallback y body estable sin tocar DB/Redis/productivo.

## Validaciones cubiertas

- App carga.
- Root responde.
- Body root no cambia.
- Trace id se propaga.
- Correlation id se propaga.
- Kill switch conserva flujo.
- Safe fallback conserva flujo.
- No se expone token sintetico en telemetry.
- Shadow counters no alteran output.
- Event bus bounded no altera output HTTP.

## Riesgos

- Startup real sigue pendiente hasta disponer de DB/Redis lab.
- 253 warnings de FastAPI/Pydantic/deprecations deben revisarse antes de endurecimiento final.

## Nota de regresion

Luego de aplicar thread-safety del event bus y TTL opcional (default desactivado), el suite HTTP E2E sigue pasando sin cambios de contrato observable.
