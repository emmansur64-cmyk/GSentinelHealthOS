# OBSERVABILITY ROLLBACK PLAN

## Estado de integracion

La Fase 8 creo una capa paralela de observabilidad. No esta conectada al runtime.

No se modificaron:

- endpoints,
- contratos API,
- Docker,
- `.env`,
- base de datos,
- loggers actuales,
- providers,
- UI,
- runtime de chat.

## Flags

Mantener defaults:

- `OBSERVABILITY_ENABLED=false`
- `OBSERVABILITY_SHADOW_MODE=true`
- `OBSERVABILITY_STRUCTURED_LOGGING_ENABLED=false`
- `OBSERVABILITY_TRACE_ENGINE_ENABLED=false`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`

Con estas flags, no hay activacion real.

## Archivos nuevos

- `MetaBrain/observability/`
- `MetaBrain/observability_py/`
- `OBSERVABILITY_VALIDATION.md`
- `OBSERVABILITY_SAFETY_MODEL.md`
- `OBSERVABILITY_ROLLBACK_PLAN.md`

## Archivos modificados

Ninguno existente de runtime.

## Rollback seguro

Opcion minima:

1. Mantener flags apagados.
2. No importar la capa desde runtime.

Opcion completa:

1. Eliminar `MetaBrain/observability`.
2. Eliminar `MetaBrain/observability_py`.
3. Eliminar documentos Fase 8.

## Comandos seguros de inspeccion

```powershell
git status --short
git diff --name-only
python -m compileall MetaBrain\observability_py
```

## Advertencias

No conectar telemetry real sin:

- revision PHI,
- politica de retencion,
- control de acceso,
- sampling,
- budget de performance,
- plan de incident response,
- rollback probado.
