# Secretaria Agenda Dry-Run E2E Audit Report

Fecha: 2026-05-15

## Auditoria revisada

Archivo temporal:

`%TEMP%/gsentinel-secretaria-agenda-e2e-audit/import-preview.audit.jsonl`

## Campos confirmados

Los eventos registran:

- `remoteDryRunAttempted`
- `remoteDryRunSent`
- `remoteDryRunHost`
- `remoteDryRunPath`
- `remoteDryRunStatus`
- `remoteDryRunErrorCode` cuando corresponde
- `batchId`
- `batchIdempotencyKey`
- `summary`
- `security.authPassed`
- `security.roleAllowed`
- `security.scopeAllowed`

## Eventos observados

- Positivo: `remoteDryRunStatus=200`
- API key interna incorrecta: `remoteDryRunStatus=401`, `remoteDryRunErrorCode=remote_non_2xx`
- Host no allowlisted: `remoteDryRunSent=false`, `remoteDryRunErrorCode=host_not_allowlisted`
- Agenda apagado: `remoteDryRunStatus=404`, `remoteDryRunErrorCode=remote_non_2xx`

## No registrado

Grep defensivo sobre JSONL no encontro:

- `test_local_dry_run_key`
- `test_local_admin_key`
- `x-internal-api-key`
- `x-admin-api-key`
- CSV completo
- filas completas
- medico/especialidad/sede del fixture
- horarios del fixture

## Resultado

Auditoria OK: conserva trazabilidad operacional sin credenciales ni payload completo.
