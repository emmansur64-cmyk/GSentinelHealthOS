# Agenda Import Dry-Run Selective Commit Security Review

Fecha: 2026-05-15
Scope revisado: archivos candidate dentro de `medical-agenda-saas`

## Comandos ejecutados

```powershell
Get-Content .env.example
rg -n -i "password|secret|api_key|bearer|token|Authorization|Cookie|postgres://|redis://|eyJ|prisma.*create|prisma.*update|prisma.*delete|executeRaw|queryRaw|\bINSERT\b|\bUPDATE\b|\bDELETE\b|createAppointment|createSchedule|\bapply\b|mutate|write" . --glob ".env.example" --glob "src/app/admin/schedule-import/dry-run/**" --glob "src/lib/admin-schedule-import-dry-run.ts" --glob "tests/schedule-import-dry-run.test.ts" --glob "AGENDA_IMPORT_DRY_RUN*.md"
rg -n -i "prisma.*create|prisma.*update|prisma.*delete|executeRaw|queryRaw|\bINSERT\b|\bUPDATE\b|\bDELETE\b|createAppointment|createSchedule|mutate" src\app\admin\schedule-import\dry-run src\lib\admin-schedule-import-dry-run.ts
rg -n "logServer|console\.|request\.json|payload|x-internal-api-key|AGENDA_IMPORT_DRY_RUN_API_KEY" src\app\admin\schedule-import\dry-run src\lib\admin-schedule-import-dry-run.ts tests\schedule-import-dry-run.test.ts
```

## Confirmaciones

- `.env.example` no contiene secretos reales.
- `AGENDA_IMPORT_DRY_RUN_ENABLED=false` por defecto.
- `AGENDA_IMPORT_DRY_RUN_API_KEY=` esta vacia.
- El endpoint no escribe DB.
- El endpoint no usa Prisma write.
- El endpoint no usa raw SQL write.
- El endpoint no crea turnos reales.
- El endpoint no tiene apply real.
- El endpoint requiere `x-internal-api-key`.
- No se loguea API key.
- No se loguea payload completo.

## Falsos positivos permitidos

- `AGENDA_IMPORT_DRY_RUN_API_KEY=` en `.env.example`, vacia por contrato.
- `AGENDA_IMPORT_DRY_RUN_API_KEY` como nombre de variable en codigo y tests.
- `apply: false` contractual.
- `wouldWrite: false` contractual.
- `apply=true` y `mode: "write"` en tests negativos.
- `write` en documentacion y nombres de tests de seguridad.
- `secret` en textos de reporte al describir ausencia de secretos.

## Resultado

Revision OK para stage selectivo.
