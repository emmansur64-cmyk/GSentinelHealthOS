# Secretaria Agenda Staging Execution Config

Fecha: 2026-05-15

## Modo de configuracion

Se usaron variables temporales de proceso para los servicios locales/staging mock. No se modifico `.env` productivo y no se usaron claves reales.

## Puertos

- medical-agenda-saas: `43110`
- MB-Secretaria: `43111`
- Puertos auxiliares negativos previstos: `43112`, `43113`

## medical-agenda-saas

```env
PORT=43110
NODE_ENV=development
AGENDA_IMPORT_DRY_RUN_ENABLED=true
AGENDA_IMPORT_DRY_RUN_API_KEY=staging_mock_dry_run_key
AGENDA_IMPORT_DRY_RUN_MAX_ROWS=500
```

## MB-Secretaria

```env
PORT=43111
NODE_ENV=development
AGENDA_API_DRY_RUN_HTTP_ENABLED=true
AGENDA_API_BASE_URL=http://127.0.0.1:43110
AGENDA_API_DRY_RUN_PATH=/admin/schedule-import/dry-run
AGENDA_API_ALLOWED_HOSTS=127.0.0.1,localhost
AGENDA_API_AUTH_HEADER=x-internal-api-key
AGENDA_API_AUTH_TOKEN=staging_mock_dry_run_key
AGENDA_API_TIMEOUT_MS=3000
MB_SECRETARIA_ADMIN_API_KEY=staging_mock_admin_key
MB_SECRETARIA_AUDIT_ENABLED=true
MB_SECRETARIA_AUDIT_DIR=%TEMP%/gsentinel-secretaria-agenda-staging-mock/audit
```

## Seguridad operacional

- No produccion.
- No deploy productivo.
- No push.
- No datos reales.
- No claves reales.
- No apply real.
- No DB write ni Prisma write.
