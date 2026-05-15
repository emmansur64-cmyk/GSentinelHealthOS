# RUNTIME CANARY PLAN

## Principio

El canary inicial solo puede activar observability parcial, structured logging parcial, confidence telemetry parcial y human review passive. No puede activar blocking, diagnostico, multimodal, imaging real ni providers externos con PHI.

## Tenants permitidos

- Tenant interno tecnico.
- Tenant de prueba sin PHI real.
- Ningun tenant clinico productivo hasta aprobacion formal.

## Scopes permitidos

- Health/readiness interno.
- Requests API no criticos con payload summary-only.
- Validacion de trace continuity.
- Validacion de latency/memory baseline.

## Flags permitidos

Canary minimo:

- `OBSERVABILITY_ENABLED=true`
- `OBSERVABILITY_SHADOW_MODE=true`
- `OBSERVABILITY_STRUCTURED_LOGGING_ENABLED=true`
- `OBSERVABILITY_EXTERNAL_EXPORT_ENABLED=false`
- `OBSERVABILITY_PHI_ALLOWED=false`
- `AI_RUNTIME_ENABLED=false`
- `AI_RUNTIME_SHADOW_MODE=true`
- `AI_RUNTIME_DRY_RUN=true`
- `AI_RUNTIME_KILL_SWITCH=true`
- `AI_RUNTIME_BLOCKING_ENABLED=false`

Flags prohibidos en canary inicial:

- `MEDICAL_VISION_ENABLED=true`
- `DICOM_ENABLED=true`
- `LLM_PROVIDER_ROUTER_ENABLED=true`
- `LLM_PROVIDER_PHI_ALLOWED=true`
- `CLINICAL_CONFIDENCE_BLOCKING_ENABLED=true`
- `HUMAN_REVIEW_BLOCKING_ENABLED=true`
- `SEMANTIC_MEMORY_VECTOR_ENABLED=true`
- `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=true`

## Rollback checkpoints

- Checkpoint 0: baseline sin observability.
- Checkpoint 1: observability pasiva en tenant interno.
- Checkpoint 2: trace/correlation continuity.
- Checkpoint 3: shadow counters sin salida real.
- Checkpoint 4: rollback a `OBSERVABILITY_ENABLED=false`.

Rollback objetivo: menor a 1 minuto por cambio de flags y restart controlado si el entorno lo requiere.

## Observability checkpoints

- Eventos publicados solo en memoria.
- External export deshabilitado.
- PHI no registrada.
- Latencia por request registrada.
- No hay errores 5xx adicionales.
- No cambia respuesta de usuario final.
