# RUNTIME STARTUP LAB REPORT

Fecha: 2026-05-12
Suite: `api/tests/test_runtime_startup_lab.py`

## Resultado

- `2 passed`.
- Startup/lifespan real validado con `TestClient` en modo lab.

## Validaciones cubiertas

- Carga explícita de `.env.runtime_lab` en proceso de test.
- Startup y shutdown sin errores.
- Endpoint `/` con body intacto (sin cambios de contrato).
- Endpoint `/api/health/liveness` operativo.
- Propagación de trace/correlation validada vía eventos de observability en runtime passive.
- Guard rails activos:
- kill switch activo
- dry-run activo
- shadow mode activo
- external export desactivado
- PHI desactivado
- Sin invocaciones de provider para `/` y `/api/health/liveness`.

## Notas

- Readiness completa depende de DB y Redis activos (ya cubierto en conectividad lab).
- Esta fase no habilita IA clínica ni providers externos.
