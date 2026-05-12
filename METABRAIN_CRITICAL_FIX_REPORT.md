# METABRAIN CRITICAL FIX REPORT

Fecha: 2026-05-12

## Alcance

Correccion minima de los tres hallazgos criticos auditados en `MetaBrain`:

1. Endpoints NestJS operativos sin autenticacion.
2. Ejecucion denegada reportada como `SUCCESS`.
3. Persistencia/memoria/auditoria sin sanitizacion PHI/PII/secrets visible.

No se hizo deploy, no se tocaron servicios productivos, no se ejecutaron migraciones, no se ejecutaron reentrenamientos y no se llamaron providers externos.

## Hallazgos corregidos

### 1. Auth guards

Se aplico `@UseGuards(ApiKeyGuard)` a controladores operativos:

- `MetaBrain/src/ai/ai.controller.ts`
- `MetaBrain/src/ml/ml.controller.ts`
- `MetaBrain/src/ml-service/ml-service.controller.ts`
- `MetaBrain/src/medical-assistant/medical-assistant.controller.ts`

Endpoints protegidos:

- `POST /api/ai/medical-refine`
- `POST /api/ai/medical-query`
- `POST /api/ml/reload-model`
- `POST /api/ml/online-learning/trigger`
- `GET /api/ml/online-learning/status`
- `POST /api/ml/online-feedback/outcome`
- `POST /ml/predict`
- `POST /ml/batch-predict`
- `GET /ml/metrics`
- `GET /ml/monitor/status`
- `GET /ml/monitor/alerts`
- `POST /ml/monitor/run`
- `POST /api/assistant/whatsapp`

Tambien se agrego `@Body()` donde faltaba en `ai.controller.ts` y `ml.controller.ts` para mantener lectura correcta del payload.

### 2. Execution denied status

Archivo modificado:

- `MetaBrain/src/brain/brain.service.ts`

Cambio:

- Cuando `executionResult.executed === false` y `executionResult.simulated === false`, el resultado ahora usa `status: 'BLOCKED'`.
- Se agrega metadata de respuesta:
  - `denied: true`
  - `operational_success: false`
- El evento `action.executed` incluye `denied`.

No se agrego un nuevo estado incompatible; se uso `BLOCKED`, que ya existia en `IncidentStatus`.

### 3. Sanitizacion conectada

Archivos modificados/agregados:

- `MetaBrain/src/common/utils/persistence-sanitizer.util.ts`
- `MetaBrain/src/memory/memory.service.ts`
- `MetaBrain/src/persistence/persistence.service.ts`
- `MetaBrain/src/audit/audit.service.ts`

Cobertura de sanitizacion:

- Recursiva sobre objetos y arrays.
- Redacta por clave:
  - `authorization`
  - `bearer`
  - `token`
  - `api_key`
  - `apikey`
  - `secret`
  - `password`
  - `passwd`
  - `cookie`
  - `set-cookie`
  - `image_base64`
  - `base64_image`
  - `raw_image`
  - `image_bytes`
  - `dicom_bytes`
- Redacta por contenido:
  - JWT
  - secretos estilo `token=...`, `password=...`
  - emails
  - telefonos
  - documentos tipo `dni`, `documento`, `passport`, `pasaporte`, `ssn`, `cuit`, `cuil`, `rut`

Puntos de aplicacion:

- Memoria en proceso antes de guardar el registro.
- `saveIncident`
- `saveDecision`
- `saveFeatures`
- `saveOutcome`
- `saveAudit`
- `saveOnlineTrainingRecord`
- Auditoria en memoria antes de `saveAudit`.

## Tests agregados

- `MetaBrain/src/ingress/api-key-guard.coverage.spec.ts`
- `MetaBrain/src/execution/execution-denied-status.spec.ts`
- `MetaBrain/src/common/utils/persistence-sanitizer.util.spec.ts`
- `MetaBrain/src/persistence/persistence-sanitization.spec.ts`

## Validaciones ejecutadas

Comandos ejecutados:

- `npx tsc --noEmit --incremental false --project tsconfig.json`
- `npx jest --config jest.config.ts --runTestsByPath src/ingress/api-key-guard.coverage.spec.ts src/execution/execution-denied-status.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/persistence/persistence-sanitization.spec.ts --runInBand`
- `npm audit --json`
- `git diff --name-only`
- `git status --short`

Resultados:

- TypeScript produccion: OK.
- Tests focales: 4 suites OK, 6 tests OK.
- `npm audit --json`: persisten 22 vulnerabilidades preexistentes: 1 critical, 6 high, 11 moderate, 4 low.
- Jest mostro warnings preexistentes de Mongoose por indice duplicado `incidentId`; no fueron corregidos por estar fuera de alcance.

## Riesgos pendientes

- Vulnerabilidades de dependencias reportadas por `npm audit`.
- Warnings de Mongoose por indices duplicados.
- `tsconfig.spec.json` estaba roto antes de esta correccion para compilacion completa de specs.
- Sanitizacion conserva estructura y redacta patrones/keys sensibles, pero no reemplaza una politica completa de clasificacion PHI clinica.
- El worktree tenia muchos cambios previos no relacionados; no fueron revertidos ni tocados.

## Rollback resumido

Revertir solo los archivos de esta correccion:

- Controladores con `@UseGuards(ApiKeyGuard)`.
- `brain.service.ts` status mapping.
- `persistence-sanitizer.util.ts` y su uso en memoria/persistencia/auditoria.
- Specs focales nuevos.

Ver plan detallado en `METABRAIN_SECURITY_ROLLBACK_PLAN.md`.
