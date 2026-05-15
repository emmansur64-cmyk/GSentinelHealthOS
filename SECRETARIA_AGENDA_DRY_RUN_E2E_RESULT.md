# Secretaria Agenda Dry-Run E2E Result

Fecha: 2026-05-15

## Diagnostico

La integracion local/test entre MB-Secretaria y medical-agenda-saas funciona para dry-run remoto con auth interna, idempotencia y auditoria, sin mutaciones.

Se detecto y corrigio un bug minimo de DI en MB-Secretaria necesario para arrancar Nest como proceso real local. No cambia contratos.

## Validaciones ejecutadas

MB-Secretaria:

- `npm test -- --runInBand`: OK, 7 suites, 48 tests.
- `npx tsc --noEmit`: OK.

medical-agenda-saas:

- `npm exec vitest run tests/schedule-import-dry-run.test.ts`: OK, 14 tests.
- `npm run typecheck`: OK.

Global:

- `git diff --check`: OK, con warnings LF/CRLF en los dos archivos TS modificados.
- `git status --short`: ejecutado; worktree global sigue sucio por cambios preexistentes fuera de esta tarea.

## Resultado E2E positivo

- MB-Secretaria respondio `preview_only`.
- `applyEnabled=false`.
- `agendaDryRun.mode=remote_dry_run_contract_validation`.
- `wouldSend=true`.
- `applyBlocked=true`.
- `batchIdempotencyKey` presente.
- `rowIdempotencyKey` presente.
- `remoteDryRunStatus=200`.
- Agenda confirmo `wouldWrite=false`.

## Resultado negativas

- API key interna incorrecta: rechazo controlado `401`.
- Host no allowlisted: MB no envio request remoto.
- Agenda dry-run apagado: rechazo controlado `404`.
- En todos los casos `applyEnabled=false` y `applyBlocked=true`.

## Auditoria

Audit JSONL local/test registra intento, envio, host, path y status. No registra token, API key, archivo completo ni filas completas.

## Estado final

- GO para dry-run local/test.
- NO-GO produccion.
- NO-GO apply real.
- No commit realizado.

## Riesgos restantes

- Hay worktree global sucio preexistente y cambios masivos fuera de scope. No se tocaron.
- Los reportes E2E quedaron untracked.
- Los dos fixes DI en MB-Secretaria deben revisarse y eventualmente commitearse de forma selectiva si se decide promover esta integracion.

## Proximo paso recomendado

Preparar un commit selectivo separado para los dos fixes DI de MB-Secretaria y reportes E2E, solo despues de una revision de stage estricta.

## Confirmacion

- No deploy.
- No restart produccion.
- No push.
- No produccion.
- No DB write.
- No Prisma write.
- No raw SQL write.
- No apply real.
- No datos reales.
