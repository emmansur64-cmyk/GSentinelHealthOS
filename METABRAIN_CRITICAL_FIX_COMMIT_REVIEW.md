# METABRAIN CRITICAL FIX COMMIT REVIEW

Fecha: 2026-05-12

## Inventario de worktree

Comandos ejecutados:

- `git status --short`
- `git diff --name-only`
- `git ls-files ...`
- `git ls-files --others --exclude-standard ...`

Resultado:

- El worktree contiene muchos cambios previos no relacionados fuera del alcance.
- Archivos tracked del fix detectados con ruta unica:
  - `MetaBrain/src/ai/ai.controller.ts`
  - `MetaBrain/src/ml/ml.controller.ts`
  - `MetaBrain/src/ml-service/ml-service.controller.ts`
  - `MetaBrain/src/medical-assistant/medical-assistant.controller.ts`
  - `MetaBrain/src/brain/brain.service.ts`
  - `MetaBrain/src/memory/memory.service.ts`
  - `MetaBrain/src/persistence/persistence.service.ts`
  - `MetaBrain/src/audit/audit.service.ts`
- Archivos nuevos del fix detectados:
  - `MetaBrain/src/common/utils/persistence-sanitizer.util.ts`
  - `MetaBrain/src/common/utils/persistence-sanitizer.util.spec.ts`
  - `MetaBrain/src/execution/execution-denied-status.spec.ts`
  - `MetaBrain/src/ingress/api-key-guard.coverage.spec.ts`
  - `MetaBrain/src/persistence/persistence-sanitization.spec.ts`
  - `METABRAIN_CRITICAL_FIX_REPORT.md`
  - `METABRAIN_SECURITY_ROLLBACK_PLAN.md`
  - `METABRAIN_CRITICAL_FIX_COMMIT_REVIEW.md`

## Archivos relacionados con este fix

Permitidos para stage/commit:

- `MetaBrain/src/ai/ai.controller.ts`
- `MetaBrain/src/ml/ml.controller.ts`
- `MetaBrain/src/ml-service/ml-service.controller.ts`
- `MetaBrain/src/medical-assistant/medical-assistant.controller.ts`
- `MetaBrain/src/brain/brain.service.ts`
- `MetaBrain/src/common/utils/persistence-sanitizer.util.ts`
- `MetaBrain/src/memory/memory.service.ts`
- `MetaBrain/src/persistence/persistence.service.ts`
- `MetaBrain/src/audit/audit.service.ts`
- `MetaBrain/src/ingress/api-key-guard.coverage.spec.ts`
- `MetaBrain/src/execution/execution-denied-status.spec.ts`
- `MetaBrain/src/common/utils/persistence-sanitizer.util.spec.ts`
- `MetaBrain/src/persistence/persistence-sanitization.spec.ts`
- `METABRAIN_CRITICAL_FIX_REPORT.md`
- `METABRAIN_SECURITY_ROLLBACK_PLAN.md`
- `METABRAIN_CRITICAL_FIX_COMMIT_REVIEW.md`

## Archivos excluidos

Todo archivo no listado arriba queda excluido del commit, incluyendo:

- `.env.example`
- `.dockerignore`
- `MetaBrain/.dockerignore`
- `MetaBrain/tsconfig.tsbuildinfo`
- `node_modules`, `dist`, `__pycache__`
- modelos, datasets y artefactos binarios
- cambios en `api`, `alembic`, `docker`, `medical-agenda-saas`, `shared`, `whatsapp_gateway`, `scripts`, `tools`
- reportes previos no relacionados

## Revision de diff limitado

Auth:

- `ApiKeyGuard` importado en los cuatro controladores sensibles.
- `@UseGuards(ApiKeyGuard)` aplicado a `AiController`, `MlController`, `MlServiceController` y `MedicalAssistantController`.
- No se modifico `IncidentController`.
- No se detectaron endpoints health publicos afectados por estos cambios.

Execution:

- `BrainService` ya no mapea `executed=false` y `simulated=false` a `SUCCESS`.
- El estado resultante es `BLOCKED`, ya existente en `IncidentStatus`.
- Se agrega `denied=true`.
- Se agrega `operational_success=false` para denegados.
- El `reason` de `executionResult` se preserva.

Sanitizacion:

- `sanitizeForPersistence` es recursivo para objetos y arrays.
- Cubre claves: `authorization`, `bearer`, `token`, `api_key`, `apikey`, `secret`, `password`, `passwd`, `cookie`, `set-cookie`, `image_base64`, `base64_image`, `raw_image`, `image_bytes`, `dicom_bytes`.
- Cubre contenido: JWT, secrets estilo `token=...`, email, telefono, documento.
- Se conecta antes de memoria, auditoria y persistencia.
- Mantiene estructura de auditoria y trazabilidad; redacta valores, no elimina objetos completos.

Tests:

- Auth guards cubiertos por metadata de Nest.
- Denied status cubierto en `ExecutionService` y `BrainService`.
- Sanitizador cubierto con objeto anidado y `image_base64`.
- Persistencia sanitizada cubierta en `saveOnlineTrainingRecord`.

Reportes:

- `METABRAIN_CRITICAL_FIX_REPORT.md` documenta hallazgos, archivos, tests, riesgos y rollback.
- `METABRAIN_SECURITY_ROLLBACK_PLAN.md` documenta rollback por area.
- No contienen secretos reales ni PHI real.

## Verificacion de secretos

Comandos ejecutados:

- `rg` sobre archivos permitidos para patrones de API keys, tokens, passwords y private keys.
- `rg` sobre fixtures sensibles esperados.

Resultado:

- No se detectaron credenciales reales.
- Los matches encontrados son fixtures sinteticos de tests (`patient@example.com`, telefono de ejemplo, `Bearer real-token`, `token=abc123456789`) y textos descriptivos de documentacion.

## Validaciones

Comandos ejecutados antes del stage:

- `npx tsc --noEmit --incremental false --project tsconfig.json`
- `npx jest --config jest.config.ts --runTestsByPath src/ingress/api-key-guard.coverage.spec.ts src/execution/execution-denied-status.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/persistence/persistence-sanitization.spec.ts --runInBand`

Resultado:

- TypeScript produccion: OK.
- Tests focales: OK, 4 suites, 6 tests.
- Warnings observados: Mongoose reporta indice duplicado `incidentId`; preexistente/fuera de alcance.

## Riesgo de mezcla

Alto si se usa stage masivo, porque el worktree contiene muchos cambios previos no relacionados.

Control aplicado:

- Confirmacion: no se usara `git add .`.
- Confirmacion: no se usara `git add -A`.
- Confirmacion: no se usara `git commit -a`.
- El stage se hara archivo por archivo con rutas exactas.
- Se verificara `git diff --cached --name-only` antes del commit.

## Decision go/no-go

Go para stage selectivo.

Condiciones restantes antes de commit:

- `git diff --cached --name-only` debe contener solo archivos permitidos.
- `git diff --cached --check` debe finalizar sin errores.
