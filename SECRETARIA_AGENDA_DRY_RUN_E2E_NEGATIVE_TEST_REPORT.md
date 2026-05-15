# Secretaria Agenda Dry-Run E2E Negative Test Report

Fecha: 2026-05-15

## Negativa 1: API key interna incorrecta

Config:

- MB-Secretaria puerto `43103`
- Agenda base `http://127.0.0.1:43101`
- `AGENDA_API_AUTH_TOKEN=wrong_local_key`

Resultado:

- HTTP MB `201`
- `status=preview_only`
- `applyEnabled=false`
- `agendaDryRun.mode=remote_dry_run_contract_validation`
- `wouldSend=true`
- `applyBlocked=true`
- `remoteDryRunAttempted=true`
- `remoteDryRunSent=true`
- `remoteDryRunStatus=401`
- `remoteDryRunErrorCode=remote_non_2xx`

Interpretacion: rechazo controlado por Agenda, sin aplicar cambios.

## Negativa 2: host no allowlisted

Config:

- MB-Secretaria puerto `43104`
- Agenda base `http://127.0.0.1:43101`
- `AGENDA_API_ALLOWED_HOSTS=localhost`

Resultado:

- HTTP MB `201`
- `status=preview_only`
- `applyEnabled=false`
- `agendaDryRun.mode=local_contract_validation`
- `wouldSend=false`
- `applyBlocked=true`
- `remoteDryRunAttempted=true`
- `remoteDryRunSent=false`
- `remoteDryRunHost=127.0.0.1`
- `remoteDryRunPath=/admin/schedule-import/dry-run`
- `remoteDryRunErrorCode=host_not_allowlisted`

Interpretacion: MB-Secretaria no envio request remoto.

## Negativa 3: endpoint Agenda apagado

Config:

- Agenda local puerto `43101`
- `AGENDA_IMPORT_DRY_RUN_ENABLED=false`
- MB-Secretaria apuntando al mismo `AGENDA_API_BASE_URL`

Resultado:

- HTTP MB `201`
- `status=preview_only`
- `applyEnabled=false`
- `agendaDryRun.mode=remote_dry_run_contract_validation`
- `wouldSend=true`
- `applyBlocked=true`
- `remoteDryRunAttempted=true`
- `remoteDryRunSent=true`
- `remoteDryRunStatus=404`
- `remoteDryRunErrorCode=remote_non_2xx`

Interpretacion: Agenda responde cerrado por feature flag; MB lo registra sin aplicar cambios.

## Mutaciones

Verificacion defensiva:

- No DB write.
- No Prisma write.
- No raw SQL write.
- No creacion de turnos reales.
- No apply real.

## Resultado

Pruebas negativas OK para entorno local/test.
