# METABRAIN SECURITY ROLLBACK PLAN

Fecha: 2026-05-12

## Alcance del rollback

Este plan revierte exclusivamente la correccion critica de MetaBrain:

- Auth guards agregados a controladores operativos.
- Mapeo de ejecucion denegada a `BLOCKED`.
- Sanitizacion antes de persistencia/memoria/auditoria.
- Tests focales y reporte asociados.

No usar `git reset --hard`, no usar `git add .`, no tocar produccion y no ejecutar migraciones.

## 1. Revertir auth guards

Archivos:

- `MetaBrain/src/ai/ai.controller.ts`
- `MetaBrain/src/ml/ml.controller.ts`
- `MetaBrain/src/ml-service/ml-service.controller.ts`
- `MetaBrain/src/medical-assistant/medical-assistant.controller.ts`

Accion manual:

- Quitar import de `UseGuards` si queda sin uso.
- Quitar import de `ApiKeyGuard`.
- Quitar decorador `@UseGuards(ApiKeyGuard)`.
- Si se desea rollback exacto del bug original, quitar `@Body()` agregado en `ai.controller.ts` y `ml.controller.ts`; no recomendado porque rompe lectura del payload.

Riesgo de rollback:

- Los endpoints operativos vuelven a quedar expuestos sin autenticacion NestJS.

## 2. Revertir status mapping

Archivo:

- `MetaBrain/src/brain/brain.service.ts`

Accion manual:

- Cambiar:
  - `const executionStatus = isReal ? 'EXECUTED' : isSimulated ? 'SIMULATED' : 'BLOCKED';`
- Por:
  - `const executionStatus = isReal ? 'EXECUTED' : isSimulated ? 'SIMULATED' : 'SUCCESS';`
- Quitar `executionDenied`.
- Quitar `denied` del evento `action.executed`.
- Quitar `denied` y `operational_success` de `meta`.

Riesgo de rollback:

- Acciones denegadas por whitelist/politica pueden volver a reportarse como `SUCCESS`.

## 3. Revertir sanitizacion

Archivos:

- `MetaBrain/src/common/utils/persistence-sanitizer.util.ts`
- `MetaBrain/src/memory/memory.service.ts`
- `MetaBrain/src/persistence/persistence.service.ts`
- `MetaBrain/src/audit/audit.service.ts`

Accion manual:

- Eliminar import de `sanitizeForPersistence`.
- En `MemoryService`, volver a pushear y persistir `record` crudo en lugar de `sanitizedRecord`.
- En `PersistenceService`, quitar sanitizacion local en:
  - `saveIncident`
  - `saveDecision`
  - `saveFeatures`
  - `saveOutcome`
  - `saveAudit`
  - `saveOnlineTrainingRecord`
- En `AuditService`, volver a guardar `entity` crudo.
- Eliminar `MetaBrain/src/common/utils/persistence-sanitizer.util.ts`.

Riesgo de rollback:

- PHI/PII/secrets pueden volver a persistirse en memoria, Mongo y online training buffer.

## 4. Revertir tests y reportes

Archivos nuevos que pueden eliminarse si se revierte el fix:

- `MetaBrain/src/ingress/api-key-guard.coverage.spec.ts`
- `MetaBrain/src/execution/execution-denied-status.spec.ts`
- `MetaBrain/src/common/utils/persistence-sanitizer.util.spec.ts`
- `MetaBrain/src/persistence/persistence-sanitization.spec.ts`
- `METABRAIN_CRITICAL_FIX_REPORT.md`
- `METABRAIN_SECURITY_ROLLBACK_PLAN.md`

## Comandos seguros de revision

Solo lectura:

```powershell
git diff -- MetaBrain/src/ai/ai.controller.ts MetaBrain/src/ml/ml.controller.ts MetaBrain/src/ml-service/ml-service.controller.ts MetaBrain/src/medical-assistant/medical-assistant.controller.ts MetaBrain/src/brain/brain.service.ts MetaBrain/src/memory/memory.service.ts MetaBrain/src/persistence/persistence.service.ts MetaBrain/src/audit/audit.service.ts MetaBrain/src/common/utils/persistence-sanitizer.util.ts
git diff --name-only
git status --short
```

Validacion despues de rollback:

```powershell
cd MetaBrain
npx tsc --noEmit --incremental false --project tsconfig.json
npx jest --config jest.config.ts --runTestsByPath src/ingress/api-key-guard.coverage.spec.ts src/execution/execution-denied-status.spec.ts src/common/utils/persistence-sanitizer.util.spec.ts src/persistence/persistence-sanitization.spec.ts --runInBand
```

Nota: si se eliminaron los tests del fix, el segundo comando debe omitirse o apuntar a la suite vigente.
