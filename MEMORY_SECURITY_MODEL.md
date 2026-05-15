# MEMORY SECURITY MODEL

## Principio de seguridad

La memoria semántica médica debe minimizar PHI, aislar scopes y fallar de forma segura. En Fase 3 no se activa escritura semántica ni vectorización.

## Qué se puede guardar

Solo cuando una fase futura lo habilite explícitamente:

- resúmenes clínicos sanitizados,
- decisiones clínicas previas no definitivas,
- razonamiento reciente sanitizado,
- medicamentos mencionados sin identificadores innecesarios,
- hipótesis no absolutas,
- contexto de especialidad,
- trazas técnicas sin secretos.

## Qué no se puede guardar

- secretos,
- API keys,
- tokens,
- passwords,
- cookies,
- direcciones precisas,
- GPS exacto,
- documentos identificatorios sin redacción,
- teléfonos o emails sin redacción,
- PHI no necesaria para el objetivo clínico,
- datos de pacientes fuera del scope autorizado,
- memoria global contaminada entre tenants.

## Manejo PHI

`MemorySanitizer` aplica redacción conservadora antes de cualquier escritura semántica futura:

- `[REDACTED_EMAIL]`
- `[REDACTED_PHONE]`
- `[REDACTED_DOCUMENT]`
- `[REDACTED_SECRET]`
- `[REDACTED_JWT]`
- `[REDACTED_HTML]`
- `[REDACTED_METADATA]`

La metadata sensible se redacta por nombre de clave.

## Scopes

Scopes soportados:

- `global_safe`
- `tenant`
- `doctor`
- `patient`
- `session`
- `system`

`patient` está desactivado por defecto mediante `SEMANTIC_MEMORY_PATIENT_SCOPE_ENABLED=false`.

## Aislamiento

Los contratos requieren:

- `tenant_id`
- `doctor_id`
- `patient_id` opcional
- `trace_id`
- `scope`

El adapter legacy marca datos sin scope explícito como `legacy_unknown` o `system` para evitar promoverlos automáticamente a memoria clínica scoped.

## Auditoría

Cada operación puede generar `MemoryAuditEvent` con:

- timestamp,
- trace_id,
- acción,
- backend,
- scope,
- tenant/doctor,
- presencia de patient_id sin registrar su valor,
- éxito/fallback,
- razón.

## Trazabilidad

Cada `MemoryEntry` incluye:

- `trace_id`,
- `source`,
- `created_at`,
- `audit_hash` opcional,
- `metadata` sanitizada.

## Límites clínicos

Esta capa no diagnostica, no prescribe, no aprende automáticamente y no modifica reglas clínicas. Una futura activación debe pasar por validación médica, seguridad PHI y rollback operativo.
