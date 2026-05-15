# Secretaria Agenda Dry-Run E2E DI Review

Fecha: 2026-05-15

## Archivos revisados

- `MB-Secretaria/src/import-preview/agenda-api-http-dry-run.client.ts`
- `MB-Secretaria/src/import-preview/schedule-import-preview.service.ts`

## Hallazgos

- `agenda-api-http-dry-run.client.ts` solo agrega `Optional` desde `@nestjs/common` y aplica `@Optional()` al parametro `transport`.
- `schedule-import-preview.service.ts` solo agrega `Optional` desde `@nestjs/common` y aplica `@Optional()` al parametro `agendaApiClient`.
- Los defaults existentes se conservan.
- No se modifica contrato publico.
- No se modifica payload.
- No se habilita HTTP por defecto fuera del comportamiento existente.
- No se habilita apply.
- No se relaja seguridad.
- No se agregan secretos.
- No se agregan writes.

## Decision

Revision DI OK. Los cambios son minimos y compatibles con el objetivo de estabilizar arranque Nest/E2E sin alterar el contrato dry-run.
