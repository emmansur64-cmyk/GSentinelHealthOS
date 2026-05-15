# Secretaria Agenda Staging Execution Result

Fecha: 2026-05-15

## 1. Diagnostico

Validacion staging/mock local ejecutada para el flujo:

`MB-Secretaria POST /admin/import/preview` -> `AgendaApiHttpDryRunClient` -> `medical-agenda-saas POST /admin/schedule-import/dry-run`

Resultado general: OK para dry-run staging/mock. No se habilito apply y no se observo write real.

## 2. Configuracion usada

medical-agenda-saas local:

- `PORT=43110`
- `NODE_ENV=development`
- `AGENDA_IMPORT_DRY_RUN_ENABLED=true`
- `AGENDA_IMPORT_DRY_RUN_API_KEY=staging_mock_dry_run_key`
- `AGENDA_IMPORT_DRY_RUN_MAX_ROWS=500`

MB-Secretaria local:

- `PORT=43111`
- `NODE_ENV=development`
- `AGENDA_API_DRY_RUN_HTTP_ENABLED=true`
- `AGENDA_API_BASE_URL=http://127.0.0.1:43110`
- `AGENDA_API_DRY_RUN_PATH=/admin/schedule-import/dry-run`
- `AGENDA_API_ALLOWED_HOSTS=127.0.0.1,localhost`
- `AGENDA_API_AUTH_HEADER=x-internal-api-key`
- `AGENDA_API_AUTH_TOKEN=staging_mock_dry_run_key`
- `AGENDA_API_TIMEOUT_MS=3000`
- `MB_SECRETARIA_ADMIN_API_KEY=staging_mock_admin_key`
- `MB_SECRETARIA_AUDIT_ENABLED=true`
- `MB_SECRETARIA_AUDIT_DIR=%TEMP%/gsentinel-secretaria-agenda-staging-mock/audit`

No se uso `.env` productivo. El `.env` raiz fue detectado en precheck y evitado.

## 3. Fixtures ejecutados

Directorio temporal: `%TEMP%/gsentinel-secretaria-agenda-staging-mock/fixtures`

- `valid.csv`
- `valid.xlsx`
- `duplicate.csv`
- `overlap.csv`
- `invalid-time.csv`

Datos falsos: `Dra Test Local`, `Dr Mock Agenda`, `Clinica Medica Test`, `Sede Test`, `lunes`, `martes` y horarios artificiales.

## 4. Resultados positivos

CSV valido:

- HTTP `201`.
- `status=preview_only`.
- `applyEnabled=false`.
- `agendaDryRun.mode=remote_dry_run_contract_validation`.
- `agendaDryRun.wouldSend=true`.
- `agendaDryRun.applyBlocked=true`.
- `remoteDryRunStatus=200`.
- `rowIdempotencyKey` presente.
- `batchIdempotencyKey` presente.

XLSX valido:

- HTTP `201`.
- `status=preview_only`.
- `applyEnabled=false`.
- `agendaDryRun.mode=remote_dry_run_contract_validation`.
- `agendaDryRun.wouldSend=true`.
- `agendaDryRun.applyBlocked=true`.
- `remoteDryRunStatus=200`.

Verificacion directa del contrato Agenda con payload equivalente:

- HTTP `200`.
- `status=dry_run_ok`.
- `wouldWrite=false`.
- `apply=false`.

## 5. Resultados negativos

- API key interna incorrecta: rechazo remoto controlado, `remoteDryRunStatus=401`, `remoteDryRunErrorCode=remote_non_2xx`, `applyEnabled=false`.
- Host no allowlisted: MB no envio request remoto, `remoteDryRunSent=false`, `remoteDryRunErrorCode=host_not_allowlisted`.
- Agenda dry-run apagado: mock contractual local devolvio `404`, MB registro `remoteDryRunStatus=404`, `remoteDryRunErrorCode=remote_non_2xx`.
- CSV con duplicado: HTTP `201`, `duplicates=2`, `validRows=0`, `applyEnabled=false`.
- CSV con solape: HTTP `201`, `overlaps=2`, `validRows=0`, `applyEnabled=false`.
- CSV con horario invalido: HTTP `201`, `invalidRows=1`, `validRows=0`, `applyEnabled=false`.
- Rol clinico rechazado: HTTP `403`, rechazo administrativo controlado.
- Scope clinico rechazado: HTTP `403`, rechazo administrativo controlado.
- Timeout controlado: `remoteDryRunErrorCode=remote_timeout`, `remoteDryRunSent=false`, `applyEnabled=false`.

## 6. Auditoria

Audit temporal:

`%TEMP%/gsentinel-secretaria-agenda-staging-mock/audit/import-preview.audit.jsonl`

Verificado:

- Existe.
- Registra exitos.
- Registra rechazos.
- Registra `remoteDryRunAttempted`.
- Registra `remoteDryRunSent` cuando corresponde.
- No registra API key.
- No registra token.
- No registra archivo completo.
- No registra filas completas.
- No registra datos reales.

## 7. Puertos apagados

Puertos usados y apagados:

- `43110`
- `43111`
- `43112`
- `43113`

Verificacion posterior: sin procesos escuchando en esos puertos.

## 8. Validaciones finales

MB-Secretaria:

- `npm test -- --runInBand`: OK, 7 suites, 48 tests.
- `npx tsc --noEmit`: OK.

medical-agenda-saas:

- `npm exec vitest run tests/schedule-import-dry-run.test.ts`: OK, 1 file, 14 tests.
- `npm run typecheck`: OK.

Global:

- `git diff --check`: OK, con warning LF/CRLF en un archivo preexistente de `MB-Chat` fuera de scope.
- `git status --short`: ejecutado; el worktree sigue sucio por cambios preexistentes y por reportes nuevos no commiteados.

## 9. Riesgos restantes

- Worktree global sucio con cambios fuera de scope en `MB-Chat`, `MetaBrain`, datasets/modelos de `MB-Secretaria` y reportes no relacionados.
- El caso Agenda dry-run apagado uso mock HTTP contractual local porque Next bloquea dos `next dev` simultaneos en el mismo proyecto.
- La ejecucion fue local/staging mock, no valida redes, TLS ni secretos gestionados reales de un entorno staging compartido.
- Los fixtures y logs temporales quedan fuera del repo en `%TEMP%`.

## 10. Confirmacion

- No produccion.
- No deploy productivo.
- No push.
- No datos reales.
- No pacientes reales.
- No DB write.
- No Prisma write.
- No raw SQL write.
- No apply real.
- No claves reales.
- No commit automatico.
