# RUNTIME ROLLBACK DRILL

## Rollback simulation

Simulacion logica ejecutada por safety snapshot:

- Runtime IA deshabilitado.
- Kill switch activo.
- Dry-run activo.
- Shadow mode activo.
- Blocking deshabilitado.

Resultado esperado:

- `guard.allowed=false`
- `safe_fallback_required=true`
- `action=continue_existing_runtime_flow`

## Kill switch validation

El kill switch prevalece sobre capas habilitadas accidentalmente. Si `AI_RUNTIME_KILL_SWITCH=true`, el guard bloquea activacion real.

## Degraded mode validation

Degraded mode actual:

- Continuar runtime existente.
- No llamar providers nuevos.
- No bloquear respuestas.
- No exportar telemetry.
- No persistir eventos shadow.

## Fallback validation

Fallback actual:

- Seguro por defecto.
- Sin cambios en response body.
- Sin cambios en status code.
- Sin cambios en rutas criticas.
- Sin bloqueo de agenda, WhatsApp, login o APIs criticas.

## Recovery timing

Objetivo operacional:

- Desactivar `OBSERVABILITY_ENABLED=false`.
- Mantener `AI_RUNTIME_ENABLED=false`.
- Mantener `AI_RUNTIME_KILL_SWITCH=true`.
- Confirmar que eventos pasivos dejan de publicarse.
- Tiempo objetivo: menor a 1 minuto desde cambio de flag efectivo.

## Evidencia actual

- `python -m py_compile api/app/runtime_integration.py api/app/main.py tests/unit/test_runtime_integration.py`: OK.
- `python -m pytest tests/unit/test_runtime_integration.py tests/unit/test_health_observability.py`: 2 passed, 1 skipped por falta de `fastapi` en Python global.
- Micro baseline seguro: 1000 iteraciones de guard/trace/log en 79.645 ms total, 0.079645 ms promedio, 9.11 KB pico.
- Provider fallback: `SAFE_FALLBACK`, `ROUTER_DISABLED`; sin llamadas externas.
- PHI check: email y telefono redactados en telemetry sanitizada.
- No se ejecuto rollout real.
