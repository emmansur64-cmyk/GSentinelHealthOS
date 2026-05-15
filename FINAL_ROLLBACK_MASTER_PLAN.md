# FINAL ROLLBACK MASTER PLAN

## Secuencia segura global

1. Mantener `AI_RUNTIME_KILL_SWITCH=true`.
2. Mantener `AI_RUNTIME_ENABLED=false`.
3. Mantener `AI_RUNTIME_BLOCKING_ENABLED=false`.
4. Desactivar flags por capa.
5. No borrar datos runtime existentes.
6. No reiniciar servicios para rollback documental.

## Rollback por fase

| Fase | Documento rollback |
| --- | --- |
| Fase 3 | `MEMORY_ROLLBACK_PLAN.md` |
| Fase 4 | `IMAGE_ROLLBACK_PLAN.md` |
| Fase 5 | `PROVIDER_ROLLBACK_PLAN.md` |
| Fase 6 | `HUMAN_REVIEW_ROLLBACK_PLAN.md` |
| Fase 7 | `CLINICAL_CONFIDENCE_ROLLBACK_PLAN.md` |
| Fase 8 | `OBSERVABILITY_ROLLBACK_PLAN.md` |
| Fase 9 | `PRODUCTION_SAFETY_ROLLBACK_PLAN.md` |

## Flags criticos

- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_KILL_SWITCH=true`
- `SEMANTIC_MEMORY_ENABLED=false`
- `MEDICAL_VISION_ENABLED=false`
- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `HUMAN_REVIEW_ENABLED=false`
- `CLINICAL_CONFIDENCE_ENABLED=false`
- `OBSERVABILITY_ENABLED=false`

## Rollback runtime

No hay runtime nuevo conectado. Rollback runtime consiste en no importar ni activar capas nuevas.

## Rollback observability

Desactivar:

- `OBSERVABILITY_ENABLED=false`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`

## Rollback review

Desactivar:

- `HUMAN_REVIEW_ENABLED=false`
- `HUMAN_REVIEW_BLOCKING_ENABLED=false`
- `HUMAN_OVERRIDE_ENABLED=false`

## Rollback confidence

Desactivar:

- `CLINICAL_CONFIDENCE_ENABLED=false`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=false`
- `CLINICAL_CONFIDENCE_AUTO_ESCALATION_ENABLED=false`

## Rollback imaging

Desactivar:

- `MEDICAL_VISION_ENABLED=false`
- `MEDICAL_VISION_PROVIDER_ENABLED=false`
- `DICOM_ENABLED=false`
- `IMAGE_STORE_ORIGINAL=false`

## Rollback providers

Desactivar:

- `LLM_PROVIDER_ROUTER_ENABLED=false`
- `LLM_PROVIDER_MULTIMODAL_ENABLED=false`
- `LLM_PROVIDER_EXTERNAL_IMAGE_ENABLED=false`
- `LLM_PROVIDER_PHI_ALLOWED=false`

## Rollback memory

Desactivar:

- `SEMANTIC_MEMORY_ENABLED=false`
- `SEMANTIC_MEMORY_VECTOR_ENABLED=false`
- `SEMANTIC_MEMORY_WRITE_ENABLED=false`
- `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`
