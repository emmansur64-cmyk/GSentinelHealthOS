# Secretaria Agenda Staging Execution Audit

Fecha: 2026-05-15

## Audit temporal

Archivo revisado:

`%TEMP%/gsentinel-secretaria-agenda-staging-mock/audit/import-preview.audit.jsonl`

## Verificaciones

- Existe: SI.
- Registra exitos: SI, 11 eventos `secretaria.import.preview`.
- Registra rechazos: SI, 2 eventos `secretaria.import.preview.rejected`.
- Registra `remoteDryRunAttempted`: SI, 11 ocurrencias.
- Registra `remoteDryRunSent` cuando corresponde: SI, 7 ocurrencias con `true`.
- Registra rechazos de rol/scope: SI.
- Registra rechazos remotos/controlados: SI.

## Sanitizacion

Grep defensivo sobre audit temporal para:

```text
staging_mock_dry_run_key
staging_mock_admin_key
x-internal-api-key
x-admin-api-key
Authorization
Bearer
api_key
password
Dra Test Local
Dr Mock Agenda
Clinica Medica Test
Sede Test
09:00
14:00
DNI
historia
paciente
patient
```

Resultado: sin coincidencias prohibidas.

## Contenido observado

El audit registra metadatos operacionales y agregados:

- tenant fake.
- user fake.
- role/scope.
- batchId.
- batchIdempotencyKey.
- resumen agregado.
- flags de dry-run remoto.
- host/path remoto.
- status remoto.
- error code remoto.

No registra:

- API key.
- token.
- archivo completo.
- filas completas.
- datos reales.
- pacientes.
- DNI.
- historia clinica.

## Decision

Auditoria staging/mock OK. Sanitizacion confirmada para esta ejecucion.
