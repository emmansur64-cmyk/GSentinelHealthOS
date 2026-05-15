# FINAL RUNTIME INTEGRATION ROADMAP

## Principio

No activar nada directamente en produccion. Integrar por etapas, con kill switch y rollback por capa.

## Etapa 0: Preparacion

- Resolver inconsistencias de flags en `MetaBrain/core/layer-registry.ts`.
- Definir ownership de `.env`.
- Aprobar PHI policy.
- Aprobar retention policy.

## Etapa 1: Production Safety

- Conectar guard en modo no bloqueante.
- Validar startup report.
- Mantener `AI_RUNTIME_KILL_SWITCH=true`.

## Etapa 2: Observability shadow

- Activar structured events internos sin export externo.
- Validar redaction.
- Medir overhead.

## Etapa 3: Confidence shadow

- Calcular confidence sin cambiar output.
- Comparar con human review manual.
- No bloquear.

## Etapa 4: Human Review non-blocking

- Persistencia durable.
- UI/roles.
- Audit trail.
- Sin blocking inicial.

## Etapa 5: Provider Router shadow

- Healthcheck provider.
- No PHI.
- No multimodal.
- No external image.

## Etapa 6: Semantic Memory read-only

- JSONL adapter en read-only.
- Sanitizer audit.
- Sin vector DB inicial.

## Etapa 7: Imaging metadata-only

- Solo legacy metadata adapter.
- Human review requerido.
- Sin DICOM real.

## Etapa 8: Staged rollout

- Tenant interno.
- Shadow metrics.
- Rollback checkpoint.
- Clinical safety review.

## Rollback checkpoints

Cada etapa debe poder volver a:

- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_KILL_SWITCH=true`
- flags por capa apagados.
