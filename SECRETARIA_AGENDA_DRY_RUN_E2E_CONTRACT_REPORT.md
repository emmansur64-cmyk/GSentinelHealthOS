# Secretaria Agenda Dry-Run E2E Contract Report

Fecha: 2026-05-15
Flujo: `MB-Secretaria POST /admin/import/preview` -> `AgendaApiHttpDryRunClient` -> `medical-agenda-saas POST /admin/schedule-import/dry-run`

## Configuracion local/test usada

medical-agenda-saas:

- `PORT=43101`
- `AGENDA_IMPORT_DRY_RUN_ENABLED=true`
- `AGENDA_IMPORT_DRY_RUN_API_KEY=test_local_dry_run_key`
- `AGENDA_IMPORT_DRY_RUN_MAX_ROWS=500`

MB-Secretaria:

- `PORT=43102`
- `AGENDA_API_DRY_RUN_HTTP_ENABLED=true`
- `AGENDA_API_BASE_URL=http://127.0.0.1:43101`
- `AGENDA_API_DRY_RUN_PATH=/admin/schedule-import/dry-run`
- `AGENDA_API_ALLOWED_HOSTS=127.0.0.1,localhost`
- `AGENDA_API_AUTH_HEADER=x-internal-api-key`
- `AGENDA_API_AUTH_TOKEN=test_local_dry_run_key`
- `AGENDA_API_TIMEOUT_MS=3000`
- `MB_SECRETARIA_ADMIN_API_KEY=test_local_admin_key`
- `MB_SECRETARIA_AUDIT_ENABLED=true`
- `MB_SECRETARIA_AUDIT_DIR=%TEMP%/gsentinel-secretaria-agenda-e2e-audit`

Las variables fueron de proceso, no `.env` real.

## Fixture administrativo no sensible

CSV temporal en `%TEMP%`:

- medico: `Dra Test Local`
- especialidad: `Clinica Medica`
- sede: `Sede Test`
- dia: `lunes`
- inicio: `09:00`
- fin: `10:00`

No se usaron pacientes, DNI ni historia clinica.

## Resultado positivo

POST local a:

`http://127.0.0.1:43102/admin/import/preview`

Headers usados:

- `x-tenant-id: tenant_test_local`
- `x-admin-api-key: test_local_admin_key`
- `x-user-role: secretary`
- `x-user-id: user_test_local`
- `x-user-scope: schedule:import:preview`

Resultado MB-Secretaria:

- HTTP `201`
- `status=preview_only`
- `applyEnabled=false`
- `agendaDryRun.mode=remote_dry_run_contract_validation`
- `agendaDryRun.wouldSend=true`
- `agendaDryRun.applyBlocked=true`
- `batchIdempotencyKey` presente
- `rowIdempotencyKey` presente
- `summary.validRows=1`
- `remoteDryRunAttempted=true`
- `remoteDryRunSent=true`
- `remoteDryRunHost=127.0.0.1`
- `remoteDryRunPath=/admin/schedule-import/dry-run`
- `remoteDryRunStatus=200`

Verificacion directa del contrato Agenda con el mismo tipo de payload:

- HTTP `200`
- `status=dry_run_ok`
- `apply=false`
- `wouldWrite=false`
- `summary.acceptedRows=1`
- fila `accepted`

## Bug minimo corregido

Se detectaron dos fallas de DI en arranque Nest local:

- `AgendaApiHttpDryRunClient` intentaba inyectar `Function` para el transport.
- `ScheduleImportPreviewService` intentaba inyectar `Object` para el cliente union/default.

Correccion minima:

- `@Optional()` en ambos parametros default.
- Sin cambio de contrato HTTP.
- Sin cambio de payload.
- Sin cambio de persistencia.

## Resultado

Contrato E2E local/test OK. GO para dry-run local/test. NO-GO produccion.
