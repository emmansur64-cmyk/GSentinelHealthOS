# Secretaria Agenda Dry-Run E2E Security Review

Fecha: 2026-05-15

## Grep defensivo ejecutado

```powershell
rg -n -i "password|secret|api_key|bearer|token|Authorization|Cookie|postgres://|redis://|eyJ|dni|patient|paciente|historia|prisma.*create|prisma.*update|prisma.*delete|executeRaw|queryRaw|INSERT|UPDATE|DELETE|apply|mutate|write" <archivos-candidatos>
```

## Archivos candidatos revisados

- `MB-Secretaria/src/import-preview/agenda-api-http-dry-run.client.ts`
- `MB-Secretaria/src/import-preview/schedule-import-preview.service.ts`
- `SECRETARIA_AGENDA_DRY_RUN_E2E_PRECHECK.md`
- `SECRETARIA_AGENDA_DRY_RUN_E2E_CONTRACT_REPORT.md`
- `SECRETARIA_AGENDA_DRY_RUN_E2E_NEGATIVE_TEST_REPORT.md`
- `SECRETARIA_AGENDA_DRY_RUN_E2E_AUDIT_REPORT.md`
- `SECRETARIA_AGENDA_DRY_RUN_E2E_RESULT.md`

## Coincidencias permitidas

- `AGENDA_API_AUTH_TOKEN`, `MB_SECRETARIA_ADMIN_API_KEY` y claves `test_local_*` aparecen solo como configuracion de test documentada.
- `apply=false`, `applyEnabled=false`, `applyBlocked=true` y `wouldWrite=false` aparecen como contrato dry-run.
- `MUTATING_PATH_RE` y `applyScheduleImport` aparecen como guardas/denylist que bloquean mutaciones.
- Referencias a audit JSONL aparecen como ruta temporal local/test y no como archivo staged.
- Referencias a DNI, paciente e historia aparecen en reportes para confirmar ausencia de datos reales.

## Bloqueos revisados

- No `.env` real.
- No secretos reales.
- No `postgres://`.
- No `redis://`.
- No JWT con prefijo `eyJ`.
- No Prisma write.
- No raw SQL write.
- No DB write.
- No apply real.
- No datasets.
- No logs/audit JSONL staged.

## Decision

Security review OK para continuar a validaciones. Las coincidencias son contractuales, de test local o guardas defensivas.
